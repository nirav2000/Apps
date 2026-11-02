import { mountPWAStatus, pwaStyles } from './ui.js';

export const VERSION='1.1.0';

export function isIOS(){
  if(typeof navigator==='undefined')return false;
  const agent=navigator.userAgent||'';
  return /iPhone|iPad|iPod/.test(agent)||(/Macintosh/.test(agent)&&(navigator.maxTouchPoints||0)>1);
}
export function isStandalone(){
  if(typeof window==='undefined')return false;
  return window.matchMedia?.('(display-mode: standalone)')?.matches===true||window.navigator.standalone===true;
}
export async function pwaReadiness({scope='/Apps/'}={}){
  if(typeof window==='undefined')return{supported:false,standalone:false,ios:false,serviceWorker:false,manifest:false,status:'unavailable'};
  const ios=isIOS(),standalone=isStandalone();
  const manifest=!!document.querySelector('link[rel="manifest"]');
  const serviceWorker='serviceWorker'in navigator;
  let registration=null;
  if(serviceWorker){
    try{registration=await navigator.serviceWorker.getRegistration(scope)}catch{}
  }
  return{
    supported:serviceWorker&&manifest,
    ios,standalone,manifest,serviceWorker,
    registration:!!registration,
    notificationPermission:typeof Notification==='undefined'?'unsupported':Notification.permission,
    status:serviceWorker&&manifest&&registration?(ios&&!standalone?'install-required':'ready'):'setup-required'
  };
}
export async function registerPWA({serviceWorkerUrl='/Apps/firebase-messaging-sw.js',scope='/Apps/'}={}){
  if(!('serviceWorker'in navigator))return{ok:false,reason:'service-worker-unsupported'};
  const existing=await navigator.serviceWorker.getRegistration(scope);
  if(existing){
    const expectedScope=new URL(scope,location.href).href;
    const expectedScript=new URL(serviceWorkerUrl,location.href).href;
    const script=existing.active?.scriptURL||existing.waiting?.scriptURL||existing.installing?.scriptURL;
    if(existing.scope!==expectedScope||(script&&script!==expectedScript)){
      return{ok:false,reason:'service-worker-scope-conflict',registration:existing,reused:false};
    }
    let updateError=null;
    try{await existing.update()}catch(error){updateError=String(error?.message||error)}
    return{ok:true,registration:existing,reused:true,updateError};
  }
  const registration=await navigator.serviceWorker.register(serviceWorkerUrl,{scope});
  return{ok:true,registration,reused:false};
}
export async function initPWA({root=null,serviceWorkerUrl='/Apps/firebase-messaging-sw.js',scope='/Apps/',register=true}={}){
  let registration=null;
  if(register)registration=await registerPWA({serviceWorkerUrl,scope});
  let readiness=await pwaReadiness({scope});
  if(registration?.ok===false)readiness={...readiness,status:'setup-required',serviceWorkerConflict:registration.reason};
  if(root)await mountPWAStatus(root,{readiness});
  window.dispatchEvent(new CustomEvent('apps-pwa:ready',{detail:{version:VERSION,readiness}}));
  return{version:VERSION,readiness,registration};
}
export {mountPWAStatus,pwaStyles};
if(typeof window!=='undefined')window.AppsPWA={version:VERSION,init:initPWA,readiness:pwaReadiness,isIOS,isStandalone};
