import fs from "node:fs";
import path from "node:path";
import http from "node:http";
import {spawn} from "node:child_process";
import assert from "node:assert/strict";
import {webkit} from "playwright";

const root=path.resolve(import.meta.dirname,"..");
const port=4197,host="127.0.0.1",base="http://"+host+":"+port;
const server=spawn("python3",["-m","http.server",String(port),"--bind",host,"--directory",root],{stdio:"ignore"});
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function waitServer(){
  for(let i=0;i<50;i++){
    try{await new Promise((resolve,reject)=>{const r=http.get(base+"/",res=>{res.resume();resolve();});r.on("error",reject)});return;}
    catch{await sleep(120);}
  }
  throw new Error("WebKit test server did not start");
}
const errors=[],external=[];
let browser=null;
try{
  await waitServer();
  browser=await webkit.launch({headless:true});
  const context=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:1,serviceWorkers:"block"});
  await context.route("**/*",route=>{
    const url=new URL(route.request().url());
    if(url.hostname===host)return route.continue();
    external.push(route.request().url());return route.abort("blockedbyclient");
  });
  const page=await context.newPage();
  page.on("pageerror",e=>errors.push(e.message));
  const response=await page.goto(base+"/",{waitUntil:"networkidle",timeout:30000});
  assert(response&&response.status()<400,"Home Studio should load on WebKit");
  await page.locator("#overviewStats .stat-card").first().waitFor();
  assert.equal(await page.locator("[data-control-card]").count(),8,"All controls render on WebKit");
  for(const size of [{width:390,height:844,name:"iphone"},{width:820,height:1180,name:"ipad"}]){
    await page.setViewportSize(size);
    const roomSelect=page.locator("#labRoomPicker");
    await roomSelect.selectOption("bedroom");
    await page.locator("#labHybridRange").evaluate(el=>{el.value="20";el.dispatchEvent(new Event("input",{bubbles:true}));});
    assert.equal(await page.locator("#labLiveTarget").innerText(),"20.0°","Shared controls react on "+size.name);
    for(const view of ["overview","rooms","energy","systems"]){
      await page.locator("#tab-"+view).click();
      assert(await page.locator("#panel-"+view).isVisible(),size.name+"/"+view+" view should be usable");
      const dimensions=await page.evaluate(()=>({scroll:document.documentElement.scrollWidth,viewport:innerWidth}));
      assert(dimensions.scroll<=dimensions.viewport+2,size.name+"/"+view+" horizontal overflow: "+JSON.stringify(dimensions));
    }
    assert.equal(await page.locator("#inventoryRows tr:not(.inventory-detail)").count(),17,"All devices remain listed on "+size.name);
    fs.mkdirSync(path.join(root,"artifacts"),{recursive:true});
    await page.screenshot({path:path.join(root,"artifacts","04-systems-webkit-"+size.name+".png"),fullPage:true});
  }
  await page.locator("#tab-rooms").click();
  await page.locator('[data-room="bathroom"]').click();
  assert((await page.locator(".inspector-name").innerText()).includes("Bathroom"));
  await page.locator("#tab-energy").click();
  await page.locator('#periodControl [data-period="week"]').click();
  assert.equal(await page.locator("#energyChart .chart-bar").count(),7);
  assert.deepEqual(errors,[],"No browser exceptions on WebKit");
  assert.deepEqual(external,[],"No external request attempts");
  console.log("WebKit test passed: iPhone + iPad viewports, four modes, interactive rooms/energy, no network.");
  await context.close();
}finally{if(browser)await browser.close();server.kill("SIGTERM");}
