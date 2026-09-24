import { generateRegistrationOptions, verifyRegistrationResponse, generateAuthenticationOptions, verifyAuthenticationResponse } from '@simplewebauthn/server';
const WORKER_BUILD='2026.09.24.apps-monitor-1';
const APP_MONITOR_RP_ID='nirav2000.github.io',APP_MONITOR_ORIGIN='https://nirav2000.github.io',APP_MONITOR_SECURITY='_app-monitor/v2/security/',APP_MONITOR_SESSION_MS=12*60*60*1000,APP_MONITOR_CHALLENGE_MS=5*60*1000,APP_MONITOR_BOOTSTRAP_MS=30*60*1000;
// Dedicated App Monitor Cloudflare Worker. App Monitor data lives in its own R2 bucket.
// Legacy Snag R2 is bound read/write only during the migration window.
const cors=(origin,allowed)=>({
  'Access-Control-Allow-Origin': origin===allowed?origin:allowed,
  'Access-Control-Allow-Methods':'PUT,POST,GET,OPTIONS',
  'Access-Control-Allow-Headers':'Authorization,Content-Type,X-App-Monitor-Key,X-App-Monitor-Session,X-App-Monitor-Bootstrap',
  'Access-Control-Max-Age':'86400'
});
const allowedOrigin=(request,env)=>(request.headers.get('Origin')||'')===(env.ALLOWED_ORIGIN||'https://nirav2000.github.io');
const validDate=x=>/^\d{4}-\d{2}-\d{2}$/.test(x||'');
const validDevice=x=>/^[A-Za-z0-9._-]{8,100}$/.test(x||'');
const validSession=x=>/^[A-Za-z0-9._-]{8,120}$/.test(x||'');
const cleanKey=x=>String(x||'unknown').replace(/[^A-Za-z0-9._-]/g,'-').slice(0,80)||'unknown';
async function sha256(value){const bytes=new TextEncoder().encode(String(value||'')),digest=await crypto.subtle.digest('SHA-256',bytes);return [...new Uint8Array(digest)].map(x=>x.toString(16).padStart(2,'0')).join('')}
const b64uBytes=bytes=>{let s='';for(const b of bytes instanceof Uint8Array?bytes:new Uint8Array(bytes))s+=String.fromCharCode(b);return btoa(s).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'')};
const bytesB64u=s=>{const p=String(s||'').replace(/-/g,'+').replace(/_/g,'/'),raw=atob(p+'='.repeat((4-p.length%4)%4)),out=new Uint8Array(raw.length);for(let i=0;i<raw.length;i++)out[i]=raw.charCodeAt(i);return out};
const randomSecret=(n=32)=>{const b=new Uint8Array(n);crypto.getRandomValues(b);return b64uBytes(b)};
async function getJSON(env,key){const o=await env.APP_MONITOR_DATA.get(key);if(!o)return null;try{return JSON.parse(await o.text())}catch{return null}}
async function putJSON(env,key,value){await env.APP_MONITOR_DATA.put(key,JSON.stringify(value),{httpMetadata:{contentType:'application/json'}})}
async function listJSON(env,prefix,limit=5000){let cursor,objects=[],truncated=true;while(truncated&&objects.length<limit){const page=await env.APP_MONITOR_DATA.list({prefix,cursor,limit:1000});objects.push(...page.objects);truncated=page.truncated;cursor=page.cursor}const out=[];for(const item of objects){const x=await getJSON(env,item.key);if(x)out.push(x)}return out}
async function appMonitorCredential(request,env){
  const key=request.headers.get('X-App-Monitor-Key')||'';if(key.length<32)return {ok:false};
  const hash=await sha256(key),recovery=await getJSON(env,APP_MONITOR_SECURITY+'recovery.json');
  if(recovery){return {ok:recovery.hash===hash,hash,master:recovery.hash===hash,recovery:true}}
  const obj=await env.APP_MONITOR_DATA.get('_app-monitor/v1/_tokens/'+hash+'.json');
  return {ok:!!obj,hash,master:false,legacyDevice:!!obj};
}
function adminClientContext(request){
  const ua=String(request.headers.get('User-Agent')||'').slice(0,500),cf=request.cf||{};
  let browser='Unknown',browserVersion='',os='Unknown',device='Unknown';
  let m;
  if((m=ua.match(/CriOS\/([0-9.]+)/))) {browser='Chrome';browserVersion=m[1]}
  else if((m=ua.match(/FxiOS\/([0-9.]+)/))) {browser='Firefox';browserVersion=m[1]}
  else if((m=ua.match(/EdgiOS\/([0-9.]+)/))) {browser='Edge';browserVersion=m[1]}
  else if((m=ua.match(/Version\/([0-9.]+).*Safari\//))) {browser='Safari';browserVersion=m[1]}
  else if((m=ua.match(/Chrome\/([0-9.]+)/))) {browser='Chrome';browserVersion=m[1]}
  else if((m=ua.match(/Firefox\/([0-9.]+)/))) {browser='Firefox';browserVersion=m[1]}
  else if((m=ua.match(/Edg\/([0-9.]+)/))) {browser='Edge';browserVersion=m[1]}
  if(/iPhone/i.test(ua)){device='iPhone';m=ua.match(/OS ([0-9_]+)/);os='iOS'+(m?' '+m[1].replace(/_/g,'.'):'')}
  else if(/iPad/i.test(ua)){device='iPad';m=ua.match(/OS ([0-9_]+)/);os='iPadOS'+(m?' '+m[1].replace(/_/g,'.'):'')}
  else if(/Macintosh/i.test(ua)){device='Mac';m=ua.match(/Mac OS X ([0-9_]+)/);os='macOS'+(m?' '+m[1].replace(/_/g,'.'):'')}
  else if(/Android/i.test(ua)){device=/Mobile/i.test(ua)?'Android phone':'Android';m=ua.match(/Android ([0-9.]+)/);os='Android'+(m?' '+m[1]:'')}
  else if(/Windows/i.test(ua)){device='Windows PC';os='Windows'}
  return {device,browser,browserVersion,os,ua,ip:String(request.headers.get('CF-Connecting-IP')||request.headers.get('X-Forwarded-For')?.split(',')[0]?.trim()||'').slice(0,80),geo:{country:String(cf.country||''),region:String(cf.region||''),city:String(cf.city||''),colo:String(cf.colo||'')}};
}
async function issueAppMonitorSession(request,env,method='passkey',label='App Monitor',credentialHash=''){
  const token=randomSecret(32),hash=await sha256(token),now=Date.now(),context=adminClientContext(request),record={version:3,hash,method,label,credentialHash,createdAt:new Date(now).toISOString(),lastSeenAt:new Date(now).toISOString(),expiresAt:new Date(now+APP_MONITOR_SESSION_MS).toISOString(),createdContext:context,lastContext:context};
  await putJSON(env,APP_MONITOR_SECURITY+'sessions/'+hash+'.json',record);return {token,expiresAt:record.expiresAt,method};
}
async function appMonitorSession(request,env){
  const token=request.headers.get('X-App-Monitor-Session')||'';if(token.length<32)return {ok:false};
  const hash=await sha256(token),key=APP_MONITOR_SECURITY+'sessions/'+hash+'.json',record=await getJSON(env,key);if(!record)return {ok:false};
  if(Date.parse(record.expiresAt)<=Date.now()){await env.APP_MONITOR_DATA.delete(key);return {ok:false,expired:true}}
  const ctx=adminClientContext(request),hadCreated=!!record.createdContext,previous=JSON.stringify(record.lastContext||null);
  if(!record.createdContext)record.createdContext=ctx;record.lastContext=ctx;
  const stale=Date.now()-Date.parse(record.lastSeenAt||record.createdAt)>15*60*1000,contextChanged=!hadCreated||previous!==JSON.stringify(ctx);
  if(stale)record.lastSeenAt=new Date().toISOString();
  if(stale||contextChanged)await putJSON(env,key,record);
  return {ok:true,hash,record};
}
async function appMonitorAdmin(request,env){const s=await appMonitorSession(request,env);if(s.ok)return true;return (await appMonitorCredential(request,env)).ok}
async function appMonitorPasskeys(env){return listJSON(env,APP_MONITOR_SECURITY+'passkeys/')}
async function bootstrapProof(request,record){const secret=request.headers.get('X-App-Monitor-Bootstrap')||'';if(!record?.proofHash||secret.length<32)return false;return (await sha256(secret))===record.proofHash}
async function saveChallenge(env,kind,challenge,sessionHash=''){const id=randomSecret(18),record={version:2,id,kind,challenge,sessionHash,createdAt:new Date().toISOString()};await putJSON(env,APP_MONITOR_SECURITY+'challenges/'+id+'.json',record);return id}
async function takeChallenge(env,id,kind){const key=APP_MONITOR_SECURITY+'challenges/'+String(id||'')+'.json',x=await getJSON(env,key);if(!x||x.kind!==kind||Date.now()-Date.parse(x.createdAt)>APP_MONITOR_CHALLENGE_MS)return null;await env.APP_MONITOR_DATA.delete(key);return x}

async function appMonitorRoute(request,env,headers,url){
  if(!allowedOrigin(request,env))return new Response('Forbidden origin',{status:403,headers});
  headers={...headers,'Cache-Control':'no-store'};
  if(url.pathname==='/app-monitor/health')return Response.json({ok:true,service:'app-monitor',build:WORKER_BUILD,storage:'r2-session-snapshots',adminProtected:true},{headers});
  if(url.pathname==='/app-monitor/session'&&request.method==='POST'){
    const len=Number(request.headers.get('Content-Length')||0);if(len>64*1024)return new Response('Payload too large',{status:413,headers});
    let body;try{body=await request.json()}catch{return new Response('Invalid JSON',{status:400,headers})}
    if(body.version!==1||!validDate(body.date)||!validDevice(body.deviceId)||!validSession(body.sessionId)||!body.app)return new Response('Invalid session',{status:400,headers});
    const ip=request.headers.get('CF-Connecting-IP')||request.headers.get('X-Forwarded-For')?.split(',')[0]?.trim()||'';
    const cf=request.cf||{},observedAt=new Date().toISOString();
    const identity=body.identity&&typeof body.identity==='object'?{uid:String(body.identity.uid||'').slice(0,180),username:String(body.identity.username||'').slice(0,120),provider:String(body.identity.provider||'').slice(0,80),isAnonymous:typeof body.identity.isAnonymous==='boolean'?body.identity.isAnonymous:null,globalUid:String(body.identity.globalUid||'').slice(0,180),appUid:String(body.identity.appUid||'').slice(0,180),appProvider:String(body.identity.appProvider||'').slice(0,80),source:String(body.identity.source||'').slice(0,80)}:null;
    const device=body.device&&typeof body.device==='object'?body.device:null;
    const snapshot={version:1,date:body.date,app:String(body.app).slice(0,80),deviceId:body.deviceId,sessionId:body.sessionId,startedAt:String(body.startedAt||observedAt).slice(0,40),lastSeenAt:String(body.lastSeenAt||observedAt).slice(0,40),observedAt,activeMs:Math.max(0,Math.min(Number(body.activeMs)||0,24*60*60*1000)),pageViews:Math.max(1,Math.min(Number(body.pageViews)||1,10000)),path:String(body.path||'').slice(0,500),title:String(body.title||'').slice(0,200),referrer:String(body.referrer||'').slice(0,500),reason:String(body.reason||'').slice(0,40),identity,device,ip,ipHash:ip?await sha256(ip):'',geo:{country:String(cf.country||''),region:String(cf.region||''),city:String(cf.city||''),postalCode:String(cf.postalCode||''),timezone:String(cf.timezone||''),colo:String(cf.colo||''),asn:cf.asn||null}};
    const key='_app-monitor/v1/'+body.date+'/'+cleanKey(body.app)+'/'+body.sessionId+'.json';
    await env.APP_MONITOR_DATA.put(key,JSON.stringify(snapshot),{httpMetadata:{contentType:'application/json'}});
    return Response.json({ok:true,observedAt},{headers});
  }
  if(url.pathname==='/app-monitor/security/status'&&request.method==='GET'){
    const passkeys=await appMonitorPasskeys(env),recovery=await getJSON(env,APP_MONITOR_SECURITY+'recovery.json');
    return Response.json({ok:true,passkeyCount:passkeys.length,bootstrapNeeded:passkeys.length===0,recoveryConfigured:!!recovery,recoveryNeedsRotation:!!recovery?.migratedFromLegacy,sessionHours:APP_MONITOR_SESSION_MS/3600000},{headers});
  }
  if(url.pathname==='/app-monitor/bootstrap/request'&&request.method==='POST'){
    let stage='start';
    try{
      stage='parse-request';
      let body;try{body=await request.json()}catch{return new Response('Invalid JSON',{status:400,headers})}
      const secret=String(body.secret||'');if(secret.length<32||secret.length>220)return new Response('Invalid setup proof',{status:400,headers});
      if(url.searchParams.get('probe')==='1'){
        stage='probe';
        const id=randomSecret(12),key=APP_MONITOR_SECURITY+'probes/'+id+'.json';
        await putJSON(env,key,{version:1,proofHash:await sha256(secret),createdAt:new Date().toISOString()});
        await env.APP_MONITOR_DATA.delete(key);
        return Response.json({ok:true,probe:true},{headers});
      }
      stage='passkey-check';
      const passkeys=await appMonitorPasskeys(env);if(passkeys.length)return new Response('Bootstrap disabled',{status:409,headers});
      stage='read-current';
      const currentKey=APP_MONITOR_SECURITY+'bootstrap-current.json',current=await getJSON(env,currentKey);
      if(current&&!current.used&&Date.parse(current.expiresAt)>Date.now()){
        stage='read-approval';
        const approval=await getJSON(env,APP_MONITOR_SECURITY+'bootstrap-approvals/'+current.id+'.json');
        if(approval)return new Response('An approved setup request is already in progress',{status:409,headers});
        stage='clear-old-approval';
        await env.APP_MONITOR_DATA.delete(APP_MONITOR_SECURITY+'bootstrap-approvals/'+current.id+'.json');
      }
      stage='create-record';
      const id=randomSecret(18),now=Date.now(),record={version:2,id,proofHash:await sha256(secret),createdAt:new Date(now).toISOString(),expiresAt:new Date(now+APP_MONITOR_BOOTSTRAP_MS).toISOString(),used:false};
      stage='write-record';
      await putJSON(env,currentKey,record);
      return Response.json({ok:true,requestId:id,expiresAt:record.expiresAt},{headers});
    }catch(e){
      console.error('App Monitor bootstrap request failed',stage,e);
      return Response.json({ok:false,error:'bootstrap-request-failed'},{status:500,headers});
    }
  }
  if(url.pathname==='/app-monitor/bootstrap/status'&&request.method==='GET'){
    const passkeys=await appMonitorPasskeys(env);if(passkeys.length)return Response.json({ok:true,bootstrapNeeded:false,approved:false},{headers});
    const id=String(url.searchParams.get('requestId')||'');if(!/^[A-Za-z0-9_-]{12,80}$/.test(id))return new Response('Invalid request',{status:400,headers});
    const req=await getJSON(env,APP_MONITOR_SECURITY+'bootstrap-current.json');
    if(!req||req.id!==id||req.used||Date.parse(req.expiresAt)<=Date.now())return Response.json({ok:true,bootstrapNeeded:true,approved:false,expired:true},{headers});
    if(!await bootstrapProof(request,req))return new Response('Invalid setup proof',{status:401,headers});
    const approval=await getJSON(env,APP_MONITOR_SECURITY+'bootstrap-approvals/'+id+'.json');
    return Response.json({ok:true,bootstrapNeeded:true,approved:!!approval,expiresAt:req.expiresAt,approvedAt:approval?.approvedAt||null},{headers});
  }
  if(url.pathname==='/app-monitor/bootstrap/register/options'&&request.method==='POST'){
    const passkeys=await appMonitorPasskeys(env);if(passkeys.length)return new Response('Bootstrap disabled',{status:409,headers});
    let body;try{body=await request.json()}catch{return new Response('Invalid JSON',{status:400,headers})}
    const id=String(body.requestId||'');if(!/^[A-Za-z0-9_-]{12,80}$/.test(id))return new Response('Invalid request',{status:400,headers});
    const req=await getJSON(env,APP_MONITOR_SECURITY+'bootstrap-current.json'),approval=await getJSON(env,APP_MONITOR_SECURITY+'bootstrap-approvals/'+id+'.json');
    if(!req||req.id!==id||req.used||Date.parse(req.expiresAt)<=Date.now()||!approval||!await bootstrapProof(request,req))return new Response('Setup request not approved',{status:401,headers});
    const options=await generateRegistrationOptions({rpName:'Nirav App Monitor',rpID:APP_MONITOR_RP_ID,userName:'nirav',userDisplayName:'Nirav',userID:new TextEncoder().encode('app-monitor-admin'),attestationType:'none',supportedAlgorithmIDs:[-7,-257],authenticatorSelection:{residentKey:'required',userVerification:'required'}});
    const challengeId=await saveChallenge(env,'bootstrap-register',options.challenge,id);return Response.json({challengeId,options},{headers});
  }
  if(url.pathname==='/app-monitor/bootstrap/register/verify'&&request.method==='POST'){
    const passkeys=await appMonitorPasskeys(env);if(passkeys.length)return new Response('Bootstrap disabled',{status:409,headers});
    let body;try{body=await request.json()}catch{return new Response('Invalid JSON',{status:400,headers})}
    const id=String(body.requestId||''),challenge=await takeChallenge(env,body.challengeId,'bootstrap-register');
    if(!challenge||challenge.sessionHash!==id)return new Response('Challenge expired',{status:401,headers});
    const req=await getJSON(env,APP_MONITOR_SECURITY+'bootstrap-current.json'),approval=await getJSON(env,APP_MONITOR_SECURITY+'bootstrap-approvals/'+id+'.json');
    if(!req||req.id!==id||req.used||Date.parse(req.expiresAt)<=Date.now()||!approval||!await bootstrapProof(request,req))return new Response('Setup request not approved',{status:401,headers});
    try{
      const verification=await verifyRegistrationResponse({response:body.response,expectedChallenge:challenge.challenge,expectedOrigin:APP_MONITOR_ORIGIN,expectedRPID:APP_MONITOR_RP_ID,requireUserVerification:true,supportedAlgorithmIDs:[-7,-257]});
      if(!verification.verified||!verification.registrationInfo)return new Response('Passkey not verified',{status:400,headers});
      const info=verification.registrationInfo,credential=info.credential,record={version:2,id:credential.id,publicKey:b64uBytes(credential.publicKey),counter:credential.counter,transports:credential.transports||body.response?.response?.transports||[],deviceType:info.credentialDeviceType,backedUp:info.credentialBackedUp,label:String(body.label||'First passkey').slice(0,120),createdAt:new Date().toISOString(),lastUsedAt:null};
      await putJSON(env,APP_MONITOR_SECURITY+'passkeys/'+await sha256(record.id)+'.json',record);
      req.used=true;req.usedAt=new Date().toISOString();await putJSON(env,APP_MONITOR_SECURITY+'bootstrap-current.json',req);
      await env.APP_MONITOR_DATA.delete(APP_MONITOR_SECURITY+'bootstrap-approvals/'+id+'.json');
      await env.APP_MONITOR_DATA.delete(APP_MONITOR_SECURITY+'recovery.json');
      const session=await issueAppMonitorSession(request,env,'passkey',record.label||'First passkey',await sha256(record.id));
      return Response.json({ok:true,...session,passkey:{label:record.label,deviceType:record.deviceType,backedUp:record.backedUp,createdAt:record.createdAt},recoveryInvalidated:true},{headers});
    }catch(e){return new Response('Passkey registration failed: '+String(e?.message||e),{status:400,headers})}
  }
  if(url.pathname==='/app-monitor/auth/recovery'&&request.method==='POST'){
    let body;try{body=await request.json()}catch{return new Response('Invalid JSON',{status:400,headers})}
    const token=String(body.token||''),auth=await appMonitorCredential(new Request(request.url,{headers:{'X-App-Monitor-Key':token}}),env);
    if(!auth.ok)return new Response('Unauthorized',{status:401,headers});
    const session=await issueAppMonitorSession(request,env,'recovery','Recovery sign-in');return Response.json({ok:true,...session,migrated:!!auth.migrated,legacyDevice:!!auth.legacyDevice},{headers});
  }
  if(url.pathname==='/app-monitor/auth/session'&&request.method==='GET'){
    const session=await appMonitorSession(request,env);if(!session.ok)return new Response('Unauthorized',{status:401,headers});
    return Response.json({ok:true,expiresAt:session.record.expiresAt,method:session.record.method,label:session.record.label},{headers});
  }
  if(url.pathname==='/app-monitor/auth/logout'&&request.method==='POST'){
    const session=await appMonitorSession(request,env);if(session.ok)await env.APP_MONITOR_DATA.delete(APP_MONITOR_SECURITY+'sessions/'+session.hash+'.json');
    return Response.json({ok:true},{headers});
  }
  if(url.pathname==='/app-monitor/auth/passkey/options'&&request.method==='POST'){
    const passkeys=await appMonitorPasskeys(env);if(!passkeys.length)return new Response('No passkeys registered',{status:404,headers});
    const options=await generateAuthenticationOptions({rpID:APP_MONITOR_RP_ID,userVerification:'required',allowCredentials:passkeys.map(p=>({id:p.id,transports:p.transports||[]}))});
    const challengeId=await saveChallenge(env,'authenticate',options.challenge);return Response.json({challengeId,options},{headers});
  }
  if(url.pathname==='/app-monitor/auth/passkey/verify'&&request.method==='POST'){
    let body;try{body=await request.json()}catch{return new Response('Invalid JSON',{status:400,headers})}
    const challenge=await takeChallenge(env,body.challengeId,'authenticate');if(!challenge)return new Response('Challenge expired',{status:401,headers});
    const passkey=(await appMonitorPasskeys(env)).find(p=>p.id===body.response?.id);if(!passkey)return new Response('Unknown passkey',{status:401,headers});
    try{
      const verification=await verifyAuthenticationResponse({response:body.response,expectedChallenge:challenge.challenge,expectedOrigin:APP_MONITOR_ORIGIN,expectedRPID:APP_MONITOR_RP_ID,requireUserVerification:true,credential:{id:passkey.id,publicKey:bytesB64u(passkey.publicKey),counter:Number(passkey.counter)||0,transports:passkey.transports||[]}});
      if(!verification.verified)return new Response('Passkey not verified',{status:401,headers});
      passkey.counter=verification.authenticationInfo.newCounter;passkey.lastUsedAt=new Date().toISOString();await putJSON(env,APP_MONITOR_SECURITY+'passkeys/'+await sha256(passkey.id)+'.json',passkey);
      const session=await issueAppMonitorSession(request,env,'passkey',passkey.label||'Passkey',await sha256(passkey.id));return Response.json({ok:true,...session},{headers});
    }catch(e){return new Response('Passkey verification failed',{status:401,headers})}
  }
  if(url.pathname==='/app-monitor/passkeys/register/options'&&request.method==='POST'){
    const session=await appMonitorSession(request,env);if(!session.ok)return new Response('Unauthorized',{status:401,headers});
    const passkeys=await appMonitorPasskeys(env),options=await generateRegistrationOptions({rpName:'Nirav App Monitor',rpID:APP_MONITOR_RP_ID,userName:'nirav',userDisplayName:'Nirav',userID:new TextEncoder().encode('app-monitor-admin'),attestationType:'none',supportedAlgorithmIDs:[-7,-257],excludeCredentials:passkeys.map(p=>({id:p.id,transports:p.transports||[]})),authenticatorSelection:{residentKey:'required',userVerification:'required'}});
    const challengeId=await saveChallenge(env,'register',options.challenge,session.hash);return Response.json({challengeId,options},{headers});
  }
  if(url.pathname==='/app-monitor/passkeys/register/verify'&&request.method==='POST'){
    const session=await appMonitorSession(request,env);if(!session.ok)return new Response('Unauthorized',{status:401,headers});
    let body;try{body=await request.json()}catch{return new Response('Invalid JSON',{status:400,headers})}
    const challenge=await takeChallenge(env,body.challengeId,'register');if(!challenge||challenge.sessionHash!==session.hash)return new Response('Challenge expired',{status:401,headers});
    try{
      const verification=await verifyRegistrationResponse({response:body.response,expectedChallenge:challenge.challenge,expectedOrigin:APP_MONITOR_ORIGIN,expectedRPID:APP_MONITOR_RP_ID,requireUserVerification:true,supportedAlgorithmIDs:[-7,-257]});
      if(!verification.verified||!verification.registrationInfo)return new Response('Passkey not verified',{status:400,headers});
      const info=verification.registrationInfo,credential=info.credential,record={version:2,id:credential.id,publicKey:b64uBytes(credential.publicKey),counter:credential.counter,transports:credential.transports||body.response?.response?.transports||[],deviceType:info.credentialDeviceType,backedUp:info.credentialBackedUp,label:String(body.label||'Passkey').slice(0,120),createdAt:new Date().toISOString(),lastUsedAt:null};
      await putJSON(env,APP_MONITOR_SECURITY+'passkeys/'+await sha256(record.id)+'.json',record);return Response.json({ok:true,passkey:{label:record.label,deviceType:record.deviceType,backedUp:record.backedUp,createdAt:record.createdAt}},{headers});
    }catch(e){return new Response('Passkey registration failed: '+String(e?.message||e),{status:400,headers})}
  }
  if(url.pathname==='/app-monitor/security/info'&&request.method==='GET'){
    const session=await appMonitorSession(request,env);if(!session.ok)return new Response('Unauthorized',{status:401,headers});
    const passkeysRaw=await appMonitorPasskeys(env),passkeys=[];
    for(const p of passkeysRaw){const handle=await sha256(p.id);passkeys.push({handle,label:p.label||'Passkey',deviceType:p.deviceType,backedUp:p.backedUp,createdAt:p.createdAt,lastUsedAt:p.lastUsedAt})}
    const sessions=(await listJSON(env,APP_MONITOR_SECURITY+'sessions/')).filter(s=>Date.parse(s.expiresAt)>Date.now()).map(s=>({hash:s.hash,label:s.label,method:s.method,credentialHash:s.credentialHash||'',createdAt:s.createdAt,lastSeenAt:s.lastSeenAt,expiresAt:s.expiresAt,current:s.hash===session.hash,createdContext:s.createdContext||null,lastContext:s.lastContext||null}));
    const recovery=await getJSON(env,APP_MONITOR_SECURITY+'recovery.json');return Response.json({ok:true,passkeys,sessions,recovery:{configured:!!recovery,needsRotation:!!recovery?.migratedFromLegacy,updatedAt:recovery?.updatedAt||recovery?.createdAt||null}},{headers});
  }
  if(url.pathname==='/app-monitor/security/recovery'&&request.method==='POST'){
    const session=await appMonitorSession(request,env);if(!session.ok)return new Response('Unauthorized',{status:401,headers});
    let body;try{body=await request.json()}catch{return new Response('Invalid JSON',{status:400,headers})}
    const token=String(body.token||'');if(token.length<32||token.length>220)return new Response('Recovery token must be 32-220 characters',{status:400,headers});
    await putJSON(env,APP_MONITOR_SECURITY+'recovery.json',{version:2,hash:await sha256(token),updatedAt:new Date().toISOString(),migratedFromLegacy:false});return Response.json({ok:true},{headers});
  }
  if(url.pathname==='/app-monitor/security/rename-passkey'&&request.method==='POST'){
    const session=await appMonitorSession(request,env);if(!session.ok)return new Response('Unauthorized',{status:401,headers});
    let body;try{body=await request.json()}catch{return new Response('Invalid JSON',{status:400,headers})}
    const handle=String(body.handle||''),label=String(body.label||'').trim().slice(0,120);
    if(!/^[a-f0-9]{64}$/.test(handle))return new Response('Invalid passkey',{status:400,headers});
    if(!label)return new Response('Passkey name is required',{status:400,headers});
    const key=APP_MONITOR_SECURITY+'passkeys/'+handle+'.json',passkey=await getJSON(env,key);
    if(!passkey)return new Response('Passkey not found',{status:404,headers});
    const oldLabel=passkey.label||'Passkey';passkey.label=label;passkey.renamedAt=new Date().toISOString();await putJSON(env,key,passkey);
    const sessions=await listJSON(env,APP_MONITOR_SECURITY+'sessions/');let sessionsUpdated=0;
    for(const s of sessions){
      if(!s.hash)continue;
      if(s.credentialHash===handle||(!s.credentialHash&&s.method==='passkey'&&s.label===oldLabel)){
        s.label=label;await putJSON(env,APP_MONITOR_SECURITY+'sessions/'+s.hash+'.json',s);sessionsUpdated++;
      }
    }
    return Response.json({ok:true,label,sessionsUpdated},{headers});
  }
  if(url.pathname==='/app-monitor/security/revoke-passkey'&&request.method==='POST'){
    const session=await appMonitorSession(request,env);if(!session.ok)return new Response('Unauthorized',{status:401,headers});
    let body;try{body=await request.json()}catch{return new Response('Invalid JSON',{status:400,headers})}
    const handle=String(body.handle||'');if(!/^[a-f0-9]{64}$/.test(handle))return new Response('Missing passkey',{status:400,headers});
    const passkey=await getJSON(env,APP_MONITOR_SECURITY+'passkeys/'+handle+'.json');if(!passkey)return new Response('Passkey not found',{status:404,headers});
    await env.APP_MONITOR_DATA.delete(APP_MONITOR_SECURITY+'passkeys/'+handle+'.json');
    const sessions=await listJSON(env,APP_MONITOR_SECURITY+'sessions/');let sessionsRevoked=0;
    for(const s of sessions){if(s.hash&&s.method==='passkey'&&(s.credentialHash===handle||(!s.credentialHash&&s.label===passkey.label))){await env.APP_MONITOR_DATA.delete(APP_MONITOR_SECURITY+'sessions/'+s.hash+'.json');sessionsRevoked++}}
    return Response.json({ok:true,sessionsRevoked},{headers});
  }
  if(url.pathname==='/app-monitor/security/revoke-all-sessions'&&request.method==='POST'){
    const session=await appMonitorSession(request,env);if(!session.ok)return new Response('Unauthorized',{status:401,headers});
    const sessions=await listJSON(env,APP_MONITOR_SECURITY+'sessions/');let revoked=0;
    for(const s of sessions){if(s.hash&&/^[a-f0-9]{64}$/.test(s.hash)){await env.APP_MONITOR_DATA.delete(APP_MONITOR_SECURITY+'sessions/'+s.hash+'.json');revoked++}}
    return Response.json({ok:true,revoked},{headers});
  }
  if(url.pathname==='/app-monitor/security/revoke-session'&&request.method==='POST'){
    const session=await appMonitorSession(request,env);if(!session.ok)return new Response('Unauthorized',{status:401,headers});
    let body;try{body=await request.json()}catch{return new Response('Invalid JSON',{status:400,headers})}
    const hash=String(body.hash||'');if(!/^[a-f0-9]{64}$/.test(hash))return new Response('Invalid session',{status:400,headers});
    await env.APP_MONITOR_DATA.delete(APP_MONITOR_SECURITY+'sessions/'+hash+'.json');return Response.json({ok:true,current:hash===session.hash},{headers});
  }
  if(url.pathname==='/app-monitor/token'&&request.method==='POST'){
    const auth=await appMonitorCredential(request,env);if(!auth.ok)return new Response('Unauthorized',{status:401,headers});
    const len=Number(request.headers.get('Content-Length')||0);if(len>16*1024)return new Response('Payload too large',{status:413,headers});
    let body;try{body=await request.json()}catch{return new Response('Invalid JSON',{status:400,headers})}
    const token=String(body.token||''),label=String(body.label||'App Monitor device').trim().slice(0,120);
    if(token.length<32||token.length>220)return new Response('Token must be 32-220 characters',{status:400,headers});
    const hash=await sha256(token),record={version:1,hash,label,createdAt:new Date().toISOString(),createdByMaster:auth.master===true};
    await env.APP_MONITOR_DATA.put('_app-monitor/v1/_tokens/'+hash+'.json',JSON.stringify(record),{httpMetadata:{contentType:'application/json'}});
    if(body.replaceCurrent===true&&!auth.master&&auth.hash!==hash)await env.APP_MONITOR_DATA.delete('_app-monitor/v1/_tokens/'+auth.hash+'.json');
    return Response.json({ok:true,label,replaced:body.replaceCurrent===true&&!auth.master},{headers});
  }
  if(url.pathname==='/app-monitor/token'&&request.method==='DELETE'){
    const auth=await appMonitorCredential(request,env);if(!auth.ok)return new Response('Unauthorized',{status:401,headers});
    if(auth.master)return new Response('Master recovery token cannot be revoked here',{status:400,headers});
    await env.APP_MONITOR_DATA.delete('_app-monitor/v1/_tokens/'+auth.hash+'.json');
    return Response.json({ok:true,revoked:true},{headers});
  }
  if(url.pathname==='/app-monitor/aliases'&&request.method==='GET'){
    if(!(await appMonitorAdmin(request,env)))return new Response('Unauthorized',{status:401,headers});
    const prefix='_app-monitor/v1/_aliases/';let cursor,objects=[],truncated=true;
    while(truncated&&objects.length<5000){const page=await env.APP_MONITOR_DATA.list({prefix,cursor,limit:1000});objects.push(...page.objects);truncated=page.truncated;cursor=page.cursor}
    const aliases=[];for(const item of objects){const obj=await env.APP_MONITOR_DATA.get(item.key);if(!obj)continue;try{aliases.push(JSON.parse(await obj.text()))}catch{}}
    return Response.json({version:1,aliases,generatedAt:new Date().toISOString()},{headers});
  }
  if(url.pathname==='/app-monitor/alias'&&request.method==='POST'){
    if(!(await appMonitorAdmin(request,env)))return new Response('Unauthorized',{status:401,headers});
    const len=Number(request.headers.get('Content-Length')||0);if(len>16*1024)return new Response('Payload too large',{status:413,headers});
    let body;try{body=await request.json()}catch{return new Response('Invalid JSON',{status:400,headers})}
    const type=String(body.type||''),id=String(body.id||'').trim(),person=String(body.person||'').trim().slice(0,120);
    if(!['device','auth','session'].includes(type)||!id||id.length>220)return new Response('Invalid alias',{status:400,headers});
    const key='_app-monitor/v1/_aliases/'+type+'/'+await sha256(id)+'.json';
    if(!person){await env.APP_MONITOR_DATA.delete(key);return Response.json({ok:true,removed:true,type,id},{headers})}
    const alias={version:1,type,id,person,updatedAt:new Date().toISOString()};
    await env.APP_MONITOR_DATA.put(key,JSON.stringify(alias),{httpMetadata:{contentType:'application/json'}});
    return Response.json({ok:true,alias},{headers});
  }
  if(url.pathname==='/app-monitor/day'&&request.method==='GET'){
    if(!(await appMonitorAdmin(request,env)))return new Response('Unauthorized',{status:401,headers});
    const date=url.searchParams.get('date');if(!validDate(date))return new Response('Invalid date',{status:400,headers});
    const prefix='_app-monitor/v1/'+date+'/';let cursor,objects=[],truncated=true;
    while(truncated&&objects.length<5000){const page=await env.APP_MONITOR_DATA.list({prefix,cursor,limit:1000});objects.push(...page.objects);truncated=page.truncated;cursor=page.cursor}
    const sessions=[];for(const item of objects){const obj=await env.APP_MONITOR_DATA.get(item.key);if(!obj)continue;try{sessions.push(JSON.parse(await obj.text()))}catch{}}
    return Response.json({version:1,date,sessionCount:sessions.length,sessions,generatedAt:new Date().toISOString(),truncated:truncated||objects.length>=5000},{headers});
  }
  return new Response('Not found',{status:404,headers});
}
export default {
 async fetch(request,env){
  const origin=request.headers.get('Origin')||'',headers=cors(origin,env.ALLOWED_ORIGIN||'https://nirav2000.github.io');
  if(request.method==='OPTIONS')return new Response(null,{status:204,headers});
  const url=new URL(request.url);
  if(url.pathname==='/health')return Response.json({ok:true,service:'apps-monitor-api',build:WORKER_BUILD,r2Bound:!!env.APP_MONITOR_DATA,legacyBound:!!env.LEGACY_SNAG_MEDIA},{headers});
  if(url.pathname==='/migration/copy'&&request.method==='POST'){
    const supplied=request.headers.get('X-Migration-Token')||'';
    if(!env.MIGRATION_TOKEN||supplied!==env.MIGRATION_TOKEN)return new Response('Unauthorized',{status:401,headers});
    const prefix='_app-monitor/';let cursor,truncated=true,source=0,copied=0,failed=0;
    while(truncated){
      const page=await env.LEGACY_SNAG_MEDIA.list({prefix,cursor,limit:1000});
      source+=page.objects.length;
      for(const item of page.objects){
        try{
          const obj=await env.LEGACY_SNAG_MEDIA.get(item.key);if(!obj){failed++;continue}
          const h={};obj.writeHttpMetadata?.(new Headers(h));
          await env.APP_MONITOR_DATA.put(item.key,obj.body,{httpMetadata:obj.httpMetadata||undefined,customMetadata:obj.customMetadata||undefined});
          copied++;
        }catch(e){failed++;console.error('migration copy failed',item.key,e)}
      }
      truncated=page.truncated;cursor=page.cursor;
    }
    await putJSON(env,'_app-monitor/v2/migration.json',{version:1,sourceBucket:'snag-media',copiedAt:new Date().toISOString(),source,copied,failed});
    return Response.json({ok:failed===0,source,copied,failed},{headers});
  }
  if(url.pathname==='/migration/status'&&request.method==='GET'){
    const supplied=request.headers.get('X-Migration-Token')||'';
    if(!env.MIGRATION_TOKEN||supplied!==env.MIGRATION_TOKEN)return new Response('Unauthorized',{status:401,headers});
    const count=async bucket=>{let cursor,truncated=true,n=0;while(truncated){const p=await bucket.list({prefix:'_app-monitor/',cursor,limit:1000});n+=p.objects.length;truncated=p.truncated;cursor=p.cursor}return n};
    const [legacy,dedicated]=await Promise.all([count(env.LEGACY_SNAG_MEDIA),count(env.APP_MONITOR_DATA)]);
    const passkeys=await appMonitorPasskeys(env),recovery=await getJSON(env,APP_MONITOR_SECURITY+'recovery.json');
    return Response.json({ok:true,legacy,dedicated,passkeyCount:passkeys.length,recoveryConfigured:!!recovery},{headers});
  }
  if(url.pathname.startsWith('/app-monitor/'))return appMonitorRoute(request,env,headers,url);
  return new Response('Not found',{status:404,headers});
 }
};
