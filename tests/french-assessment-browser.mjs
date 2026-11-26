import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {assessmentDeck} from '../french-teaching/v1/assessment.js';
import {GUIDED_UNITS,guidedLesson,guidedTeachingRef,guidedCompletionRefs} from '../french-teaching/v1/guided-lessons.js';
import {normalizeEvidence} from '../learning-evidence/v1/index.js';
const browser=await chromium.launch({headless:true});
const page=await browser.newPage({viewport:{width:390,height:844}});
const errors=[];
page.on('pageerror',e=>errors.push(String(e)));
try{
  await page.goto('http://127.0.0.1:8898/tests/french-browser-harness.html');
  await page.locator('.ft-tabs').waitFor();
  await page.locator('.ft-tabs [data-page="evidence"]').click();
  const cards=page.locator('.ft-e-dashboard .ft-e-metrics').first();
  assert.match(await cards.innerText(),/Not measured/);
  await page.locator('.ft-tabs [data-page="home"]').click();
  await page.locator('[data-learning-path] [data-eact="daily"]').click();
  await page.locator('#ft-e-answer').waitFor();
  assert.equal(await page.locator('.ft-e-question [data-gword],.ft-e-question [data-word],.ft-e-question [data-choice-word]').count(),0);
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
  await page.locator('.ft-tabs [data-page="evidence"]').click();
  assert.equal(await page.locator('.ft-e-chart circle').count(),0);
  await page.locator('.ft-tabs [data-page="history"]').click();assert.equal(await page.locator('.ft-audit-row').count(),0);
  await page.locator('.ft-tabs [data-page="home"]').click();
  await page.locator('[data-learning-path] [data-eact="daily"]').click();
  assert.match(await page.locator('.ft-e-question').innerText(),/Before teaching/i);
  const dims=await page.evaluate(()=>({w:document.documentElement.scrollWidth,v:document.documentElement.clientWidth}));
  assert.ok(dims.w<=dims.v+2,JSON.stringify(dims));
  assert.deepEqual(errors,[]);
  const repair=await browser.newPage({viewport:{width:834,height:1112}});
  const repairErrors=[];repair.on('pageerror',e=>repairErrors.push(String(e)));
  const unit=GUIDED_UNITS[0],now=Date.now(),finish=now-6*60000;
  const scope={appId:'next-french',accountId:'test-owner',learnerId:'adult'};
  let seq=0;const event=(ref,at,extra={})=>normalizeEvidence({id:'repair-browser-'+(++seq),concept:'french:test',phase:'practice',support:'worked-example',source:{kind:'french-course',ref},at,...extra},scope);
  const steps=guidedLesson(unit.id).steps,checks=assessmentDeck(unit.id,'immediate');
  const seed=[event(guidedTeachingRef(unit.id),finish-360000),...steps.map((s,i)=>event(guidedCompletionRefs(s.id).complete,finish-steps.length+i+1,{concept:s.concept})),
    ...checks.map((x,i)=>event(x.ref,now-1000+i,{concept:x.concept,phase:x.kind==='transfer'?'transfer':'practice',support:'none',correctCount:i===0?0:1,total:1,novel:x.kind==='transfer'}))];
  await repair.addInitScript(seed=>{
   localStorage.setItem('apps-learning-evidence-v1:next-french:test-owner:adult',JSON.stringify({schema:1,entries:seed}));
   window.__spoken=[];window.__hold=false;let active,timer;
   window.__finish=()=>{clearTimeout(timer);const u=active;active=null;u?.onend?.();};
   Object.defineProperty(window,'speechSynthesis',{configurable:true,value:{getVoices:()=>[],cancel(){clearTimeout(timer);active=null;},speak(u){active=u;window.__spoken.push(u.text);if(!window.__hold)timer=setTimeout(window.__finish,30);}}});
   Object.defineProperty(window,'SpeechSynthesisUtterance',{configurable:true,value:class{constructor(text){this.text=text;}}});
  },seed);
  await repair.goto('http://127.0.0.1:8898/tests/french-browser-harness.html');
  await repair.locator('.ft-unified-path').waitFor();
  await repair.locator('[data-learning-path] [data-eact="daily"]').click();
  assert.match(await repair.locator('.ft-e-question').innerText(),/TARGETED REPAIR/);
  assert.equal(await repair.evaluate(()=>document.activeElement?.dataset.eact),'cover');
  assert.equal(await repair.evaluate(()=>window.__spoken.at(-1)),checks[0].fr);
  assert.equal(await repair.locator('.ft-pause-row [data-eact="leave"]').count(),1);
  await repair.keyboard.press('Enter');
  await repair.locator('#ft-e-answer').waitFor();
  await repair.locator('#ft-e-answer').fill(checks[0].fr);
  await repair.evaluate(()=>window.__hold=true);
  await repair.keyboard.press('Enter');
  await repair.locator('.ft-answer-comparison.correct').waitFor();
  assert.equal(await repair.evaluate(()=>document.activeElement?.dataset.eact),'daily');
  // Native Enter when the primary action has lost focus to the document.
  await repair.evaluate(()=>document.activeElement.blur());
  await repair.keyboard.press('Enter');
  assert.equal(await repair.locator('[data-eact="daily"]').isDisabled(),true);
  assert.equal(await repair.locator('.ft-answer-comparison.correct').count(),1);
  await repair.evaluate(()=>{window.__hold=false;window.__finish();});
  await repair.locator('.ft-answer-comparison.correct').waitFor({state:'detached'});
  assert.deepEqual(repairErrors,[]);await repair.close();
  console.log('French assessment browser: baseline, targeted repair focus, body Enter fallback, speech wait, dashboard and learner isolation');
}finally{await browser.close();}
