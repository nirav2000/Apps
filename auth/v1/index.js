const VERSION='1.1.0';
const DEVICE_KEY='apps-platform.v1.device';
const listeners={change:new Set(),signedIn:new Set(),signedOut:new Set(),userChanged:new Set(),permissionChanged:new Set()};
const state={initialised:false,appId:'',mode:'shadow',status:'idle',deviceId:'',identityConfig:null,serviceBaseUrl:'',firebase:null,centralUser:null,globalUser:null,appUser:null,permissions:{globalRoles:[],appRoles:[],legacyRoles:[]},session:null,appAdapter:null,migration:{phase:'shadow',authority:'legacy'},error:null};

const clean=(v,n=180)=>String(v??'').trim().slice(0,n);
const makeId=(prefix='id')=>prefix+'-'+(crypto.randomUUID?.()||Date.now().toString(36)+'-'+Math.random().toString(36).slice(2)).replace(/[^A-Za-z0-9._-]/g,'');
function getDeviceId(){
  if(state.deviceId)return state.deviceId;
  let id='';
  try{id=localStorage.getItem(DEVICE_KEY)||''}catch{}
  if(!/^[A-Za-z0-9._-]{8,100}$/.test(id))id=makeId('d');
  try{localStorage.setItem(DEVICE_KEY,id);localStorage.setItem('app-monitor.v1.device',id);localStorage.setItem('firebase-usage-monitor.v3.device',id)}catch{}
  state.deviceId=id;return id;
}
function normaliseFirebaseUser(user,source='central'){
  if(!user)return null;
  return {authSubjectId:clean(user.uid),appUserId:source==='app'?clean(user.uid):'',email:clean(user.email),displayName:clean(user.displayName||user.email,120),provider:clean(user.providerData?.[0]?.providerId||(user.isAnonymous?'anonymous':'firebase'),80),isAnonymous:!!user.isAnonymous,source};
}
function assessMigration({centralUser=null,appUser=null,phase='shadow',authority='legacy'}={}){
  const central=centralUser||null,legacy=appUser||null;
  const mappedAppUserId=clean(central?.appUserId||central?.membership?.appUserId||central?.app?.appUserId);
  const legacyId=clean(legacy?.appUserId||legacy?.authSubjectId);
  let consistency='none';
  if(central&&legacy){
    if(mappedAppUserId&&legacyId)consistency=mappedAppUserId===legacyId?'linked':'mismatch';
    else consistency='dual-unverified';
  }else if(central)consistency='central-only';
  else if(legacy)consistency='legacy-only';
  const blocking=consistency==='mismatch'||(consistency==='dual-unverified'&&phase!=='shadow'&&authority!=='legacy');
  return {phase,authority,consistency,blocking,mappedAppUserId:mappedAppUserId||'',legacyAppUserId:legacyId||''};
}
function migrationState(){
  return assessMigration({
    centralUser:state.globalUser||state.centralUser||null,
    appUser:state.appUser||null,
    phase:state.migration?.phase||state.mode||'shadow',
    authority:state.migration?.authority||((state.migration?.phase||state.mode)==='shadow'?'legacy':'central')
  });
}
function snapshot(){
  const migration=migrationState();
  const user=migration.authority==='legacy'?(state.appUser||state.globalUser):(state.globalUser||state.appUser)||null;
  const effectiveAppRoles=migration.authority==='legacy'?state.permissions.legacyRoles:state.permissions.appRoles;
  return {version:VERSION,appId:state.appId,mode:state.mode,status:state.status,deviceId:getDeviceId(),user,globalUser:state.globalUser,appUser:state.appUser,permissions:{globalRoles:[...state.permissions.globalRoles],appRoles:[...effectiveAppRoles],centralAppRoles:[...state.permissions.appRoles],legacyAppRoles:[...state.permissions.legacyRoles]},session:state.session,migration,error:state.error};
}
function emit(type='change',previousUser=null){
  const snap=snapshot();
  for(const fn of listeners.change){try{fn(snap)}catch{}}
  if(type!=='change')for(const fn of listeners[type]||[]){try{fn(snap)}catch{}}
  try{window.dispatchEvent(new CustomEvent('apps-auth:'+type,{detail:snap}))}catch{}
  if(type==='userChanged'&&previousUser&&!snap.user)for(const fn of listeners.signedOut){try{fn(snap)}catch{}}
  if(type==='userChanged'&&!previousUser&&snap.user)for(const fn of listeners.signedIn){try{fn(snap)}catch{}}
}
function on(type,fn){listeners[type].add(fn);return()=>listeners[type].delete(fn)}
function setPermissions(globalRoles=[],appRoles=[]){
  const before=JSON.stringify(state.permissions);
  state.permissions={...state.permissions,globalRoles:[...new Set(globalRoles.map(String))],appRoles:[...new Set(appRoles.map(String))]};
  if(JSON.stringify(state.permissions)!==before)emit('permissionChanged');
}
function setAppIdentity(user,{roles=[]}={}){
  const before=snapshot().user,previous=JSON.stringify(state.permissions.legacyRoles);
  state.appUser=user?{...normaliseFirebaseUser(user,'app'),...(user.globalUserId?{globalUserId:clean(user.globalUserId)}:{})}:null;
  state.permissions.legacyRoles=user?[...new Set((roles||[]).map(String))]:[];
  if(JSON.stringify(state.permissions.legacyRoles)!==previous)emit('permissionChanged');
  emit('userChanged',before);
  return state.appUser;
}
async function ensureFirebase(){
  if(state.firebase)return state.firebase;
  const cfg=state.identityConfig?.firebaseConfig;
  if(!cfg?.projectId)throw Object.assign(new Error('Central identity Firebase is not configured.'),{code:'AUTH_NOT_CONFIGURED'});
  const [A,Auth]=await Promise.all([
    import('https://www.gstatic.com/firebasejs/12.18.0/firebase-app.js'),
    import('https://www.gstatic.com/firebasejs/12.18.0/firebase-auth.js')
  ]);
  const name='apps-identity';
  const app=A.getApps().find(x=>x.name===name)||A.initializeApp(cfg,name);
  const auth=Auth.getAuth(app);
  await Auth.setPersistence(auth,Auth.browserLocalPersistence);
  await auth.authStateReady();
  state.firebase={A,Auth,app,auth};
  Auth.onAuthStateChanged(auth,async user=>{
    const before=snapshot().user;
    state.centralUser=normaliseFirebaseUser(user,'central');
    if(!user){state.globalUser=null;state.session=null;setPermissions([],[]);state.status='ready';emit('userChanged',before);return}
    state.status='authenticated';
    try{await refreshIdentity()}catch{state.globalUser={...state.centralUser,globalUserId:null}}
    emit('userChanged',before);
  });
  return state.firebase;
}
async function authHeaders(){
  const fb=await ensureFirebase();
  const token=await fb.auth.currentUser?.getIdToken();
  if(!token)throw Object.assign(new Error('Sign in required.'),{code:'AUTH_REQUIRED'});
  return {'Authorization':'Bearer '+token,'Content-Type':'application/json','X-Apps-Device':getDeviceId(),'X-Apps-App':state.appId};
}
async function api(path,options={}){
  if(!state.serviceBaseUrl)throw Object.assign(new Error('Authentication service is not configured.'),{code:'AUTH_SERVICE_NOT_CONFIGURED'});
  const headers={...(options.auth===false?{}:await authHeaders()),...(options.headers||{})};
  const r=await fetch(state.serviceBaseUrl.replace(/\/$/,'')+path,{cache:'no-store',...options,headers});
  if(!r.ok){const text=await r.text().catch(()=>r.statusText);throw Object.assign(new Error(text||('Auth service '+r.status)),{status:r.status})}
  const ct=r.headers.get('content-type')||'';
  return ct.includes('application/json')?r.json():r.text();
}
async function refreshIdentity(){
  if(!state.serviceBaseUrl){
    const u=state.centralUser;
    state.globalUser=u?{...u,globalUserId:null}:null;
    return snapshot();
  }
  const data=await api('/v1/me');
  state.globalUser=data.user||null;
  state.session=data.session||null;
  setPermissions(data.permissions?.globalRoles||[],data.permissions?.appRoles||[]);
  return snapshot();
}
async function init(options={}){
  state.appId=clean(options.appId,80);
  if(!state.appId)throw new Error('Auth.init requires appId.');
  state.mode=options.mode||'shadow';
  state.migration={phase:options.migration?.phase||state.mode,authority:options.migration?.authority||(state.mode==='shadow'?'legacy':'central')};
  state.identityConfig=options.identity||null;
  state.serviceBaseUrl=clean(options.serviceBaseUrl||options.identity?.serviceBaseUrl,300);
  state.appAdapter=options.appAdapter||null;
  state.status='initialising';getDeviceId();
  if(state.appAdapter?.init){
    const result=await state.appAdapter.init({appId:state.appId,setAppIdentity});
    if(result?.user)setAppIdentity(result.user,{roles:result.roles||[]});
    state.appAdapter.onChange?.((u,r=[])=>setAppIdentity(u,{roles:r}));
  }
  if(state.identityConfig?.firebaseConfig){
    await ensureFirebase();
    const fb=state.firebase;
    if(fb.auth.currentUser){
      state.centralUser=normaliseFirebaseUser(fb.auth.currentUser,'central');
      try{await refreshIdentity()}catch{state.globalUser={...state.centralUser,globalUserId:null}}
    }else if(options.autoAnonymous===true){
      await fb.Auth.signInAnonymously(fb.auth);
    }
  }
  state.initialised=true;state.status=state.centralUser?'authenticated':'ready';emit();
  return snapshot();
}
function getCurrentUser(){return snapshot().user}
function requireAuth(){
  const snap=snapshot();
  if(snap.migration.blocking)throw Object.assign(new Error('Authentication identity mismatch must be resolved before continuing.'),{code:'AUTH_IDENTITY_MISMATCH',migration:snap.migration});
  const user=snap.user;
  if(!user)throw Object.assign(new Error('Authentication required.'),{code:'AUTH_REQUIRED'});
  return user;
}
const requireUser=requireAuth;
function hasRole(role){const p=snapshot().permissions;return p.globalRoles.includes(role)||p.appRoles.includes(role)}
function getRoles(){const p=snapshot().permissions;return{global:[...p.globalRoles],app:[...p.appRoles],centralApp:[...p.centralAppRoles],legacyApp:[...p.legacyAppRoles]}}
async function signInEmail(email,password){const fb=await ensureFirebase();return fb.Auth.signInWithEmailAndPassword(fb.auth,email,password)}
async function signInAnonymous(){const fb=await ensureFirebase();return fb.Auth.signInAnonymously(fb.auth)}
async function upgradeAnonymousWithEmailPassword(email,password){
  const fb=await ensureFirebase(),user=fb.auth.currentUser;
  if(!user?.isAnonymous)throw new Error('Current user is not anonymous.');
  return fb.Auth.linkWithCredential(user,fb.Auth.EmailAuthProvider.credential(email,password));
}
async function sendEmailLink(email,settings){
  const fb=await ensureFirebase();
  const actionCodeSettings=settings||state.identityConfig?.emailLinkSettings;
  if(!actionCodeSettings)throw new Error('Email-link settings are not configured.');
  await fb.Auth.sendSignInLinkToEmail(fb.auth,email,actionCodeSettings);
  try{localStorage.setItem('apps-auth.v1.email-link',email)}catch{}
}
async function completeEmailLink(url=location.href,email){
  const fb=await ensureFirebase();
  if(!fb.Auth.isSignInWithEmailLink(fb.auth,url))throw new Error('This is not a valid sign-in link.');
  let resolved=email;try{resolved=resolved||localStorage.getItem('apps-auth.v1.email-link')||''}catch{}
  if(!resolved)throw new Error('Email address is required to complete sign-in.');
  const result=await fb.Auth.signInWithEmailLink(fb.auth,resolved,url);try{localStorage.removeItem('apps-auth.v1.email-link')}catch{};return result;
}
async function popupProvider(name){
  const fb=await ensureFirebase();let provider;
  if(name==='google')provider=new fb.Auth.GoogleAuthProvider();
  else if(name==='apple')provider=new fb.Auth.OAuthProvider('apple.com');
  else throw new Error('Unsupported provider: '+name);
  return fb.Auth.signInWithPopup(fb.auth,provider);
}
async function logout(){
  try{if(state.serviceBaseUrl&&state.session?.id)await api('/v1/sessions/'+encodeURIComponent(state.session.id),{method:'DELETE'})}catch{}
  if(state.appAdapter?.logout)await state.appAdapter.logout();
  if(state.firebase?.auth)await state.firebase.Auth.signOut(state.firebase.auth);
  state.centralUser=null;state.globalUser=null;state.appUser=null;state.session=null;state.permissions.legacyRoles=[];setPermissions([],[]);emit('signedOut');
}
async function listSessions(){return state.serviceBaseUrl?(await api('/v1/sessions')).sessions||[]:[]}
async function revokeSession(sessionId){return api('/v1/sessions/'+encodeURIComponent(sessionId),{method:'DELETE'})}
async function disableCurrentAccount(){return api('/v1/account/disable',{method:'POST'})}
const b64uToBuf=s=>{const p=String(s||'').replace(/-/g,'+').replace(/_/g,'/'),raw=atob(p+'='.repeat((4-p.length%4)%4)),u=new Uint8Array(raw.length);for(let i=0;i<raw.length;i++)u[i]=raw.charCodeAt(i);return u.buffer};
const bufToB64u=b=>{const u=new Uint8Array(b);let s='';for(const x of u)s+=String.fromCharCode(x);return btoa(s).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'')};
function publicKeyRequestOptions(o){return {...o,challenge:b64uToBuf(o.challenge),allowCredentials:(o.allowCredentials||[]).map(x=>({...x,id:b64uToBuf(x.id)}))}}
function publicKeyCreationOptions(o){return {...o,challenge:b64uToBuf(o.challenge),user:{...o.user,id:b64uToBuf(o.user.id)},excludeCredentials:(o.excludeCredentials||[]).map(x=>({...x,id:b64uToBuf(x.id)}))}}
function authCredentialJSON(c){return{id:c.id,rawId:bufToB64u(c.rawId),type:c.type,response:{authenticatorData:bufToB64u(c.response.authenticatorData),clientDataJSON:bufToB64u(c.response.clientDataJSON),signature:bufToB64u(c.response.signature),userHandle:c.response.userHandle?bufToB64u(c.response.userHandle):undefined},clientExtensionResults:c.getClientExtensionResults(),authenticatorAttachment:c.authenticatorAttachment||undefined}}
function registrationCredentialJSON(c){const r=c.response;return{id:c.id,rawId:bufToB64u(c.rawId),type:c.type,response:{clientDataJSON:bufToB64u(r.clientDataJSON),attestationObject:bufToB64u(r.attestationObject),transports:r.getTransports?r.getTransports():[]},clientExtensionResults:c.getClientExtensionResults(),authenticatorAttachment:c.authenticatorAttachment||undefined}}
async function registerPasskey(label='Passkey'){
  if(!window.PublicKeyCredential||!navigator.credentials?.create)throw new Error('Passkeys are not supported in this browser.');
  const start=await api('/v1/passkeys/register/options',{method:'POST',body:JSON.stringify({label})});
  const credential=await navigator.credentials.create({publicKey:publicKeyCreationOptions(start.options)});
  return api('/v1/passkeys/register/verify',{method:'POST',body:JSON.stringify({challengeId:start.challengeId,label,response:registrationCredentialJSON(credential)})});
}
async function signInWithPasskey(){
  if(!window.PublicKeyCredential||!navigator.credentials?.get)throw new Error('Passkeys are not supported in this browser.');
  const start=await api('/v1/passkeys/authenticate/options',{method:'POST',auth:false,headers:{'Content-Type':'application/json','X-Apps-Device':getDeviceId(),'X-Apps-App':state.appId},body:JSON.stringify({appId:state.appId})});
  const credential=await navigator.credentials.get({publicKey:publicKeyRequestOptions(start.options)});
  const verified=await api('/v1/passkeys/authenticate/verify',{method:'POST',auth:false,headers:{'Content-Type':'application/json','X-Apps-Device':getDeviceId(),'X-Apps-App':state.appId},body:JSON.stringify({challengeId:start.challengeId,response:authCredentialJSON(credential)})});
  if(verified.firebaseCustomToken){
    const fb=await ensureFirebase();
    await fb.Auth.signInWithCustomToken(fb.auth,verified.firebaseCustomToken);
    await refreshIdentity();
  }
  return verified;
}
async function getAuditHistory(){return (await api('/v1/audit')).events||[]}

export const Auth={
  version:VERSION,init,snapshot,getCurrentUser,requireAuth,requireUser,hasRole,getRoles,
  signInEmail,signInAnonymous,upgradeAnonymousWithEmailPassword,sendEmailLink,completeEmailLink,
  signInGoogle:()=>popupProvider('google'),signInApple:()=>popupProvider('apple'),
  logout,listSessions,revokeSession,disableCurrentAccount,registerPasskey,signInWithPasskey,getAuditHistory,
  setAppIdentity,refreshIdentity,getDeviceId,getMigrationState:migrationState,assessMigration,
  onSignedIn:fn=>on('signedIn',fn),onSignedOut:fn=>on('signedOut',fn),onUserChanged:fn=>on('userChanged',fn),
  onPermissionChanged:fn=>on('permissionChanged',fn),onChange:fn=>on('change',fn)
};
export default Auth;
