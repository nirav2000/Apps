import {ALPHABET,CUDDLES,PASSAGE,PATTERNS,DRILLS,SENTENCE_WORKSHOP,assembleWorkshop,markAnswer,normaliseAnswer} from './data.js';
import {SOUND_FAMILIES,SOUND_QUIZ,LETTER_NAME_GROUPS,LETTER_IPA,CUDDLES_DEMOS,soundById} from './phonics.js';
import {SUBJECTS,lookupFrenchWord,tokenizeFrench} from './lexicon.js';
import {fetchDictionary,dictionaryWord,dictionaryURL,frenchWiktionaryURL} from './dictionary.js';
import {browserAuthContext} from './auth-context.js';
import {createGuidedInterface,answerComparison,spokenWords,EXACT_ANSWER_ATTRIBUTES,learningAudioText,AUDIO_WAIT_LABEL,audioWaitMarkup,LISTEN_SLOW_RATE,listeningChunks,listeningSteps,listeningContext,listeningHintMarkup,listeningRepairMarkup,verifiedListeningEnglish,listeningHelpName,wordPatternMarkup,patternCardMarkup} from './guided-ui.js';
import {ALL_LANGUAGE_PATTERNS,patternReviewSchedule,patternIntroQuestion,PATTERN_CONTENT_VERSION} from './unlocking-builder.js';
import {optionalVerbTimeline} from './magic10.js';
import {createAssessmentInterface} from './assessment-ui.js';
import {TRACKS,validTrack} from './curriculum-meta.js';
import {ALL_UNITS,unitsForTrack,guidedStatus,guidedLesson} from './guided-lessons.js';
import {wordKey,revisionEvents,revisionQueue,clozeFor,createTypingSample,correctionSummary,revisionImport,containsTarget,revisionLabel,revisionEligibility} from './revision-signals.js';
import {adaptivePlans,chooseAdaptivePlan} from './adaptive-teaching.js';
import {activeRest,scheduledPractice,prioritizedChecks,overdueWords,noticeMarkup,updateStudyClocks,alertKeys,restMarkup} from './study-timing.js';
import {ANSWER_APP,createAnswerHistory,exactAudit,visibleHistory,answerHistoryPage} from './answer-history.js';
import {createEvidenceStore} from '../../learning-evidence/v1/index.js';
import {createFirestoreEvidenceCloud} from '../../learning-evidence/v1/firestore-cloud.js';

