const SDK_URL='https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.page.js';
let sdkPromise=null;
let initPromise=null;

function loadSdk(){
  if(typeof window==='undefined')throw new Error('Web push registration requires a browser');
  if(window.OneSignalDeferred&&document.querySelector('script[data-apps-onesignal]'))return sdkPromise||Promise.resolve();
  window.OneSignalDeferred=window.OneSignalDeferred||[];
  if(!document.querySelector('script[data-apps-onesignal]')){
    const script=document.createElement('script');
    script.src=SDK_URL;
    script.defer=true;
    script.dataset.appsOnesignal='1';
    document.head.appendChild(script);
  }
  sdkPromise=sdkPromise||new Promise((resolve,reject)=>{
    const timeout=setTimeout(()=>reject(new Error('OneSignal SDK did not load')),12000);
    window.OneSignalDeferred.push(()=>{clearTimeout(timeout);resolve()});
  });
  return sdkPromise;
}

function iosWebPushNeedsHomeScreen(){
  const ua=navigator.userAgent||'';
  const ios=/iPhone|iPad|iPod/.test(ua);
  const standalone=window.navigator.standalone===true||window.matchMedia?.('(display-mode: standalone)')?.matches;
  return ios&&!standalone;
}

export async function registerWebPush({
  appId,
  externalId,
  serviceWorkerPath='/Apps/notifications/v1/onesignal/OneSignalSDKWorker.js',
  serviceWorkerScope='/Apps/notifications/v1/onesignal/',
  requestPermission=true
}={}){
  if(!appId)return{ok:false,configured:false,reason:'provider-unconfigured'};
  if(!externalId)return{ok:false,configured:true,reason:'external-id-required'};
  if(iosWebPushNeedsHomeScreen())return{ok:false,configured:true,reason:'ios-home-screen-required'};

  await loadSdk();

  return new Promise((resolve,reject)=>{
    window.OneSignalDeferred.push(async OneSignal=>{
      try{
        if(!initPromise){
          initPromise=OneSignal.init({appId,serviceWorkerPath,serviceWorkerParam:{scope:serviceWorkerScope}});
        }
        await initPromise;
        await OneSignal.login(externalId);
        const supported=OneSignal.Notifications.isPushSupported();
        if(!supported)return resolve({ok:false,configured:true,supported:false,reason:'push-not-supported'});
        if(requestPermission&&!OneSignal.Notifications.permission)await OneSignal.Notifications.requestPermission();
        const permission=OneSignal.Notifications.permission===true;
        resolve({ok:permission,configured:true,supported:true,permission,externalId,reason:permission?'':'permission-not-granted'});
      }catch(error){reject(error)}
    });
  });
}

export async function webPushPublicConfig(endpoint){
  if(!endpoint)return{ok:true,webPush:{configured:false,appId:''}};
  const response=await fetch(endpoint,{cache:'no-store'});
  if(!response.ok)throw new Error('Could not load web-push configuration');
  return response.json();
}
