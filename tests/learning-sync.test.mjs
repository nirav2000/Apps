import test from 'node:test';
import assert from 'node:assert/strict';
import {createLearningSync,createFirestoreTransport,mergeChunks} from '../learning-sync/v1/index.js';
const memory=()=>{const m=new Map();return {getItem:k=>m.get(k)||null,setItem:(k,v)=>m.set(k,v)}};
const data=(n,t=100)=>({events:[{concept:'fact:2x3',correct:true,hints:0,timestamp:t}],sessions:[{mode:'guided',target:n,correct:1,total:1,hints:0,timestamp:t}]});
function remote(){const db=new Map();let uid='u1',online=true;const key=x=>[x.appId,x.accountId,x.learnerId].join(':');return {setUser:x=>uid=x,setOnline:x=>online=x,async verifyUser(x){if(x!==uid)throw Error('Wrong user');if(!online)throw Error('Offline')},async putChunks(x){if(!online)throw Error('Offline');const m=db.get(key(x))||new Map();for(const c of x.chunks)m.set(c.id,c);db.set(key(x),m)},async getChunks(x){if(!online)throw Error('Offline');return [...(db.get(key(x))||new Map()).values()]}}}
test('guest data is durable and never silently uploaded',async()=>{const storage=memory(),transport=remote();const a=createLearningSync({appId:'dol',storage,transport,deviceId:'device-1'});a.capture(data(24));const b=createLearningSync({appId:'dol',storage,transport,deviceId:'device-1'});assert.equal(b.snapshot().sessions.length,1);b.switchAccount('u1');assert.equal(b.snapshot().sessions.length,0);await assert.rejects(async()=>b.importGuest(),/approval/);await b.sync();assert.equal(b.snapshot().sessions.length,0);b.importGuest({approved:true});await b.sync();assert.equal(b.snapshot().sessions.length,1);b.importGuest({approved:true});assert.equal(b.snapshot().sessions.length,1)});
test('offline queue replays and merges distinct devices idempotently',async()=>{const transport=remote(),a=createLearningSync({appId:'dol',accountId:'u1',storage:memory(),transport,deviceId:'device-a'}),b=createLearningSync({appId:'dol',accountId:'u1',storage:memory(),transport,deviceId:'device-b'});transport.setOnline(false);a.capture(data(24,100));await assert.rejects(()=>a.sync(),/Offline/);assert.equal(a.status().pending,1);transport.setOnline(true);await a.sync();b.capture(data(48,200));await b.sync();await a.sync();await a.sync();assert.equal(a.snapshot().sessions.length,2);assert.equal(a.snapshot().concepts['fact:2x3'].attempts,2)});
test('switching accounts isolates local learning',async()=>{const transport=remote(),a=createLearningSync({appId:'dol',accountId:'u1',storage:memory(),transport,deviceId:'device-a'});a.capture(data(12));await a.sync();a.switchAccount('u2');assert.equal(a.snapshot().sessions.length,0);await assert.rejects(()=>a.sync(),/Wrong user/);transport.setUser('u2');a.capture(data(36));await a.sync();a.switchAccount('u1');assert.equal(a.snapshot().sessions[0].target,12)});
test('Firebase transport refuses mismatched projects and users',async()=>{const sdk={doc:()=>({}),collection:()=>({}),setDoc:async()=>{},getDocs:async()=>({docs:[]})};assert.throws(()=>createFirestoreTransport({db:{app:{options:{projectId:'one'}}},auth:{app:{options:{projectId:'two'}}},sdk}),/project mismatch/);const auth={app:{options:{projectId:'one'}},currentUser:{uid:'u1',getIdToken:async()=>''}};const t=createFirestoreTransport({db:{app:{options:{projectId:'one'}}},auth,sdk});await assert.rejects(()=>t.verifyUser('u2'),/Account mismatch/)});
test('merge recomputes mastery in chronological order',()=>{const chunks=[{id:'a',events:data(12,200).events,sessions:[]},{id:'b',events:data(24,100).events,sessions:[]}];const result=mergeChunks(chunks);assert.equal(result.events[0].timestamp,100);assert.equal(result.concepts['fact:2x3'].attempts,2)});

