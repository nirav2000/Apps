import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import {fileURLToPath} from 'node:url';
import {chromium} from 'playwright';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const port=8741;
const types={'.html':'text/html;charset=utf-8','.js':'text/javascript;charset=utf-8','.css':'text/css;charset=utf-8','.json':'application/json;charset=utf-8','.mjs':'text/javascript;charset=utf-8'};
const server=http.createServer((req,res)=>{
  const url=new URL(req.url,'http://localhost');
  const pathname=url.pathname.endsWith('/')?url.pathname+'index.html':url.pathname;
  const filename=path.resolve(root,'.'+decodeURIComponent(pathname));
  if(!filename.startsWith(root+path.sep)){res.writeHead(403);res.end();return}
  try{
    const data=fs.readFileSync(filename);
    res.writeHead(200,{'Content-Type':types[path.extname(filename)]||'application/octet-stream'});
    res.end(data);
  }catch{res.writeHead(404);res.end('Not found: '+pathname)}
});
await new Promise(resolve=>server.listen(port,'127.0.0.1',resolve));
let browser;
try{
  browser=await chromium.launch({headless:true});
  const page=await browser.newPage({viewport:{width:1440,height:900}});
  await page.addInitScript(()=>{
    try{if(location.hostname==='127.0.0.1')localStorage.setItem('app-monitor.admin-session.v2',JSON.stringify({token:'VersionLabBrowserTest'}))}catch{}
  });
  await page.route('https://apps-monitor-api.nirav2000-github.workers.dev/app-monitor/**',route=>{
    if(route.request().url().includes('/auth/session'))
      return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({method:'test passkey'})});
    return route.fulfill({status:200,contentType:'application/json',body:'{"comparisonNotes":[],"decisions":{}}'});
  });
  const dolVersions=[
    {checkpointId:'vl-a',productVersion:'2.6.4',commit:'e1e8f489fdecef85d160b28adf90646b0c64d1a2',title:'Dol 2.6.4'},
    {checkpointId:'vl-b',productVersion:'2.5.0',commit:'4d97eb52dad186f63eaead9f7024586b1e0a9fa8',title:'Dol 2.5.0'},
    {checkpointId:'vl-c',productVersion:'2.5.0',commit:'01ecc6f4b9bbf1e3d2342cb9069cc15500d4119b',title:'Dol 2.5.0 checkpoint'}
  ];
  await page.route('https://nirav2000.github.io/Dol/version-lab-data/releases.json',route=>
    route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({releases:dolVersions})}));
  const expectedHtml='<!doctype html><html><head><meta http-equiv="Content-Security-Policy" content="script-src \'none\'"><title>Historical app</title></head><body><button id="archivedAction">Interact</button><span id="actionCount">0</span><span id="writeGuard">not started</span><script type="module" src="./demo.mjs"></script></body></html>';
  const moduleJs=String.raw`const el=document.getElementById('archivedAction');
el.addEventListener('click',async()=>{
  const next=Number(localStorage.getItem('count')||0)+1;
  localStorage.setItem('count',String(next));
  document.getElementById('actionCount').textContent=String(next);
  try{await fetch('https://firestore.googleapis.com/v1/projects/live/databases/(default)/documents',{method:'POST',body:'x'})}
  catch{document.getElementById('writeGuard').textContent='blocked'}
});`;
  await page.route('https://cdn.jsdelivr.net/gh/**',route=>{
    const url=route.request().url;
    if(url.endsWith('/index.html'))return route.fulfill({status:200,contentType:'text/html',headers:{'Access-Control-Allow-Origin':'*'},body:expectedHtml});
    if(url.endsWith('/demo.mjs'))return route.fulfill({status:200,contentType:'text/javascript',headers:{'Access-Control-Allow-Origin':'*'},body:moduleJs});
    return route.fulfill({status:404,contentType:'text/plain',headers:{'Access-Control-Allow-Origin':'*'},body:'not found'});
  });
  const blockedRequests=[];
  page.on('request',r=>{if(r.url().includes('firestore.googleapis.com'))blockedRequests.push(r.url())});
  page.on('pageerror',e=>console.error('PAGE ERROR',e.message));
  async function runApp(appId,expectedVersions){
    await page.goto('http://127.0.0.1:'+port+'/version-lab/?app='+appId);
    await page.locator('#releasePanel:not(.hidden)').waitFor({timeout:15000});
    const cards=page.locator('#releaseGrid>.release-card');
    assert.equal(await cards.count(),expectedVersions,appId+' distinct version cards');
    const options=await page.locator('#leftVersion option').allTextContents();
    assert.equal(options.length,expectedVersions,appId+' options equal versions');
    assert.equal(new Set(options).size,options.length,appId+' no duplicate options');
    if(expectedVersions>1){
      await page.locator('#compare').click();
      await page.frameLocator('#leftFrame').locator('#archivedAction').waitFor({timeout:15000});
      await page.frameLocator('#rightFrame').locator('#archivedAction').waitFor({timeout:15000});
      await page.frameLocator('#leftFrame').locator('#archivedAction').click();
      assert.equal(await page.frameLocator('#leftFrame').locator('#actionCount').innerText(),'1');
      assert.equal(await page.frameLocator('#rightFrame').locator('#actionCount').innerText(),'0','preview storage is independent');
      assert.equal(await page.frameLocator('#leftFrame').locator('#writeGuard').innerText(),'blocked','production write was blocked');
    }
    console.log(appId+': '+expectedVersions+' distinct versions, interactive isolation verified');
  }
  await runApp('dol',2);
  const checkpoints=page.locator('.checkpoint-history');
  assert.equal(await checkpoints.count(),1,'repeated v2.5.0 grouped under one card');
  await checkpoints.first().locator('summary').click();
  assert.equal(await checkpoints.locator('.checkpoint-entry').count(),2,'both checkpoints preserved');
  const openday=JSON.parse(fs.readFileSync(path.join(root,'version-lab/legacy-data/openday-releases.json'),'utf8'));
  const snag=JSON.parse(fs.readFileSync(path.join(root,'version-lab/legacy-data/snag-releases.json'),'utf8'));
  assert(openday.releases.every(r=>/^[a-f0-9]{40}$/.test(r.commit)),'Openday immutable SHAs');
  assert(snag.releases.every(r=>/^[a-f0-9]{40}$/.test(r.commit)),'Snag immutable SHAs');
  await runApp('openday',40);
  await runApp('snag',32);
  assert.equal(blockedRequests.length,0,'Browser must not contact Firestore from historical preview');
  await page.screenshot({path:path.join(root,'version-lab-browser-verification.png'),fullPage:false});
  assert(fs.readFileSync(path.join(root,'app-monitor.html'),'utf8').includes('href="./version-lab/"'),'App Monitor has Version Labs link');
  assert(fs.readFileSync(path.join(root,'index.html'),'utf8').includes('href="version-lab/"'),'Apps dashboard has Version Labs link');
  console.log('PASS: grouped versions, checkpoint drill-down, navigation and isolated interactive archived UI');
}finally{
  if(browser)await browser.close();
  await new Promise(resolve=>server.close(resolve));
}
