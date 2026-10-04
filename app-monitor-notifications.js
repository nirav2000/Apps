import { createR2NotificationService } from './notifications/v1/r2-transport.js';

const APP='app-monitor';
const SCOPE='admin';
const ADMIN_USER='app-monitor-admin';
const EVENT_TYPES=['security.new_human','system.test'];
const SETTINGS_KEY='_app-monitor/v2/notification-adapter/settings.json';
const SEEN_PREFIX='_app-monitor/v2/notification-adapter/seen/';

const DEFAULT_POLICY={
  policyOwnerId:ADMIN_USER,
  costBearerId:ADMIN_USER,
  allowedChannels:{in_app:true,web_push:true,email:true,telegram:true,whatsapp:true,signal:true,slack:true,discord:true,sms:true,ios_push:true},
  allowedEvents:{'security.new_human':true,'system.test':true},
  mandatoryEvents:{}
};

async function sha256(value){
  const bytes=new TextEncoder().encode(String(value||''));
  const digest=await crypto.subtle.digest('SHA-256',bytes);
  return [...new Uint8Array(digest)].map(x=>x.toString(16).padStart(2,'0')).join('');
}
async function getJSON(env,key){
  const object=await env.APP_MONITOR_DATA.get(key);
  if(!object)return null;
  try{return JSON.parse(await object.text())}catch{return null}
}
async function putJSON(env,key,value){
  await env.APP_MONITOR_DATA.put(key,JSON.stringify(value),{httpMetadata:{contentType:'application/json'}});
}
async function listJSON(env,prefix,limit=500){
  const page=await env.APP_MONITOR_DATA.list({prefix,limit:Math.min(1000,limit)});
  const out=[];
  for(const item of page.objects){
    const value=await getJSON(env,item.key);
    if(value)out.push(value);
  }
  return out;
}

function service(env){
  return createR2NotificationService({
    bucket:env.APP_MONITOR_DATA,
    prefix:'_app-monitor/v2/notifications/',
    app:APP,
    eventTypes:EVENT_TYPES,
    defaultPolicy:DEFAULT_POLICY,
    resolveMember:async userId=>String(userId)===ADMIN_USER?{userId:ADMIN_USER,role:'owner'}:null
  });
}
function defaultSettings(){
  return {version:1,enabled:false,ownerPeople:[],ownerAuthIds:[],ownerDeviceIds:[],updatedAt:null};
}
async function settings(env){
  return {...defaultSettings(),...(await getJSON(env,SETTINGS_KEY)||{})};
}
async function availablePeople(env){
  const aliases=await listJSON(env,'_app-monitor/v1/_aliases/',1000);
  return [...new Set(aliases.map(x=>String(x?.person||'').trim()).filter(Boolean))].sort((a,b)=>a.localeCompare(b));
}
function authIds(snapshot){
  const identity=snapshot?.identity||{};
  return [...new Set([identity.globalUid,identity.appUid,identity.uid].filter(Boolean).map(String))];
}
async function aliasPerson(env,type,id){
  if(!id)return '';
  const value=await getJSON(env,'_app-monitor/v1/_aliases/'+type+'/'+await sha256(id)+'.json');
  return String(value?.person||'');
}
async function personForSnapshot(env,snapshot){
  for(const id of authIds(snapshot)){
    const person=await aliasPerson(env,'auth',id);
    if(person)return person;
  }
  return await aliasPerson(env,'device',snapshot?.deviceId);
}
function humanSnapshot(snapshot){
  return String(snapshot?.traffic?.class||'')==='browser-session';
}
function identityKey(snapshot){
  const ids=authIds(snapshot);
  return ids.length?'auth:'+ids[0]:(snapshot?.deviceId?'device:'+snapshot.deviceId:'');
}
function summary(snapshot,person){
  const identity=snapshot.identity||{},device=snapshot.device||{},geo=snapshot.geo||{};
  const who=person||identity.username||'New human visitor';
  const context=[snapshot.app,device.kind||device.label,device.browser,[geo.city,geo.country].filter(Boolean).join(', ')].filter(Boolean);
  return {title:'New human visitor · '+String(snapshot.app||'App'),body:who+(context.length?' · '+context.join(' · '):'')};
}

