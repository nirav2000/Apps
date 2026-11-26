import {ALL_UNITS,unitsForTrack,lessonRows,guidedStatus} from './guided-lessons.js';
import {STAGES,assessmentStats,baselineFor,pendingChecks,pendingRepairs,repairRef,nextCheckDate,markAssessment,ERROR_TIPS,availableExperiment,experimentStats,experimentDeck,assessmentDeck,teachingFinishedAt,assessmentComparison,checkResult} from './assessment.js';
import {exactAudit} from './answer-history.js';
import {spokenWords,answerComparison,learningAudioText} from './guided-ui.js';
import {firstByRef,ASSESSMENT_DAY as DAY} from '../../learning-evidence/v1/assessment.js';
import {magicTenPhrase} from './magic10.js';
import {trackName} from './curriculum-meta.js';
import {activeRest,prioritizedChecks,restMarkup,scheduledPractice,nextReviewMarkup,reviewStageDetails,reviewUnitTitle,reviewAvailability} from './study-timing.js';
import {containsTarget} from './revision-signals.js';

const h=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const DEFAULT_ACTIONS=new Set(['daily','cover','oral-reveal','oral-next','continue-unit','experiment-next']);
const btn=(action,label,primary=false)=>'<button type="button" data-eact="'+h(action)+'"'+(primary?' class="ft-primary"':'')+(DEFAULT_ACTIONS.has(action)?' data-ft-advance':'')+'>'+h(label)+'</button>';
const pauseButton=()=>'<div class="ft-pause-row"><button type="button" data-eact="leave" class="ft-pause-control">Pause</button></div>';
const pct=m=>m?.percent==null?'—':m.percent+'%';
const n=m=>m?.total?m.correct+' of '+m.total+' correct':'Not measured';
const date=x=>new Date(x).toLocaleDateString('en-GB',{day:'numeric',month:'short'});
const inputs='lang="fr" spellcheck="false" autocorrect="off" autocapitalize="off" autocomplete="off" writingsuggestions="false"';
const labels={accents:'Accents and spelling',connector:'Linking words',negation:'Negation',tense:'Tense choice',chunk:'Phrase construction',unknown:'Not recalled'};
function chart(points){
  const X=i=>40+i*96,Y=v=>148-v*1.22;
  let paths='';
  points.forEach((p,i)=>{
    if(p.percent==null)return;
    if(i&&points[i-1].percent!=null)paths+='<line x1="'+X(i-1)+'" y1="'+Y(points[i-1].percent)+'" x2="'+X(i)+'" y2="'+Y(p.percent)+'" stroke="#39856d" stroke-width="2.8" stroke-linecap="round"/>';
    paths+='<circle cx="'+X(i)+'" cy="'+Y(p.percent)+'" r="4.5" fill="#39856d"><title>'+h(p.label+' · '+pct(p)+' ('+n(p)+')')+'</title></circle>';
  });
  return '<svg class="ft-e-chart" viewBox="0 0 560 190" role="img" aria-label="Observed recall by assessment stage; missing measurements are not plotted">'+
    [0,25,50,75,100].map(v=>'<line x1="40" y1="'+Y(v)+'" x2="540" y2="'+Y(v)+'" stroke="#e7eae7" stroke-dasharray="3 4"/><text x="31" y="'+(Y(v)+4)+'" text-anchor="end" fill="#7b8581" font-size="10">'+v+'%</text>').join('')+
    paths+points.map((p,i)=>'<text x="'+X(i)+'" y="172" fill="#68736e" font-size="10" text-anchor="middle">'+h(['Before','After','D1','D3','D7+','D28+'][i])+'</text>').join('')+'</svg>'+
    '<div class="ft-e-chart-labels">'+points.map((p,i)=>'<span>'+h(['Before','After','Day 1','Day 3','Day 7+','Day 28+'][i])+': <b>'+pct(p)+'</b></span>').join('')+'</div>';
}
function metricCard(label,m){return '<div class="ft-e-metric"><span>'+h(label)+'</span><strong>'+pct(m)+'</strong><small>'+h(n(m))+'</small></div>';}
function bars(rows){return rows.map(m=>'<div class="ft-e-knowledge-row"><div><span>'+h(m.label)+'</span><span class="ft-e-bar-meta">'+(m.secure?'Secure · ':'')+pct(m)+' · '+m.total+' checks</span></div><div class="ft-e-bar"><span class="'+(m.percent==null?'':m.percent>=85?'good':m.percent>=60?'mid':'low')+'" style="width:'+Math.max(0,m.percent||0)+'%"></span></div></div>').join('');}
function extraRecall(entries,now,track){
  const map=firstByRef(entries);
  const items=[];
  for(const u of unitsForTrack(track))for(const s of STAGES.filter(x=>x.id!=='baseline')){
    for(const item of assessmentDeck(u.id,s.id)){
      const repair=map.get(repairRef(item));
      if(!repair||now-repair.at<DAY||map.has(item.ref+':adaptive-recall'))continue;
      // An observed later scheduled check supersedes this practice item.
      if(entries.some(e=>e.concept===item.concept&&e.at>repair.at&&e.source?.ref?.startsWith('assess-v1:')&&e.score?.total>0))continue;
      items.push(u.track?item:{...item,fr:magicTenPhrase(item.verbId,item.id).fr,en:magicTenPhrase(item.verbId,item.id).en});
    }
  }
  return items.sort((a,b)=>map.get(repairRef(a)).at-map.get(repairRef(b)).at);
}
// Single priority policy; separate from the renderer so the sequence can be tested.
export function chooseLearningActivity({rest=null,checks=[],adaptive=null,repair=null,revisionCount=0,patternCount=0,session={},guided=null,baseline=null,oralCount=0,nextReview=null}={}){
  if(rest)return {mode:'break',unitId:rest.unitId,rest,step:'break'};
  if(checks.length){const due=checks[0];return {mode:'check',due,step:due.stage==='immediate'?'after':'recall'};}
  if(adaptive)return {mode:'adaptive',item:adaptive,step:'recall'};
  if(repair)return {mode:'repair',item:repair,step:'revision'};
  // Pattern explanations are optional; never interrupt Continue learning.
  // A paused teaching sequence retains its position, including adaptive inserts.
  if(guided?.mode==='resume')return {mode:'guided',unitId:guided.unit.id,step:'teaching'};
  if(revisionCount>0&&!session.revisionDone)return {mode:'revision',count:Math.min(5,revisionCount),step:'revision'};
  if(session.completedUnit){
    if(!session.oralDone&&oralCount>0)return {mode:'oral',count:Math.min(3,oralCount),step:'oral'};
    return {mode:'complete',hasMore:!!guided,nextReview,step:'complete'};
  }
  if(guided){
    if(baseline)return {mode:'check',due:baseline,step:'teaching'};
    return {mode:'guided',unitId:guided.unit.id,step:'teaching'};
  }
  return {mode:'rest',nextReview,step:'complete'};
}
const LEARNING_SEQUENCE=[
 {id:'recall',name:'Recall previous learning',description:'Independent checks before any revision.'},
 {id:'revision',name:'Personal revision',description:'Revisit difficult words and familiar expressions.'},
 {id:'teaching',name:'Learn something new',description:'Guided teaching, at your own pace.'},
 {id:'break',name:'Let it settle',description:'A five-minute break before checking what you remember.'},
 {id:'after',name:'After teaching check',description:'Recall the new French without help.'},
 {id:'oral',name:'Rapid oral practice',description:'Optional spoken recall of taught material.'}
];
export function sequenceStatus(plan,{checks=[],revisionCount=0,repair=false,adaptive=false,session={}}={}){
 const progress=plan.step==='break'||plan.step==='after'||!!session.completedUnit;
 const finishedBreak=plan.step==='after'||!!session.completedUnit;
 const outcome=(status,legacy)=>{
   if(status==='completed')return {status:'Done this session',kind:'done'};
   if(status==='partial')return {status:'Partly completed',kind:'quiet'};
   if(status==='skipped')return {status:'Skipped',kind:'quiet'};
   if(status==='none-due')return {status:'None due',kind:'quiet'};
   return legacy?{status:'Ended (previous record)',kind:'quiet'}:null;
 };
 return LEARNING_SEQUENCE.map(s=>{
   if(s.id===plan.step)return {...s,status:'Now',kind:'current'};
   if(s.id==='recall'){
     const due=checks.some(c=>c.stage!=='immediate')||adaptive;
     return {...s,...(due?{status:'Due',kind:'next'}:session.recallDone?{status:'Done this session',kind:'done'}:{status:'Up to date',kind:'quiet'})};
   }
   if(s.id==='revision'){
     const result=outcome(session.revisionStatus,session.revisionDone);
     return {...s,...(result?(result.kind==='done'&&revisionCount?{status:'Batch completed',kind:'done'}:result):revisionCount||repair?{status:'When due',kind:'next'}:{status:'None due',kind:'quiet'})};
   }
   if(s.id==='teaching')return {...s,status:progress?'Teaching finished':plan.mode==='rest'?'When available':'Next when ready',kind:progress?'done':'next'};
   if(s.id==='break')return {...s,status:finishedBreak?'Break completed':'After teaching',kind:finishedBreak?'done':'quiet'};
   if(s.id==='after')return {...s,status:session.completedUnit?'Done this session':'After the break',kind:session.completedUnit?'done':'quiet'};
   return {...s,...(outcome(session.oralStatus,session.oralDone)||{status:'Optional',kind:'quiet'})};
 });
}

