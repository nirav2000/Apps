import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {guidedLesson} from '../french-teaching/v1/guided-lessons.js';

const browser=await chromium.launch({headless:true});
const page=await browser.newPage({viewport:{width:390,height:844}});
const errors=[];
page.on('pageerror',e=>errors.push(String(e)));
page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
try{
  await page.addInitScript(()=>{
    window.__spoken=[];window.__holdSpeech=false;let active=null,timer;
    window.__finishSpeech=()=>{clearTimeout(timer);const u=active;active=null;u?.onend?.();};
    Object.defineProperty(window,'speechSynthesis',{configurable:true,value:{
      cancel(){clearTimeout(timer);const u=active;active=null;u?.onerror?.();},getVoices(){return[{lang:'fr-FR',name:'Test French',voiceURI:'test-fr'},{lang:'fr-CA',name:'Test Canadian',voiceURI:'test-ca'},{lang:'en-GB',name:'Test English',voiceURI:'test-en'}];},
      speak(u){active=u;window.__spoken.push({text:u.text,lang:u.lang,voice:u.voice?.voiceURI,step:document.querySelector('[data-guided-step]')?.dataset.guidedStep});if(!window.__holdSpeech)timer=setTimeout(window.__finishSpeech,50);}
    }});
    Object.defineProperty(window,'SpeechSynthesisUtterance',{configurable:true,
      value:class {constructor(text){this.text=text;this.lang='';this.rate=1;}}});
  });
  await page.goto('http://127.0.0.1:8898/tests/french-browser-harness.html');
  await page.locator('.ft-tabs').waitFor();
  const evidence=()=>page.evaluate(()=>[...window.__testEvidence.values()].map(x=>x.event));
  await page.getByRole('button',{name:'Settings',exact:false}).click();
  const voices=page.locator('[data-french-voice]');
  assert.equal(await voices.locator('option').count(),3);
  await voices.selectOption('test-ca');
  await page.getByRole('button',{name:'Preview voice'}).click();
  await page.waitForFunction(()=>window.__spoken.at(-1)?.voice==='test-ca');
  await page.reload();await page.locator('.ft-tabs').waitFor();
  await page.getByRole('button',{name:'Settings',exact:false}).click();
  assert.equal(await page.locator('[data-french-voice]').inputValue(),'test-ca');
  await page.locator('[data-french-voice]').selectOption('test-fr');
  // The Magic Ten shows full usable phrases and no mandatory grammar.
  await page.getByRole('button',{name:'Magic 10',exact:true}).click();
  assert.equal(await page.locator('.ft-magic-row').count(),10);
  assert.equal(await page.locator('.ft-guided-grammar').evaluate(x=>x.open),false);
  assert.match(await page.locator('.ft-magic-rows').innerText(),/je vais parler français/);
  assert.match(await page.locator('.ft-magic-rows').innerText(),/j'ai parlé français/);
  await page.locator('[data-gverb]').selectOption('lire');
  await page.locator('[data-gspeak="8"]').click();
  await page.waitForFunction(()=>window.__spoken.at(-1)?.text==="j'ai lu en français");
  await page.getByRole('button',{name:'Knowledge grid'}).click();
  await page.locator('.ft-grid-row [data-word="veux"]').first().click();
  await page.waitForFunction(()=>window.__spoken.at(-1)?.text==='veux');
  assert.equal(await page.locator('.ft-word-dialog').count(),0);
  await page.getByRole('button',{name:'Explore veux',exact:true}).click();
  const modal=page.locator('.ft-word-dialog');
  await modal.waitFor();
  assert.match(await modal.innerText(),/je voulais apprendre/);
  assert.match(await modal.innerText(),/je voudrai apprendre/);
  assert.match(await modal.innerText(),/je voudrais apprendre/);
  const grammar=modal.locator('details').filter({hasText:'Explore all present-tense endings'});
  assert.equal(await grammar.evaluate(el=>el.open),false);
  await modal.locator('[data-close-word]').click();
  await modal.waitFor({state:'detached'});

  // Specific user-reported vocabulary: select a word for audio, deliberately
  // explore it, then hold a different word without an accidental second tap.
  await page.getByRole('button',{name:'Magic 10',exact:true}).click();
  await page.locator('[data-gverb]').selectOption('étudier');
  const mustRow=page.locator('.ft-magic-row').filter({hasText:'je dois étudier le français'}).first();
  const dois=mustRow.locator('[data-gword="dois"]');
  await dois.click();
  await page.waitForFunction(()=>window.__spoken.at(-1)?.text==='dois');
  assert.equal(await modal.count(),0);
  await page.getByRole('button',{name:'Explore dois',exact:true}).click();
  await modal.waitFor();
  assert.match(await modal.innerText(),/devoir/);
  assert.match(await modal.innerText(),/je devrai étudier/);
  assert.match(await modal.innerText(),/j'ai dû étudier/);
  await modal.locator('[data-close-word]').click();
  await modal.waitFor({state:'detached'});
  const study=mustRow.locator('[data-gword="étudier"]');
  const spokenBefore=await page.evaluate(()=>window.__spoken.length);
  await study.click({delay:650});
  await modal.waitFor();
  assert.match(await modal.innerText(),/to study/);
  assert.match(await modal.innerText(),/infinitive étudier/);
  assert.equal(await page.evaluate(()=>window.__spoken.length),spokenBefore);
  await modal.locator('[data-close-word]').click();await modal.waitFor({state:'detached'});
  // The single deliberate word request is saved separately from scoring.
  await page.getByRole('button',{name:'Revision signals',exact:true}).click();
  const signalRow=page.locator('.ft-revision-row').filter({has:page.locator('[data-gword="dois"]')});
  assert.match(await signalRow.innerText(),/1 word plays/);
  assert.match(await signalRow.innerText(),/Low/);
  await page.getByRole('button',{name:'Overview',exact:true}).click();
  assert.equal(await page.locator('.ft-todays-lesson').count(),1);
  await page.getByRole('button',{name:'Start guided lesson'}).click();
  await page.locator('.ft-guided-task').waitFor();
  assert.match(await page.locator('.ft-guided-head').innerText(),/Speak and listen/);
  await page.waitForFunction(()=>window.__spoken.at(-1)?.text.includes('Écoutez bien.'));
  await page.locator('.ft-guided-french [data-gword="français"]').click();
  await page.waitForFunction(()=>window.__spoken.at(-1)?.text==='français');
  const originalStep=await page.locator('[data-guided-step]').getAttribute('data-guided-step');
  await page.getByRole('button',{name:'Explore français',exact:true}).click();
  await modal.waitFor();assert.match(await modal.innerText(),/French/);
  await modal.locator('[data-close-word]').click();await modal.waitFor({state:'detached'});
  assert.equal(await page.locator('[data-guided-step]').getAttribute('data-guided-step'),originalStep);
  await page.locator('[data-gact="focus-word"]').first().click();
  await page.waitForFunction(()=>window.__spoken.at(-1)?.text==='écouter');
  const lesson=guidedLesson('speak-and-listen');
  const models=lesson.steps.filter(s=>s.kind==='model');
  assert.equal(models.length,19);
  // Oral presentation is marked unscored. It can never inflate independence.
  await page.evaluate(()=>{window.__finishSpeech();window.__holdSpeech=true;});
  const firstStep=models[0].id;
  await page.locator('[data-gact="finish-model"]').click();
  await page.waitForFunction(fr=>window.__spoken.at(-1)?.text===fr,models[0].fr);
  assert.equal(await page.locator('[data-guided-step]').getAttribute('data-guided-step'),firstStep);
  assert.equal(await page.locator('[data-gact="finish-model"]').isDisabled(),true);
  await page.evaluate(()=>{window.__holdSpeech=false;window.__finishSpeech();});
  await page.locator('[data-guided-step="'+models[1].id+'"]').waitFor();
  await page.waitForFunction(step=>window.__spoken.at(-1)?.step===step,models[1].id);
  for(let i=1;i<models.length;i++){
    if(i===3){
      await page.getByRole('button',{name:'Reveal French'}).click();
      await page.waitForFunction(fr=>window.__spoken.at(-1)?.text.includes(fr),models[i].fr);
    }
    await page.getByRole('button',{name:'I have repeated it → Next'}).click();
    const next=lesson.steps[i+1];
    await page.locator('[data-guided-step="'+next.id+'"]').waitFor();
  }
  await page.waitForFunction(fr=>window.__spoken.at(-1)?.text.includes(fr),models.at(-1).fr);
  assert.match(await page.locator('.ft-guided-task').innerText(),/Which French phrase matches the English/);
  const answer=lesson.steps.find(s=>s.kind==='choice').fr;
  const choice=lesson.steps.find(s=>s.kind==='choice');
  const wrong=choice.choices.find(x=>x!==answer);
  await page.locator('.ft-guided-options button').filter({hasText:wrong}).first().click();
  await page.waitForFunction(fr=>window.__spoken.at(-1)?.text===fr,wrong);
  assert.equal(await page.locator('.ft-guided-options button.incorrect').count(),1);
  await page.locator('.ft-guided-options button').filter({hasText:answer}).first().click();
  await page.waitForFunction(fr=>window.__spoken.at(-1)?.text===fr,answer);
  assert.equal(await page.locator('.ft-guided-options button.correct').count(),1);
  assert.equal(await page.locator('.ft-guided-model').count(),0);
  assert.equal(await page.locator('.ft-guided-options button:disabled').count(),0);
  assert.equal(await page.locator('.ft-guided-options button button').count(),0);
  const choiceWord=page.locator('.ft-guided-options button.correct [data-choice-word]').first();
  const word=await choiceWord.getAttribute('data-choice-word');await choiceWord.click();
  await page.waitForFunction(w=>window.__spoken.at(-1)?.text===w,word);
  await page.locator('.ft-guided-options button').filter({hasText:wrong}).first().locator('[data-choice-replay]').click();
  await page.waitForFunction(fr=>window.__spoken.at(-1)?.text===fr,wrong);
  assert.equal(await page.locator('.ft-guided-options button.correct').count(),1);
  await page.getByRole('button',{name:'Next phrase'}).click();
  await page.locator('[data-guided-step="'+lesson.steps[20].id+'"]').waitFor();
  await page.waitForFunction(()=>[...window.__testEvidence.values()].some(x=>x.event?.source?.ref?.includes('guided-v2:')&&x.event?.score?.total===1),null,{timeout:12000});
  const events=await evidence();
  assert.ok(events.some(e=>e.source.ref.includes(':recap:')&&e.score.total===0));
  const first=events.filter(e=>e.source.ref===choice.id+':first');
  assert.equal(first.length,1);assert.equal(first[0].score.correct,0);assert.equal(first[0].score.total,1);
  assert.ok(events.every(e=>!e.source.ref.startsWith('next-french-preview')));

  // Durable progress survives navigation and page reload via scoped evidence.
  await page.reload();
  await page.locator('.ft-tabs').waitFor();
  await page.getByRole('button',{name:"Today's lesson",exact:true}).click();
  assert.ok((await page.locator('.ft-guided-progress').getAttribute('aria-valuenow'))>=20);
  assert.match(await page.locator('.ft-guided-head').innerText(),/Speak and listen/);
  // Exercise inline French feedback and progressive hints.
  const firstBuild=lesson.steps.findIndex(s=>s.stage==='guided'&&s.kind==='write');
  for(const step of lesson.steps.slice(20,firstBuild)){
    await page.locator('[data-guided-step="'+step.id+'"]').waitFor();
    if(step.kind==='choice'||step.kind==='listen'){
      await page.getByRole('button',{name:step.kind==='choice'?step.fr:step.en,exact:true}).click();
      if(step.kind==='listen')assert.equal(await page.locator('.ft-choice-translation').innerText(),step.fr);
    }else{
      await page.locator('#ft-guided-input').fill(step.fr);
      await page.getByRole('button',{name:'Check answer'}).click();
    }
    await page.getByRole('button',{name:'Next phrase'}).click();
  }
  const build=lesson.steps[firstBuild];
  await page.locator('[data-guided-step="'+build.id+'"]').waitFor();
  await page.locator('#ft-guided-input').fill('je');
  await page.getByRole('button',{name:'Get a hint'}).click();
  assert.equal(await page.locator('#ft-guided-input').inputValue(),'je');
  assert.ok((await page.locator('.ft-guided-hint').innerText()).length>20);
  await page.getByRole('button',{name:'Show first part'}).click();
  assert.equal(await page.locator('#ft-guided-input').inputValue(),'je');
  assert.equal(await page.locator('[data-gact="hint"]').count(),0);
  await page.locator('#ft-guided-input').fill(build.fr);
  await page.getByRole('button',{name:'Check answer'}).click();
  assert.equal(await page.locator('.ft-guided-pair').count(),1);
  assert.equal(await page.locator('.ft-answer-comparison.correct').count(),1);
  assert.equal(await page.evaluate(()=>document.activeElement?.dataset.gact),'next');
  await page.keyboard.press('Enter');
  const wrongBuild=lesson.steps[firstBuild+1];
  await page.locator('[data-guided-step="'+wrongBuild.id+'"]').waitFor();
  assert.equal(await page.evaluate(()=>document.activeElement?.id),'ft-guided-input');
  const incorrect="je parle français, mais j’aime le français";
  assert.equal(await page.locator('#ft-guided-input').getAttribute('autocorrect'),'off');
  await page.locator('#ft-guided-input').fill(incorrect);
  await page.keyboard.press('Enter');
  const marked=page.locator('.ft-answer-comparison.incorrect');
  await marked.waitFor();
  assert.equal(await marked.locator('.ft-answer-submitted .ft-answer-value').innerText(),incorrect);
  assert.equal(await marked.locator('.ft-answer-expected .ft-answer-value').innerText(),wrongBuild.fr);
  assert.equal(await marked.locator('.ft-answer-submitted [data-gword="français"]').count(),2);
  await marked.locator('.ft-answer-submitted [data-gword="français"]').first().click();
  await page.waitForFunction(()=>window.__spoken.at(-1)?.text==='français');
  await page.locator('[data-gact="finish-revealed"]').focus();
  assert.equal(await marked.evaluate(x=>getComputedStyle(x).backgroundColor),'rgb(255, 240, 237)');
  assert.equal(await page.locator('.ft-guided-feedback.incorrect').count(),1);
  assert.equal(await page.evaluate(()=>document.activeElement?.dataset.gact),'finish-revealed');
  await page.keyboard.press('Enter');
  await page.locator('[data-guided-step="'+lesson.steps[firstBuild+2].id+'"]').waitFor();
  await page.waitForFunction(ref=>[...window.__testEvidence.values()].some(x=>x.event?.source?.ref===ref&&x.event?.score?.total===1&&x.event?.score?.correct===0),wrongBuild.id+':first',{timeout:12000});
  await page.waitForFunction(ref=>[...window.__testEvidence.values()].some(x=>x.event?.source?.ref===ref),build.id+':hint',{timeout:12000});
  // Manual additions enter the private queue and trigger actual practice.
  await page.getByRole('button',{name:'Revision signals',exact:true}).click();
  await page.locator('#ft-revision-add-word').fill('école');
  await page.locator('#ft-revision-add button[type="submit"],#ft-revision-add button:not([type])').click();
  await page.locator('.ft-revision-row').filter({has:page.locator('[data-gword="école"]')}).waitFor();
  await page.getByRole('button',{name:/Practise .* due words/}).click();
  await page.locator('#ft-revision-answer').waitFor();
  const wordToReview=await page.evaluate(()=>window.__spoken.at(-1).text);
  await page.locator('#ft-revision-answer').fill(wordToReview);
  await page.locator('#ft-revision-form button[type="submit"]').click();
  await page.locator('.ft-revision-task .ft-answer-comparison.correct').waitFor();
  await page.waitForFunction(()=>[...window.__testEvidence.values()].some(x=>x.event?.answerAudit?.signal?.kind==='review'&&x.event.answerAudit.signal.correct),null,{timeout:12000});
  await page.locator('[data-act="revision-leave"]').click();
  // Adult/Sai scope changes reset current lesson (no accidental merged records).
  await page.locator('[data-profile]').selectOption('sai');
  await page.locator('.ft-todays-lesson').waitFor();
  assert.match(await page.locator('.ft-todays-lesson').innerText(),/Start guided lesson/);
  await page.getByRole('button',{name:'Revision signals',exact:true}).click();
  assert.equal(await page.locator('.ft-revision-row').count(),0);

  const dims=await page.evaluate(()=>({w:document.documentElement.scrollWidth,v:document.documentElement.clientWidth}));
  assert.ok(dims.w<=dims.v+2,JSON.stringify(dims));
  assert.deepEqual(errors,[]);
  console.log('Guided French browser: 10 reusable frames, optional tenses, repeated oral models, scoped cloud evidence, mobile resume and learner isolation');
}finally{await browser.close();}
