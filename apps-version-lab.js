(function(){
'use strict';
if(window.AppsVersionLab)return;
const VERSION=1;
const esc=v=>String(v??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
const abs=(value,base=location.href)=>new URL(value,base).href;
function mount(config={}){
  const $=id=>document.getElementById(id);
  const appId=config.appId||'app';
  const appUrl=abs(config.appUrl||'../');
  const versionUrl=abs(config.versionUrl||'../version.json');
  const manifestUrl=abs(config.manifestUrl||'manifest.json');
  const releasesUrl=abs(config.releasesUrl||'releases.json');
  const repoUrl=config.repoUrl||'';
  const storageKey=config.notesKey||appId+'.version-lab.notes.v1';
  let releases=[],currentVersion='',selectedVersion='',notes=loadNotes(),syncing=false;
  function loadNotes(){try{return JSON.parse(localStorage.getItem(storageKey)||'[]')}catch{return[]}}
  function saveNotes(){localStorage.setItem(storageKey,JSON.stringify(notes));renderNotes()}
  const release=v=>releases.find(r=>r.version===v)||releases[0];
  const sourceUrl=r=>r?.source||(repoUrl&&r?.commit?repoUrl+'/tree/'+encodeURIComponent(r.commit):repoUrl||'#');
  const frozenUrl=r=>r?.snapshot?abs(r.snapshot,manifestUrl):null;
  const isCurrent=r=>!!r&&r.version===currentVersion;
  const previewUrl=r=>isCurrent(r)?appUrl+(appUrl.includes('?')?'&':'?')+'version-preview=1':(frozenUrl(r)?frozenUrl(r)+'index.html?version-preview=1':null);
  const browseUrl=r=>isCurrent(r)?appUrl:(frozenUrl(r)?frozenUrl(r)+'index.html':sourceUrl(r));
  const pairKey=()=>[$('leftVersion')?.value,$('rightVersion')?.value].sort().join('|');
  async function exists(url){
    if(!url)return false;
    try{const r=await fetch(url,{cache:'no-store'});return r.ok}catch{return false}
  }
  function fallbackHtml(r,message='Frozen snapshot is not available in this deployment.'){
    const src=sourceUrl(r);
    return '<div style="font-family:system-ui;padding:32px;color:#102a43"><h2>Snapshot unavailable</h2><p>'+esc(message)+'</p>'+(src?'<p><a href="'+esc(src)+'" target="_blank" rel="noopener">Open Git source ↗</a></p>':'')+'</div>';
  }
  async function loadFrame(frame,r,status){
    const url=previewUrl(r);
    if(!url){frame.srcdoc=fallbackHtml(r);if(status)status.textContent='Source only';return}
    if(!isCurrent(r)&&!(await exists(url))){
      frame.removeAttribute('src');frame.srcdoc=fallbackHtml(r);if(status)status.textContent='Snapshot unavailable · source only';return;
    }
    frame.removeAttribute('srcdoc');
    frame.onload=()=>{if(status)status.textContent=isCurrent(r)?'Live current release':'Frozen Git snapshot'};
    frame.src=url;
  }
  async function loadHistory(){
    const [history,current]=await Promise.all([
      fetch(manifestUrl,{cache:'no-store'}).then(r=>{if(!r.ok)throw Error('manifest unavailable');return r.json()}).catch(async()=>{
        const reg=await fetch(releasesUrl,{cache:'no-store'}).then(r=>r.json());
        return{generatedAt:null,releases:[...(reg.releases||[])].reverse().map(x=>({...x,snapshot:'snapshots/'+x.version+'/',source:repoUrl+'/tree/'+x.commit}))};
      }),
      fetch(versionUrl,{cache:'no-store'}).then(r=>r.json()).catch(()=>({version:''}))
    ]);
    releases=history.releases||[];currentVersion=current.version||releases[0]?.version||'';
    if($('currentPill'))$('currentPill').textContent=currentVersion?'Current · v'+currentVersion:'Version history';
    selectedVersion=currentVersion&&release(currentVersion)?currentVersion:releases[0]?.version;
    renderReleases();initControls();await selectPreview(selectedVersion);
    if($('staticFallback'))$('staticFallback').hidden=true;
  }
  function renderReleases(){
    const grid=$('releaseGrid');if(!grid)return;
    grid.innerHTML=releases.map(r=>'<article class="release-card '+(r.version===currentVersion?'current':'')+'"><div class="release-meta"><span class="release-version">v'+esc(r.version)+'</span><span class="release-kind">'+esc(r.kind==='reconstructed'?'reconstructed milestone':r.version===currentVersion?'current release':'release')+'</span></div><h3>'+esc(r.label||r.subject||'Release')+'</h3><p>'+esc(r.date?new Date(r.date).toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric'}):String(r.commit||'').slice(0,12))+'</p><div class="release-actions"><button class="primary" type="button" data-preview="'+esc(r.version)+'">Preview</button><a href="'+esc(browseUrl(r))+'" target="_blank" rel="noopener">Browse version</a><button type="button" data-compare="'+esc(r.version)+'">Compare</button><a href="'+esc(sourceUrl(r))+'" target="_blank" rel="noopener">Source</a></div></article>').join('');
    document.querySelectorAll('[data-preview]').forEach(b=>b.onclick=()=>{selectPreview(b.dataset.preview);document.querySelector('.snapshot-section')?.scrollIntoView({behavior:'smooth'})});
    document.querySelectorAll('[data-compare]').forEach(b=>b.onclick=()=>{const other=b.dataset.compare;if($('leftVersion'))$('leftVersion').value=currentVersion||releases[0]?.version;if($('rightVersion'))$('rightVersion').value=other;if($('leftVersion')?.value===$('rightVersion')?.value){const alt=releases.find(x=>x.version!==other);if(alt)$('leftVersion').value=alt.version}loadComparison();document.querySelector('#compare')?.scrollIntoView({behavior:'smooth'})});
  }
  function initControls(){
    if(!$('leftVersion')||!$('rightVersion'))return;
    const opts=selected=>releases.map(r=>'<option value="'+esc(r.version)+'" '+(r.version===selected?'selected':'')+'>v'+esc(r.version)+' · '+esc(r.label||r.subject||'Release')+'</option>').join('');
    const left=releases.find(r=>r.version!==currentVersion)?.version||releases[1]?.version||releases[0]?.version;
    $('leftVersion').innerHTML=opts(left);$('rightVersion').innerHTML=opts(currentVersion||releases[0]?.version);
    if($('loadCompare'))$('loadCompare').onclick=loadComparison;
    if($('swapVersions'))$('swapVersions').onclick=()=>{const a=$('leftVersion').value;$('leftVersion').value=$('rightVersion').value;$('rightVersion').value=a;loadComparison()};
    $('leftVersion').onchange=renderNotes;$('rightVersion').onchange=renderNotes;
    if($('addComparisonNote'))$('addComparisonNote').onclick=addNote;
    document.querySelectorAll('[data-viewport]').forEach(b=>b.onclick=()=>{document.querySelectorAll('[data-viewport]').forEach(x=>x.classList.toggle('active',x===b));if($('snapshotStage'))$('snapshotStage').className='snapshot-stage '+b.dataset.viewport});
    if($('leftFrame')&&$('rightFrame')){wireScrollSync($('leftFrame'),$('rightFrame'));wireScrollSync($('rightFrame'),$('leftFrame'))}
    loadComparison();
  }
  async function selectPreview(version){
    const r=release(version);if(!r)return;selectedVersion=version;
    if($('previewTitle'))$('previewTitle').textContent='v'+r.version+' · '+(r.label||r.subject||'Release');
    if($('previewStatus'))$('previewStatus').textContent=isCurrent(r)?'Current live deployment':'Checking frozen snapshot…';
    if($('openSource'))$('openSource').href=sourceUrl(r);
    if($('openSnapshot'))$('openSnapshot').href=browseUrl(r);
    if($('snapshotFrame'))await loadFrame($('snapshotFrame'),r,$('previewStatus'));
  }
  async function loadPreview(r,side){
    const frame=$(side+'Frame'),title=$(side+'Title'),status=$(side+'Status'),source=$(side+'Source');if(!frame)return;
    if(title)title.textContent='v'+r.version+' · '+(r.label||r.subject||'Release');if(source)source.href=sourceUrl(r);if(status)status.textContent='Loading…';
    await loadFrame(frame,r,status);
  }
  function loadComparison(){
    const left=release($('leftVersion')?.value),right=release($('rightVersion')?.value);
    if(!left||!right)return;loadPreview(left,'left');loadPreview(right,'right');renderNotes();
  }
  function wireScrollSync(frame,other){
    frame.addEventListener('load',()=>{try{frame.contentWindow.addEventListener('scroll',()=>{if(!$('syncScroll')?.checked||syncing)return;const d=frame.contentDocument?.documentElement,od=other.contentDocument?.documentElement;if(!d||!od)return;const max=Math.max(0,d.scrollHeight-frame.contentWindow.innerHeight),ratio=max?frame.contentWindow.scrollY/max:0,omax=Math.max(0,od.scrollHeight-other.contentWindow.innerHeight);syncing=true;other.contentWindow.scrollTo(0,omax*ratio);setTimeout(()=>{syncing=false},60)},{passive:true})}catch{}});
  }
  function addNote(){const box=$('comparisonNoteText'),text=box?.value.trim();if(!text)return;notes.push({id:crypto.randomUUID(),pair:pairKey(),versions:[$('leftVersion').value,$('rightVersion').value],text,createdAt:new Date().toISOString()});box.value='';saveNotes()}
  function renderNotes(){const list=$('comparisonNoteList');if(!list)return;const pair=pairKey(),rows=notes.filter(n=>n.pair===pair);list.innerHTML=rows.length?rows.map(n=>'<article class="comparison-note"><button type="button" data-remove-note="'+esc(n.id)+'">Remove</button><small>v'+esc(n.versions?.[0])+' ↔ v'+esc(n.versions?.[1])+' · '+esc(new Date(n.createdAt).toLocaleString('en-GB'))+'</small><p>'+esc(n.text)+'</p></article>').join(''):'<p style="color:#61758a;font-size:.78rem">No notes for this version pair yet.</p>';list.querySelectorAll('[data-remove-note]').forEach(b=>b.onclick=()=>{notes=notes.filter(n=>n.id!==b.dataset.removeNote);saveNotes()})}
  loadHistory().catch(error=>{if($('currentPill'))$('currentPill').textContent='Basic history';if($('releaseGrid'))$('releaseGrid').innerHTML='<article class="release-card"><h3>Version Lab could not load</h3><p>'+esc(error.message||error)+'</p></article>';if($('staticFallback'))$('staticFallback').hidden=false});
  return{version:VERSION,loadHistory,selectPreview,loadComparison};
}
window.AppsVersionLab={version:VERSION,mount};
})();