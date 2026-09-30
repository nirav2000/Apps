(function(){
'use strict';
if(window.VersionLabReadOnly)return;
const cfg=window.__VERSION_LAB_READONLY_CONFIG__||{};
const deny=(reason,url)=>{const e=new Error('Version Lab read-only adapter blocked '+reason+(url?' · '+url:''));window.dispatchEvent(new CustomEvent('version-lab:blocked-write',{detail:{reason,url}}));throw e};
const text=v=>String(v||'');
const method=v=>text(v||'GET').toUpperCase();
const escapeRe=s=>String(s).replace(/[.*+?^\$\{\}()|[\]\\]/g,'\\$&');
const patterns=(cfg.allowReadPostPatterns||[':runQuery',':batchGet',':listDocuments','/Listen/channel','/documents:listen']).map(x=>new RegExp(escapeRe(x),'i'));
const blockedPatterns=(cfg.blockPatterns||[':commit',':batchWrite','/Write/channel','/documents:commit','/documents:batchWrite','/upload','/delete','/remove','/update','/create','/mutate']).map(x=>new RegExp(escapeRe(x),'i'));
function allowedOrigin(url){try{const u=new URL(url,location.href);const list=cfg.allowedOrigins||[];return u.origin===location.origin||list.includes(u.origin)}catch{return false}}
function bodyLooksLikeWrite(body){if(!body)return false;const s=typeof body==='string'?body:'';return /"writes"\s*:|"write"\s*:|"delete"\s*:|"update"\s*:|"create"\s*:/i.test(s)}
function decision(url,m,body){
 const u=text(url);
 if(m==='GET'||m==='HEAD'||m==='OPTIONS')return {allow:allowedOrigin(u),reason:'cross-origin read not allowlisted'};
 if(blockedPatterns.some(r=>r.test(u))||bodyLooksLikeWrite(body))return {allow:false,reason:'write operation'};
 if(m==='POST'&&patterns.some(r=>r.test(u))&&allowedOrigin(u))return {allow:true};
 return {allow:false,reason:'non-read request'};
}
const nativeFetch=window.fetch.bind(window);
window.fetch=function(input,init={}){
 const url=typeof input==='string'?input:input?.url;
 const m=method(init.method||(typeof input!=='string'&&input?.method));
 const d=decision(url,m,init.body);
 if(!d.allow)return Promise.reject((()=>{try{return deny(d.reason,url)}catch(e){return e}})());
 return nativeFetch(input,init);
};
const XHR=window.XMLHttpRequest;
if(XHR){
 const open=XHR.prototype.open,send=XHR.prototype.send;
 XHR.prototype.open=function(m,url){this.__vlMethod=method(m);this.__vlUrl=url;return open.apply(this,arguments)};
 XHR.prototype.send=function(body){const d=decision(this.__vlUrl,this.__vlMethod,body);if(!d.allow)return deny(d.reason,this.__vlUrl);return send.apply(this,arguments)};
}
if(navigator.sendBeacon)navigator.sendBeacon=function(url){window.dispatchEvent(new CustomEvent('version-lab:blocked-write',{detail:{reason:'sendBeacon disabled',url}}));return false};
if(window.WebSocket){const NativeWebSocket=window.WebSocket;window.WebSocket=function(){return deny('WebSocket disabled in read-only historical snapshot',arguments[0])};window.WebSocket.prototype=NativeWebSocket.prototype}
document.addEventListener('submit',e=>{e.preventDefault();window.dispatchEvent(new CustomEvent('version-lab:blocked-write',{detail:{reason:'form submission disabled'}}))},true);
window.VersionLabReadOnly={version:1,config:cfg,mode:'read-only-adapter'};
window.dispatchEvent(new CustomEvent('version-lab:readonly-ready',{detail:{config:cfg}}));
})();