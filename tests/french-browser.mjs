import {chromium} from 'playwright';
import assert from 'node:assert/strict';

const browser=await chromium.launch({headless:true});
const page=await browser.newPage({viewport:{width:390,height:844}});
const errors=[];
page.on('pageerror',e=>errors.push(String(e)));
page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
try{
  await page.goto('http://127.0.0.1:8898/tests/french-browser-harness.html',{waitUntil:'domcontentloaded'});
  await page.locator('.ft-tabs').waitFor({timeout:16000});
  await page.locator('[data-cloud-status]').filter({hasText:'Firebase'}).waitFor({timeout:16000});
  assert.match(await page.locator('h1').first().innerText(),/French, built to be useful/);

  await page.getByRole('button',{name:'Alphabet',exact:true}).click();
  assert.equal(await page.locator('[data-letter]').count(),26);
  await page.locator('[data-letter="25"]').click();
  assert.match(await page.locator('.ft-letter-large').innerText(),/Z/);
  await page.getByRole('button',{name:'Test all 26'}).click();
  assert.match(await page.locator('h2').last().innerText(),/Which letter did you hear/);

  await page.getByRole('button',{name:'Knowledge grid'}).click();
  assert.equal(await page.locator('.ft-grid-row').count(),14);
  await page.getByRole('button',{name:'Cover English'}).click();
  assert.match(await page.locator('.ft-covered').first().innerText(),/English hidden/);

  await page.getByRole('button',{name:'Sentence workshop'}).click();
  assert.match(await page.locator('.ft-card').first().innerText(),/80 distinct sentences/);
  await page.locator('[data-workshop-key="mode"]').selectOption('1');
  assert.match(await page.locator('.ft-workshop-french').innerText(),/mais/);
  await page.getByRole('button',{name:'Type from English'}).click();
  await page.locator('#ft-answer-text').fill("J'aime le français, mais je fais parfois des erreurs.");
  await page.getByRole('button',{name:'Check answer'}).click();
  assert.match(await page.locator('.ft-feedback').innerText(),/Correct independently/);
  await page.waitForFunction(()=>window.__testEvidence.size>=2,null,{timeout:8000});
  const adultRows=await page.evaluate(()=>[...window.__testEvidence.keys()].filter(k=>k.includes('/learners/adult/')).length);
  assert.ok(adultRows>=2);
  await page.getByRole('button',{name:'Sentence workshop'}).click();
  // A model-visible answer is correct with support, not independent.
  await page.getByRole('button',{name:'Reveal French'}).click();
  await page.getByRole('button',{name:'Type from English'}).click();
  await page.locator('#ft-answer-text').fill("J'aime le français, mais je fais parfois des erreurs.");
  await page.getByRole('button',{name:'Check answer'}).click();
  assert.match(await page.locator('.ft-feedback').innerText(),/Correct with support/);
  await page.waitForFunction(()=>[...window.__testEvidence.values()].some(x=>x.event?.support==='worked-example'),null,{timeout:8000});

  await page.locator('[data-profile]').selectOption('sai');
  await page.locator('[data-cloud-status]').filter({hasText:'Firebase'}).waitFor({timeout:16000});
  assert.match(await page.locator('.ft-metrics').innerText(),/Not measured/);
  await page.locator('[data-profile]').selectOption('adult');
  await page.locator('[data-cloud-status]').filter({hasText:'Firebase'}).waitFor({timeout:16000});
  assert.match(await page.locator('.ft-metrics').innerText(),/100%/);

  assert.deepEqual(errors,[]);
  console.log('French browser smoke passed: alphabet, grid, workshop, answer, Firebase and learner isolation');
}finally{await browser.close();}
