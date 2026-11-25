import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {GUIDED_UNITS,guidedLesson,guidedCompletionRefs,guidedTeachingRef} from '../french-teaching/v1/guided-lessons.js';
import {normalizeEvidence} from '../learning-evidence/v1/index.js';
const b=await chromium.launch({headless:true}),page=await b.newPage({viewport:{width:390,height:844}});
const errors=[];page.on('pageerror',e=>errors.push(String(e)));
const unit=GUIDED_UNITS[0],scope={appId:'next-french',accountId:'test-owner',learnerId:'adult'};
const now=Date.now(),finish=now-60000,steps=guidedLesson(unit.id).steps;
const event=(ref,at,i)=>normalizeEvidence({id:'rest-'+i,concept:'french:test',at,phase:'practice',support:'worked-example',source:{kind:'french-course',ref}},scope);
const entries=[event(guidedTeachingRef(unit.id),finish-360000,0),...steps.map((s,i)=>event(guidedCompletionRefs(s.id).complete,finish-steps.length+i+1,i+1))];
try{
 await page.clock.install({time:new Date(now)});
 await page.addInitScript(data=>{
  if(!localStorage.getItem('rest-seed-done')){
   localStorage.setItem('apps-learning-evidence-v1:next-french:test-owner:adult',JSON.stringify({schema:1,entries:data}));
   localStorage.setItem('rest-seed-done','yes');
  }
  window.__alerts=[];
  Object.defineProperty(window,'Notification',{configurable:true,value:{permission:'granted',requestPermission:async()=> 'granted'}});
  Object.defineProperty(navigator,'serviceWorker',{configurable:true,value:{getRegistration:async()=>({active:true,showNotification:async(title,options)=>window.__alerts.push({title,options})})}});
 },entries);
 await page.goto('http://127.0.0.1:8898/tests/french-browser-harness.html');
 await page.locator('.ft-tabs').waitFor();
 await page.getByRole('button',{name:'Enable device alerts',exact:true}).click();
 await page.getByRole('button',{name:"Today's lesson",exact:true}).click();
 await page.locator('.ft-rest-clock').waitFor();
 assert.match(await page.locator('.ft-guided-congrats').innerText(),/Excellent. Now leave it for a while/);
 assert.equal(await page.locator('[data-rest-continue]').isDisabled(),true);
 assert.ok(await page.locator('[data-rest-hand]').getAttribute('transform'));
 const deadline=await page.locator('[data-rest-until]').getAttribute('data-rest-until');
 assert.equal(Number(deadline),finish+300000);
 // Attempt to move ahead via another chapter and manual practice.
 await page.locator('[data-gunit]').selectOption(GUIDED_UNITS[1].id);
 assert.equal(await page.locator('[data-rest-until]').getAttribute('data-rest-until'),deadline);
 await page.getByRole('button',{name:'Sentence practice',exact:true}).click();
 assert.equal(await page.locator('[data-rest-continue]').isDisabled(),true);
 await page.reload();await page.locator('.ft-tabs').waitFor();
 await page.getByRole('button',{name:"Today's lesson",exact:true}).click();
 assert.equal(await page.locator('[data-rest-until]').getAttribute('data-rest-until'),deadline);
 await page.clock.setSystemTime(Number(deadline)-2000);
 await page.clock.runFor(1000);
 assert.equal(await page.locator('[data-rest-continue]').isDisabled(),true);
 await page.clock.runFor(2000);
 assert.equal(await page.locator('[data-rest-continue]').isDisabled(),false);
 await page.locator('[data-rest-continue]').click();
 await page.locator('#ft-e-answer').waitFor();
 assert.match(await page.locator('.ft-e-question').innerText(),/After teaching/);
 assert.equal(await page.locator('.ft-rest-clock').count(),0);
 await page.getByRole('button',{name:'Overview',exact:true}).click();
 await page.clock.setSystemTime(Number(deadline)+31*60000);
 await page.clock.runFor(20000);
 await page.locator('.ft-timing-notice.overdue').waitFor();
 await page.waitForFunction(()=>window.__alerts.length===1);
 assert.equal(await page.evaluate(()=>window.__alerts[0].options.data.nextFrench),true);
 await page.clock.runFor(20000);
 assert.equal(await page.evaluate(()=>window.__alerts.length),1);
 await page.locator('[data-profile]').selectOption('sai');
 await page.locator('.ft-track-grid').waitFor();
 assert.equal(await page.locator('.ft-timing-notice.overdue').count(),0);
 const dims=await page.evaluate(()=>({w:document.documentElement.scrollWidth,v:document.documentElement.clientWidth}));
 assert.ok(dims.w<=dims.v+2);assert.deepEqual(errors,[]);
 console.log('French timed rest browser: countdown, locked alternate routes, reload, exact unlock, overdue notification, deduplication and learner scope');
}finally{await b.close();}
