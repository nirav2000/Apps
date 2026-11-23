import {ALPHABET,CUDDLES,PASSAGE,PATTERNS,DRILLS,SENTENCE_WORKSHOP,assembleWorkshop,markAnswer} from './data.js';
import {createEvidenceStore} from '../../learning-evidence/v1/index.js';
import {createFirestoreEvidenceCloud} from '../../learning-evidence/v1/firestore-cloud.js';

const APP_ID='next-french';
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const stamp=()=>new Date().toISOString();
const id=()=>globalThis.crypto?.randomUUID?.()||'a-'+Date.now()+'-'+Math.random().toString(36).slice(2);
const fmt=x=>x==null?'Not measured':x+'%';
const day=86400000;
const cleanDate=d=>new Date(Math.floor(d/day)*day).toISOString();
const simplify=(s)=>String(s||'').normalize('NFC').replace(/\s+/g,' ').trim();
const select=(a)=>a[Math.floor(Math.random()*a.length)];
const shuffle=a=>a.slice().sort(()=>Math.random()-.5);
export function reviewPlan(entries,now=Date.now()){
  const taught=entries.find(e=>e.source?.ref==='intro-connectives'&&e.score.total===0);
  if(!taught)return {taughtAt:null,next:null,days:0};
  const base=taught.taughtAt||taught.at;
  const elapsed=(now-base)/day;
  const checks=[1,3,7,28];
  const reviews=entries.filter(e=>e.phase==='retrieval'&&e.score.total>0&&e.at>=base);
  let next=null;
  for(let i=0;i<checks.length;i++){
    const upper=checks[i+1]||Infinity;
    if(!reviews.some(e=>e.at>=base+checks[i]*day&&e.at<base+upper*day)){
      next=base+checks[i]*day;break;
    }
  }
  return {taughtAt:base,next,days:elapsed};
}
export function mountFrenchCourse({target,connect,signIn,signOut}){
  if(!target||typeof connect!=='function')throw Error('French course target and Firebase adapter required');
  const state={page:'home',profile:'adult',context:null,store:null,cloud:null,cloudStatus:'Checking Firebase…',
    cloudAt:null,loading:true,lessonIndex:0,hideEnglish:false,question:0,queue:DRILLS.slice(),
    alphabetQuiz:[],alphabetQuestion:0,attempted:false,failed:false,hint:'none',feedback:'',
    completed:false,pronunciationIndex:0,coach:null,lastInput:'',busy:false,builder:{mode:0,left:0,right:0,showFrench:true}};
  try{const p=localStorage.getItem('next-french:profile');if(p==='adult'||p==='sai')state.profile=p;}catch{}
  const el=()=>target;
  let syncTimer=0,destroyed=false,syncTask=null,pendingAgain=false;
  function record(raw){
    if(!state.store)throw Error('Sign in to record progress');
    const row=state.store.record({...raw,id:id(),source:{kind:'french-course',ref:raw.sourceRef||'session'}});
    queueSync();
    return row;
  }
  function teach(kind){
    if(!state.store)return;
    const ref=kind==='alphabet'?'intro-alphabet':'intro-connectives';
    if(state.store.getEntries().some(x=>x.source?.ref===ref&&x.score.total===0))return;
    const at=stamp();
    record({concept:kind==='alphabet'?'french:alphabet:letters':'french:course:connectives',
      phase:'practice',support:'none',taughtAt:at,sourceRef:ref,at});
  }
  function taughtAt(kind){
    const ref=kind==='alphabet'?'intro-alphabet':'intro-connectives';
    const entry=state.store?.getEntries().find(x=>x.source?.ref===ref&&x.score.total===0);
    return entry?.taughtAt||entry?.at||null;
  }
  function phaseFor(kind){const first=taughtAt(kind);return first&&Date.now()-Date.parse(first)>=day?'retrieval':'practice';}
  function queueSync(){
    if(!state.cloud)return;
    state.cloudStatus='Pending cloud upload';
    if(syncTask){pendingAgain=true;updateStatus();return;}
    if(syncTimer)clearTimeout(syncTimer);
    syncTimer=setTimeout(()=>syncNow(),1800);
    updateStatus();
  }
  function syncNow(){
    if(!state.cloud)return Promise.resolve();
    if(syncTimer){clearTimeout(syncTimer);syncTimer=0;}
    if(syncTask){pendingAgain=true;return syncTask;}
    const cloud=state.cloud;
    syncTask=(async()=>{
      state.busy=true;
      try{
        do{
          pendingAgain=false;
          state.cloudStatus='Syncing…';updateStatus();
          const result=await cloud.sync();
          if(destroyed||state.cloud!==cloud)return;
          state.cloudAt=result.at;
          state.cloudStatus='Saved to Firebase';
          if(state.page==='home')render();else updateStatus();
        }while(pendingAgain&&state.cloud===cloud);
      }catch(e){
        if(destroyed)return;
        state.cloudStatus='Saved locally; cloud needs attention: '+String(e.message||e);
        updateStatus();
      }finally{
        state.busy=false;
      }
    })().finally(()=>{
      syncTask=null;
      if(pendingAgain&&!destroyed&&state.cloud===cloud){pendingAgain=false;queueSync();}
    });
    return syncTask;
  }
  function updateStatus(){
    const s=el().querySelector('[data-cloud-status]');if(s)s.textContent=state.cloudStatus;
  }
  async function attach(profile){
    if(!state.context?.auth?.currentUser)return;
    const {auth,db,firestore,ownerUid}=state.context;
    if(auth.currentUser.uid!==ownerUid){state.cloudStatus='Wrong account; no evidence will be mixed';return;}
    state.profile=profile;
    state.store=createEvidenceStore({appId:APP_ID,learnerId:profile,accountId:ownerUid});
    state.cloud=createFirestoreEvidenceCloud({store:state.store,db,auth,firestore,ownerUid,learnerId:profile,appId:APP_ID});
    state.cloudStatus='Pending cloud check';
    state.cloudAt=null;
    try{localStorage.setItem('next-french:profile',profile);}catch{}
    await syncNow();
  }
  function nav(){
    const tabs=[['home','Overview'],['alphabet','Alphabet'],['knowledge','Knowledge grid'],['workshop','Sentence workshop'],['practice','Sentence practice'],['review','Review'],['pronunciation','Speak']];
    return '<nav class="ft-tabs" aria-label="French activities">'+tabs.map(([p,t])=>'<button type="button" data-page="'+p+'" class="'+(state.page===p?'active':'')+'">'+t+'</button>').join('')+'</nav>';
  }
  function top(){
    return '<div class="ft-top"><div><p class="ft-eyebrow">NEXT LEARNING · FRENCH</p><h1>French, built to be useful.</h1>'+
      '<p>Listen, notice, retrieve and reshape rich French sentences.</p></div>'+
      '<div class="ft-account"><label for="ft-profile">Learner</label><select id="ft-profile" data-profile>'+
      '<option value="adult"'+(state.profile==='adult'?' selected':'')+'>Adult</option>'+
      '<option value="sai"'+(state.profile==='sai'?' selected':'')+'>Sai</option></select>'+
      '<small data-cloud-status role="status" aria-live="polite">'+esc(state.cloudStatus)+'</small></div></div>';
  }
  function login(){
    return '<section class="ft-card ft-signin"><h2>Connect your family Firebase account</h2><p>Lessons can be previewed, but tracked practice needs your existing authorised account. Your evidence is kept separately from Sai’s original Next progress.</p>'+
      '<form id="ft-login"><label>Email<input name="email" type="email" autocomplete="username" required></label>'+
      '<label>Password<input name="password" type="password" autocomplete="current-password" required></label>'+
      '<button type="submit" class="ft-primary">Sign in & sync</button></form></section>';
  }
  function overview(){
    const summary=state.store?.summary();
    const plan=reviewPlan(state.store?.getEntries()||[]);
    const metrics=summary?[
      ['Accuracy',summary.accuracy],['Independence',summary.independence],
      ['7-day retention',summary.retention],['Unseen transfer',summary.transfer]
    ]:[];
    return '<section class="ft-hero ft-card"><p class="ft-eyebrow">Your next step</p><h2>Speak in full sentences, not isolated word lists.</h2>'+
      '<p>Start with the French alphabet, then a bilingual passage full of reusable connectives. Later, create unseen combinations without prompts.</p>'+
      '<div class="ft-actions"><button data-page="alphabet" class="ft-primary">Learn the alphabet</button>'+
      '<button data-page="knowledge">Explore the knowledge grid</button><button data-page="practice">Practise sentences</button></div></section>'+
      '<section class="ft-card"><h2>Learning evidence</h2><p class="ft-small">Accuracy, independence, delayed recall and novel transfer are separate measures. An immediate correct answer is not proof of retention.</p>'+
      '<div class="ft-metrics">'+metrics.map(([name,m])=>'<div><strong>'+fmt(m.percent)+'</strong><span>'+name+'</span><small>'+(m.total||0)+' checked'+(m.unknownSupport?' · '+m.unknownSupport+' unknown help':'')+'</small></div>').join('')+'</div>'+
      '<p class="ft-small">'+(plan.next?'Next review: '+new Date(plan.next).toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric'}):'Open the knowledge grid to start a revision cycle.')+'</p>'+
      '<div class="ft-actions"><button data-act="sync">Sync with Firebase</button><button data-act="export">Export evidence</button><button data-page="review">Review from memory</button></div></section>'+
      '<section class="ft-card"><h2>How the course works</h2><p>Real French audio → bilingual understanding → CUDDLES noticing → guided translation → controlled substitution → independent unseen sentences → review on days 1, 3 and 7.</p>'+
      '<p class="ft-small">PROFS: Past, Reasons, Opinions, Future, Subjunctive. This pilot introduces useful past, reason, opinion and future structures, plus a supported subjunctive example.</p></section>';
  }
  function alphabet(){
    const x=ALPHABET[state.lessonIndex];
    return '<section class="ft-card"><div class="ft-row"><div><p class="ft-eyebrow">LETTER NAMES · '+(state.lessonIndex+1)+'/26</p><h2>Learn the French alphabet</h2></div><button data-act="alpha-quiz" class="ft-primary">Test all 26</button></div>'+
      '<p>Listen to each <strong>letter name</strong> first. Letter names are not the same as sounds inside words. Practise spelling aloud afterwards.</p>'+
      '<div class="ft-alphabet-grid">'+ALPHABET.map((a,i)=>'<button type="button" data-letter="'+i+'" class="'+(i===state.lessonIndex?'active':'')+'">'+a.letter+'</button>').join('')+'</div>'+
      '<div class="ft-letter"><div class="ft-letter-large">'+x.letter+'</div><p>French letter name: <strong>'+esc(x.name)+'</strong></p>'+
      '<p>Example word: <strong lang="fr">'+esc(x.example)+'</strong></p>'+
      '<div class="ft-actions"><button data-act="hear-letter" class="ft-primary">▶ Hear letter name</button><button data-act="hear-example">▶ Hear example</button></div></div>'+
      '<div class="ft-actions ft-spread"><button data-act="alpha-prev"'+(state.lessonIndex===0?' disabled':'')+'>Previous</button>'+
      '<button data-act="alpha-next"'+(state.lessonIndex===25?' disabled':'')+'>Next letter</button></div>'+
      '<details><summary>Letter names, accents and word sounds</summary><p>French keeps the same 26 basic letters as English. Accents such as é, è, ê and à are marks added to letters, not additional alphabet letters. A letter’s name can differ from its sound in a word. Listen, then practise recognising and spelling.</p></details></section>';
  }
  function knowledge(){
    const rows=PASSAGE.map((l,i)=>'<div class="ft-grid-row"><div><span class="ft-number">'+(i+1)+'</span> <strong lang="fr">'+esc(l.fr)+'</strong>'+
      '<button data-say="'+i+'" aria-label="Hear French sentence '+(i+1)+'">▶</button></div>'+
      '<div class="'+(state.hideEnglish?'ft-covered':'')+'">'+(state.hideEnglish?'English hidden':esc(l.en))+'</div>'+
      '<details><summary>Literal translation · grammar · phonics</summary><p><b>Literal:</b> '+esc(l.literal)+'</p>'+
      '<p><b>Reusable:</b> '+esc(l.focus)+'</p><p><b>Notice:</b> '+esc(l.sound)+'</p></details></div>').join('');
    return '<section class="ft-card"><div class="ft-row"><div><p class="ft-eyebrow">RICH BILINGUAL KNOWLEDGE ORGANISER</p><h2>Live, learn and explain</h2></div>'+
      '<button data-act="toggle-english">'+(state.hideEnglish?'Show English':'Cover English')+'</button></div>'+
      '<p>First understand all 14 complete sentences. Speak them aloud. Find repeated connectives. Only then remove the support.</p>'+
      '<div class="ft-knowledge"><div class="ft-grid-head"><span>French · read and speak</span><span>Natural English</span></div>'+rows+'</div>'+
      '<div class="ft-actions"><button data-page="practice" class="ft-primary">Start guided practice</button></div></section>'+
      '<section class="ft-card"><h2>CUDDLES · notice the written and spoken language</h2>'+
      '<div class="ft-cuddles">'+CUDDLES.map(x=>'<div><b>'+x[0]+'</b><span><strong>'+esc(x[1])+'</strong><small>'+esc(x[2])+'</small></span></div>').join('')+'</div>'+
      '<p class="ft-small">e.g. appartement: 11 letters, pp and mm doubled; petit: final t usually silent; les‿amis: liaison. Apply annotations thoughtfully rather than assuming all final letters are silent.</p></section>';
  }
  function patterns(){
    return '<section class="ft-card"><h2>Reusable building blocks</h2><p>The same connectives work across hundreds of sentences. Change just one part, then combine two ideas.</p>'+
      '<div class="ft-patterns">'+PATTERNS.map(p=>'<div><b>'+esc(p.word)+'</b><span>'+esc(p.name)+'</span><p lang="fr">'+esc(p.frame)+'</p><small>'+esc(p.english)+'</small></div>').join('')+'</div></section>';
  }
  function workshop(){
    const b=state.builder,group=SENTENCE_WORKSHOP[b.mode],line=assembleWorkshop(b.mode,b.left,b.right);
    const options=(items,current)=>items.map((item,i)=>'<option value="'+i+'"'+(i===current?' selected':'')+'>'+esc(item.en)+'</option>').join('');
    return '<section class="ft-card"><p class="ft-eyebrow">CONTROLLED SENTENCE MANIPULATION</p><h2>Make the language your own</h2>'+
      '<p>Combine reusable, correct French clauses. These five structures offer <b>80 distinct sentences</b>. Listen, cover the French and reconstruct the sentence without looking.</p>'+
      '<div class="ft-workshop-controls"><label>Connecting idea<select data-workshop-key="mode">'+SENTENCE_WORKSHOP.map((p,i)=>'<option value="'+i+'"'+(i===b.mode?' selected':'')+'>'+esc(p.title)+'</option>').join('')+'</select></label>'+
      '<label>First part<select data-workshop-key="left">'+options(group.left,b.left)+'</select></label>'+
      '<label>Second part<select data-workshop-key="right">'+options(group.right,b.right)+'</select></label></div>'+
      '<div class="ft-build-preview"><p class="ft-eyebrow">Build from English</p><p class="ft-workshop-english">'+esc(line.en)+'</p>'+
      '<p class="ft-eyebrow">French model</p><p class="ft-workshop-french" lang="fr">'+(b.showFrench?esc(line.fr):'French covered — say it from memory')+'</p>'+
      '<div class="ft-actions"><button data-act="say-workshop">▶ Hear the French</button><button data-act="toggle-workshop">'+(b.showFrench?'Cover French':'Reveal French')+'</button>'+
      '<button data-act="try-workshop" class="ft-primary">Type from English</button></div></div>'+
      '<p class="ft-small">Workshop repetitions count as guided practice, not as genuinely unseen transfer. Separate unseen tests are part of Sentence practice.</p></section>'+patterns();
  }
  function resetQuestion(){state.attempted=false;state.failed=false;state.hint='none';state.feedback='';state.completed=false;state.lastInput='';}
  function practice(){
    if(!state.queue.length)state.queue=DRILLS.slice();
    const x=state.queue[Math.min(state.question,state.queue.length-1)];
    if(!x)return '<section class="ft-card">No questions available.</section>';
    const isFind=x.kind==='find';
    return '<section class="ft-card"><div class="ft-row"><div><p class="ft-eyebrow">'+(state.page==='review'?'RETRIEVAL CHECK':'GUIDED TRANSLATION')+' · '+(state.question+1)+'/'+state.queue.length+'</p>'+
      '<h2>'+({find:'Find the French',toFrench:'Translate into French',toEnglish:'Translate into English'}[x.kind]||'Translate')+'</h2></div>'+
      '<button data-act="restart">Restart</button></div>'+
      (x.novel?'<p class="ft-tag">New combination · transfer check</p>':'')+
      (isFind?'<blockquote lang="fr">'+esc(PASSAGE[x.line].fr)+'</blockquote>':'')+
      '<p class="ft-question">'+esc(x.prompt)+'</p>'+
      '<form id="ft-answer"><label for="ft-answer-text">Your answer</label><input id="ft-answer-text" name="answer" type="text" spellcheck="false" autocapitalize="off" autocomplete="off" value="'+esc(state.lastInput)+'" '+(state.completed?'disabled':'required')+'></input>'+
      (state.completed?'':'<div class="ft-actions"><button type="submit" class="ft-primary">Check answer</button><button type="button" data-act="hint">Give me a hint</button><button type="button" data-act="model">Show model</button><button type="button" data-act="dictate">🎤 Dictate</button></div>')+'</form>'+
      (state.hint!=='none'?'<p class="ft-hint">Hint: '+esc(x.hint)+'</p>':'')+
      (state.feedback?'<div class="ft-feedback" role="status">'+esc(state.feedback)+'</div>':'')+
      (state.completed?'<div class="ft-model"><b>Model:</b> <span lang="'+(x.kind==='toEnglish'?'en':'fr')+'">'+esc(x.answer)+'</span></div>'+
      '<div class="ft-actions"><button class="ft-primary" data-act="next-question">'+(state.question===state.queue.length-1?'See results':'Next question')+'</button></div>':'')+
      '<p class="ft-small">Exact model answers are checked for words and spelling; valid alternative wording may need a teacher to review. Speech recognition is not a pronunciation score.</p></section>'+
      (state.page==='practice'?patterns():'');
  }
  function alphaQuiz(){
    const x=state.alphabetQuiz[state.alphabetQuestion];
    return '<section class="ft-card"><p class="ft-eyebrow">ALPHABET LISTENING CHECK · '+(state.alphabetQuestion+1)+'/26</p><h2>Which letter did you hear?</h2>'+
      '<p>Listen without looking at the letter. Type the English capital letter you heard named in French.</p>'+
      '<div class="ft-actions"><button data-act="quiz-hear" class="ft-primary">▶ Play letter name</button></div>'+
      '<form id="ft-letter-answer"><label for="ft-quiz-input">Letter (A–Z)</label><input id="ft-quiz-input" name="answer" type="text" maxlength="1" autocomplete="off" autocapitalize="characters" required '+(state.completed?'disabled':'')+'>'+
      (state.completed?'':'<button class="ft-primary" type="submit">Check</button>')+'</form>'+
      (state.feedback?'<div class="ft-feedback" role="status">'+esc(state.feedback)+'</div>':'')+
      (state.completed?'<div class="ft-actions"><button class="ft-primary" data-act="next-letter-question">'+(state.alphabetQuestion===25?'Finish quiz':'Next letter')+'</button></div>':'')+
      '<p class="ft-small">The audio comes from your device’s French voice and should be checked against a proficient speaker if anything sounds unclear.</p></section>';
  }
  function pronounce(){
    return '<section class="ft-card"><p class="ft-eyebrow">OPTIONAL PRONUNCIATION COACH</p><h2>Listen and repeat aloud</h2>'+
      '<p>This reuses your existing shared Apps pronunciation lab. Its transcript, rhythm and pitch estimates are <b>provisional coaching cues</b>, not proof of phoneme accuracy.</p>'+
      '<label for="ft-target">Sentence<select id="ft-target" data-target>'+PASSAGE.map((p,i)=>'<option value="'+i+'"'+(i===state.pronunciationIndex?' selected':'')+'>'+esc(p.fr)+'</option>').join('')+'</select></label>'+
      '<div id="ft-pronounce-host"></div></section>';
  }
  function render(){
    if(destroyed)return;
    if(state.coach){const old=state.coach;state.coach=null;Promise.resolve(old.destroy()).catch(()=>{});}
    const ready=!!state.store;
    el().innerHTML=top()+(state.loading?'<section class="ft-card">Checking your Firebase session…</section>':
      (!ready?login():nav()+
      (state.page==='home'?overview():state.page==='alphabet'?alphabet():state.page==='knowledge'?knowledge():
       state.page==='workshop'?workshop():state.page==='practice'||state.page==='review'?practice():state.page==='alphabet-quiz'?alphaQuiz():pronounce())))+
      '<p class="ft-foot">Inspired by Barry Smith and published Michaela French teaching descriptions; independently created course content, not an official Michaela product. <a href="https://jlmfl.wordpress.com/2017/01/15/aides-memoire-1-cuddles/">CUDDLES source</a> · <a href="https://jlmfl.wordpress.com/2017/04/23/michaela-french-how-we-use-knowledge-organisers/">Knowledge organisers</a></p>';
    if(ready&&state.page==='pronunciation')mountPronunciation();
  }
  function speak(s){
    if(!('speechSynthesis' in window)){state.feedback='Speech playback is unavailable on this browser.';updateStatus();return;}
    window.speechSynthesis.cancel();
    const u=new SpeechSynthesisUtterance(String(s));u.lang='fr-FR';u.rate=.8;
    const fr=window.speechSynthesis.getVoices().find(v=>v.lang.toLowerCase()==='fr-fr');
    if(fr)u.voice=fr;
    window.speechSynthesis.speak(u);
  }
  async function mountPronunciation(){
    const host=el().querySelector('#ft-pronounce-host');
    if(!host||!window.AppsPronunciation){if(host)host.textContent='Pronunciation module unavailable. Written lessons continue to work.';return;}
    const provider=async ({targetText,lang})=>{
      const res=await fetch('https://apps-pronunciation-api.nirav2000-github.workers.dev/reference',
        {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({targetText,lang})});
      if(!res.ok)throw Error('Reference audio unavailable');
      return {blob:await res.blob(),label:'Generated French model'};
    };
    state.coach=window.AppsPronunciation.mount(host,{lang:'fr-FR',
      targetText:PASSAGE[state.pronunciationIndex].fr,referenceProvider:provider});
  }
  function noteAnswer(isCorrect,x,forced=false){
    const first=taughtAt('connectives')||stamp();
    let phase=state.page==='review'?phaseFor('connectives'):(x.phase==='transfer'?'transfer':'practice');
    // Transfer from a genuinely unseen prompt is recorded only on its FIRST presentation.
    if(x.novel){
      const seen=state.store.getEntries().some(e=>e.source?.ref===x.id&&e.phase==='transfer');
      if(seen)phase='practice';
    }
    const support=forced||x.guided?'worked-example':state.hint!=='none'?'small-prompt':state.failed?'small-prompt':'none';
    record({concept:x.concept,phase,novel:phase==='transfer'&&x.novel,
      correctCount:isCorrect?1:0,total:1,support,taughtAt:first,sourceRef:x.id});
  }
  function checkAnswer(input){
    const x=state.queue[state.question];if(!x||state.completed)return;
    state.lastInput=simplify(input);
    const correct=markAnswer(input,x.answer);
    noteAnswer(correct,x);
    state.attempted=true;
    if(correct){state.feedback=state.failed||state.hint!=='none'||x.guided?'Correct with support. We will check independent recall later.':'Correct independently. Well done.';state.completed=true;}
    else{state.failed=true;state.feedback='Not quite. Check word order, articles, accents and conjugations. Try again, or request a hint.';}
    render();
  }
  function finishQuestion(){
    if(state.question+1<state.queue.length){state.question++;resetQuestion();render();}
    else{state.page='home';state.question=0;resetQuestion();render();}
  }
  function quizLetter(input){
    const x=state.alphabetQuiz[state.alphabetQuestion];if(!x||state.completed)return;
    const correct=String(input).trim().toUpperCase()===x.letter;
    const first=taughtAt('alphabet')||stamp();
    record({concept:'french:alphabet:'+x.letter,phase:phaseFor('alphabet'),
      correctCount:correct?1:0,total:1,support:state.failed?'small-prompt':'none',
      taughtAt:first,sourceRef:'alphabet-'+x.letter});
    state.failed=!correct||state.failed;
    state.completed=correct;
    state.feedback=correct?'Correct: '+x.letter+' (French name: '+x.name+').':'Not yet. Replay it and try again.';
    render();
  }
  function startQuiz(){
    teach('alphabet');state.alphabetQuiz=shuffle(ALPHABET);
    state.alphabetQuestion=0;resetQuestion();state.page='alphabet-quiz';render();
  }
  function setPage(page){
    if(!state.store){render();return;}
    if(page==='alphabet'){teach('alphabet');state.page=page;}
    else if(page==='knowledge'||page==='workshop'){teach('connectives');state.page=page;}
    else if(page==='practice'){teach('connectives');state.page=page;state.queue=DRILLS.slice();state.question=0;resetQuestion();}
    else if(page==='review'){
      teach('connectives');
      const plan=reviewPlan(state.store.getEntries());
      const due=plan.next!==null&&Date.now()>=plan.next;
      // Review can also be started manually. The time threshold is recorded with each attempt.
      state.queue=DRILLS.filter(d=>!d.novel&&d.kind!=='find').slice(0,due?8:4);
      state.question=0;resetQuestion();state.page=page;
    }else state.page=page;
    render();
  }
  function dictate(){
    const SR=window.SpeechRecognition||window.webkitSpeechRecognition;
    if(!SR){state.feedback='Speech recognition is unavailable. Type your response instead.';render();return;}
    const r=new SR();r.lang=state.queue[state.question].kind==='toEnglish'?'en-GB':'fr-FR';
    r.interimResults=false;r.maxAlternatives=1;
    r.onresult=e=>{const text=e.results?.[0]?.[0]?.transcript||'';const input=el().querySelector('#ft-answer-text');if(input){input.value=text;input.focus();}};
    r.onerror=()=>{state.feedback='Microphone recognition unavailable. Type instead.';render();};
    try{r.start();}catch{state.feedback='Microphone could not start.';render();}
  }
  async function onClick(e){
    const b=e.target.closest('[data-act],[data-page],[data-letter],[data-say]');
    if(!b)return;
    if(b.dataset.page){setPage(b.dataset.page);return;}
    if(b.dataset.letter!==undefined){state.lessonIndex=Number(b.dataset.letter);render();return;}
    if(b.dataset.say!==undefined){speak(PASSAGE[Number(b.dataset.say)].fr);return;}
    switch(b.dataset.act){
      case 'sync':await syncNow();break;
      case 'export':{
        const out=state.store?.exportJSON();if(!out)return;
        const u=URL.createObjectURL(new Blob([out],{type:'application/json'}));
        const a=document.createElement('a');a.href=u;a.download='next-french-evidence-'+state.profile+'.json';a.click();
        setTimeout(()=>URL.revokeObjectURL(u),3000);break;
      }
      case 'alpha-prev':state.lessonIndex=Math.max(0,state.lessonIndex-1);render();break;
      case 'alpha-next':state.lessonIndex=Math.min(25,state.lessonIndex+1);render();break;
      case 'hear-letter':speak('la lettre '+ALPHABET[state.lessonIndex].name);break;
      case 'hear-example':speak(ALPHABET[state.lessonIndex].example);break;
      case 'alpha-quiz':startQuiz();break;
      case 'quiz-hear':speak('la lettre '+state.alphabetQuiz[state.alphabetQuestion].name);break;
      case 'next-letter-question':{
        if(state.alphabetQuestion<25){state.alphabetQuestion++;resetQuestion();render();}
        else{state.page='home';resetQuestion();render();}break;
      }
      case 'toggle-english':state.hideEnglish=!state.hideEnglish;render();break;
      case 'toggle-workshop':state.builder.showFrench=!state.builder.showFrench;render();break;
      case 'say-workshop':speak(assembleWorkshop(state.builder.mode,state.builder.left,state.builder.right).fr);break;
      case 'try-workshop':{
        const q=assembleWorkshop(state.builder.mode,state.builder.left,state.builder.right);
        state.queue=[{id:q.id,kind:'toFrench',prompt:q.en,answer:q.fr,concept:q.concept,phase:'practice',novel:false,guided:state.builder.showFrench,
          hint:'Use the connector and the two clauses from the workshop.'}];
        state.question=0;resetQuestion();state.page='practice';render();break;
      }
      case 'hint':state.hint='small-prompt';state.feedback='Use the hint to reconstruct the sentence, then try again.';render();break;
      case 'model':{
        const x=state.queue[state.question];
        noteAnswer(false,x,true);
        state.completed=true;state.feedback='Model revealed: not scored as a correct answer.';render();break;
      }
      case 'dictate':dictate();break;
      case 'next-question':finishQuestion();break;
      case 'restart':state.question=0;resetQuestion();render();break;
    }
  }
  async function onSubmit(e){
    if(e.target.id==='ft-answer'){e.preventDefault();checkAnswer(new FormData(e.target).get('answer'));return;}
    if(e.target.id==='ft-letter-answer'){e.preventDefault();quizLetter(new FormData(e.target).get('answer'));return;}
    if(e.target.id==='ft-login'){
      e.preventDefault();const data=new FormData(e.target),btn=e.target.querySelector('button');
      btn.disabled=true;state.cloudStatus='Signing in…';updateStatus();
      try{await signIn(data.get('email'),data.get('password'));state.context=await connect();await attach(state.profile);}
      catch(error){state.cloudStatus='Sign-in failed: '+String(error.message||error);}
      state.loading=false;render();
    }
  }
  async function onChange(e){
    if(e.target.matches('[data-workshop-key]')){
      const key=e.target.dataset.workshopKey,v=Number(e.target.value);
      if(!['mode','left','right'].includes(key)||!Number.isInteger(v)||v<0)return;
      state.builder[key]=v;
      if(key==='mode'){state.builder.left=0;state.builder.right=0;}
      state.builder.showFrench=true;render();return;
    }
    if(e.target.matches('[data-profile]')){
      const p=e.target.value;if(!['adult','sai'].includes(p)||p===state.profile)return;
      // All previous profile events stay in their original, uniquely scoped store.
      if(state.cloud)await syncNow();
      await attach(p);state.page='home';render();
    }
    if(e.target.matches('[data-target]')&&state.coach){
      state.pronunciationIndex=Number(e.target.value);
      state.coach.setTarget(PASSAGE[state.pronunciationIndex].fr,'fr-FR');
    }
  }
  el().addEventListener('click',onClick);
  el().addEventListener('submit',onSubmit);
  el().addEventListener('change',onChange);
  const onOnline=()=>syncNow();
  const onVisible=()=>{if(document.visibilityState==='visible')syncNow();};
  window.addEventListener('online',onOnline);
  document.addEventListener('visibilitychange',onVisible);
  (async()=>{try{state.context=await connect();if(state.context?.auth.currentUser)await attach(state.profile);
    else state.cloudStatus='Not signed in — no cloud sync';}
    catch(e){state.cloudStatus='Firebase unavailable: '+String(e.message||e);}
    finally{state.loading=false;render();}})();
  return {destroy(){
    destroyed=true;if(syncTimer)clearTimeout(syncTimer);
    window.removeEventListener('online',onOnline);
    document.removeEventListener('visibilitychange',onVisible);
    el().removeEventListener('click',onClick);el().removeEventListener('submit',onSubmit);el().removeEventListener('change',onChange);
    if(state.coach)Promise.resolve(state.coach.destroy()).catch(()=>{});
  }};
}
