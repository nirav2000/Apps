import test from 'node:test';
import assert from 'node:assert/strict';
import {GUIDED_UNITS,guidedLesson,guidedTeachingRef,guidedCompletionRefs} from '../french-teaching/v1/guided-lessons.js';
import {assessmentDeck,STAGES,markAssessment,teachingFinishedAt,pendingChecks,checkResult,baselineFor,assessmentStats,pendingRepairs,repairRef,experimentDeck,experimentStats} from '../french-teaching/v1/assessment.js';
import {ASSESSMENT_DAY as DAY,assessmentWindow,firstByRef,medianDuration} from '../learning-evidence/v1/assessment.js';
import {normalizeEvidence} from '../learning-evidence/v1/index.js';
const t=Date.parse('2026-11-24T09:00:00Z'),u=GUIDED_UNITS[0];
let seq=0;
const event=(ref,at,extra={})=>normalizeEvidence({id:'ev-'+(++seq),concept:'french:test',at,phase:'practice',support:'none',source:{kind:'french-course',ref},...extra},{appId:'next-french',accountId:'owner',learnerId:'adult'});
const lesson=()=>[event(guidedTeachingRef(u.id),t),...guidedLesson(u.id).steps.map((s,i)=>event(guidedCompletionRefs(s.id).complete,t+(i+1)*1000,{concept:s.concept}))];
const attempts=(stage,at,correct=true)=>assessmentDeck(u.id,stage).map(x=>event(x.ref,at,{concept:x.concept,phase:stage==='baseline'?'diagnostic':x.kind==='transfer'?'transfer':stage==='immediate'?'practice':'retrieval',novel:stage!=='baseline'&&x.kind==='transfer',correctCount:correct?1:0,total:1,durationMs:6000}));
test('all decks have eight unique stable items; transfer forms never repeat across stages or guided lesson models',()=>{
  for(const unit of GUIDED_UNITS){
    const known=new Set(guidedLesson(unit.id).steps.map(s=>s.fr.toLowerCase().replace(/[.,]/g,'').replace(/’/g,"'")));
    const seen=new Set();
    for(const s of STAGES){
      const deck=assessmentDeck(unit.id,s.id);
      assert.equal(deck.length,8);
      assert.deepEqual(deck,assessmentDeck(unit.id,s.id));
      for(const x of deck){
        assert.ok(x.en&&x.fr);
        assert.equal(markAssessment(x.fr,x).correct,true);
        if(x.kind==='transfer'){
          const key=x.fr.toLowerCase().replace(/[.,]/g,'').replace(/’/g,"'");
          assert.ok(!seen.has(key),key);assert.ok(!known.has(key),key);seen.add(key);
        }
      }
    }
    assert.ok(seen.size>=12,unit.id);
  }
});
test('accurate marking preserves accents, identifies negation and recognises curated television synonym',()=>{
  assert.deepEqual(markAssessment(" J’ écoute la radio ",{fr:"j'écoute la radio"}),{correct:false,error:'chunk'});
  assert.deepEqual(markAssessment("J’ecoute la radio.",{fr:"j'écoute la radio"}),{correct:false,error:'accents'});
  assert.equal(markAssessment("Je regarde la télé.",{fr:"je regarde la télévision"}).correct,true);
  assert.equal(markAssessment('je parle français',{fr:'je ne parle pas français'}).error,'negation');
  assert.equal(markAssessment('',{fr:'je parle français'}).error,'unknown');
});
test('baseline is prior to teaching; late check is not backfilled and windows anchor to final teaching completion',()=>{
  assert.ok(baselineFor(u.id,[],t));
  const baseline=attempts('baseline',t-60000);
  assert.equal(baselineFor(u.id,baseline,t),null);
  const taught=lesson(),finish=teachingFinishedAt(u.id,taught,t+100000);
  assert.ok(finish>t);
  assert.equal(teachingFinishedAt(u.id,taught.slice(0,-1),t+100000),null);
  assert.equal(pendingChecks(taught,finish-1).length,0);
  assert.equal(pendingChecks(taught,finish)[0].stage,'immediate');
  assert.equal(pendingChecks(taught,finish+DAY)[0].stage,'day1');
  assert.equal(pendingChecks(taught,finish+6*DAY)[0].stage,'day3');
  assert.equal(pendingChecks(taught,finish+7*DAY)[0].stage,'day7');
  assert.equal(pendingChecks(taught,finish+28*DAY)[0].stage,'day28');
  assert.equal(checkResult(u.id,'baseline',[...taught,...attempts('baseline',finish)],finish).attempted.length,0);
  assert.equal(checkResult(u.id,'day7',[...taught,...attempts('day7',finish+DAY)],finish+DAY).attempted.length,0);
});
test('no fabricated metrics; assisted and duplicate answers never inflate independent score; repair is not mastery',()=>{
  const empty=assessmentStats([],t);assert.equal(empty.retention.percent,null);assert.equal(empty.transfer.percent,null);
  assert.ok(empty.chart.every(p=>p.percent===null));
  const taught=lesson(),finish=teachingFinishedAt(u.id,taught,t+100000);
  const baseline=attempts('baseline',t-60000,false),immediate=attempts('immediate',finish+1000,true);
  const wrong=attempts('day7',finish+7*DAY,false);
  const all=[...baseline,...taught,...immediate,...wrong];
  const now=finish+7*DAY+2000;
  const stats=assessmentStats(all,now);assert.equal(stats.retention.percent,0);assert.equal(stats.gain,0);assert.equal(stats.gainPairs,8);
  assert.equal(stats.sevenUnseen.percent,0);
  const repairs=pendingRepairs(all,now);assert.equal(repairs.length,8);
  const repaired=event(repairRef(repairs[0]),now,{concept:repairs[0].concept,support:'worked-example'});
  assert.equal(pendingRepairs([...all,repaired],now).length,7);
  assert.equal(assessmentStats([...all,repaired],now).retention.percent,0);
  const duplicate=event(wrong[0].source.ref,now,{concept:wrong[0].concept,correctCount:1,total:1,phase:'retrieval'});
  assert.equal(firstByRef([...all,duplicate]).get(wrong[0].source.ref).score.correct,0);
  const assisted=attempts('day28',finish+28*DAY).map(e=>({...e,support:'worked-example'}));
  assert.equal(checkResult(u.id,'day28',[...all,...assisted],finish+28*DAY).attempted.length,0);
});
test('one paired experimental observation is not evidence for promotion',()=>{
  const taught=lesson(),finish=teachingFinishedAt(u.id,taught,t+100000);
  const base=attempts('baseline',t-60000,false),post=attempts('day7',finish+7*DAY);
  const ex=experimentDeck(u.id).map(x=>event(x.ref,finish+1000,{concept:x.concept,support:'worked-example',durationMs:10000}));
  const stats=experimentStats([...base,...taught,...post,...ex],finish+8*DAY);
  assert.equal(stats.left.total,4);assert.equal(stats.right.total,4);assert.equal(stats.sufficient,false);
  assert.equal(stats.difference,0);assert.equal(medianDuration(ex),10000);
});