export function createAssessmentInterface({getEntries,getTrack=()=> 'michaela',record,recordAttempt=()=>true,speak,playAudio=(event,text,lang)=>speak(learningAudioText(event,text),lang),refresh,navigate,startGuided,focusTarget=()=>{},getRevisionItems=()=>[],getPatternItems=()=>[],getNextPatternReview=()=>null,getSession=()=>({}),onRevision=()=>{},onPatterns=()=>{},onCheckComplete=()=>{},onRecallComplete=()=>{},onOralComplete=()=>{},onOralDifficulty=()=>{},onNewSession=()=>{}}){
  let state={mode:null,unitId:null,stage:null,item:null,started:0,feedback:null,range:28,oralIndex:0};
  const entries=()=>getEntries()||[];
  const reset=()=>{state={mode:null,unitId:null,stage:null,item:null,started:0,feedback:null,range:28,oralIndex:0};};
  const pick=(mode,item,extra={})=>{
    state={...state,mode,item,started:Date.now(),feedback:null,submittedAnswer:null,answerResult:null,doneUnit:null,...extra};
    navigate('assessment');
    if(mode==='repair')playAudio('model',item.fr);
    focusTarget(mode==='repair'?'[data-eact="cover"]':mode==='oral'?'[data-eact="oral-reveal"]':mode==='experiment'?(item.arm==='audio'?'[data-eact="experiment-audio"]':'[data-eact="experiment-next"]'):'#ft-e-answer');
  };
  const taughtOralDeck=(preferredUnit=null,limit=Infinity)=>{
    const es=entries(),signals=getRevisionItems(),units=unitsForTrack(getTrack())
      .filter(u=>(!preferredUnit||u.id===preferredUnit)&&teachingFinishedAt(u.id,es)!=null);
    const rows=units.flatMap(u=>(u.incremental?u.blocks:lessonRows(u)).filter(r=>r.id!=='infinitive').map(r=>({...r,unitId:u.id})));
    const distinct=[...new Map(rows.map(r=>[r.fr,r])).values()];
    const priority=r=>signals.reduce((n,x)=>n+(containsTarget(r.fr,x.word)?Number(x.strength||0):0),0);
    return distinct.sort((a,b)=>priority(b)-priority(a)).slice(0,limit);
  };
  const dailyPlan=()=>{
    const es=entries(),now=Date.now(),session=getSession(),rest=activeRest(es,now,null);
    const checks=prioritizedChecks(es,now,getTrack()),adaptive=extraRecall(es,now,getTrack())[0],repair=pendingRepairs(es,now,getTrack())[0];
    const revisionCount=getRevisionItems().length,patternCount=getPatternItems().length;
    const guided=unitsForTrack(getTrack()).map(u=>guidedStatus(u.id,es,now));
    const next=guided.find(x=>x.mode==='resume')||guided.find(x=>x.mode==='new');
    const baseline=next?baselineFor(next.unit.id,es,now):null;
    const nextReview=scheduledPractice(es,now,getTrack()).next;
    const oralCount=session.completedUnit&&!session.oralDone?taughtOralDeck(session.completedUnit,3).length:0;
    const plan=chooseLearningActivity({rest,checks,adaptive,repair,revisionCount,patternCount,session,guided:next,baseline,oralCount,nextReview});
    const unit=unitsForTrack(getTrack()).find(u=>u.id===plan.unitId);
    const details={
      break:['Time to let it settle','Your independent recall is locked until the break ends.'],
      adaptive:['Recall a repaired phrase','Try an earlier correction independently.'],
      repair:['Repair a weak spot',labels[plan.item?.error]||'Rebuild a phrase with help.'],
      revision:['Personal revision',plan.count+' priority words or phrases · short targeted practice'],
      patterns:['Revisit patterns & grammar',plan.count+' short French expressions · spaced review'],
      guided:['Guided teaching',unit?.name||'Continue the selected lesson'],
      oral:['Rapid oral practice','Optional · '+plan.count+' familiar expressions, then finish this session.'],
      complete:['Session complete','You can stop here, or start another session if you want to learn more.'],
      rest:['All caught up','No required learning activity is ready right now.']
    };
    const [label,sub]=plan.mode==='check'?[plan.due.stage==='baseline'?'Quick starting check':plan.due.label+' check',plan.due.unit.name+' · '+(plan.due.items.length-plan.due.attempted.length)+' questions · '+(plan.due.stage==='baseline'?'check what you know before teaching':'recall without hints')]:details[plan.mode];
    return {...plan,label,sub,optionalPatternCount:patternCount,sequence:sequenceStatus(plan,{checks,revisionCount,repair:!!repair,adaptive:!!adaptive,session})};
  };
  const startDaily=()=>{
    const plan=dailyPlan();
    if(plan.mode==='check'){
      const d=plan.due,item=d.items.find(x=>!x.row);
      pick('check',item,{unitId:d.unitId,stage:d.stage,anchor:d.anchor});
    }else if(plan.mode==='guided'||plan.mode==='break')startGuided(plan.unitId);
    else if(plan.mode==='repair'||plan.mode==='adaptive')pick(plan.mode,plan.item);
    else if(plan.mode==='revision')onRevision();
    else if(plan.mode==='oral')startOral(true);
    else if(plan.mode==='complete'&&plan.hasMore){onNewSession();startDaily();}
    else navigate('evidence');
  };
  const startUnit=unitId=>{
    const es=entries(),rest=activeRest(es,Date.now(),null);
    if(rest){startGuided(rest.unitId);return;}
    if(!unitsForTrack(getTrack()).some(u=>u.id===unitId))return;
    const checks=prioritizedChecks(es,Date.now(),getTrack());
    const due=checks.find(d=>d.unitId===unitId)||baselineFor(unitId,es);
    if(due){pick('check',due.items.find(x=>!x.row),{unitId,stage:due.stage,anchor:due.anchor});return;}
    startGuided(unitId);
  };
  const overview=()=>{
    const plan=dailyPlan(),done=plan.mode==='complete'||plan.mode==='rest';
    const label=done?(plan.hasMore?'Start another learning session':'View learning dashboard'):'Continue learning';
    const action=plan.mode==='break'?'<button type="button" class="ft-primary" data-eact="daily" data-ft-advance data-rest-continue disabled aria-disabled="true">Continue when the break finishes</button>':btn('daily',label,true);
    return '<section class="ft-card ft-e-today ft-unified-path" data-learning-mode="'+h(plan.mode)+'"><div class="ft-path-header"><p class="ft-eyebrow">YOUR PERSONALISED LEARNING PATH</p><h2>Today’s learning</h2><p class="ft-small">'+h(trackName(getTrack()))+' · Follow the recommended next step.</p></div>'+
      '<div class="ft-path-next"><p class="ft-eyebrow">'+(done?(plan.mode==='complete'?'SESSION FINISHED':'YOU’RE UP TO DATE'):'YOUR NEXT ACTIVITY')+'</p><h3>'+h(plan.label)+'</h3><p>'+h(plan.sub)+'</p>'+(plan.rest?restMarkup(plan.rest):'')+(done?(nextReviewMarkup(plan.nextReview)||'<p class="ft-no-review">No further lesson review scheduled.</p>'):'')+'<div class="ft-path-action">'+action+'</div></div>'+
      '<h3 class="ft-path-sequence-heading">Your learning sequence</h3><ol class="ft-path-sequence">'+plan.sequence.map((row,i)=>'<li class="ft-path-row '+h(row.kind)+'"'+(row.kind==='current'?' aria-current="step"':'')+'><span class="ft-path-number">'+(row.kind==='done'?'✓':i+1)+'</span><div><strong>'+h(row.name)+'</strong><small>'+h(row.description)+'</small></div><span class="ft-path-status">'+h(row.status)+'</span></li>').join('')+'</ol><p class="ft-small ft-path-footer">The app chooses the order. You do not need to work through these sections manually.</p>'+
      (getTrack()==='unlocking'&&!['break','check'].includes(plan.mode)&&plan.optionalPatternCount?'<div class="ft-pattern-optional"><span><strong>Optional: patterns &amp; grammar</strong><small>'+plan.optionalPatternCount+' ready to revisit</small></span><button type="button" data-page="patterns">View</button></div>':'')+'</section>';
  };
  const dashboard=()=>{
    const es=entries(),s=assessmentStats(es,Date.now(),state.range,getTrack()),exp=experimentStats(es);
    const next=scheduledPractice(es,Date.now(),getTrack()).next,due=prioritizedChecks(es,Date.now(),getTrack()).length,repair=pendingRepairs(es,Date.now(),getTrack()).length;
    return '<section class="ft-card ft-e-dashboard"><div class="ft-e-header"><div><p class="ft-eyebrow">LEARNING EVIDENCE · V1</p><h2>French learning effectiveness</h2><p class="ft-small">'+h(trackName(getTrack()))+'</p></div><div class="ft-e-period" aria-label="Dashboard time period">'+[28,36500].map(d=>'<button type="button" data-eact="range-'+d+'" aria-pressed="'+(state.range===d)+'">'+(d===28?'28 days':'All time')+'</button>').join('')+'</div></div>'+
      '<div class="ft-e-metrics">'+metricCard('Practice accuracy',s.practice)+metricCard('Independent accuracy',s.independent)+metricCard('7-day retention',s.retention)+metricCard('Unseen transfer',s.transfer)+'</div>'+(getTrack()!=='michaela'?'<div class="ft-e-metrics ft-e-two">'+metricCard('Application in new contexts',s.application)+'</div>':'')+
      '<div class="ft-e-section"><h3>Knowledge retained over time</h3><p class="ft-small">Observed recall, not predictions. Different completed units may contribute to each point.</p>'+chart(s.chart)+'</div>'+
      '<div class="ft-e-details"><div><span>28-day recall</span><strong>'+pct(s.day28)+'</strong><small>'+h(n(s.day28))+'</small></div><div><span>7-day unseen transfer</span><strong>'+pct(s.sevenUnseen)+'</strong><small>'+h(n(s.sevenUnseen))+'</small></div><div><span>Median response time</span><strong>'+(s.medianMs==null?'—':(s.medianMs/1000).toFixed(1)+'s')+'</strong><small>Typed answer time, not spoken fluency</small></div><div><span>Baseline to day 7</span><strong>'+(s.gain==null?'—':(s.gain>0?'+':'')+s.gain+' pp')+'</strong><small>'+s.gainPairs+' paired checks</small></div></div>'+
      '<div class="ft-e-section"><h3>Automatic diagnosis</h3>'+s.tips.map(t=>'<p class="ft-e-diagnosis">'+h(t)+'</p>').join('')+'<p class="ft-small">'+due+' check'+(due===1?'':'s')+' due · '+repair+' targeted repair'+(repair===1?'':'s')+' · '+(next?'Next review: '+h(reviewUnitTitle(next,next.track))+' · '+h(reviewStageDetails(next.stage).title)+' · '+h(reviewAvailability(next.at)):'No future review scheduled')+(s.gapDays==null?'':' · Average recorded practice gap before 7-day recall: '+s.gapDays+' days')+'.</p>'+''+'</div></section>'+
      '<section class="ft-card ft-e-dashboard"><h2>Language mastery</h2><p class="ft-small">Independent checks by '+(getTrack()==='michaela'?'reusable structure':'lesson topic')+'. Secure requires repeated success, delayed recall and transfer. A dash means not measured.</p>'+bars(s.knowledge)+
      '<details><summary>Assessment coverage</summary><div class="ft-e-coverage">'+unitsForTrack(getTrack()).map(u=>'<div><strong>'+h(u.name)+'</strong>'+STAGES.map(t=>{const c=s.checks.find(x=>x.unitId===u.id&&x.stage===t.id);return '<span>'+h(t.label)+': '+c.attempted.length+'/'+c.items.length+'</span>';}).join('')+'</div>').join('')+'</div></details></section>'+
      (getTrack()==='michaela'?'<section class="ft-card ft-e-dashboard"><h2>Learning experiments</h2><p>Written versus audio model · exploratory comparison.</p><div class="ft-e-metrics ft-e-two">'+metricCard('Written model',exp.left)+metricCard('Audio model',exp.right)+'</div><p class="ft-small">'+(exp.sufficient?'Exploratory difference: '+exp.difference+' percentage points.':'Insufficient paired results for a comparison.')+' Baseline: written '+pct(exp.baselineA)+', audio '+pct(exp.baselineB)+'. Small observational pilot, not proof one method is better. No teaching method is promoted automatically.</p></section>':'');
  };
  const comparison=item=>answerComparison({answer:state.submittedAnswer??'',expected:item.fr,result:state.answerResult,replay:'<button type="button" data-eact="speak" aria-label="Hear the correct French again">▶</button>'});
  const question=()=>{
    const item=state.item;
    if(!item)return '<section class="ft-card"><h2>Ready for your next step?</h2>'+btn('daily','Continue learning',true)+'</section>';
    if(state.mode==='check'||state.mode==='adaptive'){
      const baseline=state.stage==='baseline'&&state.mode==='check';
      const title=state.mode==='adaptive'?'Adaptive retrieval practice':STAGES.find(x=>x.id===state.stage)?.label+' check';
      const deck=state.mode==='check'?assessmentDeck(state.unitId,state.stage):[];
      const progress=state.mode==='check'?deck.filter(x=>firstByRef(entries()).has(x.ref)).length:null;
      return '<section class="ft-card ft-e-question"><p class="ft-eyebrow">'+h(title)+(progress==null?'':' · '+Math.min(progress+1,deck.length)+'/'+deck.length)+'</p><h2>Answer in French</h2><p class="ft-e-prompt">'+h(item.en)+'</p>'+
        '<p class="ft-small">'+(baseline?'This checks what you already know; it is not a grade.':state.mode==='adaptive'?'Recall the repaired phrase without a model.':'First answer only. No hints, dictionary or corrections until the check is finished.')+'</p>'+
        '<form id="ft-e-form"><label for="ft-e-answer">Your French</label><input id="ft-e-answer" name="answer" '+inputs+' required><div class="ft-actions"><button type="submit" class="ft-primary">Submit answer</button>'+btn('unknown',"I don't know")+'</div></form>'+((baseline&&ALL_UNITS.find(u=>u.id===state.unitId)?.incremental)?btn('skip-baseline','Start teaching without a baseline'):'')+pauseButton()+'</section>';
    }
    if(state.mode==='repair'){
      return '<section class="ft-card ft-e-question"><p class="ft-eyebrow">TARGETED REPAIR</p><h2>'+h(labels[item.error]||'Phrase construction')+'</h2><p>'+h(ERROR_TIPS[item.error]||ERROR_TIPS.chunk)+'</p><p class="ft-e-prompt">'+h(item.en)+'</p>'+
        (state.feedback==='cover'?'<form id="ft-e-form"><label for="ft-e-answer">Now rebuild without the model</label><input id="ft-e-answer" name="answer" '+inputs+' required><button type="submit" class="ft-primary">Check</button></form>'+btn('model','Show model again'):
          state.feedback==='correct'?comparison(item)+'<p role="status">Correct. Compare your answer with the model. Another unaided practice is due tomorrow.</p>'+btn('daily','Continue',true):
          (state.feedback==='wrong'?comparison(item)+'<p role="status">Not quite. Compare the highlighted words, then try again.</p>':'<p class="ft-e-prompt" lang="fr">'+spokenWords(item.fr)+'</p>')+'<div class="ft-actions">'+btn('speak','▶ Listen and repeat')+btn('cover','Cover and reconstruct',true)+'</div>')+pauseButton()+'</section>';
    }
    if(state.mode==='experiment'){
      return '<section class="ft-card ft-e-question"><p class="ft-eyebrow">OPTIONAL TEACHING EXPERIMENT</p><h2>'+h(item.arm==='audio'?'Listen to the model':'Read the model')+'</h2><p class="ft-e-prompt">'+h(item.en)+'</p>'+
      (item.arm==='audio'?btn('experiment-audio','▶ Play French model',true):'<p class="ft-e-prompt" lang="fr">'+h(item.fr)+'</p>')+
      '<p class="ft-small">Repeat the phrase once. Do not look it up. The next regular assessment measures later recall.</p>'+btn('experiment-next','I have repeated it',true)+pauseButton()+'</section>';
    }
    if(state.mode==='oral'){
      return '<section class="ft-card ft-e-question"><p class="ft-eyebrow">RAPID ORAL PRACTICE · '+(state.oralIndex+1)+'/'+state.oralDeck.length+'</p><h2>Say it in French</h2><p class="ft-e-prompt">'+h(item.en)+'</p>'+
      (state.feedback==='spoken'?'<p class="ft-e-prompt" lang="fr">'+spokenWords(item.fr)+'</p>'+btn('speak','▶ Hear again')+btn('oral-next',state.oralIndex+1===state.oralDeck.length?'Finish oral practice':'Got it · next',true)+btn('oral-difficulty','Needed help'):btn('oral-reveal','Reveal and hear',true))+
      '<p class="ft-small">Say your answer before revealing it. Self-check only; this is not an acoustic pronunciation score.</p>'+'<div class="ft-pause-row">'+btn('oral-finish',state.autoOral?'Skip oral practice':'Finish')+'</div></section>';
    }
    return '<section class="ft-card ft-e-question"><h2>'+(state.answerResult?'Practice complete':'Check complete')+'</h2>'+
      (state.answerResult?'<p class="ft-e-prompt">'+h(item.en)+'</p>'+comparison(item):'')+
      '<p>'+h(state.feedback||'Check complete.')+'</p>'+(state.doneUnit?btn('continue-unit','Start this lesson',true):btn('daily','Continue learning',true))+' <button data-page="evidence">See dashboard</button> <button data-page="history">Review answers</button></section>';
  };
  const logAnswer=(value,item,r,ref,group='',support='none')=>{
    const compared=assessmentComparison(value,item);
    const audit=exactAudit(value,item.fr,r.correct,{ref,activity:(ALL_UNITS.find(u=>u.id===item.unitId)?.name||'French')+' · '+(STAGES.find(s=>s.id===state.stage)?.label||state.mode),question:item.en,support,checkGroup:group,targetLang:'fr',context:{unitId:item.unitId||state.unitId||'',stage:state.stage||state.mode,kind:'write',structure:item.id||'',fr:item.fr,en:item.en},
      normalize:x=>assessmentComparison(x,item).got,marker:'assessment-v1',reason:r.error?'Recorded category: '+r.error+'.':''});
    audit.accepted=compared.variants;
    return recordAttempt(audit);
  };
  const finishAnswer=value=>{
    const item=state.item;if(!item)return;
    const rest=activeRest(entries(),Date.now(),null);if(rest){startGuided(rest.unitId);return;}
    if(state.mode==='repair'){
      if(state.feedback!=='cover')return;
      const r=markAssessment(value,item);
      if(!logAnswer(value,item,r,repairRef(item),'','worked-example'))return;
      if(r.correct){
        if(!firstByRef(entries()).has(repairRef(item)))record({concept:item.concept,phase:'practice',support:'worked-example',sourceRef:repairRef(item)});
        state.feedback='correct';
      }else state.feedback='wrong';
      state.submittedAnswer=value;state.answerResult=r.correct?'correct':'incorrect';
      refresh();playAudio('correction',item.fr);
      focusTarget(r.correct?'[data-eact="daily"]':'[data-eact="cover"]');return;
    }
    if(!['check','adaptive'].includes(state.mode))return;
    const es=entries(),map=firstByRef(es),adaptive=state.mode==='adaptive',sourceRef=adaptive?item.ref+':adaptive-recall':item.ref;
    if(map.has(sourceRef)){startDaily();return;}
    // Do not allow a stale page to claim a check in the wrong time window.
    if(!adaptive){
      const valid=state.stage==='baseline'?baselineFor(state.unitId,es):prioritizedChecks(es,Date.now(),getTrack()).find(x=>x.unitId===state.unitId&&x.stage===state.stage);
      if(!valid){startDaily();return;}
    }
    const result=markAssessment(value,item);
    if(!logAnswer(value,item,result,sourceRef,adaptive?'':item.ref.split(':').slice(0,3).join(':')))return;
    const stage=state.stage,phase=adaptive?'practice':stage==='baseline'?'diagnostic':item.kind==='transfer'?'transfer':stage==='immediate'?'practice':'retrieval';
    record({concept:item.concept,phase,support:'none',novel:phase==='transfer',correctCount:result.correct?1:0,total:1,
      taughtAt:state.anchor||undefined,durationMs:Math.max(1,Math.min(Date.now()-state.started,120001)),sourceRef});
    if(result.error&&!adaptive)record({concept:item.concept,phase:'practice',support:'unknown',sourceRef:sourceRef+':error:'+result.error});
    if(adaptive){
      state.mode='done';state.submittedAnswer=value;state.answerResult=result.correct?'correct':value.trim()?'incorrect':'revealed';
      state.feedback=result.correct?'Correct. Your repaired phrase was recalled independently.':'Not recalled yet. Compare the model and try again at the next scheduled check.';refresh();playAudio('correction',item.fr);focusTarget('[data-eact="daily"]');return;
    }
    const current=stage==='baseline'?baselineFor(state.unitId,entries()):prioritizedChecks(entries(),Date.now(),getTrack()).find(x=>x.unitId===state.unitId&&x.stage===stage);
    if(current){pick('check',current.items.find(x=>!x.row),{unitId:current.unitId,stage,anchor:current.anchor});return;}
    if(checkResult(state.unitId,stage,entries()).complete){
      if(stage==='immediate')onCheckComplete(state.unitId);
      else if(stage!=='baseline')onRecallComplete(state.unitId,stage);
    }
    state.mode='done';state.doneUnit=stage==='baseline'?state.unitId:null;state.feedback=stage==='baseline'?'Starting knowledge recorded. Now learn the phrases.':'Check complete. Continue learning to follow the recommended next step.';refresh();focusTarget(state.doneUnit?'[data-eact="continue-unit"]':'[data-eact="daily"]');
  };
  const startExperiment=()=>{
    const x=getTrack()==='michaela'?availableExperiment(entries()):null;
    if(!x){state.mode='done';state.doneUnit=null;state.item={};state.feedback='The experiment becomes available after a full baseline and immediate check, on the day teaching finishes.';navigate('assessment');return;}
    const next=x.deck.find(i=>!firstByRef(entries()).has(i.ref));
    pick('experiment',next,{unitId:x.unit.id,anchor:x.anchor,played:false});
  };
  const finishOral=(completed=false)=>{const auto=state.autoOral,status=completed?'completed':state.oralIndex>0||state.feedback==='spoken'?'partial':'skipped';state.mode=null;if(auto)onOralComplete(status);navigate(auto?'home':'explore');};
  const startOral=(auto=false)=>{
    if(auto&&prioritizedChecks(entries(),Date.now(),getTrack()).length){startDaily();return;}
    const deck=taughtOralDeck(auto?getSession().completedUnit:null,auto?3:12);
    if(!deck.length){state.mode='done';state.doneUnit=null;state.item={};state.feedback='Oral practice unlocks after you have completed some teaching. Use Today to learn first.';navigate('assessment');return;}
    pick('oral',deck[0],{oralIndex:0,oralDeck:deck,autoOral:auto,stage:null});
  };
  const oralNext=(difficulty=false)=>{
    if(state.mode!=='oral'||state.feedback!=='spoken')return;
    if(difficulty)onOralDifficulty(state.item);
    const index=state.oralIndex+1;
    if(index>=state.oralDeck.length){finishOral(true);return;}
    pick('oral',state.oralDeck[index],{oralIndex:index});
  };
  const click=target=>{
    const a=target.dataset.eact;if(!a)return false;
    if(a.startsWith('unit:')){startUnit(a.slice(5));return true;}
    if(a.startsWith('range-')){state.range=Number(a.slice(6))===36500?36500:28;refresh();return true;}
    const rest=activeRest(entries(),Date.now(),null);if(rest&&a!=='leave'){startGuided(rest.unitId);return true;}
    if(state.mode==='oral'&&state.autoOral&&['oral-reveal','oral-next','oral-difficulty'].includes(a)&&prioritizedChecks(entries(),Date.now(),getTrack()).length){startDaily();return true;}
    switch(a){
      case 'daily':startDaily();break;
      case 'skip-baseline':if(state.mode==='check'&&state.stage==='baseline'&&ALL_UNITS.find(u=>u.id===state.unitId)?.incremental)startGuided(state.unitId);break;
      case 'continue-unit':if(state.doneUnit)startUnit(state.doneUnit);break;
      case 'leave':state.mode=null;navigate('home');break;
      case 'unknown':finishAnswer('');break;
      case 'speak':if(state.item?.fr)speak(state.item.fr);break;
      case 'cover':state.feedback='cover';state.submittedAnswer=null;state.answerResult=null;refresh();focusTarget('#ft-e-answer');break;
      case 'model':state.feedback=null;state.submittedAnswer=null;state.answerResult=null;refresh();playAudio('reveal',state.item.fr);focusTarget('[data-eact="cover"]');break;
      case 'experiment':startExperiment();break;
      case 'experiment-audio':state.played=true;speak(state.item.fr);break;
      case 'experiment-next':{
        if(state.mode!=='experiment')break;
        if(state.item.arm==='audio'&&!state.played){speak(state.item.fr);state.played=true;break;}
        const x=availableExperiment(entries());
        if(!x){startExperiment();break;}
        if(!firstByRef(entries()).has(state.item.ref))record({concept:state.item.concept,phase:'practice',support:'worked-example',durationMs:Date.now()-state.started,sourceRef:state.item.ref});
        startExperiment();break;
      }
      case 'oral':startOral(false);break;
      case 'oral-reveal':{
        if(state.mode!=='oral'||state.feedback==='spoken')break;
        const item=state.item,sourceRef='oral-practice:'+item.unitId+':'+Date.now()+':'+state.oralIndex+':exposure';
        record({concept:item.concept,phase:'practice',support:'worked-example',sourceRef});
        state.feedback='spoken';refresh();playAudio('reveal',item.fr);focusTarget('[data-eact="oral-next"]');break;
      }
      case 'oral-next':oralNext();break;
      case 'oral-difficulty':oralNext(true);break;
      case 'oral-finish':finishOral();break;
      default:return false;
    }
    return true;
  };
  const submit=(form,event)=>{
    if(form.id!=='ft-e-form')return false;
    event.preventDefault();const value=form.querySelector('[name="answer"]')?.value||'';
    if(value.trim())finishAnswer(value);return true;
  };
  return {overview,dashboard,page:question,click,submit,reset,startDaily,startUnit,dailyPlan};
}
