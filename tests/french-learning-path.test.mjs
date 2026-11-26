import test from 'node:test';
import assert from 'node:assert/strict';
import {chooseLearningActivity,sequenceStatus} from '../french-teaching/v1/assessment-ui.js';
const guided={mode:'new',unit:{id:'one'}},check={unitId:'old',stage:'day7'},immediate={unitId:'one',stage:'immediate'};
const rest={unitId:'one',readyAt:100},repair={ref:'repair'},adaptive={ref:'adaptive'};
test('one recommendation respects the rest lock and recall-before-revision',()=>{
 assert.equal(chooseLearningActivity({rest,checks:[check],revisionCount:9,guided}).mode,'break');
 assert.equal(chooseLearningActivity({checks:[check],revisionCount:9,guided,repair}).step,'recall');
 assert.equal(chooseLearningActivity({checks:[immediate],revisionCount:9,guided}).step,'after');
 assert.equal(chooseLearningActivity({adaptive,repair,revisionCount:9,guided}).mode,'adaptive');
 assert.equal(chooseLearningActivity({repair,revisionCount:9,guided}).mode,'repair');
 assert.deepEqual(chooseLearningActivity({revisionCount:9,guided}),{mode:'revision',count:5,step:'revision'});
 assert.equal(chooseLearningActivity({revisionCount:9,session:{revisionDone:true},guided,baseline:{stage:'baseline'}}).step,'teaching');
 assert.equal(chooseLearningActivity({revisionCount:9,session:{revisionDone:true},guided}).mode,'guided');
 assert.equal(chooseLearningActivity({revisionCount:9,guided:{...guided,mode:'resume'}}).mode,'guided');
});
test('a finished lesson offers finite optional oral practice and an explicit end',()=>{
 const session={completedUnit:'one',revisionDone:true};
 assert.deepEqual(chooseLearningActivity({session,oralCount:12,guided}),{mode:'oral',count:3,step:'oral'});
 assert.equal(chooseLearningActivity({session:{...session,oralDone:true},oralCount:12,guided}).mode,'complete');
 assert.equal(chooseLearningActivity({session:{...session,oralDone:true},checks:[check],guided}).mode,'check');
 assert.equal(chooseLearningActivity({nextReview:123}).mode,'rest');
 const rows=sequenceStatus({mode:'oral',step:'oral'},{session});
 assert.equal(rows.filter(r=>r.kind==='current').length,1);
 assert.equal(rows.find(r=>r.id==='after').status,'Done this session');
});
