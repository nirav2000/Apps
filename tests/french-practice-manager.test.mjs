import test from 'node:test';
import assert from 'node:assert/strict';
import {practiceLedger,sharedBypass,practiceKey,PRACTICE_COOLDOWN,PRACTICE_DAY,deferRepeatedTargets,repeatDecision,knownRef} from '../french-teaching/v1/unlocking-adaptive.js';
const now=1700000000000,fr="Hier, j’ai préparé le déjeuner et j’ai réservé une table";
const audit=(ref,expected=fr,extra={},at=now-1000)=>({at,answerAudit:{ref,expected,answer:expected,targetLang:'fr',support:'none',result:'correct',question:'Translate',context:{track:'unlocking'},...extra}});
const step={id:'x',fr,track:'unlocking',stage:'guided',kind:'model',unlockAction:'build'};
test('two distinct unaided recalls bypass redundant guided practice, not protected checks',()=>{
 const ledger=practiceLedger([audit('one'),audit('two')],'unlocking',now);
 assert.equal(ledger.recallCount(fr),2);assert.ok(sharedBypass(step,ledger));
 for(const stage of ['repair','review','independent','transfer'])assert.equal(sharedBypass({...step,stage},ledger),false);
 assert.equal(sharedBypass({...step,unlockAction:'reverse'},ledger),false);
 assert.ok(ledger.recentlySeen(fr));assert.equal(practiceKey(fr),practiceKey(fr.replaceAll('’',"'").replace(',','')));
 assert.equal(ledger.recallCount(fr.replace('déjeuner','dejeuner')),0);
});
test('models, hints, dictation, duplicate attempts, other tracks and later failure do not confer unaided recall',()=>{
 const rows=[audit('one'),audit('one'),audit('hint',fr,{support:'small-prompt'}),audit('model',fr,{result:'model'}),audit('dictation',fr,{question:'Listen and type',context:{track:'unlocking',kind:'transcribe'}}),audit('other',fr,{context:{track:'sai'}})];
 assert.equal(practiceLedger(rows,'unlocking',now).recallCount(fr),1);
 assert.equal(sharedBypass(step,practiceLedger(rows,'unlocking',now)),false);
 const failed=audit('failure',fr,{result:'incorrect',answer:'wrong'},now-1);
 assert.equal(practiceLedger([...rows,failed],'unlocking',now).recallCount(fr),0);
});
test('two genuinely different contexts defer current word revision until tomorrow without advancing retention level',()=>{
 const rows=[audit('one','J’ai préparé le déjeuner',{},now-1000),audit('two','Nous avons préparé le déjeuner',{},now-500)];
 const ledger=practiceLedger(rows,'unlocking',now);
 const row={key:'le déjeuner',word:'le déjeuner',level:0,score:4,dueAt:now-2000,due:true,lastDifficulty:{at:now-2000,kind:'spelling'}};
 assert.ok(ledger.targetSatisfied(row));
 const [deferred]=deferRepeatedTargets([row],ledger,now);assert.equal(deferred.due,false);assert.equal(deferred.level,0);assert.equal(deferred.dueAt,now-500+PRACTICE_DAY);assert.equal(row.due,true);
 assert.equal(ledger.targetSatisfied({...row,level:1}),false);
 for(const kind of ['pronunciation','manual','recognition'])assert.equal(ledger.targetSatisfied({...row,lastDifficulty:{...row.lastDifficulty,kind}}),false);
 assert.equal(ledger.targetSatisfied({...row,lastDifficulty:{...row.lastDifficulty,at:now-1}}),false);
 assert.equal(practiceLedger(rows,'unlocking',now+PRACTICE_DAY).targetSatisfied(row),false);
 assert.equal(practiceLedger(rows,'unlocking',now+PRACTICE_COOLDOWN).recentlySeen('J’ai préparé le déjeuner'),false);
});
test('an unresolved error on a different sentence containing the target invalidates weak-spot deferral',()=>{
 const rows=[audit('one','J’ai préparé le déjeuner',{},now-1000),audit('two','Nous avons préparé le déjeuner',{},now-500),audit('error','Hier, elle a préparé le déjeuner',{result:'incorrect',answer:'wrong'},now-1)];
 assert.equal(practiceLedger(rows,'unlocking',now).targetSatisfied({word:'déjeuner',level:0,lastDifficulty:{at:now-2000,kind:'spelling'}}),false);
});
test('French oral target identity ignores equivalent English gloss but respects a later independent failure',()=>{
 const a={...step,id:'a',en:'I prepared'},b={...step,id:'b',en:'I have prepared'};
 const entries=[{at:now-2000,source:{ref:'a:complete'}},{at:now-1500,source:{ref:knownRef(a)}}];
 assert.ok(repeatDecision(b,[a,b],entries));
 assert.equal(repeatDecision({...b,unlockAction:'reverse'},[a,b],entries),false);
 const ledger=practiceLedger([audit('later',fr,{result:'incorrect',answer:'wrong'},now-1)],'unlocking',now);
 assert.equal(repeatDecision(b,[a,b],entries,ledger),false);
});
