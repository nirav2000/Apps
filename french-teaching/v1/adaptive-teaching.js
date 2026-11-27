// Adaptive teaching inserts: private deterministic lesson/session decisions.
// The immutable mandatory deck and independent assessment bank are untouched.
import {ALL_UNITS,guidedLesson} from './guided-lessons.js';
import {assessmentDeck,STAGES} from './assessment.js';
import {curriculumNormalize} from './curriculum-meta.js';
import {wordKey,frenchTokens,containsTarget,likelyTypingSlip,relatedRevisionTargets,malformedAutoTarget,isProtectedRevision,targetContent} from './revision-signals.js';
import {practiceLedger,meaningfulVariation,PRACTICE_COOLDOWN} from './unlocking-adaptive.js';
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
 pair("Je dois étudier le français, mais je veux écouter la radio","I must study French, but I want to listen to the radio"),
 pair("Hier, nous avons préparé le dîner","Yesterday we prepared dinner"),
 pair("J’ai préparé le dîner et j’ai réservé une chambre","I prepared dinner and booked a room"),
 pair("J’ai réservé un billet et j’ai visité le musée","I booked a ticket and visited the museum"),
 pair("Hier, j’ai réservé une chambre et demain, je vais visiter le musée","Yesterday I booked a room and tomorrow I am going to visit the museum"),
 pair("J’ai préparé le déjeuner, mais je ne veux pas attendre","I prepared lunch, but I do not want to wait"),
 pair("Je voudrais réserver une table pour deux","I would like to book a table for two"),
 pair("Hier, j’ai préparé le bateau parce que je vais faire de la voile","Yesterday I prepared the boat because I am going to go sailing"),
 pair("Je vais préparer le dîner et je voudrais réserver une chambre","I am going to prepare dinner and I would like to book a room"),
 pair("Je dois préparer le déjeuner avant de partir","I must prepare lunch before leaving"),
 pair("Je voudrais préparer le repas avant de partir","I would like to prepare the meal before leaving"),
 pair("Je dois partir, mais je n’ai pas encore préparé le déjeuner","I have to leave, but I have not prepared lunch yet"),
 pair("Dépêche-toi, je dois réserver une table","Hurry up, I have to book a table"),
 pair("Je dois préparer le repas et je dois aider","I must prepare the meal and I must help"),
 pair("Je voudrais réserver une table pour ce soir","I would like to book a table for this evening"),
 pair("J’ai préparé le repas, mais je dois encore réserver une table","I prepared the meal, but I still have to book a table"),
 pair("Je vais préparer le déjeuner, puis je vais partir","I am going to prepare lunch, then I am going to leave"),
 pair("Je dois aider à préparer le repas","I have to help prepare the meal")
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
 const hints=new Map();
 for(const a of audits){const q=a.answerAudit?.signal;if(q?.kind==='hint'&&q.planId)hints.set(q.planId,Math.max(hints.get(q.planId)||0,Number(q.hintLevel)||1));}
 return [...byId.values()].map(p=>({...p,hintLevel:hints.get(p.id)||0,complete:refs.has(p.id+':first')||refs.has(p.id+':complete')})).sort((a,b)=>a.at-b.at||a.id.localeCompare(b.id));
}
function taughtPairs(evidence,track){
 const done=new Set(evidence.filter(e=>e.source?.ref?.endsWith(':complete')).map(e=>e.source.ref));
 const out=[];
 // Use completed models from the selected course only.
 // Never take a future uncompleted block or an independent transfer item.
 for(const u of ALL_UNITS.filter(u=>(u.track||'michaela')===track))for(const s of guidedLesson(u.id).steps){
  if(!done.has(s.id+':complete')||['independent','transfer','review'].includes(s.stage))continue;
  if(s.fr&&s.en)out.push({...pair(s.fr,s.en),unitId:u.id,track:u.track||'michaela',stage:s.stage});
 }
 return out;
}
const fingerprint=s=>{let h=2166136261;for(const c of s){h^=c.charCodeAt(0);h=Math.imul(h,16777619);}return (h>>>0).toString(36);};
function sentenceChoices(row,known,planHistory,current,track,ledger){
 const prior=planHistory.filter(p=>p.key===row.key).map(p=>norm(p.fr));
 const targetKnown=known.filter(x=>containsTarget(x.fr,row.word));
 const words=new Set(known.flatMap(x=>frenchTokens(x.fr).map(t=>t.key)));
 const allowed=x=>frenchTokens(x.fr).every(t=>words.has(t.key))&&(!ledger||['avant de','pas encore','aider à'].every(frame=>!containsTarget(x.fr,frame)||known.some(p=>containsTarget(p.fr,frame))));
 const source=row.sentence&&row.english&&!/^Dictation:|^Listen:|^Which |^Requested /i.test(row.english)&&allowed({fr:row.sentence})?[pair(row.sentence,row.english)]:[];
 const isClause=x=>/^(?:hier[, ]|demain[, ]|aujourd'hui[, ]|je |j'|tu |nous |vous |il |elle |ils |elles )/i.test(wordKey(x.fr))&&/^(?:Yesterday|Tomorrow|Today|I |You |We |He |She |They )/i.test(x.en)&&!/[?]/.test(x.en)&&frenchTokens(x.fr).length>=3;
 const combos=[];
 const maxWords=ledger?Math.min(28,Math.max(10,ledger.longest+5)):15;
 const singleClause=x=>isClause(x)&&(!ledger||!/(?:\s|,)(?:et|mais|donc|car|parce que|puis)\s/i.test(x.fr));
 const clauses=[...new Map(known.filter(singleClause).map(x=>[norm(x.fr),x])).values()].slice(-100);
 if(words.has('et'))for(const x of [...source,...targetKnown].filter(singleClause).slice(-16)){
  for(const y of clauses.slice(-24)){
   if(norm(x.fr)===norm(y.fr)||frenchTokens(x.fr).length+frenchTokens(y.fr).length>maxWords||ledger&&!meaningfulVariation(x.fr,y.fr))continue;
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
 const currentContent=targetContent(current?.fr||'');
 const bridges=x=>currentContent.some(w=>targetContent(x.fr).includes(w));
 return candidates.map(x=>({...x,rank:(prior.includes(norm(x.fr))?-30:0)+(ledger?.recentlySimilar(x.fr)?-80:0)+(ledger&&bridges(x)?24:0)+(ledger?.saturated(x.fr)?-100:0)+(ledger&&frenchTokens(x.fr).length<=maxWords?Math.min(10,frenchTokens(x.fr).length):0)+(norm(x.fr)!==sameSource?8:0)+(x.unitId===current?.unitId?4:x.track===track?2:0)+(frenchTokens(x.fr).length>=3?4:0)})).sort((a,b)=>b.rank-a.rank||norm(a.fr).localeCompare(norm(b.fr)));
}
export function chooseAdaptivePlan({status,queue,audits,evidence,sessionId,track,now=Date.now()}){
 if(!status?.unit||!['new','resume'].includes(status.mode))return null;
 const ledger=track==='unlocking'?practiceLedger(audits,track,now):null;
 if(ledger)queue=queue.filter(r=>!ledger.targetSatisfied(r));
 const unitId=status.unit.id,eligibleKeys=new Set(queue.map(r=>r.key));
 const plans=adaptivePlans(audits,unitId).filter(p=>p.complete||eligibleKeys.has(p.key));
 const pending=plans.find(p=>!p.complete&&eligibleKeys.has(p.key)&&(!ledger||p.policyVersion===2));
 if(pending&&status.next&&!['independent','transfer','review'].includes(status.next.stage))return {...pending,resume:true};
 const counts=status.teaching,position=counts.coreCompleted+counts.repairCompleted;
 const next=status.next;
 // Do not insert a model into an independent/transfer run. Preserve the
 // mandatory building-block order and the formal assessment windows.
 if(!next||['independent','transfer','review'].includes(next.stage))return null;
 const gap=ledger?6:3;
 const activePlans=plans.filter(p=>p.complete||!ledger||p.policyVersion===2);
 if(position<3||activePlans.some(p=>position-p.position<gap))return null;
 const max=ledger?3:Math.min(12,Math.ceil(counts.coreTotal/5));
 if(activePlans.filter(p=>p.sessionId===sessionId||!ledger).length>=max)return null;
 const sessionPlans=audits.filter(a=>a.answerAudit?.signal?.kind==='adaptive-plan'&&a.answerAudit.signal.plan?.sessionId===sessionId&&(!ledger||a.answerAudit.signal.plan.track===track));
 if(sessionPlans.length>=(ledger?3:6))return null;
 const allPlans=ALL_UNITS.filter(u=>(u.track||'michaela')===track).flatMap(u=>adaptivePlans(audits,u.id)).filter(p=>p.complete||eligibleKeys.has(p.key));
 const priorPlans=allPlans.filter(p=>p.complete||!ledger||p.policyVersion===2);
 const recentPlans=priorPlans.filter(p=>now-(p.at||p.plannedAt||0)<PRACTICE_COOLDOWN);
 const origin=row=>row.lastDifficulty?.context?.unitId||row.learningProof?.unitId||'';
 const foreign=row=>!!origin(row)&&origin(row)!==unitId;
 const crossCount=sessionPlans.filter(a=>{const p=a.answerAudit.signal.plan;return p.sourceUnitId&&p.sourceUnitId!==p.unitId;}).length;
 const eligible=queue.filter(row=>{
  if(row.dueAt===null||ledger&&row.groupedReason)return false;
  if(ledger&&!isProtectedRevision(row)&&malformedAutoTarget(row.word))return false;
  if(ledger&&foreign(row)&&(counts.coreCompleted<8||crossCount>=1))return false;
  if(ledger&&recentPlans.some(p=>relatedRevisionTargets(row,{word:p.target})))return false;
  const difficulty=row.lastDifficulty,action=row.lastAction;
  const local=difficulty?.context?.unitId===unitId&&difficulty.context.sessionId===sessionId;
  if(local&&position-(difficulty.context.position??position)<gap)return false;
  const earlier=priorPlans.filter(p=>p.key===row.key).at(-1);
  if(earlier&&!earlier.complete)return false;
  // Recent strong signals can be brought forward within this lesson after
  // three other steps, including a failed or modelled adaptive exercise.
  const recentAction=action?.context?.unitId===unitId&&action.context.sessionId===sessionId&&position-(action.context.position??position)>=3;
  const unaddressed=difficulty&&(!action||difficulty.at>action.at)&&(!row.lastIndependentAt||difficulty.at>row.lastIndependentAt);
  const recentStrong=local&&row.score>=3&&unaddressed;
  return row.due||recentStrong||(recentAction&&['exposure','assisted'].includes(action.kind))||(recentAction&&action.kind==='review'&&(!action.correct||action.mode==='dictation'&&row.needsRecall));
 }).sort((a,b)=>{
  const priority=x=>x.score+(x.lastDifficulty?.context?.unitId===unitId?2:0)+(x.lastDifficulty?.context?.sessionId===sessionId?1:0)+(x.due?1:0);
  return priority(b)-priority(a)||(a.dueAt??Infinity)-(b.dueAt??Infinity)||a.key.localeCompare(b.key);
 });
 if(!eligible.length)return null;
 const known=taughtPairs(evidence,track);
 const taughtWords=new Set(known.flatMap(x=>frenchTokens(x.fr).map(t=>t.key)));
 // Existing upcoming repetitions are the first choice. Do not add an
 // extra drill immediately before the same naturally scheduled retrieval.
 const upcoming=status.steps.filter(s=>!s.completed&&s.stage!=='repair').slice(0,2);
 for(const row of eligible){
  const targetTaught=frenchTokens(row.word).every(t=>taughtWords.has(t.key));
  if(!targetTaught&&!row.learningProof)continue;
  const unaddressed=row.lastDifficulty&&(!row.lastAction||row.lastDifficulty.at>row.lastAction.at)&&(!row.lastIndependentAt||row.lastDifficulty.at>row.lastIndependentAt);
  const serious=unaddressed&&['construction','reveal','recognition'].includes(row.lastDifficulty.kind);
  if(!serious&&upcoming.some(s=>s.kind==='write'&&containsTarget(s.fr,row.word)))continue;
  const previous=priorPlans.filter(p=>p.key===row.key);
  const candidates=sentenceChoices(row,known,previous,next,track,ledger);
  const fresh=ledger?candidates.filter(x=>!ledger.recentlySimilar(x.fr)&&!ledger.saturated(x.fr)&&!recentPlans.some(p=>frenchTokens(p.fr).length>=3&&frenchTokens(x.fr).length>=3&&!meaningfulVariation(x.fr,p.fr))):candidates;
  // An actual missing expression still gets a model. For an isolated spelling
  // error, practise the word, then retrieve it later in a different sentence.
  const spellingOnly=!!ledger&&!serious&&row.targetKind==='word'&&row.lastDifficulty?.kind==='spelling'&&(!row.lastAction||row.lastAction.at<row.lastDifficulty.at||row.lastAction.kind==='review'&&!row.lastAction.correct);
  // Never fall back to a recently repeated whole sentence just because
  // the signal was strong. A small exact target may still need its model.
  const candidate=spellingOnly?null:serious?(fresh.find(x=>norm(x.fr)===norm(row.word))||fresh[0]||(!ledger?candidates[0]:null)):fresh[0];
  if(ledger&&!candidate&&row.targetKind==='phrase')continue;
  if(!candidate&&!row.due&&row.lastAction?.mode==='dictation'&&row.lastAction.correct)continue;
  // A user-requested isolated word may not have a known bilingual context.
  // It can be practised as dictation, never given a guessed translation.
  const last=row.lastAction,needsModel=serious||last?.kind==='review'&&!last.correct||(!last&&row.counts.reveal+row.counts.construction>=2);
  let mode=needsModel&&candidate?'model':row.needsRecall&&candidate?'recall':
    row.level>0&&candidate?'recall':row.targetKind==='phrase'&&candidate?'recall':
    candidate&&(row.counts.spelling===0||previous.length>0)?'recall':'dictation';
  if(last?.kind==='exposure'&&candidate)mode='recall';
  // Avoid translating an arbitrary target with an invented English gloss.
  if(!candidate)mode='dictation';
  const fr=mode==='dictation'?row.word:candidate.fr,en=mode==='dictation'?'Listen and spell the French.':candidate.en;
  if(ledger&&(ledger.recentlySeen(fr)||mode!=='dictation'&&ledger.recentlySimilar(fr)))continue;
  if(protectedSentences().fr.has(norm(fr))||protectedSentences().en.has(norm(en)))continue;
  const reason=row.lastDifficulty?.kind||'scheduled recall';
  const id='adaptive-v1:'+unitId+':'+position+':'+fingerprint(row.key+':'+allPlans.filter(p=>p.key===row.key).length+':v2');
  return {id,unitId,track,sessionId,position,key:row.key,target:row.word,targetKind:row.targetKind,structure:row.structure||'',mode,fr,en,reason,priority:row.score,signalIds:row.signals.slice(-8).map(e=>e.id),newContext:mode!=='dictation'&&!!candidate&&(ledger?meaningfulVariation(fr,row.sentence||''):norm(fr)!==norm(row.sentence||'')),plannedAt:now,policyVersion:2,sourceUnitId:origin(row)||unitId};
 }
 return null;
}
export function adaptiveStep(plan){
 const kind=plan.mode==='model'?'model':plan.mode==='dictation'?'transcribe':'write';
 return {id:plan.id,unitId:plan.unitId,track:plan.track,stage:'adaptive',kind,fr:plan.fr,en:plan.en,structure:plan.structure,concept:'french:adaptive:'+fingerprint(plan.key),support:kind==='model'?'worked-example':'none',modelInitiallyShown:kind==='model',adaptivePlan:plan,
  prompt:kind==='model'?'Listen and notice this useful pattern.':kind==='transcribe'?'Listen carefully. Write the French you hear.':plan.newContext?'Use a familiar word or structure in a different sentence.':'Recall the French without looking.',novel:false};
}
export function adaptiveOutcome(plan,{correct=false,reveal=false,model=false,support='none',answer=''}={}){
 const targetPresent=containsTarget(answer,plan.target);
 const slip=!correct&&!reveal&&!model&&plan.track==='unlocking'&&likelyTypingSlip(answer,plan.fr);
 // A different accepted translation that avoids the target is not a
 // successful recall of the target. Neither is a supplied model.
 const success=correct&&targetPresent&&!reveal&&!model&&support==='none';
 return {kind:slip?'typing-slip':model?'exposure':reveal||correct&&!success?'assisted':'review',word:plan.target,targetKind:plan.targetKind,structure:plan.structure,sentence:plan.fr,english:plan.mode==='dictation'?'':plan.en,correct:success,mode:plan.mode,adaptive:true,planId:plan.id,newContext:plan.newContext};
}
