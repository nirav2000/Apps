import test from 'node:test';
import {answerFeedback,guidedEntryAudio,teacherModelAudio,guidedHint,spokenWords,answerComparison,EXACT_ANSWER_ATTRIBUTES,listeningChunks,listeningSteps,listeningContext,listeningHintMarkup,difficultListeningChunks,verifiedListeningEnglish} from '../french-teaching/v1/guided-ui.js';
import assert from 'node:assert/strict';
import {
  MAGIC10_VERSION,MAGIC10_VERBS,MAGIC10_STRUCTURES,magicTenFor,magicTenPhrase,optionalVerbTimeline
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
    assert.ok(steps.filter(x=>x.stage==='guided').length>=32);
    assert.equal(steps.filter(x=>x.kind==='transcribe').length,8);
    assert.ok(steps.filter(x=>x.stage==='independent').length>=8);
    assert.equal(steps.filter(x=>x.stage==='transfer').length,4);
    assert.ok(steps.every(x=>x.fr&&x.en&&x.concept&&x.unitId===unit.id));
    assert.ok(unit.soundFocus?.word&&unit.soundFocus.spelling&&unit.soundFocus.note);
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


test('optional explorer shows real tenses, not an invented universal conjugator',()=>{
 const irregular=optionalVerbTimeline('vouloir');
 assert.deepEqual(irregular.map(x=>x.fr),[
   'je veux apprendre','je voulais apprendre',"j'ai voulu apprendre",
   'je voudrai apprendre','je voudrais apprendre'
 ]);
 assert.equal(optionalVerbTimeline('parler').length,10);
 assert.equal(optionalVerbTimeline('not-curated'),null);
 assert.ok(optionalVerbTimeline('aller').some(x=>/suis allé/.test(x.fr)));
 assert.ok(optionalVerbTimeline('être').some(x=>/serai/.test(x.fr)));
});
test('guided correction flags tense, negation and accents without leaking model',()=>{
 assert.match(answerFeedback('je parle français','je ne parle pas français'),/negative/);
 assert.match(answerFeedback("j'ai parler français",'je vais parler français'),/future plan/);
 assert.match(answerFeedback('je vais parlé français',"j'ai parlé français"),/completed past/);
 assert.match(answerFeedback("j'ecoute la radio","j'écoute la radio"),/accents/);
 assert.match(answerFeedback('je parle français','je parle français parce que je pratique'),/parce que/);
});

test('autoplay is restricted to visible teaching models and listening prompts',()=>{
  for(const unit of GUIDED_UNITS){
    for(const step of guidedLesson(unit.id).steps){
      const audio=guidedEntryAudio(step);
      if(step.kind==='listen'||step.kind==='transcribe'||step.kind==='model'&&step.modelInitiallyShown)assert.ok(audio.includes(step.fr));
      else assert.equal(audio,'',step.id);
      if(step.kind==='model')assert.ok(teacherModelAudio(step).includes(step.fr));
    }
  }
  assert.equal(guidedEntryAudio({stage:'review',kind:'write',fr:'je parle français'}),'');
});

test('contextual hints progress without giving the whole answer',()=>{
 for(const unit of GUIDED_UNITS)for(const step of guidedLesson(unit.id).steps.filter(s=>['write','transcribe'].includes(s.kind))){
  const first=guidedHint(step,1),second=guidedHint(step,2);
  assert.ok(first.length>20&&second.length>10,step.id);
  assert.ok(!first.includes(step.fr)&&!second.includes(step.fr),step.id);
  assert.doesNotMatch(first,/Remember: (present|past|negative|near-future)/);
 }
 assert.match(guidedHint({kind:'transcribe',fr:'je parle français'}),/3 separate written words/);
 assert.match(guidedHint({kind:'write',fr:'je veux parler français',structure:'want'},1),/I want/);
 assert.match(guidedHint({kind:'write',fr:'parler français',structure:'infinitive'},2),/“parler”/);
});

test('63 core plus 12 repair steps remain 75 after completion and across review',()=>{
 const now=Date.parse('2026-11-20T08:00:00Z');
 const deck=guidedLesson(unit).steps;assert.equal(deck.length,63);
 const all=[at(guidedTeachingRef(unit),now),...deck.map(x=>at(guidedCompletionRefs(x.id).complete,now)),...deck.filter(x=>x.kind!=='model').slice(0,12).map(x=>at(guidedCompletionRefs(x.id).first,now,false))];
 const active=guidedStatus(unit,all,now);assert.equal(active.total,75);assert.equal(active.completed,63);
 const done=[...all,...active.steps.filter(x=>x.stage==='repair').map(x=>at(guidedCompletionRefs(x.id).complete,now))];
 const completed=guidedStatus(unit,done,now);assert.equal(completed.total,75);assert.equal(completed.completed,75);assert.deepEqual(completed.teaching,{coreTotal:63,coreCompleted:63,repairTotal:12,repairCompleted:12,total:75,completed:75});
 const review=guidedStatus(unit,done,now+DAY);assert.equal(review.total,8);assert.equal(review.teaching.total,75);assert.equal(review.teaching.completed,75);
});
test('word audio markup preserves repeated words, order, accents and punctuation',()=>{
 const input="Je parle français, mais j’aime le français.";const expected="Je parle français, mais je veux écouter la radio.";
 const words=spokenWords(input);assert.equal(words.replace(/<[^>]+>/g,''),input);
 assert.equal((words.match(/data-gword="français"/g)||[]).length,2);
 const box=answerComparison({answer:input,expected,result:'incorrect'});
 const learner=box.split('ft-answer-submitted')[1].split('ft-answer-expected')[0];
 assert.equal((learner.match(/data-gword="français"/g)||[]).length,2);
 assert.match(EXACT_ANSWER_ATTRIBUTES,/autocorrect="off"/);assert.match(EXACT_ANSWER_ATTRIBUTES,/writingsuggestions="false"/);
});

test('devoir timeline teaches obligation in past, present and future',()=>{
 const rows=optionalVerbTimeline('devoir');assert.ok(rows.some(x=>x.fr==='je dois étudier'));assert.ok(rows.some(x=>x.fr==="j'ai dû étudier"));assert.ok(rows.some(x=>x.fr==='je devrai étudier'));
 assert.equal(spokenWords('je dois étudier',{choice:true}).replace(/<[^>]+>/g,''),'je dois étudier');assert.doesNotMatch(spokenWords('je dois étudier',{choice:true}),/<button/);
});

import {markAnswer,normaliseAnswer} from '../french-teaching/v1/data.js';
import {compareFrench,createTypingSample,revisionQueue,auditSignals,clozeFor,wordKey,revisionLabel} from '../french-teaching/v1/revision-signals.js';
test('word alignment highlights changed words and does not confuse une with negation',()=>{
 const got="J'ai preparé une tarte et j'ai reservé une table",expected="J'ai préparé une tarte et j'ai réservé une table";
 assert.doesNotMatch(answerFeedback(got,expected),/negative/);
 assert.match(answerFeedback(got,expected),/accents/);
 assert.deepEqual(compareFrench(got,expected).filter(d=>d.kind!=='match').map(d=>d.right.text),['préparé','réservé']);
 assert.equal(compareFrench('je parle la radio','je parle puis la radio').filter(d=>d.kind!=='match')[0].kind,'missing');
 const box=answerComparison({answer:got,expected,result:'incorrect'});
 assert.match(box,/pr<mark class="ft-word-difference">e<\/mark>paré/);
 assert.match(box,/r<mark class="ft-word-difference">é<\/mark>servé/);
 assert.doesNotMatch(box,/<mark class="ft-word-difference">une<\/mark>/);
});
test('word typing uses relative aggregates, excludes paste and treats a lone hesitation as weak',()=>{
 const sample=createTypingSample();let text='',at=0;
 for(const c of 'bonjour merci toujours'){text+=c;at+=text.startsWith('bonjour merci t')?650:100;sample.add(text,at);}
 const timings=sample.finish(text);
 assert.ok(timings.find(x=>x.word==='toujours')?.slow);
 assert.ok(!timings.find(x=>x.word==='merci')?.slow);
 const paste=createTypingSample();paste.add(text,1,{inputType:'insertFromPaste'});assert.deepEqual(paste.finish(text),[]);
 const rows=auditSignals({id:'a',at:100,ref:'x',targetLang:'fr',result:'correct',answer:text,expected:text,typing:timings});
 assert.equal(rows.length,1);assert.equal(revisionQueue(rows,100)[0].dueAt,null);
});
test('repeated signals increase priority, successful recall spaces practice and errors retry sooner',()=>{
 const events=[{id:'a',at:100,kind:'pronunciation',word:'École'},{id:'b',at:200,kind:'pronunciation',word:'école'},{id:'c',at:300,kind:'spelling',word:'école',actual:'ecole'}];
 assert.equal(revisionQueue(events.slice(0,1),100)[0].due,false);
 const after=revisionQueue(events,300)[0];assert.equal(after.due,true);assert.equal(after.counts.pronunciation,2);
 assert.equal(revisionQueue([...events,events[0]],300)[0].counts.pronunciation,2);
 const review={id:'d',at:400,kind:'review',word:'école',correct:true};
 assert.equal(revisionQueue([...events,review],400)[0].dueAt,400+86400000);
 assert.equal(revisionQueue([...events,{...review,correct:false}],400)[0].dueAt,400+600000);
 assert.equal(clozeFor('je vais à école','école'),'je vais à ____');
 assert.equal(auditSignals({id:'x',at:1,targetLang:'fr',result:'withheld',answer:'ecole',expected:'école'}).length,0);
});

test('a pause before a fluent word is distinguished from slow keystrokes',()=>{
 const sample=createTypingSample();let value='',at=0;
 for(const ch of 'bonjour merci toujours demain'){
  value+=ch;at+=value==='bonjour merci t'?950:100;sample.add(value,at);
 }
 const rows=sample.finish(value);
 assert.equal(rows.find(x=>x.word==='toujours').mode,'before-word');
 assert.equal(rows.find(x=>x.word==='demain').slow,false);
});

import {revisionImport} from '../french-teaching/v1/revision-signals.js';
test('explicit manual revision import proposes unique valid words without a write',()=>{
 assert.deepEqual(revisionImport('#revise='+encodeURIComponent('école,École,bonjour,<script>')),['École','bonjour']);
 assert.deepEqual(revisionImport('#elsewhere'),[]);
});


import {chooseAdaptivePlan,adaptivePlans,adaptiveStep,adaptiveOutcome} from '../french-teaching/v1/adaptive-teaching.js';
import {revisionEvents,phraseTarget} from '../french-teaching/v1/revision-signals.js';
import {assessmentDeck,STAGES} from '../french-teaching/v1/assessment.js';
import {curriculumNormalize} from '../french-teaching/v1/curriculum-meta.js';
test('adaptive teaching respects completed blocks, safe spacing, core progress and assessment protection',()=>{
 const now=Date.parse('2026-11-25T08:00:00Z'),id='unlock2-past',deck=guidedLesson(id).steps,sessionId='s';
 const entries=n=>[at(guidedTeachingRef(id),now),...deck.slice(0,n).map(x=>at(guidedCompletionRefs(x.id).complete,now))];
 const difficulty={id:'error',word:'préparé',kind:'spelling',at:now,context:{sessionId,unitId:id,position:6},sentence:"J'ai préparé le repas",english:'I prepared the meal'};
 const queue=revisionQueue([difficulty],now);
 const options=n=>({status:guidedStatus(id,entries(n),now),queue,audits:[],evidence:entries(n),sessionId,track:'unlocking',now});
 assert.equal(chooseAdaptivePlan(options(8)),null);
 const p=chooseAdaptivePlan(options(12));
 assert.ok(p);assert.equal(p.target,'préparé');assert.equal(p.mode,'dictation');assert.equal(p.fr,'préparé');
 assert.equal(adaptiveStep(p).novel,false);
 const saved={id:'p',at:now,answerAudit:{signal:{kind:'adaptive-plan',plan:p}}};
 const hint={id:'hint',at:now+1,answerAudit:{signal:{kind:'hint',planId:p.id,hintLevel:2}}};
 const restored=chooseAdaptivePlan({...options(12),audits:[saved,hint]});
 assert.equal(restored.id,p.id);assert.equal(restored.hintLevel,2);assert.equal(restored.resume,true);
 const answer={id:'a',at:now+2,answerAudit:{ref:p.id+':first',result:'correct'}};
 assert.equal(adaptivePlans([saved,hint,answer],id)[0].complete,true);
 const success=adaptiveOutcome(p,{answer:'préparé',correct:true});
 assert.equal(success.correct,true);
 const after=revisionQueue([difficulty,{...success,id:'a',at:now+2,ref:p.id+':first',context:{sessionId,unitId:id,position:12}}],now+3);
 const contextual=chooseAdaptivePlan({...options(16),queue:after,audits:[saved,answer],now:now+3});
 if(contextual){assert.equal(contextual.mode,'recall');assert.notEqual(contextual.fr,p.fr);}
 const delayed=chooseAdaptivePlan({...options(20),queue:revisionQueue([difficulty,{...success,id:'a',at:now+2,ref:p.id+':first'}],now+DAY+3),audits:[saved,answer],now:now+DAY+3,sessionId:'later'});
 assert.ok(delayed);assert.equal(delayed.mode,'recall');assert.notEqual(delayed.fr,p.fr);
 for(const stage of STAGES)for(const x of assessmentDeck(id,stage.id).filter(x=>['transfer','application'].includes(x.kind)))assert.notEqual(curriculumNormalize(delayed.fr),curriculumNormalize(x.fr));
 assert.equal(chooseAdaptivePlan({...options(12),status:{...options(12).status,next:{...deck[12],stage:'independent'}}}),null);
 assert.equal(chooseAdaptivePlan({...options(12),status:{...options(12).status,mode:'complete',next:null}}),null);
 assert.equal(guidedStatus(id,entries(12),now).teaching.coreCompleted,12);
});
test('positive independent and delayed evidence reduce priority; assistance and unfamiliar translations do not advance recall',()=>{
 const at=1000,base={id:'a',at,ref:'a',marker:'guided-exact-v1',targetLang:'fr',support:'none',result:'incorrect',answer:'je parle francais',expected:'je parle français',question:'I speak French',context:{kind:'write',stage:'independent',unitId:'x',sessionId:'s',position:1}};
 const good={...base,id:'b',at:at+100,ref:'b',result:'correct',answer:'je parle français'};
 const assisted={...good,id:'c',ref:'c',at:at+200,support:'small-prompt'};
 const late={...good,id:'d',ref:'d',at:at+DAY,context:{...base.context,stage:'day7'}};
 const events=revisionEvents([], [base,good,assisted,late]);
 assert.equal(events.filter(x=>x.kind==='success').length,2);
 assert.equal(revisionQueue(events,at+DAY)[0].score,0);
 const plan={id:'p',key:'français',target:'français',targetKind:'word',fr:'je parle français',en:'I speak French',mode:'recall'};
 assert.equal(adaptiveOutcome(plan,{correct:true,answer:'je parle français',support:'small-prompt'}).kind,'assisted');
 assert.equal(adaptiveOutcome(plan,{correct:true,answer:'je parle une autre langue'}).correct,false);
 assert.equal(phraseTarget('je dois étudier','I must study').word,'je dois');
});

import {learningAudioText} from '../french-teaching/v1/guided-ui.js';
test('semantic speech policy is explicit and never reads a protected answer',()=>{
 assert.equal(learningAudioText('model','Bonjour'),'Bonjour');
 assert.equal(learningAudioText('correction','J’ai étudié.'),'J’ai étudié.');
 assert.equal(learningAudioText('model','Bonjour',{protectedCheck:true}),'');
 assert.equal(learningAudioText('render','Bonjour'),'');
 assert.equal(guidedEntryAudio({kind:'model',unlockAction:'reverse',fr:'je parle français'}),'je parle français');
 assert.equal(guidedEntryAudio({kind:'write',fr:'je parle français'}),'');
});


test('shared written marking accepts harmless formatting but preserves French language distinctions',()=>{
 const expected='Hier j’ai préparé le repas et j’ai réservé une table';
 const answer="hier j'ai préparé le repas et j'ai réservé une table.";
 assert.equal(markAnswer(answer,expected),true);
 assert.equal(wordKey(answer),wordKey(expected));
 assert.equal(markAnswer('  HIER,  j’ai préparé le repas et j’ai réservé une table ! ',expected),true);
 assert.equal(markAnswer("hier j'ai preparé le repas et j'ai réservé une table",expected),false);
 assert.equal(markAnswer("hier j'ai préparé le repas et je réserve une table",expected),false);
 assert.equal(markAnswer("hier jai préparé le repas et j'ai réservé une table",expected),false);
 assert.equal(markAnswer('1,5','15'),false);
 assert.equal(markAnswer('1,5','1.5'),false);
 assert.equal(revisionLabel({word:'école'}),'word');
 assert.equal(revisionLabel({word:'je vais'}),'phrase');
 assert.equal(revisionLabel({word:expected}),'sentence');
 const box=answerComparison({answer,expected,result:'correct'});
 assert.match(box,/ft-answer-comparison correct/);
 assert.match(box,/capital H/);
 assert.match(box,/punctuation is accepted/);
 assert.doesNotMatch(box,/ft-word-difference/);
 const wrong=answerComparison({answer:answer.replace('préparé','preparé'),expected,result:'incorrect'});
 assert.match(wrong,/pr<mark class="ft-word-difference">e<\/mark>paré/);
 assert.match(wrong,/pr<mark class="ft-word-difference">é<\/mark>paré/);
 assert.match(wrong,/French accents/);
 assert.doesNotMatch(wrong,/<mark class="ft-word-difference">repas<\/mark>/);
});
test('legacy punctuation-only personal revision is treated as correct for scheduling without mutating its audit',()=>{
 const at=100000;
 const audit={id:'old-review',at,answerAudit:{ref:'revision:review',marker:'revision-v1',answer:'Bonjour.',expected:'Bonjour',signal:{kind:'review',word:'Bonjour',correct:false}}};
 const events=revisionEvents([audit],[]);
 assert.equal(events[0].correct,true);
 assert.equal(audit.answerAudit.signal.correct,false);
 assert.equal(revisionQueue(events,at)[0].dueAt,at+86400000);
});


test('listening support progresses from French sound to meaning, without early exposure',()=>{
 const fr="Hier j’ai préparé le repas et j’ai réservé une table",en="Yesterday I prepared the meal and booked a table";
 const context=listeningContext(fr,en),steps=listeningSteps(fr,en,context);
 assert.deepEqual(steps,['slow','chunks','context','shape','english-audio','english-text','reveal']);
 const initial=listeningHintMarkup({fr,en,context});
 assert.match(initial,/slower French/);
 assert.doesNotMatch(initial,/Yesterday|préparé|data-listen-index/);
 const chunked=listeningHintMarkup({fr,en,context,level:2});
 assert.match(chunked,/Chunk 1/);assert.doesNotMatch(chunked,/préparé|Yesterday/);
 const audio=listeningHintMarkup({fr,en,context,level:5});
 assert.match(audio,/Hear the English/);assert.doesNotMatch(audio,/Yesterday/);
 const written=listeningHintMarkup({fr,en,context,level:6});
 assert.match(written,/Yesterday I prepared/);assert.doesNotMatch(written,/préparé/);
 const chunks=listeningChunks(fr);assert.ok(chunks.length>1);
 assert.equal(normaliseAnswer(chunks.map(x=>x.text).join(' ')),normaliseAnswer(fr));
 assert.deepEqual(listeningSteps('bonjour','Listen and spell the French.'),['slow','shape','reveal']);
 assert.equal(verifiedListeningEnglish('Dictation: bonjour'),'');
 const repair=difficultListeningChunks("Hier j'ai préparé le repas et j'ai reservé une table",fr);
 assert.ok(repair.some(x=>x.difficult&&x.text.includes('réservé')));
 assert.ok(repair.some(x=>!x.difficult));
});
test('assisted dictation schedules a retry rather than advancing unassisted review',()=>{
 const at=100000,word='bonjour';
 const row=revisionQueue([{id:'hinted',at,word,kind:'assisted',mode:'dictation',correct:true}],at)[0];
 assert.equal(row.level,0);assert.equal(row.dueAt,at+600000);assert.equal(row.needsRecall,true);
});
