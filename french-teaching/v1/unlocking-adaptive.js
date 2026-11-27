// Non-scoring self-reported recall controls the amount of identical practice.
// A bypass is a separate resolution, never an exposure or scored success.
const key=s=>String(s||'').normalize('NFC').toLowerCase().replace(/[’‘]/g,"'").replace(/[.!]+$/,'').replace(/\s+/g,' ').trim();
const direction=s=>s.unlockAction==='reverse'?'understand':'say';
export const skipRef=s=>s.id+':adaptive-skip';
export const knownRef=s=>s.id+':oral-known';
export const helpRef=s=>s.id+':oral-retry';
export function repeatDecision(step,steps,entries,ledger=null){
 if(!step||step.track!=='unlocking'||step.kind!=='model'||!['recall','build','reverse'].includes(step.unlockAction)||['repair','independent','transfer','review'].includes(step.stage))return false;
 const index=steps.findIndex(s=>s.id===step.id);if(index<1)return false;
 const refs=new Map();
 for(const e of entries){const ref=e.source?.ref;if(!ref)continue;const at=Number(e.at)||0;if(!refs.has(ref)||at>refs.get(ref))refs.set(ref,at);}
 const prior=steps.slice(0,index).filter(s=>s.kind==='model'&&practiceKey(s.fr)===practiceKey(step.fr));
 if(!prior.some(s=>refs.has(s.id+':complete')))return false;
 // In production, I prepared / I have prepared are the same French target.
 const same=prior.filter(s=>direction(s)===direction(step)&&(direction(step)==='say'||key(s.en)===key(step.en)));
 const wrong=entries.filter(e=>e.score?.total>0&&e.score.correct<e.score.total&&prior.some(s=>e.source?.ref===s.id+':first')).map(e=>Number(e.at)||0);
 const latestHelp=Math.max(-1,ledger?.lastFailure(step.fr)??-1,...wrong,...prior.map(s=>refs.get(helpRef(s))??-1));
 const successful=same.filter(s=>refs.has(knownRef(s))&&refs.has(s.id+':complete')&&refs.get(knownRef(s))>latestHelp);
 if(!successful.length)return false;
 const last=successful.at(-1),lastAt=steps.findIndex(s=>s.id===last.id);
 const between=steps.slice(lastAt+1,index).filter(s=>refs.has(s.id+':complete')).length;
 const spaced=successful.some((s,i)=>i>0&&steps.slice(steps.findIndex(x=>x.id===successful[i-1].id)+1,steps.findIndex(x=>x.id===s.id)).filter(x=>refs.has(x.id+':complete')).length>=2);
 return between<2||spaced;
}
export function mixHistory(step,entries){
 const prefix=step.id+':mix:',byKey=new Map();
 for(const e of entries){const ref=e.source?.ref||'';if(!ref.startsWith(prefix))continue;
  const match=ref.slice(prefix.length).match(/^(\d+(?:-\d+)*):(known|help)$/);if(!match)continue;
  const indices=match[1].split('-').map(Number);if(indices.length!==step.workshop.piles.length||indices.some((n,i)=>!step.workshop.piles[i].items[n]))continue;
  const at=Number(e.at)||0,old=byKey.get(match[1]);if(!old||at>=old.at)byKey.set(match[1],{indices,key:match[1],known:match[2]==='known',at});
 }
 const successes=[...byKey.values()].filter(x=>x.known);
 const used=step.workshop.piles.map((_,i)=>new Set(successes.map(x=>x.indices[i])));
 const total=step.workshop.piles.reduce((n,p)=>n+p.items.length,0),covered=used.reduce((n,s)=>n+s.size,0);
 return {attempted:byKey.size,successes,used,total,covered,ready:successes.length>=2&&covered===total};
}
export function suggestMix(step,history){
 return step.workshop.piles.map((p,i)=>{const missing=p.items.findIndex((_,j)=>!history.used[i].has(j));return missing<0?history.successes.length%p.items.length:missing;});
}

