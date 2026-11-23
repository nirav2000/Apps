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
    window.__spoken=[];
    Object.defineProperty(window,'speechSynthesis',{configurable:true,value:{
      cancel(){},getVoices(){return[{lang:'fr-FR',name:'Test French'}];},
      speak(u){window.__spoken.push({text:u.text,lang:u.lang});}
    }});
    Object.defineProperty(window,'SpeechSynthesisUtterance',{configurable:true,
      value:class {constructor(text){this.text=text;this.lang='';this.rate=1;}}});
  });
  await page.goto('http://127.0.0.1:8898/tests/french-browser-harness.html');
  await page.locator('.ft-tabs').waitFor();
  const evidence=()=>page.evaluate(()=>[...window.__testEvidence.values()].map(x=>x.event));
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
  const modal=page.locator('.ft-word-dialog');
  await modal.waitFor();
  assert.match(await modal.innerText(),/je voulais apprendre/);
  assert.match(await modal.innerText(),/je voudrai apprendre/);
  assert.match(await modal.innerText(),/je voudrais apprendre/);
  const grammar=modal.locator('details').filter({hasText:'Explore all present-tense endings'});
  assert.equal(await grammar.evaluate(el=>el.open),false);
  await modal.locator('[data-close-word]').click();
  await modal.waitFor({state:'detached'});

  await page.getByRole('button',{name:'Overview',exact:true}).click();
  assert.equal(await page.locator('.ft-todays-lesson').count(),1);
  await page.getByRole('button',{name:'Start guided lesson'}).click();
  await page.locator('.ft-guided-task').waitFor();
  assert.match(await page.locator('.ft-guided-head').innerText(),/Speak and listen/);
  await page.locator('[data-gact="focus-word"]').first().click();
  await page.waitForFunction(()=>window.__spoken.at(-1)?.text==='écouter');
  const lesson=guidedLesson('speak-and-listen');
  const models=lesson.steps.filter(s=>s.kind==='model');
  assert.equal(models.length,19);
  // Oral presentation is marked unscored. It can never inflate independence.
  for(let i=0;i<models.length;i++){
    await page.getByRole('button',{name:'I have repeated it → Next'}).click();
  }
  assert.match(await page.locator('.ft-guided-task').innerText(),/Which French phrase matches the English/);
  const answer=lesson.steps.find(s=>s.kind==='choice').fr;
  await page.locator('.ft-guided-options button').filter({hasText:answer}).first().click();
  await page.getByRole('button',{name:'Next phrase'}).click();
  await page.waitForFunction(()=>[...window.__testEvidence.values()].some(x=>x.event?.source?.ref?.includes('guided-v2:')&&x.event?.score?.total===1),null,{timeout:12000});
  const events=await evidence();
  assert.ok(events.some(e=>e.source.ref.includes(':recap:')&&e.score.total===0));
  assert.ok(events.some(e=>e.source.ref.includes(':guided:')&&e.source.ref.endsWith(':first')&&e.score.total===1));
  assert.ok(events.every(e=>!e.source.ref.startsWith('next-french-preview')));

  // Durable progress survives navigation and page reload via scoped evidence.
  await page.reload();
  await page.locator('.ft-tabs').waitFor();
  await page.getByRole('button',{name:"Today's lesson",exact:true}).click();
  assert.ok((await page.locator('.ft-guided-progress').getAttribute('aria-valuenow'))>=20);
  assert.match(await page.locator('.ft-guided-head').innerText(),/Speak and listen/);
  // Adult/Sai scope changes reset current lesson (no accidental merged records).
  await page.locator('[data-profile]').selectOption('sai');
  await page.locator('.ft-todays-lesson').waitFor();
  assert.match(await page.locator('.ft-todays-lesson').innerText(),/Start guided lesson/);

  const dims=await page.evaluate(()=>({w:document.documentElement.scrollWidth,v:document.documentElement.clientWidth}));
  assert.ok(dims.w<=dims.v+2,JSON.stringify(dims));
  assert.deepEqual(errors,[]);
  console.log('Guided French browser: 10 reusable frames, optional tenses, repeated oral models, scoped cloud evidence, mobile resume and learner isolation');
}finally{await browser.close();}
