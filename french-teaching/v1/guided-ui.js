// A guided, voice-first teaching flow built on the existing Next/French evidence.
// Repeated phrases and gradual fading are original content informed by
// Michaela teacher descriptions and general Paul Noble teaching principles.
// No publisher text, recordings or proprietary course scripts are reproduced.
import {MAGIC10_VERBS,magicTenFor,magicTenUnitHints} from './magic10.js';
import {
  ALL_UNITS,unitsForTrack,guidedLesson,guidedStatus,guidedTeachingRef,
  guidedCompletionRefs,recommendedGuidedUnit,guidedFirstAttemptPhase
} from './guided-lessons.js';
import {markAnswer,normaliseAnswer} from './data.js';
import {exactAudit} from './answer-history.js';
import {compareFrench,correctionSummary,phraseTarget,frenchTokens,differenceSegments,writingConvention} from './revision-signals.js';
import {adaptiveStep,adaptiveOutcome} from './adaptive-teaching.js';
import {curriculumVariants,curriculumNormalize} from './curriculum-meta.js';
import {activeRest,restForUnit,restMarkup} from './study-timing.js';

const html=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const marker=row=>guidedCompletionRefs(row.id);
const has=(entries,ref)=>entries.some(e=>e?.source?.ref===ref);
const DAY=86400000;
function choiceOrder(row){
  const options=(row.choices||[]).slice();
  const rotate=[...row.id].reduce((n,ch)=>n+ch.charCodeAt(0),0)%Math.max(1,options.length);
  return [...options.slice(rotate),...options.slice(0,rotate)];
}
export function answerFeedback(input,expected){
  const got=normaliseAnswer(input),want=normaliseAnswer(expected);
  if(!got)return 'Say the full phrase first, then try typing it.';
  const negative=s=>/(?:^|\s)(?:ne\s|n')[^.!?;]*?\bpas\b/u.test(s);
  if(negative(want)&&!negative(got))return 'Check the negative: ne (or n’) goes before the verb, and pas after it.';
  if(want.includes('je vais ')&&got.includes("j'ai "))return 'Je vais + infinitive is a future plan. J’ai + past participle is a completed action.';
  if(want.includes("j'ai ")&&got.includes('je vais '))return 'For the completed past, use j’ai + the correct past participle.';
  const strip=x=>x.normalize('NFD').replace(/[\u0300-\u036f]/g,'');
  if(strip(got)===strip(want))return correctionSummary(input,expected);
  if(want.includes('parce que')&&!got.includes('parce que'))return 'To explain why, join the two clauses with parce que.';
  if(want.includes(' mais ')&&!got.includes(' mais '))return 'To contrast two ideas, use mais.';
  if(want.startsWith("j'")&&got.startsWith('je '))return 'Before a vowel sound, je normally contracts to j’.';
  return correctionSummary(input,expected);
}

// Only explicit learning transitions request speech, not CSS or rerender.
// Identical visual status for guided lessons and all other continuation buttons.
export const AUDIO_WAIT_LABEL='Waiting for audio to finish…';
export const audioWaitMarkup=()=>'<span class="ft-audio-wait-text">Waiting for audio to finish</span><span class="ft-audio-wait-dots" aria-hidden="true"><span>.</span><span>.</span><span>.</span></span>';
const SPEECH_EVENTS=new Set(['model','listening-prompt','visible-french','reveal','correction','choice','reinforce','reference-change','replay']);
export function learningAudioText(event,text,{protectedCheck=false}={}){
  return !protectedCheck&&SPEECH_EVENTS.has(event)?String(text??'').trim():'';
}
export function guidedEntryAudio(step){
  if(!step)return '';
  if(step.kind==='listen'||step.kind==='transcribe'||step.kind==='model'&&step.unlockAction==='reverse')return step.fr;
  if(step.kind!=='model'||!step.modelInitiallyShown)return '';
  return teacherModelAudio(step);
}
export function teacherModelAudio(step){
  if(!step?.fr)return '';
  if(step.unlockAction)return step.fr;
  // Short recurring classroom French, deliberately intermittent. Quoted
  // expressions work for both an infinitive and a complete sentence.
  if(step.stage==='present'&&step.id.endsWith(':connector'))
    return 'Écoutez cette phrase. '+step.fr+'. À vous de répéter.';
  if(step.id.endsWith(':0'))return 'Écoutez bien. On dit : '+step.fr+'. Répétez.';
  if(step.id.endsWith(':3'))return 'Voici une expression utile : '+step.fr+'. À vous !';
  if(step.id.endsWith(':6'))return 'Encore une fois : '+step.fr+'.';
  return step.fr;
}
export function guidedHint(step,level=1){
  if(!step?.fr)return '';
  const words=step.fr.trim().split(/\s+/);
  if(level>=2){
    const n=Math.min(Math.max(1,Math.floor(words.length/3)),Math.max(0,words.length-1));
    return n?'Start with “'+words.slice(0,n).join(' ')+'”, then finish the phrase yourself.':'First letter: '+step.fr[0]+'. Listen and finish the word.';
  }
  if(step.kind==='transcribe')return 'Listen for '+words.length+' separate written words. Replay the French, then check endings and accents.';
  if(words.length>5&&/\b(parce que|mais|donc)\b/i.test(step.fr)){
    const connector=step.fr.match(/\b(parce que|mais|donc)\b/i)[0].toLowerCase();
    const purpose={'parce que':'a reason (because)','mais':'a contrast (but)','donc':'a result (so)'}[connector];
    return 'Build two short ideas first. Join them with '+purpose+'.';
  }
  if(step.hint)return step.hint;
  const v=MAGIC10_VERBS[step.verbId];
  const clues={
    infinitive:'Think of the action in its dictionary form, without adding “I”.',
    like:'Start with the French for “I like”, then add the action in its dictionary form.',
    want:'Start with the French for “I want”, then add the action in its dictionary form.',
    present:'Say what you do now: use the “I” form of the action, not the dictionary form.',
    negative:'Put the negative around the action verb: ne (or n’) before it, pas after it.',
    can:'Start with the French for “I can”, then use the dictionary form of the action.',
    must:'Start with the French for “I must”, then use the dictionary form of the action.',
    'near-future':'Build “I am going to” first, then the unchanged action phrase.',
    past:'For this completed action, use the “I have” form followed by the past participle.',
    polite:'Start with the French for “I would like”, then add the action.'
  };
  return (clues[step.structure]||'Break the meaning into a subject, an action and any extra details.')+
    (v&&['present','negative','past'].includes(step.structure)?' Think of the action “'+v.english+'”.':'');
}
// Render each visible French word as a small native button without altering
// or duplicating a single character of the source. Keep elisions together.
const highlightedWord=(value,other)=>differenceSegments(value,other).map(p=>p.changed?'<mark class="ft-word-difference">'+html(p.text)+'</mark>':html(p.text)).join('');
function plainHighlights(value,highlights){
  const text=String(value??'');let cursor=0,result='';
  for(const token of highlights){result+=html(text.slice(cursor,token.start))+highlightedWord(token.text,token.counterpart);cursor=token.end;}
  return result+html(text.slice(cursor));
}
export function spokenWords(value,{choice=false,highlights=[],targets=[]}={}){
  const text=String(value??'');
  const tokens=frenchTokens(text);
  let cursor=0,result='';
  for(const token of tokens){
    const word=token.text,start=token.start;
    const escaped=html(word),difference=highlights.find(x=>x.start===start),target=targets.find(x=>x.start===start)?.replacement||difference?.replacement;
    const content=difference?highlightedWord(word,difference.counterpart):escaped;
    result+=html(text.slice(cursor,start))+(choice?
      '<span class="ft-choice-word" lang="fr" data-choice-word="'+escaped+'" title="Tap to hear; hold to explore">'+escaped+'</span>':
      '<button type="button" class="ft-spoken-word" lang="fr" data-gword="'+escaped+'" aria-label="Hear '+escaped+'" title="Tap to hear; hold to explore"'+(target?' data-revision-target="'+html(target)+'"':'')+'>'+content+'</button>');
    cursor=start+word.length;
  }
  return result+html(text.slice(cursor));
}
export const EXACT_ANSWER_ATTRIBUTES='spellcheck="false" autocorrect="off" autocapitalize="off" autocomplete="off" writingsuggestions="false" inputmode="text"';
export function answerComparison({answer='',expected,result,lang='fr',replay=''}) {
  const status=result==='correct'?'correct':result==='incorrect'?'incorrect':'revealed';
  const label=status==='correct'?'Correct':status==='incorrect'?'Incorrect':'Answer revealed';
  const submitted=String(answer??'').trim().length>0;
  const aligned=status==='incorrect'?compareFrench(answer,expected):[];
  const diff=aligned.filter(x=>x.kind!=='match');
  const left=diff.filter(x=>x.left).map(x=>({...x.left,replacement:x.near?x.right?.text:null,counterpart:x.near?x.right?.text:null}));
  const right=diff.filter(x=>x.right).map(x=>({...x.right,counterpart:x.near?x.left?.text:null}));
  const targets=aligned.filter(x=>x.left&&x.right&&(x.kind==='match'||x.near)).map(x=>({start:x.left.start,replacement:x.right.text}));
  const content=(value,highlights,targets=[])=>lang==='fr'?spokenWords(value,{highlights,targets}):plainHighlights(value,highlights);
  const mark=status==='correct'?'✓':status==='incorrect'?'×':'';
  const detail=status==='incorrect'?correctionSummary(answer,expected):status==='correct'?writingConvention(answer,expected):'';
  const statusText=status==='correct'?'Correct':status==='incorrect'?(diff.length===1?'One difference to review':diff.length>1?diff.length+' differences to review':'Check your answer'):'Answer revealed';
  return '<div class="ft-guided-pair ft-answer-comparison '+status+'" role="group" aria-label="'+label+'">'+
    '<div class="ft-answer-submitted"><small>'+ (status==='revealed'?'Your draft (not checked)':'Your answer')+
    (mark?' <span class="ft-answer-mark" aria-hidden="true">'+mark+'</span><span class="ft-answer-status">'+html(statusText)+'</span>':'')+'</small>'+
    '<p lang="'+html(lang)+'" class="ft-answer-value">'+(submitted?content(answer,left,targets):'—')+'</p></div>'+
    '<div class="ft-answer-expected"><small>Correct answer</small><div class="ft-pair-french">'+
    '<p lang="'+html(lang)+'" class="ft-answer-value">' +content(expected,right)+'</p>'+replay+'</div></div>'+
    (detail?'<p class="ft-answer-detail" role="status">'+html(detail)+'</p>':'')+'</div>';
}
export function createGuidedInterface({getEntries,getTrack=()=> 'michaela',requestStart,record,recordAttempt=()=>true,speak,playAudio=(event,text,lang)=>speak(learningAudioText(event,text),lang),waitForSpeech=()=>Promise.resolve(),cancelSpeech=()=>{},refresh,navigate,focusTarget=()=>{},getAdaptivePlans=()=>[],planAdaptive=()=>null,signalContext=()=>({}),recordSignal=()=>true}){
  if(typeof getEntries!=='function'||typeof record!=='function'||typeof speak!=='function'||typeof refresh!=='function')
    throw Error('Guided lessons require evidence and speech adapters');
  const state={
    unitId:null,step:null,answer:'',result:null,feedback:'',wrong:false,done:false,
    hint:0,revealed:false,wrongChoices:new Set(),selectedVerb:'parler',error:null,advancing:false
  };
  let navigation=0;
  const evidence=()=>getEntries()||[];
  const cancelAdvance=()=>{navigation++;state.advancing=false;cancelSpeech();};
  const currentStatus=()=>guidedStatus(state.unitId||recommendedGuidedUnit(evidence(),Date.now(),getTrack()).unit.id,evidence());
  const chooseNext=()=>{const status=currentStatus();if(status.teaching.completed===status.teaching.total&&restForUnit(status.unit.id,evidence()))return null;const plan=planAdaptive(status);return plan?adaptiveStep(plan):status.next;};
  const hintRef=step=>step.id+':hint';
  const resetStep=()=>{
    state.step=null;state.answer='';state.result=null;state.feedback='';state.wrong=false;
    state.done=false;state.hint=0;state.revealed=false;state.wrongChoices.clear();state.error=null;
  };
  const announce=()=>refresh();
  const go=page=>typeof navigate==='function'?navigate(page):announce();
  const start=(unitId)=>{
    const locked=activeRest(evidence(),Date.now(),null);
    const id=locked?.unitId||unitId||recommendedGuidedUnit(evidence(),Date.now(),getTrack()).unit.id;
    if(!locked&&!unitsForTrack(getTrack()).some(u=>u.id===id))return;
    guidedLesson(id); // validate before writing any record
    cancelAdvance();resetStep();
    state.unitId=id;
    if(locked){go('lesson');return;}
    if(!has(evidence(),guidedTeachingRef(id))){
      const now=new Date().toISOString();
      record({concept:'french:guided:'+id,phase:'practice',support:'worked-example',
        taughtAt:now,sourceRef:guidedTeachingRef(id),at:now});
    }
    state.step=chooseNext();
    if(state.step)state.hint=state.step.adaptivePlan?.hintLevel||Number(has(evidence(),hintRef(state.step)));
    go('lesson');
    const audio=guidedEntryAudio(context().current);if(audio)playAudio('model',audio);
    focusTarget('#ft-guided-input,[data-ft-advance],[data-gchoice]');
  };
  const reset=()=>{cancelAdvance();state.unitId=null;resetStep();state.selectedVerb='parler';};
  const context=()=>{
    const id=state.unitId||recommendedGuidedUnit(evidence(),Date.now(),getTrack()).unit.id;
    const status=guidedStatus(id,evidence());
    const plans=getAdaptivePlans(id);
    const rest=status.teaching.completed===status.teaching.total?restForUnit(id,evidence()):null;
    const current=state.step||(rest?null:status.next);
    if(current&&!state.step){state.step=current;if(has(evidence(),hintRef(current)))state.hint=1;}
    return {id,status,current,plans,rest};
  };
  // Keep the old phrase on screen until its speech ends. Explicit navigation
  // invalidates pending advances, including learner/unit changes.
  const advance=async(reinforce='')=>{
    if(state.advancing)return;
    const token=++navigation;
    state.advancing=true;announce();
    await waitForSpeech();
    if(token!==navigation)return;
    const next=chooseNext();
    const same=next&&normaliseAnswer(next.fr)===normaliseAnswer(reinforce);
    const safeRepeat=same&&!guidedEntryAudio(next)?'':reinforce;
    if(safeRepeat)await playAudio('reinforce',safeRepeat);
    if(token!==navigation)return;
    state.advancing=false;resetStep();state.step=next;
    if(next)state.hint=next.adaptivePlan?.hintLevel||Number(has(evidence(),hintRef(next)));
    announce();
    const intro=guidedEntryAudio(context().current);
    if(intro)playAudio('model',intro);
    focusTarget('#ft-guided-input,[data-ft-advance],[data-gchoice]');
  };
  const completion=(step,support)=>{
    if(step.adaptivePlan){state.done=true;return;}
    if(!has(evidence(),marker(step).complete)){
      record({concept:step.concept,phase:'practice',support,
        taughtAt:context().status.taughtAt||new Date().toISOString(),
        sourceRef:marker(step).complete});
    }
    state.done=true;
  };
  const firstAttempt=(step,correct,extraSupport='none')=>{
    if(step.adaptivePlan||has(evidence(),marker(step).first))return;
    const {status}=context();
    const assisted=state.hint||has(evidence(),hintRef(step))||state.revealed||state.wrong;
    const support=state.revealed||extraSupport==='worked-example'?'worked-example':
      assisted?'small-prompt':
      step.stage==='guided'||step.stage==='repair'?'small-prompt':'none';
    let phase=guidedFirstAttemptPhase(step,evidence(),status.taughtAt);
    if(phase==='transfer'&&support!=='none')phase='practice';
    record({concept:step.concept,phase,novel:phase==='transfer'&&step.novel===true,
      correctCount:correct?1:0,total:1,support,
      taughtAt:status.taughtAt||new Date().toISOString(),sourceRef:marker(step).first});
  };
  const isChoice=step=>step?.kind==='choice'||step?.kind==='listen';
  const page=()=>{
    const {id,status,current,plans,rest}=context();
    if(!status.unit)return '';
    const unit=status.unit;
    const rows=guidedLesson(id).steps;
    const groups=[
      ['recap','Recall'],['present','New phrases'],['guided','Guided practice'],
      ['independent','By yourself'],['transfer','New combinations'],['repair','Repair'],
      ['review','Remember later'],['adaptive','Personal practice']
    ];
    const stageLabels=Object.fromEntries(groups);
    const adaptiveCompleted=plans.filter(p=>p.complete).length;
    const completed=status.completed+(status.mode==='review'?0:adaptiveCompleted);
    const total=status.total+(status.mode==='review'?0:plans.length);
    const counts=status.teaching;
    const breakdown=counts.coreCompleted+'/'+counts.coreTotal+' core steps · '+counts.repairCompleted+'/'+counts.repairTotal+' corrections'+(plans.length?' · '+adaptiveCompleted+'/'+plans.length+' personal practice':'');
    const pct=total?Math.round(completed/total*100):0;
    const available=unitsForTrack(getTrack()),other=(available.some(u=>u.id===id)?available:[unit,...available]).map(u=>'<option value="'+html(u.id)+'"'+(u.id===id?' selected':'')+'>'+
      html(u.label+': '+u.name)+'</option>').join('');
    const head='<section class="ft-card ft-guided-shell"><div class="ft-guided-head">'+
      '<div><p class="ft-eyebrow">'+(unit.incremental?'UNLOCKING FRENCH · ONE BLOCK AT A TIME':'GUIDED FRENCH · SPEAK → REPEAT → REMEMBER')+'</p>'+
      '<h2>'+html(unit.name)+'</h2><p>'+html(unit.goal)+'</p></div>'+
      '<label>Teaching unit<select data-gunit'+(rest?.active?' disabled aria-label="Teaching unit locked during learning break"':'')+'>'+other+'</select></label></div>'+
      '<div class="ft-guided-progress" role="progressbar" aria-label="Lesson progress" aria-valuenow="'+completed+
      '" aria-valuemin="0" aria-valuemax="'+total+'"><span style="width:'+pct+'%"></span></div>'+
      '<p class="ft-small ft-progress-count"><strong>'+completed+'/'+total+'</strong> '+(status.mode==='review'?'day '+status.reviewDay+' review completed':'teaching steps completed')+' · '+html(breakdown)+'</p>';
    if(!current&&(rest||status.mode==='complete')){
      const next=status.nextReviewAt?new Date(status.nextReviewAt).toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric'}):'none scheduled';
      return head+'<div class="ft-guided-congrats"><h3>Excellent. Now leave it for a while.</h3>'+
        (rest?restMarkup(rest):unit.track?'<p>You have completed the guided teaching. Continue to the independent check and scheduled reviews.</p>':'<p>You have completed the guided teaching. The next retrieval opportunity is <strong>'+html(next)+'</strong>. This is a schedule, not proof of retention.</p>')+
        (rest?'<button type="button" data-gact="next-unit" data-ft-advance data-rest-continue data-rest-unit="'+html(id)+'" class="ft-primary"'+(rest.active?' disabled aria-disabled="true"':'')+'>'+ (rest.active?'Continue when the break finishes':'Start independent recall')+'</button>':'<button type="button" data-gact="next-unit" data-ft-advance class="ft-primary">Continue to the next learning activity</button>')+'</div>'+(unit.incremental&&!rest?'<details class="ft-unlock-glossary"><summary>Chapter vocabulary &amp; building blocks</summary>'+unit.blocks.map(b=>'<div class="ft-unlock-glossary-row"><span>'+html(b.en)+'</span><strong lang="fr">'+spokenWords(b.fr)+'</strong><small>'+html(b.pronunciation)+'</small></div>').join('')+'</details>':'')+
        '<button type="button" data-page="home">Return to overview</button></section>';
    }
    if(!current)return head+'<p>Nothing due in this lesson. Select a different teaching unit above.</p></section>';
    const step=current,style=stageLabels[step.stage]||step.stage;
    const phase=step.stage==='review'?' · Day '+status.reviewDay:'';
    const busy=state.advancing?' disabled aria-busy="true"':'';
    const advanceButton=(act,label,defaultAction=true)=>'<button type="button" data-gact="'+act+'"'+(defaultAction?' data-ft-advance':'')+' class="ft-primary"'+busy+(state.advancing&&defaultAction?' data-audio-wait aria-label="'+AUDIO_WAIT_LABEL+'"':'')+'>'+(state.advancing&&defaultAction?audioWaitMarkup():html(label))+'</button>';
    const pair=(english,french,covered=false)=>'<div class="ft-guided-pair'+(covered?' ft-pair-covered':'')+'"><p class="ft-guided-english">'+html(english)+'</p>'+
      (french?'<div class="ft-pair-french"><p lang="fr" class="ft-guided-french">'+spokenWords(french)+'</p><button type="button" data-gact="speak" aria-label="Hear the French again">▶</button></div>':
        covered?'<span class="ft-pair-placeholder">Say it from memory, then reveal.</span>':'')+'</div>';
    let body='<div class="ft-guided-task'+(unit.incremental?' ft-unlock-task':'')+'" data-guided-step="'+html(step.id)+'"'+(step.unlockAction?' data-unlock-action="'+html(step.unlockAction)+'"':'')+'><p class="ft-eyebrow">'+html(step.unlockAction?({introduce:'NEW BUILDING BLOCK',recall:'COVER & RECALL',build:'BUILD A SENTENCE',reverse:'FRENCH → ENGLISH',write:'INDEPENDENT WRITING'}[step.unlockAction]||style):style+phase)+'</p>'+
      '<h3>'+html(step.prompt)+'</h3>';
    const showFrench=step.kind==='model'?Boolean(step.modelInitiallyShown||state.revealed):state.done||state.revealed;
    if(step.kind==='model'){
      if(unit.incremental&&!step.adaptivePlan){
        const reverse=step.unlockAction==='reverse';
        body+=reverse?'<div class="ft-guided-pair"><div class="ft-pair-french"><p lang="fr" class="ft-guided-french">'+spokenWords(step.fr)+'</p><button type="button" data-gact="speak">▶</button></div>'+
          (showFrench?'<p class="ft-guided-english">'+html(step.en)+'</p>':'<p class="ft-pair-placeholder">Work out the English meaning first.</p>')+'</div>':pair(step.en,showFrench?step.fr:'',!showFrench);
        if(showFrench){
          if(step.pronunciation)body+='<p class="ft-unlock-pron" aria-label="Pronunciation">'+html(step.pronunciation)+' · tap the French to listen</p>';
          if(step.note)body+='<details class="ft-unlock-note"><summary>Notice the pattern</summary><p>'+html(step.note)+'</p></details>';
          if(step.components?.length>1)body+='<div class="ft-unlock-components" aria-label="How the sentence is built">'+step.components.map(c=>'<span><small>'+html(c.en)+'</small><strong lang="fr">'+spokenWords(c.fr)+'</strong></span>').join('')+'</div>';
        }
        body+='<div class="ft-actions">'+(!showFrench?advanceButton('reveal',reverse?'Reveal English':'Reveal French'):
          advanceButton('finish-model',step.unlockAction==='introduce'?'I have said it → Next':'Got it → Next')+
          (step.unlockAction!=='introduce'&&step.stage!=='repair'?'<button type="button" data-gact="oral-retry"'+busy+'>Needed help · revisit later</button>':''))+'</div>';
      }else body+=pair(step.en,showFrench?step.fr:'',!showFrench)+
        '<div class="ft-actions">'+
        (!showFrench?'<button type="button" data-gact="reveal" data-ft-advance>Reveal French</button>':'')+
        advanceButton('finish-model','I have repeated it → Next',showFrench)+'</div>';
    }else{
      body+='<p class="ft-guided-english">'+
        (step.kind==='listen'||step.kind==='transcribe'
          ?'Listen to the French phrase. '+(step.kind==='listen'?'Choose the meaning.':'Write the French you heard.')
          :html(step.en))+'</p>';
      if(step.audioContext)body+='<p class="ft-small">'+html(step.audioContext)+'</p>';
      if(step.kind==='listen'||step.kind==='transcribe')
        body+='<button type="button" class="ft-primary" data-gact="speak">▶ Play French phrase</button>';
      if(isChoice(step)){
        const options=choiceOrder(step);
        body+='<div class="ft-guided-options">'+options.map((option,i)=>
          {
            const right=state.done&&option===(step.kind==='choice'?step.fr:step.en);
            const wrong=state.wrongChoices.has(option)&&!right;
            const result=right?'correct':wrong?'incorrect':'';
            return '<button type="button" data-gchoice="'+i+'"'+(step.kind==='choice'?' lang="fr"':' lang="en"')+
              ' class="'+result+'" aria-label="'+html(option+(right?' — correct':wrong?' — incorrect':''))+'">'+
              '<span>'+(state.done&&step.kind==='choice'?spokenWords(option,{choice:true}):html(option))+'</span>'+
              (right&&step.kind==='listen'?'<span class="ft-choice-translation" lang="fr">'+spokenWords(step.fr,{choice:true})+'</span>':'')+
              (state.done?'<span class="ft-choice-end"><span data-choice-replay class="ft-choice-replay" title="Hear whole answer" aria-hidden="true">▶</span>'+
                (result?'<span class="ft-choice-mark" aria-hidden="true">'+(right?'✓':'×')+'</span>':'')+'</span>':
                result?'<span class="ft-choice-mark" aria-hidden="true">'+(right?'✓':'×')+'</span>':'')+'</button>';
          }).join('')+'</div>';
      }else if(!state.done&&!state.revealed){
        body+='<form id="ft-guided-form"><label for="ft-guided-input">Your French</label>'+
          '<input id="ft-guided-input" name="answer" lang="fr" type="text" '+EXACT_ANSWER_ATTRIBUTES+' value="'+html(state.answer)+'" required>'+
          '<div class="ft-actions"><button type="submit" class="ft-primary">Check answer</button>'+
          (state.hint<2?'<button type="button" data-gact="hint">'+(state.hint?'Show first part':'Get a hint')+'</button>':'')+
          '<button type="button" data-gact="reveal">Show answer</button></div></form>';
      }
      if(!isChoice(step)&&showFrench)body+=answerComparison({answer:state.answer,expected:step.fr,result:state.result,
        replay:'<button type="button" data-gact="speak" aria-label="Hear the correct French again">▶</button>'});
      if(state.hint&&!state.done&&!state.revealed)body+='<p class="ft-guided-hint" role="status">'+
        html(guidedHint(step,1))+(state.hint>=2?'<br><strong>'+html(guidedHint(step,2))+'</strong>':'')+'</p>';
      if(state.revealed&&!state.done)
        body+=advanceButton('finish-revealed',state.result==='incorrect'?'Next phrase →':'I reviewed the model → Next');
      if(state.done)
        body+=advanceButton('next','Next phrase →');
    }
    // An active CUDDLES/phonics cue appears alongside repeated phrases,
    // not as a detached once-only alphabet lesson. Do not expose this
    // spelling cue before independent or delayed assessment.
    const focus=unit.soundFocus;
    const teachSound=focus&&((step.stage==='recap'||step.stage==='present')&&
      (step.id.endsWith(':0')||step.id.endsWith(':3')));
    if(teachSound)body+='<aside class="ft-guided-sound"><strong>Sound &amp; spelling to notice: '+html(focus.spelling)+'</strong>'+
      '<p>'+html(focus.note)+'</p><button type="button" data-gact="focus-word">▶ Hear '+html(focus.word)+'</button></aside>';
    if(showFrench)body+='<p class="ft-small ft-word-hint">Tap a French word to hear it. Hold it or choose Explore to learn more.</p>';
    if(state.feedback)body+='<p class="'+(isChoice(step)?'ft-sr-only':'ft-guided-feedback '+(state.result||''))+'" role="status">'+html(state.feedback)+'</p>';
    body+='<div class="ft-pause-row"><button type="button" data-gact="pause" class="ft-pause-control">Pause</button></div></div>';
    body+='</section>';
    return head+body;
  };
  const reference=()=>{
    const verbs=Object.keys(MAGIC10_VERBS);
    if(!verbs.includes(state.selectedVerb))state.selectedVerb=verbs[0];
    const rows=magicTenFor(state.selectedVerb);
    const notes=magicTenUnitHints();
    return '<section class="ft-card"><p class="ft-eyebrow">MAGIC 10 · ORIGINAL REUSABLE STRUCTURES</p>'+
      '<h2>Ten ways to make useful French</h2>'+
      '<p>Learn the phrases first. Repeat, change the action and use them in sentences. Grammar is optional.</p>'+
      '<label>Choose an action<select data-gverb>'+verbs.map(v=>'<option value="'+html(v)+'"'+(state.selectedVerb===v?' selected':'')+'>'+
        html(v)+'</option>').join('')+'</select></label>'+
      '<div class="ft-magic-rows">'+rows.map((row,i)=>
        '<div class="ft-magic-row"><small>'+String(i+1)+'. '+html(row.kind)+'</small>'+
        '<strong lang="fr">'+spokenWords(row.fr)+'</strong><span>'+html(row.en)+'</span>'+
        '<button type="button" data-gspeak="'+i+'" aria-label="Hear '+html(row.fr)+'">▶</button></div>').join('')+'</div>'+
      '<details class="ft-guided-grammar"><summary>Curious? Explore the grammar behind these patterns</summary>'+
      '<p>These are useful frames, not ten grammatical tenses. Some are opinions or modals.</p>'+
      '<ul>'+notes.map(n=>'<li><strong>'+html(n.id)+'</strong>: '+html(n.note)+'</li>').join('')+'</ul>'+
      '<p>The listed eight verbs are individually curated. For other verbs, use Word Explorer rather than guessing the forms.</p></details>'+
      '<div class="ft-actions"><button type="button" data-gact="start" class="ft-primary">Practise with a guided lesson</button></div></section>';
  };
  const dashboard=()=>{
    const statuses=unitsForTrack(getTrack()).map(u=>guidedStatus(u.id,evidence()));
    const preferred=recommendedGuidedUnit(evidence(),Date.now(),getTrack());
    return '<section class="ft-card ft-todays-lesson"><p class="ft-eyebrow">TODAY’S GUIDED FRENCH</p>'+
      '<h2>'+html(preferred.mode==='review'?'Remember what you learned':'Build French one phrase at a time')+'</h2>'+
      '<p>'+html(preferred.unit.name)+' · '+html(preferred.unit.goal)+'</p>'+
      '<div class="ft-actions"><button data-gact="start" class="ft-primary">'+
      (preferred.mode==='review'?'Start your review':preferred.mode==='new'?'Start guided lesson':'Continue guided lesson')+
      '</button><button data-page="magic">Explore Magic 10</button></div>'+
      '<p class="ft-small">Practise small useful structures repeatedly, cover the prompts, and revisit them after 1, 3, 7 and 28 days.</p>'+
      '<div class="ft-guided-unit-summary">'+statuses.map(s=>
        '<div><strong>'+html(s.unit.label)+'</strong><span>'+html(s.unit.name)+'</span><button type="button" data-eact="unit:'+html(s.unit.id)+'">'+(s.unit.incremental?'Open chapter':'Open lesson')+'</button>'+
        '<small>'+html(s.mode==='complete'?'Teaching complete':s.mode==='review'?'Review due':
          s.mode==='new'?'Ready to start':'In progress')+'</small>'+
        (s.mode==='new'?'':'<small>'+s.teaching.coreCompleted+'/'+s.teaching.coreTotal+' core · '+s.teaching.repairCompleted+'/'+s.teaching.repairTotal+' corrections</small>')+'</div>').join('')+'</div></section>';
  };
  const logGuided=(step,answer,correct,{reveal=false,model=false}={})=>{
    const expected=step.kind==='listen'||step.unlockAction==='reverse'?step.en:step.fr;
    const support=reveal||model?'worked-example':state.hint||state.wrong||step.stage==='guided'||step.stage==='repair'?'small-prompt':'none';
    const info={ref:model?step.id+':complete':step.id+':first',activity:ALL_UNITS.find(u=>u.id===step.unitId)?.name+' · '+step.stage,
      context:{...signalContext(step),unitId:step.unitId,stage:step.stage,kind:step.kind,structure:step.structure||'',fr:step.fr,en:step.en},
      question:step.unlockAction==='reverse'?step.fr:step.kind==='listen'?'Listen: '+step.fr:step.kind==='transcribe'?'Dictation: '+step.fr:step.en,support,targetLang:step.kind==='listen'||step.unlockAction==='reverse'?'en':isChoice(step)?'choice':'fr'};
    if(step.adaptivePlan)info.signal=adaptiveOutcome(step.adaptivePlan,{correct,reveal,model,support,answer});
    if(reveal||model)return recordAttempt({...info,answer,expected,result:model?'model':'revealed',reason:model?'Oral repetition, not automatically marked.':'Model revealed; not an independent success.',marker:'unscored'});
    const custom=step.track&&step.track!=='michaela'&&!isChoice(step);
    const audit=exactAudit(answer,expected,correct,{...info,marker:isChoice(step)?'choice-v1':custom?'curriculum-v1':'guided-exact-v1',normalize:isChoice(step)?x=>String(x??''):custom?curriculumNormalize:normaliseAnswer});
    if(custom)audit.accepted=step.kind==='transcribe'?[curriculumNormalize(expected)]:curriculumVariants(expected,step.en);
    return recordAttempt(audit);
  };
  const choose=(option)=>{
    const {current}=context();
    if(!current||!isChoice(current))return;
    const choices=choiceOrder(current),i=Number(option);
    if(!Number.isInteger(i)||i<0||i>=choices.length)return;
    const value=choices[i];
    const correct=value===(current.kind==='choice'?current.fr:current.en);
    if(state.done){
      // Replay without creating another attempt, changing the selected
      // correct response, or advancing the evidence-backed lesson.
      if(current.kind==='choice')speak(value);
      else if(correct)speak(current.fr);else speak(value,'en-GB');
      return;
    }
    if(!logGuided(current,value,correct))return;
    firstAttempt(current,correct);
    state.answer=value;
    if(correct){
      completion(current,state.wrong?'small-prompt':current.support||'small-prompt');
      state.feedback='Correct.';
    }else{
      state.wrong=true;state.wrongChoices.add(value);
      state.feedback=current.kind==='listen'?
        'Not quite. Replay the French and listen for the meaning, then try again.':
        'Not quite. Say each part in French again, then choose another answer.';
    }
    announce();
    if(current.kind==='choice')playAudio('choice',value);
    else if(correct)playAudio('correction',current.fr);else playAudio('choice',value,'en-GB');
    if(correct)focusTarget('[data-gact="next"]');else focusTarget('[data-gchoice="'+i+'"]');
  };
  const write=(value)=>{
    const {current}=context();
    if(!current||state.done||!['write','transcribe'].includes(current.kind)||state.revealed)return;
    const answer=String(value??'');
    if(!answer.trim())return;
    const correct=current.track==='michaela'?markAnswer(answer,current.fr):current.kind==='transcribe'?curriculumNormalize(answer)===curriculumNormalize(current.fr):curriculumVariants(current.fr,current.en).includes(curriculumNormalize(answer));
    if(!logGuided(current,answer,correct))return;
    firstAttempt(current,correct);
    state.answer=answer;state.result=correct?'correct':'incorrect';
    if(correct){
      completion(current,state.hint||state.wrong?'small-prompt':current.support==='none'?'none':'small-prompt');
      state.feedback='Correct.';
    }else{
      state.wrong=true;
      // Record the unaided failure before showing the model. Completion is
      // assisted; the existing repair queue revisits missed main-deck items.
      state.feedback=answerFeedback(answer,current.fr);
      state.revealed=true;
    }
    announce();
    playAudio('correction',current.fr);
    focusTarget(correct?'[data-gact="next"]':'[data-gact="finish-revealed"]');
  };
  const click=(target)=>{
    if(state.advancing&&(target.dataset.gchoice!==undefined||target.dataset.gact||target.dataset.gspeak!==undefined||target.dataset.gword!==undefined))return true;
    if(target.dataset.gword!==undefined){speak(target.dataset.gword);return true;}
    if(target.dataset.gchoice!==undefined){choose(target.dataset.gchoice);return true;}
    if(target.dataset.gspeak!==undefined){
      const row=magicTenFor(state.selectedVerb)[Number(target.dataset.gspeak)];
      if(row)speak(row.fr);
      return true;
    }
    const act=target.dataset.gact;
    if(!act)return false;
    const {current}=context();
    switch(act){
      case 'start':{const id=recommendedGuidedUnit(evidence(),Date.now(),getTrack()).unit.id;if(getTrack()!=='michaela'&&requestStart)requestStart(id);else start(id);break;}
      case 'next-unit':if(!activeRest(evidence(),Date.now(),null)){if(requestStart&&target.dataset.restUnit)requestStart(target.dataset.restUnit);else start(recommendedGuidedUnit(evidence(),Date.now(),getTrack()).unit.id);}break;
      case 'pause':cancelAdvance();resetStep();go('home');break;
      case 'speak':if(current)speak(current.fr);break;
      case 'focus-word':{
        const item=ALL_UNITS.find(x=>x.id===context().id)?.soundFocus;
        if(item)speak(item.word);
        break;
      }
      case 'hint':
        if(current&&!state.done&&!state.revealed&&state.hint<2){
          const input=target.closest?.('form')?.querySelector('input[name="answer"]');
          if(input)state.answer=input.value;
          const selection=input?[input.selectionStart,input.selectionEnd]:null;
          state.hint++;
          if(current.adaptivePlan){
            const p=current.adaptivePlan;
            if(!recordSignal(p.target,'hint',p.fr,{english:p.mode==='dictation'?'':p.en,targetKind:p.targetKind,structure:p.structure,planId:p.id,hintLevel:state.hint,context:signalContext(current)})){state.hint--;break;}
          }else{
            if(!has(evidence(),hintRef(current)))record({concept:current.concept,phase:'practice',support:'small-prompt',sourceRef:hintRef(current),taughtAt:context().status.taughtAt||new Date().toISOString()});
            const t=phraseTarget(current.fr,current.en,current.structure);
            recordSignal(t.word,'hint',t.sentence,{...t,hintLevel:state.hint,context:signalContext(current)});
          }
          announce();
          const replacement=target.ownerDocument?.getElementById('ft-guided-input');
          if(input&&replacement){replacement.focus({preventScroll:true});if(selection)replacement.setSelectionRange(...selection);}
        }break;
      case 'reveal':
        if(current&&!state.done){
          if(current.kind!=='model'){
            const draft=target.closest?.('form')?.querySelector('input[name="answer"]');
            if(draft)state.answer=draft.value;
            if(!logGuided(current,state.answer,false,{reveal:true}))break;
            firstAttempt(current,false,'worked-example');state.result='revealed';
          }
          state.revealed=true;state.feedback='';
          announce();playAudio('reveal',current.kind==='model'?teacherModelAudio(current):current.fr);
          focusTarget(current.kind==='model'?'[data-gact="finish-model"]':'[data-gact="finish-revealed"]');
        }break;
      case 'oral-retry':
      case 'finish-model':
        if(current?.kind==='model'&&!state.done){
          if(current.unlockAction&&!current.modelInitiallyShown&&!state.revealed)break;
          if(!logGuided(current,null,false,{model:true}))break;
          if(act==='oral-retry'&&!current.adaptivePlan){
            if(!has(evidence(),current.id+':oral-retry'))record({concept:current.concept,phase:'practice',support:'worked-example',sourceRef:current.id+':oral-retry'});
            const t=phraseTarget(current.fr,current.en,current.structure);
            recordSignal(t.word,'reveal',t.sentence,{...t,context:signalContext(current)});
          }
          state.revealed=true;completion(current,'worked-example');void advance(current.fr);
        }
        break;
      case 'finish-revealed':
        if(current&&state.revealed&&!state.done){completion(current,'worked-example');void advance(current.fr);}
        break;
      case 'next':
        if(state.done)void advance();
        break;
      default:return false;
    }
    return true;
  };
  const change=(target)=>{
    if(target.dataset.gverb!==undefined){
      if(Object.hasOwn(MAGIC10_VERBS,target.value)){state.selectedVerb=target.value;announce();}
      return true;
    }
    if(target.dataset.gunit!==undefined){
      if(unitsForTrack(getTrack()).some(u=>u.id===target.value)){if(getTrack()!=='michaela'&&requestStart)requestStart(target.value);else start(target.value);}
      return true;
    }
    return false;
  };
  const submit=(form,event)=>{
    if(form.id!=='ft-guided-form')return false;
    event.preventDefault();
    const field=form.querySelector('input[name="answer"]');
    if(field)write(field.value);
    return true;
  };
  return {dashboard,page,reference,start,reset,leave:cancelAdvance,click,change,submit,current:()=>state.step,finishing:()=>state.done||state.advancing};
}
