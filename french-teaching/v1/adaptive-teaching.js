// Adaptive teaching inserts: private deterministic lesson/session decisions.
// The immutable mandatory deck and independent assessment bank are untouched.
import {ALL_UNITS,guidedLesson} from './guided-lessons.js';
import {assessmentDeck,STAGES} from './assessment.js';
import {curriculumNormalize} from './curriculum-meta.js';
import {wordKey,frenchTokens,containsTarget} from './revision-signals.js';
const MIN=60000,DAY=86400000;
const norm=curriculumNormalize;
const pair=(fr,en)=>({fr,en});
const lower=s=>s.charAt(0).toLowerCase()+s.slice(1);
const clean=s=>s.trim().replace(/[.!?]+$/,'');
// Original authored examples. Eligibility below requires previously taught
// vocabulary, and every reserved unseen assessment sentence is excluded.
const variants=[
 pair("J'ai réservé une chambre","I booked a room"),
 pair("J'ai réservé un billet","I booked a ticket"),
 pair("Nous avons réservé une table","We booked a table"),
 pair("J'ai réservé une table et j'ai préparé le repas","I booked a table and I prepared the meal"),
 pair("Hier, j'ai préparé le déjeuner","Yesterday I prepared lunch"),
 pair("J'ai préparé le repas et j'ai réservé une table","I prepared the meal and I booked a table"),
 pair("J'ai préparé le déjeuner et j'ai visité le musée","I prepared lunch and I visited the museum"),
 pair("Je dois étudier le français","I must study French"),
 pair("Je dois travailler le soir","I must work in the evening"),
 pair("Je veux étudier le français","I want to study French"),
 pair("Je peux étudier le français","I can study French"),
 pair("Je dois étudier le français, mais je veux écouter la radio","I must study French, but I want to listen to the radio")
];
let reserved;
function protectedSentences(){
 if(reserved)return reserved;
 const fr=new Set(),en=new Set();
 for(const unit of ALL_UNITS){
  for(const stage of STAGES)for(const x of assessmentDeck(unit.id,stage.id))if(x.kind==='transfer'||x.kind==='application'){fr.add(norm(x.fr));en.add(norm(x.en));}
  for(const x of guidedLesson(unit.id).steps)if(x.stage==='transfer'&&x.novel){fr.add(norm(x.fr));en.add(norm(x.en));}
 }
 return reserved={fr,en};
}
export function adaptivePlans(audits,unitId){
 const byId=new Map();
 for(const a of audits){
  const p=a.answerAudit?.signal?.kind==='adaptive-plan'?a.answerAudit.signal.plan:null;
  if(p?.id&&p.unitId===unitId&&!byId.has(p.id))byId.set(p.id,{...p,at:a.at});
 }
 const refs=new Set(audits.filter(a=>['correct','incorrect','unknown','revealed','model'].includes(a.answerAudit?.result)).map(a=>a.answerAudit.ref));
 return [...byId.values()].map(p=>({...p,complete:refs.has(p.id+':first')||refs.has(p.id+':complete')})).sort((a,b)=>a.at-b.at||a.id.localeCompare(b.id));
}
function taughtPairs(evidence,track){
 const done=new Set(evidence.filter(e=>e.source?.ref?.endsWith(':complete')).map(e=>e.source.ref));
 const out=[];
 // Previously encountered material across the learner's courses is eligible;
 // current course phrases rank higher. Never take a future uncompleted block.
 for(const u of ALL_UNITS)for(const s of guidedLesson(u.id).steps){
  if(!done.has(s.id+':complete'))continue;
  if(s.fr&&s.en)out.push({...pair(s.fr,s.en),unitId:u.id,track:u.track||'michaela',stage:s.stage});
 }
 return out;
}
const fingerprint=s=>{let h=2166136261;for(const c of s){h^=c.charCodeAt(0);h=Math.imul(h,16777619);}return (h>>>0).toString(36);};
function sentenceChoices(row,known,planHistory,current,track){
 const prior=planHistory.filter(p=>p.key===row.key).map(p=>norm(p.fr));
 const source=row.sentence&&row.english&&!/^Dictation:|^Listen:|^Which |^Requested /i.test(row.english)?[pair(row.sentence,row.english)]:[];
 const targetKnown=known.filter(x=>containsTarget(x.fr,row.word));
 const words=new Set([...known.map(x=>x.fr),...source.map(x=>x.fr),row.word].flatMap(x=>frenchTokens(x).map(t=>t.key)));
 const allowed=x=>frenchTokens(x.fr).every(t=>words.has(t.key));
 const isClause=x=>/^(?:hier[, ]|demain[, ]|aujourd'hui[, ]|je |j'|tu |nous |vous |il |elle |ils |elles )/i.test(wordKey(x.fr))&&/^(?:Yesterday|Tomorrow|Today|I |You |We |He |She |They )/i.test(x.en)&&!/[?]/.test(x.en)&&frenchTokens(x.fr).length>=3;
 const combos=[];
 const clauses=[...new Map(known.filter(isClause).map(x=>[norm(x.fr),x])).values()].slice(-100);
 if(words.has('et'))for(const x of [...source,...targetKnown].filter(isClause).slice(-16)){
  for(const y of clauses.slice(-24)){
   if(norm(x.fr)===norm(y.fr)||frenchTokens(x.fr).length+frenchTokens(y.fr).length>15)continue;
   combos.push(pair(clean(x.fr)+' et '+lower(clean(y.fr)),clean(x.en)+' and '+lower(clean(y.en))));
   if(combos.length>=120)break;
  }
  if(combos.length>=120)break;
 }
 const protectedBank=protectedSentences(),seen=new Set();
 const candidates=[...variants.filter(allowed),...combos,...targetKnown,...source].filter(x=>{
  const k=norm(x.fr);if(!k||seen.has(k)||!containsTarget(x.fr,row.word)||protectedBank.fr.has(k)||protectedBank.en.has(norm(x.en))||k===norm(current?.fr||''))return false;
  seen.add(k);return true;
 });
 const sameSource=norm(row.sentence||'');
 return candidates.map(x=>({...x,rank:(prior.includes(norm(x.fr))?-30:0)+(norm(x.fr)!==sameSource?8:0)+(x.unitId===current?.unitId?4:x.track===track?2:0)+(frenchTokens(x.fr).length>=3?4:0)})).sort((a,b)=>b.rank-a.rank||norm(a.fr).localeCompare(norm(b.fr)));
}
export function chooseAdaptivePlan({status,queue,audits,evidence,sessionId,track,now=Date.now()}){
 if(!status?.unit||status.mode==='review')return null;
 const unitId=status.unit.id,plans=adaptivePlans(audits,unitId),pending=plans.find(p=>!p.complete);
 if(pending)return {...pending,resume:true};
 const counts=status.teaching,position=counts.coreCompleted+counts.repairCompleted;
 const next=status.next;
 // Do not insert a model into an independent/transfer run. Preserve the
 // mandatory building-block order and the formal assessment windows.
 if(next&&['independent','transfer','review'].includes(next.stage))return null;
 if(position<3||plans.some(p=>position-p.position<3))return null;
 const max=Math.min(12,Math.ceil(counts.coreTotal/5));
 if(plans.length>=max)return null;
 const sessionPlans=audits.filter(a=>a.answerAudit?.signal?.kind==='adaptive-plan'&&a.answerAudit.signal.plan?.sessionId===sessionId);
 if(sessionPlans.length>=6)return null;
 const allPlans=ALL_UNITS.flatMap(u=>adaptivePlans(audits,u.id));
 const eligible=queue.filter(row=>{
  if(row.dueAt===null)return false;
  const difficulty=row.lastDifficulty,action=row.lastAction;
  const local=difficulty?.context?.unitId===unitId&&difficulty.context.sessionId===sessionId;
  if(local&&position-(difficulty.context.position??position)<3)return false;
  const earlier=allPlans.filter(p=>p.key===row.key).at(-1);
  if(earlier&&!earlier.complete)return false;
  // Recent strong signals can be brought forward within this lesson after
  // three other steps, including a failed or modelled adaptive exercise.
  const recentAction=action?.context?.unitId===unitId&&action.context.sessionId===sessionId&&position-(action.context.position??position)>=3;
  const recentStrong=local&&row.score>=3;
  return row.due||recentStrong||(recentAction&&['exposure','assisted'].includes(action.kind))||(recentAction&&action.kind==='review'&&!action.correct);
 }).sort((a,b)=>{
  const priority=x=>x.score+(x.lastDifficulty?.context?.unitId===unitId?2:0)+(x.lastDifficulty?.context?.sessionId===sessionId?1:0)+(x.due?1:0);
  return priority(b)-priority(a)||(a.dueAt??Infinity)-(b.dueAt??Infinity)||a.key.localeCompare(b.key);
 });
 if(!eligible.length)return null;
 const known=taughtPairs(evidence,track);
 for(const row of eligible){
  const previous=allPlans.filter(p=>p.key===row.key);
  const candidates=sentenceChoices(row,known,previous,next,track);
  const candidate=candidates[0];
  // A user-requested isolated word may not have a known bilingual context.
  // It can be practised as dictation, never given a guessed translation.
  const last=row.lastAction,needsModel=last?.kind==='review'&&!last.correct||(!last&&row.counts.reveal+row.counts.construction>=2);
  let mode=needsModel&&candidate?'model':row.needsRecall&&candidate?'recall':
    row.level>0&&candidate?'recall':row.targetKind==='phrase'&&candidate?'recall':
    candidate&&(row.counts.spelling===0||previous.length>0)?'recall':'dictation';
  if(last?.kind==='exposure'&&candidate)mode='recall';
  const fr=candidate?.fr||row.word,en=candidate?.en||'Listen and spell the French.';
  if(protectedSentences().fr.has(norm(fr))||protectedSentences().en.has(norm(en)))continue;
  const reason=row.lastDifficulty?.kind||'scheduled recall';
  const id='adaptive-v1:'+unitId+':'+position+':'+fingerprint(row.key+':'+previous.length);
  return {id,unitId,track,sessionId,position,key:row.key,target:row.word,targetKind:row.targetKind,structure:row.structure||'',mode,fr,en,reason,priority:row.score,signalIds:row.signals.slice(-8).map(e=>e.id),newContext:!!candidate&&norm(fr)!==norm(row.sentence||''),plannedAt:now};
 }
 return null;
}
export function adaptiveStep(plan){
 const kind=plan.mode==='model'?'model':plan.mode==='dictation'?'transcribe':'write';
 return {id:plan.id,unitId:plan.unitId,track:plan.track,stage:'adaptive',kind,fr:plan.fr,en:plan.en,structure:plan.structure,concept:'french:adaptive:'+fingerprint(plan.key),support:kind==='model'?'worked-example':'none',modelInitiallyShown:kind==='model',adaptivePlan:plan,
  prompt:kind==='model'?'Listen and notice this useful pattern.':kind==='transcribe'?'Listen carefully. Write the French you hear.':plan.newContext?'Use a familiar word or structure in a different sentence.':'Recall the French without looking.',novel:false};
}
export function adaptiveOutcome(plan,{correct=false,reveal=false,model=false,support='none'}={}){
 return {kind:model?'exposure':reveal||support!=='none'&&correct?'assisted':'review',word:plan.target,targetKind:plan.targetKind,structure:plan.structure,sentence:plan.fr,english:plan.en,correct:!!correct,mode:plan.mode,adaptive:true,planId:plan.id,newContext:plan.newContext};
}
