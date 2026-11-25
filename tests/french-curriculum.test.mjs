import test from 'node:test';
import assert from 'node:assert/strict';
import {GUIDED_UNITS,ALL_UNITS,ORIGINAL_UNITS,unitsForTrack,lessonRows,guidedLesson,guidedTeachingRef,guidedCompletionRefs,guidedStatus} from '../french-teaching/v1/guided-lessons.js';
import {assessmentDeck,STAGES,markAssessment,teachingFinishedAt,pendingChecks,assessmentStats,baselineFor,checkResult,pendingRepairs} from '../french-teaching/v1/assessment.js';
import {curriculumNormalize,curriculumVariants} from '../french-teaching/v1/curriculum-meta.js';
import {applicationPairs} from '../french-teaching/v1/curriculum-assessments.js';
import {visibleHistory,exactAudit} from '../french-teaching/v1/answer-history.js';
import {normalizeEvidence} from '../learning-evidence/v1/index.js';
const t=Date.parse('2026-11-24T09:00:00Z'),DAY=86400000;
let seq=0;
const ev=(ref,at,extra={})=>normalizeEvidence({id:'curr-'+(++seq),concept:'french:test',at,phase:'practice',support:'none',source:{kind:'french-course',ref},...extra},{appId:'next-french',accountId:'owner',learnerId:'sai'});
const lesson=u=>[ev(guidedTeachingRef(u.id),t),...guidedLesson(u.id).steps.map((s,i)=>ev(guidedCompletionRefs(s.id).complete,t+(i+1)*1000,{concept:s.concept}))];
const attempt=(u,stage,at)=>assessmentDeck(u.id,stage).map(x=>ev(x.ref,at,{concept:x.concept,phase:stage==='baseline'?'diagnostic':x.kind==='transfer'?'transfer':'retrieval',novel:stage!=='baseline'&&x.kind==='transfer',correctCount:1,total:1}));
test('three tracks preserve the original four lessons and add nineteen fully usable decks',()=>{
 assert.deepEqual(['michaela','sai','unlocking','unlocking-archive'].map(x=>unitsForTrack(x).length),[4,13,12,6]);
 assert.equal(ALL_UNITS.length,35);
 assert.equal(new Set(ALL_UNITS.map(x=>x.id)).size,35);
 assert.equal(GUIDED_UNITS.length,4);
 for(const u of ORIGINAL_UNITS){
   const rows=lessonRows(u),steps=guidedLesson(u.id).steps;
   assert.ok(rows.length>=8,u.id);
   assert.equal(new Set(steps.map(s=>s.id)).size,steps.length);
   assert.equal(steps.filter(s=>s.stage==='independent').length,rows.length);
   assert.equal(steps.filter(s=>s.kind==='transcribe').length,rows.length);
   for(const s of steps){
     assert.ok(s.fr&&s.en&&s.concept,s.id);
     if(s.choices)assert.equal(new Set(s.choices).size,3,s.id);
   }
   if(u.track){
     assert.equal(applicationPairs(u.id).length,12);
     const refs=new Set(),transfer=new Set();
     for(const stage of STAGES){
       const deck=assessmentDeck(u.id,stage.id);
       assert.equal(deck.length,rows.length+2);
       assert.equal(deck.filter(x=>x.kind==='recall').length,rows.length);
       for(const x of deck){
         assert.ok(x.en&&x.fr);assert.equal(markAssessment(x.fr,x).correct,true,x.ref);
         assert.ok(!refs.has(x.ref));refs.add(x.ref);
         if(x.kind==='transfer'){const norm=curriculumNormalize(x.fr);assert.ok(!transfer.has(norm));transfer.add(norm);}
       }
     }
   }
 }
});
test('seven-day checks are anchored to final teaching completion and scoped to a track',()=>{
 const u=unitsForTrack('sai')[0],rows=lesson(u),finish=teachingFinishedAt(u.id,rows,t+1000000);
 assert.ok(finish>t);
 assert.equal(guidedStatus(u.id,rows,finish+7*DAY).mode,'complete');
 assert.equal(pendingChecks(rows,finish+7*DAY,'michaela').length,0);
 assert.equal(pendingChecks(rows,finish+7*DAY,'unlocking').length,0);
 assert.equal(pendingChecks(rows,finish+7*DAY,'sai')[0].stage,'day7');
 assert.equal(pendingChecks(rows,finish+28*DAY,'sai')[0].stage,'day28');
 const base=attempt(u,'baseline',t-60000),late=attempt(u,'day7',finish+DAY);
 assert.equal(checkResult(u.id,'day7',[...rows,...late],finish+DAY).attempted.length,0);
 const es=[...base,...rows,...attempt(u,'day7',finish+7*DAY)];
 const stats=assessmentStats(es,finish+7*DAY+1000,28,'sai');
 assert.equal(stats.retention.percent,100);assert.equal(stats.gainPairs,lessonRows(u).length);
 assert.equal(stats.application.percent,100);
 assert.equal(assessmentStats(es,finish+7*DAY+1000,28,'unlocking').retention.percent,null);
 assert.equal(pendingRepairs(es,finish+7*DAY+1000,'sai').length,0);
});
test('new context is not automatically counted as unseen French; variants do not remove accents',()=>{
 const dates=assessmentDeck('sai-days','baseline');
 assert.ok(dates.slice(-2).every(x=>x.kind==='application'));
 const colours=assessmentDeck('sai-colours','baseline');
 assert.ok(colours.some(x=>x.fr.includes('marron')&&markAssessment('un chat brun',x).correct));
 assert.ok(curriculumVariants('Ça va bien','I am well').includes('je vais bien'));
 assert.equal(markAssessment('fevrier',{track:'sai',fr:'février',en:'February'}).error,'accents');
 assert.equal(markAssessment('tu aimes les chiens',{track:'sai',fr:'Est-ce que tu aimes les chiens ?',en:'Do you like dogs? (use est-ce que)'}).correct,false);
});
test('variable length assessment answers remain concealed until the entire check is complete',()=>{
 const u=unitsForTrack('sai')[0],deck=assessmentDeck(u.id,'baseline'),item=deck[0];
 const group=item.ref.split(':').slice(0,3).join(':');
 const audit=[{id:'a',at:t,answerAudit:exactAudit('wrong',item.fr,false,{ref:item.ref,activity:'baseline',question:item.en,checkGroup:group})}];
 const evidence=attempt(u,'baseline',t);
 assert.ok(deck.length>8);
 const partial=visibleHistory(audit,evidence.slice(0,8)).find(x=>x.id==='a');
 assert.equal(partial.result,'withheld');assert.equal(partial.expected,null);
 assert.equal(visibleHistory(audit,evidence).find(x=>x.id==='a').expected,item.fr);
});
test('audio context distinguishes written forms which sound the same',()=>{
 for(const id of ['sai-greetings','unlock-time']){
   const steps=guidedLesson(id).steps.filter(x=>['listen','transcribe'].includes(x.kind)&&/\b(male|female)\b/i.test(x.en));
   assert.ok(steps.length>=4,id);
   assert.ok(steps.every(x=>x.audioContext),id);
 }
});

