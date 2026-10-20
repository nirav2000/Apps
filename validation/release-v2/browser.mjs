#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import {spawn} from 'node:child_process';
import {chromium} from 'playwright';

const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function waitServer(url){for(let i=0;i<40;i++){try{await new Promise((resolve,reject)=>{const q=http.get(url,r=>{r.resume();resolve()});q.on('error',reject)});return}catch{}await sleep(250)}throw Error('Local app server unavailable')}
export async function runJourneys(root,config,options={}){
 const scenarios=config.interactionTests?.scenarios||[];
 if(!scenarios.length)throw Error('interactionTests.scenarios must contain at least one journey');
 const baseURL=options.baseURL||'http://127.0.0.1:4199';
 const profiles=config.interactionTests?.profiles||[{name:'desktop',width:1365,height:900},{name:'mobile',width:390,height:844}];
 const results=[];const browser=await chromium.launch({headless:true});
 try{
  for(const profile of profiles)for(const spec of scenarios){
   if(!spec.name||!spec.steps?.length)throw Error('Every browser journey needs a name and steps');
   const context=await browser.newContext({viewport:{width:profile.width,height:profile.height},hasTouch:!!profile.touch,serviceWorkers:'block'});
   const page=await context.newPage();page.setDefaultTimeout(10000);
   const errors=[],requests=[],steps=[];
   page.on('pageerror',e=>errors.push(e.message));
   page.on('response',r=>{if(r.url().startsWith(baseURL)&&r.status()>=400)requests.push(r.status()+' '+r.url())});
   await context.route('**/*',route=>{
    const request=route.request(),u=new URL(request.url());
    if(u.origin!==new URL(baseURL).origin||!['GET','HEAD'].includes(request.method()))return route.abort('blockedbyclient');
    return route.continue();
   });
   let status='passed',failure=null;
   try{
    const response=await page.goto(baseURL+(spec.path||'/'),{waitUntil:'domcontentloaded'});
    if(!response?.ok())throw Error('Page did not load');
    for(const step of spec.steps){
     const l=step.selector?page.locator(step.selector):null;
     switch(step.action){
      case 'visible':await l.waitFor({state:'visible'});break;
      case 'click':await l.click();break;
      case 'focus':await l.focus();break;
      case 'fill':await l.fill(step.value);break;
      case 'type':await l.pressSequentially(step.value,{delay:25});break;
      case 'select':await l.selectOption(step.value);break;
      case 'value':if(await l.inputValue()!==step.value)throw Error('Value mismatch for '+step.selector);break;
      case 'text':await l.waitFor({state:'visible'});if(!(await l.textContent()).includes(step.contains))throw Error('Missing text '+step.contains);break;
      case 'count':{const n=await l.count();if(step.min!==undefined&&n<step.min)throw Error('Too few elements '+step.selector);if(step.max!==undefined&&n>step.max)throw Error('Too many elements '+step.selector);break;}
      case 'url':if(new URL(page.url()).searchParams.get(step.param)!==step.value)throw Error('URL parameter mismatch '+step.param);break;
      case 'noOverflow':if(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+2))throw Error('Horizontal overflow');break;
      default:throw Error('Unknown action '+step.action);
     }
     steps.push(step.action);
    }
    if(errors.length)throw Error('Uncaught JavaScript errors: '+errors.join('; '));
    if(requests.length)throw Error('Failed local resources: '+requests.join('; '));
   }catch(e){status='failed';failure=e.message;}
   const reportDir=path.join(root,'artifacts','browser-journeys');fs.mkdirSync(reportDir,{recursive:true});
   if(status==='failed')await page.screenshot({path:path.join(reportDir,(profile.name+'-'+spec.name).replace(/[^a-z0-9-]/gi,'-')+'.png'),fullPage:true}).catch(()=>{});
   results.push({profile:profile.name,journey:spec.name,status,failure,steps,errors,requests});
   await context.close();
  }
 }finally{await browser.close()}
 return results;
}
if(process.argv[1]&&path.resolve(process.argv[1])===path.resolve(new URL(import.meta.url).pathname)){
 const root=path.resolve(process.argv[2]||'.'),cfg=JSON.parse(fs.readFileSync(path.join(root,process.argv[3]||'validation.config.json'),'utf8'));
 const port=4199,server=spawn('python3',['-m','http.server',String(port),'--bind','127.0.0.1','--directory',root],{stdio:'ignore'});
 try{
  await waitServer('http://127.0.0.1:'+port+'/');
  const results=await runJourneys(root,cfg);
  fs.mkdirSync(path.join(root,'artifacts'),{recursive:true});
  fs.writeFileSync(path.join(root,'artifacts','interaction-report.json'),JSON.stringify({status:results.every(x=>x.status==='passed')?'passed':'failed',results},null,2)+'\n');
  console.log(JSON.stringify(results,null,2));if(results.some(x=>x.status==='failed'))process.exitCode=1;
 }finally{server.kill('SIGTERM')}
}
