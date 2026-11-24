// A guided, voice-first teaching flow built on the existing Next/French evidence.
// Repeated phrases and gradual fading are original content informed by
// Michaela teacher descriptions and general Paul Noble teaching principles.
// No publisher text, recordings or proprietary course scripts are reproduced.
import {MAGIC10_VERBS,magicTenFor,magicTenUnitHints} from './magic10.js';
import {
  GUIDED_UNITS,guidedLesson,guidedStatus,guidedTeachingRef,
  guidedCompletionRefs,recommendedGuidedUnit,guidedFirstAttemptPhase
} from './guided-lessons.js';
import {markAnswer,normaliseAnswer} from './data.js';

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
  if(want.includes('ne ')||want.includes("n'")){
    if(!got.includes(' pas'))return 'Check the negative: ne (or n’) goes before the verb, and pas after it.';
  }
  if(want.includes('je vais ')&&got.includes("j'ai "))return 'Je vais + infinitive is a future plan. J’ai + past participle is a completed action.';
  if(want.includes("j'ai ")&&got.includes('je vais '))return 'For the completed past, use j’ai + the correct past participle.';
  const strip=x=>x.normalize('NFD').replace(/[\u0300-\u036f]/g,'');
  if(strip(got)===strip(want))return 'All the words are in place. Check the French accents.';
  if(want.includes('parce que')&&!got.includes('parce que'))return 'To explain why, join the two clauses with parce que.';
  if(want.includes(' mais ')&&!got.includes(' mais '))return 'To contrast two ideas, use mais.';
  if(want.startsWith("j'")&&got.startsWith('je '))return 'Before a vowel sound, je normally contracts to j’.';
  return 'Nearly there. Check the word order and the verb form; try saying the French aloud before retrying.';
}

