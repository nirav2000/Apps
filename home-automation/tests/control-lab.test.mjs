import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";

const base=path.resolve(import.meta.dirname,"..");
const source=fs.readFileSync(path.join(base,"control-lab.js"),"utf8");
const html=fs.readFileSync(path.join(base,"index.html"),"utf8");
const app=fs.readFileSync(path.join(base,"app.js"),"utf8");
const context={window:{}};
vm.runInNewContext(source,context,{timeout:2000});
const lab=context.window.HomeControlLab;

test("eight distinct control interfaces and three ancillary device controls are present",()=>{
  assert.equal(lab.options.length,8);
  assert.equal(new Set(lab.options.map(x=>x.id)).size,8);
  for(const control of ["hybrid","rotary","scrub","fader","presets","keypad","stepper","picker"])
    assert(lab.options.some(x=>x.id===control),control);
  assert.match(html,/id="control-playground"/);
  assert.match(source,/data-temp-range/);
  assert.match(source,/data-rotary/);
  assert.match(source,/data-scrub/);
  assert.match(source,/data-temp-select/);
  assert.match(source,/data-number-apply/);
  for(const control of ["labDimmer","labFanStatus","labBoostStatus"])assert(source.includes(control));
});
test("rotary scale uses a 300 degree gesture and a deliberate inactive arc",()=>{
  assert.equal(lab.range.min,10);
  assert.equal(lab.range.max,28);
  assert.equal(lab.range.step,0.5);
  assert.equal(lab.pointerToValue(210),10,"7 o'clock starts at 10°C");
  assert.equal(lab.pointerToValue(0),19,"top position corresponds to 19°C");
  assert.equal(lab.pointerToValue(150),28,"5 o'clock ends at 28°C");
  assert.equal(lab.pointerToValue(180),null,"bottom gap is inactive and cannot wrap");
  assert.equal(lab.pointerToValue(205),null,"lower-left dead-zone prevents sudden jumps");
  assert.equal(lab.quantise(22.26),22.5,"setpoint snaps to nearest 0.5°C");
  assert.equal(lab.quantise(75),28,"clamps overly warm targets");
  assert.equal(lab.quantise(-5),10,"clamps low targets");
  assert.match(source,/setPointerCapture/,"Drag should capture pointer and remain stable");
  assert.match(source,/releasePointerCapture/,"Pointer release must be handled");
  assert.match(source,/touch-action:none/);
  assert.match(source,/ArrowRight/,"Keyboard control is supported");
});
test("the main room dashboard and household heating cards use the same shared target",()=>{
  assert.match(app,/setRoomTarget\(state\.selectedRoom,value,options\)/);
  assert.match(app,/window\.HomeControlLab\.rotaryMarkup\(\{inspector:true\}\)/);
  assert.match(app,/data-zone-range/);
  assert.match(app,/data-temp-range/);
  assert.match(app,/window\.HomeControlLab\?\.refresh\(\)/);
  assert.match(app,/shortlisted:\[\.\.\.state\.shortlisted\]/);
  assert.match(app,/Preferred interactions:/);
});
test("prototype cannot call a live controller",()=>{
  assert.doesNotMatch(source+"\n"+app,/\b(?:fetch|XMLHttpRequest|WebSocket|EventSource)\s*\(/);
  assert.match(html,/nothing is connected to your home/);
  assert.match(source,/No home hardware is contacted|No real/);
});