const APP_ID='next-french';
const VOICE_KEY='next-french:preferred-voice';
export const frenchVoiceKey=v=>String(v?.voiceURI||v?.name||'');
export function frenchVoices(voices=[]){
  return Array.from(voices).filter(v=>/^fr(?:[-_]|$)/i.test(v.lang||''));
}
export function preferredFrenchVoice(voices=[],key=''){
  const french=frenchVoices(voices);
  return french.find(v=>key&&frenchVoiceKey(v)===key)||french.find(v=>/^fr[-_]fr$/i.test(v.lang))||french[0];
}
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
  const preferredTrack=profile=>{try{const t=localStorage.getItem('next-french:track:'+profile);if(validTrack(t))return t;}catch{}return profile==='sai'?'sai':'michaela';};
  state.track=preferredTrack(state.profile);
  let preferredVoice='';
  try{preferredVoice=localStorage.getItem(VOICE_KEY)||'';}catch{}
  const el=()=>target;
  let syncTimer=0,destroyed=false,syncTask=null,pendingAgain=false,wordDialog=null,wordDialogOrigin=null;
  let selectedWord=null,wordToolbar=null,wordPress=null,suppressedWordClick=null;
  let answerStore=null,answerCloud=null,historyFilter='all',historyLimit=50;
  const historyRows=()=>visibleHistory(answerStore?.getEntries()||[],state.store?.getEntries()||[]);
  let typingSamples=new WeakMap(),pendingTyping=[],revision=null,session=null;
  const audits=()=>answerStore?.getEntries()||[];
  const sessionKey=()=>'next-french:session:'+state.store?.scope?.accountId+':'+state.profile+':'+state.track;
  function readSession(){
    const key=sessionKey(),now=Date.now();
    if(!session||session.key!==key){try{session=JSON.parse(localStorage.getItem(key)||'null');}catch{session=null;}}
    return session?.key===key&&Number.isFinite(session.lastAt)&&now-session.lastAt<=30*60000?session:null;
  }
  function currentSession(){
    const now=Date.now(),key=sessionKey();
    if(!readSession())session={id:id(),key,lastAt:now,revisionDone:false,oralDone:false,completedUnit:null};
    session.lastAt=now;try{localStorage.setItem(key,JSON.stringify(session));}catch{}
    return session.id;
  }
  function updateSession(patch){currentSession();Object.assign(session,patch);try{localStorage.setItem(session.key,JSON.stringify(session));}catch{}}
  function newLearningSession(){session=null;try{localStorage.removeItem(sessionKey());}catch{}currentSession();}
  function signalContext(step=state.page==='lesson'?guidedUI.current():null){
    const unitId=step?.unitId||'',status=unitId?guidedStatus(unitId,state.store?.getEntries()||[]):null;
    return {sessionId:currentSession(),track:state.track,unitId,stepId:step?.id||'',stage:step?.stage||state.page,position:status?status.teaching.completed:0};
  }
  function planAdaptive(status){
    if(!answerStore||!state.store)return null;
    const plan=chooseAdaptivePlan({status,queue:revisions(),audits:audits(),evidence:state.store.getEntries(),sessionId:currentSession(),track:state.track});
    if(!plan||plan.resume)return plan;
    if(!recordAttempt({ref:plan.id,activity:'Personal teaching',question:plan.en,expected:plan.fr,result:'signal',marker:'adaptive-plan-v1',reason:plan.reason,signal:{kind:'adaptive-plan',plan},context:{sessionId:plan.sessionId,track:plan.track,unitId:plan.unitId,position:plan.position}}))return null;
    return plan;
  }
  let importedWords=revisionImport(window.location.hash),revisionLookup='',patternReview=null,patternQuery='';
  const revisionProfile=()=>{
    const history=historyRows(),evidence=state.store?.getEntries()||[];
    const steps=unitsForTrack(state.track).flatMap(u=>guidedLesson(u.id).steps.map(s=>({...s,unitName:u.name})));
    return revisionEligibility({events:revisionEvents(answerStore?.getEntries()||[],history),history,evidence,steps,track:state.track});
  };
  const revisions=()=>revisionProfile().rows;
  const dailyRevisionItems=()=>revisions().filter(x=>x.due);
  const patternSchedule=()=>state.track==='unlocking'?patternReviewSchedule({
    steps:unitsForTrack(state.track).flatMap(u=>guidedLesson(u.id).steps),
    evidence:state.store?.getEntries()||[],audits:audits(),track:state.track
  }):[];
  const duePatterns=()=>patternSchedule().filter(x=>x.due);
  const nextPatternReview=()=>patternSchedule().find(x=>!x.due)?.dueAt??null;
  function startPatternReview(auto=false,patternId=''){
    if(enforceBreak())return;
    if(prioritizedChecks(state.store.getEntries(),Date.now(),state.track).length){startDailyWithSignals();return;}
    const rows=patternId?patternSchedule().filter(x=>x.id===patternId):duePatterns().slice(0,3);
    if(!rows.length){if(auto)assessmentUI.startDaily();return;}
    cancelPendingAdvance();revision=null;patternReview={auto,items:rows,index:0,result:null,answer:'',hint:false,guided:false,draft:''};state.page='patterns';render();focusTarget('#ft-pattern-answer,[data-act="pattern-intro"]');
  }
  function patternPage(){
    if(patternReview){
      const p=patternReview.items[patternReview.index],q=p.question;
      if(p.needsIntro)return '<section class="ft-card ft-pattern-task"><p class="ft-eyebrow">PATTERNS &amp; GRAMMAR · LEARN BY EXAMPLE</p><h2>'+esc(p.title)+'</h2><p>Listen to the examples and say them aloud. Notice how the French changes. Then try one yourself, with the answer covered.</p>'+patternCardMarkup(p,{reference:true})+'<button type="button" class="ft-primary" data-act="pattern-intro" data-ft-advance>I have said them → Try one</button><div class="ft-pause-row"><button type="button" data-act="pattern-leave">Pause · return to reference</button></div></section>';
      const status=patternReview.result;
      const answer=patternReview.answer||'';
      const question=q.mode==='conversion'?'<div class="ft-pattern-question"><p class="ft-small">English starting word</p><h3>'+esc(q.en)+'</h3><p class="ft-small">French word with the same meaning</p><h3 lang="fr">'+esc(q.sourceFr)+'</h3><p>Change the French ending -ation to -é to make the French for <strong>'+esc(q.targetEn)+'</strong>. This is a different word with a different meaning.</p></div>':'<div class="ft-pattern-question"><p class="ft-small">ENGLISH</p><h3>'+esc(q.en)+'</h3></div>';
      return '<section class="ft-card ft-pattern-task"><p class="ft-eyebrow">PATTERNS &amp; GRAMMAR · '+(patternReview.index+1)+'/'+patternReview.items.length+'</p><h2>'+esc(q.prompt)+'</h2><p class="ft-small">'+(patternReview.guided?'Try this with the answer covered. Ask for help if needed.':'Work out the French and say it aloud before typing.')+'</p>'+question+
        (status?answerComparison({answer,expected:q.fr,result:status,replay:'<button type="button" data-act="pattern-audio" data-pattern-audio="'+esc(q.fr)+'" aria-label="Hear the answer">▶</button>'})+
          '<p role="status">'+(status==='correct'&&!patternReview.hint&&!patternReview.guided?(p.due?'Correct. The next recall interval is scheduled.':'Correct. Early extra practice does not move the scheduled review.'):(patternReview.guided?'Guided practice completed. You will try again later without help.':'Review the examples. We will return to this sooner.'))+'</p>'+patternCardMarkup(p,{reference:true})+
          '<button type="button" class="ft-primary" data-act="pattern-next" data-ft-advance>Next →</button>':
          '<form id="ft-pattern-form"><label for="ft-pattern-answer">Your French</label><input id="ft-pattern-answer" name="answer" lang="fr" type="text" '+EXACT_ANSWER_ATTRIBUTES+' value="'+esc(patternReview.draft)+'" required><div class="ft-actions"><button type="submit" class="ft-primary">Check answer</button><button type="button" data-act="pattern-hint">I need help</button><button type="button" data-act="pattern-reveal">Show answer</button></div></form>'+(patternReview.hint?(q.clue?'<p class="ft-pattern-clue">'+esc(q.clue)+'</p>':'')+patternCardMarkup(p,{reference:true}):''))+
        '<div class="ft-pause-row"><button type="button" data-act="pattern-leave">Pause · return to reference</button></div></section>';
    }
    const rows=patternSchedule(),byId=new Map(rows.map(x=>[x.id,x])),due=rows.filter(x=>x.due),query=patternQuery.toLowerCase().trim();
    const shown=ALL_LANGUAGE_PATTERNS.filter(p=>!query||[p.title,p.rule,p.note,...p.examples.flat()].join(' ').toLowerCase().includes(query));
    const section=(p)=>{const r=byId.get(p.id);return '<article class="ft-pattern-reference-row"><div class="ft-row"><strong>'+esc(p.title)+'</strong><span class="ft-small">'+(r?r.needsIntro?'First guided recap '+(r.due?'due':'· '+esc(revisionDate(r.dueAt))):r.due?'Review due':'Next '+esc(revisionDate(r.dueAt)):'Reference only · not yet taught')+'</span></div>'+patternCardMarkup(p,{reference:true})+(r?'<p class="ft-small">'+r.attempts+' practice attempt'+(r.attempts===1?'':'s')+' · '+(r.needsIntro?'Guided recap not yet completed':r.level?'Recall interval step '+r.level:'Initial learning / repair')+'</p><button type="button" data-act="pattern-practise" data-pattern-id="'+esc(p.id)+'">Practise this pattern</button>':'')+'</article>';};
    return '<section class="ft-card"><p class="ft-eyebrow">YOUR LANGUAGE TOOLKIT</p><h2>Patterns &amp; grammar</h2><p>Find patterns you have met, compare English and French examples and hear the French. After the first guided recap, practise using the French again around 10 minutes later, then after 1, 3, 7 and 28 days from successful scheduled practice, and monthly thereafter. Reviews appear automatically in Today. Incorrect or supported recall returns sooner. Reading the reference does not count as a review.</p>'+
      (due.length?'<button type="button" class="ft-primary" data-act="pattern-start">Practise '+Math.min(3,due.length)+' due patterns →</button>':'<p class="ft-small">No pattern reviews due in this course.</p>')+
      '<form id="ft-pattern-search"><label for="ft-pattern-search-input">Find a rule or word</label><input id="ft-pattern-search-input" name="query" value="'+esc(patternQuery)+'" placeholder="e.g. important, feminine, -ing"><button type="submit">Find</button></form>'+
      '<h3>Already encountered in completed teaching</h3>'+(shown.filter(p=>byId.has(p.id)).map(section).join('')||'<p class="ft-small">No matching completed models yet.</p>')+
      '<details class="ft-revision-why"'+(query?' open':'')+'><summary>Other reference patterns (not yet scheduled)</summary>'+shown.filter(p=>!byId.has(p.id)).map(section).join('')+'</details></section>';
  }
  function submitPattern(value,reveal=false){
    if(!patternReview||patternReview.result||state.page!=='patterns'||enforceBreak())return;
    const p=patternReview.items[patternReview.index],q=p.question;
    if(p.needsIntro)return;
    if(!reveal&&!String(value).trim())return;
    if(prioritizedChecks(state.store.getEntries(),Date.now(),state.track).length){startDailyWithSignals();return;}
    const correct=!reveal&&markAnswer(value,q.fr),support=reveal||patternReview.guided?'worked-example':patternReview.hint?'small-prompt':'none';
    const audit=exactAudit(value,q.fr,correct,{ref:'pattern:'+p.id,activity:'Patterns & grammar',question:q.mode==='conversion'?'Build French for “'+q.targetEn+'” from the French word “'+q.sourceFr+'”':q.en,marker:'pattern-practice-v1',targetLang:'fr',support,context:{patternId:p.id,patternContentVersion:PATTERN_CONTENT_VERSION,patternQuestion:p.practiceIndex,kind:'pattern-practice',guidedIntro:patternReview.guided,questionMode:q.mode,providedVocabulary:patternReview.hint?q.clue||'':'',measure:'usable-french'},signal:{kind:'pattern-review',patternId:p.id}});
    if(reveal){audit.result='revealed';audit.reason='Model requested. No unaided recall credit.';}
    if(!recordAttempt(audit))return;
    patternReview.answer=value;patternReview.result=reveal?'revealed':correct?'correct':'incorrect';render();speak(q.fr);focusTarget('[data-act="pattern-next"]');
  }
  const answerField=node=>node?.matches?.('#ft-guided-input,#ft-answer-text,#ft-e-answer')?node:null;
  const onTypingFocus=e=>{const input=answerField(e.target);if(!input)return;const old=typingSamples.get(input);if(old)old.invalidate();else typingSamples.set(input,createTypingSample(input.value));};
  const onTypingInput=e=>{
    const input=answerField(e.target);if(!input)return;
    let sample=typingSamples.get(input);if(!sample){sample=createTypingSample('');typingSamples.set(input,sample);}
    sample.add(input.value,performance.now(),{inputType:e.inputType||'',composing:e.isComposing});
  };
  function recordSignal(word,kind,sentence='',extra={}){
    if(!word||!answerStore)return false;
    return recordAttempt({ref:'revision:'+kind,activity:'Personal word revision',question:kind==='pronunciation'?'Requested word audio':'Word revision signal',expected:word,result:'signal',reason:kind,marker:'revision-signal-v1',targetLang:'fr',signal:{word,kind,sentence,...extra},context:extra.context||signalContext()});
  }
  function pronunciationSignal(node){
    const submitted=node.closest('.ft-answer-comparison.incorrect .ft-answer-submitted');
    const word=submitted?node.dataset.revisionTarget:wordText(node);
    if(!word)return;
    const block=node.closest('p[lang="fr"],strong[lang="fr"],.ft-choice-translation');
    const current=state.page==='lesson'?guidedUI.current():null;
    const sentence=current&&containsTarget(current.fr,word)?current.fr:(!submitted?block?.textContent?.trim()||word:word);
    recordSignal(word,'pronunciation',sentence,{english:current&&sentence===current.fr?current.en:'',context:signalContext(current)});
  }
  function revisionOverview(){
    const rows=revisions(),due=rows.filter(x=>x.due).length;
    return '<section class="ft-card ft-revision-summary"><div class="ft-row"><div><p class="ft-eyebrow">PERSONAL REVISION</p><h2>'+due+' words or structures ready to revisit</h2><p class="ft-small">Spelling, repeated listening and relative typing hesitation guide the timing.</p></div><button type="button" data-page="signals" class="ft-primary">Review signals →</button></div></section>';
  }
  // Use exact bilingual course/audit pairs, not the translation of a longer
  // context sentence for an isolated word or an invented translation.
  function resolveListeningEnglish(fr,provided='',row=null){
    const direct=verifiedListeningEnglish(provided);if(direct)return direct;
    const key=normaliseAnswer(fr);if(!key)return '';
    const same=(f,e)=>normaliseAnswer(f)===key?verifiedListeningEnglish(e):'';
    const known=same(row?.sentence,row?.english);if(known)return known;
    for(const a of historyRows()){
      const context=a.context||{};const en=same(context.fr,context.en);if(en)return en;
    }
    for(const u of ALL_UNITS)for(const step of guidedLesson(u.id).steps){
      const en=same(step.fr,step.en);if(en)return en;
      for(const part of step.components||[]){const block=same(part.fr,part.en);if(block)return block;}
    }
    for(const p of PASSAGE){const en=same(p.fr,p.en);if(en)return en;}
    const note=lookupFrenchWord(fr);
    if(note?.type==='note'&&normaliseAnswer(note.key)===key)return verifiedListeningEnglish(note.meaning);
    if(note?.type==='verb'&&normaliseAnswer(note.entry?.lemma)===key)return verifiedListeningEnglish(note.entry.meaning);
    return '';
  }
  function revisionListenInfo(item){
    const en=resolveListeningEnglish(item.word,'',item);
    return {fr:item.word,en,context:listeningContext(item.word,en,clozeFor(item.sentence,item.word))};
  }
  function startRevision(auto=false){
    if(enforceBreak())return;
    if(auto&&prioritizedChecks(state.store.getEntries(),Date.now(),state.track).length){startDailyWithSignals();return;}
    const due=(auto?dailyRevisionItems():revisions().filter(x=>x.due)).slice(0,5);
    if(!due.length){if(auto){updateSession({revisionDone:true});assessmentUI.startDaily();}return;}
    cancelPendingAdvance();revision={items:due,index:0,result:null,answer:'',draft:'',level:0,rebuilding:false,rebuilt:false,rebuildFeedback:null,auto};state.page='signals';render();
    speak(due[0].word);focusTarget('#ft-revision-answer');
  }
  function startDailyWithSignals(){if(enforceBreak())return;currentSession();cancelPendingAdvance();revision=null;patternReview=null;assessmentUI.startDaily();}
  const revisionDate=at=>new Date(at).toLocaleString('en-GB',{day:'numeric',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'});
  function revisionWhy(item,{after=false}={}){
    const proof=item.learningProof;if(!proof)return '';
    const title=proof.type==='teaching'?'First recorded teaching / model practice':'First recorded correct unassisted answer';
    const reason=({spelling:'spelling or word-form difficulty',pronunciation:'requested word audio',hesitation:'slower typing',manual:'your own revision request',hint:'requested help',reveal:'needed the model',construction:'phrase construction difficulty',recognition:'recognition difficulty',review:'earlier revision difficulty'})[item.lastDifficulty?.kind]||'scheduled practice';
    return '<details class="ft-revision-why"><summary>Why am I revising this?</summary><p><strong>'+esc(title)+'</strong> · '+esc(revisionDate(proof.at))+(proof.unitName?' · '+esc(proof.unitName):'')+'</p><p>Selected because of '+esc(reason)+'. '+esc(item.counts.review)+' recorded revision attempt'+(item.counts.review===1?'':'s')+'.</p>'+
      (after?'<p>Recorded model: <span lang="fr">'+esc(proof.fr)+'</span></p>'+
        (item.firstTaught?'<p>First completed teaching: '+esc(revisionDate(item.firstTaught.at))+'</p>':'')+
        (item.firstCorrect?'<p>First independent correct answer: '+esc(revisionDate(item.firstCorrect.at))+'</p>':'')+
        item.signals.slice(-5).reverse().map(s=>'<p class="ft-small">'+esc(revisionDate(s.at))+' · '+esc(s.kind)+(s.kind==='review'?' · '+(s.correct?'correct':'incorrect'):'')+(s.actual?' · entered “'+esc(s.actual)+'”':'')+'</p>').join(''):'')+
      '<p class="ft-small">This evidence confirms prior learning or demonstrated knowledge, not mastery.</p></details>';
  }
  function revisionLookupMarkup(profile){
    const x=revisionLookup?profile.lookup(revisionLookup):null;
    const proof=(p,label)=>'<p><strong>'+label+'</strong> '+(p?esc(revisionDate(p.at))+(p.unitName?' · '+esc(p.unitName):''):'No record')+'</p>';
    return '<details class="ft-revision-why"'+(x?' open':'')+'><summary>Check whether I have learnt a word or phrase</summary><form id="ft-revision-lookup"><label for="ft-revision-lookup-word">French word or phrase</label><input id="ft-revision-lookup-word" name="word" lang="fr" type="text" value="'+esc(revisionLookup)+'" '+EXACT_ANSWER_ATTRIBUTES+' required maxlength="160"><button type="submit">Check my learning history</button></form>'+
      (x?'<div role="status"><p><strong lang="fr">'+esc(x.word)+'</strong> · '+(x.firstTaught?'Recorded teaching':x.firstCorrect?'Previously demonstrated knowledge':'No prior learning confirmed')+'</p>'+proof(x.firstTaught,'First completed teaching:')+proof(x.firstCorrect,'First independent correct answer:')+'<p>'+x.attemptCount+' recorded attempts, including '+x.diagnosticCount+' starting-check and '+x.revisionCount+' revision attempts.</p><p>'+esc(x.reason)+'</p><p class="ft-small">Based on this learner and selected course’s available synced evidence. A missing record is not proof you have never studied it elsewhere.</p></div>':'')+'</details>';
  }
  function revisionPage(){
    if(revision){
      const item=revision.items[revision.index],label=revisionLabel(item),info=revisionListenInfo(item);
      const result=revision.result,assisted=revision.level>0;
      const help=assisted?listeningSteps(info.fr,info.en,info.context).slice(0,revision.level).map(listeningHelpName):[];
      const showRepair=result&&(result!=='correct'||assisted)&&!revision.rebuilt;
      const summary=result==='revealed'?'Model revealed. We will revisit this without help.':result==='correct'?(assisted?'Correct with listening help. We will revisit this sooner.':'Correct. A later recall is scheduled.'):'We will revisit this sooner.';
      return '<section class="ft-card ft-revision-task"><p class="ft-eyebrow">PERSONAL '+label.toUpperCase()+' REVISION · '+(revision.index+1)+'/'+revision.items.length+'</p><h2>'+(revision.rebuilding?'Rebuild what you heard': 'Listen, then type the French')+'</h2>'+
        '<button type="button" data-act="revision-hear">▶ Hear the '+label+'</button>'+revisionWhy(item,{after:!!result&&!revision.rebuilding})+
        (revision.rebuilding?'<p class="ft-small">This is a supported rebuild. Your first attempt is already recorded.</p><form id="ft-revision-form"><label for="ft-revision-answer">Your French</label><input id="ft-revision-answer" name="answer" lang="fr" type="text" '+EXACT_ANSWER_ATTRIBUTES+' required><button type="submit" class="ft-primary">Check rebuild</button></form><button type="button" data-act="revision-listen-cancel-rebuild">Return to feedback</button>':
        result?answerComparison({answer:revision.answer,expected:item.word,result,replay:'<button type="button" data-act="revision-hear" aria-label="Hear the French again">▶</button>'})+
          '<p role="status">'+esc(summary)+'</p>'+(help.length?'<p class="ft-small">Help used: '+esc(help.join(' → '))+'</p>':'')+
          (revision.rebuildFeedback?'<div class="ft-listening-repair"><strong>'+esc(revision.rebuildFeedback.correct?'Rebuild correct — supported practice':'Rebuild needs another try')+'</strong>'+answerComparison({answer:revision.rebuildFeedback.answer,expected:item.word,result:revision.rebuildFeedback.correct?'correct':'incorrect'})+'<p class="ft-small">Your original result and revision schedule are unchanged.</p></div>':'')+
          (showRepair?listeningRepairMarkup({...info,answer:revision.rebuildFeedback?.answer??revision.answer,retry:true}):'')+
          (state.track==='unlocking'?wordPatternMarkup(item.word):'')+
          '<button type="button" class="ft-primary" data-act="revision-next" data-ft-advance>Next '+label+' →</button>':
          listeningHintMarkup({...info,level:revision.level})+
          '<form id="ft-revision-form"><label for="ft-revision-answer">Your French</label><input id="ft-revision-answer" name="answer" lang="fr" type="text" value="'+esc(revision.draft||'')+'" '+EXACT_ANSWER_ATTRIBUTES+' required><button type="submit" class="ft-primary">Check answer</button></form>')+
        '<div class="ft-pause-row"><button type="button" class="ft-pause-control" data-act="revision-leave">'+(revision.auto?'Skip remaining revision · continue':'Back to signals')+'</button></div><p class="ft-small">Listening and spelling practice; not an independent translation assessment.</p></section>';
    }
    const profile=revisionProfile(),rows=profile.rows,due=rows.filter(x=>x.due);
    const plans=unitsForTrack(state.track).flatMap(u=>adaptivePlans(audits(),u.id)).sort((a,b)=>b.at-a.at);
    const pending=importedWords.filter(w=>!rows.some(x=>x.key===wordKey(w)&&x.dueAt!==null));
    const importBox=importedWords.length?'<section class="ft-revision-row"><strong>Words to add to this learner’s revision</strong><p lang="fr">'+importedWords.map(esc).join(' · ')+'</p><p class="ft-small">'+(pending.length?pending.length+' new words; existing scheduled words will not be duplicated.':'All these words already have a scheduled review.')+'</p><button type="button" data-act="revision-import" class="ft-primary">'+(pending.length?'Confirm and add':'Done')+'</button></section>':'';
    const date=ms=>ms===null?'No drill scheduled':ms<=Date.now()?'Ready now':new Date(ms).toLocaleString('en-GB',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'});
    const priorityBar=x=>{
      const value=Math.max(0,Math.min(100,Number(x.strength)||0));
      const tier=x.priority==='High'?'high':x.priority==='Medium'?'medium':'low';
      return '<div class="ft-signal-priority-bar" role="meter" aria-label="'+esc(x.word)+' revision priority" aria-valuemin="0" aria-valuemax="100" aria-valuenow="'+value+'" aria-valuetext="'+value+' out of 100, '+esc(x.priority)+' priority"><span class="'+tier+'" style="width:'+value+'%"></span></div>';
    };
    const nextAction=x=>{
      const planned=plans.find(p=>p.key===x.key&&!p.complete);
      if(planned)return 'Planned: '+(planned.mode==='model'?'listen and repeat':planned.mode==='dictation'?'listen and spell':'recall in a sentence');
      if(x.due)return 'Ready now · eligible for upcoming practice';
      if(x.dueAt!==null)return 'Next review: '+date(x.dueAt);
      if(x.level>=5)return 'Scheduled revision complete';
      return 'Watching for further evidence · no drill scheduled';
    };
    return '<section class="ft-card ft-revision-dashboard"><p class="ft-eyebrow">PERSONAL LEARNING SIGNALS</p><h2>Your revision queue</h2><p>Only previously taught or independently demonstrated French in this course is eligible. Starting-check mistakes are not forgotten learning. Each signal is a clue, not a mastery score.</p>'+
      '<div class="ft-actions"><button type="button" data-act="revision-start" class="ft-primary"'+(!due.length?' disabled':'')+'>Practise '+Math.min(5,due.length)+' due targets</button><button type="button" data-act="sync">Sync</button></div>'+
      importBox+'<form id="ft-revision-add"><label for="ft-revision-add-word">Request a French word for learning or revision</label><input id="ft-revision-add-word" name="word" lang="fr" type="text" '+EXACT_ANSWER_ATTRIBUTES+' required maxlength="80"><button type="submit">Add word</button></form>'+
      (profile.deferred.length?'<details class="ft-revision-why"><summary>Not selected for revision ('+profile.deferred.length+')</summary><p>These are diagnostic or other signals without eligible prior learning. The normal teaching sequence takes priority. No records are deleted.</p>'+profile.deferred.slice(0,40).map(x=>'<p class="ft-small" lang="fr">'+esc(x.word)+' <span lang="en">· '+esc(x.reason)+(x.firstTaught?' · first taught '+esc(revisionDate(x.firstTaught.at)):'')+'</span></p>').join('')+'</details>':'')+revisionLookupMarkup(profile)+
      '<div class="ft-learning-profile"><h3>Your learning profile</h3><p class="ft-small">Live priority scores from your own learning signals, not percentages of knowledge. High-priority targets are considered sooner when the teaching sequence allows.</p>'+
      (rows.length?rows.map(x=>'<article class="ft-revision-row ft-signal-profile-row"><div class="ft-row"><strong lang="fr">'+spokenWords(x.word)+'</strong><span>'+esc(x.priority)+' · '+x.strength+'/100 priority</span></div>'+priorityBar(x)+'<p class="ft-small">'+x.counts.spelling+' spelling / form · '+x.counts.pronunciation+' word plays · '+x.counts.hesitation+' slower typing · '+x.counts.review+' reviews · '+(x.counts.hint+x.counts.reveal+x.counts.construction+x.counts.recognition)+' phrase / help signals · '+x.counts.success+' unaided successes</p><p class="ft-signal-next">'+esc(nextAction(x))+'</p>'+
        (x.counts.spelling?'<p class="ft-revision-errors">'+[...new Set(x.signals.filter(s=>s.kind==='spelling').map(s=>s.actual))].map(esc).join(', ')+' → <strong>'+esc(x.word)+'</strong></p>':'')+
        revisionWhy(x,{after:true})+'<details><summary>Signal history</summary>'+x.signals.slice().reverse().map(s=>'<p class="ft-small">'+esc(new Date(s.at).toLocaleString('en-GB'))+' · '+esc(s.kind)+(s.kind==='hesitation'?' · '+s.ratio+'× your sentence baseline'+(s.mode==='before-word'?' (pause before word)':' (typing)'):s.kind==='review'?' · '+(s.correct?'correct':'incorrect'):'')+'</p>').join('')+'</details></article>').join(''):'<p>No signals recorded yet. Words you mistype, repeatedly listen to or hesitate over will appear here.</p>')+'</div>'+
      (plans.length?'<details class="ft-adaptive-log"><summary>Teaching adaptations ('+plans.length+')</summary>'+plans.slice(0,40).map(p=>'<p><strong>'+esc(p.target)+'</strong> · '+esc(p.mode)+' · '+esc(p.reason)+' · '+(p.complete?'Completed':'Planned')+'<br>'+esc(p.fr)+'</p>').join('')+'</details>':'')+
      '<p class="ft-small">Timing uses only word-level aggregates from ordinary typing in answer fields, never a keystroke log. One slow word alone does not establish a difficulty.</p></section>';
  }
  function recordAttempt(audit){
    try{if(!answerStore)throw Error('Answer history unavailable');answerStore.record({...audit,context:{...signalContext(state.page==='lesson'?guidedUI.current():null),...audit.context},...(audit.targetLang==='fr'&&pendingTyping.length?{typing:pendingTyping}:{})});queueSync();return true;}
    catch(error){state.cloudStatus='Answer not saved: '+String(error.message||error)+' — please retry';updateStatus();return false;}
  }
  function record(raw){
    if(!state.store)throw Error('Sign in to record progress');
    const row=state.store.record({...raw,id:id(),source:{kind:'french-course',ref:raw.sourceRef||'session'}});
    queueSync();
    return row;
  }
  // The new lesson engine writes only additional evidence events to the
  // established Firebase parent/learner scope. Existing lesson records stay as-is.
  const guidedUI=createGuidedInterface({
    getEntries:()=>state.store?.getEntries()||[],getTrack:()=>state.track,requestStart:unit=>assessmentUI.startUnit(unit),record,recordAttempt,speak,playAudio,waitForSpeech,cancelSpeech,refresh:render,focusTarget,getAdaptivePlans:unit=>adaptivePlans(audits(),unit),planAdaptive,signalContext,recordSignal,resolveEnglish:resolveListeningEnglish,
    navigate:page=>{state.page=page;render();}
  });
  const assessmentUI=createAssessmentInterface({getEntries:()=>state.store?.getEntries()||[],getTrack:()=>state.track,record,recordAttempt,speak,playAudio,refresh:render,focusTarget,
    navigate:page=>{guidedUI.leave();state.page=page;render();},startGuided:unit=>{const rest=breakForCourse();if(rest)showBreak(rest);else guidedUI.start(unit);},getRevisionItems:dailyRevisionItems,getPatternItems:duePatterns,getNextPatternReview:nextPatternReview,getSession:()=>readSession()||{},onRevision:()=>startRevision(true),onPatterns:()=>startPatternReview(true),onCheckComplete:unit=>updateSession({completedUnit:unit,oralDone:false}),onOralComplete:()=>updateSession({oralDone:true}),onOralDifficulty:item=>recordSignal(item.fr,'manual',item.fr,{english:item.en,targetKind:'phrase'}),onNewSession:newLearningSession});
  // The break belongs to the learner across French tracks and is anchored
  // to completion evidence. Safe dashboard/settings navigation remains open.
  const SAFE_BREAK_PAGES=new Set(['home','evidence','history','signals','settings','explore']);
  const breakForCourse=()=>state.store?activeRest(state.store.getEntries(),Date.now(),null):null;
  const finishingLesson=rest=>state.page==='lesson'&&guidedUI.current()?.unitId===rest?.unitId&&guidedUI.finishing();
  function showBreak(rest){
    revision=null;patternReview=null;cancelPendingAdvance();
    if(rest.track!==state.track){state.track=rest.track;session=null;try{localStorage.setItem('next-french:track:'+state.profile,state.track);}catch{}}
    guidedUI.start(rest.unitId);
  }
  function enforceBreak(){const rest=breakForCourse();if(!rest)return false;showBreak(rest);return true;}
  const alertSupported=()=>typeof window.Notification!=='undefined'&&!!navigator.serviceWorker;
  const alertScope=()=>state.store?'next-french:practice-alerts:'+state.store.scope.accountId+':'+state.profile:'';
  function alertsEnabled(){try{return !!alertScope()&&localStorage.getItem(alertScope())==='1'&&window.Notification?.permission==='granted';}catch{return false;}}
  let lastTimingPoll=0,alertInFlight=false,alertNotice='';
  async function togglePracticeAlerts(){
    const key=alertScope();if(!key||!alertSupported())return;
    if(alertsEnabled()){try{localStorage.removeItem(key);}catch{}alertNotice='Device alerts turned off.';timingTick(true);return;}
    try{
      const permission=window.Notification.permission==='granted'?'granted':await window.Notification.requestPermission();
      if(key!==alertScope())return;
      if(permission!=='granted'){alertNotice='Notification permission was not granted. In-app reminders still work.';timingTick(true);return;}
      const reg=await navigator.serviceWorker.getRegistration();
      if(!reg?.active){alertNotice='Device alerts need an active installed web app. In-app reminders still work.';timingTick(true);return;}
      localStorage.setItem(key,'1');alertNotice='Device alerts enabled while Next is open.';timingTick(true);
    }catch{alertNotice='Device alerts unavailable. In-app reminders still work.';timingTick(true);}
  }
  async function notifyOverdue(keys){
    if(!keys.length||!alertsEnabled()||alertInFlight)return;
    const scope=alertScope(),storageKey=scope+':sent';
    let sent=[];try{sent=JSON.parse(localStorage.getItem(storageKey)||'[]');if(!Array.isArray(sent))sent=[];}catch{}
    const fresh=keys.filter(k=>!sent.includes(k));if(!fresh.length)return;
    alertInFlight=true;
    try{
      const reg=await navigator.serviceWorker.getRegistration();
      if(scope!==alertScope()||!alertsEnabled()||!reg?.active)return;
      await reg.showNotification('Next French · Practice overdue',{body:'A scheduled French practice is overdue. Open Next to resume learning.',tag:'next-french-practice',data:{nextFrench:true}});
      localStorage.setItem(storageKey,JSON.stringify([...new Set([...sent,...fresh])].slice(-300)));
    }catch{}finally{alertInFlight=false;}
  }
  function timingTick(force=false){
    if(destroyed)return;
    const now=Date.now();updateStudyClocks(el(),now);
    if(!state.store||state.loading||(!force&&now-lastTimingPoll<15000))return;
    lastTimingPoll=now;
    const entries=state.store.getEntries(),schedule=scheduledPractice(entries,now,state.track),words=overdueWords(revisions(),now),rest=activeRest(entries,now,null);
    const slot=el().querySelector('[data-study-notice]');
    if(slot){
      const show=SAFE_BREAK_PAGES.has(state.page)&&!revision;
      const clock=rest&&show&&state.page!=='home'?'<section class="ft-card ft-global-rest"><h2>Learning break</h2>'+restMarkup(rest,now)+'<button type="button" data-eact="daily" data-ft-advance data-rest-continue disabled aria-disabled="true">Continue when the break finishes</button></section>':'';
      const markup=clock+(show&&['home','evidence','signals','settings'].includes(state.page)?noticeMarkup(schedule,words,rest,{enabled:alertsEnabled(),supported:['home','settings'].includes(state.page)&&alertSupported(),actions:state.page==='home'}):'');
      const message=show&&alertNotice?'<p class="ft-small" role="status">'+esc(alertNotice)+'</p>':'';
      const existing=slot.querySelector('[data-rest-until]');if(!(existing&&rest&&Number(existing.dataset.restUntil)===rest.readyAt)&&slot.dataset.markup!==markup+message){slot.innerHTML=markup+message;slot.dataset.markup=markup+message;updateStudyClocks(slot,now);}
    }
    const path=el().querySelector('[data-learning-path]');
    if(path){const running=path.querySelector('[data-rest-until]');if(!(running&&rest&&Number(running.dataset.restUntil)===rest.readyAt)){const markup=assessmentUI.overview();if(path.dataset.markup!==markup){path.innerHTML=markup;path.dataset.markup=markup;updateStudyClocks(path,now);}}}
    void notifyOverdue(alertKeys(schedule,words));
  }
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
    const cloud=state.cloud,historyCloud=answerCloud;
    syncTask=(async()=>{
      state.busy=true;
      try{
        do{
          pendingAgain=false;
          state.cloudStatus='Syncing…';updateStatus();
          const result=await cloud.sync();
          if(historyCloud)await historyCloud.sync();
          if(destroyed||state.cloud!==cloud)return;
          state.cloudAt=result.at;
          state.cloudStatus='Saved to Firebase';
          const locked=breakForCourse();
          if(locked&&(revision||!SAFE_BREAK_PAGES.has(state.page)&&state.page!=='lesson'))showBreak(locked);
          else if(locked&&state.page==='lesson'&&guidedUI.current()&&!finishingLesson(locked))showBreak(locked);
          else if(!wordDialog&&['home','evidence','history','explore','settings'].includes(state.page)&&!revision)render();else{updateStatus();timingTick(true);}
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
    const s=el().querySelector('[data-cloud-status]');if(s){s.textContent=state.cloudStatus;s.hidden=!!state.store&&!/attention|unavailable|wrong account|not saved|error/i.test(state.cloudStatus);}
  }
  async function attach(profile){
    if(!state.context?.auth?.currentUser)return;
    const {auth,db,firestore,ownerUid}=state.context;
    if(auth.currentUser.uid!==ownerUid){state.cloudStatus='Wrong account; no evidence will be mixed';return;}
    state.profile=profile;state.track=preferredTrack(profile);revisionLookup='';patternReview=null;patternQuery='';revision=null;session=null;alertNotice='';typingSamples=new WeakMap();pendingTyping=[];
    state.soundLastResult=null;state.soundQueue=[];state.soundQuestion=0;
    state.store=createEvidenceStore({appId:APP_ID,learnerId:profile,accountId:ownerUid});
    guidedUI.reset();assessmentUI.reset();
    answerStore=createAnswerHistory({accountId:ownerUid,learnerId:profile});historyFilter='all';historyLimit=50;
    answerCloud=createFirestoreEvidenceCloud({store:answerStore,db,auth,firestore,ownerUid,learnerId:profile,appId:ANSWER_APP});
    state.cloud=createFirestoreEvidenceCloud({store:state.store,db,auth,firestore,ownerUid,learnerId:profile,appId:APP_ID});
    state.cloudStatus='Pending cloud check';
    state.cloudAt=null;
    try{localStorage.setItem('next-french:profile',profile);}catch{}
    await syncNow();
    if(importedWords.length)state.page='signals';
  }
  function nav(){
    const tabs=[['home','Today'],['lesson',"Today's lesson"],['evidence','Learning dashboard'],['history','Answer history'],['signals','Revision signals'],['patterns','Patterns & grammar'],['magic','Magic 10'],['alphabet','Alphabet'],
      ['sounds','Sounds'],['knowledge','Knowledge grid'],['workshop','Sentence workshop'],
      ['practice','Sentence practice'],['review','Review'],['pronunciation','Speak'],['explore','Explore']];
    return '<nav class="ft-tabs" aria-label="French activities">'+tabs.map(([p,t])=>'<button type="button" data-page="'+p+'" class="'+(state.page===p||(p==='lesson'&&state.page==='assessment')||(p==='sounds'&&state.page==='sound-quiz')||(p==='alphabet'&&state.page==='alphabet-quiz')?'active':'')+'">'+t+'</button>').join('')+'</nav>';
  }
  function top(){
    return '<div class="ft-top"><div><p class="ft-eyebrow">NEXT LEARNING · FRENCH</p><h1>French, built to be useful.</h1>'+
      '<p>Listen, notice, retrieve and reshape rich French sentences.</p></div>'+
      '<div class="ft-account"><label for="ft-profile">Learner</label><select id="ft-profile" data-profile>'+
      '<option value="adult"'+(state.profile==='adult'?' selected':'')+'>Adult</option>'+
      '<option value="sai"'+(state.profile==='sai'?' selected':'')+'>Sai</option></select>'+
      '<label for="ft-track">Course</label><select id="ft-track" data-track>'+TRACKS.map(t=>'<option value="'+t.id+'"'+(state.track===t.id?' selected':'')+'>'+esc(t.name)+'</option>').join('')+'</select><small data-cloud-status role="status" aria-live="polite"'+(state.store&&!/attention|unavailable|wrong account|not saved|error/i.test(state.cloudStatus)?' hidden':'')+'>'+esc(state.cloudStatus)+'</small>'+
      (state.store?'<button type="button" class="ft-voice-settings-link" data-page="settings"'+(state.page==='settings'?' aria-current="page"':'')+'>⚙ Settings</button>':'')+'</div></div>';
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
  function tracks(){
    return '<section class="ft-card ft-track-picker"><p class="ft-eyebrow">LEARNING TRACKS</p><h2>Choose your French course</h2><div class="ft-track-grid">'+TRACKS.filter(t=>t.id!=='unlocking-archive').map(t=>'<button type="button" class="ft-track-option'+(state.track===t.id?' selected':'')+'" data-act="track:'+t.id+'" aria-pressed="'+(state.track===t.id)+'"><strong>'+esc(t.name)+'</strong><small>'+unitsForTrack(t.id).length+' lessons</small><span>'+esc(t.summary)+'</span></button>').join('')+'</div><p class="ft-small"><button type="button" data-act="track:unlocking-archive">Earlier Unlocking lessons &amp; progress</button></p></section>';
  }
  function overview(){
    const active=state.context?.auth?.currentUser;
    const googleLinked=active?.providerData?.some(provider=>provider.providerId==='google.com')===true;
    return tracks()+'<div data-learning-path>'+assessmentUI.overview()+'</div>'+revisionOverview()+guidedUI.dashboard()+
      '<section class="ft-hero ft-card"><p class="ft-eyebrow">REFERENCE &amp; FREE EXPLORATION</p><h2>Explore the words behind your lessons.</h2>'+
      '<p>Use the guided lessons as your default. The alphabet, sound library, bilingual passage and sentence workshop remain available for optional exploration.</p>'+
      '<div class="ft-actions"><button data-page="alphabet">Learn the alphabet</button><button data-page="sounds">Hear French sounds</button>'+
      '<button data-page="knowledge">Explore the knowledge grid</button><button data-page="patterns">Patterns &amp; grammar</button><button data-page="practice">Practise sentences</button></div></section>'+
      oralPracticeCard()+
      '<section class="ft-card"><div class="ft-actions"><button data-act="sync">Sync with Firebase</button><button data-act="export">Export evidence</button><button data-page="review">Manual review</button></div></section>'+
      '<section class="ft-card ft-identity"><h2>Your learning account</h2><p class="ft-small">'+(active?.email?'Signed in as <strong>'+esc(active.email)+'</strong>. ':'Signed in with your existing parent account. ')+(googleLinked?'Google sign-in linked to this Firebase account.':'Linking Google lets you use the same account without entering the Firebase password on other devices.')+'</p>'+
      (state.authNotice?'<p role="status">'+esc(state.authNotice)+'</p>':'')+
      (!googleLinked&&typeof linkGoogle==='function'&&authCapabilities.allowGooglePopup
  ?'<button data-act="link-google" type="button">Link Google to this account</button>'
  :(!googleLinked&&authCapabilities.iosStandalone
    ?'<p class="ft-small">Google account linking is available when you open the course in Safari, not from the installed iPhone app.</p>':''))+'</section>'+
      '<section class="ft-card"><h2>How the course works</h2><p>Real French audio → bilingual understanding → CUDDLES noticing → guided translation → controlled substitution → independent unseen sentences → review on days 1, 3, 7 and 28.</p>'+
      '<p class="ft-small">PROFS: Past, Reasons, Opinions, Future, Subjunctive. This pilot introduces useful past, reason, opinion and future structures, plus a supported subjunctive example.</p></section>';
  }
  function oralPracticeCard(){return '<section class="ft-card"><h2>Rapid oral practice</h2><p>Retrieve familiar expressions in this track and self-check against spoken French.</p><div class="ft-actions"><button type="button" data-eact="oral">Rapid oral practice</button>'+(state.track==='michaela'?'<button type="button" data-eact="experiment">Open teaching experiment</button>':'')+'</div></section>';}
  const explorePages=[['signals','Revision signals'],['patterns','Patterns & grammar'],['magic','Magic 10'],['alphabet','Alphabet'],['sounds','Sounds'],['knowledge','Knowledge grid'],['workshop','Sentence workshop'],['practice','Sentence practice'],['review','Manual review'],['pronunciation','Speak']];
  function exploreNav(){
    return '<nav class="ft-explore-nav" aria-label="Optional French activities">'+explorePages.map(([p,t])=>'<button type="button" data-page="'+p+'"'+(state.page===p?' aria-current="page"':'')+'>'+t+'</button>').join('')+'</nav>';
  }
  function explore(){
    return '<section class="ft-card ft-explore-intro"><p class="ft-eyebrow">OPTIONAL ACTIVITIES</p><h2>Explore French</h2><p>Today is your recommended learning path. Use this area only when you want to choose an activity yourself. For the most useful retention result, complete due independent checks first. You can still choose manual practice.</p>'+exploreNav()+'</section>'+
      tracks()+guidedUI.dashboard()+revisionOverview()+
      '<section class="ft-card"><h2>Additional spoken practice</h2><p>Say familiar French before revealing the answer. This is optional, unscored practice, not a retention test.</p><button type="button" data-eact="oral">Rapid oral practice</button>'+(state.track==='michaela'?'<button type="button" data-eact="experiment">Open teaching experiment</button>':'')+'</section>';
  }
  function accountSettings(){
    const active=state.context?.auth?.currentUser;
    const googleLinked=active?.providerData?.some(provider=>provider.providerId==='google.com')===true;
    return '<section class="ft-card"><div class="ft-actions"><button data-act="sync">Sync with Firebase</button><button data-act="export">Export evidence</button></div></section>'+
      '<section class="ft-card ft-identity"><h2>Your learning account</h2><p class="ft-small">'+(active?.email?'Signed in as <strong>'+esc(active.email)+'</strong>. ':'Signed in with your existing parent account. ')+(googleLinked?'Google sign-in linked to this Firebase account.':'Linking Google lets you use the same account without entering the Firebase password on other devices.')+'</p>'+
      (state.authNotice?'<p role="status">'+esc(state.authNotice)+'</p>':'')+
      (!googleLinked&&typeof linkGoogle==='function'&&authCapabilities.allowGooglePopup
  ?'<button data-act="link-google" type="button">Link Google to this account</button>'
  :(!googleLinked&&authCapabilities.iosStandalone
    ?'<p class="ft-small">Google account linking is available when you open the course in Safari, not from the installed iPhone app.</p>':''))+'</section>';
  }
  function interactiveFrench(value){
    return tokenizeFrench(value).map(part=>(part.info||/^[\p{L}\p{M}]+(?:['’ -][\p{L}\p{M}]+){0,2}$/u.test(part.text))
      ?'<button type="button" class="ft-word" lang="fr" data-word="'+esc(part.text)+'" title="Tap to hear; hold to explore" aria-label="Hear '+esc(part.text)+'">'+esc(part.text)+'</button>'
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
      '<p>Example word: <strong lang="fr">'+spokenWords(x.example)+'</strong></p>'+
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
      (state.soundLastResult?'<p role="status" class="ft-feedback">Listening check: '+esc(state.soundLastResult)+'.</p>':'')+
      '<p class="ft-sound-intro">'+esc(selected.intro)+'</p>'+
      '<div class="ft-sound-cards">'+selected.sounds.map((pattern)=>{
        return '<article class="ft-sound-card"><div class="ft-row"><div><h3>'+esc(pattern.spell)+'</h3><small>'+esc(pattern.ipa)+'</small></div>'+
          '<button type="button" data-sound-play="'+esc(pattern.id)+'" data-example="0" aria-label="Hear '+esc(pattern.examples[0])+'">▶ Hear</button></div>'+
          '<p>'+esc(pattern.clue)+'</p>'+
          '<div class="ft-sound-words">'+pattern.examples.map((word,i)=>
            '<button type="button" data-sound-play="'+esc(pattern.id)+'" data-example="'+i+'" data-word="'+esc(word)+'" aria-label="Hear '+esc(word)+'" lang="fr">'+esc(word)+' <span aria-hidden="true">▶</span></button>').join('')+'</div>'+
          '<details><summary>Hear it in a full sentence</summary><p lang="fr">'+interactiveFrench(pattern.sentence)+'</p>'+
            '<button type="button" data-sound-sentence="'+esc(pattern.id)+'">▶ Hear sentence</button></details>'+
          (pattern.compare?'<div class="ft-sound-contrast"><span>Compare</span>'+
            pattern.compare.map((w,i)=>'<button type="button" lang="fr" data-sound-compare="'+esc(pattern.id)+'" data-compare-index="'+i+'" data-word="'+esc(w)+'">▶ '+esc(w)+'</button>').join('')+'</div>':'')+
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
        '<button type="button" data-act="next-sound-question" data-ft-advance class="ft-primary">'+(state.soundQuestion===state.soundQueue.length-1?'Finish listening check':'Next word')+'</button>':'')+
      '</section>';
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
    if(!recordAttempt(exactAudit(value,item.correct,correct,{ref:'sound-'+item.id,activity:'Phonics listening',question:'Which spelling matches the sound? '+item.target,support:'none',marker:'choice-v1',normalize:x=>String(x??'')})))return;
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
      '<p>First understand all 14 complete sentences. Speak them aloud. Find repeated connectives. Only then remove the support. Tap a French word to hear it. Press and hold it, or use Explore, to learn more.</p>'+
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
      '<form id="ft-answer"><label for="ft-answer-text">Your answer</label><input id="ft-answer-text" name="answer" type="text" lang="'+(x.kind==='toEnglish'?'en':'fr')+'" '+EXACT_ANSWER_ATTRIBUTES+' value="'+esc(state.lastInput)+'" required>'+
      '<div class="ft-actions"><button type="submit" class="ft-primary">Check answer</button><button type="button" data-act="hint"'+(state.hint!=='none'||!x.hint?' disabled':'')+'>Give me a hint</button><button type="button" data-act="model">Show model</button><button type="button" data-act="dictate">🎤 Dictate</button></div></form>')+
      (state.hint!=='none'?'<p class="ft-hint">Hint: '+esc(x.hint)+'</p>':'')+
      (state.feedback?'<div class="ft-feedback '+(state.answerResult||'')+'" role="status">'+esc(state.feedback)+'</div>':'')+
      (state.completed?'<div class="ft-actions"><button class="ft-primary" data-act="next-question" data-ft-advance>'+(state.question===state.queue.length-1?'See results':'Next question')+'</button></div>':'')+
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
      (state.completed?'<div class="ft-actions"><button class="ft-primary" data-act="next-letter-question" data-ft-advance>'+(state.alphabetQuestion===25?'Finish quiz':'Next letter')+'</button></div>':'')+
      '<p class="ft-small">The audio comes from your device’s French voice and should be checked against a proficient speaker if anything sounds unclear.</p></section>';
  }
  // All visible French word controls use the same interaction. Selection is
  // transient UI only: never rerender a live question or write learning evidence.
  const wordSelector='[data-gword],[data-word],[data-choice-word]';
  const wordTarget=target=>target?.closest?.(wordSelector);
  const wordText=node=>node?.dataset.gword??node?.dataset.word??node?.dataset.choiceWord;
  const wordBlocked=()=>!!(breakForCourse()&&!finishingLesson(breakForCourse()))||advancePending||!!el().querySelector('.ft-guided-task button[aria-busy="true"]');
  function clearWordSelection(){
    if(selectedWord?.node){selectedWord.node.classList.remove('ft-word-selected');if(selectedWord.node.tagName==='BUTTON')selectedWord.node.removeAttribute('aria-pressed');}
    wordToolbar?.remove();wordToolbar=null;selectedWord=null;
  }
  function selectWord(node){
    if(!node?.isConnected||wordBlocked())return false;
    const word=wordText(node);if(!word)return false;
    if(selectedWord?.node===node&&wordToolbar?.isConnected)return true;
    clearWordSelection();
    selectedWord={node,word};
    node.classList.add('ft-word-selected');if(node.tagName==='BUTTON')node.setAttribute('aria-pressed','true');
    const toolbar=document.createElement('div');toolbar.className='ft-word-tools';
    toolbar.innerHTML='<span>Selected: <strong lang="fr">'+esc(word)+'</strong></span><div class="ft-word-tool-actions">'+
      '<button type="button" data-word-action="explore" aria-label="Explore '+esc(word)+'">Explore '+esc(word)+' ↗</button>'+
      '<button type="button" data-word-action="clear" aria-label="Clear word selection">×</button></div>';
    const block=node.closest('.ft-answer-comparison,.ft-guided-pair,.ft-guided-options,.ft-magic-row,.ft-grid-row,.ft-sound-words,.ft-sound-contrast,.ft-workshop-french,.ft-e-prompt,.ft-word-timeline,.ft-word-example');
    const anchor=block||node.closest('table,p,h2,h3,blockquote');
    if(anchor)anchor.insertAdjacentElement('afterend',toolbar);
    else (node.closest('section,article,dialog')||el()).append(toolbar);
    wordToolbar=toolbar;
    return true;
  }
  function exploreWord(node){
    if(!selectWord(node))return;
    openWordInfo(wordText(node),node);
  }
  // Open on release after 500ms. Movement, scrolling, cancellation and a
  // fresh pointer gesture invalidate the hold. Suppress only its trailing
  // click, so the long press does not also speak or select an answer.
  const onWordPointerDown=e=>{
    wordPress=null;
    if(e.button!==0||e.isPrimary===false||wordBlocked())return;
    const node=wordTarget(e.target);if(!node)return;
    suppressedWordClick=null;
    wordPress={node,id:e.pointerId,x:e.clientX,y:e.clientY,at:Date.now()};
  };
  const onWordPointerMove=e=>{
    if(wordPress?.id===e.pointerId&&Math.hypot(e.clientX-wordPress.x,e.clientY-wordPress.y)>10)wordPress=null;
  };
  const cancelWordPress=()=>{wordPress=null;};
  const finishWordHold=(node,e)=>{
    if(!node?.isConnected||wordBlocked())return;
    e.preventDefault();wordPress=null;suppressedWordClick={node,until:Date.now()+900};
    exploreWord(node);
  };
  const onWordPointerUp=e=>{
    const press=wordPress;wordPress=null;
    if(press?.id===e.pointerId&&wordTarget(e.target)===press.node&&Date.now()-press.at>=500)finishWordHold(press.node,e);
  };
  const onWordContext=e=>{
    const node=wordTarget(e.target);if(!node)return;
    e.preventDefault();
    if(suppressedWordClick?.node===node&&Date.now()<suppressedWordClick.until)return;
    // On touch, a context menu can be emitted before pointerup; require
    // an uncancelled hold. Mouse right click provides an equivalent action.
    if(e.pointerType==='touch'&&!wordPress)return;
    if(wordPress&&Date.now()-wordPress.at<450)return;
    finishWordHold(node,e);
  };
  function openWordInfo(surface,origin){
    const info=lookupFrenchWord(surface);
    const returnTo=wordDialog?.contains(origin)?wordDialogOrigin:origin;
    if(wordDialog){const old=wordDialog;wordDialog=null;try{old.close();}catch{}old.remove();}
    wordDialogOrigin=returnTo;
    const dialog=document.createElement('dialog');
    dialog.className='ft-word-dialog';
    dialog.setAttribute('aria-label','Explore French word '+surface);
    const isVerb=info?.type==='verb',verb=info?.entry;
    const header='<div class="ft-word-dialog-top"><div><p class="ft-eyebrow">OPTIONAL LANGUAGE EXPLORER</p><h2 lang="fr">'+spokenWords(surface)+'</h2></div>'+
      '<button type="button" data-close-word aria-label="Close word explanation">×</button></div>';
    let content='';
    if(isVerb){
      const timeline=optionalVerbTimeline(verb.lemma);
      const timelineHTML=timeline?
        '<h3>Use it now: past, present and future</h3><div class="ft-word-timeline">'+
          timeline.map(row=>'<div><small>'+esc(row.kind)+'</small><strong lang="fr">'+spokenWords(row.fr)+
            '</strong><span>'+esc(row.en)+'</span><button type="button" data-dialog-speak="'+esc(row.fr)+'">▶</button></div>').join('')+
          '</div><p class="ft-small">These are individually reviewed examples, not an automatic tense generator.</p>':
        '<p class="ft-small">A complete past/future phrase has not been reviewed for this verb. Consult the sourced dictionary links below.</p>';
      const persons=verb.forms.map((form,i)=>form===info.matched?SUBJECTS[i]:null).filter(Boolean);
      const person=info.formKind==='present'&&info.personIndex!==null
        ?persons.join(' · ')+' · present tense'
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
        '<p lang="fr" class="ft-word-example">'+spokenWords(verb.example)+'</p>'+
        '<div class="ft-actions"><button type="button" data-dialog-speak="'+esc(verb.lemma)+'">▶ Infinitive</button>'+
        '<button type="button" data-dialog-speak="'+esc(verb.example)+'">▶ Example</button></div>';
    }else if(info){
      content='<p class="ft-word-form">'+esc(info.kind)+'</p>'+
        '<div class="ft-word-facts"><div><small>Meaning</small><strong>'+esc(info.meaning)+'</strong></div></div>'+
        '<h3>Notice</h3><p>'+esc(info.tip)+'</p>'+
        '<p lang="fr" class="ft-word-example">'+spokenWords(info.example)+'</p>'+
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
      if(wordDialog===dialog){
        wordDialog=null;wordDialogOrigin=null;
        if(dialog.contains(selectedWord?.node))clearWordSelection();
        if(returnTo?.isConnected)returnTo.focus({preventScroll:true});
      }
      dialog.remove();
    },{once:true});
    if(typeof dialog.showModal==='function')dialog.showModal();
    else dialog.setAttribute('open','');
    if(!info&&lookup)loadDictionary();
  }
  function settings(){
    const voices=frenchVoices(window.speechSynthesis?.getVoices?.()||[]);
    const available=voices.some(v=>frenchVoiceKey(v)===preferredVoice);
    const options='<option value=""'+(!preferredVoice?' selected':'')+'>Automatic — device French voice</option>'+
      (!available&&preferredVoice?'<option value="'+esc(preferredVoice)+'" selected>Saved voice unavailable on this device</option>':'')+
      voices.map(v=>'<option value="'+esc(frenchVoiceKey(v))+'"'+(frenchVoiceKey(v)===preferredVoice?' selected':'')+'>'+esc(v.name+' · '+v.lang)+'</option>').join('');
    return '<section class="ft-card ft-voice-settings"><p class="ft-eyebrow">FRENCH SETTINGS</p><h2>Choose your French voice</h2>'+
      '<p>Use the same voice for lessons, words, corrections and listening exercises on this device.</p>'+
      '<label for="ft-voice">French voice<select id="ft-voice" data-french-voice>'+options+'</select></label>'+
      '<div class="ft-actions"><button type="button" class="ft-primary" data-act="preview-french-voice">▶ Preview voice</button><button type="button" data-page="home">Done</button></div>'+
      '<p class="ft-small">'+(!voices.length?'No French voices listed yet. The automatic voice may become available after the browser loads its voices.':!available&&preferredVoice?'The saved voice is unavailable here. A device French voice will be used until it is available.':'Your selection is saved on this device. Available voices depend on your operating system and browser.')+'</p>'+
      '<p class="ft-small">On iPad or iPhone, additional system voices may be available under Settings → Accessibility → Read &amp; Speak or Spoken Content. Safari may expose only some installed voices. The separate pronunciation coach uses its own reference audio.</p></section>'+accountSettings();
  }
  function pronounce(){
    return '<section class="ft-card"><p class="ft-eyebrow">OPTIONAL PRONUNCIATION COACH</p><h2>Listen and repeat aloud</h2>'+
      '<p>This reuses your existing shared Apps pronunciation lab. Its transcript, rhythm and pitch estimates are <b>provisional coaching cues</b>, not proof of phoneme accuracy.</p>'+
      '<label for="ft-target">Sentence<select id="ft-target" data-target>'+PASSAGE.map((p,i)=>'<option value="'+i+'"'+(i===state.pronunciationIndex?' selected':'')+'>'+esc(p.fr)+'</option>').join('')+'</select></label>'+
      '<div id="ft-pronounce-host"></div></section>';
  }
  function focusTarget(selector){
    for(const part of selector.split(',')){
      const target=el().querySelector(part.trim());
      if(target&&!target.disabled&&!target.closest('[hidden]')){target.focus();return target;}
    }
    return null;
  }
  function defaultAdvance(){
    if(wordDialog||advancePending||!['lesson','assessment','practice','review','alphabet-quiz','sound-quiz','signals','patterns'].includes(state.page))return null;
    const task=el().querySelector('.ft-guided-shell,.ft-e-question,.ft-revision-task')||el();
    return [...task.querySelectorAll('[data-ft-advance]')].find(b=>!b.disabled&&!b.closest('[hidden]')&&b.getClientRects().length)||null;
  }
  function focusDefaultAdvance(){defaultAdvance()?.focus({preventScroll:true});}
  function render(){
    if(destroyed)return;
    clearWordSelection();cancelWordPress();
    if(wordDialog){const old=wordDialog;wordDialog=null;wordDialogOrigin=null;try{old.close();}catch{}old.remove();}
    if(state.coach){const old=state.coach;state.coach=null;Promise.resolve(old.destroy()).catch(()=>{});}
    const ready=!!state.store;
    el().innerHTML=top()+(state.loading?'<section class="ft-card">Checking your Firebase session…</section>':
      (!ready?login():nav()+'<div data-study-notice></div>'+
      (state.page==='home'?overview():state.page==='explore'?explore():state.page==='evidence'?assessmentUI.dashboard():state.page==='history'?answerHistoryPage(historyRows(),historyFilter,historyLimit):state.page==='signals'?revisionPage():state.page==='patterns'?patternPage():state.page==='assessment'?assessmentUI.page():state.page==='settings'?settings():state.page==='lesson'?guidedUI.page():state.page==='magic'?guidedUI.reference():
       state.page==='alphabet'?alphabet():state.page==='sounds'?sounds():state.page==='sound-quiz'?soundQuiz():state.page==='knowledge'?knowledge():
       state.page==='workshop'?workshop():state.page==='practice'||state.page==='review'?practice():state.page==='alphabet-quiz'?alphaQuiz():pronounce())+(explorePages.some(([p])=>state.page===p)||['alphabet-quiz','sound-quiz'].includes(state.page)?exploreNav():'')))+
      '<p class="ft-foot">Original lessons informed by Barry Smith, Jessica Lund’s published Michaela work, and general repeat-and-build principles described by Paul Noble. Not affiliated with or a reproduction of their courses. <a href="https://jlmfl.wordpress.com/2022/11/27/teaching-grammar-rote-vs-rules/">Lund on rote &amp; rules</a> · <a href="https://jlmfl.wordpress.com/2017/01/15/aides-memoire-1-cuddles/">CUDDLES</a></p>';
    if(ready&&state.page==='pronunciation')mountPronunciation();
    if(ready)timingTick(true);
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
  function speak(s,lang='fr-FR',rate=.8){
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
      const u=new SpeechSynthesisUtterance(String(s));u.lang=lang;u.rate=Math.max(.45,Math.min(1.2,Number(rate)||.8));
      const voices=window.speechSynthesis.getVoices();
      const voice=/^fr(?:[-_]|$)/i.test(lang)?preferredFrenchVoice(voices,preferredVoice):
        voices.find(v=>String(v.lang).toLowerCase()===lang.toLowerCase())||voices.find(v=>String(v.lang).toLowerCase().split('-')[0]===lang.toLowerCase().split('-')[0]);
      if(voice){u.voice=voice;u.lang=voice.lang||lang;}
      task.utterance=u;
      u.onend=()=>task.finish(true);
      u.onerror=()=>task.finish(false);
      timer=setTimeout(()=>{if(speechTask===task)cancelSpeech();},Math.max(12000,Math.min(60000,String(s).length*220+5000)));
      window.speechSynthesis.speak(u);
    }catch{task.finish(false);}
    return promise;
  }
  function playAudio(event,text,lang='fr-FR'){
    const spoken=learningAudioText(event,text);
    return spoken?speak(spoken,lang):Promise.resolve(false);
  }
  function cancelPendingAdvance(){
    advanceEpoch++;advancePending=false;guidedUI.leave();
  }
  async function afterSpeech(button,action){
    if(advancePending)return;
    advancePending=true;const epoch=++advanceEpoch;
    const original={html:button.innerHTML,label:button.getAttribute('aria-label')};
    if(speechTask){
      button.disabled=true;button.setAttribute('aria-busy','true');
      button.setAttribute('data-audio-wait','');button.setAttribute('aria-label',AUDIO_WAIT_LABEL);
      button.innerHTML=audioWaitMarkup();
    }
    await waitForSpeech();
    if(epoch!==advanceEpoch||destroyed)return;
    advancePending=false;
    if(button.isConnected){
      button.disabled=false;button.removeAttribute('aria-busy');button.removeAttribute('data-audio-wait');
      if(original.label===null)button.removeAttribute('aria-label');else button.setAttribute('aria-label',original.label);
      button.innerHTML=original.html;
    }
    action();
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
    if(!recordAttempt(exactAudit(state.lastInput,x.answer,correct,{ref:x.id,activity:state.page==='review'?'Review':'Sentence practice',question:x.prompt,targetLang:x.kind==='toEnglish'?'en':'fr',support:state.hint!=='none'?'small-prompt':x.guided?'worked-example':'none'})))return;
    noteAnswer(correct,x);
    state.attempted=true;state.answerResult=correct?'correct':'incorrect';state.completed=true;
    if(correct)state.feedback=state.failed||state.hint!=='none'||x.guided?'Correct with support. We will check independent recall later.':'Correct independently. Well done.';
    else{state.failed=true;state.feedback=x.kind==='toEnglish'?'Not quite. Compare your answer with the correct model.':correctionSummary(state.lastInput,x.answer);}
    render();
    playAudio('correction',x.kind==='toEnglish'?x.prompt:x.answer);
    focusTarget('[data-act="next-question"]');
  }
  function practiceEntryAudio(){
    const x=state.queue[state.question];
    if(x?.kind==='toEnglish')playAudio('visible-french',x.prompt);
    else if(x?.kind==='find')playAudio('visible-french',PASSAGE[x.line]?.fr);
  }
  function finishQuestion(){
    if(state.question+1<state.queue.length){state.question++;resetQuestion();render();practiceEntryAudio();focusTarget('#ft-answer-text');}
    else{state.page='home';state.question=0;resetQuestion();render();}
  }
  function quizLetter(input){
    const x=state.alphabetQuiz[state.alphabetQuestion];if(!x||state.completed)return;
    state.lastInput=String(input??'');
    const correct=state.lastInput.trim().toUpperCase()===x.letter;
    if(!recordAttempt(exactAudit(state.lastInput,x.letter,correct,{ref:'alphabet-'+x.letter,activity:'Alphabet listening',question:'Which letter did you hear? '+x.name,support:state.failed?'small-prompt':'none',marker:'letter-v1',normalize:x=>String(x??'').trim().toUpperCase()})))return;
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
    if(!SAFE_BREAK_PAGES.has(page)&&enforceBreak())return;
    cancelPendingAdvance();patternReview=null;
    if(page==='lesson'){revision=null;startDailyWithSignals(true);return;}
    revision=null;
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
    if(page==='workshop'&&state.builder.showFrench)playAudio('reference-change',assembleWorkshop(state.builder.mode,state.builder.left,state.builder.right).fr);
    if(page==='practice'||page==='review'){practiceEntryAudio();focusTarget('#ft-answer-text');}
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
  function changeTrack(track){if(!validTrack(track)||track===state.track||!state.store)return;if(enforceBreak())return;cancelPendingAdvance();guidedUI.reset();assessmentUI.reset();revision=null;patternReview=null;patternQuery='';session=null;revisionLookup='';state.track=track;try{localStorage.setItem('next-french:track:'+state.profile,track);}catch{}state.page='home';render();}
  async function onClick(e){
    const rest=breakForCourse();
    if(rest){
      const control=e.target.closest('[data-page],[data-eact],[data-gact],[data-act]');
      const safe=control&&(SAFE_BREAK_PAGES.has(control.dataset.page)||['sync','export','export-answers','more-answers','practice-alerts','revision-import','link-google','sign-out','reset-password','preview-french-voice'].includes(control.dataset.act)||control.dataset.eact?.startsWith('range-')||control.dataset.eact==='leave'||control.dataset.gact==='pause');
      const lastStep=finishingLesson(rest)&&(e.target.closest('[data-gword],[data-word],[data-choice-word]')||['next','finish-revealed','finish-model','speak','focus-word'].includes(control?.dataset.gact));
      if(!safe&&!lastStep&&e.target.closest('button,[data-word],[data-gword],[data-choice-word]')){e.preventDefault();showBreak(rest);return;}
    }
    const action=e.target.closest('[data-word-action]');
    if(action){
      if(action.dataset.wordAction==='explore'&&selectedWord)exploreWord(selectedWord.node);
      else if(action.dataset.wordAction==='clear'){const node=selectedWord?.node;clearWordSelection();node?.focus?.({preventScroll:true});}
      return;
    }
    const word=wordTarget(e.target);
    if(word){
      if(suppressedWordClick?.node===word&&Date.now()<suppressedWordClick.until){suppressedWordClick=null;e.preventDefault();return;}
      if(selectWord(word)){if(!revision)pronunciationSignal(word);speak(wordText(word));if(e.detail>0)focusDefaultAdvance();}
      return;
    }
    const assessmentTarget=e.target.closest('[data-eact]');
    if(assessmentTarget?.dataset.eact==='daily'){
      if(state.page==='assessment')await afterSpeech(assessmentTarget,()=>startDailyWithSignals(true));
      else startDailyWithSignals(true);
      return;
    }
    if(['cover','oral-next','oral-difficulty','oral-finish','experiment-next','continue-unit'].includes(assessmentTarget?.dataset.eact)&&state.page==='assessment'){await afterSpeech(assessmentTarget,()=>assessmentUI.click(assessmentTarget));return;}
    if(assessmentTarget&&assessmentUI.click(assessmentTarget)){if(e.detail>0&&assessmentTarget.dataset.eact==='speak')focusDefaultAdvance();return;}
    const guidedTarget=e.target.closest('[data-gword],[data-gact],[data-gchoice],[data-gspeak]');
    if(guidedTarget?.dataset.gact==='next-unit'){if(enforceBreak())return;const unit=guidedTarget.dataset.restUnit;if(unit)assessmentUI.startUnit(unit);else startDailyWithSignals();return;}
    if(guidedTarget&&guidedUI.click(guidedTarget)){if(e.detail>0&&guidedTarget.dataset.gact==='speak')focusDefaultAdvance();return;}
    const b=e.target.closest('[data-act],[data-page],[data-letter],[data-say],[data-word],[data-sound-group],[data-sound-play],[data-sound-compare],[data-sound-sentence],[data-sound-answer],[data-cuddle-word]');
    if(!b)return;
    if(b.dataset.act==='practice-alerts'){await togglePracticeAlerts();return;}
    if(b.dataset.act?.startsWith('track:')){changeTrack(b.dataset.act.slice(6));return;}
    if(b.dataset.page){setPage(b.dataset.page);return;}
    if(b.dataset.letter!==undefined){
      const i=Number(b.dataset.letter);
      if(!Number.isInteger(i)||i<0||i>=ALPHABET.length)return;
      state.lessonIndex=i;render();
      speak(ALPHABET[i].name); // same user tap plays the letter and shows its card
      return;
    }
    if(b.dataset.say!==undefined){speak(PASSAGE[Number(b.dataset.say)].fr);return;}
    // French word controls were handled above, before answer/page actions.
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
      case 'preview-french-voice':speak('Bonjour ! Je parle français. Écoutez bien et répétez avec moi.');break;
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
      case 'revision-import':{
        const rows=revisions();
        const pending=importedWords.filter(w=>!rows.some(x=>x.key===wordKey(w)&&x.dueAt!==null));
        if(pending.every(w=>recordSignal(w,'manual'))){
          importedWords=[];
          try{window.history.replaceState(null,'',window.location.pathname+window.location.search);}catch{}
          render();
        }
        break;
      }
      case 'pattern-audio':{const value=b.dataset.patternAudio;if(value)speak(value);break;}
      case 'pattern-intro':await afterSpeech(b,()=>{
        if(!patternReview||patternReview.result||state.page!=='patterns')return;
        const p=patternReview.items[patternReview.index];if(!p.needsIntro)return;
        if(prioritizedChecks(state.store.getEntries(),Date.now(),state.track).length){startDailyWithSignals();return;}
        if(!recordAttempt({ref:'pattern:intro:'+p.id,activity:'Patterns & grammar · guided recap',question:p.title,answer:null,expected:p.rule,result:'model',reason:'Rule and examples reviewed; no independent recall credit.',support:'worked-example',marker:'pattern-intro-v1',targetLang:'fr',context:{patternId:p.id,patternContentVersion:PATTERN_CONTENT_VERSION,kind:'pattern-intro'},signal:{kind:'pattern-review',patternId:p.id}}))return;
        patternReview.items[patternReview.index]={...p,needsIntro:false,due:false,question:patternIntroQuestion(p.id)};
        patternReview.hint=false;patternReview.guided=true;render();focusTarget('#ft-pattern-answer');
      });break;
      case 'pattern-start':startPatternReview();break;
      case 'pattern-practise':startPatternReview(false,b.dataset.patternId);break;
      case 'pattern-hint':
        if(patternReview&&!patternReview.result){patternReview.draft=el().querySelector('#ft-pattern-answer')?.value||'';patternReview.hint=true;render();focusTarget('#ft-pattern-answer');}break;
      case 'pattern-reveal':submitPattern(el().querySelector('#ft-pattern-answer')?.value||'',true);break;
      case 'pattern-next':await afterSpeech(b,()=>{
        if(!patternReview||!patternReview.result)return;
        if(++patternReview.index>=patternReview.items.length){const auto=patternReview.auto;patternReview=null;if(auto){assessmentUI.startDaily();return;}}
        else Object.assign(patternReview,{result:null,answer:'',hint:false,guided:false,draft:''});
        render();if(patternReview)focusTarget('#ft-pattern-answer,[data-act="pattern-intro"]');
      });break;
      case 'pattern-leave':patternReview=null;cancelPendingAdvance();state.page='patterns';render();break;
      case 'revision-start':startRevision();break;
      case 'revision-hear':if(revision){speak(revision.items[revision.index].word);if(e.detail>0)focusDefaultAdvance();}break;
      case 'revision-listen-help':
      case 'revision-listen-slow':
      case 'revision-listen-chunk':
      case 'revision-listen-english':
      case 'revision-listen-whole':
      case 'revision-listen-rebuild':
      case 'revision-listen-cancel-rebuild':{
        if(!revision||advancePending)break;
        const item=revision.items[revision.index],info=revisionListenInfo(item),steps=listeningSteps(info.fr,info.en,info.context),used=steps.slice(0,revision.level);
        const act=b.dataset.act.slice('revision-listen-'.length);
        if(act==='cancel-rebuild'&&revision.rebuilding){revision.rebuilding=false;render();focusTarget('[data-act="revision-next"]');break;}
        if(act==='rebuild'&&revision.result&&!revision.rebuilding&&!revision.rebuilt){revision.rebuilding=true;render();speak(item.word);focusTarget('#ft-revision-answer');break;}
        if(revision.rebuilding)break;
        if(act==='slow'&&(revision.result||used.includes('slow'))){speak(info.fr,'fr-FR',LISTEN_SLOW_RATE);break;}
        if(act==='whole'&&revision.result){speak(info.fr);break;}
        if(act==='chunk'&&(revision.result||used.includes('chunks'))){const chunk=listeningChunks(info.fr)[Number(b.dataset.listenIndex)];if(chunk)speak(chunk.text,'fr-FR',LISTEN_SLOW_RATE);break;}
        if(act==='english'&&info.en&&(revision.result||used.includes('english-audio'))){speak(info.en,'en-GB');break;}
        if(act!=='help'||revision.result||!steps[revision.level])break;
        const field=el().querySelector('#ft-revision-answer');if(field)revision.draft=field.value;
        const next=steps[revision.level],newLevel=revision.level+1;
        if(next==='reveal'){
          if(!recordAttempt({ref:'revision:review',activity:'Personal '+revisionLabel(item)+' revision',question:'Listen and type the '+revisionLabel(item),answer:revision.draft,expected:item.word,result:'revealed',reason:'French model requested after listening support.',marker:'revision-v1',targetLang:'fr',support:'worked-example',context:{kind:'transcribe',listeningMode:'dictation',listeningHelp:steps.slice(0,newLevel),listeningAssisted:true},signal:{kind:'assisted',mode:'dictation',word:item.word,sentence:item.sentence,english:normaliseAnswer(item.sentence)===normaliseAnswer(item.word)?info.en:item.english,targetKind:item.targetKind,correct:false}}))break;
          revision.level=newLevel;revision.answer=revision.draft;revision.result='revealed';render();speak(item.word);focusTarget('[data-act="revision-next"]');break;
        }
        revision.level=newLevel;render();
        if(next==='slow')speak(item.word,'fr-FR',LISTEN_SLOW_RATE);
        else if(next==='chunks'){const chunk=listeningChunks(item.word)[0];if(chunk)speak(chunk.text,'fr-FR',LISTEN_SLOW_RATE);}
        else if(next==='english-audio')speak(info.en,'en-GB');
        focusTarget('#ft-revision-answer');break;
      }
      case 'revision-next':await afterSpeech(b,()=>{
        if(!revision)return;
        const auto=revision.auto;
        if(++revision.index>=revision.items.length){revision=null;if(auto){updateSession({revisionDone:true});assessmentUI.startDaily();return;}}
        else{Object.assign(revision,{result:null,answer:'',draft:'',level:0,rebuilding:false,rebuilt:false,rebuildFeedback:null});}
        render();if(revision){speak(revision.items[revision.index].word);focusTarget('#ft-revision-answer');}
      });break;
      case 'revision-leave':{const auto=revision?.auto;revision=null;cancelPendingAdvance();if(auto){updateSession({revisionDone:true});assessmentUI.startDaily();}else render();break;}
      case 'sync':await syncNow();if(state.page==='signals'&&!revision&&!wordDialog)render();break;
      case 'more-answers':historyLimit+=50;render();break;
      case 'export-answers':{
        const out=JSON.stringify({learner:state.profile,exportedAt:stamp(),answers:historyRows()},null,2);
        const url=URL.createObjectURL(new Blob([out],{type:'application/json'}));
        const link=document.createElement('a');link.href=url;link.download='next-french-answers-'+state.profile+'.json';link.click();setTimeout(()=>URL.revokeObjectURL(url),3000);break;
      }
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
        if(!recordAttempt({ref:x.id,activity:'Sentence practice',question:x.prompt,answer:state.lastInput,expected:x.answer,result:'revealed',reason:'Model shown, not scored as correct.',support:'worked-example',marker:'unscored'}))break;
        noteAnswer(false,x,true);
        state.answerResult='revealed';state.completed=true;state.feedback='Model revealed: not scored as a correct answer.';render();playAudio('reveal',x.kind==='toEnglish'?x.prompt:x.answer);focusTarget('[data-act="next-question"]');break;
      }
      case 'hear-practice-model':{const x=state.queue[state.question];if(x&&state.completed){speak(x.kind==='toEnglish'?x.prompt:x.answer);if(e.detail>0)focusDefaultAdvance();}break;}
      case 'dictate':dictate();break;
      case 'next-question':await afterSpeech(b,finishQuestion);break;
      case 'restart':state.question=0;resetQuestion();render();practiceEntryAudio();focusTarget('#ft-answer-text');break;
    }
  }
  async function onSubmit(e){
    if(!['ft-revision-add','ft-revision-lookup','ft-login','ft-login-form','ft-reset-form'].includes(e.target.id)&&breakForCourse()){e.preventDefault();enforceBreak();return;}
    if(e.target.id==='ft-pattern-search'){
      e.preventDefault();patternQuery=e.target.querySelector('[name="query"]')?.value||'';render();return;
    }
    if(e.target.id==='ft-pattern-form'){
      e.preventDefault();submitPattern(e.target.querySelector('[name="answer"]')?.value||'');return;
    }
    if(e.target.id==='ft-revision-lookup'){
      e.preventDefault();const value=e.target.querySelector('[name="word"]')?.value.trim();if(value){revisionLookup=value;render();}return;
    }
    if(e.target.id==='ft-revision-add'){
      e.preventDefault();const value=e.target.querySelector('[name="word"]')?.value.trim();
      if(value&&/^[\p{L}\p{M}]+(?:['’\- ][\p{L}\p{M}]+)*$/u.test(value)&&recordSignal(value,'manual'))render();
      return;
    }
    if(e.target.id==='ft-revision-form'){
      e.preventDefault();if(!revision||revision.result&&!revision.rebuilding)return;
      if(revision.auto&&prioritizedChecks(state.store.getEntries(),Date.now(),state.track).length){startDailyWithSignals();return;}
      const value=e.target.querySelector('[name="answer"]')?.value||'',item=revision.items[revision.index];
      if(!value.trim())return;
      const correct=markAnswer(value,item.word),label=revisionLabel(item),info=revisionListenInfo(item),assisted=revision.level>0||revision.rebuilding;
      const help=listeningSteps(info.fr,info.en,info.context).slice(0,revision.level);
      const context={kind:'transcribe',fr:item.word,en:info.en,listeningMode:'dictation',listeningHelp:help,listeningAssisted:assisted,listeningRebuild:revision.rebuilding};
      if(revision.rebuilding){
        if(!recordAttempt(exactAudit(value,item.word,correct,{ref:'revision:rebuild',activity:'Supported listening rebuild',question:'Rebuild the '+label,marker:'listening-rebuild-v1',targetLang:'fr',support:'worked-example',context})))return;
        revision.rebuilding=false;revision.rebuilt=correct;revision.rebuildFeedback={answer:value,correct};render();speak(item.word);focusTarget('[data-act="revision-next"]');return;
      }
      const signal={kind:correct&&assisted?'assisted':'review',mode:'dictation',word:item.word,sentence:item.sentence,english:normaliseAnswer(item.sentence)===normaliseAnswer(item.word)?info.en:item.english,targetKind:item.targetKind,correct,listeningHelp:help};
      if(!recordAttempt({...exactAudit(value,item.word,correct,{ref:'revision:review',activity:'Personal '+label+' revision',question:'Listen and type the '+label,marker:'revision-v1',targetLang:'fr',support:assisted?'small-prompt':'none',context}),signal}))return;
      revision.answer=value;revision.result=correct?'correct':'incorrect';render();speak(item.word);focusTarget('[data-act="revision-next"]');return;
    }
    const input=answerField(e.target.querySelector?.('[name="answer"]'));
    pendingTyping=input?typingSamples.get(input)?.finish(input.value)||[]:[];
    try{
      if(assessmentUI.submit(e.target,e))return;
      if(guidedUI.submit(e.target,e))return;
      if(e.target.id==='ft-answer'){e.preventDefault();const field=e.target.querySelector('input[name="answer"]');if(field)checkAnswer(field.value);return;}
    }finally{pendingTyping=[];}
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
    if(e.target.matches('[data-track]')){changeTrack(e.target.value);return;}
    if(e.target.matches('[data-history-filter]')){historyFilter=e.target.value;historyLimit=50;render();return;}
    if(e.target.matches('[data-french-voice]')){
      preferredVoice=e.target.value;
      try{localStorage.setItem(VOICE_KEY,preferredVoice);}catch{}
      cancelSpeech();return;
    }
    if(e.target.matches('[data-gunit],[data-gverb],[data-workshop-key],[data-target]')&&enforceBreak())return;
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
  // Do not turn an IME/composition confirmation or a held key into a lesson
  // submission. Exact input fields disable browser spelling substitutions.
  const onKeyDown=e=>{
    if(!el().contains(e.target)&&e.target!==document.body&&e.target!==document.documentElement)return;
    if(e.key==='Enter'&&(e.repeat||e.isComposing||e.keyCode===229)){e.preventDefault();return;}
    const node=wordTarget(e.target);
    if(node&&((e.altKey&&e.key==='Enter')||(e.shiftKey&&e.key==='F10')||e.key==='ContextMenu')){
      e.preventDefault();exploreWord(node);return;
    }
    if(e.key!=='Enter'||e.altKey||e.ctrlKey||e.metaKey||e.shiftKey||wordDialog||e.defaultPrevented)return;
    if(e.target.closest?.('input,textarea,select,button,a,[contenteditable],summary,[role="button"]'))return;
    const next=defaultAdvance();
    if(next){e.preventDefault();next.click();}
  };
  const onVoicesChanged=()=>{if(!destroyed&&state.page==='settings')render();};
  window.speechSynthesis?.addEventListener?.('voiceschanged',onVoicesChanged);
  document.addEventListener('keydown',onKeyDown);
  el().addEventListener('focusin',onTypingFocus);
  el().addEventListener('input',onTypingInput);
  el().addEventListener('pointerdown',onWordPointerDown);
  el().addEventListener('pointermove',onWordPointerMove);
  el().addEventListener('pointerup',onWordPointerUp);
  el().addEventListener('pointercancel',cancelWordPress);
  el().addEventListener('contextmenu',onWordContext);
  window.addEventListener('scroll',cancelWordPress,true);
  el().addEventListener('click',onClick);
  el().addEventListener('submit',onSubmit);
  el().addEventListener('change',onChange);
  const onOnline=()=>syncNow();
  const onVisible=()=>{if(document.visibilityState==='visible'){timingTick(true);void syncNow();}else typingSamples=new WeakMap();};
  const timingInterval=setInterval(()=>timingTick(),1000);
  window.addEventListener('online',onOnline);
  document.addEventListener('visibilitychange',onVisible);
  (async()=>{try{state.context=await connect();if(state.context?.auth.currentUser)await attach(state.profile);
    else state.cloudStatus='Not signed in — no cloud sync';}
    catch(e){state.cloudStatus='Firebase unavailable: '+String(e.message||e);}
    finally{state.loading=false;render();}})();
  return {destroy(){
    destroyed=true;clearInterval(timingInterval);if(syncTimer)clearTimeout(syncTimer);
    window.speechSynthesis?.removeEventListener?.('voiceschanged',onVoicesChanged);
    window.removeEventListener('online',onOnline);
    document.removeEventListener('visibilitychange',onVisible);
    document.removeEventListener('keydown',onKeyDown);
    el().removeEventListener('focusin',onTypingFocus);
    el().removeEventListener('input',onTypingInput);
    el().removeEventListener('pointerdown',onWordPointerDown);
    el().removeEventListener('pointermove',onWordPointerMove);
    el().removeEventListener('pointerup',onWordPointerUp);
    el().removeEventListener('pointercancel',cancelWordPress);
    el().removeEventListener('contextmenu',onWordContext);
    window.removeEventListener('scroll',cancelWordPress,true);
    cancelWordPress();clearWordSelection();
    el().removeEventListener('click',onClick);el().removeEventListener('submit',onSubmit);el().removeEventListener('change',onChange);
    if(wordDialog){try{wordDialog.close();}catch{}wordDialog.remove();wordDialog=null;}
    cancelPendingAdvance();
    if(state.coach)Promise.resolve(state.coach.destroy()).catch(()=>{});
  }};
}
