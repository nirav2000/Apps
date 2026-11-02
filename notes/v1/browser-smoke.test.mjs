import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {spawn,execFileSync} from 'node:child_process';
import {mkdtempSync,rmSync,readFileSync,existsSync} from 'node:fs';
import {join,resolve} from 'node:path';
import {tmpdir} from 'node:os';
import {fileURLToPath} from 'node:url';

const ROOT=fileURLToPath(new URL('../../',import.meta.url));
const fixture=`<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body>
<section data-note-anchor="lesson:question" data-note-label="French question"><h2>French homework</h2><p id="test-question">What does the present tense mean?</p></section>
<script type="module">
import Notes from '/notes/v1/index.js';
const saved=[], drafts={value:null};
const transport={
  list:async()=>saved.map(n=>({...n})),
  save:async note=>{const i=saved.findIndex(n=>n.id===note.id);i<0?saved.push(note):saved[i]=note;return note},
  remove:async id=>{const i=saved.findIndex(n=>n.id===id);if(i>=0)saved.splice(i,1)},
  getDraft:async()=>drafts.value,saveDraft:async draft=>{drafts.value=draft},
  clearDraft:async()=>{drafts.value=null}
};
window.__notes=await Notes.init({
  appId:'inclass',appVersion:'test',page:()=> 'inclass:lesson:test:Sai',
  transport,reviewFeed:false,defaultType:'feedback',
  ui:{launcherLabel:'Lesson notes',defaultReviewRequired:false,pageScope:true,chatGPTHandoff:true}
});
window.__ready=true;
</script></body></html>`;
function chooseChrome(){
 if(process.env.CHROME_BIN&&existsSync(process.env.CHROME_BIN))return process.env.CHROME_BIN;
 for(const bin of ['google-chrome','chromium','chromium-browser']){
  try{return execFileSync('which',[bin],{encoding:'utf8'}).trim()}catch{}
 }
 throw Error('Chromium/Chrome browser is required for real click and touch tests');
}
function server(){
 return createServer((req,res)=>{
  const pathname=new URL(req.url,'http://127.0.0.1').pathname;
  if(pathname==='/__fixture'){
   res.setHeader('Content-Type','text/html; charset=utf-8');res.end(fixture);return;
  }
  const file=resolve(ROOT,'.'+pathname);
  if(!file.startsWith(ROOT)||!pathname.startsWith('/notes/v1/')){res.writeHead(404);res.end();return;}
  try{
   const body=readFileSync(file);
   res.setHeader('Content-Type',file.endsWith('.css')?'text/css':file.endsWith('.js')?'text/javascript':'application/octet-stream');
   res.end(body);
  }catch{res.writeHead(404);res.end();}
 });
}
async function launchChrome(){
 const dir=mkdtempSync(join(tmpdir(),'apps-notes-browser-'));
 const chrome=spawn(chooseChrome(),['--headless=new','--no-sandbox','--disable-dev-shm-usage','--disable-gpu','--no-first-run','--no-default-browser-check','--remote-allow-origins=*','--remote-debugging-port=0','--user-data-dir='+dir,'about:blank'],{stdio:['ignore','ignore','pipe']});
 let wsUrl;
 try{
  wsUrl=await new Promise((resolve,reject)=>{
   const timeout=setTimeout(()=>reject(Error('Chrome DevTools did not start')),18000);
   chrome.stderr.on('data',chunk=>{
    const line=String(chunk),match=line.match(/DevTools listening on (ws:\/\/[^\s]+)/);
    if(match){clearTimeout(timeout);resolve(match[1]);}
   });
   chrome.on('error',e=>{clearTimeout(timeout);reject(e)});
   chrome.on('exit',code=>{clearTimeout(timeout);reject(Error('Chrome closed with '+code))});
  });
 }catch(e){chrome.kill();rmSync(dir,{recursive:true,force:true});throw e}
 const origin=new URL(wsUrl).origin.replace('ws:','http:');
 async function openTab(){
  const response=await fetch(origin+'/json/new?about:blank',{method:'PUT'});
  if(!response.ok)throw Error('Could not create Chrome tab');
  return response.json();
 }
 const tab=await openTab(),ws=new WebSocket(tab.webSocketDebuggerUrl);
 await new Promise((resolve,reject)=>{ws.onopen=resolve;ws.onerror=reject});
 let seq=0;const pending=new Map();
 ws.onmessage=e=>{
  const msg=JSON.parse(String(e.data));if(!msg.id)return;
  const done=pending.get(msg.id);if(!done)return;
  pending.delete(msg.id);
  if(msg.error)done.reject(Error(msg.error.message));else done.resolve(msg.result||{});
 };
 function command(method,params={}){
  return new Promise((resolve,reject)=>{
   const id=++seq;pending.set(id,{resolve,reject});
   ws.send(JSON.stringify({id,method,params}));
   setTimeout(()=>{if(pending.delete(id))reject(Error('CDP timeout: '+method))},18000).unref?.();
  });
 }
 async function evaluate(source){
  const output=await command('Runtime.evaluate',{expression:'(async()=>{'+source+'})()',awaitPromise:true,returnByValue:true});
  if(output.exceptionDetails)throw Error('Browser JS exception: '+output.exceptionDetails.text+' '+(output.exceptionDetails.exception?.description||''));
  return output.result?.value;
 }
 const close=async()=>{ws.close();chrome.kill('SIGKILL');rmSync(dir,{recursive:true,force:true})};
 return {command,evaluate,close};
}
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function until(fn,description='browser condition'){
 for(let i=0;i<100;i++){if(await fn())return;await sleep(70)}
 throw Error('Timed out waiting for '+description);
}
test('real Chromium: note create, save, edit, archive, restore, import and touch selection', {timeout:100000},async t=>{
 const http=server();await new Promise(r=>http.listen(0,'127.0.0.1',r));
 let browser=null;
 t.after(async()=>{
  await browser?.close();
  http.closeAllConnections();
  await new Promise(r=>http.close(r));
 });
 browser=await launchChrome();
 const {command,evaluate}=browser;
 await command('Page.enable');
 await command('Runtime.enable');
 await command('Emulation.setDeviceMetricsOverride',{width:790,height:1024,deviceScaleFactor:1,mobile:true});
 await command('Emulation.setTouchEmulationEnabled',{enabled:true,maxTouchPoints:1});
 await command('Page.navigate',{url:'http://127.0.0.1:'+http.address().port+'/__fixture'});
 await until(()=>evaluate('return window.__ready===true'),'Notes UI initialization');
 await evaluate('document.querySelector(".apps-notes-launcher").click();document.querySelector("[data-new]").click();return true');
 assert.equal(await evaluate('return !document.querySelector(".note-composer").hidden'),true);
 // ChatGPT import textarea exists first; the save handler must read the visible note field.
 await evaluate('document.querySelector(".note-composer textarea").value="First genuine note";document.querySelector(".note-composer textarea").dispatchEvent(new Event("input",{bubbles:true}));document.querySelector("[data-save]").click();return true');
 await until(()=>evaluate('return window.__notes.list().length===1'),'note save');
 assert.equal(await evaluate('return window.__notes.list()[0].text'),'First genuine note');
 await evaluate('document.querySelector("[data-action=edit]").click();document.querySelector(".note-composer textarea").value="Edited question explanation";document.querySelector("[data-save]").click();return true');
 await until(()=>evaluate('return window.__notes.list()[0].text==="Edited question explanation"'),'edit save');
 await evaluate('document.querySelector("[data-action=archive]").click();return true');
 await until(()=>evaluate('return window.__notes.list()[0].status==="archived"'),'archive note');
 await evaluate('document.querySelector("[data-filter=all]").click();document.querySelector("[data-action=restore]").click();return true');
 await until(()=>evaluate('return window.__notes.list()[0].status==="open"'),'restore note');
 await evaluate(`document.querySelector("[data-import]").click();
  document.querySelector("[data-import-json]").value=JSON.stringify({schema:"apps-shared-notes-edits-v1",appId:"inclass",page:"inclass:lesson:test:Sai",updates:[{id:window.__notes.list()[0].id,text:"Imported new text"}]});
  document.querySelector("[data-import-apply]").click();return true`);
 assert.equal(await evaluate('return !document.querySelector("[data-import-preview]").hidden'),true);
 await evaluate('document.querySelector("[data-import-confirm]").click();return true');
 await until(()=>evaluate('return window.__notes.list()[0].text==="Imported new text"'),'import reviewed changes');
 // Simulate a genuine touchscreen tap on a paragraph, not a synthetic click.
 await evaluate('document.querySelector("[data-select]").click();return true');
 const p=await evaluate('const r=document.querySelector("#test-question").getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2}');
 await command('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{id:0,x:p.x,y:p.y}]});
 await command('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
 await until(()=>evaluate('return !document.querySelector(".note-composer").hidden'),'touch-created annotation composer');
 assert.equal(await evaluate('return document.querySelector("[data-context-id]").textContent.includes("test-question")'),true);
});
