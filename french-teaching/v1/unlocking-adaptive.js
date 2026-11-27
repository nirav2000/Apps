// Non-scoring self-reported recall controls the amount of identical practice.
// A bypass is a separate resolution, never an exposure or scored success.
const key=s=>String(s||'').normalize('NFC').toLowerCase().replace(/[’‘]/g,"'").replace(/[.!]+$/,'').replace(/\s+/g,' ').trim();
const direction=s=>s.unlockAction==='reverse'?'understand':'say';
export const skipRef=s=>s.id+':adaptive-skip';
export const knownRef=s=>s.id+':oral-known';
export const helpRef=s=>s.id+':oral-retry';
export function repeatDecision(step,steps,entries){
 if(!step||step.track!=='unlocking'||step.kind!=='model'||!['recall','build','reverse'].includes(step.unlockAction)||['repair','independent','transfer','review'].includes(step.stage))return false;
 const index=steps.findIndex(s=>s.id===step.id);if(index<1)return false;
 const refs=new Map();
 for(const e of entries){const ref=e.source?.ref;if(!ref)continue;const at=Number(e.at)||0;if(!refs.has(ref)||at>refs.get(ref))refs.set(ref,at);}
 const prior=steps.slice(0,index).filter(s=>s.kind==='model'&&key(s.fr)===key(step.fr));
 if(!prior.some(s=>refs.has(s.id+':complete')))return false;
 const same=prior.filter(s=>direction(s)===direction(step)&&key(s.en)===key(step.en));
 const wrong=entries.filter(e=>e.score?.total>0&&e.score.correct<e.score.total&&prior.some(s=>e.source?.ref===s.id+':first')).map(e=>Number(e.at)||0);
 const latestHelp=Math.max(-1,...wrong,...prior.map(s=>refs.get(helpRef(s))??-1));
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

export function familiarIntro(step,steps,entries){
 if(step?.track!=='unlocking'||step.unlockAction!=='introduce'||step.discovery)return step;
 const prior=steps.filter(s=>s.id!==step.id&&s.kind==='model'&&key(s.fr)===key(step.fr)&&key(s.en)===key(step.en));
 let known=-1,help=-1;
 const refs=new Set(entries.map(e=>e.source?.ref));
 for(const s of prior)for(const e of entries){
  const at=Number(e.at)||0;
  if(e.source?.ref===knownRef(s)&&refs.has(s.id+':complete'))known=Math.max(known,at);
  if(e.source?.ref===helpRef(s)||e.source?.ref===s.id+':first'&&e.score?.total>0&&!e.score.correct)help=Math.max(help,at);
 }
 return known>help?{...step,unlockAction:'recall',modelInitiallyShown:false,familiarRecall:true,prompt:'You have used this building block before. Can you still say it without looking?'}:step;
}
