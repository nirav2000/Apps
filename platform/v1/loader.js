(function(){
'use strict';
if(window.AppsPlatformLoaderV1)return;
const script=document.currentScript;
const CORE=(script?.src||'https://nirav2000.github.io/Apps/platform/v1/loader.js').replace(/loader\.js(?:\?.*)?$/,'index.js');
const manifestUrl=script?.dataset?.appManifest||script?.getAttribute('data-manifest')||'';
const inlineAppId=script?.dataset?.appId||'';
const loadScript=url=>new Promise((resolve,reject)=>{const s=document.createElement('script');s.src=url;s.async=false;s.onload=resolve;s.onerror=()=>reject(new Error('Could not load Apps Platform core'));document.head.appendChild(s)});
async function fetchManifest(url){const r=await fetch(url,{cache:'no-store'});if(!r.ok)throw new Error('Could not load app manifest ('+r.status+')');return r.json()}
async function boot(options={}){
  if(!window.AppsPlatformV1)await loadScript(CORE);
  const manifest=options.manifest||((options.manifestUrl||manifestUrl)?await fetchManifest(options.manifestUrl||manifestUrl):{});
  const appId=options.appId||inlineAppId||manifest.appId;
  return window.AppsPlatformV1.init({...options,appId,manifest});
}
window.AppsPlatformLoaderV1={version:'1.0.0',boot};
if(script?.dataset?.auto!=='false'&&(manifestUrl||inlineAppId)){
  boot().catch(error=>window.dispatchEvent(new CustomEvent('apps-platform:error',{detail:{error:String(error)}})));
}
})();