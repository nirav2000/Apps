import { Auth } from './v1/index.js';
import './v1/ui.js';
import { createMockIdentityProvider, createMockServiceAdapter, resetMockAuthLab } from './lab-mock.js';

const $=id=>document.getElementById(id);
const esc=v=>String(v??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[ch]));
const fmt=v=>v?JSON.stringify(v,null,2):'—';

const DESIGNS=[
  {id:'balanced',name:'Balanced',concept:'Concept 1',summary:'A familiar account screen that keeps every major route available without making any one method dominant.',tags:['Familiar','Flexible','General purpose'],mark:'A'},
  {id:'passkey-first',name:'Passkey first',concept:'Concept 2',summary:'The quickest modern route: Face ID, Touch ID or device passkey first, with email and social sign-in secondary.',tags:['Fastest','Modern','Low friction'],mark:'⌘',className:'passkey'},
  {id:'magic-link',name:'Magic link',concept:'Concept 3',summary:'Passwordless by default. Enter an email, receive a secure link, and keep the screen exceptionally calm.',tags:['Calm','Passwordless','Simple'],mark:'✉',className:'magic'},
  {id:'guest-first',name:'Guest first',concept:'Concept 4',summary:'Let someone use the app immediately, then protect the account later without losing progress.',tags:['Inviting','Try first','Learning apps'],mark:'◎',className:'guest'},
  {id:'compact',name:'Compact',concept:'Concept 5',summary:'A smaller conventional sign-in panel for places where authentication should feel quick and unobtrusive.',tags:['Dense','Efficient','Small modal'],mark:'→',className:'compact'}
];

const mockIdentity=createMockIdentityProvider();
const mockService=createMockServiceAdapter(mockIdentity);
let initOptions={appId:'auth-lab',mode:'shadow',migration:{phase:'shadow',authority:'legacy'},identityProvider:mockIdentity,serviceAdapter:mockService};
let usingMock=true;
let currentDesign=0;

const log=(type,detail)=>{
  const target=$('eventLog');if(!target)return;
  const row=document.createElement('div');
  row.textContent=new Date().toLocaleTimeString('en-GB')+'  '+type+'  '+(typeof detail==='string'?detail:JSON.stringify(detail));
  target.prepend(row);
};

function miniPreview(d){
  let extra='';
  if(d.id==='passkey-first')extra='<div class="mini-mark">'+d.mark+'</div><div class="mini-title" style="margin-inline:auto"></div><div class="mini-copy" style="margin-inline:auto"></div><div class="mini-primary"></div><div class="mini-link"></div>';
  else if(d.id==='magic-link')extra='<div class="mini-mark">'+d.mark+'</div><div class="mini-title"></div><div class="mini-copy"></div><div class="mini-input"></div><div class="mini-primary"></div><div class="mini-link"></div>';
  else if(d.id==='guest-first')extra='<div class="mini-mark">'+d.mark+'</div><div class="mini-title"></div><div class="mini-copy"></div><div class="mini-primary"></div><div class="mini-input"></div><div class="mini-link"></div>';
  else if(d.id==='compact')extra='<div class="mini-title"></div><div class="mini-copy"></div><div class="mini-input"></div><div class="mini-input"></div><div class="mini-primary"></div><div class="mini-row"><span></span><span></span><span></span></div>';
  else extra='<div class="mini-mark">'+d.mark+'</div><div class="mini-title"></div><div class="mini-copy"></div><div class="mini-input"></div><div class="mini-input"></div><div class="mini-primary"></div><div class="mini-row"><span></span><span></span><span></span></div>';
  return '<div class="design-mini">'+extra+'</div>';
}

