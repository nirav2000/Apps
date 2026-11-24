// Shared, format-independent assessment utilities. Existing evidence schema stays unchanged.
export const ASSESSMENT_DAY=86400000;
export const CHECK_WINDOWS=Object.freeze([
  {id:'immediate',from:0,to:1,label:'After teaching'},
  {id:'day1',from:1,to:3,label:'Day 1'},
  {id:'day3',from:3,to:7,label:'Day 3'},
  {id:'day7',from:7,to:28,label:'Day 7+'},
  {id:'day28',from:28,to:Infinity,label:'Day 28+'}
]);
export function firstByRef(entries=[]){
  const map=new Map();
  for(const e of entries||[]){
    const ref=e?.source?.ref;
    if(!ref||!Number.isFinite(Number(e.at)))continue;
    const old=map.get(ref);
    if(!old||Number(e.at)<Number(old.at)||(Number(e.at)===Number(old.at)&&String(e.id)<String(old.id)))map.set(ref,e);
  }
  return map;
}
export function scoreMetric(rows=[]){
  const valid=rows.filter(e=>e?.score?.total>0);
  const total=valid.reduce((n,e)=>n+e.score.total,0);
  const correct=valid.reduce((n,e)=>n+e.score.correct,0);
  return {correct,total,percent:total?Math.round(correct*100/total):null};
}
export function independentRows(rows=[]){
  return rows.filter(e=>e?.score?.total>0&&e.support==='none');
}
export function assessmentWindow(anchor,now=Date.now()){
  if(anchor==null||!Number.isFinite(anchor)||now<anchor)return null;
  const age=(now-anchor)/ASSESSMENT_DAY;
  return CHECK_WINDOWS.find(w=>age>=w.from&&age<w.to)||null;
}
export function medianDuration(rows=[]){
  const xs=rows.map(e=>e.durationMs).filter(x=>Number.isFinite(x)&&x>0&&x<=120000).sort((a,b)=>a-b);
  if(!xs.length)return null;
  const mid=Math.floor(xs.length/2);
  return Math.round(xs.length%2?xs[mid]:(xs[mid-1]+xs[mid])/2);
}
export function observedGap(rows,concept,at,excludeRef){
  const prior=rows.filter(e=>e.concept===concept&&e.at<at&&e.source?.ref!==excludeRef&&
    (e.score?.total>0||e.source?.ref?.endsWith(':complete')||e.source?.ref?.endsWith(':exposure')));
  return prior.length?Math.max(0,(at-Math.max(...prior.map(e=>e.at)))/ASSESSMENT_DAY):null;
}
export function compareMethods(a,b,minPerArm=8){
  const left=scoreMetric(independentRows(a)),right=scoreMetric(independentRows(b));
  return {left,right,difference:left.percent==null||right.percent==null?null:right.percent-left.percent,
    sufficient:left.total>=minPerArm&&right.total>=minPerArm};
}
