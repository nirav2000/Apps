import test from 'node:test';
import assert from 'node:assert/strict';
import {
  MAGIC10_VERSION,MAGIC10_VERBS,MAGIC10_STRUCTURES,magicTenFor,magicTenPhrase
} from '../french-teaching/v1/magic10.js';
import {
  GUIDED_VERSION,GUIDED_UNITS,guidedLesson,guidedTeachingRef,guidedCompletionRefs,
  guidedCompleted,guidedStatus,recommendedGuidedUnit,guidedFirstAttemptPhase
} from '../french-teaching/v1/guided-lessons.js';

test('Magic 10 is an original, vetted set of reusable structures for 8 verbs',()=>{
  assert.equal(MAGIC10_VERSION,'2.0.0');
  assert.equal(MAGIC10_STRUCTURES.length,10);
  assert.equal(new Set(MAGIC10_STRUCTURES.map(x=>x.id)).size,10);
  assert.equal(Object.keys(MAGIC10_VERBS).length,8);
  for(const id of Object.keys(MAGIC10_VERBS)){
    const rows=magicTenFor(id);
    assert.equal(rows.length,10);
    assert.equal(new Set(rows.map(x=>x.id)).size,10);
    assert.ok(rows.every(x=>x.fr&&x.en&&x.concept));
    assert.deepEqual(rows,rows.map(x=>magicTenPhrase(id,x.id)));
  }
  assert.throws(()=>magicTenFor('aller'),/specifically reviewed/);
});
test('future, past, negative, opinion and polite tense families are linguistically correct',()=>{
  const p=id=>magicTenPhrase('parler',id).fr;
  assert.equal(p('infinitive'),'parler français');
  assert.equal(p('like'),'j’aime parler français');
  assert.equal(p('want'),'je veux parler français');
  assert.equal(p('present'),'je parle français');
  assert.equal(p('negative'),'je ne parle pas français');
  assert.equal(p('can'),'je peux parler français');
  assert.equal(p('must'),'je dois parler français');
  assert.equal(p('near-future'),'je vais parler français');
  assert.equal(p('past'),"j'ai parlé français");
  assert.equal(p('polite'),'je voudrais parler français');
  assert.equal(magicTenPhrase('habiter','present').fr,"j'habite à Londres");
  assert.equal(magicTenPhrase('habiter','negative').fr,"je n'habite pas à Londres");
  assert.equal(magicTenPhrase('étudier','negative').fr,"je n'étudie pas le français");
  assert.equal(magicTenPhrase('écouter','negative').fr,"je n'écoute pas la radio");
  assert.equal(magicTenPhrase('écouter','past').fr,"j'ai écouté la radio");
  assert.equal(magicTenPhrase('lire','past').fr,"j'ai lu en français");
  assert.equal(magicTenPhrase('pratiquer','near-future').fr,'je vais pratiquer le français');
  assert.throws(()=>magicTenPhrase('parler','imaginary'),/Unsupported/);
});
test('four lesson units give heavy repetition and diverse practice without reusing transfer examples',()=>{
  assert.equal(GUIDED_VERSION,'2.0.0');
  assert.equal(GUIDED_UNITS.length,4);
  const ids=new Set();
  for(const unit of GUIDED_UNITS){
    const {steps}=guidedLesson(unit.id);
    assert.ok(steps.length>=50,unit.id);
    assert.equal(steps.filter(x=>x.stage==='recap').length,10);
    assert.ok(steps.filter(x=>x.stage==='present').length>=9);
    assert.ok(steps.filter(x=>x.stage==='guided').length>=24);
    assert.ok(steps.filter(x=>x.stage==='independent').length>=8);
    assert.equal(steps.filter(x=>x.stage==='transfer').length,4);
    assert.ok(steps.every(x=>x.fr&&x.en&&x.concept&&x.unitId===unit.id));
    for(const step of steps){
      assert.ok(!ids.has(step.id));ids.add(step.id);
      if(step.kind==='choice'||step.kind==='listen'){
        assert.equal(step.choices.length,3);
        assert.ok(step.choices.includes(step.kind==='choice'?step.fr:step.en));
        assert.equal(new Set(step.choices).size,3);
      }
    }
    const transfer=steps.filter(x=>x.stage==='transfer');
    const teaching=new Set(steps.filter(x=>x.stage!=='transfer').map(x=>x.fr));
    assert.ok(transfer.every(x=>x.novel&&!teaching.has(x.fr)));
  }
});
const at=(ref,when,scored)=>({
  source:{ref},score:{correct:scored===false?0:scored===true?1:0,total:scored===undefined?0:1},
  at:when,taughtAt:when,phase:'practice'
});
const DAY=86400000;
const unit='speak-and-listen';
test('lesson progress uses immutable evidence refs and resumes after changing devices',()=>{
  const t=Date.parse('2026-11-20T08:00:00Z');
  assert.equal(guidedStatus(unit,[],t).mode,'new');
  const taught=at(guidedTeachingRef(unit),t);
  const lesson=guidedLesson(unit);
  const complete=lesson.steps.map(s=>at(guidedCompletionRefs(s.id).complete,t));
  assert.equal(guidedStatus(unit,[taught],t).mode,'resume');
  assert.equal(guidedStatus(unit,[taught,...complete],t).mode,'complete');
  assert.equal(guidedCompleted(unit,[taught,...complete]),true);
  assert.equal(guidedStatus(unit,[taught,...complete.slice(0,13)],t).completed,13);
  assert.equal(guidedStatus(unit,[taught,...complete.slice(0,13)],t).next.id,lesson.steps[13].id);
});
test('timely reviews are due at days 1, 3, 7; never backfill missed reviews as separate checks',()=>{
  const t=Date.parse('2026-11-20T08:00:00Z');
  const taught=at(guidedTeachingRef(unit),t);
  const all=guidedLesson(unit).steps.map(s=>at(guidedCompletionRefs(s.id).complete,t));
  const done=[taught,...all];
  assert.equal(guidedStatus(unit,done,t+DAY-100).mode,'complete');
  const d1=guidedStatus(unit,done,t+DAY);
  assert.equal(d1.mode,'review');
  assert.equal(d1.reviewDay,1);
  assert.equal(d1.steps.length,8);
  const mark1=d1.steps.map(s=>at(guidedCompletionRefs(s.id).complete,t+DAY));
  assert.equal(guidedStatus(unit,[...done,...mark1],t+2*DAY).mode,'complete');
  assert.equal(guidedStatus(unit,[...done,...mark1],t+3*DAY).reviewDay,3);
  assert.equal(guidedStatus(unit,done,t+8*DAY).reviewDay,7);
  assert.equal(guidedFirstAttemptPhase(d1.steps[0],done,t,t+DAY),'retrieval');
  assert.equal(guidedFirstAttemptPhase(d1.steps[0],done,t,t+DAY-1),'practice');
  assert.equal(guidedFirstAttemptPhase(guidedLesson(unit).steps.at(-1),done,t,t),'transfer');
});
test('earlier mistakes generate follow-up repair and cannot count as independent transfer',()=>{
  const t=Date.parse('2026-11-20T08:00:00Z');
  const deck=guidedLesson(unit).steps;
  const taught=at(guidedTeachingRef(unit),t);
  const original=deck[18],first=at(guidedCompletionRefs(original.id).first,t,false);
  const all=deck.map(s=>at(guidedCompletionRefs(s.id).complete,t));
  const status=guidedStatus(unit,[taught,first,...all],t);
  assert.equal(status.mode,'resume');
  assert.ok(status.next.stage==='repair');
  assert.equal(status.next.support,'small-prompt');
  const repair=at(guidedCompletionRefs(status.next.id).complete,t);
  assert.equal(guidedStatus(unit,[taught,first,...all,repair],t).mode,'complete');
});
test('recommended lesson prioritises due review then the earliest unfinished lesson',()=>{
  const t=Date.parse('2026-11-20T08:00:00Z');
  const initial=recommendedGuidedUnit([],t);
  assert.equal(initial.unit.id,'speak-and-listen');
  const done=[at(guidedTeachingRef(unit),t),
    ...guidedLesson(unit).steps.map(s=>at(guidedCompletionRefs(s.id).complete,t))];
  assert.equal(recommendedGuidedUnit(done,t).unit.id,'make-a-choice');
  assert.equal(recommendedGuidedUnit(done,t+8*DAY).unit.id,'speak-and-listen');
  assert.equal(recommendedGuidedUnit(done,t+8*DAY).mode,'review');
});
