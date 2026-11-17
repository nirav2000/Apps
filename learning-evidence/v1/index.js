// Shared Learning Evidence v1: additional, scoped, local-first records.
// Never includes raw answers, speech, media or credentials. No automatic guest migration.
export const LEARNING_EVIDENCE_VERSION = '1.0.0';
export const REVIEW_DAYS = Object.freeze([1, 7, 28]);
const DAY = 86400000;
const PHASES = new Set(['diagnostic','practice','retrieval','transfer']);
const SUPPORT = new Set(['none','small-prompt','substantial-hint','worked-example','unknown']);
const clean = x => String(x ?? '').trim().slice(0,128).replace(/[^\w.:-]/g,'-');
const num = x => Number.isFinite(Number(x)) ? Math.max(0,Math.floor(Number(x))) : 0;
const stamp = x => {
  if (x === '' || x == null) return null;
  const n = typeof x === 'number' ? x : Date.parse(x);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : null;
};
const uid = () => globalThis.crypto?.randomUUID?.() || 'manual-'+Date.now()+'-'+Math.random().toString(36).slice(2);
const copy = o => JSON.parse(JSON.stringify(o));
const percent = (n,d) => d ? Math.round(n*1000/d)/10 : null;
const metric = rows => {
  const total = rows.reduce((n,x)=>n+x.score.total,0);
  const correct = rows.reduce((n,x)=>n+x.score.correct,0);
  return {correct,total,percent:percent(correct,total),checks:rows.length};
};
const independentMetric = rows => {
  const known = rows.filter(x=>x.support!=='unknown');
  const total = known.reduce((n,x)=>n+x.score.total,0);
  const correct = known.filter(x=>x.support==='none').reduce((n,x)=>n+x.score.correct,0);
  return {correct,total,percent:percent(correct,total),checks:known.length,unknownSupport:rows.length-known.length};
};

export function normalizeEvidence(raw, scope={}) {
  if (!raw || typeof raw!=='object') throw Error('Learning evidence record required');
  const appId = clean(scope.appId || raw.appId);
  const accountId = clean(scope.accountId || raw.accountId || 'guest');
  const learnerId = clean(scope.learnerId || raw.learnerId);
  const concept = String(raw.concept || raw.conceptId || '').trim().slice(0,160);
  if (!appId || !accountId || !learnerId || !concept) throw Error('App/account/learner/concept required');
  const at = stamp(raw.at ?? raw.timestamp ?? raw.createdAt) || Date.now();
  // Canonical UTC calendar day keeps a teaching marker and subsequent dated checks in one cycle.
  const taughtStamp = stamp(raw.taughtAt);
  const taughtAt = taughtStamp ? Math.floor(taughtStamp/DAY)*DAY : null;
  const hasScore = raw.correctCount != null || typeof raw.correct === 'boolean';
  const total = hasScore ? num(raw.total ?? 1) : 0;
  const correct = raw.correctCount == null ? (raw.correct === true ? total : 0) : Math.min(total,num(raw.correctCount));
  if (hasScore && total < 1) throw Error('A scored check must contain questions');
  if (hasScore && raw.correctCount != null && num(raw.correctCount)>total) throw Error('Correct count exceeds total');
  const phase = PHASES.has(raw.phase) ? raw.phase : 'practice';
  const support = SUPPORT.has(raw.support) ? raw.support : 'unknown';
  const source = raw.source && typeof raw.source === 'object'
    ? {kind:clean(raw.source.kind || 'app'),ref:String(raw.source.ref || '').slice(0,180)}
    : {kind:'manual',ref:''};
  return {schema:1,id:clean(raw.id)||uid(),appId,accountId,learnerId,concept,phase,
    at,updatedAt:stamp(raw.updatedAt)||at,taughtAt:taughtAt && taughtAt<=at?taughtAt:null,
    score:{correct,total},support,novel:raw.novel===true,durationMs:raw.durationMs==null?null:num(raw.durationMs),source};
}

export function dueReviews(entries=[], now=Date.now()) {
  const grouped = new Map();
  for (const item of entries) {
    if(item?.schema!==1||!item.taughtAt)continue;
    const key = [item.appId,item.accountId,item.learnerId,item.concept].join('|');
    if(!grouped.has(key))grouped.set(key,[]);
    grouped.get(key).push(item);
  }
  const upcoming=[];
  for (const group of grouped.values()) {
    const anchor=Math.max(...group.map(x=>x.taughtAt));
    const rows=group.filter(x=>x.taughtAt===anchor);
    const completed=REVIEW_DAYS.map((day,i)=>{
      const next=REVIEW_DAYS[i+1] || Infinity;
      return rows.some(x=>x.phase==='retrieval'&&x.score?.total>0 &&
        x.at>=anchor+day*DAY && x.at<anchor+next*DAY);
    });
    const elapsed=(now-anchor)/DAY;
    const currentIndex=REVIEW_DAYS.reduce((idx,day,i)=>elapsed>=day?i:idx,-1);
    let index=-1;
    if(currentIndex>=0) {
      if(!completed[currentIndex])index=currentIndex;
      else index=completed.findIndex((done,i)=>i>currentIndex&&!done);
    } else index=completed.findIndex(done=>!done);
    if(index<0)continue;
    upcoming.push({concept:rows[0].concept,appId:rows[0].appId,days:REVIEW_DAYS[index],
      dueAt:anchor+REVIEW_DAYS[index]*DAY,overdue:now>=anchor+REVIEW_DAYS[index]*DAY});
  }
  return upcoming.sort((a,b)=>Number(b.overdue)-Number(a.overdue)||a.dueAt-b.dueAt||a.concept.localeCompare(b.concept));
}

