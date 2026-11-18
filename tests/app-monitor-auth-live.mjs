// Live, unauthenticated contract check. Never uses an administrator passkey or token.
// A challenge is created and then deliberately consumed with an invalid assertion;
// successful denial proves issuance/replay storage works without granting access.
const root=(process.env.APP_MONITOR_API_BASE||'https://apps-monitor-api.nirav2000-github.workers.dev').replace(/\/$/,'');
const origin='https://nirav2000.github.io';
const common={'Origin':origin,'Cache-Control':'no-cache'};
const outcomes=[];
async function test(label,fn){
  try{const detail=await fn();outcomes.push({label,ok:true,detail});console.log('PASS '+label+' '+JSON.stringify(detail||{}));return detail;}
  catch(error){outcomes.push({label,ok:false});console.error('FAIL '+label+': '+(error?.message||error));return null;}
}
async function get(path,init={}){
  const r=await fetch(root+path,{...init,headers:{...common,...(init.headers||{})},signal:AbortSignal.timeout(15000)});
  let data=null;const txt=await r.text();try{data=JSON.parse(txt)}catch{}
  return {status:r.status,data,headers:r.headers};
}
const assert=(condition,message)=>{if(!condition)throw Error(message)};
await test('Worker health and storage binding',async()=>{
  const r=await get('/health?live-auth-test='+Date.now());
  assert(r.status===200,'/health HTTP '+r.status);
  assert(r.data?.ok===true&&r.data?.r2Bound===true,'Worker is missing required R2 storage or healthy state');
  assert(typeof r.data?.build==='string'&&r.data.build.length>5,'Missing Worker build identifier');
  return {build:r.data.build,r2Bound:true};
});
await test('Passkey provisioning via R2',async()=>{
  const r=await get('/app-monitor/security/status?live-auth-test='+Date.now());
  assert(r.status===200,'security/status HTTP '+r.status);
  assert(r.data?.ok===true,'Unhealthy passkey status response');
  assert(r.data.bootstrapNeeded===false&&r.data.passkeyCount>0,'No provisioned admin passkeys');
  assert(r.headers.get('access-control-allow-origin')===origin,'CORS allowed origin mismatched');
  return {provisioned:true,passkeyCount:r.data.passkeyCount};
});
const issued=await test('WebAuthn passkey options and challenge persistence',async()=>{
  const r=await get('/app-monitor/auth/passkey/options',{method:'POST'});
  assert(r.status===200,'auth/passkey/options HTTP '+r.status);
  assert(r.data?.challengeId&&r.data?.options?.challenge,'No server-side challenge');
  assert(r.data.options.rpId==='nirav2000.github.io','WebAuthn RP ID mismatch');
  assert(r.data.options.userVerification==='required','User verification not required');
  assert(Array.isArray(r.data.options.allowCredentials)&&r.data.options.allowCredentials.length>0,'No allowed credentials');
  return {challengeId:r.data.challengeId,credentialCount:r.data.options.allowCredentials.length};
});
if(issued?.challengeId){
  await test('Invalid assertion denied and one-time challenge consumed',async()=>{
    const r=await get('/app-monitor/auth/passkey/verify',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({challengeId:issued.challengeId,response:{id:'invalid-probe-credential',type:'public-key'}})});
    assert(r.status===401,'Invalid assertion should be HTTP 401; got '+r.status);
    const replay=await get('/app-monitor/auth/passkey/verify',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({challengeId:issued.challengeId,response:{id:'invalid-probe-credential',type:'public-key'}})});
    assert(replay.status===401,'Replayed challenge should be HTTP 401; got '+replay.status);
    return {denied:true,replayDenied:true};
  });
}
await test('Private services fail closed without admin session',async()=>{
  const routes=['/app-monitor/auth/session','/app-monitor/notes?appId=app-monitor','/app-monitor/nvr/activities'];
  const codes=[];
  for(const path of routes){const r=await get(path);codes.push(r.status);assert(r.status===401,path+' is not access-controlled (HTTP '+r.status+')')}
  return {statuses:codes};
});
if(outcomes.some(x=>!x.ok)){console.error('App Monitor authentication live contract FAILED');process.exitCode=1}
else console.log('App Monitor authentication live contract passed. This does not substitute for a real device passkey ceremony.');