function buildCarousel(){
  const host=$('designCarousel');
  host.innerHTML=DESIGNS.map((d,i)=>'<article class="design-card '+esc(d.className||'')+'" data-index="'+i+'" tabindex="0" role="button" aria-label="'+esc(d.name)+' design"><div class="design-visual">'+miniPreview(d)+'</div><div class="design-meta"><div class="concept">'+esc(d.concept)+'</div><h3>'+esc(d.name)+'</h3><p>'+esc(d.summary)+'</p><div class="card-badges">'+d.tags.map(t=>'<span>'+esc(t)+'</span>').join('')+'</div></div></article>').join('');
  $('carouselDots').innerHTML=DESIGNS.map((d,i)=>'<button data-dot="'+i+'" aria-label="Show '+esc(d.name)+'"></button>').join('');
  host.querySelectorAll('.design-card').forEach(card=>{
    card.addEventListener('click',()=>setDesign(+card.dataset.index));
    card.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();setDesign(+card.dataset.index)}});
  });
  $('carouselDots').querySelectorAll('button').forEach(b=>b.onclick=()=>setDesign(+b.dataset.dot));
  let startX=null;
  host.addEventListener('pointerdown',e=>{startX=e.clientX;host.setPointerCapture?.(e.pointerId)});
  host.addEventListener('pointerup',e=>{
    if(startX===null)return;
    const dx=e.clientX-startX;startX=null;
    if(Math.abs(dx)>45)moveDesign(dx<0?1:-1);
  });
  renderCarousel();
}
function signedDelta(index,current,total){
  let d=(index-current+total)%total;
  if(d>total/2)d-=total;
  return d;
}
function renderCarousel(){
  const cards=[...$('designCarousel').querySelectorAll('.design-card')];
  cards.forEach((card,i)=>{
    const pos=signedDelta(i,currentDesign,DESIGNS.length);
    card.dataset.pos=String(pos);
    card.dataset.hidden=String(Math.abs(pos)>2);
    card.setAttribute('aria-current',pos===0?'true':'false');
  });
  $('carouselDots').querySelectorAll('button').forEach((b,i)=>b.classList.toggle('active',i===currentDesign));
  const d=DESIGNS[currentDesign];
  $('selectedDesignName').textContent=d.name;
  $('selectedDesignSummary').textContent=d.summary;
  $('selectedDesignTags').innerHTML=d.tags.map(t=>'<span>'+esc(t)+'</span>').join('');
  const preferred=localStorage.getItem('auth-lab.preferred-design')||'';
  $('preferDesign').textContent=preferred===d.id?'♥ Preferred':'♡ Mark as preferred';
  $('preferredLabel').textContent=preferred?'Preferred: '+(DESIGNS.find(x=>x.id===preferred)?.name||preferred):'No preferred design yet';
}
function setDesign(i){currentDesign=(i+DESIGNS.length)%DESIGNS.length;renderCarousel()}
function moveDesign(step){setDesign(currentDesign+step)}
$('prevDesign').onclick=()=>moveDesign(-1);
$('nextDesign').onclick=()=>moveDesign(1);
document.addEventListener('keydown',e=>{
  if(document.activeElement?.matches('input,textarea,select'))return;
  if(e.key==='ArrowLeft')moveDesign(-1);
  if(e.key==='ArrowRight')moveDesign(1);
});
$('preferDesign').onclick=()=>{
  const d=DESIGNS[currentDesign],old=localStorage.getItem('auth-lab.preferred-design');
  if(old===d.id)localStorage.removeItem('auth-lab.preferred-design');else localStorage.setItem('auth-lab.preferred-design',d.id);
  renderCarousel();
};

