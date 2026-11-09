import test from 'node:test';
import assert from 'node:assert/strict';
import {handleNvrDataRoute, validateNvrNotes, checkNvrAssetName} from '../nvr-private-data.js';
const endpoint = 'https://worker.test/app-monitor/nvr/';
const makeEnv = () => {
  const values = new Map();
  return {BIZ_CATALOG_GITHUB_TOKEN:'private-read-token', APP_MONITOR_DATA:{
    get:async key => values.has(key) ? {
      text:async()=>typeof values.get(key)==='string'?values.get(key):new TextDecoder().decode(values.get(key)),
      arrayBuffer:async()=>Uint8Array.from(values.get(key)).buffer
    }:null,
    put:async (key,v)=>values.set(key,v)
  },values};
};
const fetchSource = async (url, init) => {
  assert.equal(init.headers.Authorization,'Bearer private-read-token');
  const a = url.includes('activities.json') ? [{title:'Practice',questions:[]}] :
    {'https://atom.example/q':'assets/asset-0001.svg'};
  const json=JSON.stringify(a);
  return Response.json({type:'file',encoding:'base64',size:Buffer.byteLength(json),content:Buffer.from(json).toString('base64')});
};
test('missing GitHub token fails closed without reading public assessment data',async()=>{
  const env=makeEnv();delete env.BIZ_CATALOG_GITHUB_TOKEN;
  const result=await handleNvrDataRoute(new Request(endpoint+'activities'),env,{});
  assert.equal(result.status,503);
  assert.equal(result.headers.get('cache-control').includes('no-store'),true);
  assert.equal(JSON.stringify(await result.json()).includes('activities'),false);
});
test('private dataset is fetched with server-side token and cached only in R2',async()=>{
  const env=makeEnv();
  const first=await handleNvrDataRoute(new Request(endpoint+'activities'),env,{},undefined,fetchSource);
  assert.equal(first.status,200);
  const data=await first.json();
  assert.equal(data.activities.length,1);
  assert.equal(data.assets['https://atom.example/q'],'assets/asset-0001.svg');
  const cached=await handleNvrDataRoute(new Request(endpoint+'activities'),env,{},undefined,
    ()=>{throw Error('Unexpected second request');});
  assert.equal((await cached.json()).source,'private-cache');
});
test('rejects asset path traversal and unexpected file names',async()=>{
  assert.equal(checkNvrAssetName('asset-0001.svg'),true);
  for(const name of ['../secrets.json','asset-1.svg','asset-0001.html','/asset-0001.svg','asset-0001.svg/other'])
    assert.equal(checkNvrAssetName(name),false);
  const env=makeEnv();
  const result=await handleNvrDataRoute(new Request(endpoint+'assets/../secrets.json'),env,{});
  assert.equal(result.status,404);
});
test('private notes can be saved and read with no-store',async()=>{
  const env=makeEnv();
  const input={notes:{'a::1':{bookmarked:true,text:'Try rotation first'}}};
  const saved=await handleNvrDataRoute(new Request(endpoint+'notes',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify(input)}),env,{});
  assert.equal(saved.status,200);
  const result=await handleNvrDataRoute(new Request(endpoint+'notes'),env,{});
  assert.equal(result.status,200);
  assert.deepEqual((await result.json()).notes['a::1'],input.notes['a::1']);
  assert.equal(result.headers.get('cache-control').includes('no-store'),true);
});
test('rejects malformed notes and script-bearing SVG data',async()=>{
  assert.equal(validateNvrNotes({'k':{text:'x'}}),null);
  assert.equal(validateNvrNotes({'k':{text:'x',bookmarked:false}}).k.text,'x');
  const env=makeEnv();
  env.values.set('_app-monitor/v2/private/nvr/assets/asset-0001.svg',
    new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>'));
  const result=await handleNvrDataRoute(new Request(endpoint+'assets/asset-0001.svg'),env,{});
  assert.equal(result.status,415);
});
