(function(){
'use strict';
if(window.AppsPlatform)return;
const VERSION=3;
const BASE=(document.currentScript?.src||'').replace(/\/[^/]*$/,'/');
const modules=['apps-privacy.js?v=2','apps-auth.js?v=1','apps-account.js?v=2','apps-billing.js?v=1','apps-pronunciation.js?v=1'];
const globals={
  'apps-privacy':'AppsPrivacy',
  'apps-auth':'AppsAuth',
  'apps-account':'AppsAccount',
  'apps-billing':'AppsBilling',
  'apps-pronunciation':'AppsPronunciation'
};
const load=src=>new Promise((resolve,reject)=>{const s=document.createElement('script');s.src=BASE+src;s.async=false;s.onload=resolve;s.onerror=()=>reject(new Error('Could not load '+src));document.head.appendChild(s)});
const ready=(async()=>{for(const src of modules){const key=src.split('?')[0].replace('.js',''),global=globals[key];if(!window[global])await load(src)}return window.AppsPlatform})();
window.AppsPlatform={version:VERSION,ready};
})();