export async function observeAppMonitorSession(env,snapshot){
  if(!humanSnapshot(snapshot))return {newIdentity:false,notified:false};
  const key=identityKey(snapshot);
  if(!key)return {newIdentity:false,notified:false};

  const fingerprint=await sha256(String(snapshot.app||'')+'|'+key);
  const seenKey=SEEN_PREFIX+fingerprint+'.json';
  if(await getJSON(env,seenKey))return {newIdentity:false,notified:false};

  const person=await personForSnapshot(env,snapshot);
  const now=new Date().toISOString();
  await putJSON(env,seenKey,{
    version:1,fingerprint,app:String(snapshot.app||''),identityKey:key,deviceId:String(snapshot.deviceId||''),
    authIds:authIds(snapshot),person,firstSeenAt:now
  });

  const config=await settings(env);
  if(!config.enabled)return {newIdentity:true,notified:false,reason:'alerts-disabled'};
  if(person&&(config.ownerPeople||[]).includes(person))return {newIdentity:true,notified:false,reason:'owner-person'};
  if((config.ownerDeviceIds||[]).includes(snapshot.deviceId))return {newIdentity:true,notified:false,reason:'owner-device'};
  if(authIds(snapshot).some(id=>(config.ownerAuthIds||[]).includes(id)))return {newIdentity:true,notified:false,reason:'owner-auth'};

  const text=summary(snapshot,person);
  const result=await service(env).emit({
    version:1,
    id:'new-human-'+fingerprint,
    type:'security.new_human',
    app:APP,
    scopeId:SCOPE,
    audience:'admin',
    actorId:key,
    recipients:[ADMIN_USER],
    title:text.title,
    body:text.body,
    url:'https://nirav2000.github.io/Apps/app-monitor.html',
    priority:'high',
    data:{app:snapshot.app,sessionId:snapshot.sessionId,deviceId:snapshot.deviceId,person,geo:snapshot.geo||{},device:snapshot.device||{}},
    createdAt:now
  },env);
  return {newIdentity:true,notified:true,result};
}

export async function handleAppMonitorNotificationRoute(request,env,headers,url){
  const svc=service(env);
  const suffix=url.pathname.replace(/^\/app-monitor\/notifications/,'')||'/';

  if(suffix==='/state'&&request.method==='GET'){
    const [policy,preferences,inbox,deliveryLog,readiness,config,people]=await Promise.all([
      svc.policy(SCOPE),
      svc.preferences(SCOPE,ADMIN_USER),
      svc.inbox(SCOPE,ADMIN_USER,{limit:80}),
      svc.deliveryLog(SCOPE,{limit:80}),
      svc.readiness(SCOPE,env),
      settings(env),
      availablePeople(env)
    ]);
    return Response.json({
      ok:true,app:APP,scopeId:SCOPE,userId:ADMIN_USER,role:'owner',
      eventTypes:[{id:'security.new_human',label:'New human visitor'}],
      policy,preferences,inbox,deliveryLog,readiness,
      unread:inbox.filter(x=>x.read!==true).length,
      settings:config,availablePeople:people,
      publicConfig:readiness.publicConfig||{}
    },{headers});
  }

  if(suffix==='/preferences'&&request.method==='POST'){
    let body;try{body=await request.json()}catch{return new Response('Invalid JSON',{status:400,headers})}
    const preferences=await svc.savePreferences(SCOPE,ADMIN_USER,body.preferences||{});
    return Response.json({ok:true,preferences},{headers});
  }

  if(suffix==='/settings'&&request.method==='POST'){
    let body;try{body=await request.json()}catch{return new Response('Invalid JSON',{status:400,headers})}
    const current=await settings(env);
    const ownerPeople=Array.isArray(body.ownerPeople)?body.ownerPeople.map(x=>String(x).trim().slice(0,120)).filter(Boolean).slice(0,30):current.ownerPeople;
    const enabled=body.enabled===true;
    if(enabled&&!ownerPeople.length&&!current.ownerAuthIds?.length&&!current.ownerDeviceIds?.length){
      return Response.json({ok:false,error:'owner-identity-required'},{status:400,headers});
    }
    const next={...current,enabled,ownerPeople,updatedAt:new Date().toISOString()};
    await putJSON(env,SETTINGS_KEY,next);
    return Response.json({ok:true,settings:next},{headers});
  }

  if(suffix==='/read'&&request.method==='POST'){
    let body;try{body=await request.json()}catch{return new Response('Invalid JSON',{status:400,headers})}
    const item=await svc.markRead(SCOPE,ADMIN_USER,String(body.id||''));
    return item?Response.json({ok:true,item},{headers}):new Response('Not found',{status:404,headers});
  }

  if(suffix==='/test'&&request.method==='POST'){
    const now=new Date().toISOString();
    const result=await svc.emit({
      version:1,id:'test-'+crypto.randomUUID(),type:'system.test',app:APP,scopeId:SCOPE,audience:'admin',
      actorId:ADMIN_USER,recipients:[ADMIN_USER],title:'App Monitor notifications are working',
      body:'This test passed through the shared Notifications service and the App Monitor R2 inbox.',
      url:'https://nirav2000.github.io/Apps/app-monitor.html',priority:'normal',data:{test:true},createdAt:now
    },env);
    return Response.json({ok:true,result},{headers});
  }

  return new Response('Not found',{status:404,headers});
}
