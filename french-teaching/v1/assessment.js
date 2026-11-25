// French assessment pilot. All records use the existing scoped, immutable evidence log.
import {GUIDED_UNITS,ALL_UNITS,ORIGINAL_UNITS,unitsForTrack,lessonRows,guidedLesson,guidedStatus,guidedTeachingRef,guidedCompletionRefs} from './guided-lessons.js';
import {magicTenPhrase,MAGIC10_STRUCTURES} from './magic10.js';
import {applicationPairs} from './curriculum-assessments.js';
import {curriculumNormalize,curriculumVariants} from './curriculum-meta.js';
import {PASSAGE,DRILLS,SENTENCE_WORKSHOP,assembleWorkshop,normaliseAnswer} from './data.js';
import {ASSESSMENT_DAY as DAY,CHECK_WINDOWS,firstByRef,scoreMetric,independentRows,assessmentWindow,medianDuration,observedGap,compareMethods} from '../../learning-evidence/v1/assessment.js';

export const ASSESSMENT_VERSION='1.0.0';
export const STAGES=Object.freeze([{id:'baseline',label:'Before teaching'},...CHECK_WINDOWS]);
const unitFor=id=>ALL_UNITS.find(u=>u.id===id);
const rowsFor=lessonRows;
const key=(unit,stage,i,kind)=>'assess-v1:'+unit+':'+stage+':'+i+':'+kind;
const ref=e=>e?.source?.ref||'';
const normalize=s=>normaliseAnswer(s).replace(/\s*[,;.!?]\s*/g,' ').replace(/\s+/g,' ').trim();
const lower=s=>s.charAt(0).toLowerCase()+s.slice(1);
const englishClause=r=>r.id==='past'&&r.verbId==='lire'?'I read in French (in the past)':r.en;
const stripAccent=s=>s.normalize('NFD').replace(/[\u0300-\u036f]/g,'');
const bankCache=new Map();
const known=new Set([
  ...PASSAGE.map(x=>x.fr),...DRILLS.filter(x=>x.kind!=='toEnglish').map(x=>x.answer),
  ...GUIDED_UNITS.flatMap(u=>guidedLesson(u.id).steps.map(s=>s.fr)),
  ...SENTENCE_WORKSHOP.flatMap((p,m)=>p.left.flatMap((_,l)=>p.right.map((_,r)=>assembleWorkshop(m,l,r).fr)))
].map(normalize));

