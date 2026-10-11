// Shared Learning SDK v0.1.0 — domain-neutral, local-first learner events and mastery.
// Never stores credentials; apps own authentication and cloud transports.
export const LEARNING_SDK_VERSION = '0.1.0';
const intervals = [1,3,7,14,30];
const clamp=(n,min,max)=>Math.max(min,Math.min(max,n));
const cleanId=v=>String(v||'').trim().slice(0,128);
const safeNum=(n,d=0)=>Number.isFinite(Number(n))?Number(n):d;
export function initialLearningState(){return {schema:1,events:[],concepts:{},sessions:[]};}
export function updateConcept(current={},event={}){
  const attempts=Math.max(0,safeNum(current.attempts))+1;
  const correct=!!event.correct, hints=clamp(safeNum(event.hints),0,99);
  const quality=correct ? (hints ? 0.55 : 1) : 0;
  const old=clamp(safeNum(current.mastery),0,1);
  // Exponentially weighted estimate; heuristic, not a validated assessment.
  const mastery=Number(clamp(old*.78+quality*.22,0,1).toFixed(4));
  const streak=correct && hints===0 ? (safeNum(current.streak)+1) : 0;
  const level=correct && hints===0 ? Math.min(4,safeNum(current.level)+1) : Math.max(0,safeNum(current.level)-1);
  const timestamp=Number.isFinite(event.timestamp)?event.timestamp:Date.now();
  const nextDue=timestamp+intervals[level]*86400000;
  return {attempts,correct:safeNum(current.correct)+(correct?1:0),assisted:safeNum(current.assisted)+(hints?1:0),streak,level,mastery,lastSeen:timestamp,nextDue};
}
export function recordLearningEvent(state,event){
  const concept=cleanId(event.concept);
  if(!concept) throw new Error('A concept identifier is required');
  const timestamp=Number.isFinite(event.timestamp)?event.timestamp:Date.now();
  const item={concept,correct:!!event.correct,hints:clamp(safeNum(event.hints),0,99),durationMs:Math.max(0,safeNum(event.durationMs)),mode:cleanId(event.mode)||'practice',timestamp,context:typeof event.context==='object'&&event.context!==null?event.context:{}};
  const concepts={...(state?.concepts||{})};
  concepts[concept]=updateConcept(concepts[concept],item);
  return {schema:1,concepts,events:[...(state?.events||[]),item].slice(-2500),sessions:[...(state?.sessions||[])]};
}
export function recordLearningSession(state,session){
  const row={timestamp:Number.isFinite(session.timestamp)?session.timestamp:Date.now(),mode:cleanId(session.mode),target:safeNum(session.target),correct:Math.max(0,safeNum(session.correct)),total:Math.max(0,safeNum(session.total)),hints:Math.max(0,safeNum(session.hints)),durationMs:Math.max(0,safeNum(session.durationMs))};
  return {...state,sessions:[...(state?.sessions||[]),row].slice(-500)};
}
export function conceptPriority(state,concept,now=Date.now()){
  const c=state?.concepts?.[concept];
  if(!c) return 1;
  const overdue=c.nextDue<=now ? .4 : 0;
  return clamp((1-c.mastery)*.65+overdue+.1/(1+c.attempts),0,2);
}
export function getLearningSummary(state,now=Date.now()){
  const concepts=Object.entries(state?.concepts||{});
  return {concepts:concepts.length,needsPractice:concepts.filter(([,c])=>c.mastery<.7||c.nextDue<=now).map(([name])=>name),mastered:concepts.filter(([,c])=>c.mastery>=.85&&c.attempts>=4).map(([name])=>name),sessions:(state?.sessions||[]).length};
}
export function createLearningStore({appId,learnerId='local',storage=typeof localStorage!=='undefined'?localStorage:null}={}){
  const key='apps-learning-v1:'+cleanId(appId)+':'+cleanId(learnerId);
  let state=initialLearningState();
  try{const data=JSON.parse(storage?.getItem(key)||'null');if(data?.schema===1&&data.concepts&&Array.isArray(data.events))state={...initialLearningState(),...data};}catch{}
  const persist=()=>{try{storage?.setItem(key,JSON.stringify(state));}catch{}};
  return {key,getState:()=>state,record:event=>{state=recordLearningEvent(state,event);persist();return state;},session:session=>{state=recordLearningSession(state,session);persist();return state;},summary:()=>getLearningSummary(state),export:()=>JSON.stringify(state,null,2),import:raw=>{const data=typeof raw==='string'?JSON.parse(raw):raw;if(data?.schema!==1||!Array.isArray(data.events)||typeof data.concepts!=='object')throw new Error('Invalid learning data');state={...initialLearningState(),...data};persist();return state;},reset:()=>{state=initialLearningState();persist();return state;}};
}
