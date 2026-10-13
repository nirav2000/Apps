import test from 'node:test';import assert from 'node:assert/strict';import {api} from './github.mjs';
const path='/repos/nirav2000/Apps/issues/25/comments';
test('safe reads recover from a closed connection with bounded retries',async()=>{
 const previous=globalThis.fetch;let calls=0;
 try{globalThis.fetch=async()=>{if(++calls===1)throw new TypeError('closed socket');return new Response('[]',{status:200});};assert.deepEqual(await api(path,{retryDelayMs:0}),[]);assert.equal(calls,2);}finally{globalThis.fetch=previous;}
});
test('status replacement recovers from a transient upstream failure',async()=>{
 const previous=globalThis.fetch;const calls=[];
 try{globalThis.fetch=async(_url,options)=>{calls.push(options);return new Response(calls.length===1?'temporary':'{"state":"closed"}',{status:calls.length===1?503:200});};assert.deepEqual(await api('/repos/nirav2000/Apps/issues/25',{method:'PATCH',body:{state:'closed'},retryDelayMs:0}),{state:'closed'});assert.equal(calls.length,2);assert.equal(calls[0].body,calls[1].body);}finally{globalThis.fetch=previous;}
});
test('creation requests are not repeated after an ambiguous connection failure',async()=>{
 const previous=globalThis.fetch;let calls=0;
 try{globalThis.fetch=async()=>{calls++;throw new TypeError('closed socket');};await assert.rejects(api(path,{method:'POST',body:{body:'test'},retryDelayMs:0}),/closed socket/);assert.equal(calls,1);}finally{globalThis.fetch=previous;}
});
test('retry exhaustion and outside repositories remain hard failures',async()=>{
 const previous=globalThis.fetch;let calls=0;
 try{globalThis.fetch=async()=>{calls++;throw new TypeError('closed socket');};await assert.rejects(api(path,{retryDelayMs:0}),/closed socket/);assert.equal(calls,3);await assert.rejects(api('/repos/foreign/repo/issues/1'),/allow-list/);assert.equal(calls,3);}finally{globalThis.fetch=previous;}
});
