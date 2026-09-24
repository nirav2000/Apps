(function(){
'use strict';
if(window.AppsAuth)return;

const VERSION=1;
const DEVICE_KEY='apps-platform.v1.device';
const DEVICE_LABEL_KEY='apps-platform.v1.device-label';
const LEGACY_DEVICE_KEYS=['app-monitor.v1.device','firebase-usage-monitor.v3.device','firebase-usage-monitor.v2.device'];
const listeners=new Set();
let central=null,appIdentity=null,centralIdentity=null,authState='device-only',initPromise=null;

const clean=(v,n=180)=>String(v??'').trim().slice(0,n);
const validDevice=v=>/^[A-Za-z0-9._-]{8,100}$/.test(v||'');
const makeDevice=()=>('d-'+(crypto.randomUUID?.()||Date.now().toString(36)+'-'+Math.random().toString(36).slice(2))).replace(/[^A-Za-z0-9._-]/g,'');

function deviceId(){
  let id='';
  try{
    id=localStorage.getItem(DEVICE_KEY)||'';
    if(!validDevice(id)){
      for(const key of LEGACY_DEVICE_KEYS){
        const candidate=localStorage.getItem(key)||'';
        if(validDevice(candidate)){id=candidate;break;}
      }
    }
    if(!validDevice(id))id=makeDevice();
    localStorage.setItem(DEVICE_KEY,id);
    // Keep existing monitors on the same canonical browser/device identifier.
    for(const key of LEGACY_DEVICE_KEYS)localStorage.setItem(key,id);
  }catch{
    if(!validDevice(id))id=makeDevice();
  }
  return id;
}

function deviceLabel(){
  try{return clean(localStorage.getItem(DEVICE_LABEL_KEY),80)}catch{return ''}
}
function setDeviceLabel(value){
  const label=clean(value,80);
  try{if(label)localStorage.setItem(DEVICE_LABEL_KEY,label);else localStorage.removeItem(DEVICE_LABEL_KEY)}catch{}
  emit();
  return label;
}

function normalise(user,source='app'){
  if(!user)return null;
  const provider=clean(user.provider||user.providerId||user.providerData?.[0]?.providerId||(user.isAnonymous?'anonymous':''),80);
  const uid=clean(user.uid||user.userId||user.id,180);
  const username=clean(user.username||user.displayName||user.name||user.email,120);
  const email=clean(user.email,160);
  if(!uid&&!username&&!provider&&!email&&typeof user.isAnonymous!=='boolean')return null;
  return {uid,username,email,provider,isAnonymous:typeof user.isAnonymous==='boolean'?user.isAnonymous:null,source};
}

function effectiveIdentity(){
  const chosen=centralIdentity||appIdentity;
  if(!chosen)return null;
  return {
    uid:chosen.uid||'',
    username:chosen.username||'',
    provider:chosen.provider||'',
    isAnonymous:chosen.isAnonymous,
    source:chosen.source||'app',
    globalUid:centralIdentity?.uid||'',
    appUid:appIdentity?.uid||'',
    appProvider:appIdentity?.provider||''
  };
}

function pushMonitor(){
  const identity=effectiveIdentity();
  if(window.AppMonitor){
    if(identity)window.AppMonitor.identify(identity);
    else window.AppMonitor.clearIdentity?.();
  }
}

function snapshot(){
  return {
    version:VERSION,
    state:authState,
    deviceId:deviceId(),
    deviceLabel:deviceLabel(),
    centralUser:centralIdentity,
    appUser:appIdentity,
    effectiveUser:effectiveIdentity()
  };
}

function emit(){
  pushMonitor();
  const detail=snapshot();
  try{window.dispatchEvent(new CustomEvent('apps-auth:change',{detail}))}catch{}
  for(const fn of listeners){try{fn(detail)}catch{}}
}

function setAppIdentity(user,{app}={}){
  appIdentity=normalise(user,app?('app:'+clean(app,60)):'app');
  emit();
  return appIdentity;
}

async function init({firebaseConfig=window.APPS_IDENTITY_FIREBASE_CONFIG,autoAnonymous=window.APPS_AUTH_AUTO_ANONYMOUS===true,persistence='local'}={}){
  if(initPromise)return initPromise;
  if(!firebaseConfig?.projectId){
    authState='device-only';emit();
    return snapshot();
  }
  authState='connecting';emit();
  initPromise=(async()=>{
    const [A,Auth]=await Promise.all([
      import('https://www.gstatic.com/firebasejs/12.18.0/firebase-app.js'),
      import('https://www.gstatic.com/firebasejs/12.18.0/firebase-auth.js')
    ]);
    const name='apps-identity';
    const app=A.getApps().find(x=>x.name===name)||A.initializeApp(firebaseConfig,name);
    const auth=Auth.getAuth(app);
    if(persistence==='local')await Auth.setPersistence(auth,Auth.browserLocalPersistence);
    await auth.authStateReady();
    central={A,Auth,app,auth};
    const apply=user=>{
      centralIdentity=normalise(user,'central');
      authState=user?'authenticated':'anonymous-device';
      emit();
    };
    Auth.onAuthStateChanged(auth,apply);
    apply(auth.currentUser);
    if(!auth.currentUser&&autoAnonymous)await Auth.signInAnonymously(auth);
    return snapshot();
  })().catch(error=>{
    initPromise=null;authState='error';emit();throw error;
  });
  return initPromise;
}

async function requireCentral(){
  await init();
  if(!central)throw new Error('Central Apps identity Firebase project is not configured.');
  return central;
}
async function signInEmail(email,password){
  const C=await requireCentral();
  return C.Auth.signInWithEmailAndPassword(C.auth,email,password);
}
async function signInAnonymous(){
  const C=await requireCentral();
  return C.Auth.signInAnonymously(C.auth);
}
async function protectAnonymous(email,password){
  const C=await requireCentral();
  if(!C.auth.currentUser?.isAnonymous)throw new Error('The current central identity is not anonymous.');
  const credential=C.Auth.EmailAuthProvider.credential(email,password);
  return C.Auth.linkWithCredential(C.auth.currentUser,credential);
}
async function signOut(){
  const C=await requireCentral();
  return C.Auth.signOut(C.auth);
}
async function resetPassword(email){
  const C=await requireCentral();
  return C.Auth.sendPasswordResetEmail(C.auth,email);
}

const api={
  version:VERSION,
  deviceId,deviceLabel,setDeviceLabel,
  setAppIdentity,
  effectiveIdentity,
  snapshot,
  init,signInEmail,signInAnonymous,protectAnonymous,signOut,resetPassword,
  onChange(fn){listeners.add(fn);fn(snapshot());return()=>listeners.delete(fn)}
};
window.AppsAuth=api;
deviceId();
queueMicrotask(()=>{pushMonitor();if(window.APPS_IDENTITY_FIREBASE_CONFIG)init().catch(()=>{})});
})();