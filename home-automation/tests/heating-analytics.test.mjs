import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {fileURLToPath} from "node:url";
import {clipIntervals,unionDuration,hourlyActivity,summarize} from "../heating-analytics.mjs";

const base=path.dirname(fileURLToPath(import.meta.url));
const read=f=>fs.readFileSync(path.join(base,"..",f),"utf8");
const a="2026-11-10T00:00:00Z";
const b="2026-11-10T04:00:00Z";
const gas={id:"living",name:"Living",provider:"wiser",energyType:"gas"};
const warm={id:"ufh",name:"Bathroom",provider:"warmup",energyType:"electric",powerW:1500};
const span=(zoneId,from,to,state="on")=>({zoneId,start:"2026-11-10T"+from+":00Z",end:"2026-11-10T"+to+":00Z",state});

test("zone activity, kWh and pence only use known warmup ON intervals",()=>{
  const result=summarize({zones:[gas,warm],intervals:[
    span("ufh","00:00","01:00"),span("ufh","01:00","02:00"),
    span("ufh","02:00","04:00","off"),span("living","00:00","03:00")],
    from:a,until:b,pricePence:23.10});
  assert.equal(result.rows[1].onMinutes,120);
  assert.equal(result.rows[1].kwh,3);
  assert(Math.abs(result.rows[1].costPounds-0.693)<1e-10);
  assert.equal(result.estimateKwh,3);
  assert.equal(result.boilerDemandMinutes,180);
  assert.equal(result.rows[0].kwh,null);
  assert.equal(result.rows[0].costPounds,null);
  assert.equal(result.hasGasMeasurement,false);
});
test("gas rooms calling simultaneously count as a single elapsed demand window",()=>{
  const other={...gas,id:"upstairs"};
  const result=summarize({zones:[gas,other],intervals:[
    span("living","00:00","02:00"),span("upstairs","01:00","03:00")],
    from:a,until:b});
  assert.equal(result.rows[0].onMinutes,120);
  assert.equal(result.rows[1].onMinutes,120);
  assert.equal(result.boilerDemandMinutes,180);
  assert.equal(result.estimateKwh,0);
  assert.equal(result.hasElectricEstimate,false);
});
test("unknown gaps remain missing and are not classified as off",()=>{
  const result=summarize({zones:[warm],intervals:[
    span("ufh","01:00","02:00","on"),span("ufh","02:00","03:00","unknown")],
    from:a,until:b,pricePence:25});
  assert.equal(result.rows[0].onMinutes,60);
  assert.equal(result.rows[0].unknownMinutes,180);
  assert.equal(result.rows[0].coverage,.25);
});
test("overlapping ON intervals never double-count demand or electricity",()=>{
  const result=summarize({zones:[warm],intervals:[
    span("ufh","00:00","02:00"),span("ufh","01:00","03:00")],
    from:a,until:b});
  assert.equal(result.rows[0].onMinutes,180);
  assert.equal(result.rows[0].kwh,4.5);
  assert.equal(result.rows[0].cycles,1);
});
test("clipping limits activity to requested time period",()=>{
  const found=clipIntervals([span("ufh","00:00","03:00")],"2026-11-10T01:00:00Z","2026-11-10T02:00:00Z","ufh");
  assert.equal(unionDuration(found),3600000);
});
test("hourly activity distinguishes observed ON from unknown",()=>{
  const values=hourlyActivity([span("ufh","00:00","01:00"),span("ufh","01:00","02:00","off")],
    "2026-11-10T00:00:00Z","2026-11-10T03:00:00Z","ufh");
  assert.equal(values.length,3);
  assert.equal(values[0].onMinutes,60);
  assert.equal(values[1].coverage,1);
  assert.equal(values[2].coverage,0);
});
test("missing rated power produces no energy estimate, not zero measured energy",()=>{
  const result=summarize({zones:[{...warm,powerW:null}],intervals:[span("ufh","00:00","02:00")],from:a,until:b});
  assert.equal(result.rows[0].kwh,null);
  assert.equal(result.rows[0].costPounds,null);
});
test("invalid tariff, timestamps and zero-duration periods fail safely",()=>{
  assert.throws(()=>summarize({zones:[],intervals:[],from:b,until:a}),/Invalid time window/);
  assert.throws(()=>summarize({zones:[],intervals:[],from:a,until:b,pricePence:-4}),/Invalid electricity tariff/);
});
test("dashboard is linked and never embeds live device credentials or direct API calls",()=>{
  const html=read("heating.html"),js=read("heating.js"),doc=read("heating-integration.md");
  assert.match(html,/id="zones"/);
  assert.match(html,/id="timeline"/);
  assert.match(html,/id="importFile"/);
  assert.match(html,/id="csvExport"/);
  assert.match(html,/heating-analytics\.mjs|heating\.js/);
  assert.match(read("index.html"),/href="\.\/heating\.html"/);
  assert.match(doc,/Home Assistant/);
  assert.match(doc,/Warmup/);
  assert.match(doc,/unknown/);
  assert.doesNotMatch(js,/\b(?:fetch|XMLHttpRequest|WebSocket|EventSource)\s*\(/);
  assert.doesNotMatch(html+js,/(?:Bearer [A-Za-z0-9_-]{12}|sk-[A-Za-z0-9_-]{20}|AIza[0-9A-Za-z_-]{30})/);
});
