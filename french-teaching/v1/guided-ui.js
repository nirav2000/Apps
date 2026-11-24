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
export function createGuidedInterface({getEntries,record,speak,refresh,navigate}){
  if(typeof getEntries!=='function'||typeof record!=='function'||typeof speak!=='function'||typeof refresh!=='function')
    throw Error('Guided lessons require evidence and speech adapters');
  const state={
    unitId:null,step:null,answer:'',feedback:'',wrong:false,done:false,
    hint:false,revealed:false,wrongChoices:new Set(),selectedVerb:'parler',error:null
  };
  const evidence=()=>getEntries()||[];
  const resetStep=()=>{
    state.step=null;state.answer='';state.feedback='';state.wrong=false;
    state.done=false;state.hint=false;state.revealed=false;state.wrongChoices.clear();state.error=null;
  };
  const announce=()=>refresh();
  const go=page=>typeof navigate==='function'?navigate(page):announce();
  const start=(unitId)=>{
    const id=unitId||recommendedGuidedUnit(evidence()).unit.id;
    guidedLesson(id); // validate before writing any record
    resetStep();
    state.unitId=id;
    if(!has(evidence(),guidedTeachingRef(id))){
      const now=new Date().toISOString();
      record({concept:'french:guided:'+id,phase:'practice',support:'worked-example',
        taughtAt:now,sourceRef:guidedTeachingRef(id),at:now});
    }
    go('lesson');
    const audio=guidedEntryAudio(context().current);if(audio)speak(audio);
  };
  const reset=()=>{state.unitId=null;resetStep();state.selectedVerb='parler';};
  const context=()=>{
    const id=state.unitId||recommendedGuidedUnit(evidence()).unit.id;
    const status=guidedStatus(id,evidence());
    const current=state.step||status.next;
    if(current&&!state.step)state.step=current;
    return {id,status,current};
  };
  // Render without auto-speaking on incidental Firebase or UI refreshes.
  // A navigation gesture can reinforce the old model and introduce the next
  // in a single utterance, avoiding SpeechSynthesis.cancel cutting it off.
  const advance=(reinforce='')=>{
    resetStep();announce();
    const next=context().current;
    // Never preview the next hidden answer (including via a repeated model).
    const safeRepeat=next&&next.fr===reinforce&&!guidedEntryAudio(next)?'':reinforce;
    const intro=guidedEntryAudio(next);
    const audio=[safeRepeat,intro].filter(Boolean).join('. ');
    if(audio)speak(audio);
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
    const assisted=state.hint||state.revealed||state.wrong;
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
    let body='<div class="ft-guided-task"><p class="ft-eyebrow">'+html(style+phase)+'</p>'+
      '<h3>'+html(step.prompt)+'</h3>';
    const showFrench=step.kind==='model'?Boolean(step.modelInitiallyShown||state.revealed):state.done||state.revealed;
    if(step.kind==='model'){
      body+='<p class="ft-guided-english">'+html(step.en)+'</p>'+
        (showFrench?'<p class="ft-guided-french" lang="fr">'+html(step.fr)+'</p>':
          '<div class="ft-guided-covered">Try saying it in French first, then reveal the model.</div>')+
        '<div class="ft-actions"><button type="button" data-gact="speak">▶ Hear French</button>'+
        (!showFrench?'<button type="button" data-gact="reveal">Reveal French</button>':'')+
        '<button type="button" data-gact="finish-model" class="ft-primary">I have repeated it → Next</button></div>';
    }else{
      body+='<p class="ft-guided-english">'+
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
              '<span>'+html(option)+'</span>'+(result?'<span class="ft-choice-mark" aria-hidden="true">'+(right?'✓':'×')+'</span>':'')+'</button>';
          }).join('')+'</div>';
      }else if(!state.done&&!state.revealed){
        body+='<form id="ft-guided-form"><label for="ft-guided-input">Your French</label>'+
          '<input id="ft-guided-input" name="answer" lang="fr" type="text" spellcheck="false" autocapitalize="off" autocomplete="off" value="'+html(state.answer)+'" required>'+
          '<div class="ft-actions"><button type="submit" class="ft-primary">Check answer</button>'+
          (step.stage==='independent'||step.stage==='transfer'||step.stage==='review'?
            '<button type="button" data-gact="hint">Small hint</button>':
            '<button type="button" data-gact="hint">Show a starter</button>')+
          '<button type="button" data-gact="reveal">Show model</button></div></form>';
      }
      if(state.hint&&!state.done)body+='<p class="ft-guided-hint">Hint: '+
        html(step.cue||'Remember: '+step.structure+'. Say each chunk before you write it.')+'</p>';
      if(showFrench&&step.kind!=='choice')body+='<div class="ft-guided-model"><p class="ft-eyebrow">French model</p>'+
        '<p lang="fr">'+html(step.fr)+'</p><button type="button" data-gact="speak">▶ Hear the model</button></div>';
      if(state.revealed&&!state.done)
        body+='<button type="button" data-gact="finish-revealed" class="ft-primary">I reviewed the model → Next</button>';
      if(state.done)
        body+='<button type="button" data-gact="next" class="ft-primary">Next phrase →</button>';
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
      else speak(value,'en-GB');
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
      case 'hint':if(current&&!state.done){state.hint=true;announce();}break;
      case 'reveal':
        if(current&&!state.done){
          if(current.kind!=='model')firstAttempt(current,false,'worked-example');
          state.revealed=true;state.feedback=current.kind==='model'?'':'Model shown. This is guided review, not an independent success.';
          announce();speak(current.kind==='model'?teacherModelAudio(current):current.fr);
        }break;
      case 'finish-model':
        if(current?.kind==='model'&&!state.done){completion(current,'worked-example');advance(current.fr);}
        break;
      case 'finish-revealed':
        if(current&&state.revealed&&!state.done){completion(current,'worked-example');advance(current.fr);}
        break;
      case 'next':
        if(state.done)advance();
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
  return {dashboard,page,reference,start,reset,click,change,submit};
}
