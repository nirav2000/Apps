import {chromium} from 'playwright';
import assert from 'node:assert/strict';
const browser=await chromium.launch({headless:true});
const page=await browser.newPage({viewport:{width:390,height:844}});
const errors=[];
page.on('pageerror',error=>errors.push(String(error)));
page.on('console',message=>{if(message.type()==='error')errors.push(message.text());});
try{
  await page.addInitScript(()=>{
    window.__spoken=[];
    const fake={
      speak(utterance){window.__spoken.push({text:utterance.text,lang:utterance.lang});},
      cancel(){},
      getVoices(){return[{lang:'fr-FR',name:'Test French voice'}];}
    };
    try{
      Object.defineProperty(window,'speechSynthesis',{configurable:true,value:fake});
      Object.defineProperty(window,'SpeechSynthesisUtterance',{configurable:true,
        value:class{constructor(text){this.text=text;this.lang='';this.rate=1;}}});
      window.__ttsReady=true;
    }catch(e){
      try{
        window.speechSynthesis.speak=utterance=>window.__spoken.push({text:utterance.text,lang:utterance.lang});
        window.speechSynthesis.cancel=()=>{};
        window.__ttsReady=true;
      }catch{window.__ttsReady=false;}
    }
  });
  await page.goto('http://127.0.0.1:8898/tests/french-browser-harness.html',{waitUntil:'domcontentloaded'});
  await page.locator('.ft-tabs').waitFor({timeout:15000});
  assert.equal(await page.evaluate(()=>window.__ttsReady),true,'French audio should be simulatable in Chromium');

  // Alphabet: one tap selects the letter AND plays its French name.
  await page.locator('.ft-tabs [data-page="explore"]').click();
  await page.locator('.ft-explore-nav').getByRole('button',{name:'Alphabet',exact:true}).click();
  await page.locator('[data-letter="1"]').click();
  assert.equal(await page.locator('.ft-letter-large').innerText(),'B');
  await page.waitForFunction(()=>window.__spoken.at(-1)?.text==='bé',null,{timeout:2500});
  assert.equal(await page.evaluate(()=>window.__spoken.at(-1).lang),'fr-FR');
  await page.getByRole('button',{name:'Group similar letter names'}).click();
  assert.equal(await page.locator('[data-letter]').count(),26);
  assert.equal(await page.locator('.ft-name-family').count(),4);
  await page.locator('.ft-family-letters [data-letter="16"]').click(); // Q
  assert.equal(await page.locator('.ft-letter-large').innerText(),'Q');
  await page.waitForFunction(()=>window.__spoken.at(-1)?.text==='cu',null,{timeout:2500});
  await page.getByRole('button',{name:'Show A–Z order'}).click();
  assert.equal(await page.locator('[data-letter]').count(),26);

  // Phonics: groups, common graphemes, audible sample and a graded recognition attempt.
  await page.locator('.ft-tabs [data-page="explore"]').click();
  await page.locator('.ft-explore-nav').getByRole('button',{name:'Sounds',exact:true}).click();
  assert.ok(await page.locator('.ft-sound-card').count()>=5);
  await page.locator('[data-sound-group="nasal-vowels"]').click();
  assert.equal(await page.locator('.ft-sound-card').count(),4);
  await page.locator('.ft-sound-words [data-sound-play="in-ain-ein"][data-example="0"]').click();
  await page.waitForFunction(()=>window.__spoken.at(-1)?.text==='vin',null,{timeout:2500});
  const audioBefore=await page.evaluate(()=>window.__spoken.length);
  await page.getByRole('button',{name:'Test your ear'}).click();
  assert.ok(await page.evaluate(n=>window.__spoken.length>n,audioBefore));
  await page.getByRole('button',{name:'Play the word'}).click();
  assert.equal(await page.locator('[data-sound-answer]').count(),3);
  const selected=await page.locator('[data-sound-answer]').first().getAttribute('data-sound-answer');
  await page.locator('[data-sound-answer]').first().click();
  await page.locator('.ft-model').waitFor();
  await page.waitForFunction(word=>window.__spoken.at(-1)?.text.startsWith(word),selected);
  assert.equal(await page.locator('.ft-phonics-choices .correct').count(),1);
  assert.equal(await page.locator('[data-sound-answer]:disabled').count(),0);
  const another=await page.locator('[data-sound-answer]').nth(1).getAttribute('data-sound-answer');
  await page.locator('[data-sound-answer]').nth(1).click();
  await page.waitForFunction(word=>window.__spoken.at(-1)?.text===word,another);
  await page.waitForFunction(()=>[...window.__testEvidence.values()].some(x=>x.event?.score?.total===1&&x.event?.concept?.startsWith('french:phonics:')),null,{timeout:8000});
  assert.equal(await page.evaluate(()=>[...window.__testEvidence.values()].filter(x=>x.event?.score?.total===1&&x.event?.concept?.startsWith('french:phonics:')).length),1);

  // Knowledge first, then optional grammar on-demand: verbs and the sans-dans explanation.
  await page.locator('.ft-tabs [data-page="explore"]').click();
  await page.locator('.ft-explore-nav').getByRole('button',{name:'Knowledge grid',exact:true}).click();
  assert.equal(await page.locator('.ft-word-dialog').count(),0);
  assert.equal(await page.locator('.ft-cuddle-example').count(),5);
  assert.ok(await page.locator('.ft-grid-row [data-word="veux"]').count()>=1);
  await page.locator('.ft-grid-row [data-word="veux"]').first().click();
  await page.waitForFunction(()=>window.__spoken.at(-1)?.text==='veux');
  assert.equal(await page.locator('.ft-word-dialog').count(),0);
  await page.getByRole('button',{name:'Explore veux',exact:true}).click();
  await page.locator('.ft-word-dialog').waitFor();
  const modal=page.locator('.ft-word-dialog');
  assert.match(await modal.innerText(),/vouloir/);
  assert.match(await modal.innerText(),/je voulais apprendre/);
  await modal.locator('details').filter({hasText:'Explore all present-tense endings'}).locator('summary').click();
  assert.match(await modal.innerText(),/voulons/);
  assert.match(await modal.innerText(),/voulez/);
  assert.match(await modal.innerText(),/Irregular/);
  assert.equal(await modal.locator('.ft-verb-table tbody tr').count(),6);
  await modal.getByRole('button',{name:'Infinitive'}).click();
  await page.waitForFunction(()=>window.__spoken.at(-1)?.text==='vouloir',null,{timeout:2500});
  await modal.getByRole('button',{name:'Close word explanation'}).click();
  await page.locator('.ft-word-dialog').waitFor({state:'detached'});
  await page.locator('.ft-grid-row [data-word="J\'habite"]').first().click({delay:650});
  await page.locator('.ft-word-dialog').waitFor();
  assert.match(await page.locator('.ft-word-dialog').innerText(),/habiter/);
  assert.match(await page.locator('.ft-word-dialog').innerText(),/dans une maison/);
  assert.equal(await page.locator('.ft-verb-table tbody tr').count(),6);
  await page.keyboard.press('Escape');
  await page.locator('.ft-word-dialog').waitFor({state:'detached'});

  // Word explorer also works in the sentence workshop; its visibility does not
  // turn a supported/practised answer into novel transfer evidence.
  await page.locator('.ft-tabs [data-page="explore"]').click();
  await page.locator('.ft-explore-nav').getByRole('button',{name:'Sentence workshop',exact:true}).click();
  await page.locator('.ft-workshop-french [data-word="parce que"]').first().click();
  await page.getByRole('button',{name:'Explore parce que',exact:true}).click();
  await page.locator('.ft-word-dialog').waitFor();
  assert.match(await page.locator('.ft-word-dialog').innerText(),/because/);
  await page.locator('.ft-word-dialog [data-close-word]').click();

  const layout=await page.evaluate(()=>({
    width:document.documentElement.scrollWidth,
    viewport:document.documentElement.clientWidth
  }));
  assert.ok(layout.width<=layout.viewport+2,JSON.stringify(layout));
  assert.deepEqual(errors,[]);
  console.log('French extensions browser passed: click-to-speak alphabet, name families, phonics audio/recognition, verb explorer and mobile layout');
}finally{
  await browser.close();
}
