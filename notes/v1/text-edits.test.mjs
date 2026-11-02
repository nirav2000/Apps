import test from 'node:test';
import assert from 'node:assert/strict';
import {createNotes,validateTextEdits} from './index.js';

function fixture(){
  const saved=[];
  const transport={list:async()=>saved.map(n=>structuredClone(n)),save:async n=>{const i=saved.findIndex(x=>x.id===n.id);if(i<0)saved.push(n);else saved[i]=n;return n},remove:async()=>{}};
  return {saved,transport,notes:createNotes({appId:'inclass',page:()=> 'inclass:lesson:week1:Sai',transport})};
}
test('ChatGPT editing updates text but preserves note status, review flag, and lesson',async()=>{
  const {notes}=fixture();await notes.load();
  const first=await notes.upsert({text:'Present tense unclear',reviewRequired:false,anchorId:'rule',metadata:{owner:'parent'}});
  const data={schema:'apps-shared-notes-edits-v1',appId:'inclass',page:first.page,updates:[{id:first.id,text:'Present tense tells us what happens now.'}]};
  const result=await notes.applyTextEdits(data,first.page);
  assert.equal(result.updated,1);
  const edited=notes.list()[0];
  assert.equal(edited.text,'Present tense tells us what happens now.');
  assert.equal(edited.reviewRequired,false);
  assert.equal(edited.metadata.owner,'parent');
  assert.equal(edited.page,first.page);
});
test('No cross-app, cross-lesson, closed-note, duplicate or unknown IDs',async()=>{
  const {notes}=fixture();await notes.load();
  const n=await notes.upsert({text:'One'});
  const base={schema:'apps-shared-notes-edits-v1',appId:'inclass',page:n.page,updates:[{id:n.id,text:'Two'}]};
  for(const bad of [
    {...base,appId:'snag'},
    {...base,page:'inclass:lesson:week2:Sai'},
    {...base,updates:[{id:'unknown',text:'Two'}]},
    {...base,updates:[...base.updates,...base.updates]},
    {...base,updates:[{id:n.id,text:''}]},
    {...base,updates:[{id:n.id,text:'Two',status:'implemented'}],unexpected:'not-allowed'}
  ].slice(0,5))assert.throws(()=>validateTextEdits(bad,notes.list(),{appId:'inclass',page:n.page}));
  assert.equal(notes.list()[0].text,'One');
  await notes.archive(n.id);
  await assert.rejects(notes.applyTextEdits(base,n.page),/closed/);
});
test('Cloud write failure is not disguised as a successful ChatGPT update',async()=>{
 const notes=createNotes({appId:'inclass',page:()=>'/x',transport:{list:async()=>[{id:'a',text:'old',appId:'inclass',page:'/x',status:'open'}],save:async()=>{throw Error('cloud unavailable')}}});
 await notes.load();
 await assert.rejects(notes.applyTextEdits({schema:'apps-shared-notes-edits-v1',appId:'inclass',page:'/x',updates:[{id:'a',text:'new'}]},'/x'),/cloud unavailable/);
 assert.equal(notes.list()[0].text,'old');
});
