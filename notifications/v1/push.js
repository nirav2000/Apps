const FIREBASE_VERSION='12.19.0';
let firebaseModulesPromise=null;
let messagingState=null;

function iosWebPushNeedsHomeScreen(){
  const ua=navigator.userAgent||'';
  const ios=/iPhone|iPad|iPod/.test(ua);
  const standalone=window.navigator.standalone===true||window.matchMedia?.('(display-mode: standalone)')?.matches;
  return ios&&!standalone;
}
function loadFirebaseModules(){
  if(firebaseModulesPromise)return firebaseModulesPromise;
  firebaseModulesPromise=Promise.all([
    import('https://www.gstatic.com/firebasejs/'+FIREBASE_VERSION+'/firebase-app.js'),
    import('https://www.gstatic.com/firebasejs/'+FIREBASE_VERSION+'/firebase-messaging.js')
  ]).then(([app,messaging])=>({app,messaging}));
  return firebaseModulesPromise;
}
function workerUrl(config,serviceWorkerUrl='/Apps/firebase-messaging-sw.js'){
  const u=new URL(serviceWorkerUrl,location.href);
  for(const [key,value] of Object.entries({
    apiKey:config.apiKey,
    authDomain:config.authDomain,
    projectId:config.projectId,
    messagingSenderId:config.messagingSenderId,
    appId:config.appId
  })){
    if(value)u.searchParams.set(key,value);
  }
  return u.href;
}

export async function registerWebPush({
  firebaseConfig,
  vapidKey,
  serviceWorkerScope='/Apps/',
  serviceWorkerUrl='/Apps/firebase-messaging-sw.js',
  requestPermission=true,
  onRegistration
}={}){
  if(!firebaseConfig?.projectId||!firebaseConfig?.apiKey||!firebaseConfig?.appId||!firebaseConfig?.messagingSenderId||!vapidKey){
    return{ok:false,configured:false,reason:'provider-unconfigured'};
  }
  if(typeof window==='undefined'||!('serviceWorker' in navigator)||!('Notification' in window)){
    return{ok:false,configured:true,supported:false,reason:'push-not-supported'};
  }
  if(iosWebPushNeedsHomeScreen())return{ok:false,configured:true,supported:true,reason:'ios-home-screen-required'};

  const {app,messaging}=await loadFirebaseModules();
  if(!(await messaging.isSupported()))return{ok:false,configured:true,supported:false,reason:'push-not-supported'};

  if(requestPermission&&Notification.permission!=='granted'){
    const permission=await Notification.requestPermission();
    if(permission!=='granted')return{ok:false,configured:true,supported:true,permission:false,reason:'permission-not-granted'};
  }

  const registration=await navigator.serviceWorker.register(workerUrl(firebaseConfig,serviceWorkerUrl),{scope:serviceWorkerScope});
  await navigator.serviceWorker.ready;

  let firebaseApp;
  try{firebaseApp=app.getApp('apps-notifications')}
  catch{firebaseApp=app.initializeApp(firebaseConfig,'apps-notifications')}
  const messagingInstance=messaging.getMessaging(firebaseApp);

  const installationId=await new Promise(async(resolve,reject)=>{
    let settled=false;
    const unsubscribe=messaging.onRegistered(messagingInstance,fid=>{
      if(settled)return;
      settled=true;
      try{unsubscribe?.()}catch{}
      resolve(fid);
    });
    try{
      await messaging.register(messagingInstance,{vapidKey,serviceWorkerRegistration:registration});
      setTimeout(()=>{
        if(!settled){
          settled=true;
          try{unsubscribe?.()}catch{}
          reject(new Error('FCM registration completed without returning an installation ID'));
        }
      },12000);
    }catch(error){
      if(!settled){
        settled=true;
        try{unsubscribe?.()}catch{}
        reject(error);
      }
    }
  });

  onRegistration?.(installationId);
  messagingState={messaging:messagingInstance,installationId,registration};
  return{ok:true,configured:true,supported:true,permission:true,installationId};
}

export async function webPushPublicConfig(endpoint){
  if(!endpoint)return{ok:true,webPush:{configured:false,provider:'fcm',firebaseConfig:null,vapidKey:''}};
  const response=await fetch(endpoint,{cache:'no-store'});
  if(!response.ok)throw new Error('Could not load web-push configuration');
  return response.json();
}

export function currentWebPushRegistration(){
  return messagingState;
}

export async function registerConsumerWebPush({apiBase,app,eventTypes=[],firebaseConfig,vapidKey,serviceWorkerScope='/Apps/',serviceWorkerUrl='/Apps/firebase-messaging-sw.js'}={}){
  if(!apiBase||!app)throw new Error('apiBase and app are required for consumer push registration');
  const result=await registerWebPush({firebaseConfig,vapidKey,serviceWorkerScope,serviceWorkerUrl});
  if(!result.ok)return result;
  const response=await fetch(String(apiBase).replace(/\/$/,'')+'/notifications/consumer/register',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({app,installationId:result.installationId,events:eventTypes,enabled:true})});
  let data=null;try{data=await response.json()}catch{}
  if(!response.ok)throw new Error(data?.error||'Could not register this device for notifications');
  return{...result,consumerRegistered:true,consumer:data};
}

export async function unregisterConsumerWebPush({apiBase,app,installationId}={}){
  if(!apiBase||!app||!installationId)return{ok:false,reason:'missing-registration'};
  const response=await fetch(String(apiBase).replace(/\/$/,'')+'/notifications/consumer/unregister',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({app,installationId})});
  let data=null;try{data=await response.json()}catch{}
  if(!response.ok)throw new Error(data?.error||'Could not unregister this device');
  return data;
}
