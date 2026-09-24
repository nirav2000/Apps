(function(){
'use strict';if(window.AppMonitor||window.APP_MONITOR_DISABLED)return;
const CLOUD='https://apps-monitor-api.nirav2000-github.workers.dev/app-monitor',DEVICE_KEY='app-monitor.v1.device',CANONICAL_DEVICE_KEY='apps-platform.v1.device';
const pad=n=>String(n).padStart(2,'0'),date=()=>{const d=new Date();return d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate())};
const clean=(v,n=160)=>String(v??'').trim().slice(0,n),makeId=p=>p+(crypto.randomUUID?.()||Date.now().toString(36)+'-'+Math.random().toString(36).slice(2));
const app=clean(window.APP_MONITOR_APP||((location.hostname==='nirav2000.github.io'?(location.pathname.split('/').filter(Boolean)[0]||'root'):location.hostname)||'unknown'),80);
const sessionKey='app-monitor.v1.session.'+app.toLowerCase().replace(/[^a-z0-9._-]/g,'-');
const validDevice=x=>/^[A-Za-z0-9._-]{8,100}$/.test(x||'');
const deviceId=()=>{
 let x='';
 try{x=window.AppsAuth?.deviceId?.()||localStorage.getItem(CANONICAL_DEVICE_KEY)||localStorage.getItem(DEVICE_KEY)||''}catch{}
 if(!validDevice(x))x=makeId('d-').replace(/[^A-Za-z0-9._-]/g,'');
 try{localStorage.setItem(CANONICAL_DEVICE_KEY,x);localStorage.setItem(DEVICE_KEY,x)}catch{}
 return x;
};
const sessionId=()=>{let x=sessionStorage.getItem(sessionKey);if(!x){x=makeId('s-').replace(/[^A-Za-z0-9._-]/g,'');sessionStorage.setItem(sessionKey,x)}return x};
function device(){
 const ua=navigator.userAgent||'',touch=navigator.maxTouchPoints||0;let kind='Browser';
 if(/iPhone/i.test(ua))kind='iPhone';else if(/iPad/i.test(ua)||(/Macintosh/i.test(ua)&&touch>1))kind='iPad';else if(/Android/i.test(ua))kind='Android';else if(/Windows/i.test(ua))kind='Windows';else if(/Macintosh|Mac OS X/i.test(ua))kind='Mac';else if(/Linux/i.test(ua))kind='Linux';
 let browser='Browser';if(/EdgiOS|Edg\//i.test(ua))browser='Edge';else if(/CriOS|Chrome/i.test(ua))browser='Chrome';else if(/FxiOS|Firefox/i.test(ua))browser='Firefox';else if(/Safari/i.test(ua))browser='Safari';
 let os='';if(/iPhone|iPad/i.test(ua)||(/Macintosh/i.test(ua)&&touch>1))os='iOS/iPadOS';else if(/Android/i.test(ua))os='Android';else if(/Windows NT/i.test(ua))os='Windows';else if(/Mac OS X|Macintosh/i.test(ua))os='macOS';else if(/Linux/i.test(ua))os='Linux';
 const label=clean(window.AppsAuth?.deviceLabel?.()||'',80);
 return{kind,browser,os,label,touchPoints:touch,screen:(screen?.width||0)+'x'+(screen?.height||0),viewport:innerWidth+'x'+innerHeight,pixelRatio:devicePixelRatio||1,language:navigator.language||'',timezone:Intl.DateTimeFormat().resolvedOptions().timeZone||''};
}
function norm(u){
 if(!u)return null;
 const uid=clean(u.uid||u.userId||u.id,180),username=clean(u.username||u.displayName||u.name,120),provider=clean(u.provider||u.providerId||(u.providerData&&u.providerData[0]?.providerId),80),isAnonymous=typeof u.isAnonymous==='boolean'?u.isAnonymous:undefined;
 const globalUid=clean(u.globalUid,180),appUid=clean(u.appUid,180),appProvider=clean(u.appProvider,80),source=clean(u.source,80);
 if(!uid&&!username&&!provider&&!globalUid&&!appUid&&isAnonymous===undefined)return null;
 return{uid,username,provider,isAnonymous,globalUid,appUid,appProvider,source};
}
function autoIdentity(){
 const a=[window.APP_MONITOR_IDENTITY,window.AppsAuth?.effectiveIdentity?.(),window.currentUser,window.auth?.currentUser,window.firebaseAuth?.currentUser];
 try{if(window.firebase?.auth)a.push(window.firebase.auth().currentUser)}catch{}
 for(const x of a){const n=norm(x);if(n)return n}return null
}
const startedAt=new Date().toISOString();let activeMs=0,lastTick=Date.now(),pageViews=1,lastPath=location.pathname+location.search,lastTitle=document.title||'',timer=null,pending=false,manual=null;
function tick(){const now=Date.now();if(document.visibilityState!=='hidden')activeMs+=Math.max(0,now-lastTick);lastTick=now}
function snap(){tick();const who={...(autoIdentity()||{}),...(manual||{})};return{version:1,date:date(),app,deviceId:deviceId(),sessionId:sessionId(),startedAt,lastSeenAt:new Date().toISOString(),activeMs:Math.round(activeMs),pageViews,path:clean(lastPath,500),title:clean(lastTitle,200),referrer:clean(document.referrer,500),device:device(),identity:Object.keys(who).length?who:null}}
async function send(reason='heartbeat',force=false){if(pending&&!force)return{ok:false,skipped:'pending'};pending=true;const body=snap();body.reason=reason;const c=new AbortController(),t=setTimeout(()=>c.abort(),8000);try{const r=await fetch(CLOUD+'/session',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),keepalive:true,cache:'no-store',signal:c.signal});if(!r.ok)throw new Error('App monitor '+r.status);dispatchEvent(new CustomEvent('app-monitor:sent',{detail:{reason,at:body.lastSeenAt}}));return{ok:true}}catch(e){dispatchEvent(new CustomEvent('app-monitor:error',{detail:{error:String(e)}}));return{ok:false,error:String(e)}}finally{clearTimeout(t);pending=false}}
function schedule(ms=1500,reason='pageview'){clearTimeout(timer);timer=setTimeout(()=>send(reason,false),ms)}
function notePage(){const p=location.pathname+location.search;if(p!==lastPath){lastPath=p;lastTitle=document.title||lastTitle;pageViews++;schedule()}}
for(const n of['pushState','replaceState']){const o=history[n];history[n]=function(){const v=o.apply(this,arguments);setTimeout(notePage,0);return v}}
addEventListener('popstate',()=>setTimeout(notePage,0));
addEventListener('apps-auth:change',e=>{const n=norm(e.detail?.effectiveUser);if(n)manual=n;schedule(100,'identity-link')});
document.addEventListener('visibilitychange',()=>{tick();if(document.visibilityState==='hidden')send('hidden',true)});
addEventListener('pagehide',()=>{tick();send('pagehide',true)});addEventListener('online',()=>send('online'));setInterval(()=>send('heartbeat'),5*60*1000);
window.AppMonitor={version:1,app,deviceId:deviceId(),sessionId:sessionId(),send,identify:v=>{manual=norm(v)||null;schedule(100,'identify');return manual},clearIdentity:()=>{manual=null;schedule(100,'identity-clear')},data:snap};
schedule(2000,'start');
})();