// Assign a distinct, unseen two-clause prompt to every transfer slot. No arbitrary
// conjugation: only existing vetted clauses are joined with et or mais.
function buildBank(u){
  const rows=rowsFor(u),out=new Map(),slots=[];
  for(const stage of STAGES){
    const deck=rows.map((r,i)=>{
      const alternate=['day3','day28'].includes(stage.id);
      // Keep baseline, immediate and day-seven forms comparable; sample other structures on days 3/28.
      const kind=r.id==='infinitive'||((i%4<2)!==alternate)?'recall':'transfer';
      const base={...r,unitId:u.id,stage:stage.id,kind,ref:key(u.id,stage.id,i,kind),index:i};
      if(kind==='transfer'){
        const candidates=[];
        for(const partner of rows.filter(p=>p.verbId!==r.verbId&&p.id!=='infinitive')){
          for(const connector of ['et','mais']){
            for(const reverse of [false,true]){
              const a=reverse?partner:r,b=reverse?r:partner;
              const fr=a.fr+(connector==='mais'?', mais ':' et ')+lower(b.fr);
              const en=englishClause(a)+(connector==='mais'?', but ':' and ')+lower(englishClause(b));
              if(!known.has(normalize(fr)))candidates.push({fr,en,connector,partnerConcept:partner.concept});
            }
          }
        }
        const offset=(STAGES.indexOf(stage)*3+i)%candidates.length;
        slots.push({base,candidates:[...candidates.slice(offset),...candidates.slice(0,offset)]});
      }else{base.en=englishClause(r);}
      return base;
    });
    out.set(stage.id,deck);
  }
  // Bipartite matching guarantees no duplicate transfer item across review days.
  const assigned=new Map();
  function match(slot,seen){
    for(const candidate of slot.candidates){
      const k=normalize(candidate.fr);
      if(seen.has(k))continue;
      seen.add(k);
      const previous=assigned.get(k);
      if(!previous||match(previous.slot,seen)){
        assigned.set(k,{slot,candidate});return true;
      }
    }
    return false;
  }
  for(const slot of slots)if(!match(slot,new Set()))throw Error('Insufficient distinct French assessment prompts: '+u.id);
  for(const {slot,candidate} of assigned.values())Object.assign(slot.base,candidate);
  return out;
}
// Legacy banks remain unchanged. New tracks recall taught items and use two
// distinct application prompts per assessment stage. Familiar strings in a new
// context are application, not unseen transfer.
const allTaught=new Set([...known,...ORIGINAL_UNITS.flatMap(u=>guidedLesson(u.id).steps.map(s=>curriculumNormalize(s.fr)))]);
const incrementalTaught=new Set([...allTaught,...ALL_UNITS.filter(u=>u.incremental).flatMap(u=>guidedLesson(u.id).steps.map(s=>curriculumNormalize(s.fr)))]);
const repeatedApplication=new Map();for(const u of ALL_UNITS.filter(u=>u.incremental))for(const x of u.application){const n=curriculumNormalize(x.fr);repeatedApplication.set(n,(repeatedApplication.get(n)||0)+1);}
function customBank(u){
  const rows=rowsFor(u),pairs=u.incremental?u.application:applicationPairs(u.id),out=new Map(),seen=new Set();
  const taught=u.incremental?incrementalTaught:allTaught;
  STAGES.forEach((stage,j)=>{
    const deck=rows.map((r,i)=>({...r,track:u.track,unitId:u.id,stage:stage.id,kind:'recall',ref:key(u.id,stage.id,i,'recall'),index:i}));
    for(let k=0;k<2;k++){
      const q=pairs[j*2+k],norm=curriculumNormalize(q.fr);
      const novel=norm.split(' ').length>2&&!seen.has(norm)&&(!u.incremental||repeatedApplication.get(norm)===1)&&![...taught].some(x=>(' '+x+' ').includes(' '+norm+' '));
      seen.add(norm);
      const i=rows.length+k,kind=novel?'transfer':'application';
      deck.push({...q,track:u.track,unitId:u.id,stage:stage.id,kind,index:i,id:u.id,verbId:u.id,concept:'french:'+u.id+':application:'+j+':'+k,ref:key(u.id,stage.id,i,kind),hint:u.incremental?'Build the sentence from the components learned in this chapter.':u.soundFocus.note});
    }
    out.set(stage.id,deck);
  });
  return out;
}
export function assessmentDeck(unitId,stage){
  const u=unitFor(unitId);if(!u||!STAGES.some(s=>s.id===stage))throw Error('Unknown assessment');
  if(!bankCache.has(unitId))bankCache.set(unitId,u.track?customBank(u):buildBank(u));
  return bankCache.get(unitId).get(stage).map(x=>({...x}));
}

