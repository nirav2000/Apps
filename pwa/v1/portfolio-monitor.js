// Read-only portfolio audit. Registry status is NOT proof of installation on a user's device.
const REGISTRY='/Apps/pwa/v1/registry.json';
const label=(value)=>String(value||'').replace(/[<>]/g,'');
const urlFor=(app)=>app.manifest_url||((app.scope||'').startsWith('/')?app.scope+'manifest.webmanifest':null);
async function fetchFresh(url){
 try{
  const resolved=new URL(url,location.origin);
  if(resolved.origin!==location.origin)return{ok:false,reason:'different origin'};
  const response=await fetch(resolved.href,{cache:'no-store',headers:{'X-Apps-PWA-Audit':'1'}});
  return{ok:response.ok,status:response.status,response};
 }catch(error){return{ok:false,reason:String(error?.message||error)};}
}
function resolveIcon(icon,manifestUrl){
 try{
  const url=new URL(icon.src,manifestUrl);
  return url.origin===location.origin?url.href:null;
 }catch{return null;}
}
async function inspect(id,app,registrations){
 const result={id,name:app.name||id,start:app.start_url||'#',manifest:'unverified',icons:'unverified',worker:'unverified',detail:''};
 const manifestUrl=urlFor(app);
 if(!manifestUrl){result.detail='No manifest URL recorded';return result;}
 const reply=await fetchFresh(manifestUrl);
 if(!reply.ok){result.manifest='missing';result.detail='No manifest found at the recorded/expected path '+manifestUrl+' (the app may use a different filename)';return result;}
 let manifest;
 try{manifest=await reply.response.json();}catch{result.manifest='invalid';result.detail='Manifest is not JSON';return result;}
 if(manifest.display!=='standalone'||!manifest.start_url||!manifest.scope||!Array.isArray(manifest.icons)){
  result.manifest='invalid';result.detail='Missing standalone, start URL, scope or icons';return result;
 }
 result.manifest='valid';
 const available=manifest.icons.filter(i=>i.src);
 const installSizes=['192x192','512x512'];
 const hasSizes=installSizes.every(s=>available.some(i=>i.sizes?.split(/\s+/).includes(s)));
 if(!hasSizes){result.icons='incomplete';result.detail='192px/512px icon declarations are missing';}
 else {
  const checks=await Promise.all(available.map(i=>resolveIcon(i,new URL(manifestUrl,location.origin).href)).filter(Boolean).map(fetchFresh));
  result.icons=checks.length&&checks.every(x=>x.ok)?'valid':'missing';
  if(result.icons==='missing')result.detail='At least one icon asset could not be fetched';
 }
 const scope=new URL(manifest.scope,new URL(manifestUrl,location.origin)).href;
 result.worker=registrations.some(r=>r.scope===scope)?'registered on this device':'not registered on this device';
 if(!result.detail)result.detail='Static asset checks only; device install and offline behaviour need on-device testing';
 return result;
}
function cell(value){
 const span=document.createElement('span');span.textContent=value;
 span.style.fontWeight=/^(valid|registered on)/.test(value)?'650':'400';
 span.style.color=/^(missing|invalid|incomplete)/.test(value)?'#b34332':'inherit';
 return span;
}
export async function mountPWAPortfolio(root){
 root.textContent='Checking public manifests and icon files…';
 try{
  const response=await fetchFresh(REGISTRY);if(!response.ok)throw Error('Shared PWA registry unavailable');
  const registry=await response.response.json();
  let registrations=[];
  if('serviceWorker'in navigator)try{registrations=await navigator.serviceWorker.getRegistrations();}catch{}
  const entries=await Promise.all(Object.entries(registry.apps||{}).map(([id,app])=>inspect(id,app,registrations)));
  const valid=entries.filter(x=>x.manifest==='valid'&&x.icons==='valid').length;
  const summary=document.createElement('p');
  summary.textContent=valid+' of '+entries.length+' registry entries have verified public manifests and icon URLs. Local installation is not implied.';
  const outer=document.createElement('div');outer.style.overflowX='auto';
  const table=document.createElement('table');table.style.width='100%';table.style.borderCollapse='collapse';table.style.fontSize='13px';
  const header=document.createElement('tr');
  for(const label of ['Application','Manifest','Icons','Worker (this device)','Verification notes']){
   const th=document.createElement('th');th.textContent=label;th.style.textAlign='left';th.style.padding='9px';th.style.borderBottom='1px solid #dce4e8';header.append(th);
  }
  table.append(header);
  for(const item of entries){
   const tr=document.createElement('tr');
   const tdName=document.createElement('td');
   const a=document.createElement('a');a.href=item.start;a.textContent=item.name;a.rel='noopener';tdName.append(a);
   const values=[tdName,cell(item.manifest),cell(item.icons),cell(item.worker),cell(item.detail)];
   for(const value of values){const td=document.createElement('td');td.style.padding='9px';td.style.verticalAlign='top';td.style.borderBottom='1px solid #edf2f5';td.append(value);tr.append(td);}
   table.append(tr);
  }
  outer.append(table);
  root.replaceChildren(summary,outer);
  return entries;
 }catch(error){
  root.textContent='PWA audit unavailable: '+String(error.message||error);
  return [];
 }
}
const initial=document.querySelector('[data-pwa-portfolio]');
if(initial)mountPWAPortfolio(initial);