function livePanel(design){
  const panel=document.createElement('apps-auth-panel');
  panel.setAttribute('variant',design.id);
  panel.setAttribute('methods','anonymous,passkey,emailLink,emailPassword,google,apple');
  if(design.id==='balanced')panel.setAttribute('heading','Shared account');
  return panel;
}
function openModalPreview(){
  const d=DESIGNS[currentDesign],dialog=$('authPreviewDialog'),host=$('modalAuthHost');
  host.replaceChildren(livePanel(d));
  $('modalDesignTitle').textContent=d.name;
  if(!dialog.open)dialog.showModal();
  log('design-preview',{design:d.id,mode:'modal'});
}
function openAppPreview(){
  const d=DESIGNS[currentDesign],dialog=$('appPreviewDialog'),layer=$('inAppAuthLayer');
  layer.replaceChildren(livePanel(d));
  layer.classList.add('open');
  if(!dialog.open)dialog.showModal();
  log('design-preview',{design:d.id,mode:'in-app'});
}
$('tryModal').onclick=openModalPreview;
$('tryInApp').onclick=openAppPreview;
document.querySelectorAll('[data-close-dialog]').forEach(b=>b.onclick=()=>$('authPreviewDialog').close());
document.querySelectorAll('[data-close-app]').forEach(b=>b.onclick=()=>$('appPreviewDialog').close());
$('demoAccountButton').onclick=()=>$('inAppAuthLayer').classList.add('open');
$('authPreviewDialog').addEventListener('click',e=>{if(e.target===$('authPreviewDialog'))$('authPreviewDialog').close()});
$('appPreviewDialog').addEventListener('close',()=>$('inAppAuthLayer').classList.remove('open'));

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
  {id:'none',title:'No auth',help:'Fresh browser',central:null,app:null,phase:'shadow',authority:'legacy'},
  {id:'legacy-only',title:'Legacy only',help:'Existing app session',central:null,app:{appUserId:'uid-A'},phase:'shadow',authority:'legacy'},
  {id:'central-only',title:'Central only',help:'New shared auth',central:{globalUserId:'usr-1',appUserId:'uid-A'},app:null,phase:'linked',authority:'central'},
  {id:'linked',title:'Linked',help:'UIDs match',central:{globalUserId:'usr-1',appUserId:'uid-A'},app:{appUserId:'uid-A'},phase:'linked',authority:'central'},
  {id:'mismatch',title:'Mismatch',help:'Stale/wrong legacy',central:{globalUserId:'usr-1',appUserId:'uid-A'},app:{appUserId:'uid-B'},phase:'linked',authority:'central'},
  {id:'unverified-shadow',title:'Unverified',help:'Safe shadow',central:{globalUserId:'usr-1'},app:{appUserId:'uid-A'},phase:'shadow',authority:'legacy'},
  {id:'unverified-cutover',title:'Early cutover',help:'Must block',central:{globalUserId:'usr-1'},app:{appUserId:'uid-A'},phase:'linked',authority:'central'}
];
$('scenarioGrid').innerHTML=scenarios.map(s=>'<button class="scenario" data-s="'+s.id+'"><strong>'+esc(s.title)+'</strong><small>'+esc(s.help)+'</small></button>').join('');
document.querySelectorAll('[data-s]').forEach(b=>b.onclick=()=>{
  const s=scenarios.find(x=>x.id===b.dataset.s),m=Auth.assessMigration({centralUser:s.central,appUser:s.app,phase:s.phase,authority:s.authority});
  const out=$('scenarioResult');out.className='result compact-result '+migrationClass(m);
  out.innerHTML='<strong>'+esc(s.title)+'</strong><p class="'+(m.blocking?'bad':m.consistency==='linked'?'ok':'')+'"><b>'+esc(m.consistency)+'</b>'+(m.blocking?' · BLOCK writes/privileged actions':'')+'</p><pre class="mono">'+esc(JSON.stringify(m,null,2))+'</pre>';
  log('assessMigration',{scenario:s.id,...m});
});

$('applyConfig').onclick=()=>{
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
$('labMode').textContent=usingMock?'Mock auth · no cloud writes':'Live test identity project';
buildCarousel();
boot(initOptions).catch(e=>{log('boot-error',String(e));$('configMessage').textContent=e.message||String(e);$('configMessage').className='small bad'});
