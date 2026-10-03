import { Auth } from './v1/index.js';
import './v1/ui.js';
import { createMockIdentityProvider, createMockServiceAdapter, resetMockAuthLab } from './lab-mock.js';

const $=id=>document.getElementById(id);
const esc=v=>String(v??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
const fmt=v=>v?JSON.stringify(v,null,2):'—';
const log=(type,detail)=>{
  const row=document.createElement('div');
  row.textContent=new Date().toLocaleTimeString('en-GB')+'  '+type+'  '+(typeof detail==='string'?detail:JSON.stringify(detail));
  $('eventLog').prepend(row);
};

const mockIdentity=createMockIdentityProvider();
const mockService=createMockServiceAdapter(mockIdentity);
let initOptions={appId:'auth-lab',mode:'shadow',migration:{phase:'shadow',authority:'legacy'},identityProvider:mockIdentity,serviceAdapter:mockService};
let usingMock=true;

function migrationClass(m){
  if(m.blocking)return'blocking';
  if(m.consistency==='linked')return'linked';
  return'';
}
function render(){
  const s=Auth.snapshot(),m=s.migration||{};
  $('sdkVersion').textContent=s.version;
  $('sdkStatus').textContent=s.status;
  $('deviceId').textContent=s.deviceId;
  $('effectiveUser').textContent=s.user?.displayName||s.user?.email||s.user?.appUserId||'None';
  $('migrationPhase').textContent=m.phase||'—';
  $('migrationAuthority').textContent=m.authority||'—';
  $('migrationConsistency').textContent=m.consistency||'—';
  $('migrationConsistency').className='pill '+(m.blocking?'bad':m.consistency==='linked'?'ok':m.consistency?.includes('unverified')?'warn':'');
  $('legacyRoles').textContent=(s.permissions?.legacyAppRoles||[]).join(', ')||'None';
  $('centralRoles').textContent=(s.permissions?.centralAppRoles||[]).join(', ')||'None';
  $('snapshot').textContent=fmt(s);
}
async function boot(options=initOptions){
  initOptions=options;
  const s=await Auth.init(options);
  log('init',{mode:s.mode,migration:s.migration});
  render();
}
Auth.onChange(s=>{log('change',{status:s.status,user:s.user?.email||s.user?.appUserId||null,migration:s.migration});render()});
Auth.onSignedIn(s=>log('signedIn',s.user));
Auth.onSignedOut(()=>log('signedOut',''));
Auth.onUserChanged(s=>log('userChanged',s.user));
Auth.onPermissionChanged(s=>log('permissionChanged',s.permissions));

const legacyUsers={
  anonymous:{uid:'legacy-anon-001',isAnonymous:true,providerData:[]},
  parent:{uid:'legacy-parent-001',email:'parent@example.test',displayName:'Legacy parent',isAnonymous:false,providerData:[{providerId:'password'}]},
  other:{uid:'legacy-other-777',email:'other@example.test',displayName:'Different legacy user',isAnonymous:false,providerData:[{providerId:'password'}]}
};
$('legacyAnon').onclick=()=>Auth.setAppIdentity(legacyUsers.anonymous,{roles:['viewer']});
$('legacyParent').onclick=()=>Auth.setAppIdentity(legacyUsers.parent,{roles:['parent']});
$('legacyOther').onclick=()=>Auth.setAppIdentity(legacyUsers.other,{roles:['viewer']});
$('legacyClear').onclick=()=>Auth.setAppIdentity(null,{roles:[]});
$('linkLegacy').onclick=async()=>{
  try{const out=await Auth.linkLegacyIdentity();log('legacy-linked',out);render()}catch(e){log('legacy-link-error',e.message||String(e));alert(e.message||String(e))}
};
$('loadSessions').onclick=async()=>{try{$('serviceOutput').textContent=fmt(await Auth.listSessions())}catch(e){$('serviceOutput').textContent=e.message||String(e)}};
$('loadAudit').onclick=async()=>{try{$('serviceOutput').textContent=fmt(await Auth.getAuditHistory())}catch(e){$('serviceOutput').textContent=e.message||String(e)}};
$('resetMock').onclick=()=>{resetMockAuthLab();location.reload()};
$('authorityLegacy').onclick=()=>boot({...initOptions,mode:'shadow',migration:{phase:'shadow',authority:'legacy'}});
$('authorityCentral').onclick=()=>boot({...initOptions,mode:'linked',migration:{phase:'linked',authority:'central'}});

const scenarios=[
  {id:'none',title:'No authentication',help:'Fresh browser / signed out',central:null,app:null,phase:'shadow',authority:'legacy'},
  {id:'legacy-only',title:'Legacy only',help:'Existing app Firebase session',central:null,app:{appUserId:'uid-A'},phase:'shadow',authority:'legacy'},
  {id:'central-only',title:'Central only',help:'New auth exists, no old app session',central:{globalUserId:'usr-1',appUserId:'uid-A'},app:null,phase:'linked',authority:'central'},
  {id:'linked',title:'Linked identities',help:'Central mapping matches legacy UID',central:{globalUserId:'usr-1',appUserId:'uid-A'},app:{appUserId:'uid-A'},phase:'linked',authority:'central'},
  {id:'mismatch',title:'Stale/wrong legacy login',help:'Central account maps to A; browser still signed into B',central:{globalUserId:'usr-1',appUserId:'uid-A'},app:{appUserId:'uid-B'},phase:'linked',authority:'central'},
  {id:'unverified-shadow',title:'Dual, not linked yet',help:'Safe while legacy remains authority',central:{globalUserId:'usr-1'},app:{appUserId:'uid-A'},phase:'shadow',authority:'legacy'},
  {id:'unverified-cutover',title:'Premature cutover',help:'Central made authoritative before mapping exists',central:{globalUserId:'usr-1'},app:{appUserId:'uid-A'},phase:'linked',authority:'central'}
];
$('scenarioGrid').innerHTML=scenarios.map(s=>'<button class="scenario" data-s="'+s.id+'"><strong>'+esc(s.title)+'</strong><small>'+esc(s.help)+'</small></button>').join('');
document.querySelectorAll('[data-s]').forEach(b=>b.onclick=()=>{
  const s=scenarios.find(x=>x.id===b.dataset.s),m=Auth.assessMigration({centralUser:s.central,appUser:s.app,phase:s.phase,authority:s.authority});
  const out=$('scenarioResult');out.className='result '+migrationClass(m);
  out.innerHTML='<strong>'+esc(s.title)+'</strong><p class="'+(m.blocking?'bad':m.consistency==='linked'?'ok':'')+'"><b>'+esc(m.consistency)+'</b>'+(m.blocking?' · BLOCK writes/privileged actions':'')+'</p><pre class="mono">'+esc(JSON.stringify(m,null,2))+'</pre>';
  log('assessMigration',{scenario:s.id,...m});
});

$('applyConfig').onclick=async()=>{
  try{
    const raw=$('firebaseConfig').value.trim();
    if(!raw)throw new Error('Enter the public Firebase web configuration for a dedicated test identity project.');
    JSON.parse(raw);
    const serviceBaseUrl=$('serviceUrl').value.trim();
    sessionStorage.setItem('auth-lab.firebase-config',raw);
    sessionStorage.setItem('auth-lab.service-url',serviceBaseUrl);
    sessionStorage.setItem('auth-lab.use-live','1');
    location.reload();
  }catch(e){
    $('configMessage').textContent=e.message||String(e);$('configMessage').className='small bad';log('config-error',String(e));
  }
};
$('clearConfig').onclick=()=>{
  sessionStorage.removeItem('auth-lab.firebase-config');sessionStorage.removeItem('auth-lab.service-url');sessionStorage.removeItem('auth-lab.use-live');
  $('firebaseConfig').value='';$('serviceUrl').value='';$('configMessage').textContent='Cleared. Reloading mock mode.';setTimeout(()=>location.reload(),150);
};
$('firebaseConfig').value=sessionStorage.getItem('auth-lab.firebase-config')||'';
$('serviceUrl').value=sessionStorage.getItem('auth-lab.service-url')||'';

const storedCfg=$('firebaseConfig').value.trim(),storedUrl=$('serviceUrl').value.trim(),useLive=sessionStorage.getItem('auth-lab.use-live')==='1';
if(useLive&&storedCfg){
  try{
    const config=JSON.parse(storedCfg);
    initOptions={appId:'auth-lab',mode:'shadow',migration:{phase:'shadow',authority:'legacy'},identity:{firebaseConfig:config,serviceBaseUrl:storedUrl||undefined}};
    usingMock=false;
  }catch(e){log('stored-config-error',String(e))}
}
$('labMode').textContent=usingMock?'mock / no cloud writes':'live test identity project';
boot(initOptions).catch(e=>{log('boot-error',String(e));$('configMessage').textContent=e.message||String(e);$('configMessage').className='small bad'});
