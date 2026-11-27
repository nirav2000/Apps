import {compareFrench,containsTarget,wordKey,likelyTypingSlip,missedLanguageTargets} from './revision-signals.js';
import {markAnswer} from './data.js';
const h=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
// Distinguish a missing/wrong word or phrase from a first near-spelling error.
// These are teaching decisions, not diagnoses of a person's memory.
export function repairDecision(answer,expected,prior=[],revealed=false){
 if(!revealed&&markAnswer(answer,expected))return null;
 if(!revealed&&likelyTypingSlip(answer,expected))return null;
 const changes=compareFrench(answer,expected).filter(x=>x.kind!=='match');
 if(revealed||!String(answer||'').trim()||!changes.length||changes.some(x=>!x.near))return {kind:'meaning',label:'Relearn this expression',reason:'A word or expression was missing or different. Look at its meaning, hear it and try again without the model.',targets:revealed?[]:missedLanguageTargets(answer,expected).map(t=>t.word)};
 const repeated=changes.some(c=>prior.some(r=>r.counts?.spelling>=1&&containsTarget(c.right?.text||'',r.word)||r.signals?.some(s=>s.kind==='review'&&!s.correct)&&containsTarget(expected,r.word)));
 return repeated?{kind:'spelling',label:'Practise the spelling again',reason:'This spelling has caused difficulty before. Notice the changed letters, then cover the model and rebuild it.',targets:[...new Set(changes.filter(c=>c.near&&c.right).map(c=>c.right.text))]}:null;
}
export function revisionResultsMarkup(rows,{summary=false,partial=false,auto=true}={}){
 const correct=rows.filter(r=>r.result==='correct'&&!r.assisted).length,assisted=rows.filter(r=>r.result==='correct'&&r.assisted).length,wrong=rows.length-correct-assisted;
 const body='<p class="ft-small">'+correct+' correct without extra help · '+assisted+' correct with help · '+wrong+' incorrect or revealed. Supported rebuilds do not change the first result.</p>'+rows.map((r,i)=>'<article class="ft-revision-result '+(r.result==='correct'?'correct':'incorrect')+'"><div class="ft-revision-result-head"><strong>'+String(i+1)+'. '+h(r.question||'Listen and type the French')+'</strong><small>'+h(r.result==='correct'?'Correct':r.result==='revealed'?'Model revealed':'Needs work')+'</small></div><div class="ft-revision-result-pair"><div><small>Your answer</small><p lang="fr">'+h(r.answer||'No answer submitted')+'</p></div><div><small>Correct French</small><p lang="fr">'+h(r.expected)+'</p></div></div>'+(r.english?'<p class="ft-small">Meaning: '+h(r.english)+'</p>':'')+(r.repair?'<p class="ft-small">'+h(r.repair)+'</p>':'')+'</article>').join('');
 return summary?'<section class="ft-card ft-revision-results"><p class="ft-eyebrow">'+(partial?'REVISION PAUSED':'REVISION COMPLETE')+'</p><h2>What to remember</h2>'+body+'<button type="button" class="ft-primary" data-act="revision-summary-continue" data-ft-advance>'+(auto?'Continue learning →':'Return to revision signals →')+'</button></section>':body;
}
export function lastRevisionBatch(audits,track){
 const rows=audits.filter(r=>r.answerAudit?.marker==='revision-v1'&&r.answerAudit.context?.revisionBatch&&r.answerAudit.context.track===track).sort((a,b)=>a.at-b.at);
 const batch=rows.at(-1)?.answerAudit.context.revisionBatch;
 if(!batch)return [];
 return rows.filter(r=>r.answerAudit.context.revisionBatch===batch).map(r=>{const a=r.answerAudit;return {question:a.question,answer:a.answer,expected:a.expected,english:a.context.en||'',result:a.result,assisted:a.support!=='none'};});
}