test('explicit guest reset clears only local guest evidence',()=>{const storage=memory(),s=createLearningSync({appId:'dol',storage,deviceId:'device-1'});s.capture(data(24));assert.equal(s.snapshot().sessions.length,1);s.resetGuest();assert.equal(s.snapshot().sessions.length,0);s.capture(data(36));assert.equal(s.snapshot().sessions[0].target,36);s.switchAccount('u1');assert.throws(()=>s.resetGuest(),/server-authorised/)});

test('cloud hydration rebases capture cursor without duplicating historical sessions',async()=>{const t=remote(),storage=memory();const a=createLearningSync({appId:'dol',accountId:'u1',storage,transport:t,deviceId:'device-a'});a.capture(data(24,100));await a.sync();const b=createLearningSync({appId:'dol',accountId:'u1',storage:memory(),transport:t,deviceId:'device-b'});await b.sync();b.adoptSnapshot(b.snapshot());const next=b.snapshot();next.sessions.push({...data(48,200).sessions[0]});next.events.push({...data(48,200).events[0]});b.capture(next);await b.sync();await a.sync();assert.equal(a.snapshot().sessions.length,2)});

test('cloud objects with reordered keys do not produce a false ID collision',async()=>{
 const base=remote(),transport={...base,async getChunks(args){
  const chunks=await base.getChunks(args);
  return chunks.map(c=>({sessions:c.sessions.map(s=>Object.fromEntries(Object.entries(s).reverse())),events:c.events.map(e=>Object.fromEntries(Object.entries(e).reverse())),source:c.source,createdAt:c.createdAt,id:c.id,schema:c.schema}));
 }};
 const a=createLearningSync({appId:'dol',accountId:'u1',storage:memory(),transport,deviceId:'device-a'});
 a.capture(data(24));await a.sync();await a.sync();
 assert.equal(a.status().pending,0);assert.equal(a.snapshot().sessions.length,1);
});
test('a genuine cloud ID collision preserves remote and local evidence without multiplying sessions',async()=>{
 const cloud=new Map(),key=c=>c.id;
 const transport={
  async verifyUser(uid){assert.equal(uid,'u1')},
  async getChunks(){return [...cloud.values()].map(x=>JSON.parse(JSON.stringify(x)))},
  async putChunks({chunks}){for(const c of chunks){const prev=cloud.get(key(c));if(prev&&JSON.stringify(prev)!==JSON.stringify(c))throw Error('Cloud ID collision');cloud.set(key(c),JSON.parse(JSON.stringify(c)));}}
 };
 const existing=createLearningSync({appId:'dol',accountId:'u1',storage:memory(),transport,deviceId:'same-device'});
 existing.capture(data(24,100));await existing.sync();
 const next=createLearningSync({appId:'dol',accountId:'u1',storage:memory(),transport,deviceId:'same-device'});
 next.capture(data(48,200));await next.sync();await next.sync();await existing.sync();
 assert.equal(cloud.size,2);assert.equal(existing.snapshot().sessions.length,2);
 assert.deepEqual(new Set(existing.snapshot().sessions.map(s=>s.target)),new Set([24,48]));
 assert.equal(next.status().pending,0);
});
test('Firestore transport never replaces an immutable cloud chunk with different contents',async()=>{
 const stored=new Map(),db={app:{options:{projectId:'one'}}};
 const auth={app:{options:{projectId:'one'}},currentUser:{uid:'u1',getIdToken:async()=>''}};
 const sdk={
  doc:(_db,...segments)=>segments.join('/'),collection:()=>({}),
  async runTransaction(_db,callback){return callback({
   get:async ref=>({exists:()=>stored.has(ref),data:()=>stored.get(ref)}),
   set:(ref,value)=>stored.set(ref,value)
  })},getDocs:async()=>({docs:[]})
 };
 const t=createFirestoreTransport({db,auth,sdk});
 const original={schema:1,id:'one',createdAt:1,events:[{x:1}],sessions:[]};
 const different={...original,events:[{x:2}]};
 const args={appId:'dol',accountId:'u1',learnerId:'local'};
 await t.putChunks({...args,chunks:[original]});
 await t.putChunks({...args,chunks:[{sessions:[],events:[{x:1}],id:'one',schema:1,createdAt:1}]});
 await assert.rejects(()=>t.putChunks({...args,chunks:[different]}),/Cloud ID collision/);
 assert.equal([...stored.values()][0].events[0].x,1);
});
