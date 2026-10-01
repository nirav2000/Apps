#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import {spawn} from 'node:child_process';
import {pathToFileURL} from 'node:url';
import {chromium} from 'playwright';

const root=path.resolve(process.argv[2]||'.');
const configPath=path.resolve(root,process.argv[3]||'validation.config.json');
const config=fs.existsSync(configPath)?JSON.parse(fs.readFileSync(configPath,'utf8')):{};
const gate=config.releaseGate||{};
if(gate.enabled===false||!gate.scenarioModule){console.log('Release gate: no app-specific scenario module configured; skipped.');process.exit(0)}

const scenarioPath=path.resolve(root,gate.scenarioModule);
if(!scenarioPath.startsWith(root+path.sep)||!fs.existsSync(scenarioPath))throw Error('releaseGate.scenarioModule must be an existing file inside the consuming app');
const port=Number(process.env.RELEASE_GATE_PORT||4183),host='127.0.0.1',baseURL=`http://${host}:${port}`;
const server=spawn('python3',['-m','http.server',String(port),'--bind',host,'--directory',root],{stdio:'ignore'});
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function waitServer(){for(let i=0;i<50;i++){try{await new Promise((resolve,reject)=>{const req=http.get(baseURL+'/',r=>{r.resume();resolve()});req.on('error',reject)});return}catch{}await sleep(200)}throw Error('Release-gate local server did not start')}

const failures=[],metrics={externalRequests:0,localRequests:0,pageErrors:[],consoleErrors:[],checks:[],scenario:{}};
const reportPath=path.join(root,'artifacts','release-gate-report.json');
const writeReport=status=>{fs.mkdirSync(path.dirname(reportPath),{recursive:true});fs.writeFileSync(reportPath,JSON.stringify({status,generatedAt:new Date().toISOString(),scenarioModule:gate.scenarioModule,path:gate.path||'/',metrics,failures},null,2)+'\n')};
const assert=(condition,message)=>{const label=String(message||'Assertion');metrics.checks.push({label,passed:!!condition});if(!condition)failures.push(label)};
assert.equal=(a,b,message)=>assert(Object.is(a,b),message||`Expected ${JSON.stringify(a)} to equal ${JSON.stringify(b)}`);
assert.deepEqual=(a,b,message)=>assert(JSON.stringify(a)===JSON.stringify(b),message||`Expected deep equality\nA=${JSON.stringify(a)}\nB=${JSON.stringify(b)}`);
assert.includes=(container,value,message)=>assert(container?.includes?.(value),message||`Expected value to include ${JSON.stringify(value)}`);

async function waitForQuiescence(probe,{quietMs=Number(gate.quietMs||500),timeoutMs=Number(gate.timeoutMs||5000),intervalMs=50,maxChanges=Number(gate.maxStateTransitions||8)}={}){
  const started=Date.now();let last=JSON.stringify(await probe()),lastChange=Date.now(),changes=0;
  while(Date.now()-started<timeoutMs){
    await sleep(intervalMs);
    const next=JSON.stringify(await probe());
    if(next!==last){last=next;lastChange=Date.now();changes++;if(changes>maxChanges)throw Error(`Quiescence failed: more than ${maxChanges} state transitions`)}
    if(Date.now()-lastChange>=quietMs)return{state:JSON.parse(last),changes,elapsedMs:Date.now()-started};
  }
  throw Error(`Quiescence failed: state did not remain unchanged for ${quietMs} ms within ${timeoutMs} ms`);
}

try{
  await waitServer();
  const browser=await chromium.launch({headless:true});
  const context=await browser.newContext({serviceWorkers:'block'});
  await context.addInitScript(()=>{
    window.__RELEASE_GATE__={active:true,metrics:{reads:0,writes:0,deletes:0,listeners:0,ops:[]}};
    const rec=(type,n=1,label='test')=>{const m=window.__RELEASE_GATE__.metrics;m[type]=(m[type]||0)+(Number(n)||0);m.ops.push({type,count:Number(n)||0,label})};
    window.FirebaseUsageMonitor={read:(n,l)=>rec('reads',n,l),write:(n,l)=>rec('writes',n,l),del:(n,l)=>rec('deletes',n,l),listener:(n,l)=>rec('listeners',n,l),record:rec};
  });
  const page=await context.newPage();
  page.on('pageerror',e=>metrics.pageErrors.push(e.message));
  page.on('console',m=>{if(m.type()==='error')metrics.consoleErrors.push(m.text())});
  await page.route('**/*',route=>{
    const u=new URL(route.request().url());
    if(u.hostname===host){metrics.localRequests++;return route.continue()}
    metrics.externalRequests++;
    if(gate.allowExternalNetwork===true)return route.continue();
    return route.abort('blockedbyclient');
  });
  const response=await page.goto(baseURL+(gate.path||'/'),{waitUntil:'domcontentloaded',timeout:30000});
  assert(response&&response.status()<400,`Release gate page failed to load: ${response?.status()||'no response'}`);
  if(gate.readySelector)await page.waitForSelector(gate.readySelector,{timeout:10000});
  const mod=await import(pathToFileURL(scenarioPath).href+'?t='+Date.now());
  if(typeof mod.run!=='function')throw Error('Release gate scenario module must export async function run(ctx)');
  await mod.run({page,context,baseURL,root,config,gate,assert,sleep,waitForQuiescence,metrics});
  if(gate.failOnPageErrors!==false)for(const e of metrics.pageErrors)failures.push('pageerror: '+e);
  if(gate.maxExternalRequests!==undefined&&metrics.externalRequests>Number(gate.maxExternalRequests))failures.push(`External request budget exceeded: ${metrics.externalRequests} > ${gate.maxExternalRequests}`);
  await browser.close();
}finally{server.kill('SIGTERM')}

if(failures.length){writeReport('failed');console.error('\nRELEASE GATE FAILED\n'+failures.map(x=>' - '+x).join('\n'));console.error('Metrics:',JSON.stringify(metrics,null,2));process.exit(1)}
writeReport('passed');
console.log('Release gate passed.');
console.log('Metrics:',JSON.stringify(metrics,null,2));
