(function(){
'use strict';
const CLOUD='https://apps-monitor-api.nirav2000-github.workers.dev/app-monitor';
const SESSION_STORE='app-monitor.admin-session.v2';
const $=id=>document.getElementById(id);
const esc=s=>String(s??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
let registry=[],selected=null,releases=[],syncing=false;
function getSession(){try{return JSON.parse(localStorage.getItem(SESSION_STORE)||'null')}catch{return null}}
async function verifyDeveloper(){
  const s=getSession();if(!s?.token)return false;
  try{
    const r=await fetch(CLOUD+'/auth/session',{headers:{'X-App-Monitor-Session':s.token},cache:'no-store'});
    if(!r.ok)return false;const d=await r.json();
    $('locked').classList.add('hidden');$('unlocked').classList.remove('hidden');$('lab').classList.remove('hidden');
    $('sessionText').textContent='Authenticated via '+(d.method||'admin session')+(d.expiresAt?' · expires '+new Date(d.expiresAt).toLocaleString():'');
    return true;
  }catch{return false}
}
function badge(a){if(a.status==='reference')return '<span class="pill reference">Reference</span>';if(a.managed)return '<span class="pill reference">Managed</span>';return '<span class="pill legacy">'+esc(a.status||'legacy')+'</span>'}
async function loadRegistry(){
  const d=await fetch('./apps.json',{cache:'no-store'}).then(r=>r.json());registry=d.apps||[];
  $('appGrid').innerHTML=registry.map(a=>'<article class="app-card" data-app="'+esc(a.appId)+'"><div class="top"><h3>'+esc(a.name||a.appId)+'</h3>'+badge(a)+'</div><p class="muted small">'+esc(a.notes||'')+'</p><div class="mono">'+esc(a.repository||'')+'</div></article>').join('');
  $('appGrid').querySelectorAll('[data-app]').forEach(c=>c.onclick=()=>selectApp(c.dataset.app));
  const wanted=new URLSearchParams(location.search).get('app');if(wanted&&registry.some(a=>a.appId===wanted))selectApp(wanted);
}
async function selectApp(id){
  selected=registry.find(a=>a.appId===id);if(!selected)return;
  document.querySelectorAll('.app-card').forEach(c=>c.classList.toggle('selected',c.dataset.app===id));
  $('appTitle').textContent=selected.name||selected.appId;
  $('appMeta').textContent=(selected.managed?'Managed shared Version Lab':'Not yet managed by full shared Version Lab')+' · '+selected.repository;
  $('openLive').href=selected.liveUrl;$('openLive').classList.remove('hidden');
  $('openRepo').href='https://github.com/'+selected.repository;$('openRepo').classList.remove('hidden');
  $('appStatus').innerHTML='<div class="timeline-item"><strong>Status</strong><div>'+esc(selected.status||'unknown')+'</div></div><div class="timeline-item"><strong>Managed</strong><div>'+(selected.managed?'Yes':'No — existing implementation remains untouched')+'</div></div><div class="timeline-item"><strong>Developer UI</strong><div>Central only; consuming app exposes no Version Lab control.</div></div>';
  await loadReleases();
}
async function loadReleases(){
  releases=[];$('releasePanel').classList.add('hidden');$('comparePanel').classList.add('hidden');
  if(!selected)return;
  if(selected.managed){
    try{const d=await fetch(selected.releaseManifest||selected.liveUrl+'version-lab-data/releases.json',{cache:'no-store'}).then(r=>{if(!r.ok)throw Error('manifest unavailable');return r.json()});releases=d.releases||[]}catch{}
  }else if(selected.appId==='beyond100'){
    try{
      const text=await fetch('https://raw.githubusercontent.com/'+selected.repository+'/main/versions-data.js',{cache:'no-store'}).then(r=>r.text());
      const marker='window.BEYOND100_RELEASES = ';const start=text.indexOf(marker);if(start>=0){const js=text.slice(start+marker.length).replace(/;\s*$/,'');const obj=Function('return ('+js+')')();releases=(obj.releases||[]).map(r=>({...r,checkpointId:r.version,productVersion:r.version,commit:r.ref,sourceUrl:'https://github.com/'+selected.repository+'/tree/'+encodeURIComponent(r.ref),snapshotSafety:r.status==='current'?'interactive-safe':'visual-only'}))}
    }catch{}
  }
  if(!releases.length){$('appStatus').insertAdjacentHTML('beforeend','<div class="timeline-item"><strong>Checkpoint data</strong><div>No managed checkpoint manifest is available yet.</div></div>');return}
  $('releasePanel').classList.remove('hidden');
  const opts=releases.map(r=>'<option value="'+esc(r.checkpointId||r.version)+'">'+esc(r.productVersion||r.version||r.checkpointId)+' · '+esc(r.title||'Checkpoint')+'</option>').join('');
  $('leftVersion').innerHTML=opts;$('rightVersion').innerHTML=opts;if(releases.length>1)$('leftVersion').selectedIndex=1;
  $('releaseGrid').innerHTML=releases.map(r=>'<article class="release-card"><div class="top"><strong>'+esc(r.productVersion||r.version||r.checkpointId)+'</strong><span class="pill">'+esc(r.snapshotSafety||'unknown')+'</span></div><h3>'+esc(r.title||'Checkpoint')+'</h3><p>'+esc(r.summary||'')+'</p><div class="muted small">'+esc(r.date||r.createdAt||'')+'</div></article>').join('');
  $('compare').onclick=compare;
}
function byId(id){return releases.find(r=>(r.checkpointId||r.version)===id)}
function source(r){return r.sourceUrl||('https://github.com/'+selected.repository+'/tree/'+encodeURIComponent(r.commit||r.ref||'main'))}
function snapshot(r){return r.snapshotUrl||r.snapshot||null}
async function loadFrame(side,r){
  const frame=$(side+'Frame'),title=$(side+'Title'),status=$(side+'Status'),link=$(side+'Source');
  title.textContent=(r.productVersion||r.version||r.checkpointId)+' · '+(r.title||'Checkpoint');link.href=source(r);
  const snap=snapshot(r);
  if(!snap){frame.srcdoc='<div style="font-family:system-ui;padding:28px"><h2>Snapshot unavailable</h2><p>This checkpoint currently has source/history only.</p></div>';status.textContent='Source only · '+(r.snapshotSafety||'unknown');return}
  frame.removeAttribute('srcdoc');
  const manifestBase=selected.releaseManifest||selected.liveUrl;
  frame.src=new URL(snap,manifestBase).href;
  status.textContent=r.snapshotSafety||'snapshot';
}
async function compare(){const l=byId($('leftVersion').value),r=byId($('rightVersion').value);if(!l||!r)return;$('comparePanel').classList.remove('hidden');await Promise.all([loadFrame('left',l),loadFrame('right',r)])}
function wire(a,b){a.addEventListener('load',()=>{try{a.contentWindow.addEventListener('scroll',()=>{if(!$('syncScroll').checked||syncing)return;const ad=a.contentDocument.documentElement,bd=b.contentDocument.documentElement,am=Math.max(0,ad.scrollHeight-a.contentWindow.innerHeight),bm=Math.max(0,bd.scrollHeight-b.contentWindow.innerHeight),ratio=am?a.contentWindow.scrollY/am:0;syncing=true;b.contentWindow.scrollTo(0,bm*ratio);setTimeout(()=>syncing=false,60)},{passive:true})}catch{}})}
wire($('leftFrame'),$('rightFrame'));wire($('rightFrame'),$('leftFrame'));
verifyDeveloper().then(ok=>{if(ok)loadRegistry()});
})();