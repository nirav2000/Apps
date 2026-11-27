import test from 'node:test';
import assert from 'node:assert/strict';
import {EXPANSION_UNITS,pileCombinations,pileCount,assemblePiles} from '../french-teaching/v1/unlocking-expansion.js';
import {repeatDecision,knownRef,helpRef,skipRef,mixHistory,suggestMix,familiarIntro} from '../french-teaching/v1/unlocking-adaptive.js';
import {UNLOCKING_BUILDER_UNITS} from '../french-teaching/v1/unlocking-builder.js';
import {guidedLesson,guidedStatus,guidedRefs,guidedTeachingRef,unitsForTrack} from '../french-teaching/v1/guided-lessons.js';
import {assessmentDeck,STAGES,teachingFinishedAt} from '../french-teaching/v1/assessment.js';
import {roadmapData,languageInventory,availablePiles} from '../french-teaching/v1/roadmap.js';
import {normaliseAnswer} from '../french-teaching/v1/data.js';
import {createGuidedInterface} from '../french-teaching/v1/guided-ui.js';
const now=1700000000000;
const event=(ref,at=now,score={total:0,correct:0})=>({at,taughtAt:at,source:{ref},phase:'practice',support:'worked-example',score});
const complete=(s,at=now)=>event(guidedRefs(s.id).complete,at);
test('four expansion modules preserve all original chapters and provide 720 distinct workshop combinations',()=>{
 const units=unitsForTrack('unlocking');assert.equal(units.length,16);
 assert.deepEqual(units.filter(u=>!u.expansion).map(u=>u.id),UNLOCKING_BUILDER_UNITS.map(u=>u.id));
 const oldSteps=UNLOCKING_BUILDER_UNITS.flatMap(u=>guidedLesson(u.id).steps.map(s=>s.id));
 assert.equal(oldSteps.length,1135);assert.equal(new Set(oldSteps).size,1135);
 assert.equal(EXPANSION_UNITS.reduce((n,u)=>n+pileCount(u.workshop),0),720);
 for(const u of EXPANSION_UNITS){
   const combos=pileCombinations(u.workshop);
   assert.equal(combos.length,pileCount(u.workshop));
   assert.equal(new Set(combos.map(c=>c.fr)).size,combos.length);
   assert.ok(combos.every(c=>c.fr&&c.en&&c.parts.length===4));
   assert.equal(u.sequence.filter(s=>s.kind==='workshop').length,1);
   assert.ok(u.sequence.some(s=>s.kind==='listen'));
 }
 assert.ok(EXPANSION_UNITS.at(-1).sequence.some(s=>s.fr.split(/\s+/).length>=20));
});
test('repeat bypass requires actual positive recall evidence and respects later help, spaced checks and protected stages',()=>{
 const make=(id,fr='le repas',en='the meal',extra={})=>({id,fr,en,track:'unlocking',kind:'model',stage:'guided',unlockAction:'recall',...extra});
 const [a,b,c,d,e,f]=[make('a'),make('b'),make('c','bonjour','hello'),make('d','merci','thanks'),make('e'),make('f')];
 const steps=[a,b,c,d,e,f];
 assert.equal(repeatDecision(b,steps,[complete(a)]),false);
 const first=[complete(a),event(knownRef(a),now+1)];
 assert.equal(repeatDecision(b,steps,first),true);
 const intervening=[...first,complete(c,now+2),complete(d,now+3)];
 assert.equal(repeatDecision(e,steps,intervening),false);
 const twice=[...intervening,complete(e,now+4),event(knownRef(e),now+5)];
 assert.equal(repeatDecision(f,steps,twice),true);
 assert.equal(repeatDecision(f,steps,[...twice,event(helpRef(e),now+6)]),false);
 assert.equal(repeatDecision({...f,stage:'independent'},steps,twice),false);
 assert.equal(repeatDecision({...f,unlockAction:'reverse'},steps,twice),false);
 assert.equal(familiarIntro({...f,unlockAction:'introduce',modelInitiallyShown:true},steps,twice).modelInitiallyShown,false);
});
test('bypasses resolve teaching without creating exposure, altering chapter ids or blocking its final assessment',()=>{
 const u=UNLOCKING_BUILDER_UNITS[0],steps=guidedLesson(u.id).steps;
 const s=steps.find(x=>x.kind==='model'&&x.unlockAction==='recall');
 const rows=[event(guidedTeachingRef(u.id),now-100),...steps.map(x=>x===s?event(skipRef(x),now):complete(x))];
 const status=guidedStatus(u.id,rows,now+1000);
 assert.equal(status.teaching.coreCompleted,steps.length);
 assert.equal(status.teaching.adaptiveSkipped,1);
 assert.ok(!rows.some(r=>r.source.ref===guidedRefs(s.id).complete));
 assert.ok(teachingFinishedAt(u.id,rows,now+1000));
});
test('new practice does not expose old reserved transfer prompts; new module checks are application',()=>{
 const norm=normaliseAnswer;
 const reserved=new Set(UNLOCKING_BUILDER_UNITS.flatMap(u=>STAGES.flatMap(s=>assessmentDeck(u.id,s.id).filter(x=>x.kind==='transfer').map(x=>norm(x.fr)))));
 for(const u of EXPANSION_UNITS){
  assert.ok([...u.sequence,...pileCombinations(u.workshop)].every(x=>!reserved.has(norm(x.fr))));
  for(const s of STAGES)assert.ok(assessmentDeck(u.id,s.id).every(x=>x.kind!=='transfer'));
 }
});
test('roadmap counts combinations from covered pieces rather than pretending planned language is known',()=>{
 const d=roadmapData('unlocking',[],now),inv=languageInventory(d,[],now);
 for(const u of EXPANSION_UNITS){
  assert.equal(pileCount(availablePiles(u,inv,true)),0);
  assert.equal(pileCount(availablePiles(u,inv,false)),pileCount(u.workshop));
 }
 const u=EXPANSION_UNITS[0],rows=u.sequence.filter(s=>s.kind==='model').map(s=>complete(s,now-1));
 const covered=roadmapData('unlocking',rows,now),words=languageInventory(covered,rows,now);
 assert.equal(pileCount(availablePiles(u,words,true)),pileCount(u.workshop));
});
test('four-pile UI reveals the sentence, distinguishes help and self-checked recall, and unlocks continuation through varied practice',()=>{
 const u=EXPANSION_UNITS[0],steps=guidedLesson(u.id).steps,w=steps.find(s=>s.kind==='workshop');
 const t=Date.now()-10000,rows=[event(guidedTeachingRef(u.id),t),...steps.slice(0,steps.indexOf(w)).map(s=>complete(s,t))],audits=[];
 const ui=createGuidedInterface({getEntries:()=>rows,getTrack:()=> 'unlocking',record:r=>rows.push(event(r.sourceRef,Date.now())),recordAttempt:r=>{audits.push(r);return true;},speak:()=>{},refresh:()=>{}});
 ui.start(u.id);assert.equal(ui.current().id,w.id);
 const click=(gact,extra={})=>ui.click({dataset:{gact,...extra}});
 assert.match(ui.page(),/FOUR PILES/);assert.ok(!ui.page().includes('class="ft-mix-french"'));
 click('mix-help');click('mix-reveal');assert.match(ui.page(),/ft-mix-french/);click('mix-needed');
 assert.equal(mixHistory(w,rows).successes.length,0);
 click('mix-retry');assert.ok(!ui.page().includes('class="ft-mix-french"'));
 click('mix-reveal');click('mix-known');
 assert.equal(mixHistory(w,rows).successes.length,1);
 for(let i=0;i<12&&!mixHistory(w,rows).ready;i++){click('mix-next');click('mix-reveal');click('mix-known');}
 assert.ok(mixHistory(w,rows).ready);
 assert.match(ui.page(),/data-gact="mix-finish"/);
 assert.ok(audits.every(a=>a.marker==='unscored'));
 click('mix-finish');assert.ok(rows.some(r=>r.source.ref===guidedRefs(w.id).complete));ui.leave();
});
