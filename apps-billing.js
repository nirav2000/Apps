(function(){
'use strict';
if(window.AppsBilling)return;
const VERSION=1;
let cfg={endpoint:'',app:'App',tokenProvider:null,plans:[]};
const clean=(v,n=300)=>String(v??'').trim().slice(0,n);
function configure(next={}){cfg={...cfg,...next,endpoint:clean(next.endpoint||cfg.endpoint,300).replace(/\/$/,'')};return api}
async function token(){if(typeof cfg.tokenProvider!=='function')throw new Error('Billing token provider is not configured.');const t=await cfg.tokenProvider();if(!t)throw new Error('Sign in before using billing.');return t}
async function request(path,{method='GET',body}={}){
  if(!cfg.endpoint)throw new Error('Billing endpoint is not configured.');
  const headers={Authorization:'Bearer '+await token()};if(body!==undefined)headers['Content-Type']='application/json';
  const r=await fetch(cfg.endpoint+path,{method,headers,body:body===undefined?undefined:JSON.stringify(body),cache:'no-store'});
  let data=null;try{data=await r.json()}catch{}
  if(!r.ok)throw new Error(data?.error||data?.message||('Billing request failed ('+r.status+')'));
  return data;
}
const api={version:VERSION,configure,plans:()=>cfg.plans.slice(),status:projectId=>request('/billing/entitlement?projectId='+encodeURIComponent(projectId)),checkout:(projectId,planId,returnUrl)=>request('/billing/checkout',{method:'POST',body:{projectId,planId,returnUrl}}),verify:(projectId,sessionId)=>request('/billing/verify',{method:'POST',body:{projectId,sessionId}})};
window.AppsBilling=api;
})();