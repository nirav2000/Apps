import test from 'node:test';
import assert from 'node:assert/strict';
import {createEvidenceStore,normalizeEvidence,summariseEvidence,dueReviews,toLearningEvent} from '../learning-evidence/v1/index.js';
const DAY=86400000;
const epoch=Date.parse('2026-11-01T12:00:00Z');
const store=()=>{const memory=new Map();return createEvidenceStore({appId:'dol',accountId:'guest',learnerId:'sai',storage:{getItem:k=>memory.get(k),setItem:(k,v)=>memory.set(k,v)}})};

test('no events = four distinct unmeasured scores',()=>{
 const s=summariseEvidence([]);
 for(const k of ['accuracy','independence','retention','transfer'])assert.equal(s[k].percent,null);
});
test('helped correct scores improve accuracy but not independent mastery',()=>{
 const s=store();
 s.record({concept:'compensation',correctCount:5,total:5,support:'small-prompt',at:epoch});
 const r=s.summary();
 assert.equal(r.accuracy.percent,100);
 assert.equal(r.independence.percent,0);
 assert.equal(r.retention.percent,null);
 assert.equal(r.transfer.percent,null);
});
test('unknown help cannot establish independence',()=>{
 const s=store();
 s.record({concept:'compensation',correct:true,at:epoch});
 const r=s.summary();
 assert.equal(r.accuracy.percent,100);
 assert.equal(r.independence.percent,null);
 assert.equal(r.independence.unknownSupport,1);
});
test('7-day retention requires explicit dated recall without help',()=>{
 const s=store();
 s.record({concept:'compensation',phase:'practice',taughtAt:epoch,correct:true,support:'none',at:epoch});
 s.record({concept:'compensation',phase:'retrieval',taughtAt:epoch,correct:true,support:'none',at:epoch+DAY});
 assert.equal(s.summary().retention.percent,null);
 s.record({concept:'compensation',phase:'retrieval',taughtAt:epoch,correctCount:3,total:5,support:'none',at:epoch+7*DAY});
 assert.equal(s.summary().retention.percent,60);
});
test('help at day 7 is evidence of a remaining independence gap',()=>{
 const s=store();
 s.record({concept:'compensation',phase:'retrieval',taughtAt:epoch,correct:true,support:'worked-example',at:epoch+7*DAY});
 assert.equal(s.summary().retention.percent,0);
});
test('transfer requires novel material and known independent work',()=>{
 const s=store();
 s.record({concept:'compensation',phase:'transfer',correct:true,support:'none',novel:false,at:epoch});
 assert.equal(s.summary().transfer.percent,null);
 s.record({concept:'compensation',phase:'transfer',correctCount:4,total:5,support:'none',novel:true,at:epoch+DAY});
 assert.equal(s.summary().transfer.percent,80);
});
test('unscored teaching marker schedules, does not award performance',()=>{
 const s=store();
 s.record({concept:'compensation',phase:'practice',taughtAt:epoch,at:epoch});
 assert.equal(s.summary().accuracy.percent,null);
 assert.equal(s.due(epoch+2*DAY)[0].days,1);
 assert.equal(s.due(epoch+8*DAY)[0].days,7);
 assert.equal(s.due(epoch+29*DAY)[0].days,28);
});
test('observed seven-day checks advance the next due date',()=>{
 const s=store();
 s.record({concept:'compensation',phase:'practice',taughtAt:epoch,at:epoch});
 s.record({concept:'compensation',phase:'retrieval',taughtAt:epoch,correct:true,support:'none',at:epoch+7*DAY});
 assert.equal(s.due(epoch+8*DAY)[0].days,28);
});
test('stable source ids prevent duplicate captured events',()=>{
 const s=store();
 const input={id:'focus-012',concept:'place:value',phase:'diagnostic',correct:true,at:epoch,support:'none'};
 s.record(input);s.record(input);
 assert.equal(s.getEntries().length,1);
});
test('scope overrides foreign source and storage failures are explicit',()=>{
 const s=store();
 const event=s.record({appId:'foreign',learnerId:'not-sai',concept:'fact:7x8',correct:true,at:epoch});
 assert.equal(event.appId,'dol');assert.equal(event.learnerId,'sai');
 const broken=createEvidenceStore({appId:'dol',learnerId:'sai',storage:{getItem:()=>null,setItem:()=>{throw Error('full')}}});
 assert.throws(()=>broken.record({concept:'x',correct:true}),/full/);
 assert.equal(broken.getEntries().length,0);
});
test('legacy event conversion keeps explicit help and metadata',()=>{
 const event=toLearningEvent({appId:'dol',learnerId:'sai',concept:'div:2',phase:'retrieval',correct:true,
   support:'small-prompt',taughtAt:epoch,at:epoch+7*DAY,novel:false});
 assert.equal(event.correct,false);assert.equal(event.hints,1);
 assert.equal(event.context.learningEvidenceV1.phase,'retrieval');
 assert.equal(event.context.learningEvidenceV1.total,1);
 const saved=store().record({concept:'div:3',correctCount:4,total:5,support:'none',at:epoch});
 const mirror=toLearningEvent(saved);
 assert.equal(mirror.context.learningEvidenceV1.correct,4);
 assert.equal(mirror.context.learningEvidenceV1.total,5);
});
test('invalid totals must be rejected',()=>{
 assert.throws(()=>normalizeEvidence({appId:'dol',learnerId:'sai',concept:'x',correctCount:6,total:5}),/exceeds/);
});