test('incremental chapters introduce exactly one component before any use, cover answers, and revisit every block',()=>{
 const units=unitsForTrack('unlocking');
 assert.equal(units.length,12);
 for(const u of units){
   const seen=new Set(), steps=guidedLesson(u.id).steps;
   for(const step of steps){
     if(step.unlockAction==='introduce'){
       assert.equal(step.parts.length,1,step.id);
       assert.ok(!seen.has(step.parts[0]),step.id);
       assert.ok(step.pronunciation,step.id);
       assert.equal(step.modelInitiallyShown,true);
       seen.add(step.parts[0]);
     }else{
       assert.ok(step.parts.every(p=>seen.has(p)),step.id);
       assert.ok(!step.modelInitiallyShown,step.id);
     }
     assert.ok(step.en&&step.fr,step.id);
     if(step.unlockAction==='build')assert.ok(step.pronunciation&&step.components.length,step.id);
   }
   assert.equal(seen.size,u.blocks.length);
   assert.equal(steps.filter(s=>s.unlockAction==='reverse').length,u.blocks.length+3);
   assert.equal(steps.filter(s=>s.kind==='write').length,3);
   const refs=new Set();
   for(const stage of STAGES){
     const deck=assessmentDeck(u.id,stage.id);
     assert.equal(deck.length,u.blocks.length+5);
     for(const item of deck){
       assert.equal(markAssessment(item.fr,item).correct,true,item.ref);
       assert.ok(!refs.has(item.ref));refs.add(item.ref);
     }
   }
 }
});
test('old curriculum IDs remain available; rebuilt lessons have different evidence IDs',()=>{
 const old=unitsForTrack('unlocking-archive');
 assert.equal(old.length,6);
 const prior=lesson(old[0]);
 assert.equal(guidedStatus(old[0].id,prior,t+DAY).mode,'complete');
 assert.equal(guidedStatus('unlock2-past',prior,t+DAY).mode,'new');
 assert.equal(pendingChecks(prior,t+7*DAY,'unlocking').length,0);
});
test('oral difficulty schedules a revisit without scoring oral responses',()=>{
 const u=unitsForTrack('unlocking')[0],steps=guidedLesson(u.id).steps;
 const i=steps.findIndex(s=>s.unlockAction==='recall');
 const e=[ev(guidedTeachingRef(u.id),t),...steps.slice(0,i+3).map((s,j)=>ev(guidedCompletionRefs(s.id).complete,t+j+1,{concept:s.concept})),ev(steps[i].id+':oral-retry',t+i+1)];
 const status=guidedStatus(u.id,e,t+10000);
 assert.equal(status.next.stage,'repair');assert.equal(status.next.kind,'model');
 assert.equal(status.next.modelInitiallyShown,false);assert.equal(status.next.novel,false);
});