export function assessmentComparison(input,item){
  if(item.track&&item.track!=='michaela')return {got:curriculumNormalize(input),want:curriculumNormalize(item.fr),variants:curriculumVariants(item.fr,item.en)};
  const got=normalize(input),want=normalize(item.fr);
  const variants=[want,want.replace(/la télévision/g,'la télé')];
  if(item.connector==='et'){
    const halves=want.split(' et ');
    if(halves.length===2)variants.push(halves.join(' et ').replace(/la télévision/g,'la télé'));
  }
  return {got,want,variants:[...new Set(variants)]};
}
export function markAssessment(input,item){
  const {got,want,variants}=assessmentComparison(input,item);
  if(variants.includes(got))return {correct:true,error:null};
  if(!got)return {correct:false,error:'unknown'};
  if(variants.some(x=>stripAccent(x)===stripAccent(got)))return {correct:false,error:'accents'};
  if(item.connector&&!got.includes(' '+item.connector+' '))return {correct:false,error:'connector'};
  if(/\bpas\b/.test(want)&&!/\bpas\b/.test(got))return {correct:false,error:'negation'};
  if((want.includes('je vais ')&&got.includes("j'ai "))||(want.includes("j'ai ")&&got.includes('je vais ')))
    return {correct:false,error:'tense'};
  return {correct:false,error:'chunk'};
}
export const ERROR_TIPS=Object.freeze({
  accents:'Listen and notice the accents. Copy the accented spelling, cover it, then reconstruct the phrase.',
  connector:'Say the two clauses separately. Join them with the intended linking word, then cover and rebuild.',
  negation:'Notice ne or n’ before the verb and pas after it. Rebuild without the model.',
  tense:'Contrast a completed action with a future plan. Say the auxiliary and verb form, then rebuild.',
  chunk:'Break the phrase into reusable chunks. Say each one, then rebuild the full sentence.',
  unknown:'Hear the complete model, repeat it, cover it and retrieve it.'
});
export function teachingFinishedAt(unitId,entries,now=Date.now()){
  const status=guidedStatus(unitId,entries,now),m=firstByRef(entries);
  if(!status.taughtAt||status.teaching?.completed!==status.teaching?.total)return null;
  const prefix='guided-v2:'+unitId+':';
  const completed=[...m.values()].filter(e=>ref(e).startsWith(prefix)&&ref(e).endsWith(':complete')&&!ref(e).includes(':review-'));
  if(completed.length<guidedLesson(unitId).steps.length)return null;
  return Math.max(...completed.map(e=>Number(e.at)));
}
function eligibleRow(row,stage,anchor,start){
  if(!row||row.support!=='none'||!row.score?.total)return false;
  if(stage==='baseline')return row.phase==='diagnostic'&&(start==null||row.at<start);
  return !!anchor&&assessmentWindow(anchor,Number(row.at))?.id===stage;
}
export function checkResult(unitId,stage,entries,now=Date.now()){
  const map=firstByRef(entries),anchor=teachingFinishedAt(unitId,entries,now);
  const start=map.get(guidedTeachingRef(unitId))?.at??null;
  const items=assessmentDeck(unitId,stage).map(item=>{
    const row=map.get(item.ref);
    return {...item,row:eligibleRow(row,stage,anchor,start)?row:null,error:[...map.keys()].find(r=>r.startsWith(item.ref+':error:'))?.split(':').at(-1)||null};
  });
  const attempted=items.filter(x=>x.row);
  return {unitId,stage,anchor,items,attempted,complete:attempted.length===items.length,
    metric:scoreMetric(attempted.map(x=>x.row)),recall:scoreMetric(attempted.filter(x=>x.kind==='recall').map(x=>x.row)),
    transfer:scoreMetric(attempted.filter(x=>x.kind==='transfer').map(x=>x.row))};
}
export function pendingChecks(entries,now=Date.now(),track='michaela'){
  const due=[];
  for(const u of unitsForTrack(track)){
    const anchor=teachingFinishedAt(u.id,entries,now),window=assessmentWindow(anchor,now);
    if(!window)continue;
    const result=checkResult(u.id,window.id,entries,now);
    if(!result.complete)due.push({...result,unit:u,label:window.label});
  }
  return due.sort((a,b)=>STAGES.findIndex(x=>x.id===b.stage)-STAGES.findIndex(x=>x.id===a.stage)||a.anchor-b.anchor);
}
export function baselineFor(unitId,entries,now=Date.now()){
  if(firstByRef(entries).has(guidedTeachingRef(unitId)))return null;
  const result=checkResult(unitId,'baseline',entries,now);
  return result.complete?null:{...result,unit:unitFor(unitId),label:'Before teaching'};
}
export function nextCheckDate(entries,now=Date.now(),track='michaela'){
  const dates=[];
  for(const u of unitsForTrack(track)){
    const anchor=teachingFinishedAt(u.id,entries,now);
    if(anchor==null)continue;
    for(const w of CHECK_WINDOWS){
      const date=anchor+w.from*DAY;
      if(date>now){dates.push(date);break;}
    }
  }
  return dates.length?Math.min(...dates):null;
}
export const repairRef=item=>item.ref+':repair:complete';
export function pendingRepairs(entries,now=Date.now(),track='michaela'){
  const map=firstByRef(entries),lastByConcept=new Map();
  for(const u of unitsForTrack(track))for(const s of STAGES.filter(x=>x.id!=='baseline')){
    const result=checkResult(u.id,s.id,entries,now);
    if(!result.complete)continue;
    for(const item of result.attempted){
      const previous=lastByConcept.get(item.concept);
      if(!previous||item.row.at>previous.row.at)lastByConcept.set(item.concept,item);
    }
  }
  return [...lastByConcept.values()].filter(x=>!x.row.score.correct&&!map.has(repairRef(x))).sort((a,b)=>b.row.at-a.row.at);
}
export function assessmentStats(entries,now=Date.now(),days=28,track='michaela'){
  const start=now-days*DAY,all=[...firstByRef(entries).values()];
  const checks=unitsForTrack(track).flatMap(u=>STAGES.map(s=>checkResult(u.id,s.id,entries,now)));
  const items=checks.flatMap(c=>c.attempted).filter(x=>x.row.at>=start);
  const nonBaseline=items.filter(x=>x.stage!=='baseline');
  const unitIds=new Set(unitsForTrack(track).map(u=>u.id));
  const practice=all.filter(e=>e.phase==='practice'&&e.score?.total>0&&!ref(e).startsWith('assess-v1:')&&e.at>=start&&(ref(e).startsWith('guided-v2:')?unitIds.has(ref(e).split(':')[1]):track==='michaela'));
  const delayed=nonBaseline.filter(x=>x.stage==='day7'&&x.kind==='recall');
  const transfer=nonBaseline.filter(x=>x.kind==='transfer'&&x.row.phase==='transfer'&&x.row.novel===true);
  const chart=STAGES.map(s=>({label:s.label,...scoreMetric(items.filter(x=>x.stage===s.id&&x.kind==='recall').map(x=>x.row))}));
  const structures=track==='michaela'?MAGIC10_STRUCTURES:unitsForTrack(track).map(u=>({id:u.id,name:u.name}));
  const knowledge=structures.map(s=>{
    const rows=nonBaseline.filter(x=>x.id===s.id);
    const metric=scoreMetric(rows.map(x=>x.row));
    const seven=scoreMetric(rows.filter(x=>(x.stage==='day7'||x.stage==='day28')&&(track==='michaela'||x.kind==='recall')).map(x=>x.row));
    const novel=scoreMetric(rows.filter(x=>x.kind==='transfer'||(track!=='michaela'&&x.kind==='application')).map(x=>x.row));
    return {id:s.id,label:s.name,...metric,seven,novel,secure:metric.total>=4&&metric.percent>=80&&seven.total>=1&&seven.percent===100&&novel.total>=1&&novel.percent>=80};
  });
  const errors={};
  for(const x of nonBaseline)if(!x.row.score.correct){const code=x.error||'chunk';errors[code]=(errors[code]||0)+1;}
  const independent=scoreMetric(nonBaseline.map(x=>x.row)),recall=scoreMetric(delayed.map(x=>x.row)),novel=scoreMetric(transfer.map(x=>x.row));
  const practiceMetric=scoreMetric(practice);
  const gap=delayed.map(x=>observedGap(entries,x.concept,x.row.at,x.ref)).filter(x=>x!=null);
  const sevenUnseen=scoreMetric(transfer.filter(x=>x.stage==='day7').map(x=>x.row));
  const application=scoreMetric(nonBaseline.filter(x=>x.kind==='application'||x.kind==='transfer').map(x=>x.row));
  const day28=scoreMetric(nonBaseline.filter(x=>x.stage==='day28'&&x.kind==='recall').map(x=>x.row));
  const tips=[];
  if(practiceMetric.total>=8&&independent.total>=8&&practiceMetric.percent-independent.percent>=20)tips.push('Guided success exceeds independent performance. Fade hints more gradually and retrieve without the model.');
  const immediate=chart.find(x=>x.label==='After teaching');
  if(immediate.total>=4&&recall.total>=4&&immediate.percent-recall.percent>=20)tips.push('Recall has fallen after a delay. Prioritise spaced retrieval before adding new material.');
  if(independent.total>=8&&novel.total>=4&&independent.percent-novel.percent>=20)tips.push('Unseen combinations are harder. Practise joining familiar chunks in varied sentences.');
  const most=Object.entries(errors).sort((a,b)=>b[1]-a[1])[0];
  if(most&&most[1]>=2)tips.push(ERROR_TIPS[most[0]]||ERROR_TIPS.chunk);
  if(!tips.length)tips.push(nonBaseline.length<8?'Not enough independent evidence yet. Complete the next scheduled check.':'Continue with the next check; no consistent weakness has been established.');
  // Matched before/after observations, not a comparison of different learners or units.
  const pairs=checks.filter(c=>c.stage==='baseline'&&c.complete).flatMap(b=>{
    const post=checks.find(c=>c.unitId===b.unitId&&c.stage==='day7'&&c.complete);
    return post?b.items.filter(x=>!unitFor(b.unitId).track||x.kind==='recall').map(x=>[x,post.items.find(y=>y.index===x.index)]):[];
  }).filter(([a,b])=>a.row.at>=start&&b?.row);
  const gain=pairs.length?Math.round(100*pairs.reduce((n,[a,b])=>n+b.row.score.correct-a.row.score.correct,0)/pairs.length):null;
  return {practice:practiceMetric,independent,retention:recall,transfer:novel,chart,knowledge,errors,tips,
    medianMs:medianDuration(nonBaseline.map(x=>x.row)),gapDays:gap.length?Math.round(gap.reduce((a,b)=>a+b,0)/gap.length*10)/10:null,
    gain,gainPairs:pairs.length,checks,measured:nonBaseline.length,sevenUnseen,day28,application};
}

