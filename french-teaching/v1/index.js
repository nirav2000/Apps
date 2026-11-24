import {ALPHABET,CUDDLES,PASSAGE,PATTERNS,DRILLS,SENTENCE_WORKSHOP,assembleWorkshop,markAnswer} from './data.js';
import {SOUND_FAMILIES,SOUND_QUIZ,LETTER_NAME_GROUPS,LETTER_IPA,CUDDLES_DEMOS,soundById} from './phonics.js';
import {SUBJECTS,lookupFrenchWord,tokenizeFrench} from './lexicon.js';
import {fetchDictionary,dictionaryWord,dictionaryURL,frenchWiktionaryURL} from './dictionary.js';
import {browserAuthContext} from './auth-context.js';
import {createGuidedInterface,answerComparison} from './guided-ui.js';
import {optionalVerbTimeline} from './magic10.js';
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
export function mountFrenchCourse({target,connect,signIn,signOut,signInGoogle,linkGoogle,signInPasskey,resetPassword}){
  if(!target||typeof connect!=='function')throw Error('French course target and Firebase adapter required');
  const authCapabilities=browserAuthContext(window);
  const state={page:'home',profile:'adult',context:null,store:null,cloud:null,cloudStatus:'Checking Firebase…',
    cloudAt:null,loading:true,lessonIndex:0,hideEnglish:false,question:0,queue:DRILLS.slice(),
    alphabetQuiz:[],alphabetQuestion:0,attempted:false,failed:false,hint:'none',feedback:'',
    completed:false,answerResult:null,pronunciationIndex:0,coach:null,lastInput:'',busy:false,authNotice:'',letterGrouped:false,soundGroup:'vowel-contrasts',soundQueue:[],soundQuestion:0,soundAnswered:false,soundChoice:null,soundFeedback:'',soundCorrect:0,soundLastResult:null,builder:{mode:0,left:0,right:0,showFrench:true}};
  try{const p=localStorage.getItem('next-french:profile');if(p==='adult'||p==='sai')state.profile=p;}catch{}
  const el=()=>target;
  let syncTimer=0,destroyed=false,syncTask=null,pendingAgain=false,wordDialog=null;
  function record(raw){
    if(!state.store)throw Error('Sign in to record progress');
    const row=state.store.record({...raw,id:id(),source:{kind:'french-course',ref:raw.sourceRef||'session'}});
    queueSync();
    return row;
  }
  // The new lesson engine writes only additional evidence events to the
  // established Firebase parent/learner scope. Existing lesson records stay as-is.
  const guidedUI=createGuidedInterface({
    getEntries:()=>state.store?.getEntries()||[],record,speak,waitForSpeech,cancelSpeech,refresh:render,focusTarget,
    navigate:page=>{state.page=page;render();}
  });
  function teach(kind){
    if(!state.store)return;
    const ref=kind==='alphabet'?'intro-alphabet':kind==='sounds'?'intro-sounds':'intro-connectives';
    if(state.store.getEntries().some(x=>x.source?.ref===ref&&x.score.total===0))return;
    const at=stamp();
    record({concept:kind==='alphabet'?'french:alphabet:letters':kind==='sounds'?'french:phonics:introduction':'french:course:connectives',
      phase:'practice',support:'none',taughtAt:at,sourceRef:ref,at});
  }
  function taughtAt(kind){
    const ref=kind==='alphabet'?'intro-alphabet':kind==='sounds'?'intro-sounds':'intro-connectives';
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
    state.soundLastResult=null;state.soundQueue=[];state.soundQuestion=0;
    state.store=createEvidenceStore({appId:APP_ID,learnerId:profile,accountId:ownerUid});
    guidedUI.reset();
    state.cloud=createFirestoreEvidenceCloud({store:state.store,db,auth,firestore,ownerUid,learnerId:profile,appId:APP_ID});
    state.cloudStatus='Pending cloud check';
    state.cloudAt=null;
    try{localStorage.setItem('next-french:profile',profile);}catch{}
    await syncNow();
  }
  function nav(){
    const tabs=[['home','Overview'],['lesson',"Today's lesson"],['magic','Magic 10'],['alphabet','Alphabet'],
      ['sounds','Sounds'],['knowledge','Knowledge grid'],['workshop','Sentence workshop'],
      ['practice','Sentence practice'],['review','Review'],['pronunciation','Speak']];
    return '<nav class="ft-tabs" aria-label="French activities">'+tabs.map(([p,t])=>'<button type="button" data-page="'+p+'" class="'+(state.page===p||(p==='sounds'&&state.page==='sound-quiz')?'active':'')+'">'+t+'</button>').join('')+'</nav>';
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
    const iphonePwa=authCapabilities.iosStandalone;
    const google=typeof signInGoogle==='function'&&!iphonePwa
      ?'<button type="button" class="ft-primary ft-google-signin" data-act="google-signin">Continue with Google</button>'+
        '<p class="ft-small">Your Google account must already be linked to this parent Firebase account.</p>'
      :iphonePwa?
        '<div class="ft-ios-login-note" role="note"><strong>Safe sign-in for iPhone Home Screen</strong>'+
        '<p>The Google popup can become unresponsive after iOS offers a saved passkey or password. To avoid trapping you in that screen, it is disabled in the installed app.</p>'+
        '<p>Use the App Monitor passkey below to connect securely to the same Firebase learning records, or use your existing parent Firebase email and password. Google remains available in Safari.</p>'+
        '<button type="button" data-act="copy-course-link">Copy link for Safari</button></div>'
      :'';
    return '<section class="ft-card ft-signin"><h2>Sign in to sync your French</h2>'+
      '<p>Use your existing <strong>kk-syllabus parent Firebase account</strong>. There is no new French account. Your progress remains separate from Sai’s.</p>'+
      (typeof signInPasskey==='function'
        ?'<div class="ft-passkey-entry"><button type="button" class="ft-primary" data-act="passkey-signin">Continue with App Monitor passkey</button>'+
          '<p class="ft-small">One passkey sign-in per device, then Firebase remembers the parent account. No new French password.</p></div>'
        :'')+
      google+
      '<details class="ft-password-option"'+(iphonePwa||typeof signInGoogle!=='function'?' open':'')+'>'+
      '<summary>Use existing Firebase email and password</summary>'+
      '<form id="ft-login"><label>Parent Firebase email<input name="email" type="email" autocomplete="username" required></label>'+
      '<label>Firebase password (not necessarily your Google password)<input name="password" type="password" autocomplete="current-password" required></label>'+
      '<button type="submit" class="ft-primary">Sign in &amp; sync</button></form>'+
      (typeof resetPassword==='function'
        ?'<div class="ft-reset-password"><button type="button" data-act="reset-password">Forgot Firebase password?</button>'+
         '<p role="status" aria-live="polite" data-reset-status></p></div>':'')+
      '</details>'+
      '<p class="ft-small">Already signed in? Your session is reused automatically. Your App Monitor passkey is not yet connected to these Firebase records.</p></section>';
  }
  function overview(){
    const summary=state.store?.summary();
    const plan=reviewPlan(state.store?.getEntries()||[]);
    const active=state.context?.auth?.currentUser;
    const googleLinked=active?.providerData?.some(provider=>provider.providerId==='google.com')===true;
    const metrics=summary?[
      ['Accuracy',summary.accuracy],['Independence',summary.independence],
      ['7-day retention',summary.retention],['Unseen transfer',summary.transfer]
    ]:[];
    return guidedUI.dashboard()+
      '<section class="ft-hero ft-card"><p class="ft-eyebrow">REFERENCE &amp; FREE EXPLORATION</p><h2>Explore the words behind your lessons.</h2>'+
      '<p>Use the guided lessons as your default. The alphabet, sound library, bilingual passage and sentence workshop remain available for optional exploration.</p>'+
      '<div class="ft-actions"><button data-page="alphabet">Learn the alphabet</button><button data-page="sounds">Hear French sounds</button>'+
      '<button data-page="knowledge">Explore the knowledge grid</button><button data-page="practice">Practise sentences</button></div></section>'+
      '<section class="ft-card"><h2>Learning evidence</h2><p class="ft-small">Accuracy, independence, delayed recall and novel transfer are separate measures. An immediate correct answer is not proof of retention.</p>'+
      '<div class="ft-metrics">'+metrics.map(([name,m])=>'<div><strong>'+fmt(m.percent)+'</strong><span>'+name+'</span><small>'+(m.total||0)+' checked'+(m.unknownSupport?' · '+m.unknownSupport+' unknown help':'')+'</small></div>').join('')+'</div>'+
      '<p class="ft-small">'+(plan.next?'Next review: '+new Date(plan.next).toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric'}):'Open the knowledge grid to start a revision cycle.')+'</p>'+
      '<div class="ft-actions"><button data-act="sync">Sync with Firebase</button><button data-act="export">Export evidence</button><button data-page="review">Review from memory</button></div></section>'+
      '<section class="ft-card ft-identity"><h2>Your learning account</h2><p class="ft-small">'+(active?.email?'Signed in as <strong>'+esc(active.email)+'</strong>. ':'Signed in with your existing parent account. ')+(googleLinked?'Google sign-in linked to this Firebase account.':'Linking Google lets you use the same account without entering the Firebase password on other devices.')+'</p>'+
      (state.authNotice?'<p role="status">'+esc(state.authNotice)+'</p>':'')+
      (!googleLinked&&typeof linkGoogle==='function'&&authCapabilities.allowGooglePopup
  ?'<button data-act="link-google" type="button">Link Google to this account</button>'
  :(!googleLinked&&authCapabilities.iosStandalone
    ?'<p class="ft-small">Google account linking is available when you open the course in Safari, not from the installed iPhone app.</p>':''))+'</section>'+
      '<section class="ft-card"><h2>How the course works</h2><p>Real French audio → bilingual understanding → CUDDLES noticing → guided translation → controlled substitution → independent unseen sentences → review on days 1, 3 and 7.</p>'+
      '<p class="ft-small">PROFS: Past, Reasons, Opinions, Future, Subjunctive. This pilot introduces useful past, reason, opinion and future structures, plus a supported subjunctive example.</p></section>';
  }
  function interactiveFrench(value){
    return tokenizeFrench(value).map(part=>(part.info||/^[\p{L}\p{M}]+(?:['’ -][\p{L}\p{M}]+){0,2}$/u.test(part.text))
      ?'<button type="button" class="ft-word" lang="fr" data-word="'+esc(part.text)+'" title="Explore this word" aria-label="Explore '+esc(part.text)+'">'+esc(part.text)+'</button>'
      :esc(part.text)).join('');
  }
  function alphabet(){
    const x=ALPHABET[state.lessonIndex];
    const letterButton=(a,i)=>'<button type="button" data-letter="'+i+'" aria-label="Hear '+a.letter+', '+esc(a.name)+'" aria-pressed="'+(i===state.lessonIndex?'true':'false')+'" class="'+(i===state.lessonIndex?'active':'')+'">'+a.letter+'</button>';
    const grouped=LETTER_NAME_GROUPS.map(g=>'<div class="ft-name-family"><h3>'+esc(g.title)+'</h3><p>'+esc(g.note)+'</p>'+
      '<div class="ft-family-letters">'+g.letters.map(letter=>{const i=ALPHABET.findIndex(x=>x.letter===letter);return letterButton(ALPHABET[i],i);}).join('')+'</div></div>').join('');
    return '<section class="ft-card"><div class="ft-row"><div><p class="ft-eyebrow">LETTER NAMES · '+(state.lessonIndex+1)+'/26</p><h2>Learn the French alphabet</h2></div>'+
      '<button data-act="alpha-quiz" class="ft-primary">Test all 26</button></div>'+
      '<p><b>Tap any letter to hear its French name immediately.</b> The card also shows an example word. Letter names are not necessarily their sounds within words.</p>'+
      '<div class="ft-actions"><button data-act="toggle-letter-groups" aria-pressed="'+state.letterGrouped+'">'+(state.letterGrouped?'Show A–Z order':'Group similar letter names')+'</button></div>'+
      (state.letterGrouped?'<div class="ft-name-families">'+grouped+'</div>':
      '<div class="ft-alphabet-grid">'+ALPHABET.map(letterButton).join('')+'</div>')+
      '<div class="ft-letter"><div class="ft-letter-large" aria-live="polite">'+x.letter+'</div>'+
      '<p>French letter name: <strong lang="fr">'+esc(x.name)+'</strong> <small class="ft-pronunciation-hint">'+esc(LETTER_IPA[x.letter]||'')+'</small></p>'+
      '<p>Example word: <strong lang="fr">'+esc(x.example)+'</strong></p>'+
      '<div class="ft-actions"><button data-act="hear-letter" class="ft-primary">▶ Repeat letter</button><button data-act="hear-example">▶ Hear example</button></div></div>'+
      '<div class="ft-actions ft-spread"><button data-act="alpha-prev"'+(state.lessonIndex===0?' disabled':'')+'>Previous</button>'+
      '<button data-act="alpha-next"'+(state.lessonIndex===25?' disabled':'')+'>Next letter</button></div>'+
      '<div class="ft-actions"><button data-page="sounds">Next: recognise French sounds →</button></div>'+
      '<details><summary>Names, accents and word sounds</summary><p>French uses 26 basic letters. Accents such as é, è, ê and à affect spelling and often pronunciation; they are not extra alphabet letters. Recognise letter names first, then compare the sounds of whole words.</p></details></section>';
  }
  function sounds(){
    const selected=SOUND_FAMILIES.find(x=>x.id===state.soundGroup)||SOUND_FAMILIES[0];
    return '<section class="ft-card"><div class="ft-row"><div><p class="ft-eyebrow">PHONICS FROM REAL WORDS</p><h2>Notice French sounds</h2></div>'+
      '<button type="button" data-act="start-sound-quiz" class="ft-primary">Test your ear</button></div>'+
      '<p>Start with the <strong>whole sentence</strong>, then notice how letters combine into sounds. Hear examples, compare similar sounds, and return to your knowledge grid. These are curated common patterns, not universal spelling rules.</p>'+
      '<div class="ft-sound-groups" role="group" aria-label="Sound families">'+SOUND_FAMILIES.map(g=>
        '<button type="button" data-sound-group="'+esc(g.id)+'" aria-pressed="'+(g.id===selected.id)+'" class="'+(g.id===selected.id?'active':'')+'">'+esc(g.title)+'</button>').join('')+'</div>'+
      (state.soundLastResult?'<p role="status" class="ft-feedback">Listening check: '+esc(state.soundLastResult)+'. Your answers were recorded in the phonics section of Learning Evidence.</p>':'')+
      '<p class="ft-sound-intro">'+esc(selected.intro)+'</p>'+
      '<div class="ft-sound-cards">'+selected.sounds.map((pattern)=>{
        return '<article class="ft-sound-card"><div class="ft-row"><div><h3>'+esc(pattern.spell)+'</h3><small>'+esc(pattern.ipa)+'</small></div>'+
          '<button type="button" data-sound-play="'+esc(pattern.id)+'" data-example="0" aria-label="Hear '+esc(pattern.examples[0])+'">▶ Hear</button></div>'+
          '<p>'+esc(pattern.clue)+'</p>'+
          '<div class="ft-sound-words">'+pattern.examples.map((word,i)=>
            '<button type="button" data-sound-play="'+esc(pattern.id)+'" data-example="'+i+'" aria-label="Hear '+esc(word)+'" lang="fr">'+esc(word)+' <span aria-hidden="true">▶</span></button>').join('')+'</div>'+
          '<details><summary>Hear it in a full sentence</summary><p lang="fr">'+interactiveFrench(pattern.sentence)+'</p>'+
            '<button type="button" data-sound-sentence="'+esc(pattern.id)+'">▶ Hear sentence</button></details>'+
          (pattern.compare?'<div class="ft-sound-contrast"><span>Compare</span>'+
            pattern.compare.map((w,i)=>'<button type="button" lang="fr" data-sound-compare="'+esc(pattern.id)+'" data-compare-index="'+i+'">▶ '+esc(w)+'</button>').join('')+'</div>':'')+
          '</article>';
      }).join('')+'</div>'+
      '<p class="ft-small">Audio is synthesised by your device in French. Listening choices test recognition, not your spoken accent. Some pronunciations vary by region and context.</p>'+
      '<div class="ft-actions"><button type="button" data-act="start-sound-quiz" class="ft-primary">Try a listening check</button><button type="button" data-page="knowledge">Back to whole sentences</button></div></section>';
  }
  function soundQuiz(){
    const item=state.soundQueue[state.soundQuestion];
    if(!item)return '<section class="ft-card"><h2>Listening check</h2><p>No questions available.</p><button data-page="sounds">Explore sounds</button></section>';
    return '<section class="ft-card"><p class="ft-eyebrow">LISTENING RECOGNITION · '+(state.soundQuestion+1)+'/'+state.soundQueue.length+'</p>'+
      '<h2>Which French word did you hear?</h2><p>Listen first, then choose its spelling. The answer is hidden until you decide.</p>'+
      '<div class="ft-actions"><button type="button" data-act="hear-sound-question" class="ft-primary">▶ Play the word</button></div>'+
      '<div class="ft-choices ft-phonics-choices" role="group" aria-label="Choose what you heard">'+item.options.map(option=>{
        const result=state.soundAnswered?(option===item.correct?'correct':option===state.soundChoice?'incorrect':''):'';
        return '<button type="button" data-sound-answer="'+esc(option)+'" class="'+result+'" lang="fr" aria-label="'+esc(option+(result==='correct'?' — correct':result==='incorrect'?' — incorrect':''))+'"><span>'+esc(option)+'</span>'+(result?'<span class="ft-choice-mark" aria-hidden="true">'+(result==='correct'?'✓':'×')+'</span>':'')+'</button>';
      }).join('')+'</div>'+
      (state.soundFeedback?'<div class="ft-sr-only" role="status">'+esc(state.soundFeedback)+'</div>':'')+
      (state.soundAnswered?'<div class="ft-model"><strong lang="fr">'+esc(item.correct)+'</strong> — '+esc(item.why)+'</div>'+
        '<button type="button" data-act="next-sound-question" class="ft-primary">'+(state.soundQuestion===state.soundQueue.length-1?'Finish listening check':'Next word')+'</button>':'')+
      '<p class="ft-small">Recognition results are saved as phonics evidence, not as a speech pronunciation score.</p></section>';
  }
  function startSoundQuiz(){
    teach('sounds');
    state.soundLastResult=null;
    state.soundQueue=shuffle(SOUND_QUIZ).slice(0,8).map(q=>({...q,options:shuffle(q.options)}));
    state.soundQuestion=0;state.soundCorrect=0;state.soundAnswered=false;state.soundChoice=null;state.soundFeedback='';
    state.page='sound-quiz';render();
    if(state.soundQueue[0])speak(state.soundQueue[0].target);
  }
  function answerSoundQuiz(value){
    if(state.page!=='sound-quiz'||!state.soundQueue[state.soundQuestion])return;
    const item=state.soundQueue[state.soundQuestion];
    if(!item.options.includes(value))return;
    if(state.soundAnswered){speak(value);return;}
    const correct=value===item.correct;
    if(correct)state.soundCorrect++;
    record({concept:item.concept,phase:phaseFor('sounds'),correctCount:correct?1:0,total:1,
      support:'none',taughtAt:taughtAt('sounds')||stamp(),sourceRef:'sound-'+item.id});
    state.soundAnswered=true;state.soundChoice=value;
    state.soundFeedback=correct?'Correct — you distinguished the spelling.':'Not quite. Listen again and compare the two sounds.';
    render();speak(correct?value:value+'. '+item.correct);focusTarget('[data-act="next-sound-question"]');
  }
  function knowledge(){
    const rows=PASSAGE.map((l,i)=>'<div class="ft-grid-row"><div><span class="ft-number">'+(i+1)+'</span> <strong lang="fr" class="ft-inline-french">'+interactiveFrench(l.fr)+'</strong>'+
      '<button data-say="'+i+'" aria-label="Hear French sentence '+(i+1)+'">▶</button></div>'+
      '<div class="'+(state.hideEnglish?'ft-covered':'')+'">'+(state.hideEnglish?'English hidden':esc(l.en))+'</div>'+
      '<details><summary>Literal translation · grammar · phonics</summary><p><b>Literal:</b> '+esc(l.literal)+'</p>'+
      '<p><b>Reusable:</b> '+esc(l.focus)+'</p><p><b>Notice:</b> '+esc(l.sound)+'</p></details></div>').join('');
    return '<section class="ft-card"><div class="ft-row"><div><p class="ft-eyebrow">RICH BILINGUAL KNOWLEDGE ORGANISER</p><h2>Live, learn and explain</h2></div>'+
      '<button data-act="toggle-english">'+(state.hideEnglish?'Show English':'Cover English')+'</button></div>'+
      '<p>First understand all 14 complete sentences. Speak them aloud. Find repeated connectives. Only then remove the support. Tap an underlined word to explore its grammar if curious.</p>'+
      '<div class="ft-knowledge"><div class="ft-grid-head"><span>French · read and speak</span><span>Natural English</span></div>'+rows+'</div>'+
      '<div class="ft-actions"><button data-page="practice" class="ft-primary">Start guided practice</button></div></section>'+
      '<section class="ft-card"><h2>CUDDLES · notice the written and spoken language</h2>'+
      '<div class="ft-cuddles">'+CUDDLES.map(x=>'<div><b>'+x[0]+'</b><span><strong>'+esc(x[1])+'</strong><small>'+esc(x[2])+'</small></span></div>').join('')+'</div>'+
      '<div class="ft-cuddle-examples"><h3>CUDDLES in action</h3>'+
      CUDDLES_DEMOS.map(d=>'<div class="ft-cuddle-example"><button type="button" data-cuddle-word="'+esc(d.id)+'" aria-label="Hear '+esc(d.word)+'">▶</button>'+
        '<span lang="fr" class="ft-cuddle-annotated">'+d.pieces.map(([piece,kind])=>'<span class="ft-mark-'+esc(kind)+'">'+esc(piece)+'</span>').join('')+'</span>'+
        '<small>'+esc(d.description)+'</small></div>').join('')+'</div>'+
      '<p class="ft-small">These marks are worked examples, not automatic guesses: vowel combinations, silent letters and liaison depend on the whole word and sentence.</p></section>';
  }
  function patterns(){
    return '<section class="ft-card"><h2>Reusable building blocks</h2><p>The same connectives work across hundreds of sentences. Change just one part, then combine two ideas.</p>'+
      '<div class="ft-patterns">'+PATTERNS.map(p=>'<div><b>'+esc(p.word)+'</b><span>'+esc(p.name)+'</span><p lang="fr">'+interactiveFrench(p.frame)+'</p><small>'+esc(p.english)+'</small></div>').join('')+'</div></section>';
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
      '<p class="ft-eyebrow">French model</p><p class="ft-workshop-french" lang="fr">'+(b.showFrench?interactiveFrench(line.fr):'French covered — say it from memory')+'</p>'+
      '<div class="ft-actions"><button data-act="say-workshop">▶ Hear the French</button><button data-act="toggle-workshop">'+(b.showFrench?'Cover French':'Reveal French')+'</button>'+
      '<button data-act="try-workshop" class="ft-primary">Type from English</button></div></div>'+
      '<p class="ft-small">Workshop repetitions count as guided practice, not as genuinely unseen transfer. Separate unseen tests are part of Sentence practice.</p></section>'+patterns();
  }
  function resetQuestion(){state.attempted=false;state.failed=false;state.hint='none';state.feedback='';state.completed=false;state.lastInput='';state.answerResult=null;}
  function practice(){
    if(!state.queue.length)state.queue=DRILLS.slice();
    const x=state.queue[Math.min(state.question,state.queue.length-1)];
    if(!x)return '<section class="ft-card">No questions available.</section>';
    const isFind=x.kind==='find';
    return '<section class="ft-card"><div class="ft-row"><div><p class="ft-eyebrow">'+(state.page==='review'?'RETRIEVAL CHECK':'GUIDED TRANSLATION')+' · '+(state.question+1)+'/'+state.queue.length+'</p>'+
      '<h2>'+({find:'Find the French',toFrench:'Translate into French',toEnglish:'Translate into English'}[x.kind]||'Translate')+'</h2></div>'+
      '<button data-act="restart">Restart</button></div>'+
      (x.novel?'<p class="ft-tag">New combination · transfer check</p>':'')+
      (isFind?'<blockquote lang="fr">'+interactiveFrench(PASSAGE[x.line].fr)+'</blockquote>':'')+
      '<p class="ft-question">'+esc(x.prompt)+'</p>'+
      (state.completed?answerComparison({answer:state.lastInput,expected:x.answer,result:state.answerResult,lang:x.kind==='toEnglish'?'en':'fr',
        replay:x.kind==='toEnglish'?'':'<button type="button" data-act="hear-practice-model" aria-label="Hear the correct French again">▶</button>'}):
      '<form id="ft-answer"><label for="ft-answer-text">Your answer</label><input id="ft-answer-text" name="answer" type="text" spellcheck="false" autocapitalize="off" autocomplete="off" value="'+esc(state.lastInput)+'" required>'+
      '<div class="ft-actions"><button type="submit" class="ft-primary">Check answer</button><button type="button" data-act="hint"'+(state.hint!=='none'||!x.hint?' disabled':'')+'>Give me a hint</button><button type="button" data-act="model">Show model</button><button type="button" data-act="dictate">🎤 Dictate</button></div></form>')+
      (state.hint!=='none'?'<p class="ft-hint">Hint: '+esc(x.hint)+'</p>':'')+
      (state.feedback?'<div class="ft-feedback '+(state.answerResult||'')+'" role="status">'+esc(state.feedback)+'</div>':'')+
      (state.completed?'<div class="ft-actions"><button class="ft-primary" data-act="next-question">'+(state.question===state.queue.length-1?'See results':'Next question')+'</button></div>':'')+
      '<p class="ft-small">Exact model answers are checked for words and spelling; valid alternative wording may need a teacher to review. Speech recognition is not a pronunciation score.</p></section>'+
      (state.page==='practice'?patterns():'');
  }
  function alphaQuiz(){
    const x=state.alphabetQuiz[state.alphabetQuestion];
    return '<section class="ft-card"><p class="ft-eyebrow">ALPHABET LISTENING CHECK · '+(state.alphabetQuestion+1)+'/26</p><h2>Which letter did you hear?</h2>'+
      '<p>Listen without looking at the letter. Type the English capital letter you heard named in French.</p>'+
      '<div class="ft-actions"><button data-act="quiz-hear" class="ft-primary">▶ Play letter name</button></div>'+
      '<form id="ft-letter-answer"><label for="ft-quiz-input">Letter (A–Z)</label><input id="ft-quiz-input" name="answer" class="'+(state.answerResult==='incorrect'?'ft-input-incorrect':'')+'" value="'+esc(state.lastInput)+'" type="text" maxlength="1" autocomplete="off" autocapitalize="characters" required '+(state.completed?'disabled':'')+'>'+
      (state.completed?'':'<button class="ft-primary" type="submit">Check</button>')+'</form>'+
      (state.feedback?'<div class="ft-feedback '+(state.answerResult||'')+'" role="status">'+esc(state.feedback)+'</div>':'')+
      (state.completed?'<div class="ft-actions"><button class="ft-primary" data-act="next-letter-question">'+(state.alphabetQuestion===25?'Finish quiz':'Next letter')+'</button></div>':'')+
      '<p class="ft-small">The audio comes from your device’s French voice and should be checked against a proficient speaker if anything sounds unclear.</p></section>';
  }
  function openWordInfo(surface,origin){
    const info=lookupFrenchWord(surface);
    if(wordDialog){try{wordDialog.close();}catch{}wordDialog.remove();}
    const dialog=document.createElement('dialog');
    dialog.className='ft-word-dialog';
    dialog.setAttribute('aria-label','Explore French word '+surface);
    const isVerb=info?.type==='verb',verb=info?.entry;
    const header='<div class="ft-word-dialog-top"><div><p class="ft-eyebrow">OPTIONAL LANGUAGE EXPLORER</p><h2 lang="fr">'+esc(surface)+'</h2></div>'+
      '<button type="button" data-close-word aria-label="Close word explanation">×</button></div>';
    let content='';
    if(isVerb){
      const timeline=optionalVerbTimeline(verb.lemma);
      const timelineHTML=timeline?
        '<h3>Use it now: past, present and future</h3><div class="ft-word-timeline">'+
          timeline.map(row=>'<div><small>'+esc(row.kind)+'</small><strong lang="fr">'+esc(row.fr)+
            '</strong><span>'+esc(row.en)+'</span><button type="button" data-dialog-speak="'+esc(row.fr)+'">▶</button></div>').join('')+
          '</div><p class="ft-small">These are individually reviewed examples, not an automatic tense generator.</p>':
        '<p class="ft-small">A complete past/future phrase has not been reviewed for this verb. Consult the sourced dictionary links below.</p>';
      const person=info.formKind==='present'&&info.personIndex!==null
        ?SUBJECTS[info.personIndex]+' · present tense'
        :info.formKind==='infinitive'?'Infinitive':info.formKind;
      const table=verb.forms.length?'<details><summary>Explore all present-tense endings (optional grammar)</summary>'+
        '<table class="ft-verb-table"><thead><tr><th scope="col">Subject</th><th scope="col">Verb form</th></tr></thead><tbody>'+
        verb.forms.map((form,i)=>{
          const hint=verb.endingHints?.[i];
          const suffix=hint?hint.replace(/^-/, ''):'';
          const bits=suffix&&form.endsWith(suffix)
            ?esc(form.slice(0,-suffix.length))+'<strong class="ft-ending">'+esc(suffix)+'</strong>'
            :esc(form);
          const active=info.formKind==='present'&&form===info.matched?' class="ft-current-form"':'';
          return '<tr'+active+'><th scope="row">'+esc(SUBJECTS[i])+'</th><td lang="fr">'+bits+'</td></tr>';
        }).join('')+'</tbody></table>'+
        (verb.endingHints?'<p class="ft-small">Regular -er present endings: <b>-e, -es, -e, -ons, -ez, -ent</b>. The last -ent is normally silent. Watch the stem-changing notes below.</p>':'<p class="ft-small">Irregular verbs need their own patterns: do not attach the standard -er endings.</p>')+
        '</details>':
        '<p><strong>Impersonal verb:</strong> il faut (present), il fallait (imperfect), il faudra (future), il faudrait (conditional).</p>';
      content='<p class="ft-word-form">'+esc(person||'French verb')+'</p>'+
        '<div class="ft-word-facts"><div><small>Infinitive</small><strong lang="fr">'+esc(verb.lemma)+'</strong></div>'+
        '<div><small>Meaning</small><strong>'+esc(verb.meaning)+'</strong></div>'+
        '<div><small>Pattern</small><strong>'+esc(verb.group)+'</strong></div></div>'+
        (info.explain?'<p class="ft-word-tip">'+esc(info.explain)+'</p>':'')+timelineHTML+table+
        '<h3>How to use it</h3><p>'+esc(verb.note)+'</p>'+
        '<p lang="fr" class="ft-word-example">'+esc(verb.example)+'</p>'+
        '<div class="ft-actions"><button type="button" data-dialog-speak="'+esc(verb.lemma)+'">▶ Infinitive</button>'+
        '<button type="button" data-dialog-speak="'+esc(verb.example)+'">▶ Example</button></div>';
    }else if(info){
      content='<p class="ft-word-form">'+esc(info.kind)+'</p>'+
        '<div class="ft-word-facts"><div><small>Meaning</small><strong>'+esc(info.meaning)+'</strong></div></div>'+
        '<h3>Notice</h3><p>'+esc(info.tip)+'</p>'+
        '<p lang="fr" class="ft-word-example">'+esc(info.example)+'</p>'+
        '<div class="ft-actions"><button type="button" data-dialog-speak="'+esc(info.surface)+'">▶ Word</button>'+
        '<button type="button" data-dialog-speak="'+esc(info.example)+'">▶ Example</button></div>';
    }else{
      content='<p class="ft-word-form">Additional vocabulary</p><p>This word is not yet in our teaching notes. The free dictionary can provide its meanings and pronunciation without interrupting the lesson.</p>';
    }
    let lookup=null;
    try{lookup=dictionaryWord(isVerb?verb.lemma:surface);}catch{}
    const sourceLinks=lookup?
      '<div class="ft-dictionary-links"><a href="'+esc(dictionaryURL(lookup))+'" target="_blank" rel="noopener noreferrer">English Wiktionary ↗</a>'+
      '<a href="'+esc(frenchWiktionaryURL(lookup))+'" target="_blank" rel="noopener noreferrer">French Wiktionary ↗</a></div>':'';
    const extra=lookup?
      '<details class="ft-dictionary-panel"'+(!info?' open':'')+'><summary>More from the free dictionary</summary>'+
        '<p class="ft-small">English meanings, IPA and selected forms from community-edited Wiktionary. Source: Wiktapi. No learning records are shared.</p>'+
        '<button type="button" data-fetch-dictionary="'+esc(lookup)+'">'+(info?'Load extra definitions':'Look up this word')+'</button>'+
        '<div class="ft-dictionary-result" role="status" aria-live="polite"></div>'+sourceLinks+
        '<p class="ft-small">Dictionary content © Wiktionary contributors, CC BY-SA / GFDL; see linked entry for attribution and revisions.</p></details>'
      :'<p class="ft-small">Look up individual words or short expressions rather than full sentences.</p>';
    dialog.innerHTML=header+content+extra+
      '<p class="ft-small">Exploration is optional. You do not need to memorise this table before continuing the lesson.</p>';
    wordDialog=dialog;el().append(dialog);
    const loadDictionary=async()=>{
      if(!lookup)return;
      const host=dialog.querySelector('.ft-dictionary-result');
      const button=dialog.querySelector('[data-fetch-dictionary]');
      if(!host||!button)return;
      button.disabled=true;
      host.textContent='Looking up the French word…';
      try{
        const data=await fetchDictionary(lookup);
        if(!dialog.isConnected)return;
        const sections=[];
        if(data.parts.length)sections.push('<p><strong>Word class:</strong> '+data.parts.map(esc).join(', ')+'</p>');
        if(data.ipa.length)sections.push('<p><strong>IPA:</strong> '+data.ipa.map(esc).join(' · ')+'</p>');
        if(data.senses.length)sections.push('<p><strong>English meanings:</strong></p><ul>'+
          data.senses.map(item=>'<li>'+esc(item)+'</li>').join('')+'</ul>');
        if(data.forms.length)sections.push('<details><summary>Selected word forms</summary><ul>'+
          data.forms.map(f=>'<li><span lang="fr">'+esc(f.word)+'</span>'+ (f.label?' — '+esc(f.label):'')+'</li>').join('')+'</ul></details>');
        host.innerHTML=data.found?sections.join('')||'<p>No definition was available in this edition.</p>':
          '<p>No matching French definition was found. Try either source link below.</p>';
      }catch(error){
        if(dialog.isConnected)host.textContent='Online dictionary unavailable: '+String(error?.message||error)+
          ' The Wiktionary links below still work.';
      }finally{if(dialog.isConnected)button.disabled=false;}
    };
    const close=()=>{if(dialog.open)dialog.close();else dialog.remove();};
    dialog.querySelector('[data-close-word]').addEventListener('click',close);
    dialog.addEventListener('click',event=>{
      const button=event.target.closest('[data-dialog-speak]');
      if(button){speak(button.dataset.dialogSpeak);return;}
      if(event.target.closest('[data-fetch-dictionary]')){loadDictionary();return;}
      if(event.target===dialog)close();
    });
    dialog.addEventListener('close',()=>{
      if(wordDialog===dialog)wordDialog=null;
      dialog.remove();
      if(origin?.isConnected)origin.focus();
    },{once:true});
    if(typeof dialog.showModal==='function')dialog.showModal();
    else dialog.setAttribute('open','');
    if(!info&&lookup)loadDictionary();
  }
  function pronounce(){
    return '<section class="ft-card"><p class="ft-eyebrow">OPTIONAL PRONUNCIATION COACH</p><h2>Listen and repeat aloud</h2>'+
      '<p>This reuses your existing shared Apps pronunciation lab. Its transcript, rhythm and pitch estimates are <b>provisional coaching cues</b>, not proof of phoneme accuracy.</p>'+
      '<label for="ft-target">Sentence<select id="ft-target" data-target>'+PASSAGE.map((p,i)=>'<option value="'+i+'"'+(i===state.pronunciationIndex?' selected':'')+'>'+esc(p.fr)+'</option>').join('')+'</select></label>'+
      '<div id="ft-pronounce-host"></div></section>';
  }
  function focusTarget(selector){el().querySelector(selector)?.focus();}
  function render(){
    if(destroyed)return;
    if(wordDialog){const old=wordDialog;wordDialog=null;try{old.close();}catch{}old.remove();}
    if(state.coach){const old=state.coach;state.coach=null;Promise.resolve(old.destroy()).catch(()=>{});}
    const ready=!!state.store;
    el().innerHTML=top()+(state.loading?'<section class="ft-card">Checking your Firebase session…</section>':
      (!ready?login():nav()+
      (state.page==='home'?overview():state.page==='lesson'?guidedUI.page():state.page==='magic'?guidedUI.reference():
       state.page==='alphabet'?alphabet():state.page==='sounds'?sounds():state.page==='sound-quiz'?soundQuiz():state.page==='knowledge'?knowledge():
       state.page==='workshop'?workshop():state.page==='practice'||state.page==='review'?practice():state.page==='alphabet-quiz'?alphaQuiz():pronounce())))+
      '<p class="ft-foot">Original lessons informed by Barry Smith, Jessica Lund’s published Michaela work, and general repeat-and-build principles described by Paul Noble. Not affiliated with or a reproduction of their courses. <a href="https://jlmfl.wordpress.com/2022/11/27/teaching-grammar-rote-vs-rules/">Lund on rote &amp; rules</a> · <a href="https://jlmfl.wordpress.com/2017/01/15/aides-memoire-1-cuddles/">CUDDLES</a></p>';
    if(ready&&state.page==='pronunciation')mountPronunciation();
  }
  // One active utterance and a completion promise, using actual end events.
  let speechTask=null,advanceEpoch=0,advancePending=false;
  function cancelSpeech(){
    const active=speechTask;
    if(active)active.finish(false);
    try{window.speechSynthesis?.cancel();}catch{}
  }
  async function waitForSpeech(){
    while(speechTask)await speechTask.promise;
  }
  function speak(s,lang='fr-FR'){
    cancelSpeech();
    if(!('speechSynthesis' in window)||!String(s).trim())return Promise.resolve(false);
    let resolve,timer;
    const promise=new Promise(r=>{resolve=r;});
    const task={promise,finish(ok){
      clearTimeout(timer);
      if(speechTask!==task)return;
      speechTask=null;resolve(ok);
    }};
    speechTask=task;
    try{
      const u=new SpeechSynthesisUtterance(String(s));u.lang=lang;u.rate=.8;
      const voices=window.speechSynthesis.getVoices();
      const voice=voices.find(v=>v.lang.toLowerCase()===lang.toLowerCase())||voices.find(v=>v.lang.toLowerCase().split('-')[0]===lang.toLowerCase().split('-')[0]);
      if(voice)u.voice=voice;
      task.utterance=u;
      u.onend=()=>task.finish(true);
      u.onerror=()=>task.finish(false);
      timer=setTimeout(()=>{if(speechTask===task)cancelSpeech();},Math.max(12000,Math.min(60000,String(s).length*220+5000)));
      window.speechSynthesis.speak(u);
    }catch{task.finish(false);}
    return promise;
  }
  function cancelPendingAdvance(){
    advanceEpoch++;advancePending=false;guidedUI.leave();
  }
  async function afterSpeech(button,action){
    if(advancePending)return;
    advancePending=true;const epoch=++advanceEpoch;
    button.disabled=true;button.setAttribute('aria-busy','true');
    await waitForSpeech();
    if(epoch!==advanceEpoch||destroyed)return;
    advancePending=false;action();
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
    state.lastInput=String(input??'');
    if(!state.lastInput.trim())return;
    const correct=markAnswer(input,x.answer);
    noteAnswer(correct,x);
    state.attempted=true;state.answerResult=correct?'correct':'incorrect';state.completed=true;
    if(correct)state.feedback=state.failed||state.hint!=='none'||x.guided?'Correct with support. We will check independent recall later.':'Correct independently. Well done.';
    else{state.failed=true;state.feedback='Not quite. Compare your answer with the correct model.';}
    render();
    if(x.kind!=='toEnglish')speak(x.answer);
    focusTarget('[data-act="next-question"]');
  }
  function finishQuestion(){
    if(state.question+1<state.queue.length){state.question++;resetQuestion();render();focusTarget('#ft-answer-text');}
    else{state.page='home';state.question=0;resetQuestion();render();}
  }
  function quizLetter(input){
    const x=state.alphabetQuiz[state.alphabetQuestion];if(!x||state.completed)return;
    state.lastInput=String(input??'');
    const correct=state.lastInput.trim().toUpperCase()===x.letter;
    state.answerResult=correct?'correct':'incorrect';
    const first=taughtAt('alphabet')||stamp();
    record({concept:'french:alphabet:'+x.letter,phase:phaseFor('alphabet'),
      correctCount:correct?1:0,total:1,support:state.failed?'small-prompt':'none',
      taughtAt:first,sourceRef:'alphabet-'+x.letter});
    state.failed=!correct||state.failed;
    state.completed=correct;
    state.feedback=correct?'Correct: '+x.letter+' (French name: '+x.name+').':'Not yet. Replay it and try again.';
    render();focusTarget(correct?'[data-act="next-letter-question"]':'#ft-quiz-input');
    if(!correct)el().querySelector('#ft-quiz-input')?.select();
  }
  function startQuiz(){
    teach('alphabet');state.alphabetQuiz=shuffle(ALPHABET);
    state.alphabetQuestion=0;resetQuestion();state.page='alphabet-quiz';render();
    speak('la lettre '+state.alphabetQuiz[0].name);
  }
  function setPage(page){
    if(!state.store){render();return;}
    cancelPendingAdvance();
    if(page==='lesson'){guidedUI.start();return;}
    if(page==='alphabet'){teach('alphabet');state.page=page;}
    else if(page==='sounds'){teach('sounds');state.page=page;}
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
    if(page==='workshop'&&state.builder.showFrench)speak(assembleWorkshop(state.builder.mode,state.builder.left,state.builder.right).fr);
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
  function authError(error){
    const code=error?.code||'';
    if(code==='auth/unsupported-standalone')return 'Google sign-in is disabled inside the installed iPhone app to prevent the stuck Google login screen. Use the existing Firebase email/password form or open the course in Safari.';
    if(code==='auth/operation-not-allowed')return 'Google sign-in is not enabled for kk-syllabus. Enable it in Firebase Authentication first; email sign-in still works.';
    if(code==='auth/unauthorized-domain')return 'This site is not yet authorised in Firebase Authentication for Google sign-in.';
    if(code==='auth/popup-blocked'||code==='auth/operation-not-supported-in-this-environment')return 'Google popup was blocked or unavailable. Try opening the page in Safari or use the existing Firebase password.';
    if(code==='auth/account-exists-with-different-credential')return 'The account has another provider. Sign in with the existing Firebase password first and link Google.';
    if(code==='auth/credential-already-in-use')return 'This Google account is associated with another Firebase identity. No accounts were merged; review account linking.';
    if(code==='auth/requires-recent-login')return 'For security, sign in again with your Firebase password before linking Google.';
    return String(error?.message||error);
  }
  async function onClick(e){
    const guidedTarget=e.target.closest('[data-gact],[data-gchoice],[data-gspeak]');
    if(guidedTarget&&guidedUI.click(guidedTarget))return;
    const b=e.target.closest('[data-act],[data-page],[data-letter],[data-say],[data-word],[data-sound-group],[data-sound-play],[data-sound-compare],[data-sound-sentence],[data-sound-answer],[data-cuddle-word]');
    if(!b)return;
    if(b.dataset.page){setPage(b.dataset.page);return;}
    if(b.dataset.letter!==undefined){
      const i=Number(b.dataset.letter);
      if(!Number.isInteger(i)||i<0||i>=ALPHABET.length)return;
      state.lessonIndex=i;render();
      speak(ALPHABET[i].name); // same user tap plays the letter and shows its card
      return;
    }
    if(b.dataset.say!==undefined){speak(PASSAGE[Number(b.dataset.say)].fr);return;}
    if(b.dataset.word!==undefined){openWordInfo(b.dataset.word,b);return;}
    if(b.dataset.cuddleWord!==undefined){
      const example=CUDDLES_DEMOS.find(d=>d.id===b.dataset.cuddleWord);
      if(example)speak(example.word);return;
    }
    if(b.dataset.soundGroup!==undefined){
      if(SOUND_FAMILIES.some(g=>g.id===b.dataset.soundGroup)){
        state.soundGroup=b.dataset.soundGroup;render();
      }
      return;
    }
    if(b.dataset.soundPlay!==undefined){
      const sound=soundById(b.dataset.soundPlay),index=Number(b.dataset.example);
      if(sound?.examples[index])speak(sound.examples[index]);return;
    }
    if(b.dataset.soundCompare!==undefined){
      const sound=soundById(b.dataset.soundCompare),index=Number(b.dataset.compareIndex);
      if(sound?.compare?.[index])speak(sound.compare[index]);return;
    }
    if(b.dataset.soundSentence!==undefined){
      const sound=soundById(b.dataset.soundSentence);
      if(sound)speak(sound.sentence);return;
    }
    if(b.dataset.soundAnswer!==undefined){answerSoundQuiz(b.dataset.soundAnswer);return;}
    switch(b.dataset.act){
      case 'passkey-signin':{
        b.disabled=true;
        state.cloudStatus='Verifying your App Monitor passkey…';updateStatus();
        try{
          if(typeof signInPasskey!=='function')throw Error('Passkey sign-in is not configured.');
          await signInPasskey();
          state.context=await connect();
          await attach(state.profile);
          state.authNotice='Your existing parent Firebase session is now active.';
        }catch(error){
          state.cloudStatus='Passkey sign-in: '+authError(error);
        }
        state.loading=false;render();break;
      }
      case 'google-signin':{
        try{
          if(!authCapabilities.allowGooglePopup)throw Object.assign(Error('Google sign-in is not available inside the installed iPhone app.'),{code:'auth/unsupported-standalone'});
          if(typeof signInGoogle!=='function')throw Error('Google sign-in is not configured.');
          state.cloudStatus='Opening Google sign-in…';updateStatus();
          // Invoked before the first await to retain iOS/Safari user activation for the popup.
          const attempt=signInGoogle();
          await attempt;
          state.context=await connect();await attach(state.profile);
          state.authNotice='Google sign-in succeeded with your existing parent account.';
        }catch(error){state.cloudStatus='Google sign-in: '+authError(error);}
        state.loading=false;render();break;
      }
      case 'link-google':{
        try{
          if(!authCapabilities.allowGooglePopup)throw Object.assign(Error('Google account linking is not available inside the installed iPhone app.'),{code:'auth/unsupported-standalone'});
          if(!state.context?.auth?.currentUser||typeof linkGoogle!=='function')throw Error('Parent account sign-in required.');
          state.authNotice='Opening Google account linking…';updateStatus();
          // Pop-up starts synchronously in the user gesture.
          const attempt=linkGoogle();
          await attempt;
          state.authNotice='Google is now linked to this same Firebase parent account.';
        }catch(error){state.authNotice='Google linking: '+authError(error);}
        render();break;
      }
      case 'copy-course-link':{
        const url='https://nirav2000.github.io/Next/french.html';
        try{
          if(!navigator.clipboard?.writeText)throw Error('Clipboard unavailable');
          await navigator.clipboard.writeText(url);
          state.cloudStatus='Course link copied — paste it into Safari';
        }catch{
          state.cloudStatus='Open Safari and enter: nirav2000.github.io/Next/french.html';
        }
        updateStatus();break;
      }
      case 'reset-password':{
        const emailField=el().querySelector('#ft-login input[name="email"]');
        const status=el().querySelector('[data-reset-status]');
        if(!emailField?.checkValidity()){emailField?.reportValidity();return;}
        if(typeof resetPassword!=='function'){if(status)status.textContent='Password reset is unavailable.';return;}
        b.disabled=true;
        if(status)status.textContent='Requesting password-reset email…';
        try{
          await resetPassword(emailField.value.trim());
          if(status)status.textContent='If this email has an eligible Firebase account, check its inbox for a password-reset message.';
        }catch(error){
          if(status)status.textContent='Password reset unavailable: '+authError(error);
        }finally{if(b.isConnected)b.disabled=false;}
        break;
      }
      case 'sync':await syncNow();break;
      case 'export':{
        const out=state.store?.exportJSON();if(!out)return;
        const u=URL.createObjectURL(new Blob([out],{type:'application/json'}));
        const a=document.createElement('a');a.href=u;a.download='next-french-evidence-'+state.profile+'.json';a.click();
        setTimeout(()=>URL.revokeObjectURL(u),3000);break;
      }
      case 'alpha-prev':state.lessonIndex=Math.max(0,state.lessonIndex-1);render();speak(ALPHABET[state.lessonIndex].name);break;
      case 'alpha-next':state.lessonIndex=Math.min(25,state.lessonIndex+1);render();speak(ALPHABET[state.lessonIndex].name);break;
      case 'toggle-letter-groups':state.letterGrouped=!state.letterGrouped;render();break;
      case 'hear-letter':speak(ALPHABET[state.lessonIndex].name);break;
      case 'hear-example':speak(ALPHABET[state.lessonIndex].example);break;
      case 'alpha-quiz':startQuiz();break;
      case 'start-sound-quiz':startSoundQuiz();break;
      case 'hear-sound-question':{const q=state.soundQueue[state.soundQuestion];if(q)speak(q.target);break;}
      case 'next-sound-question':{
        await afterSpeech(b,()=>{
          if(state.soundQuestion+1<state.soundQueue.length){state.soundQuestion++;state.soundAnswered=false;state.soundChoice=null;state.soundFeedback='';}
          else{state.soundLastResult=state.soundCorrect+'/'+state.soundQueue.length+' correct';state.page='sounds';state.soundAnswered=false;state.soundChoice=null;}
          render();
          if(state.page==='sound-quiz')speak(state.soundQueue[state.soundQuestion].target);
        });break;
      }
      case 'quiz-hear':speak('la lettre '+state.alphabetQuiz[state.alphabetQuestion].name);break;
      case 'next-letter-question':{
        await afterSpeech(b,()=>{
          if(state.alphabetQuestion<25){state.alphabetQuestion++;resetQuestion();render();speak('la lettre '+state.alphabetQuiz[state.alphabetQuestion].name);focusTarget('#ft-quiz-input');}
          else{state.page='home';resetQuestion();render();}
        });break;
      }
      case 'toggle-english':state.hideEnglish=!state.hideEnglish;render();break;
      case 'toggle-workshop':state.builder.showFrench=!state.builder.showFrench;render();if(state.builder.showFrench)speak(assembleWorkshop(state.builder.mode,state.builder.left,state.builder.right).fr);else cancelSpeech();break;
      case 'say-workshop':speak(assembleWorkshop(state.builder.mode,state.builder.left,state.builder.right).fr);break;
      case 'try-workshop':{
        const q=assembleWorkshop(state.builder.mode,state.builder.left,state.builder.right);
        state.queue=[{id:q.id,kind:'toFrench',prompt:q.en,answer:q.fr,concept:q.concept,phase:'practice',novel:false,guided:state.builder.showFrench,
          hint:'Use the connector and the two clauses from the workshop.'}];
        state.question=0;resetQuestion();state.page='practice';render();break;
      }
      case 'hint':{
        const x=state.queue[state.question];
        const input=el().querySelector('#ft-answer-text');
        if(input)state.lastInput=input.value;
        state.hint='small-prompt';state.feedback='';render();
        el().querySelector('#ft-answer-text')?.focus({preventScroll:true});break;
      }
      case 'model':{
        const x=state.queue[state.question];
        const draft=el().querySelector('#ft-answer-text');
        if(draft)state.lastInput=draft.value;
        noteAnswer(false,x,true);
        state.answerResult='revealed';state.completed=true;state.feedback='Model revealed: not scored as a correct answer.';render();if(x.kind!=='toEnglish')speak(x.answer);focusTarget('[data-act="next-question"]');break;
      }
      case 'hear-practice-model':{const x=state.queue[state.question];if(x&&state.completed&&x.kind!=='toEnglish')speak(x.answer);break;}
      case 'dictate':dictate();break;
      case 'next-question':await afterSpeech(b,finishQuestion);break;
      case 'restart':state.question=0;resetQuestion();render();break;
    }
  }
  async function onSubmit(e){
    if(guidedUI.submit(e.target,e))return;
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
    if(guidedUI.change(e.target))return;
    if(e.target.matches('[data-workshop-key]')){
      const key=e.target.dataset.workshopKey,v=Number(e.target.value);
      if(!['mode','left','right'].includes(key)||!Number.isInteger(v)||v<0)return;
      state.builder[key]=v;
      if(key==='mode'){state.builder.left=0;state.builder.right=0;}
      state.builder.showFrench=true;render();speak(assembleWorkshop(state.builder.mode,state.builder.left,state.builder.right).fr);return;
    }
    if(e.target.matches('[data-profile]')){
      const p=e.target.value;if(!['adult','sai'].includes(p)||p===state.profile)return;
      cancelPendingAdvance();
      // All previous profile events stay in their original, uniquely scoped store.
      if(state.cloud)await syncNow();
      await attach(p);state.page='home';render();
    }
    if(e.target.matches('[data-target]')&&state.coach){
      state.pronunciationIndex=Number(e.target.value);
      state.coach.setTarget(PASSAGE[state.pronunciationIndex].fr,'fr-FR');
    }
  }
  // Native form Enter checks; focused Next uses native button Enter. Ignore
  // held-down Enter repeats so they never skip an unseen question.
  const onKeyDown=e=>{if(e.key==='Enter'&&e.repeat&&!e.isComposing)e.preventDefault();};
  el().addEventListener('keydown',onKeyDown);
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
    el().removeEventListener('keydown',onKeyDown);
    el().removeEventListener('click',onClick);el().removeEventListener('submit',onSubmit);el().removeEventListener('change',onChange);
    if(wordDialog){try{wordDialog.close();}catch{}wordDialog.remove();wordDialog=null;}
    cancelPendingAdvance();
    if(state.coach)Promise.resolve(state.coach.destroy()).catch(()=>{});
  }};
}