import {createAnswerHistory,exactAudit,visibleHistory} from '../french-teaching/v1/answer-history.js';
test('answer audit captures exact text without changing score, isolates learners and reconstructs legacy scores',()=>{
 const map=new Map(),storage={getItem:k=>map.get(k),setItem:(k,v)=>map.set(k,v)};
 const store=createAnswerHistory({accountId:'parent',learnerId:'adult',storage});
 const item=assessmentDeck(GUIDED_UNITS[0].id,'baseline')[0];
 const raw="  Je parle français, français !  ";
 store.record(exactAudit(raw,item.fr,false,{ref:item.ref,activity:'baseline',question:item.en,checkGroup:item.ref.split(':').slice(0,3).join(':')}));
 assert.equal(store.getEntries()[0].answerAudit.answer,raw);
 assert.equal(createAnswerHistory({accountId:'parent',learnerId:'sai',storage}).getEntries().length,0);
 assert.equal(createAnswerHistory({accountId:'parent',learnerId:'adult',storage}).getEntries().length,1);
 assert.equal(visibleHistory(store.getEntries(),[])[0].result,'withheld');
 const evidence=assessmentDeck(GUIDED_UNITS[0].id,'baseline').map((x,i)=>({id:'old'+i,at:Date.now(),source:{ref:x.ref},score:{correct:0,total:1},support:'none'}));
 const rows=visibleHistory(store.getEntries(),evidence);
 assert.equal(rows.length,8);assert.equal(rows.find(x=>!x.legacy).answer,raw);assert.equal(rows.find(x=>x.legacy).answer,null);assert.equal(rows.find(x=>!x.legacy).expected,item.fr);
});


import {createAssessmentInterface} from '../french-teaching/v1/assessment-ui.js';
test('targeted repair retains submitted French and canonical model on wrong and correct responses',()=>{
 const now=Date.now(),taughtAt=now-8*DAY,deck=guidedLesson(u.id).steps;
 const records=[event(guidedTeachingRef(u.id),taughtAt),
   ...deck.map((x,i)=>event(guidedCompletionRefs(x.id).complete,taughtAt+(i+1)*1000,{concept:x.concept}))];
 const finish=teachingFinishedAt(u.id,records,now);
 records.push(...attempts('day7',finish+7*DAY+1000,false));
 const item=pendingRepairs(records,now)[0];assert.ok(item);
 let lastSpoken='',focused='',audits=[];
 const ui=createAssessmentInterface({getEntries:()=>records,record:raw=>records.push(event(raw.sourceRef,now,raw)),recordAttempt:a=>{audits.push(a);return true;},speak:v=>lastSpoken=v,refresh:()=>{},navigate:()=>{},startGuided:()=>{},focusTarget:v=>focused=v});
 ui.startDaily();assert.match(ui.page(),/TARGETED REPAIR/);
 ui.click({dataset:{eact:'cover'}});
 const submit=value=>ui.submit({id:'ft-e-form',querySelector:()=>({value})},{preventDefault(){}});
 submit('je ne sais pas');
 assert.match(ui.page(),/ft-answer-comparison incorrect/);
 assert.match(ui.page().replace(/<[^>]*>/g,''),/je ne sais pas/);
 assert.match(ui.page(),/ft-word-difference/);
 assert.equal(lastSpoken,item.fr);assert.equal(focused,'[data-eact="cover"]');
 ui.click({dataset:{eact:'cover'}});
 assert.doesNotMatch(ui.page(),/ft-answer-comparison/);
 const answer='  '+item.fr+'.  ';
 submit(answer);
 assert.match(ui.page(),/ft-answer-comparison correct/);
 assert.match(ui.page(),/Your answer/);
 assert.match(ui.page(),/Correct answer/);
 assert.equal(audits.at(-1).answer,answer);
 assert.equal(audits.at(-1).expected,item.fr);
 assert.equal(lastSpoken,item.fr);assert.equal(focused,'[data-eact="daily"]');
 assert.equal(pendingRepairs(records,now).length,7);
});
