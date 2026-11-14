/* Optional Playwright smoke test and preview screenshots for the demo-only dashboard. */
import assert from "node:assert/strict";
import http from "node:http";
import fs from "node:fs/promises";
import path from "node:path";
import {fileURLToPath} from "node:url";
import {chromium} from "playwright";

const base=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"../..");
const mime={".html":"text/html; charset=utf-8",".js":"text/javascript",".mjs":"text/javascript",".css":"text/css",".json":"application/json",".md":"text/plain"};
const server=http.createServer(async (req,res)=>{
  try{
    const relative=decodeURIComponent(new URL(req.url,"http://localhost").pathname);
    const target=path.resolve(base,"."+relative);
    if(!target.startsWith(base+path.sep)) {res.writeHead(403).end();return;}
    const buffer=await fs.readFile(target);
    res.writeHead(200,{"Content-Type":mime[path.extname(target)]||"application/octet-stream"});
    res.end(buffer);
  }catch{res.writeHead(404).end("Not found");}
});
await new Promise(resolve=>server.listen(0,"127.0.0.1",resolve));
const url="http://127.0.0.1:"+server.address().port+"/home-automation/heating.html";
const browser=await chromium.launch({headless:true});
const consoleErrors=[];
const page=await browser.newPage({viewport:{width:1440,height:900}});
page.on("pageerror",e=>consoleErrors.push(e.message));
try{
  await page.goto(url,{waitUntil:"networkidle"});
  await page.locator(".zone-card").first().waitFor();
  assert.equal(await page.locator(".zone-card").count(),4,"Four example heating devices should appear");
  assert.match(await page.locator("#sourceBadge").innerText(),/DEMO DATA/);
  assert.equal(await page.locator(".time-row").count(),4);
  const targetBefore=await page.locator(".zone-card").filter({hasText:"Bathroom underfloor"}).innerText();
  assert.match(targetBefore,/23.0°/);
  await page.locator('button[data-temp="warmup-bathroom"][data-delta="0.5"]').click();
  const targetAfter=await page.locator(".zone-card").filter({hasText:"Bathroom underfloor"}).innerText();
  assert.match(targetAfter,/23.5°/,"A demo temperature control should change the display");

  await page.locator('button[data-period="yesterday"]').click();
  assert.match(await page.locator("#rangeDescription").innerText(),/Yesterday/);
  const energy=await page.locator("#electricEnergy").innerText();
  assert.match(energy,/kWh/);
  const firstCost=Number((await page.locator("#electricCost").innerText()).replace("£",""));
  await page.locator("#tariff").fill("33");
  await page.locator("#tariff").dispatchEvent("change");
  const nextCost=Number((await page.locator("#electricCost").innerText()).replace("£",""));
  assert(nextCost>firstCost,"Higher tariff must increase estimated electric cost");

  await page.locator('button[data-period="7d"]').click();
  assert.match(await page.locator("#rangeDescription").innerText(),/Past seven days/);
  await fs.mkdir(path.join(base,"home-automation/artifacts"),{recursive:true});
  await page.screenshot({path:path.join(base,"home-automation/artifacts/heating-desktop.png"),fullPage:true});

  const now=new Date(),since=new Date(now.getTime()-30*60000);
  const payload={schemaVersion:1,generatedAt:now.toISOString(),source:"browser-test",
    zones:[{id:"bathroom1",name:"Imported bathroom",provider:"warmup",energyType:"electric",powerW:500}],
    intervals:[{zoneId:"bathroom1",start:since.toISOString(),end:now.toISOString(),state:"on",evidence:"Test synthetic load"}]};
  await page.locator("#importFile").setInputFiles({name:"test-history.json",mimeType:"application/json",buffer:Buffer.from(JSON.stringify(payload))});
  await page.waitForFunction(()=>document.querySelector("#sourceBadge").textContent.includes("IMPORTED"));
  assert.equal(await page.locator(".zone-card").count(),1,"Imported history should replace demo devices");
  const bad={...payload,intervals:[...payload.intervals,{...payload.intervals[0]}]};
  await page.locator("#importFile").setInputFiles({name:"invalid.json",mimeType:"application/json",buffer:Buffer.from(JSON.stringify(bad))});
  await page.waitForFunction(()=>document.querySelector("#importStatus").textContent.includes("Import rejected"));
  assert.equal(await page.locator(".zone-card").count(),1,"Invalid import must not replace already shown data");

  await page.locator("#resetDemo").click();
  assert.equal(await page.locator(".zone-card").count(),4,"Reset should restore demonstration");
  const mobile=await browser.newPage({viewport:{width:390,height:844},deviceScaleFactor:2,isMobile:true,hasTouch:true});
  mobile.on("pageerror",e=>consoleErrors.push(e.message));
  await mobile.goto(url,{waitUntil:"networkidle"});
  await mobile.locator(".zone-card").first().waitFor();
  const sizes=await mobile.evaluate(()=>({scroll:document.documentElement.scrollWidth,viewport:document.documentElement.clientWidth}));
  assert(sizes.scroll<=sizes.viewport+2,"Mobile layout overflowed horizontally: "+JSON.stringify(sizes));
  await mobile.screenshot({path:path.join(base,"home-automation/artifacts/heating-mobile.png"),fullPage:true});
  await mobile.close();
  assert.deepEqual(consoleErrors,[],"No uncaught browser errors expected");
  console.log("Heating Intelligence desktop, mobile, import and cost interaction smoke tests passed.");
}finally{
  await browser.close();await new Promise(resolve=>server.close(resolve));
}
