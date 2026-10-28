(function(){
'use strict';
const CLOUD='https://apps-monitor-api.nirav2000-github.workers.dev/app-monitor';
const SESSION_STORE='app-monitor.admin-session.v2';
const REVIEW_API=CLOUD+'/version-lab/review';
const $=id=>document.getElementById(id);
const esc=s=>String(s??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
let registry=[],selected=null,releases=[],comparisonNotes=[],decisions={};
let selectionEpoch=0,releaseLimit=12;
function freshUrl(url){const u=new URL(url,location.href);u.searchParams.set('_vl',String(Date.now()));return u.href}
function setReleaseStatus(message){const el=$('releaseLoading');if(el)el.textContent=message}

function getSession(){try{return JSON.parse(localStorage.getItem(SESSION_STORE)||'null')}catch{return null}}
function storageKey(kind){return 'apps.version-lab.'+(selected?.appId||'unknown')+'.'+kind+'.v2'}
function loadLocal(key,fallback){try{return JSON.parse(localStorage.getItem(key)||JSON.stringify(fallback))}catch{return fallback}}
function saveNotes(){localStorage.setItem(storageKey('comparison-notes'),JSON.stringify(comparisonNotes));renderComparisonNotes()}
function saveDecisions(){localStorage.setItem(storageKey('decisions'),JSON.stringify(decisions));renderDecisionSummary()}
function reviewHeaders(){
  const s=getSession();
  return {'Content-Type':'application/json',...(s?.token?{'X-App-Monitor-Session':s.token}:{})};
}
async function reviewRequest(method='GET',body=null){
  if(!selected?.appId)return null;
  const url=method==='GET'?REVIEW_API+'?appId='+encodeURIComponent(selected.appId):REVIEW_API;
  const r=await fetch(url,{method,headers:reviewHeaders(),cache:'no-store',body:body?JSON.stringify({appId:selected.appId,...body}):undefined});
  if(!r.ok)throw new Error('Version Lab review sync '+r.status);
  return r.json();
}
async function loadCloudReview(appId,epoch){
  // Never block card selection or let a previous app's response replace this app's notes.
  const controller=new AbortController(), timer=setTimeout(()=>controller.abort(),3500);
  try{
    const r=await fetch(REVIEW_API+'?appId='+encodeURIComponent(appId),{
      method:'GET',headers:reviewHeaders(),signal:controller.signal,cache:'no-store'
    });
    if(!r.ok)throw new Error('Version Lab review sync '+r.status);
    const d=await r.json();
    if(epoch!==selectionEpoch||selected?.appId!==appId||!d)return;
    comparisonNotes=Array.isArray(d.comparisonNotes)?d.comparisonNotes:comparisonNotes;
    decisions=d.decisions&&typeof d.decisions==='object'?d.decisions:decisions;
    localStorage.setItem(storageKey('comparison-notes'),JSON.stringify(comparisonNotes));
    localStorage.setItem(storageKey('decisions'),JSON.stringify(decisions));
    if(!($('comparePanel')?.classList.contains('hidden')))renderComparisonNotes();
    if(!($('decisionPanel')?.classList.contains('hidden')))renderDecisions();
  }catch(e){
    console.warn('Version Lab cloud review unavailable; using local cache.',e);
  }finally{clearTimeout(timer)}
}
function idOf(r){return r?.checkpointId||r?.version||''}
function versionGroups(){const seen=new Map();for(const item of releases){const version=versionOf(item);if(!seen.has(version))seen.set(version,{version,latest:item,checkpoints:[]});seen.get(version).checkpoints.push(item)}return [...seen.values()]}
function checkpointLabel(r){return (r.commit?String(r.commit).slice(0,8):idOf(r))+(dateLabel(r)?' · '+dateLabel(r):'')}
function versionOf(r){return r?.productVersion||r?.version||r?.checkpointId||'Checkpoint'}
function release(id){return releases.find(r=>idOf(r)===id)||releases[0]}
function source(r){return r.sourceUrl||('https://github.com/'+selected.repository+'/tree/'+encodeURIComponent(r.commit||r.ref||'main'))}
function rawSnapshot(r){
  const snap=r.snapshotUrl||r.snapshot||null;if(!snap)return null;
  const base=selected.releaseManifest||selected.liveUrl;
  return new URL(snap,base).href;
}
function screenshotUrl(r){
  const target=rawSnapshot(r);
  if(!target)return '';
  const u=new URL(target);
  u.searchParams.set('version_lab_preview','1');u.searchParams.set('app_monitor_source','version-lab-preview');
  return 'https://image.thum.io/get/width/900/crop/520/noanimate/'+u.toString();
}
function dateLabel(r){
  const v=r.date||r.createdAt;if(!v)return '';
  const d=new Date(v);return Number.isNaN(d.getTime())?String(v):d.toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric'});
}
function pairIds(){return [$('leftVersion')?.value,$('rightVersion')?.value].filter(Boolean)}
function samePair(note,a,b){const v=note.versions||[];return v.length===2&&v.includes(a)&&v.includes(b)}
function decisionKey(version,area){return version+':'+area}

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
function badge(a){
  if(a.status==='reference')return '<span class="pill reference">Reference</span>';
  if(a.status==='history-imported')return '<span class="pill legacy">History imported</span>';
  if(a.managed)return '<span class="pill reference">Managed</span>';
  return '<span class="pill legacy">'+esc(a.status||'legacy')+'</span>';
}
async function loadRegistry(){
  const d=await fetch('./apps.json',{cache:'no-store'}).then(r=>r.json());registry=d.apps||[];
  $('appGrid').innerHTML=registry.map(a=>'<article class="app-card" data-app="'+esc(a.appId)+'" role="button" tabindex="0" aria-pressed="false"><div class="top"><h3>'+esc(a.name||a.appId)+'</h3>'+badge(a)+'</div><p class="muted small">'+esc(a.notes||'')+'</p><div class="mono">'+esc(a.repository||'')+'</div></article>').join('');
  $('appGrid').querySelectorAll('[data-app]').forEach(c=>{
    c.onclick=()=>selectApp(c.dataset.app);
    c.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();selectApp(c.dataset.app)}};
  });
  $('refreshVersions').onclick=()=>{if(selected)selectApp(selected.appId)};
  const wanted=new URLSearchParams(location.search).get('app');
  if(wanted&&registry.some(a=>a.appId===wanted))selectApp(wanted);
}
function selectApp(id){
  const app=registry.find(a=>a.appId===id);if(!app)return;
  const epoch=++selectionEpoch;
  selected=app;releases=[];releaseLimit=12;
  comparisonNotes=loadLocal(storageKey('comparison-notes'),[]);
  decisions=loadLocal(storageKey('decisions'),{});
  // Paint selection immediately. Slow review sync and history requests happen afterwards.
  document.querySelectorAll('.app-card').forEach(c=>{
    const active=c.dataset.app===id;
    c.classList.toggle('selected',active);
    c.setAttribute('aria-pressed',String(active));
  });
  $('appTitle').textContent=app.name||app.appId;
  $('appMeta').textContent=(app.managed?'Managed shared Version Lab':'Not yet managed by full shared Version Lab')+' · '+app.repository;
  $('openLive').href=app.liveUrl;$('openLive').classList.remove('hidden');
  $('openRepo').href='https://github.com/'+app.repository;$('openRepo').classList.remove('hidden');
  ['releasePanel','comparePanel','decisionPanel'].forEach(panel=>$(panel)?.classList.add('hidden'));
  $('appStatus').innerHTML='<div class="timeline-item"><strong>Status</strong><div>'+esc(app.status||'unknown')+'</div></div>'+
    '<div class="timeline-item"><strong>Managed</strong><div>'+(app.managed?'Yes':'No — existing implementation remains untouched')+'</div></div>'+
    '<div class="timeline-item"><strong>Developer UI</strong><div>Central/shared only. The release app exposes no Version Lab control.</div></div>'+
    '<div class="timeline-item loading-history" role="status"><strong>Release history</strong><div id="releaseLoading">Loading '+esc(app.name||app.appId)+' versions…</div></div>';
  if(app.legacyUrl)$('appStatus').insertAdjacentHTML('beforeend','<div class="timeline-item"><strong>Original legacy viewer</strong><div><a href="'+esc(app.legacyUrl)+'" target="_blank" rel="noopener">Open existing '+esc(app.name)+' viewer</a></div><div class="muted small">This separate viewer may connect to live services. Use for reference; historical replay is not isolated or safety-verified.</div></div>');
  // The UI already reflects the selected app before either request begins.
  void loadReleases(app,epoch);
  void loadCloudReview(app.appId,epoch);
}
async function loadReleases(app,epoch){
  if(!app)return;
  if(app.managed){
    try{
      const manifest=app.releaseManifest||app.liveUrl+'version-lab-data/releases.json';
      const d=await fetch(freshUrl(manifest),{cache:'no-store'}).then(r=>{if(!r.ok)throw Error('Manifest HTTP '+r.status);return r.json()});
      if(epoch!==selectionEpoch||selected?.appId!==app.appId)return;
      if(!Array.isArray(d.releases))throw Error('No valid release array returned');
      releases=d.releases;
      setReleaseStatus(releases.length+' checkpoints loaded · latest v'+versionOf(releases[0]||{})+' · refreshed just now');
    }catch(error){
      if(epoch!==selectionEpoch||selected?.appId!==app.appId)return;
      setReleaseStatus('Release history could not be loaded');
      const detail=error instanceof Error?error.message:String(error);
      $('appStatus').insertAdjacentHTML('beforeend','<div class="timeline-item"><strong>Checkpoint loading error</strong><div>'+esc(detail)+'</div><div class="muted small">Check the published release manifest URL: '+esc(app.releaseManifest||app.liveUrl+'version-lab-data/releases.json')+'</div></div>');
    }
  }else if(app.appId==='beyond100'){
    try{
      const text=await fetch(freshUrl('https://raw.githubusercontent.com/'+app.repository+'/main/versions-data.js'),{cache:'no-store'}).then(r=>r.text());
      if(epoch!==selectionEpoch||selected?.appId!==app.appId)return;
      const marker='window.BEYOND100_RELEASES = ',start=text.indexOf(marker);
      if(start>=0){
        const obj=Function('return ('+text.slice(start+marker.length).replace(/;\s*$/,'')+')')();
        releases=(obj.releases||[]).map(r=>({...r,checkpointId:r.version,productVersion:r.version,commit:r.ref,sourceUrl:'https://github.com/'+app.repository+'/tree/'+encodeURIComponent(r.ref),snapshotSafety:r.status==='current'?'interactive-safe':'visual-only'}));
      }
    }catch{}
  }
  if(epoch!==selectionEpoch||selected?.appId!==app.appId)return;
  if(!releases.length){
    setReleaseStatus('No versions available');
    $('appStatus').insertAdjacentHTML('beforeend','<div class="timeline-item"><strong>Checkpoint data</strong><div>No checkpoints were returned by the release manifest.</div></div>');
    return;
  }
  renderReleases();
  initComparisonControls();
  $('releasePanel').classList.remove('hidden');
  $('decisionPanel').classList.remove('hidden');
  renderDecisions();
}
function renderReleases(){
  const allGroups=versionGroups();
  const groups=allGroups.slice(0,releaseLimit);
  $('releaseGrid').innerHTML=groups.map((g,i)=>{
    const r=g.latest;
    const technical=[dateLabel(r),r.commit?'Latest Git '+String(r.commit).slice(0,8):'',
      g.checkpoints.length>1?g.checkpoints.length+' checkpoints':'Single checkpoint',
      /^[a-f0-9]{40}$/i.test(r.commit||'')?'Immutable Git replay · read-only':'Source-only · no archived frontend'
    ].filter(Boolean);
    const img=screenshotUrl(r);
    const areas=(r.areas||[]).map(a=>'<span>'+esc(a.title||a.id)+'</span>').join('');
    const peer=groups.length>1?groups[(i+1)%groups.length].latest:null;
    const compare=peer?'<button class="primary" data-compare="'+esc(idOf(r))+'" data-with="'+esc(idOf(peer))+'">Compare versions</button>':'';
    const history=g.checkpoints.length>1?'<details class="checkpoint-history"><summary>'+g.checkpoints.length+' historical checkpoints · view commits</summary><div class="checkpoint-list">'+g.checkpoints.map((item,k)=>
      '<div class="checkpoint-entry"><div><strong>'+esc(checkpointLabel(item))+'</strong><div class="muted small">'+esc(item.title||'Recorded checkpoint')+'</div></div><div class="release-actions"><button data-preview-left="'+esc(idOf(item))+'">Preview left</button><button data-preview-right="'+esc(idOf(item))+'">Preview right</button><a href="'+esc(source(item))+'" target="_blank" rel="noopener">Git</a></div></div>'
    ).join('')+'</div></details>':'';
    return '<article class="release-card '+(i===0?'current':'')+'">'+
      '<div class="release-card-body release-card-intro"><div class="version-number">v'+esc(g.version)+'</div><h3>'+esc(r.title||'Historical release')+'</h3><p class="release-summary">'+esc(r.summary||'')+'</p></div>'+
      (img?'<div class="release-image"><img loading="lazy" src="'+esc(img)+'" alt="Snapshot preview" onerror="this.closest(\'.release-image\').classList.add(\'image-failed\')"></div>':'')+
      '<div class="release-card-body release-card-details">'+
      (areas?'<div class="area-tags">'+areas+'</div>':'')+
      '<div class="release-actions">'+compare+'<button data-review="'+esc(idOf(r))+'">Review changes</button><a href="'+esc(source(r))+'" target="_blank" rel="noopener">Source</a></div>'+
      '<div class="release-technical">'+technical.map(x=>'<span>'+esc(x)+'</span>').join('')+'</div>'+
      history+'</div></article>';
  }).join('');
  if(allGroups.length>releaseLimit){
    const remaining=allGroups.length-releaseLimit;
    const more=document.createElement('button');
    more.id='showMoreVersions';more.className='load-more-releases';more.type='button';
    more.textContent='Show more versions ('+remaining+' remaining)';
    more.onclick=()=>{releaseLimit+=12;renderReleases()};
    $('releaseGrid').appendChild(more);
  }
  $('releaseGrid').querySelectorAll('[data-compare]').forEach(b=>b.onclick=()=>{
    $('leftVersion').value=b.dataset.with;$('rightVersion').value=b.dataset.compare;compare(true);
  });
  $('releaseGrid').querySelectorAll('[data-review]').forEach(b=>b.onclick=()=>{
    $('decisionVersion').value=b.dataset.review;renderDecisions();
    $('decisionPanel').scrollIntoView({behavior:'smooth',block:'start'});
  });
  for(const side of ['left','right']){
    $('releaseGrid').querySelectorAll('[data-preview-'+side+']').forEach(b=>b.onclick=()=>{
      const id=b.getAttribute('data-preview-'+side),r=release(id),select=$(side+'Version');
      if(!Array.from(select.options).some(x=>x.value===id)){
        const option=document.createElement('option');option.value=id;
        option.textContent='v'+versionOf(r)+' · Git '+checkpointLabel(r);
        select.appendChild(option);
      }
      select.value=id;compare(true);
    });
  }
}
function initComparisonControls(){
  const opts=versionGroups().map(g=>'<option value="'+esc(idOf(g.latest))+'">v'+esc(g.version)+' · '+esc(g.latest.title||'Release')+'</option>').join('');
  $('leftVersion').innerHTML=opts;$('rightVersion').innerHTML=opts;$('decisionVersion').innerHTML=opts;
  if(versionGroups().length>1)$('leftVersion').selectedIndex=1;
  $('rightVersion').selectedIndex=0;$('decisionVersion').selectedIndex=0;
  $('compare').onclick=()=>compare(true);
  $('swapVersions').onclick=()=>{const a=$('leftVersion').value;$('leftVersion').value=$('rightVersion').value;$('rightVersion').value=a;compare(false)};
  $('leftVersion').onchange=refreshPairUi;$('rightVersion').onchange=refreshPairUi;
  $('decisionVersion').onchange=renderDecisions;
  $('addComparisonNote').onclick=addComparisonNote;
  $('copyBrief').onclick=copyDevelopmentBrief;
  $('exportReview').onclick=exportReview;
  refreshPairUi();
}
function refreshPairUi(){
  const [l,r]=pairIds(),focus=$('comparisonNoteFocus');
  if(focus)focus.innerHTML='<option value="general">Both / general</option><option value="'+esc(l)+'">'+esc(versionOf(release(l)))+'</option><option value="'+esc(r)+'">'+esc(versionOf(release(r)))+'</option>';
  renderComparisonNotes();
}
function bridgeCode(){
  return `(()=>{let applying=false,last=-1,raf=0;const ratio=()=>{const d=document.documentElement,b=document.body,max=Math.max(d.scrollHeight,b?.scrollHeight||0)-innerHeight;return max>0?Math.max(0,Math.min(1,scrollY/max)):0};addEventListener('scroll',()=>{cancelAnimationFrame(raf);raf=requestAnimationFrame(()=>{if(applying)return;const r=ratio();if(Math.abs(r-last)<.001)return;last=r;parent.postMessage({type:'apps-version-lab-preview-scroll',ratio:r},'*')})},{passive:true});addEventListener('message',e=>{const m=e.data;if(!m||m.type!=='apps-version-lab-set-scroll'||typeof m.ratio!=='number')return;const d=document.documentElement,b=document.body,max=Math.max(d.scrollHeight,b?.scrollHeight||0)-innerHeight;applying=true;scrollTo(0,Math.max(0,max)*Math.max(0,Math.min(1,m.ratio)));last=m.ratio;setTimeout(()=>applying=false,80)});parent.postMessage({type:'apps-version-lab-preview-ready'},'*')})();`;
}
async function loadFrame(side,r){
  const frame=$(side+'Frame'),title=$(side+'Title'),status=$(side+'Status'),link=$(side+'Source');
  title.textContent='v'+versionOf(r)+' · '+(r.title||'Checkpoint');link.href=source(r);
  frame.removeAttribute('src');frame.srcdoc='<p style="font:16px system-ui;padding:20px">Preparing isolated historical app…</p>';
  if(!window.VersionLabIsolated||!r.commit){
    status.textContent='Source only · no immutable Git source';
    frame.srcdoc='<p style="font:16px system-ui;padding:20px">No runnable historical source was recorded for this checkpoint.</p>';
    return;
  }
  status.textContent='Loading archived frontend · no production access';
  try{
    const html=await window.VersionLabIsolated.build(selected,r);
    // Keep srcdoc sandboxed WITHOUT allow-same-origin: archived scripts cannot
    // access App Monitor credentials, live localStorage or production cookies.
    frame.srcdoc=html;
    status.textContent='Archived frontend loaded · production access blocked';
  }catch(error){
    status.textContent='Historical replay unavailable · source remains accessible';
    frame.srcdoc='<div style="font:15px system-ui;padding:24px"><h2>Historical replay unavailable</h2><p>'+esc(error.message||error)+'</p><p>Use Source to inspect the archived code.</p></div>';
  }
}
async function compare(scrollToIt){
  const l=release($('leftVersion').value),r=release($('rightVersion').value);if(!l||!r)return;
  $('comparePanel').classList.remove('hidden');refreshPairUi();
  await Promise.all([loadFrame('left',l),loadFrame('right',r)]);
  if(scrollToIt)$('comparePanel').scrollIntoView({behavior:'smooth',block:'start'});
}
addEventListener('message',e=>{
  if(!e.data?.type?.startsWith('apps-version-lab-'))return;
  const side=e.source===$('leftFrame').contentWindow?'left':e.source===$('rightFrame').contentWindow?'right':null;
  if(!side)return;
  if(e.data.type==='apps-version-lab-preview-ready')$(side+'Status').textContent='Isolated UI ready · no live data or writes';
  if(e.data.type==='apps-version-lab-runtime-error'){
    $(side+'Status').textContent='Limited offline replay · '+String(e.data.detail||'script error').slice(0,130);
  }
  if(e.data.type==='apps-version-lab-blocked-write')$(side+'Status').textContent='Read-only replay · live network request blocked';
});
addEventListener('message',e=>{
  if(!$('syncScroll')?.checked||e.data?.type!=='apps-version-lab-preview-scroll'||typeof e.data.ratio!=='number')return;
  const left=$('leftFrame'),right=$('rightFrame');let target=null;
  if(e.source===left.contentWindow)target=right;else if(e.source===right.contentWindow)target=left;
  target?.contentWindow?.postMessage({type:'apps-version-lab-set-scroll',ratio:e.data.ratio},'*');
});

function addComparisonNote(){
  const box=$('comparisonNoteText'),text=box.value.trim();if(!text)return;
  const [l,r]=pairIds();
  const note={id:crypto.randomUUID(),versions:[l,r],focus:$('comparisonNoteFocus').value,text,createdAt:new Date().toISOString()};
  comparisonNotes.push(note);box.value='';saveNotes();
  reviewRequest('POST',{action:'addNote',note}).catch(e=>console.warn('Version Lab note cloud save failed; retained locally.',e));
}
function renderComparisonNotes(){
  const list=$('comparisonNoteList');if(!list)return;
  const [l,r]=pairIds();
  const rows=comparisonNotes.filter(n=>samePair(n,l,r)).sort((a,b)=>Date.parse(b.createdAt)-Date.parse(a.createdAt));
  list.innerHTML=rows.length?rows.map(n=>'<article class="comparison-note"><div class="comparison-note-top"><span>'+esc(n.focus==='general'?'Both versions':versionOf(release(n.focus)))+' · '+esc(new Date(n.createdAt).toLocaleString('en-GB',{day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'}))+'</span><button data-remove-note="'+esc(n.id)+'">Remove</button></div><p>'+esc(n.text)+'</p></article>').join(''):'<div class="comparison-note empty-note">No notes for this pair yet. Add anything you want changed while the two versions are in front of you.</div>';
  list.querySelectorAll('[data-remove-note]').forEach(b=>b.onclick=()=>{
    const id=b.dataset.removeNote;
    comparisonNotes=comparisonNotes.filter(n=>n.id!==id);saveNotes();
    reviewRequest('POST',{action:'removeNote',id}).catch(e=>console.warn('Version Lab note cloud delete failed; local cache updated.',e));
  });
}
function areasFor(r){
  if((r.areas||[]).length)return r.areas;
  return [{id:'overall-release',title:'Overall release',kind:'release',summary:r.summary||'Review this checkpoint as a whole.'}];
}
function renderDecisions(){
  const r=release($('decisionVersion')?.value||idOf(releases[0]));if(!r)return;
  $('decisionList').innerHTML=areasFor(r).map(a=>{
    const key=decisionKey(idOf(r),a.id),d=decisions[key]||{};
    return '<article class="decision-card" data-area="'+esc(a.id)+'"><div class="decision-card-head"><div><span class="kind">'+esc(a.kind||'change')+'</span><h3>'+esc(a.title||a.id)+'</h3></div><span class="saved-mark">'+(d.updatedAt?'saved':'')+'</span></div><p>'+esc(a.summary||'')+'</p><div class="decision-actions">'+['keep','revert','rework','unsure'].map(choice=>'<button data-choice="'+choice+'" class="'+(d.choice===choice?'active':'')+'">'+choice[0].toUpperCase()+choice.slice(1)+'</button>').join('')+'</div><textarea placeholder="What exactly do you like, dislike or want changed?">'+esc(d.note||'')+'</textarea></article>';
  }).join('');
  $('decisionList').querySelectorAll('.decision-card').forEach(card=>{
    const key=decisionKey(idOf(r),card.dataset.area);
    card.querySelectorAll('[data-choice]').forEach(b=>b.onclick=()=>{
      decisions[key]={...(decisions[key]||{}),choice:b.dataset.choice,updatedAt:new Date().toISOString()};saveDecisions();renderDecisions();
      reviewRequest('POST',{action:'upsertDecision',versionId:idOf(r),areaId:card.dataset.area,choice:b.dataset.choice,note:decisions[key]?.note||''}).catch(e=>console.warn('Version Lab decision cloud save failed; retained locally.',e));
    });
    let timer;card.querySelector('textarea').oninput=e=>{clearTimeout(timer);timer=setTimeout(()=>{decisions[key]={...(decisions[key]||{}),note:e.target.value.trim(),updatedAt:new Date().toISOString()};saveDecisions();card.querySelector('.saved-mark').textContent='saved';
        reviewRequest('POST',{action:'upsertDecision',versionId:idOf(r),areaId:card.dataset.area,choice:decisions[key]?.choice||'',note:decisions[key]?.note||''}).catch(err=>console.warn('Version Lab decision note cloud save failed; retained locally.',err))},300)};
  });
  renderDecisionSummary();
}
function renderDecisionSummary(){
  const r=release($('decisionVersion')?.value||idOf(releases[0]));if(!r)return;
  const counts={keep:0,revert:0,rework:0,unsure:0,undecided:0};
  areasFor(r).forEach(a=>{const d=decisions[decisionKey(idOf(r),a.id)]||{};counts[d.choice||'undecided']++});
  $('decisionSummary').textContent=versionOf(r)+': '+counts.keep+' keep · '+counts.revert+' revert · '+counts.rework+' rework · '+counts.unsure+' unsure · '+counts.undecided+' undecided.';
}
function developmentBrief(){
  const r=release($('decisionVersion').value),idx=releases.indexOf(r),previous=releases[idx+1];
  const rows=areasFor(r).map(a=>({area:a,decision:decisions[decisionKey(idOf(r),a.id)]||{}}));
  const notes=comparisonNotes.filter(n=>(n.versions||[]).includes(idOf(r)));
  const lines=[
    (selected.name||selected.appId)+' development brief',
    'Reviewing: '+versionOf(r)+' · '+(r.title||'Checkpoint')+(previous?' against '+versionOf(previous):''),
    'Generated: '+new Date().toLocaleString('en-GB'),'',
    ...rows.flatMap(({area,decision})=>[
      (decision.choice||'UNDECIDED').toUpperCase()+' — '+(area.title||area.id),
      'Change: '+(area.summary||''),
      decision.note?'Detail: '+decision.note:null,''
    ].filter(Boolean))
  ];
  if(notes.length)lines.push('FREE-FORM COMPARISON NOTES',...notes.flatMap(n=>[(n.focus==='general'?'Both versions':versionOf(release(n.focus)))+' · '+(n.versions||[]).map(v=>versionOf(release(v))).join(' ↔ '),n.text,'']));
  lines.push('Implementation rule:','Preserve KEEP areas. Restore only the relevant behaviour/design for REVERT. Improve only the specified aspect for REWORK. Avoid irreversible changes for UNSURE/UNDECIDED areas. Treat comparison notes as explicit requests unless they conflict with a KEEP decision.');
  return lines.join('\n');
}
async function copyDevelopmentBrief(){
  const text=developmentBrief();
  try{await navigator.clipboard.writeText(text);const b=$('copyBrief'),old=b.textContent;b.textContent='Copied ✓';setTimeout(()=>b.textContent=old,1400)}
  catch{download(text,(selected.appId||'app')+'-development-brief.txt','text/plain')}
}
function exportReview(){download(JSON.stringify({app:selected.appId,exportedAt:new Date().toISOString(),decisions,comparisonNotes},null,2),(selected.appId||'app')+'-version-review.json','application/json')}
function download(text,name,type){const blob=new Blob([text],{type}),a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),500)}

verifyDeveloper().then(ok=>{if(ok)loadRegistry()});
})();