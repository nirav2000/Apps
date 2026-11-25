// Private French-only answer audit. It deliberately does not enter the shared
// learning-evidence store or its accuracy/retention calculations.
import {normaliseAnswer,DRILLS} from './data.js';
import {compareFrench,correctionSummary} from './revision-signals.js';
import {ALL_UNITS,guidedLesson} from './guided-lessons.js';
import {STAGES,assessmentDeck} from './assessment.js';
export const ANSWER_APP='next-french-answers';
const copy=x=>JSON.parse(JSON.stringify(x));
const h=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const text=x=>String(x??'');
const uid=()=>globalThis.crypto?.randomUUID?.()||'answer-'+Date.now()+'-'+Math.random().toString(36).slice(2);
export function createAnswerHistory({accountId,learnerId,storage=globalThis.localStorage}){
  if(!accountId||!learnerId)throw Error('Answer history requires a signed-in learner');
  const scope={appId:ANSWER_APP,accountId,learnerId};
  const key='next-french-answers-v1:'+accountId+':'+learnerId;
  const belongs=x=>x?.schema===1&&x.appId===scope.appId&&x.accountId===accountId&&x.learnerId===learnerId&&typeof x.id==='string'&&x.answerAudit?.version===1;
  const saved=JSON.parse(storage.getItem(key)||'[]');
  let rows=Array.isArray(saved)?saved.filter(belongs):[];
  const persist=next=>{storage.setItem(key,JSON.stringify(next));rows=next;};
  return {scope,key,getEntries:()=>copy(rows),
    record(a){
      if(!a.ref||!a.question||!['correct','incorrect','unknown','revealed','model','signal'].includes(a.result))throw Error('Incomplete answer audit');
      const at=Date.now();
      const row={schema:1,id:uid(),...scope,at,updatedAt:at,phase:'audit',concept:'answer-audit',support:'unknown',
        score:{correct:0,total:0},source:{kind:'french-answer-audit',ref:'answer-history:'+a.ref},
        answerAudit:{version:1,ref:text(a.ref),activity:text(a.activity),question:text(a.question),answer:a.answer==null?null:text(a.answer),
          expected:text(a.expected),result:a.result,reason:text(a.reason),support:text(a.support),marker:text(a.marker),
          normalizedAnswer:a.normalizedAnswer==null?null:text(a.normalizedAnswer),
          accepted:Array.isArray(a.accepted)?a.accepted.map(text):[],checkGroup:text(a.checkGroup),
          ...(a.targetLang?{targetLang:text(a.targetLang)}:{}),...(Array.isArray(a.typing)&&a.typing.length?{typing:copy(a.typing)}:{}),...(a.signal?{signal:copy(a.signal)}:{})}};
      persist([...rows,row]);return copy(row);
    },
    ingest(incoming){
      const map=new Map(rows.map(x=>[x.id,x]));let changed=0;
      for(const raw of incoming||[]){
        // The generic transport strips redundant 0/0 scores on ingest.
        const row={...raw,score:{correct:0,total:0}};
        if(!belongs(row))throw Error('Answer history scope mismatch');
        if(!map.has(row.id)){map.set(row.id,row);changed++;}
      }
      if(changed)persist([...map.values()]);return changed;
    }
  };
}
export function exactAudit(answer,expected,correct,{normalize=normaliseAnswer,reason='',marker='exact-phrase-v1',...rest}={}){
  const got=normalize(answer),want=normalize(expected);
  const unaccent=x=>x.normalize('NFD').replace(/[\u0300-\u036f]/g,'');
  let detail;
  if(correct)detail='Matched an accepted answer.';
  else if(!got)detail='No answer submitted.';
  else if(unaccent(got)===unaccent(want))detail='The letters match, but an accent differs.';
  else {
    const a=got.split(/\s+/),b=want.split(/\s+/);let i=0;
    while(i<Math.max(a.length,b.length)&&a[i]===b[i])i++;
    detail=i<Math.max(a.length,b.length)?'First differing word '+(i+1)+': '+(a[i]?'“'+a[i]+'”':'missing')+'; expected '+(b[i]?'“'+b[i]+'”':'no additional word')+'.':'Does not match an accepted form.';
    detail+=' A different valid translation may need human review.';
  }
  return {...rest,answer,expected,result:correct?'correct':got?'incorrect':'unknown',reason:(reason?reason+' ':'')+detail,marker,normalizedAnswer:got,accepted:[want]};
}
const groupFor=ref=>/^assess-v1:[^:]+:[^:]+:\d+:(?:recall|transfer|application)$/.test(ref)?ref.split(':').slice(0,3).join(':'):'';
const bank=()=>{
  const map=new Map();
  for(const u of ALL_UNITS){
    for(const stage of STAGES)for(const item of assessmentDeck(u.id,stage.id))map.set(item.ref,{question:item.en,expected:item.fr,activity:u.name+' · '+stage.label,checkGroup:groupFor(item.ref)});
    for(const item of guidedLesson(u.id).steps)map.set(item.id+':first',{question:item.kind==='listen'?'Listen: '+item.fr:item.kind==='transcribe'?'Dictation: '+item.fr:item.en,expected:item.kind==='listen'?item.en:item.fr,activity:u.name+' · Guided lesson'});
  }
  for(const item of DRILLS)map.set(item.id,{question:item.prompt,expected:item.answer,activity:'Sentence practice'});
  return map;
};
// Old evidence can identify the question and score but cannot recreate a typed
// answer. Label those rows explicitly rather than inventing historical text.
export function visibleHistory(auditRows,evidence){
  const exact=auditRows.filter(x=>x.answerAudit.result!=='signal').map(x=>({...x.answerAudit,id:x.id,at:x.at,legacy:false}));
  const existing=new Set(exact.map(x=>x.ref));
  const scored=evidence.filter(e=>e.score?.total>0);
  const seen=new Map();
  for(const e of scored){
    const ref=e.source?.ref||'',group=groupFor(ref);
    if(group){if(!seen.has(group))seen.set(group,new Set());seen.get(group).add(ref);}
  }
  const known=bank();
  const groupSizes=new Map();
  for(const item of known.values())if(item.checkGroup)groupSizes.set(item.checkGroup,(groupSizes.get(item.checkGroup)||0)+1);
  const old=scored.filter(e=>!existing.has(e.source?.ref)).map(e=>{
    const ref=e.source?.ref||'';
    const item=known.get(ref);
    const error=evidence.find(x=>x.source?.ref?.startsWith(ref+':error:'))?.source.ref.split(':').at(-1);
    return {id:e.id,at:e.at,ref,activity:item?.activity||'Earlier French activity',question:item?.question||'Original question not retained',expected:item?.expected||null,answer:null,
      result:e.score.correct===e.score.total?'correct':'incorrect',reason:'Earlier score only. Exact submitted text was not saved.'+(error?' Recorded error category: '+error+'.':''),support:e.support,marker:'legacy-score',accepted:[],checkGroup:item?.checkGroup||'',legacy:true};
  });
  return [...exact,...old].map(x=>{
    if(x.checkGroup&&(seen.get(x.checkGroup)?.size||0)<(groupSizes.get(x.checkGroup)||8))return {...x,expected:null,reason:'Correction available when the independent check is complete.',result:'withheld',accepted:[],normalizedAnswer:null,typing:[]};
    return x;
  }).sort((a,b)=>b.at-a.at||b.id.localeCompare(a.id));
}
function markedHistory(value,changes){
 const src=text(value);let out='',cursor=0;
 for(const change of changes){out+=h(src.slice(cursor,change.start))+'<mark class="ft-word-difference">'+h(change.text)+'</mark>';cursor=change.end;}
 return out+h(src.slice(cursor));
}
export function answerHistoryPage(rows,filter='all',limit=50){
  const filtered=rows.filter(x=>filter==='all'||(filter==='incorrect'?['incorrect','unknown'].includes(x.result):x.result===filter));
  const labels={correct:'Correct',incorrect:'Marked incorrect',unknown:'No answer',revealed:'Revealed',model:'Spoken / unscored',withheld:'Check in progress'};
  return '<section class="ft-card ft-answer-history"><p class="ft-eyebrow">PRIVATE LEARNING RECORD</p><h2>Answer history</h2><p>See what was submitted, the expected answer and why the marker made its decision. Earlier scores may have no original text. A valid alternative can be rejected by exact-match marking.</p>'+
    '<div class="ft-actions"><label>Show <select data-history-filter><option value="all"'+(filter==='all'?' selected':'')+'>All attempts</option><option value="incorrect"'+(filter==='incorrect'?' selected':'')+'>Incorrect / no answer</option><option value="correct"'+(filter==='correct'?' selected':'')+'>Correct</option></select></label><button type="button" data-act="export-answers">Export answer history</button><button type="button" data-act="sync">Sync</button></div>'+
    '<p class="ft-small">'+filtered.length+' matching records · newest first · stored separately for each learner</p>'+
    (filtered.length?filtered.slice(0,limit).map(x=>{
      const fr=x.targetLang==='fr'||!x.targetLang&&['guided-exact-v1','curriculum-v1','assessment-v1'].includes(x.marker);
      const diff=x.result==='incorrect'&&fr&&x.answer&&x.expected?compareFrench(x.answer,x.expected).filter(d=>d.kind!=='match'):[];
      const left=diff.filter(d=>d.left).map(d=>d.left),right=diff.filter(d=>d.right).map(d=>d.right);
      return '<article class="ft-audit-row '+h(x.result)+'"><div class="ft-audit-meta"><strong>'+h(labels[x.result]||x.result)+'</strong><small>'+h(new Date(x.at).toLocaleString('en-GB'))+' · '+h(x.activity)+'</small></div><p class="ft-audit-question">'+h(x.question)+'</p><div class="ft-audit-pair"><div><small>Your answer</small><p>'+markedHistory(x.answer==null?(x.legacy?'Not recorded in older version':x.result==='model'?'Spoken answer not recorded':'Not submitted'):x.answer||'—',left)+'</p></div><div><small>Expected answer</small><p>'+markedHistory(x.expected??(x.result==='withheld'?'Hidden until check complete':'Not retained'),right)+'</p></div></div><p class="ft-audit-reason">'+h(diff.length?correctionSummary(x.answer,x.expected):x.reason)+'</p>'+
      (x.normalizedAnswer!=null&&x.result!=='withheld'?'<details><summary>Marking details</summary><p>Marker: '+h(x.marker)+'</p><p>Compared input: '+h(x.normalizedAnswer||'—')+'</p><p>Accepted forms: '+h(x.accepted.join(' / '))+'</p><p>Support: '+h(x.support||'Not specified')+'</p></details>':'')+(x.typing?.length&&x.result!=='withheld'?'<details><summary>Word typing observations</summary>'+x.typing.map(w=>'<p>'+h(w.word)+' · '+w.msPerChar+' ms per character'+(w.startDelayMs!=null?' · '+w.startDelayMs+' ms before word':'')+(w.slow?' · '+(w.mode==='before-word'?'hesitated before word':'slower than other words'):'')+'</p>').join('')+'</details>':'')+'</article>';}).join(''):'<p>No matching answers yet.</p>')+
    (filtered.length>limit?'<button type="button" data-act="more-answers">Show more</button>':'')+'</section>';
}
