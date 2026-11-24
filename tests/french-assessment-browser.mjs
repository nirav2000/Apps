import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {assessmentDeck} from '../french-teaching/v1/assessment.js';
import {GUIDED_UNITS} from '../french-teaching/v1/guided-lessons.js';
const browser=await chromium.launch({headless:true});
const page=await browser.newPage({viewport:{width:390,height:844}});
const errors=[];
page.on('pageerror',e=>errors.push(String(e)));
try{
  await page.goto('http://127.0.0.1:8898/tests/french-browser-harness.html');
  await page.locator('.ft-tabs').waitFor();
  const cards=page.locator('.ft-e-dashboard .ft-e-metrics').first();
  assert.match(await cards.innerText(),/Not measured/);
  await page.locator('.ft-tabs [data-page="lesson"]').click();
  await page.locator('#ft-e-answer').waitFor();
  assert.match(await page.locator('.ft-e-question').innerText(),/Before teaching/i);
  const deck=assessmentDeck(GUIDED_UNITS[0].id,'baseline');
  for(let i=0;i<deck.length;i++){
    assert.equal(await page.locator('.ft-e-prompt').innerText(),deck[i].en);
    if(i===0)await page.locator('[data-eact="unknown"]').click();
    else{
      await page.locator('#ft-e-answer').fill(deck[i].fr);
      await page.locator('#ft-e-form button[type=submit]').click();
    }
  }
  assert.match(await page.locator('.ft-e-question').innerText(),/Starting knowledge recorded/i);
  await page.waitForFunction(()=>[...window.__testEvidence.values()].filter(x=>x.event?.phase==='diagnostic').length===8,null,{timeout:12000});
  const rows=await page.evaluate(()=>[...window.__testEvidence.values()].map(x=>x.event).filter(x=>x.phase==='diagnostic'));
  assert.equal(rows.reduce((n,x)=>n+x.score.correct,0),7);
  assert.ok(rows.every(x=>x.support==='none'&&!x.novel));
  await page.locator('.ft-tabs [data-page="history"]').click();
  assert.equal(await page.locator('.ft-audit-row').count(),8);
  assert.equal(await page.locator('.ft-audit-row.unknown').count(),1);
  assert.equal(await page.locator('.ft-audit-row.correct').count(),7);
  await page.locator('[data-history-filter]').selectOption('incorrect');
  assert.equal(await page.locator('.ft-audit-row').count(),1);
  await page.waitForFunction(()=>[...window.__testEvidence.values()].filter(x=>x.app==='next-french-answers').length===8,null,{timeout:12000});
  await page.reload();await page.locator('.ft-tabs').waitFor();
  await page.locator('.ft-tabs [data-page="history"]').click();
  assert.equal(await page.locator('.ft-audit-row').count(),8);
  await page.locator('.ft-tabs [data-page="evidence"]').click();
  assert.equal(await page.locator('.ft-e-chart circle').count(),1);
  assert.ok(await page.locator('.ft-e-knowledge-row').count()>=10);
  assert.match(await page.locator('.ft-e-dashboard .ft-e-metrics').first().innerText(),/Not measured/);
  await page.locator('[data-profile]').selectOption('sai');
  await page.locator('.ft-e-today').waitFor();
  assert.equal(await page.locator('.ft-e-chart circle').count(),0);
  await page.locator('.ft-tabs [data-page="history"]').click();assert.equal(await page.locator('.ft-audit-row').count(),0);
  await page.locator('.ft-tabs [data-page="lesson"]').click();
  assert.match(await page.locator('.ft-e-question').innerText(),/Before teaching/i);
  const dims=await page.evaluate(()=>({w:document.documentElement.scrollWidth,v:document.documentElement.clientWidth}));
  assert.ok(dims.w<=dims.v+2,JSON.stringify(dims));
  assert.deepEqual(errors,[]);
  console.log('French assessment browser: baseline, immutable first attempts, dashboard, mobile sizing, scoped learner isolation');
}finally{await browser.close();}
