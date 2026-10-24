import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";

const base=path.resolve(import.meta.dirname,"..");
const read=file=>fs.readFileSync(path.join(base,file),"utf8");
const sandbox={window:{}};
vm.runInNewContext(read("data.js"),sandbox,{timeout:1000});
const data=sandbox.window.HOME_STUDIO_DATA;
const html=read("index.html"),js=read("app.js"),css=read("styles.css");

test("all four dashboard variants have accessible tabs and panels",()=>{
  for(const view of ["overview","rooms","energy","systems"]){
    assert.match(html,new RegExp('id="tab-'+view+'"'));
    assert.match(html,new RegExp('id="panel-'+view+'"'));
    assert.match(html,new RegExp('aria-labelledby="tab-'+view+'"'));
  }
  assert.match(html,/role="tablist"/);
  assert.match(js,/keydown/);
  assert.match(css,/:focus-visible/);
  assert.match(css,/prefers-reduced-motion/);
});

test("the complete register is unique, evidence-labelled and describes the Pi",()=>{
  assert.equal(data.version,"0.1.0");
  assert.equal(data.systems.length,17);
  assert.equal(new Set(data.systems.map(x=>x.id)).size,data.systems.length);
  assert(data.systems.some(x=>/Wiser/.test(x.name)&&x.stage==="reported"));
  assert(data.systems.some(x=>/Warmup/.test(x.name)&&x.stage==="reported"));
  assert(data.systems.some(x=>/Pi Zero/.test(x.name)&&x.stage==="verify"));
  assert(data.systems.some(x=>/Pi 4/.test(x.name)&&x.stage==="verify"));
  for(const item of data.systems){
    assert(["reported","verify","idea"].includes(item.stage),item.id);
    for(const field of ["name","category","goal","detail","zero","status","requires"]){
      assert.equal(typeof item[field],"string",item.id+"."+field);
      assert(item[field].length>5,item.id+"."+field);
    }
    if(item.docs)assert(/^https:\/\//.test(item.docs),"External references must be HTTPS");
  }
});

test("interactions are demonstration-only without provider networking",()=>{
  const front=html+"\n"+js+"\n"+read("data.js");
  assert.match(front,/prototype only|design prototype only/i);
  assert.match(front,/not connected/i);
  assert.doesNotMatch(js,/\b(?:fetch|XMLHttpRequest|WebSocket|EventSource)\s*\(/,"No network call implementation in prototype");
  assert.doesNotMatch(front,/(?:Bearer [A-Za-z0-9_-]{12}|sk-[A-Za-z0-9_-]{20}|AIza[0-9A-Za-z_-]{30})/,"No recognizable credential values");
  assert.equal(data.milestones.length,10);
  assert.equal(data.rooms.length,5);
  assert.equal(data.scenes.length,4);
  assert.equal(data.sampleEnergy.day.length,24);
  assert.equal(data.sampleEnergy.week.length,7);
});

test("all standalone asset links and app monitor integration references exist",()=>{
  for(const asset of ["./styles.css?v=0.1.0","./data.js?v=0.1.0","./app.js?v=0.1.0"])assert(html.includes(asset),asset);
  for(const id of ["roomInspector","energyChart","inventoryRows","milestoneList","designNotes","favouriteBtn","copyFeedback"])assert(html.includes('id="'+id+'"'),id);
  assert.match(read("../app-monitor.html"),/href="\.\/home-automation\/"/);
  assert.match(read("../index.html"),/href="home-automation\/"/);
});
