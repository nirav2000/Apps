import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {guidedLesson} from '../french-teaching/v1/guided-lessons.js';
const browser=await chromium.launch({headless:true}),page=await browser.newPage({viewport:{width:390,height:844}});
const errors=[];page.on('pageerror',e=>errors.push(e.message));
const local=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('next-french-answers-v1:test-owner:adult')||'[]'));
const stepId=()=>page.locator('[data-guided-step]').getAttribute('data-guided-step');
try{
 await page.addInitScript(()=>{
   window.__spoken=[];
   let timer,active;
   Object.defineProperty(window,'speechSynthesis',{configurable:true,value:{
    getVoices:()=>[{lang:'fr-FR',name:'Test voice',voiceURI:'test'}],
    cancel(){clearTimeout(timer);const u=active;active=null;u?.onerror?.();},
    speak(u){active=u;window.__spoken.push(u.text);timer=setTimeout(()=>{active=null;u.onend?.();},25);}
   }});
   Object.defineProperty(window,'SpeechSynthesisUtterance',{configurable:true,value:class{constructor(text){this.text=text;}}});
 });
 await page.goto('http://127.0.0.1:8898/tests/french-browser-harness.html');
 await page.locator('.ft-tabs').waitFor();
 await page.getByRole('button',{name:'Revision signals',exact:true}).click();
 await page.locator('#ft-revision-add-word').fill('école');
 await page.locator('#ft-revision-add button').click();
 await page.getByRole('button',{name:'Overview',exact:true}).click();
 await page.getByRole('button',{name:'Start guided lesson',exact:true}).click();
 const deck=guidedLesson('speak-and-listen').steps;
 for(let i=0;i<3;i++){
  await page.locator('[data-guided-step="'+deck[i].id+'"]').waitFor();
  await page.locator('[data-gact="finish-model"]').click();
 }
 await page.locator('[data-guided-step^="adaptive-v1:"]').waitFor();
 const inserted=await stepId(),plan=(await local()).find(x=>x.answerAudit?.signal?.plan?.id===inserted).answerAudit.signal.plan;
 assert.equal(plan.target,'école');assert.equal(plan.mode,'dictation');assert.equal(plan.position,3);
 assert.match(await page.locator('.ft-progress-count').innerText(),/3\/64/);
 assert.equal(await page.locator('[data-cloud-status]').isVisible(),false);
 assert.doesNotMatch(await page.locator('.ft-guided-shell').innerText(),/saved to Firebase|first attempt is saved/i);
 await page.waitForFunction(id=>[...window.__testEvidence.values()].some(x=>x.event?.answerAudit?.signal?.plan?.id===id),inserted,{timeout:12000});
 await page.reload();await page.locator('.ft-tabs').waitFor();
 await page.getByRole('button',{name:"Today's lesson",exact:true}).click();
 await page.locator('[data-guided-step="'+inserted+'"]').waitFor();
 assert.equal(await stepId(),inserted);
 await page.locator('#ft-guided-input').fill('école');
 await page.locator('#ft-guided-form button[type=submit]').click();
 await page.locator('.ft-answer-comparison.correct').waitFor();
 await page.locator('[data-gact="next"]').click();
 await page.locator('[data-guided-step="'+deck[3].id+'"]').waitFor();
 assert.match(await page.locator('.ft-progress-count').innerText(),/4\/64/);
 const rows=await local();
 const answer=rows.find(x=>x.answerAudit?.ref===inserted+':first').answerAudit;
 assert.equal(answer.signal.kind,'review');assert.equal(answer.signal.correct,true);
 assert.equal(answer.signal.mode,'dictation');assert.ok(answer.context.sessionId);assert.equal(answer.context.unitId,'speak-and-listen');
 await page.getByRole('button',{name:'Revision signals',exact:true}).click();
 assert.match(await page.locator('.ft-adaptive-log').innerText(),/Teaching adaptations/);
 assert.equal((await local()).filter(x=>x.answerAudit?.signal?.kind==='adaptive-plan').length,1);
 await page.waitForFunction(id=>[...window.__testEvidence.values()].some(x=>x.event?.answerAudit?.signal?.planId===id),inserted,{timeout:12000});
 assert.equal(await page.evaluate(id=>[...window.__testEvidence.values()].filter(x=>x.event?.source?.ref===id+':first'&&x.event?.score?.total>0).length,inserted),0);
 await page.locator('[data-profile]').selectOption('sai');
 await page.getByRole('button',{name:'Revision signals',exact:true}).click();
 assert.equal(await page.locator('.ft-revision-row').count(),0);
 assert.deepEqual(errors,[]);
 console.log('Adaptive browser: inserted dictation, durable plan, reload, core resume, private outcome, clean screen and learner isolation');
}finally{await browser.close();}