// Only teaching models and listening prompts may autoplay on entry.
export function guidedEntryAudio(step){
  if(!step)return '';
  if(step.kind==='listen'||step.kind==='transcribe')return step.fr;
  if(step.kind!=='model'||!step.modelInitiallyShown)return '';
  return teacherModelAudio(step);
}
export function teacherModelAudio(step){
  if(!step?.fr)return '';
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
export function createGuidedInterface({getEntries,record,speak,waitForSpeech=()=>Promise.resolve(),cancelSpeech=()=>{},refresh,navigate}){
  if(typeof getEntries!=='function'||typeof record!=='function'||typeof speak!=='function'||typeof refresh!=='function')
    throw Error('Guided lessons require evidence and speech adapters');
  const state={
    unitId:null,step:null,answer:'',feedback:'',wrong:false,done:false,
    hint:0,revealed:false,wrongChoices:new Set(),selectedVerb:'parler',error:null,advancing:false
  };
  let navigation=0;
  const evidence=()=>getEntries()||[];
  const cancelAdvance=()=>{navigation++;state.advancing=false;cancelSpeech();};
  const hintRef=step=>step.id+':hint';
  const resetStep=()=>{
    state.step=null;state.answer='';state.feedback='';state.wrong=false;
    state.done=false;state.hint=0;state.revealed=false;state.wrongChoices.clear();state.error=null;
  };
  const announce=()=>refresh();
  const go=page=>typeof navigate==='function'?navigate(page):announce();
  const start=(unitId)=>{
    const id=unitId||recommendedGuidedUnit(evidence()).unit.id;
    guidedLesson(id); // validate before writing any record
    cancelAdvance();resetStep();
    state.unitId=id;
    if(!has(evidence(),guidedTeachingRef(id))){
      const now=new Date().toISOString();
      record({concept:'french:guided:'+id,phase:'practice',support:'worked-example',
        taughtAt:now,sourceRef:guidedTeachingRef(id),at:now});
    }
    go('lesson');
    const audio=guidedEntryAudio(context().current);if(audio)speak(audio);
  };
  const reset=()=>{cancelAdvance();state.unitId=null;resetStep();state.selectedVerb='parler';};
  const context=()=>{
    const id=state.unitId||recommendedGuidedUnit(evidence()).unit.id;
    const status=guidedStatus(id,evidence());
    const current=state.step||status.next;
    if(current&&!state.step){state.step=current;if(has(evidence(),hintRef(current)))state.hint=1;}
    return {id,status,current};
  };
  // Keep the old phrase on screen until its speech ends. Explicit navigation
  // invalidates pending advances, including learner/unit changes.
  const advance=async(reinforce='')=>{
    if(state.advancing)return;
    const token=++navigation;
    state.advancing=true;announce();
    await waitForSpeech();
    if(token!==navigation)return;
    const next=guidedStatus(context().id,evidence()).next;
    const same=next&&normaliseAnswer(next.fr)===normaliseAnswer(reinforce);
    const safeRepeat=same&&!guidedEntryAudio(next)?'':reinforce;
    if(safeRepeat)await speak(safeRepeat);
    if(token!==navigation)return;
    state.advancing=false;resetStep();announce();
    const intro=guidedEntryAudio(context().current);
    if(intro)speak(intro);
  };
  const completion=(step,support)=>{
    if(!has(evidence(),marker(step).complete)){
      record({concept:step.concept,phase:'practice',support,
        taughtAt:context().status.taughtAt||new Date().toISOString(),
        sourceRef:marker(step).complete});
    }
    state.done=true;
  };
  const firstAttempt=(step,correct,extraSupport='none')=>{
    if(has(evidence(),marker(step).first))return;
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
    const {id,status,current}=context();
    if(!status.unit)return '';
    const unit=status.unit;
    const rows=guidedLesson(id).steps;
    const groups=[
      ['recap','Recall'],['present','New phrases'],['guided','Guided practice'],
      ['independent','By yourself'],['transfer','New combinations'],['repair','Repair'],
      ['review','Remember later']
    ];
    const stageLabels=Object.fromEntries(groups);
    const completed=status.completed;
    const total=status.total;
    const pct=total?Math.round(completed/total*100):0;
    const other=GUIDED_UNITS.map(u=>'<option value="'+html(u.id)+'"'+(u.id===id?' selected':'')+'>'+
      html(u.label+': '+u.name)+'</option>').join('');
    const head='<section class="ft-card ft-guided-shell"><div class="ft-guided-head">'+
      '<div><p class="ft-eyebrow">GUIDED FRENCH · SPEAK → REPEAT → REMEMBER</p>'+
      '<h2>'+html(unit.name)+'</h2><p>'+html(unit.goal)+'</p></div>'+
      '<label>Teaching unit<select data-gunit>'+other+'</select></label></div>'+
      '<div class="ft-guided-progress" role="progressbar" aria-label="Lesson progress" aria-valuenow="'+completed+
      '" aria-valuemin="0" aria-valuemax="'+total+'"><span style="width:'+pct+'%"></span></div>'+
      '<p class="ft-small"><strong>'+completed+'/'+total+'</strong> completed · stop whenever you like; your place is saved to Firebase as evidence syncs.</p>';
    if(!current&&status.mode==='complete'){
      const next=status.nextReviewAt?new Date(status.nextReviewAt).toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric'}):'none scheduled';
      return head+'<div class="ft-guided-congrats"><h3>Excellent. Now leave it for a while.</h3>'+
        '<p>You have completed the guided teaching. The next retrieval opportunity is <strong>'+html(next)+'</strong>. This is a schedule, not proof of retention.</p>'+
        '<button type="button" data-gact="next-unit" class="ft-primary">Continue with another topic</button></div>'+
        '<button type="button" data-page="home">Return to overview</button></section>';
    }
    if(!current)return head+'<p>Nothing due in this lesson. Select a different teaching unit above.</p></section>';
    const step=current,style=stageLabels[step.stage]||step.stage;
    const phase=step.stage==='review'?' · Day '+status.reviewDay:'';
    const busy=state.advancing?' disabled aria-busy="true"':'';
    const advanceButton=(act,label)=>'<button type="button" data-gact="'+act+'" class="ft-primary"'+busy+'>'+html(state.advancing?'Listening…':label)+'</button>';
    const pair=(english,french,covered=false)=>'<div class="ft-guided-pair'+(covered?' ft-pair-covered':'')+'"><p class="ft-guided-english">'+html(english)+'</p>'+
      (french?'<div class="ft-pair-french"><p lang="fr" class="ft-guided-french">'+html(french)+'</p><button type="button" data-gact="speak" aria-label="Hear the French again">▶</button></div>':
        covered?'<span class="ft-pair-placeholder">Say it from memory, then reveal.</span>':'')+'</div>';
    let body='<div class="ft-guided-task" data-guided-step="'+html(step.id)+'"><p class="ft-eyebrow">'+html(style+phase)+'</p>'+
      '<h3>'+html(step.prompt)+'</h3>';
    const showFrench=step.kind==='model'?Boolean(step.modelInitiallyShown||state.revealed):state.done||state.revealed;
    if(step.kind==='model'){
      body+=pair(step.en,showFrench?step.fr:'',!showFrench)+
        '<div class="ft-actions">'+
        (!showFrench?'<button type="button" data-gact="reveal">Reveal French</button>':'')+
        advanceButton('finish-model','I have repeated it → Next')+'</div>';
    }else{
      if(!isChoice(step)&&showFrench)body+=pair(step.en,step.fr);
      else body+='<p class="ft-guided-english">'+
        (step.kind==='listen'||step.kind==='transcribe'
          ?'Listen to the French phrase. '+(step.kind==='listen'?'Choose the meaning.':'Write the French you heard.')
          :html(step.en))+'</p>';
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
              '<span>'+html(option)+'</span>'+(right&&step.kind==='listen'?'<span class="ft-choice-translation" lang="fr">'+html(step.fr)+'</span>':'')+
              (result?'<span class="ft-choice-mark" aria-hidden="true">'+(right?'✓':'×')+'</span>':'')+'</button>';
          }).join('')+'</div>';
      }else if(!state.done&&!state.revealed){
        body+='<form id="ft-guided-form"><label for="ft-guided-input">Your French</label>'+
          '<input id="ft-guided-input" name="answer" lang="fr" type="text" spellcheck="false" autocapitalize="off" autocomplete="off" value="'+html(state.answer)+'" required>'+
          '<div class="ft-actions"><button type="submit" class="ft-primary">Check answer</button>'+
          (state.hint<2?'<button type="button" data-gact="hint">'+(state.hint?'Show first part':'Get a hint')+'</button>':'')+
          '<button type="button" data-gact="reveal">Show answer</button></div></form>';
      }
      if(state.hint&&!state.done&&!state.revealed)body+='<p class="ft-guided-hint" role="status">'+
        html(guidedHint(step,1))+(state.hint>=2?'<br><strong>'+html(guidedHint(step,2))+'</strong>':'')+'</p>';
      if(state.revealed&&!state.done)
        body+=advanceButton('finish-revealed','I reviewed the model → Next');
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
    if(state.feedback)body+='<p class="'+(isChoice(step)?'ft-sr-only':'ft-guided-feedback')+'" role="status">'+html(state.feedback)+'</p>';
    body+='</div>';
    const why=step.stage==='guided'?'These repetitions are guided practice, not independent transfer.':
      step.stage==='transfer'?'Only the first unaided attempt at a genuinely new combination is transfer evidence.':
      step.stage==='review'?'A day-seven independent answer is separately counted for retention.':
      step.kind==='model'?'Listening and repetition are unscored teaching.':'Your first attempt is saved separately from retries and hints.';
    body+='<p class="ft-small">'+html(why)+'</p></section>';
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
        '<strong lang="fr">'+html(row.fr)+'</strong><span>'+html(row.en)+'</span>'+
        '<button type="button" data-gspeak="'+i+'" aria-label="Hear '+html(row.fr)+'">▶</button></div>').join('')+'</div>'+
      '<details class="ft-guided-grammar"><summary>Curious? Explore the grammar behind these patterns</summary>'+
      '<p>These are useful frames, not ten grammatical tenses. Some are opinions or modals.</p>'+
      '<ul>'+notes.map(n=>'<li><strong>'+html(n.id)+'</strong>: '+html(n.note)+'</li>').join('')+'</ul>'+
      '<p>The listed eight verbs are individually curated. For other verbs, use Word Explorer rather than guessing the forms.</p></details>'+
      '<div class="ft-actions"><button type="button" data-gact="start" class="ft-primary">Practise with a guided lesson</button></div></section>';
  };
  const dashboard=()=>{
    const statuses=GUIDED_UNITS.map(u=>guidedStatus(u.id,evidence()));
    const preferred=recommendedGuidedUnit(evidence());
    return '<section class="ft-card ft-todays-lesson"><p class="ft-eyebrow">TODAY’S GUIDED FRENCH</p>'+
      '<h2>'+html(preferred.mode==='review'?'Remember what you learned':'Build French one phrase at a time')+'</h2>'+
      '<p>'+html(preferred.unit.name)+' · '+html(preferred.unit.goal)+'</p>'+
      '<div class="ft-actions"><button data-gact="start" class="ft-primary">'+
      (preferred.mode==='review'?'Start your review':preferred.mode==='new'?'Start guided lesson':'Continue guided lesson')+
      '</button><button data-page="magic">Explore Magic 10</button></div>'+
      '<p class="ft-small">Practise small useful structures repeatedly, cover the prompts, and revisit them after 1, 3 and 7 days.</p>'+
      '<div class="ft-guided-unit-summary">'+statuses.map(s=>
        '<div><strong>'+html(s.unit.label)+'</strong><span>'+html(s.unit.name)+'</span>'+
        '<small>'+html(s.mode==='complete'?'Teaching complete':s.mode==='review'?'Review due':
          s.mode==='new'?'Ready to start':'In progress')+'</small></div>').join('')+'</div></section>';
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
    firstAttempt(current,correct);
    state.answer=value;
    if(correct){
      completion(current,state.wrong?'small-prompt':current.support||'small-prompt');
      state.feedback=state.wrong?'Correct after retry. First attempt remains unchanged.':'Correct.';
    }else{
      state.wrong=true;state.wrongChoices.add(value);
      state.feedback=current.kind==='listen'?
        'Not quite. Replay the French and listen for the meaning, then try again.':
        'Not quite. Say each part in French again, then choose another answer.';
    }
    announce();
    if(current.kind==='choice')speak(value);
    else if(correct)speak(current.fr);else speak(value,'en-GB');
  };
  const write=(value)=>{
    const {current}=context();
    if(!current||state.done||!['write','transcribe'].includes(current.kind)||state.revealed)return;
    const answer=String(value??'').trim();
    if(!answer)return;
    const correct=markAnswer(answer,current.fr);
    firstAttempt(current,correct);
    state.answer=answer;
    if(correct){
      completion(current,state.hint||state.wrong?'small-prompt':current.support==='none'?'none':'small-prompt');
      state.feedback=state.hint||state.wrong?
        'Correct after support; first-attempt accuracy remains unchanged.':
        'Correct on your first try. This counts as independent only if no model was shown.';
    }else{
      state.wrong=true;
      state.feedback=answerFeedback(answer,current.fr);
    }
    announce();
    if(correct)speak(current.fr);
  };
  const click=(target)=>{
    if(state.advancing&&(target.dataset.gchoice!==undefined||target.dataset.gact||target.dataset.gspeak!==undefined))return true;
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
      case 'start':start(recommendedGuidedUnit(evidence()).unit.id);break;
      case 'next-unit':start(recommendedGuidedUnit(evidence()).unit.id);break;
      case 'pause':resetStep();announce();break;
      case 'speak':if(current)speak(current.fr);break;
      case 'focus-word':{
        const item=GUIDED_UNITS.find(x=>x.id===context().id)?.soundFocus;
        if(item)speak(item.word);
        break;
      }
      case 'hint':
        if(current&&!state.done&&!state.revealed&&state.hint<2){
          const input=target.closest?.('form')?.querySelector('input[name="answer"]');
          if(input)state.answer=input.value;
          const selection=input?[input.selectionStart,input.selectionEnd]:null;
          state.hint++;
          if(!has(evidence(),hintRef(current)))record({concept:current.concept,phase:'practice',support:'small-prompt',sourceRef:hintRef(current),taughtAt:context().status.taughtAt||new Date().toISOString()});
          announce();
          const replacement=target.ownerDocument?.getElementById('ft-guided-input');
          if(input&&replacement){replacement.focus({preventScroll:true});if(selection)replacement.setSelectionRange(...selection);}
        }break;
      case 'reveal':
        if(current&&!state.done){
          if(current.kind!=='model')firstAttempt(current,false,'worked-example');
          state.revealed=true;state.feedback=current.kind==='model'?'':'Model shown. This is guided review, not an independent success.';
          announce();speak(current.kind==='model'?teacherModelAudio(current):current.fr);
        }break;
      case 'finish-model':
        if(current?.kind==='model'&&!state.done){state.revealed=true;completion(current,'worked-example');void advance(current.fr);}
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
      if(GUIDED_UNITS.some(u=>u.id===target.value)){start(target.value);}
      return true;
    }
    return false;
  };
  const submit=(form,event)=>{
    if(form.id!=='ft-guided-form')return false;
    event.preventDefault();
    write(new FormData(form).get('answer'));
    return true;
  };
  return {dashboard,page,reference,start,reset,leave:cancelAdvance,click,change,submit};
}