// One opt-in, matched-pair teaching experiment: written vs spoken prompt.
// Same one extra model exposure, counterbalanced by structure. No automatic promotion.
export function experimentDeck(unitId){
  const u=unitFor(unitId);if(!u||u.track)return [];
  return rowsFor(u).map((row,i)=>({...row,unitId,index:i,arm:((i%4+Math.floor(i/4)+GUIDED_UNITS.indexOf(u))%2===0?'written':'audio'),
    ref:'experiment-v1:'+unitId+':'+i+':exposure'}));
}
export function availableExperiment(entries,now=Date.now()){
  const map=firstByRef(entries);
  for(const u of GUIDED_UNITS){
    const immediate=checkResult(u.id,'immediate',entries,now);
    if(!immediate.complete||!checkResult(u.id,'baseline',entries,now).complete||assessmentWindow(immediate.anchor,now)?.id!=='immediate')continue;
    const deck=experimentDeck(u.id);
    if(deck.some(x=>!map.has(x.ref)))return {unit:u,anchor:immediate.anchor,deck};
  }
  return null;
}
export function experimentStats(entries,now=Date.now()){
  const map=firstByRef(entries),a=[],b=[],baselineA=[],baselineB=[],timeA=[],timeB=[];
  for(const u of GUIDED_UNITS){
    const base=checkResult(u.id,'baseline',entries,now),post=checkResult(u.id,'day7',entries,now);
    if(!base.complete||!post.complete)continue;
    const deck=experimentDeck(u.id);
    for(let i=0;i<4;i++){
      const pair=[deck[i],deck[i+4]],exposures=pair.map(x=>map.get(x.ref));
      if(!exposures.every(e=>e&&e.at>=post.anchor&&e.at<post.anchor+DAY))continue;
      for(let j=0;j<2;j++){
        const x=pair[j],left=x.arm==='written';
        (left?a:b).push(post.items[x.index].row);
        (left?baselineA:baselineB).push(base.items[x.index].row);
        (left?timeA:timeB).push(exposures[j]);
      }
    }
  }
  return {...compareMethods(a,b),baselineA:scoreMetric(baselineA),baselineB:scoreMetric(baselineB),timeA:medianDuration(timeA),timeB:medianDuration(timeB)};
}
