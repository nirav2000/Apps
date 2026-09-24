(function(){
'use strict';
if(window.AppsPasskeyAuth)return;

const VERSION=1;
const enc=s=>new TextEncoder().encode(s);
const b64uToBuf=s=>{const p=String(s||'').replace(/-/g,'+').replace(/_/g,'/'),raw=atob(p+'='.repeat((4-p.length%4)%4)),u=new Uint8Array(raw.length);for(let i=0;i<raw.length;i++)u[i]=raw.charCodeAt(i);return u.buffer};
const bufToB64u=b=>{const u=new Uint8Array(b);let s='';for(const x of u)s+=String.fromCharCode(x);return btoa(s).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'')};
const randomToken=(bytes=48)=>{const b=new Uint8Array(bytes);crypto.getRandomValues(b);return bufToB64u(b)};

function requestOptions(o){return {...o,challenge:b64uToBuf(o.challenge),allowCredentials:(o.allowCredentials||[]).map(x=>({...x,id:b64uToBuf(x.id)}))}}
function creationOptions(o){return {...o,challenge:b64uToBuf(o.challenge),user:{...o.user,id:b64uToBuf(o.user.id)},excludeCredentials:(o.excludeCredentials||[]).map(x=>({...x,id:b64uToBuf(x.id)}))}}
function authResponse(c){return{id:c.id,rawId:bufToB64u(c.rawId),type:c.type,response:{authenticatorData:bufToB64u(c.response.authenticatorData),clientDataJSON:bufToB64u(c.response.clientDataJSON),signature:bufToB64u(c.response.signature),userHandle:c.response.userHandle?bufToB64u(c.response.userHandle):undefined},clientExtensionResults:c.getClientExtensionResults(),authenticatorAttachment:c.authenticatorAttachment||undefined}}
function regResponse(c){const r=c.response;return{id:c.id,rawId:bufToB64u(c.rawId),type:c.type,response:{clientDataJSON:bufToB64u(r.clientDataJSON),attestationObject:bufToB64u(r.attestationObject),transports:r.getTransports?r.getTransports():[],authenticatorData:r.getAuthenticatorData?bufToB64u(r.getAuthenticatorData()):undefined,publicKey:r.getPublicKey&&r.getPublicKey()?bufToB64u(r.getPublicKey()):undefined,publicKeyAlgorithm:r.getPublicKeyAlgorithm?r.getPublicKeyAlgorithm():undefined},clientExtensionResults:c.getClientExtensionResults(),authenticatorAttachment:c.authenticatorAttachment||undefined}}

function create(config={}){
  const base=String(config.baseUrl||'').replace(/\/$/,'');
  const sessionKey=config.sessionStoreKey||'apps-passkey-auth.v1.session';
  const failureKey=config.failureStoreKey||'apps-passkey-auth.v1.failures';
  const bootstrapKey=config.bootstrapStoreKey||'apps-passkey-auth.v1.bootstrap';
  const maxFailures=Number(config.maxFailures)||5;
  let sessionToken='',sessionExpiresAt='',bootstrapSecret='';

  const fetcher=(path,options={})=>fetch(base+path,{cache:'no-store',...options});
  const authHeaders=()=>sessionToken?{'X-App-Monitor-Session':sessionToken}:{};
  const saveSession=(token,expiresAt)=>{sessionToken=token||'';sessionExpiresAt=expiresAt||'';if(token)localStorage.setItem(sessionKey,JSON.stringify({token,expiresAt}));else localStorage.removeItem(sessionKey)};
  const restoreSession=()=>{try{const x=JSON.parse(localStorage.getItem(sessionKey)||'null');if(x?.token){sessionToken=x.token;sessionExpiresAt=x.expiresAt||'';return x}}catch{}return null};
  const resetFailures=()=>localStorage.removeItem(failureKey);
  const recordFailure=()=>{const n=(Number(localStorage.getItem(failureKey)||0)||0)+1;localStorage.setItem(failureKey,String(n));if(n>=maxFailures){saveSession('','');localStorage.removeItem(failureKey);config.onLockout?.(n)}return n};

  async function status(){const r=await fetcher('/security/status');if(!r.ok)throw new Error('Auth status '+r.status);return r.json()}
  async function validateSession(){if(!sessionToken)return null;const r=await fetcher('/auth/session',{headers:authHeaders()});if(!r.ok){saveSession('','');return null}const d=await r.json();sessionExpiresAt=d.expiresAt;resetFailures();return d}
  async function recoveryLogin(token){const r=await fetcher('/auth/recovery',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({token})});if(!r.ok){if(r.status===401)recordFailure();throw new Error('Recovery authentication failed')}const d=await r.json();saveSession(d.token,d.expiresAt);resetFailures();return d}
  async function passkeyLogin(){const r=await fetcher('/auth/passkey/options',{method:'POST'});if(!r.ok)throw new Error(await r.text());const d=await r.json(),cred=await navigator.credentials.get({publicKey:requestOptions(d.options)});const v=await fetcher('/auth/passkey/verify',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({challengeId:d.challengeId,response:authResponse(cred)})});if(!v.ok){if(v.status===401)recordFailure();throw new Error(await v.text())}const out=await v.json();saveSession(out.token,out.expiresAt);resetFailures();return out}
  function restoreBootstrap(){try{const x=JSON.parse(sessionStorage.getItem(bootstrapKey)||'null');if(x?.requestId&&x?.secret){bootstrapSecret=x.secret;return x}}catch{}return null}
  function clearBootstrap(){bootstrapSecret='';sessionStorage.removeItem(bootstrapKey)}
  async function startBootstrap(){bootstrapSecret=randomToken();const r=await fetcher('/bootstrap/request',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({secret:bootstrapSecret})});if(!r.ok){bootstrapSecret='';throw new Error(await r.text())}const out=await r.json();sessionStorage.setItem(bootstrapKey,JSON.stringify({requestId:out.requestId,secret:bootstrapSecret,expiresAt:out.expiresAt}));return out}
  async function bootstrapStatus(requestId){if(!bootstrapSecret){const x=restoreBootstrap();if(!x||x.requestId!==requestId)throw new Error('Bootstrap proof is unavailable in this browser session')}const r=await fetcher('/bootstrap/status?requestId='+encodeURIComponent(requestId),{headers:{'X-App-Monitor-Bootstrap':bootstrapSecret}});if(!r.ok)throw new Error(await r.text());return r.json()}
  async function bootstrapRegister(requestId,label='First passkey'){if(!bootstrapSecret){const x=restoreBootstrap();if(!x||x.requestId!==requestId)throw new Error('Bootstrap proof is unavailable in this browser session')}const h={'Content-Type':'application/json','X-App-Monitor-Bootstrap':bootstrapSecret},r=await fetcher('/bootstrap/register/options',{method:'POST',headers:h,body:JSON.stringify({requestId})});if(!r.ok)throw new Error(await r.text());const d=await r.json(),cred=await navigator.credentials.create({publicKey:creationOptions(d.options)});const v=await fetcher('/bootstrap/register/verify',{method:'POST',headers:h,body:JSON.stringify({requestId,challengeId:d.challengeId,label,response:regResponse(cred)})});if(!v.ok)throw new Error(await v.text());const out=await v.json();clearBootstrap();saveSession(out.token,out.expiresAt);resetFailures();return out}
  async function registerPasskey(label='Passkey'){const r=await fetcher('/passkeys/register/options',{method:'POST',headers:authHeaders()});if(!r.ok)throw new Error(await r.text());const d=await r.json(),cred=await navigator.credentials.create({publicKey:creationOptions(d.options)});const v=await fetcher('/passkeys/register/verify',{method:'POST',headers:{'Content-Type':'application/json',...authHeaders()},body:JSON.stringify({challengeId:d.challengeId,label,response:regResponse(cred)})});if(!v.ok)throw new Error(await v.text());return v.json()}
  async function securityInfo(){const r=await fetcher('/security/info',{headers:authHeaders()});if(!r.ok)throw new Error(await r.text());return r.json()}
  async function rotateRecovery(token){const r=await fetcher('/security/recovery',{method:'POST',headers:{'Content-Type':'application/json',...authHeaders()},body:JSON.stringify({token})});if(!r.ok)throw new Error(await r.text());return r.json()}
  async function revokePasskey(id){const r=await fetcher('/security/revoke-passkey',{method:'POST',headers:{'Content-Type':'application/json',...authHeaders()},body:JSON.stringify({id})});if(!r.ok)throw new Error(await r.text());return r.json()}
  async function revokeSession(hash){const r=await fetcher('/security/revoke-session',{method:'POST',headers:{'Content-Type':'application/json',...authHeaders()},body:JSON.stringify({hash})});if(!r.ok)throw new Error(await r.text());return r.json()}
  async function revokeAllSessions(){const r=await fetcher('/security/revoke-all-sessions',{method:'POST',headers:authHeaders()});if(!r.ok)throw new Error(await r.text());const out=await r.json();saveSession('','');return out}
  async function logout(){try{await fetcher('/auth/logout',{method:'POST',headers:authHeaders()})}finally{saveSession('','')}}

  return {version:VERSION,status,authHeaders,restoreSession,validateSession,recoveryLogin,passkeyLogin,startBootstrap,restoreBootstrap,clearBootstrap,bootstrapStatus,bootstrapRegister,registerPasskey,securityInfo,rotateRecovery,revokePasskey,revokeSession,revokeAllSessions,logout,randomToken,clearCached:()=>saveSession('',''),get session(){return{token:sessionToken,expiresAt:sessionExpiresAt}}};
}

window.AppsPasskeyAuth={version:VERSION,create,randomToken,requestOptions,creationOptions,authResponse,regResponse,b64uToBuf,bufToB64u};
})();
