(function(){
'use strict';
if(window.VersionLabAccess)return;
const CLOUD='https://apps-monitor-api.nirav2000-github.workers.dev/app-monitor';
const SESSION_STORE='app-monitor.admin-session.v2';
const AUTH_SRC='https://nirav2000.github.io/Apps/apps-passkey-auth.js?v=1';
const load=src=>new Promise((resolve,reject)=>{const s=document.createElement('script');s.src=src;s.onload=resolve;s.onerror=()=>reject(new Error('Could not load shared passkey authentication'));document.head.appendChild(s)});
async function auth(){
  if(!window.AppsPasskeyAuth)await load(AUTH_SRC);
  const client=window.AppsPasskeyAuth.create({
    baseUrl:CLOUD,
    sessionStoreKey:SESSION_STORE,
    failureStoreKey:'app-monitor.auth-failures.v2'
  });
  client.restoreSession();
  return client;
}
async function validate(){const c=await auth();return c.validateSession()}
async function passkey(){const c=await auth();return c.passkeyLogin()}
function centralUrl(appId,returnUrl){
  const u=new URL('https://nirav2000.github.io/Apps/version-lab/');
  u.searchParams.set('app',appId);
  if(returnUrl)u.searchParams.set('from',returnUrl);
  return u.href;
}
async function unlockAndOpen(appId,options={}){
  let session=await validate().catch(()=>null);
  if(!session)session=await passkey();
  const url=centralUrl(appId,location.href);
  if(options.sameTab===false)window.open(url,'_blank','noopener');else location.href=url;
  return session;
}
window.VersionLabAccess={version:1,validate,passkey,unlockAndOpen,centralUrl};
})();