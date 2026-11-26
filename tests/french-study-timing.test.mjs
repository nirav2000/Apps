import test from 'node:test';
import assert from 'node:assert/strict';
import {GUIDED_UNITS,guidedLesson,guidedTeachingRef,guidedCompletionRefs} from '../french-teaching/v1/guided-lessons.js';
import {assessmentDeck,teachingFinishedAt} from '../french-teaching/v1/assessment.js';
import {normalizeEvidence} from '../learning-evidence/v1/index.js';
import {ASSESSMENT_DAY as DAY} from '../learning-evidence/v1/assessment.js';
import {MINUTE,MINIMUM_REST_MS,GRACE_MS,activeRest,restForUnit,scheduledPractice,prioritizedChecks,overdueWords,countdownText,restMarkup,alertKeys} from '../french-teaching/v1/study-timing.js';
const unit=GUIDED_UNITS[0],t=Date.parse('2026-11-25T09:00:00Z');
let seq=0;
const scope={appId:'next-french',accountId:'parent',learnerId:'adult'};
const event=(ref,at,extra={})=>normalizeEvidence({id:'rest-'+(++seq),concept:'french:test',at,phase:'practice',support:'none',source:{kind:'french-course',ref},...extra},scope);
const taught=[event(guidedTeachingRef(unit.id),t),...guidedLesson(unit.id).steps.map((s,i)=>event(guidedCompletionRefs(s.id).complete,t+i+1,{concept:s.concept}))];
const finish=teachingFinishedAt(unit.id,taught,t+100000);
const answers=(stage,at)=>assessmentDeck(unit.id,stage).map(x=>event(x.ref,at,{concept:x.concept,phase:stage==='immediate'?'practice':'retrieval',support:'none',correctCount:1,total:1}));
test('rest is anchored to completed teaching, not page visit; no next lesson until five minutes',()=>{
 assert.equal(activeRest(taught.slice(0,-1),finish),null);
 assert.equal(activeRest(taught,finish).remaining,MINIMUM_REST_MS);
 assert.equal(activeRest(taught,finish+3*MINUTE).remaining,2*MINUTE);
 assert.equal(activeRest(taught,finish+MINIMUM_REST_MS-1).remaining,1);
 assert.equal(activeRest(taught,finish+MINIMUM_REST_MS),null);
 assert.equal(activeRest(taught,finish+1000,'sai'),null);
 assert.equal(prioritizedChecks(taught,finish+MINUTE).length,0);
 assert.equal(prioritizedChecks(taught,finish+MINIMUM_REST_MS)[0].stage,'immediate');
 assert.match(restMarkup(restForUnit(unit.id,taught,finish),finish),/05:00/);
 assert.equal(countdownText(1),'00:01');assert.equal(countdownText(0),'00:00');
});
test('completed checks are not overdue; partial legacy immediate checks stay usable',()=>{
 const partial=[...taught,...answers('immediate',finish+1000).slice(0,1)];
 assert.equal(activeRest(partial,finish+2000),null);
 assert.equal(prioritizedChecks(partial,finish+2000)[0].attempted.length,1);
 const full=[...taught,...answers('immediate',finish+MINIMUM_REST_MS)];
 assert.equal(scheduledPractice(full,finish+2*60*MINUTE).due.length,0);
 assert.equal(scheduledPractice(full,finish+2*60*MINUTE).next.at,finish+DAY);
 assert.equal(scheduledPractice(full,finish+DAY).overdue.length,0);
 assert.equal(scheduledPractice(full,finish+DAY+GRACE_MS.day1).overdue.length,1);
});
test('overdue timing and missed windows never backfill observations',()=>{
 const ready=finish+MINIMUM_REST_MS;
 assert.equal(scheduledPractice(taught,ready-1).due.length,0);
 assert.equal(scheduledPractice(taught,ready).due.length,1);
 assert.equal(scheduledPractice(taught,ready+GRACE_MS.immediate-1).overdue.length,0);
 assert.equal(scheduledPractice(taught,ready+GRACE_MS.immediate).overdue.length,1);
 const late=scheduledPractice(taught,finish+3*DAY);
 assert.deepEqual(late.due.map(x=>x.stage),['day3']);
 assert.deepEqual(late.overdue[0].missed,['immediate','day1']);
 assert.deepEqual(prioritizedChecks(taught,finish+3*DAY).map(x=>x.stage),['day3']);
 const words=overdueWords([{key:'a',dueAt:ready},{key:'b',dueAt:null}],ready+30*MINUTE);
 assert.equal(words.length,1);assert.equal(alertKeys(late,words).length,2);
});

test('learner-wide rest includes every French track, while track queries stay scoped',()=>{
 const rest=activeRest(taught,finish+1000,null);
 assert.equal(rest.unitId,unit.id);assert.equal(rest.track,'michaela');
 assert.equal(activeRest(taught,finish+1000,'unlocking'),null);
 assert.equal(activeRest(taught,finish+MINIMUM_REST_MS,null),null);
});
