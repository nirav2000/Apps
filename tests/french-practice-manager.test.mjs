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

import {meaningfulVariation} from '../french-teaching/v1/unlocking-adaptive.js';
import {likelyTypingSlip,missedLanguageTargets,relatedRevisionTargets,groupRevisionTargets,revisionEvents} from '../french-teaching/v1/revision-signals.js';
import {repairDecision} from '../french-teaching/v1/revision-repair.js';
test('a long correct construction with two keyboard slips gets feedback, not a whole sentence rebuild',()=>{
 const expected="J'ai préparé le repas et j'ai réservé une chambre";
 const answer="J'ai préparé levrepas rt j'ai réservé une chambre";
 assert.equal(likelyTypingSlip(answer,expected),true);
 assert.equal(repairDecision(answer,expected),null);
 const audit={id:'synthetic-typo',ref:'x',at:now,targetLang:'fr',result:'incorrect',answer,expected,context:{track:'unlocking',stage:'adaptive',kind:'write'}};
 assert.deepEqual(revisionEvents([], [audit]),[]);
 assert.equal(likelyTypingSlip("J'ai préparé le musée et j'ai réservé une chambre",expected),false);
 assert.equal(likelyTypingSlip("J'ai prepare le repas et j'ai réservé une chambre",expected),false);
 assert.equal(likelyTypingSlip("le repa","le repas"),false);
 assert.equal(repairDecision("J'ai préparé le musée et j'ai réservé une chambre",expected).kind,'meaning');
});
test('nonadjacent real mistakes create small targets, not a huge overlapping span',()=>{
 const expected="J'ai préparé le repas et j'ai réservé une chambre";
 const got="J'ai préparé le musée et j'ai réservé une table";
 const targets=missedLanguageTargets(got,expected).map(x=>x.word);
 assert.deepEqual(targets,['le repas','une chambre']);
 assert.equal(relatedRevisionTargets({word:"le repas"},{word:"le repas et j'ai"}),true);
 assert.equal(relatedRevisionTargets({word:"le repas"},{word:"une chambre"}),false);
 const row=(word,kind='construction',level=0)=>({word,key:word,due:true,dueAt:now,score:4,level,lastDifficulty:{kind}});
 const rows=groupRevisionTargets([row('le repas'),row('repas'),row("le repas et j'ai réservé une"),row('le'),row('une chambre'),row('le','manual'),row('repas','review',1)]);
 assert.deepEqual(rows.filter(x=>x.due).map(x=>x.word),['le repas','une chambre','le','repas']);
 assert.ok(rows[1].groupedWith);assert.ok(rows[2].groupedReason);assert.ok(rows[3].groupedReason);
});
test('a pasted-on museum clause, time word or meal synonym is not meaningful variety',()=>{
 const first="J'ai préparé le déjeuner et j'ai réservé une table";
 assert.equal(meaningfulVariation(first,"Hier, "+first),false);
 assert.equal(meaningfulVariation(first,first+" et hier j'ai visité le musée"),false);
 assert.equal(meaningfulVariation(first,"J'ai préparé le repas et j'ai réservé une table"),false);
 assert.equal(meaningfulVariation("J'ai préparé le déjeuner","Nous avons préparé le déjeuner"),true);
 assert.equal(meaningfulVariation(first,"Je dois préparer le déjeuner avant de partir"),true);
 const ledger=practiceLedger([audit('seen',first,{result:'model',answer:null,support:'worked-example'})],'unlocking',now);
 assert.equal(ledger.recentlySimilar(first+" et hier j'ai visité le musée"),true);
});
test('trivial extensions cannot count as two independently demonstrated contexts',()=>{
 const a="J'ai préparé le déjeuner et j'ai réservé une table",b=a+" et j'ai visité le musée";
 const ledger=practiceLedger([audit('first',a,{},now-1000),audit('second',b,{},now-500)],'unlocking',now);
 assert.equal(ledger.targetSatisfied({word:'déjeuner',level:0,lastDifficulty:{kind:'spelling',at:now-2000}}),false);
});

import {malformedAutoTarget,revisionQueue} from '../french-teaching/v1/revision-signals.js';
import {chooseAdaptivePlan,adaptiveOutcome} from '../french-teaching/v1/adaptive-teaching.js';
import {guidedLesson,guidedStatus,guidedTeachingRef,guidedCompletionRefs,unitsForTrack} from '../french-teaching/v1/guided-lessons.js';
test('valid reusable structures remain eligible; dangling fragments do not',()=>{
 for(const fr of ['je dois','je veux','je voudrais','nous avons','parce que','pas encore',"j'ai"])assert.equal(malformedAutoTarget(fr),false,fr);
 for(const fr of ['le','une',"le repas et j'ai","le repas et j'ai réservé une"])assert.equal(malformedAutoTarget(fr),true,fr);
});
test('protected early teaching and prior-unit insert budget prevent a barrage of old material',()=>{
 const units=unitsForTrack('unlocking'),old=units.find(u=>u.id==='unlock2-past'),next=units.find(u=>u.id!==old.id&&u.incremental&&u.blocks.some(b=>/partir/.test(b.fr)));
 assert.ok(next);
 const deck=guidedLesson(next.id).steps;
 const ev=(ref,at=now)=>({at,source:{ref},score:{total:0,correct:0}});
 const evidence=n=>[ev(guidedTeachingRef(next.id)),...guidedLesson(old.id).steps.filter(s=>!['independent','transfer','review'].includes(s.stage)).map(s=>ev(guidedCompletionRefs(s.id).complete)),...deck.slice(0,n).map(s=>ev(guidedCompletionRefs(s.id).complete))];
 const difficulty={id:'synthetic-error',word:'préparé',kind:'spelling',at:now-1000,context:{sessionId:'earlier',unitId:old.id,position:4},sentence:"J'ai préparé le repas",english:'I prepared the meal'};
 const row=revisionQueue([difficulty],now)[0];
 const options=(n,audits=[],queue=[row])=>({status:guidedStatus(next.id,evidence(n),now),queue,audits,evidence:evidence(n),sessionId:'current',track:'unlocking',now});
 assert.equal(chooseAdaptivePlan(options(3)),null);
 const p=chooseAdaptivePlan(options(8));assert.ok(p);assert.equal(p.sourceUnitId,old.id);assert.equal(p.policyVersion,2);assert.equal(p.fr,'préparé');
 const saved={id:'plan',at:now,answerAudit:{signal:{kind:'adaptive-plan',plan:p}}};
 const done={id:'answer',at:now,answerAudit:{ref:p.id+':first',result:'correct'}};
 const other=revisionQueue([{...difficulty,id:'other-error',word:'réservé',sentence:"J'ai réservé une table",english:'I booked a table'}],now)[0];
 assert.equal(chooseAdaptivePlan(options(15,[saved,done],[other])),null);
 const slip=adaptiveOutcome({...p,fr:"J'ai préparé le repas et j'ai réservé une chambre"},{answer:"J'ai préparé levrepas rt j'ai réservé une chambre",correct:false});
 assert.equal(slip.kind,'typing-slip');assert.equal(slip.correct,false);
});
