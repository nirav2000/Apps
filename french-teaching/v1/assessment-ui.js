import {ALL_UNITS,unitsForTrack,lessonRows,guidedStatus} from './guided-lessons.js';
import {STAGES,assessmentStats,baselineFor,pendingChecks,pendingRepairs,repairRef,nextCheckDate,markAssessment,ERROR_TIPS,availableExperiment,experimentStats,experimentDeck,assessmentDeck,teachingFinishedAt,assessmentComparison} from './assessment.js';
import {exactAudit} from './answer-history.js';
import {spokenWords} from './guided-ui.js';
import {firstByRef,ASSESSMENT_DAY as DAY} from '../../learning-evidence/v1/assessment.js';
import {magicTenPhrase} from './magic10.js';
import {trackName} from './curriculum-meta.js';

const h=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const btn=(action,label,primary=false)=>'<button type="button" data-eact="'+h(action)+'"'+(primary?' class="ft-primary"':'')+'>'+h(label)+'</button>';
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
export function createAssessmentInterface({getEntries,getTrack=()=> 'michaela',record,recordAttempt=()=>true,speak,refresh,navigate,startGuided,focusTarget=()=>{}}){
  let state={mode:null,unitId:null,stage:null,item:null,started:0,feedback:null,range:28,oralIndex:0};
  const entries=()=>getEntries()||[];
  const reset=()=>{state={mode:null,unitId:null,stage:null,item:null,started:0,feedback:null,range:28,oralIndex:0};};
  const pick=(mode,item,extra={})=>{
    state={...state,mode,item,started:Date.now(),feedback:null,doneUnit:null,...extra};
    navigate('assessment');focusTarget('#ft-e-answer');
  };
  const dailyPlan=()=>{
    const es=entries(),now=Date.now(),due=pendingChecks(es,now,getTrack())[0];
    if(due)return {mode:'check',due,label:due.label+' check',sub:due.unit.name+' · '+(due.items.length-due.attempted.length)+' questions'};
    const adaptive=extraRecall(es,now,getTrack())[0];
    if(adaptive)return {mode:'adaptive',item:adaptive,label:'Recall a repaired phrase',sub:'Short unaided practice after a day'};
    const repair=pendingRepairs(es,now,getTrack())[0];
    if(repair)return {mode:'repair',item:repair,label:'Repair a weak spot',sub:labels[repair.error]||'Phrase construction'};
    const guided=unitsForTrack(getTrack()).map(u=>guidedStatus(u.id,es,now));
    const next=guided.find(x=>x.mode==='resume')||guided.find(x=>x.mode==='new');
    if(next){
      const baseline=baselineFor(next.unit.id,es,now);
      if(baseline)return {mode:'check',due:baseline,label:'Quick starting check',sub:next.unit.name+' · '+(baseline.items.length-baseline.attempted.length)+' questions'};
      return {mode:'guided',unitId:next.unit.id,label:'Continue guided lesson',sub:next.unit.name};
    }
    return {mode:'rest',label:'All scheduled checks up to date',sub:'Next review '+(nextCheckDate(es,now,getTrack())?date(nextCheckDate(es,now,getTrack())):'not scheduled')};
  };
  const startDaily=()=>{
    const plan=dailyPlan();
    if(plan.mode==='check'){
      const d=plan.due,item=d.items.find(x=>!x.row);
      pick('check',item,{unitId:d.unitId,stage:d.stage,anchor:d.anchor});
    }else if(plan.mode==='guided')startGuided(plan.unitId);
    else if(plan.mode==='repair'||plan.mode==='adaptive')pick(plan.mode,plan.item);
    else navigate('evidence');
  };
  const startUnit=unitId=>{
    if(!unitsForTrack(getTrack()).some(u=>u.id===unitId))return;
    const es=entries(),due=pendingChecks(es,Date.now(),getTrack()).find(d=>d.unitId===unitId)||baselineFor(unitId,es);
    if(due){pick('check',due.items.find(x=>!x.row),{unitId,stage:due.stage,anchor:due.anchor});return;}
    startGuided(unitId);
  };
  const overview=()=>{
    const plan=dailyPlan();
    return '<section class="ft-card ft-e-today"><div><p class="ft-eyebrow">YOUR PERSONALISED LEARNING PATH</p><h2>'+h(plan.label)+'</h2><p>'+h(plan.sub)+'</p></div>'+
      '<div class="ft-actions">'+btn('daily',"Start today's learning",true)+'<button type="button" data-page="evidence">Learning dashboard</button></div></section>';
  };
  const dashboard=()=>{
    const es=entries(),s=assessmentStats(es,Date.now(),state.range,getTrack()),exp=experimentStats(es);
    const next=nextCheckDate(es,Date.now(),getTrack()),due=pendingChecks(es,Date.now(),getTrack()).length,repair=pendingRepairs(es,Date.now(),getTrack()).length;
    return '<section class="ft-card ft-e-dashboard"><div class="ft-e-header"><div><p class="ft-eyebrow">LEARNING EVIDENCE · V1</p><h2>French learning effectiveness</h2><p class="ft-small">'+h(trackName(getTrack()))+'</p></div><div class="ft-e-period" aria-label="Dashboard time period">'+[28,36500].map(d=>'<button type="button" data-eact="range-'+d+'" aria-pressed="'+(state.range===d)+'">'+(d===28?'28 days':'All time')+'</button>').join('')+'</div></div>'+
      '<div class="ft-e-metrics">'+metricCard('Practice accuracy',s.practice)+metricCard('Independent accuracy',s.independent)+metricCard('7-day retention',s.retention)+metricCard('Unseen transfer',s.transfer)+'</div>'+(getTrack()!=='michaela'?'<div class="ft-e-metrics ft-e-two">'+metricCard('Application in new contexts',s.application)+'</div>':'')+
      '<div class="ft-e-section"><h3>Knowledge retained over time</h3><p class="ft-small">Observed recall, not predictions. Different completed units may contribute to each point.</p>'+chart(s.chart)+'</div>'+
      '<div class="ft-e-details"><div><span>28-day recall</span><strong>'+pct(s.day28)+'</strong><small>'+h(n(s.day28))+'</small></div><div><span>7-day unseen transfer</span><strong>'+pct(s.sevenUnseen)+'</strong><small>'+h(n(s.sevenUnseen))+'</small></div><div><span>Median response time</span><strong>'+(s.medianMs==null?'—':(s.medianMs/1000).toFixed(1)+'s')+'</strong><small>Typed answer time, not spoken fluency</small></div><div><span>Baseline to day 7</span><strong>'+(s.gain==null?'—':(s.gain>0?'+':'')+s.gain+' pp')+'</strong><small>'+s.gainPairs+' paired checks</small></div></div>'+
      '<div class="ft-e-section"><h3>Automatic diagnosis</h3>'+s.tips.map(t=>'<p class="ft-e-diagnosis">'+h(t)+'</p>').join('')+'<p class="ft-small">'+due+' check'+(due===1?'':'s')+' due · '+repair+' targeted repair'+(repair===1?'':'s')+' · '+(next?'Next review '+date(next):'No future review scheduled')+(s.gapDays==null?'':' · Average recorded practice gap before 7-day recall: '+s.gapDays+' days')+'.</p>'+btn('daily',"Start today's learning",true)+'</div></section>'+
      '<section class="ft-card ft-e-dashboard"><h2>Language mastery</h2><p class="ft-small">Independent checks by '+(getTrack()==='michaela'?'reusable structure':'lesson topic')+'. Secure requires repeated success, delayed recall and transfer. A dash means not measured.</p>'+bars(s.knowledge)+
      '<details><summary>Assessment coverage</summary><div class="ft-e-coverage">'+unitsForTrack(getTrack()).map(u=>'<div><strong>'+h(u.name)+'</strong>'+STAGES.map(t=>{const c=s.checks.find(x=>x.unitId===u.id&&x.stage===t.id);return '<span>'+h(t.label)+': '+c.attempted.length+'/'+c.items.length+'</span>';}).join('')+'</div>').join('')+'</div></details></section>'+
      (getTrack()!=='michaela'?'<section class="ft-card"><h2>Rapid oral practice</h2><p>Retrieve the expressions in this track and self-check against spoken French.</p>'+btn('oral','Rapid oral practice')+'</section>':'<section class="ft-card ft-e-dashboard"><h2>Learning experiments</h2><p>Compare one extra written model with one extra audio model, within comparable structures. Review both after seven days.</p><div class="ft-e-metrics ft-e-two">'+metricCard('Written model',exp.left)+metricCard('Audio model',exp.right)+'</div><p class="ft-small">'+(exp.sufficient?'Exploratory difference: '+exp.difference+' percentage points.':'Insufficient paired results for a comparison.')+' Baseline: written '+pct(exp.baselineA)+', audio '+pct(exp.baselineB)+'. Median exposure: '+(exp.timeA==null?'—':Math.round(exp.timeA/1000)+'s')+' / '+(exp.timeB==null?'—':Math.round(exp.timeB/1000)+'s')+'. Small observational pilot, not proof one method is better. No teaching method is promoted automatically.</p>'+btn('experiment','Open teaching experiment')+btn('oral','Rapid oral practice')+'</section>');
  };
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
        '<form id="ft-e-form"><label for="ft-e-answer">Your French</label><input id="ft-e-answer" name="answer" '+inputs+' required><div class="ft-actions"><button type="submit" class="ft-primary">Submit answer</button>'+btn('unknown',"I don't know")+'</div></form>'+((baseline&&ALL_UNITS.find(u=>u.id===state.unitId)?.incremental)?btn('skip-baseline','Start teaching without a baseline'):'')+btn('leave','Pause')+'</section>';
    }
    if(state.mode==='repair'){
      return '<section class="ft-card ft-e-question"><p class="ft-eyebrow">TARGETED REPAIR</p><h2>'+h(labels[item.error]||'Phrase construction')+'</h2><p>'+h(ERROR_TIPS[item.error]||ERROR_TIPS.chunk)+'</p><p class="ft-e-prompt">'+h(item.en)+'</p>'+
        (state.feedback==='cover'?'<form id="ft-e-form"><label for="ft-e-answer">Now rebuild without the model</label><input id="ft-e-answer" name="answer" '+inputs+' required><button type="submit" class="ft-primary">Check</button></form>'+btn('model','Show model again'):
          state.feedback==='correct'?'<p role="status">Correct. This is practice, not retention. Another unaided practice is due tomorrow.</p>'+btn('daily','Continue',true):
          '<p class="ft-e-prompt" lang="fr">'+spokenWords(item.fr)+'</p>'+(state.feedback==='wrong'?'<p role="status">Not yet. Listen and try the covered phrase again.</p>':'')+'<div class="ft-actions">'+btn('speak','▶ Listen and repeat')+btn('cover','Cover and reconstruct',true)+'</div>')+btn('leave','Pause')+'</section>';
    }
    if(state.mode==='experiment'){
      return '<section class="ft-card ft-e-question"><p class="ft-eyebrow">OPTIONAL TEACHING EXPERIMENT</p><h2>'+h(item.arm==='audio'?'Listen to the model':'Read the model')+'</h2><p class="ft-e-prompt">'+h(item.en)+'</p>'+
      (item.arm==='audio'?btn('experiment-audio','▶ Play French model',true):'<p class="ft-e-prompt" lang="fr">'+h(item.fr)+'</p>')+
      '<p class="ft-small">Repeat the phrase once. Do not look it up. The next regular assessment measures later recall.</p>'+btn('experiment-next','I have repeated it',true)+btn('leave','Pause')+'</section>';
    }
    if(state.mode==='oral'){
      return '<section class="ft-card ft-e-question"><p class="ft-eyebrow">RAPID ORAL PRACTICE · '+(state.oralIndex+1)+'</p><h2>Say it in French</h2><p class="ft-e-prompt">'+h(item.en)+'</p>'+
      (state.feedback==='spoken'?'<p class="ft-e-prompt" lang="fr">'+spokenWords(item.fr)+'</p>'+btn('speak','▶ Hear again')+btn('oral-next','Next phrase',true):btn('oral-reveal','Reveal and hear',true))+
      '<p class="ft-small">Say your answer before revealing it. Self-check only; this is not an acoustic pronunciation score.</p>'+btn('leave','Finish')+'</section>';
    }
    return '<section class="ft-card ft-e-question"><h2>Check complete</h2><p>'+h(state.feedback||'Your independent responses have been recorded.')+'</p>'+(state.doneUnit?btn('continue-unit','Start this lesson',true):btn('daily','Continue learning',true))+' <button data-page="evidence">See dashboard</button> <button data-page="history">Review answers</button></section>';
  };
  const logAnswer=(value,item,r,ref,group='',support='none')=>{
    const compared=assessmentComparison(value,item);
    const audit=exactAudit(value,item.fr,r.correct,{ref,activity:(ALL_UNITS.find(u=>u.id===item.unitId)?.name||'French')+' · '+(STAGES.find(s=>s.id===state.stage)?.label||state.mode),question:item.en,support,checkGroup:group,targetLang:'fr',
      normalize:x=>assessmentComparison(x,item).got,marker:'assessment-v1',reason:r.error?'Recorded category: '+r.error+'.':''});
    audit.accepted=compared.variants;
    return recordAttempt(audit);
  };
  const finishAnswer=value=>{
    const item=state.item;if(!item)return;
    if(state.mode==='repair'){
      if(state.feedback!=='cover')return;
      const r=markAssessment(value,item);
      if(!logAnswer(value,item,r,repairRef(item),'','worked-example'))return;
      if(r.correct){
        if(!firstByRef(entries()).has(repairRef(item)))record({concept:item.concept,phase:'practice',support:'worked-example',sourceRef:repairRef(item)});
        state.feedback='correct';
      }else state.feedback='wrong';
      refresh();return;
    }
    if(!['check','adaptive'].includes(state.mode))return;
    const es=entries(),map=firstByRef(es),adaptive=state.mode==='adaptive',sourceRef=adaptive?item.ref+':adaptive-recall':item.ref;
    if(map.has(sourceRef)){startDaily();return;}
    // Do not allow a stale page to claim a check in the wrong time window.
    if(!adaptive){
      const valid=state.stage==='baseline'?baselineFor(state.unitId,es):pendingChecks(es,Date.now(),getTrack()).find(x=>x.unitId===state.unitId&&x.stage===state.stage);
      if(!valid){startDaily();return;}
    }
    const result=markAssessment(value,item);
    if(!logAnswer(value,item,result,sourceRef,adaptive?'':item.ref.split(':').slice(0,3).join(':')))return;
    const stage=state.stage,phase=adaptive?'practice':stage==='baseline'?'diagnostic':item.kind==='transfer'?'transfer':stage==='immediate'?'practice':'retrieval';
    record({concept:item.concept,phase,support:'none',novel:phase==='transfer',correctCount:result.correct?1:0,total:1,
      taughtAt:state.anchor||undefined,durationMs:Math.max(1,Math.min(Date.now()-state.started,120001)),sourceRef});
    if(result.error&&!adaptive)record({concept:item.concept,phase:'practice',support:'unknown',sourceRef:sourceRef+':error:'+result.error});
    if(adaptive){
      state.mode='done';state.feedback=result.correct?'Correct. Your repaired phrase was recalled independently.':'Not recalled yet. Use guided practice and try again at the next scheduled check.';refresh();return;
    }
    const current=stage==='baseline'?baselineFor(state.unitId,entries()):pendingChecks(entries(),Date.now(),getTrack()).find(x=>x.unitId===state.unitId&&x.stage===stage);
    if(current){pick('check',current.items.find(x=>!x.row),{unitId:current.unitId,stage,anchor:current.anchor});return;}
    state.mode='done';state.doneUnit=stage==='baseline'?state.unitId:null;state.feedback=stage==='baseline'?'Starting knowledge recorded. Now learn the phrases.':'Your first answers are saved. Corrections are scheduled separately so the test stays independent.';refresh();
  };
  const startExperiment=()=>{
    const x=getTrack()==='michaela'?availableExperiment(entries()):null;
    if(!x){state.mode='done';state.doneUnit=null;state.item={};state.feedback='The experiment becomes available after a full baseline and immediate check, on the day teaching finishes.';navigate('assessment');return;}
    const next=x.deck.find(i=>!firstByRef(entries()).has(i.ref));
    pick('experiment',next,{unitId:x.unit.id,anchor:x.anchor,played:false});
  };
  const oralDeck=()=>unitsForTrack(getTrack()).flatMap(u=>(u.incremental?u.blocks:lessonRows(u)).filter(r=>r.id!=='infinitive'));
  const oral=i=>{const deck=oralDeck();pick('oral',deck[i%deck.length],{oralIndex:i%deck.length});};
  const click=target=>{
    const a=target.dataset.eact;if(!a)return false;
    if(a.startsWith('unit:')){startUnit(a.slice(5));return true;}
    if(a.startsWith('range-')){state.range=Number(a.slice(6))===36500?36500:28;refresh();return true;}
    switch(a){
      case 'daily':startDaily();break;
      case 'skip-baseline':if(state.mode==='check'&&state.stage==='baseline'&&ALL_UNITS.find(u=>u.id===state.unitId)?.incremental)startGuided(state.unitId);break;
      case 'continue-unit':if(state.doneUnit)startUnit(state.doneUnit);break;
      case 'leave':state.mode=null;navigate('home');break;
      case 'unknown':finishAnswer('');break;
      case 'speak':if(state.item?.fr)speak(state.item.fr);break;
      case 'cover':state.feedback='cover';refresh();focusTarget('#ft-e-answer');break;
      case 'model':state.feedback=null;refresh();break;
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
      case 'oral':oral(0);break;
      case 'oral-reveal':state.feedback='spoken';refresh();speak(state.item.fr);break;
      case 'oral-next':oral(state.oralIndex+1);break;
      default:return false;
    }
    return true;
  };
  const submit=(form,event)=>{
    if(form.id!=='ft-e-form')return false;
    event.preventDefault();const value=form.querySelector('[name="answer"]')?.value||'';
    if(value.trim())finishAnswer(value);return true;
  };
  return {overview,dashboard,page:question,click,submit,reset,startDaily,startUnit};
}