export function summariseEvidence(entries=[],now=Date.now()) {
  const rows=(Array.isArray(entries)?entries:[]).filter(x=>x?.schema===1&&x.score);
  const scored=rows.filter(x=>x.score.total>0);
  const delayed=scored.filter(x=>x.phase==='retrieval'&&x.taughtAt&&x.at-x.taughtAt>=7*DAY);
  const transfers=scored.filter(x=>x.phase==='transfer'&&x.novel===true);
  return {count:rows.length,concepts:new Set(rows.map(x=>x.concept)).size,
    accuracy:metric(scored),independence:independentMetric(scored),
    retention:independentMetric(delayed),transfer:independentMetric(transfers),due:dueReviews(rows,now)};
}

// Converts a check into one compatible Learning SDK event. Not automatically enabled:
// the consumer must avoid double-capturing activity it already recorded.
export function toLearningEvent(row) {
  const x=normalizeEvidence(row);
  return {concept:x.concept,correct:x.score.total>0 && x.score.correct===x.score.total && x.support==='none',
    hints:x.support==='none'?0:x.support==='small-prompt'?1:x.support==='substantial-hint'?2:3,
    durationMs:x.durationMs||0,timestamp:x.at,mode:'evidence:'+x.phase,
    context:{learningEvidenceV1:{id:x.id,correct:x.score.correct,total:x.score.total,phase:x.phase,
      support:x.support,taughtAt:x.taughtAt,novel:x.novel,source:x.source}}};
}

export function createEvidenceStore({appId,learnerId='local',accountId='guest',
  storage=typeof localStorage==='undefined'?null:localStorage}={}) {
  const scope={appId:clean(appId),learnerId:clean(learnerId),accountId:clean(accountId)};
  if(!scope.appId||!scope.learnerId||!scope.accountId)throw Error('Explicit evidence scope required');
  const key='apps-learning-evidence-v1:'+scope.appId+':'+scope.accountId+':'+scope.learnerId;
  let entries=[],listeners=new Set();
  try {
    const saved=JSON.parse(storage?.getItem(key)||'null');
    if(saved?.schema===1&&Array.isArray(saved.entries))entries=saved.entries.filter(x=>
      x?.schema===1&&x.appId===scope.appId&&x.accountId===scope.accountId&&x.learnerId===scope.learnerId);
  }catch(error){console.warn('Learning Evidence: could not load local records',error);}
  const write=raw=>{
    const item=normalizeEvidence(raw,scope);
    const i=entries.findIndex(x=>x.id===item.id);
    if(i>=0&&entries[i].updatedAt>item.updatedAt)return entries[i];
    const next=entries.slice();
    if(i>=0)next[i]=item;else next.push(item);
    if(!storage)throw Error('Local evidence storage unavailable');
    storage.setItem(key,JSON.stringify({schema:1,entries:next}));
    entries=next;
    for(const cb of listeners)cb();
    return item;
  };
  return {key,scope,record:write,
    // Batch once: importing a full learning history must not rewrite localStorage per event.
    ingest:items=>{
      const next=entries.slice(),lookup=new Map(next.map((x,i)=>[x.id,i]));
      let changed=0;
      for(const raw of items||[]){
        const row=normalizeEvidence(raw,scope),i=lookup.get(row.id);
        if(i!==undefined && next[i].updatedAt>=row.updatedAt)continue;
        if(i===undefined){lookup.set(row.id,next.length);next.push(row);}
        else next[i]=row;
        changed++;
      }
      if(changed){
        if(!storage)throw Error('Local evidence storage unavailable');
        storage.setItem(key,JSON.stringify({schema:1,entries:next}));
        entries=next;
        for(const cb of listeners)cb();
      }
      return changed;
    },
    getEntries:()=>copy(entries),
    summary:(at=Date.now())=>summariseEvidence(entries,at),
    due:(at=Date.now())=>dueReviews(entries,at),
    exportJSON:()=>JSON.stringify({schema:1,scope,entries},null,2),
    subscribe:cb=>{listeners.add(cb);return()=>listeners.delete(cb);}
  };
}
