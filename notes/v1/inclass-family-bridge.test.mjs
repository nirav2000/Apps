import test from 'node:test';
import assert from 'node:assert/strict';
import {inclassFamilyNotesRoute,inclassFamilyNotesHealth} from './inclass-family-bridge.js';
const env={FIREBASE_ADMIN_SERVICE_ACCOUNT_JSON:'test'};
const headers={'Access-Control-Allow-Origin':'https://nirav2000.github.io'};
const route=(query,opts={})=>inclassFamilyNotesRoute(new Request('https://test/app-monitor/inclass/family-notes?'+query,opts),env,headers,new URL('https://test/app-monitor/inclass/family-notes?'+query),{getGoogleToken:async()=> 'test-token',fetchImpl:async()=>{throw Error('Firestore must not be called for invalid input')}});
test('rejects dangerous learner and pack paths',async()=>{
 for(const query of ['learner=../a&pack=week','learner=sai&pack=../../x','learner=&pack=week']){
  const r=await route(query);assert.equal(r.status,400);
 }
});
test('rejects client-side out-of-scope note before Firestore access',async()=>{
 const r=await route('learner=sai&pack=week',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({revision:null,notes:[{id:'a',appId:'inclass',page:'inclass:lesson:other:Sai',text:'Secret',status:'open'}]})});
 assert.equal(r.status,400);
});
test('rejects invalid save revision without Firestore',async()=>{
 const r=await route('learner=sai&pack=week',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({revision:'made-up',notes:[]})});
 assert.equal(r.status,400);
});
test('replies 503 if service credentials absent',async()=>{
 const url=new URL('https://test/app-monitor/inclass/family-notes?learner=sai&pack=week');
 const r=await inclassFamilyNotesRoute(new Request(url),{},headers,url,{getGoogleToken:async()=> 'token'});
 assert.equal(r.status,503);
});

test('Health endpoint fails safely when Firebase secret is missing',async()=>{
 const reply=await inclassFamilyNotesHealth({}, {getGoogleToken:async()=>{throw Error('should not run')}});
 assert.equal(reply.status,503);
 assert.equal((await reply.json()).stage,'firebase-credential-missing');
});
test('Health endpoint verifies Firebase data-read permission without leaking contents',async()=>{
 let observed='';
 const reply=await inclassFamilyNotesHealth(env,{
  getGoogleToken:async()=> 'mock-token',
  fetchImpl:async(url,opts)=>{observed=url;assert.equal(opts.headers.Authorization,'Bearer mock-token');return new Response(null,{status:404});}
 });
 assert.equal(reply.status,200);
 assert.equal((await reply.json()).stage,'ready');
 assert.match(observed,/backend-healthcheck/);
 assert.doesNotMatch(observed,/token/);
});
test('Health endpoint distinguishes Google exchange and Firestore permissions',async()=>{
 const google=await inclassFamilyNotesHealth(env,{getGoogleToken:async()=>{throw Error('sensitive data')}});
 assert.equal(google.status,503);
 assert.equal((await google.json()).stage,'firebase-google-auth-failed');
 const denied=await inclassFamilyNotesHealth(env,{
  getGoogleToken:async()=> 'mock-token',
  fetchImpl:async()=>new Response('',{status:403})
 });
 assert.equal(denied.status,502);
 assert.equal((await denied.json()).stage,'firestore-permission-denied');
});
