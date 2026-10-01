#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import {spawn} from 'node:child_process';
import {chromium} from 'playwright';

const root=path.resolve(process.argv[2]||'.');
const configPath=path.resolve(root,process.argv[3]||'validation.config.json');
const config=fs.existsSync(configPath)?JSON.parse(fs.readFileSync(configPath,'utf8')):{};
const pages=config.pages||[{path:'/',readySelector:'body',minCount:1}];
const port=Number(process.env.VALIDATION_PORT||4173);
const host='127.0.0.1';
const server=spawn('python3',['-m','http.server',String(port),'--bind',host,'--directory',root],{stdio:'ignore'});

const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function waitServer(){
  for(let i=0;i<40;i++){
    try{await new Promise((resolve,reject)=>{const req=http.get(`http://${host}:${port}/`,r=>{r.resume();resolve()});req.on('error',reject)});return}catch{}
    await sleep(250);
  } throw Error('Local validation server did not start');
}
const errors=[];
try{
  await waitServer();
  const browser=await chromium.launch({headless:true});
  const context=await browser.newContext({serviceWorkers:'block'});
  for(const spec of pages){
    const page=await context.newPage();
    const pageErrors=[],failed=[];
    page.on('pageerror',e=>pageErrors.push(e.message));
    page.on('response',r=>{const u=new URL(r.url());if(u.hostname===host&&r.status()>=400)failed.push(`${r.status()} ${u.pathname}`)});
    const url=`http://${host}:${port}${spec.path||'/'}`;
    const response=await page.goto(url,{waitUntil:'networkidle',timeout:30000});
    if(!response||response.status()>=400) errors.push(`${spec.path}: navigation failed (${response?.status()||'no response'})`);
    if(spec.readySelector){
      try{await page.waitForSelector(spec.readySelector,{timeout:10000});const count=await page.locator(spec.readySelector).count();if(count<(spec.minCount||1))errors.push(`${spec.path}: ${spec.readySelector} count ${count} < ${spec.minCount||1}`)}
      catch(e){errors.push(`${spec.path}: missing ready selector ${spec.readySelector}`)}
    }
    for(const assertion of spec.assertions||[]){
      if(assertion.type==='text'){const text=await page.locator(assertion.selector).first().textContent().catch(()=>null);if(text===null||!(new RegExp(assertion.pattern)).test(text))errors.push(`${spec.path}: text assertion failed for ${assertion.selector}`)}
      if(assertion.type==='count'){const count=await page.locator(assertion.selector).count();if(count<(assertion.min||1))errors.push(`${spec.path}: ${assertion.selector} count ${count} < ${assertion.min||1}`)}
    }
    for(const action of spec.actions||[]){
      if(action.click){await page.locator(action.click).click();if(action.waitFor)await page.waitForSelector(action.waitFor,{timeout:10000});}
    }
    pageErrors.forEach(e=>errors.push(`${spec.path}: pageerror: ${e}`));
    failed.forEach(e=>errors.push(`${spec.path}: failed local request: ${e}`));
    await page.close();
  }
  await browser.close();
} finally {server.kill('SIGTERM')}
if(errors.length){console.error('\nSMOKE TEST FAILED\n'+errors.map(x=>' - '+x).join('\n'));process.exit(1)}
console.log(`Smoke test passed: ${pages.length} page(s).`);
