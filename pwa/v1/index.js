import { mountPWAStatus, pwaStyles } from './ui.js';

export const VERSION='1.0.0';

export function isIOS(){
  return typeof navigator!=='undefined'&&/iPhone|iPad|iPod/.test(navigator.userAgent||'');
}
export function isStandalone(){
  if(typeof window==='undefined')return false;
  return window.matchMedia?.('(display-mode: standalone)')?.matches===true||window.navigator.standalone===true;
}
export async function pwaReadiness(){
  if(typeof window==='undefined')return{supported:false,standalone:false,ios:false,serviceWorker:false,manifest:false,status:'unavailable'};
  const ios=isIOS(),standalone=isStandalone();
  const manifest=!!document.querySelector('link[rel="manifest"]');
  const serviceWorker='serviceWorker'in navigator;
  let registration=null;
  if(serviceWorker){
    try{registration=await navigator.serviceWorker.getRegistration('/Apps/')}catch{}
  }
  return{
    supported:serviceWorker&&manifest,
    ios,standalone,manifest,serviceWorker,
    registration:!!registration,
    notificationPermission:typeof Notification==='undefined'?'unsupported':Notification.permission,
    status:serviceWorker&&manifest?(ios&&!standalone?'install-required':'ready'):'setup-required'
  };
}
export async function registerPWA({serviceWorkerUrl='/Apps/firebase-messaging-sw.js',scope='/Apps/'}={}){
  if(!('serviceWorker'in navigator))return{ok:false,reason:'service-worker-unsupported'};
  const existing=await navigator.serviceWorker.getRegistration(scope);
  if(existing)return{ok:true,registration:existing,reused:true};
  const registration=await navigator.serviceWorker.register(serviceWorkerUrl,{scope});
  return{ok:true,registration,reused:false};
}
export async function initPWA({root=null,serviceWorkerUrl='/Apps/firebase-messaging-sw.js',scope='/Apps/',register=true}={}){
  let registration=null;
  if(register)registration=await registerPWA({serviceWorkerUrl,scope});
  const readiness=await pwaReadiness();
  if(root)await mountPWAStatus(root,{readiness});
  window.dispatchEvent(new CustomEvent('apps-pwa:ready',{detail:{version:VERSION,readiness}}));
  return{version:VERSION,readiness,registration};
}
export {mountPWAStatus,pwaStyles};
if(typeof window!=='undefined')window.AppsPWA={version:VERSION,init:initPWA,readiness:pwaReadiness,isIOS,isStandalone};
