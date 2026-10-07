(function(){
'use strict';
if(window.AppsPlatformV1)return;
const PLATFORM_VERSION='1.5.0';
const ROOT=(document.currentScript?.src||'https://nirav2000.github.io/Apps/platform/v1/index.js').replace(/\/platform\/v1\/index\.js(?:\?.*)?$/,'/');
const CAPABILITIES={
  auth:{src:'auth/v1/index.js',module:true,exportName:'Auth'},
  identity:{src:'apps-auth.js?v=1',global:'AppsAuth'},
  account:{src:'apps-account.js?v=2',global:'AppsAccount'},
  privacy:{src:'apps-privacy.js?v=2',global:'AppsPrivacy'},
  billing:{src:'apps-billing.js?v=1',global:'AppsBilling'},
  pronunciation:{src:'apps-pronunciation.js?v=3',global:'AppsPronunciation'},
  monitor:{src:'app-monitor.js?v=5',global:'AppMonitor'},
  firebaseUsage:{src:'firebase-usage-monitor.js',global:'FirebaseUsageMonitor'},
  notifications:{src:'notifications/v1/index.js',module:true},
  pwa:{src:'pwa/v1/index.js',module:true},
  notes:{src:'notes/v1/index.js',module:true,exportName:'Notes'}
};
const loaded=new Map();
function script(url,global){
  if(global&&window[global])return Promise.resolve(window[global]);
  if(loaded.has(url))return loaded.get(url);
  const p=new Promise((resolve,reject)=>{const s=document.createElement('script');s.src=url;s.async=false;s.onload=()=>resolve(global?window[global]:true);s.onerror=()=>reject(new Error('Apps Platform could not load '+url));document.head.appendChild(s)});
  loaded.set(url,p);return p;
}
function normaliseManifest(config={}){
  const manifest=config.manifest||{};
  return {
    appId:String(config.appId||manifest.appId||'').trim(),
    capabilities:{...(manifest.capabilities||{}),...(config.capabilities||{})},
    ui:{mode:'auto',...(manifest.ui||{}),...(config.ui||{})},
    versionLab:{enabled:false,developerOnly:true,...(manifest.versionLab||{}),...(config.versionLab||{})},
    meta:{...(manifest.meta||{}),...(config.meta||{})}
  };
}
async function loadCapability(name,options={},context={}){
  const def=CAPABILITIES[name];if(!def)throw new Error('Unknown Apps Platform capability: '+name);
  let value;
  if(def.module){
    const mod=await import(ROOT+def.src);
    value=mod[def.exportName]||mod.default||mod;
  }else value=await script(ROOT+def.src,def.global);
  if(options&&typeof value?.init==='function'){
    const initOptions=name==='auth'?{appId:context.appId,...options}:options;
    await value.init(initOptions);
  }
  return value;
}
async function init(config={}){
  const manifest=normaliseManifest(config);
  if(!manifest.appId)throw new Error('AppsPlatformV1.init requires appId');
  if(manifest.versionLab?.developerOnly!==true)throw new Error('Version Lab must remain developerOnly in Apps Platform v1');
  const requested=Object.entries(manifest.capabilities).filter(([,v])=>v!==false&&v!=null);
  const services={};
  for(const [name,options] of requested)services[name]=await loadCapability(name,options===true?{}:options,{appId:manifest.appId});
  const api={version:PLATFORM_VERSION,appId:manifest.appId,manifest,services,loadCapability};
  window.dispatchEvent(new CustomEvent('apps-platform:ready',{detail:{appId:manifest.appId,version:PLATFORM_VERSION,capabilities:Object.keys(services)}}));
  return api;
}
window.AppsPlatformV1={version:PLATFORM_VERSION,root:ROOT,capabilities:CAPABILITIES,init,loadCapability};
})();