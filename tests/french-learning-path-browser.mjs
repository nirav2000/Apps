import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {GUIDED_UNITS,guidedLesson,guidedTeachingRef,guidedCompletionRefs} from '../french-teaching/v1/guided-lessons.js';
import {assessmentDeck} from '../french-teaching/v1/assessment.js';
import {normalizeEvidence} from '../learning-evidence/v1/index.js';
import {createAnswerHistory} from '../french-teaching/v1/answer-history.js';
const browser=await chromium.launch({headless:true});
const now=Date.now(),unit=GUIDED_UNITS[0],steps=guidedLesson(unit.id).steps;
const scope={appId:'next-french',accountId:'test-owner',learnerId:'adult'};
const seed=(finish)=>[
 normalizeEvidence({id:'teach',concept:'french:test',at:finish-360000,source:{kind:'french-course',ref:guidedTeachingRef(unit.id)},phase:'practice',support:'worked-example'},scope),
 ...steps.map((s,i)=>normalizeEvidence({id:'step-'+i,concept:s.concept,at:finish-steps.length+i+1,source:{kind:'french-course',ref:guidedCompletionRefs(s.id).complete},phase:'practice',support:'worked-example'},scope))];
const makeAudit=()=>{
 const store=new Map(),storage={getItem:k=>store.get(k)||null,setItem:(k,v)=>store.set(k,v)};
 const a=createAnswerHistory({accountId:'test-owner',learnerId:'adult',storage});
 a.record({ref:'revision:manual',activity:'Personal revision',question:'Word revision signal',expected:'école',result:'signal',marker:'revision-signal-v1',signal:{kind:'manual',word:'école'},context:{track:'michaela'}});
 return a.getEntries();
};
async function open(finish,audits=[]){
 const page=await browser.newPage({viewport:{width:390,height:844}});
 const errors=[];page.on('pageerror',e=>errors.push(String(e)));
 await page.addInitScript(({entries,audits})=>{
  if(!localStorage.getItem('learning-path-seed')){
   localStorage.setItem('apps-learning-evidence-v1:next-french:test-owner:adult',JSON.stringify({schema:1,entries}));
   localStorage.setItem('next-french-answers-v1:test-owner:adult',JSON.stringify(audits));
   localStorage.setItem('learning-path-seed','yes');
  }
 },{entries:seed(finish),audits});
 await page.goto('http://127.0.0.1:8898/tests/french-browser-harness.html');
 await page.locator('.ft-unified-path').waitFor();
 return {page,errors};
}
const daily=page=>page.locator('[data-learning-path] [data-eact="daily"]').click();
const today=page=>page.locator('.ft-tabs [data-page="home"]').click();
async function answerCheck(page,stage){
 for(const item of assessmentDeck(unit.id,stage)){
  assert.equal(await page.locator('.ft-e-prompt').innerText(),item.en);
  await page.locator('#ft-e-answer').fill(item.fr);
  await page.locator('#ft-e-form button[type=submit]').click();
 }
 await page.locator('.ft-e-question').getByRole('heading',{name:'Check complete'}).waitFor();
}
try{
 // A delayed check takes priority over a real due manual revision.
 const delayed=await open(now-7*86400000-60000,makeAudit()),p=delayed.page;
 assert.equal(await p.locator('.ft-unified-path').getAttribute('data-learning-mode'),'check');
 assert.equal(await p.locator('[data-learning-path] button').count(),1);
 assert.equal(await p.locator('.ft-guided-unit-summary,.ft-e-dashboard,.ft-revision-summary,.ft-track-grid').count(),0);
 assert.equal(await p.locator('.ft-path-row[aria-current=step]').count(),1);
 await daily(p);assert.match(await p.locator('.ft-e-question').innerText(),/day 7/i);
 await answerCheck(p,'day7');
 await p.locator('[data-eact="daily"]').click();
 await p.locator('.ft-revision-task').waitFor();
 await p.locator('#ft-revision-answer').fill('école');
 await p.locator('#ft-revision-form button[type=submit]').click();
 await p.locator('[data-act="revision-next"]').click();
 await p.locator('#ft-e-answer').waitFor();
 assert.match(await p.locator('.ft-e-question').innerText(),/Before teaching/i);
 assert.deepEqual(delayed.errors,[]);await p.close();
 // A new lesson ends in optional oral practice, not endless new teaching.
 const recent=await open(now-6*60000),q=recent.page;
 await daily(q);assert.match(await q.locator('.ft-e-question').innerText(),/After teaching/i);
 await answerCheck(q,'immediate');
 await q.locator('[data-eact="daily"]').click();
 await q.locator('.ft-e-question').getByRole('heading',{name:'Say it in French'}).waitFor();
 assert.match(await q.locator('.ft-e-question').innerText(),/1\/3/);
 const taught=new Set(steps.map(s=>s.en));
 assert.ok(taught.has(await q.locator('.ft-e-prompt').innerText()));
 await q.locator('[data-eact="oral-reveal"]').click();
 await q.locator('[data-eact="oral-next"]').click();
 assert.match(await q.locator('.ft-e-question').innerText(),/2\/3/);
 await q.locator('[data-eact="oral-finish"]').click();
 await q.locator('.ft-unified-path').waitFor();
 assert.equal(await q.locator('.ft-unified-path').getAttribute('data-learning-mode'),'complete');
 await q.reload();await q.locator('.ft-unified-path').waitFor();
 assert.equal(await q.locator('.ft-unified-path').getAttribute('data-learning-mode'),'complete');
 await q.locator('.ft-tabs [data-page="explore"]').click();
 await q.locator('.ft-guided-unit-summary').waitFor();
 assert.equal(await q.locator('.ft-guided-unit-summary>div').count(),4);
 await q.locator('.ft-tabs [data-page="evidence"]').click();
 await q.locator('.ft-e-dashboard').first().waitFor();
 await q.locator('[data-profile]').selectOption('sai');
 await q.locator('.ft-unified-path').waitFor();
 assert.equal(await q.locator('.ft-unified-path').getAttribute('data-learning-mode'),'check');
 const dims=await q.evaluate(()=>({w:document.documentElement.scrollWidth,v:document.documentElement.clientWidth}));
 assert.ok(dims.w<=dims.v+2);assert.deepEqual(recent.errors,[]);
 console.log('Unified French path: due recall first, automatic personal revision, guided entry, bounded optional oral practice, durable completion, Explore, separate dashboard and learner isolation');
}finally{await browser.close();}