export function familiarIntro(step,steps,entries,ledger=null){
 if(step?.track!=='unlocking'||step.unlockAction!=='introduce'||step.discovery)return step;
 const prior=steps.filter(s=>s.id!==step.id&&s.kind==='model'&&practiceKey(s.fr)===practiceKey(step.fr)&&s.unlockAction!=='reverse');
 let known=-1,help=ledger?.lastFailure(step.fr)??-1;
 const refs=new Set(entries.map(e=>e.source?.ref));
 for(const s of prior)for(const e of entries){
  const at=Number(e.at)||0;
  if(e.source?.ref===knownRef(s)&&refs.has(s.id+':complete'))known=Math.max(known,at);
  if(e.source?.ref===helpRef(s)||e.source?.ref===s.id+':first'&&e.score?.total>0&&!e.score.correct)help=Math.max(help,at);
 }
 return known>help?{...step,unlockAction:'recall',modelInitiallyShown:false,familiarRecall:true,prompt:'You have used this building block before. Can you still say it without looking?'}:step;
}

// Shared recency policy. Audit rows are already learner/account scoped.
// Oral self-checks and dictation never count as independent translation.
export const PRACTICE_COOLDOWN=30*60000, PRACTICE_DAY=24*60*60000;
export const practiceKey=s=>String(s??'').normalize('NFC').toLowerCase().replace(/[’‘]/g,"'").replace(/[«»“”".!?,;:]+/g,' ').replace(/\s+/g,' ').trim();

// Compare substantive content and the first grammatical frame. Appending a
// familiar clause, swapping meal/lunch in a long sentence or adding "hier"
// is not a genuinely new context. Changing person/tense can be meaningful.
const variationNoise=new Set(("le la les un une des du de au aux ce cet cette ces je tu il elle on nous vous ils elles me te se ne pas et ou mais donc car parce que puis alors hier demain aujourd'hui encore déjà à en y pour dans sur avec sans j'ai ai as a avons avez ont suis es est sommes êtes sont vais vas va allons allez vont veux veut dois doit peux peut voudrais").split(' '));
const contentSet=s=>new Set(practiceKey(s).split(' ').filter(w=>w&&!variationNoise.has(w)));
const primaryFrame=s=>practiceKey(s).replace(/^(?:hier|demain|aujourd'hui|ce matin|ce soir)\s+/,'').match(/^(?:j'ai|j'avais|j'étais|j'aurai|je (?:vais|veux|dois|peux|voudrais|suis|ne|n'ai)|(?:nous|vous|tu|il|elle|ils|elles|on)\s+\S+|je)\b/)?.[0]||'';
const clauseCount=s=>practiceKey(s).split(/\s+(?:et|mais|donc|car|parce que|puis)\s+/).length;
export function meaningfulVariation(a,b){
 const x=practiceKey(a),y=practiceKey(b);
 if(!x||!y||x===y)return false;
 const A=contentSet(x),B=contentSet(y);
 if(!A.size||!B.size)return false;
 const common=[...A].filter(w=>B.has(w)).length,small=Math.min(A.size,B.size),large=Math.max(A.size,B.size);
 const frameA=primaryFrame(x),frameB=primaryFrame(y);
 // A different explicit grammatical frame is useful for a single clause.
 if(clauseCount(x)===1&&clauseCount(y)===1&&frameA&&frameB&&frameA!==frameB)return true;
 // One sentence is merely an extension of another or mostly the same.
 if(common===small||common/large>=.7||common/small>=.8)return false;
 return true;
}

const containsPractice=(sentence,target)=>!!practiceKey(target)&&(' '+practiceKey(sentence)+' ').includes(' '+practiceKey(target)+' ');
const isIndependent=a=>a.targetLang==='fr'&&a.result==='correct'&&a.support==='none'&&!!a.answer&&
 !['transcribe','listen','choice','workshop','model'].includes(a.context?.kind)&&
 !/^(?:Listen|Dictation|Which spelling)/i.test(a.question||'')&&
 !['dictation','listening'].includes(a.signal?.mode)&&
 !['revision-v1','listening-rebuild-v1','unscored','choice-v1','letter-v1'].includes(a.marker)&&
 practiceKey(a.answer)===practiceKey(a.expected);
export function practiceLedger(audits=[],track,now=Date.now()){
 const rows=audits.map(x=>({a:x.answerAudit||x,at:Number(x.at)||Date.parse(x.at)||0})).filter(x=>x.at>0&&x.at<=now&&x.a.context?.track===track&&x.a.result!=='signal').sort((x,y)=>x.at-y.at);
 const seen=new Map(),correct=new Map(),wrong=new Map();
 for(const {a,at} of rows){
  const fr=a.targetLang==='fr'?a.expected:a.context?.fr;
  const k=practiceKey(fr);if(!k)continue;
  seen.set(k,at);
  if(a.targetLang==='fr'&&['incorrect','unknown','revealed'].includes(a.result))wrong.set(k,at);
  if(isIndependent(a)){const refs=correct.get(k)||new Map();refs.set(a.ref||String(at),at);correct.set(k,refs);}
 }
 const lastSeen=fr=>seen.get(practiceKey(fr))??null;
 const recentlySeen=fr=>lastSeen(fr)!==null&&now-lastSeen(fr)<PRACTICE_COOLDOWN;
 const recentlySimilar=fr=>recentlySeen(fr)||practiceKey(fr).split(' ').length>=3&&[...seen].some(([other,at])=>now-at<PRACTICE_COOLDOWN&&other.split(' ').length>=3&&!meaningfulVariation(fr,other));
 const lastFailure=fr=>wrong.get(practiceKey(fr))??-1;
 const recallCount=fr=>[...(correct.get(practiceKey(fr))?.values()||[])].filter(at=>at>lastFailure(fr)&&now-at<=PRACTICE_DAY).length;
 const saturated=fr=>recallCount(fr)>=2;
 const longest=Math.max(0,...[...correct.keys()].filter(s=>recallCount(s)>0).map(s=>s.split(' ').length));
 function deferralUntil(row){
  // Only postpone a current weak-spot drill, never cancel a delayed review,
  // manual request or a separate listening/pronunciation skill.
  if(!row?.lastDifficulty||!row.word||row.level>0||['pronunciation','manual','recognition'].includes(row.lastDifficulty.kind))return null;
  const difficulty=Number(row.lastDifficulty.at)||0;if(!difficulty||now-difficulty>PRACTICE_DAY)return null;
  const action=row.lastAction;
  if(action?.kind==='review'&&action.correct&&action.at>=difficulty)return null;
  const since=Math.max(difficulty,Number(action?.at)||0);
  const contexts=[];
  const lastTargetFailure=Math.max(since,...[...wrong].filter(([fr])=>containsPractice(fr,row.word)).map(([,at])=>at));
  for(const [fr,attempts] of correct){
   if(!containsPractice(fr,row.word))continue;
   const first=Math.min(...[...attempts.values()].filter(at=>at>lastTargetFailure));
   if(Number.isFinite(first))contexts.push({fr,at:first});
  }
  contexts.sort((a,b)=>a.at-b.at);
  for(let i=1;i<contexts.length;i++)if(contexts.slice(0,i).some(x=>meaningfulVariation(x.fr,contexts[i].fr)))return contexts[i].at+PRACTICE_DAY;
  return null;
 }
 const targetSatisfied=row=>(deferralUntil(row)??0)>now;
 return {lastSeen,recentlySeen,recentlySimilar,lastFailure,recallCount,saturated,longest,deferralUntil,targetSatisfied};
}
export function deferRepeatedTargets(rows,ledger,now=Date.now()){
 return rows.map(row=>{const until=ledger.deferralUntil(row);return until&&until>now&&row.dueAt!==null&&row.dueAt<until?{...row,originalDueAt:row.dueAt,dueAt:until,due:false,practiceDeferred:true}:row;}).sort((a,b)=>Number(b.due)-Number(a.due)||(a.due&&b.due?b.score-a.score:0)||(a.dueAt??Infinity)-(b.dueAt??Infinity)||b.score-a.score||a.key.localeCompare(b.key));
}
export function sharedBypass(step,ledger){
 if(!step||step.track!=='unlocking'||!ledger||['repair','independent','transfer','review'].includes(step.stage))return false;
 if(step.kind==='model'&&['recall','build'].includes(step.unlockAction))return ledger.saturated(step.fr);
 if(step.kind==='write'&&step.stage==='guided')return ledger.saturated(step.fr);
 return false;
}
