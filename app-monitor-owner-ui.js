const $ = id => document.getElementById(id);
const api = 'https://apps-monitor-api.nirav2000-github.workers.dev/app-monitor';
const escapeHTML = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let token = '', selectedProject = '', selectedTab = 'users', pageToken = '', selectedCollection = '', parentDocument = '';
let userRows = [], documentRows = [];
const state = id => $(id);
const setStatus = message => { $('message').textContent = message; };
const formatDate = value => { if (!value) return '—'; const n = Number(value); const d = new Date(Number.isFinite(n) && n > 100000000000 ? n : value); return Number.isNaN(d.getTime()) ? '—' : d.toLocaleString('en-GB'); };
const params = object => new URLSearchParams(Object.entries(object).filter(([,v])=>v!==null && v!==undefined && v!=='')).toString();
async function request(route, args = {}) {
  const response = await fetch(api + '/owner/data/' + route + '?' + params(args), { headers: {'X-App-Monitor-Session':token}, cache:'no-store' });
  const body = await response.json().catch(()=>({}));
  if (!response.ok) throw Error(body.error || 'Request failed ('+response.status+')');
  return body;
}
function drawDashboard(data) {
  const projects = data.projects || [];
  $('projectTabs').innerHTML = projects.map(p=>'<button type="button" class="tab '+(selectedProject===p.projectId?'active':'')+'" data-project="'+escapeHTML(p.projectId)+'">'+escapeHTML(p.projectId)+'</button>').join('');
  $('summary').innerHTML = projects.map(p=>'<div class="item"><h3>'+escapeHTML(p.projectId)+'</h3><p class="muted">'+escapeHTML((p.apps||[]).join(', ')||'Firebase project')+'</p><p>Firestore: '+(p.firestore.ok?'Connected':'HTTP '+p.firestore.status)+'</p><p>Authentication: '+(p.authentication.ok?'Connected':'HTTP '+p.authentication.status)+'</p><p class="small muted">'+p.firestore.collections.length+' root collections returned · '+p.authentication.users.length+' users sampled</p><p class="small muted">These are sample sizes, not totals.</p></div>').join('');
  $('projectTabs').querySelectorAll('button').forEach(button=>button.addEventListener('click',()=>selectProject(button.dataset.project)));
}
async function refresh() {
  $('refresh').disabled = true;
  try {
    const saved = JSON.parse(localStorage.getItem('app-monitor.admin-session.v2')||'null');
    token = saved?.token || '';
    if (!token) throw Error('Sign in to App Monitor using your passkey first.');
    const auth = await fetch(api+'/auth/session',{headers:{'X-App-Monitor-Session':token},cache:'no-store'});
    if (!auth.ok) throw Error('Your App Monitor session expired. Sign in again.');
    const dashboard = await request('dashboard');
    const projects = dashboard.projects || [];
    if (!projects.some(p=>p.projectId===selectedProject)) selectedProject = projects[0]?.projectId || '';
    drawDashboard(dashboard);
    setStatus('Connected · '+projects.length+' Firebase projects · read-only');
    if (selectedProject) await openTab(selectedTab);
  } catch(error) { setStatus(error.message); $('results').replaceChildren(); }
  finally { $('refresh').disabled = false; }
}
async function selectProject(id) {
  selectedProject = id; selectedCollection = ''; parentDocument = ''; pageToken = '';
  $('projectTabs').querySelectorAll('button').forEach(b=>b.classList.toggle('active',b.dataset.project===id));
  await openTab('users');
}
function drawUsers() {
  const search = $('search').value.trim().toLowerCase();
  const filtered = userRows.filter(u=>[u.email,u.uid,u.displayName].some(v=>String(v||'').toLowerCase().includes(search)));
  $('results').innerHTML = '<div class="tableScroll"><table><thead><tr><th>User</th><th>UID</th><th>Status</th><th>Created</th><th>Last login</th></tr></thead><tbody>'+filtered.map(u=>'<tr><td>'+escapeHTML(u.displayName||u.email||'Unnamed')+'<div class="small muted">'+escapeHTML(u.email)+'</div></td><td class="mono">'+escapeHTML(u.uid)+'</td><td>'+ (u.disabled?'Disabled':'Enabled')+'</td><td>'+formatDate(u.createdAt)+'</td><td>'+formatDate(u.lastLoginAt)+'</td></tr>').join('')+'</tbody></table></div><p class="small muted">Showing '+filtered.length+' matching accounts from '+userRows.length+' loaded. Search covers loaded records only.</p>';
}
function drawCollections(names) {
  $('results').innerHTML = '<div class="list">'+names.map(name=>'<button type="button" class="collection" data-collection="'+escapeHTML(parentDocument?parentDocument+'/'+name:name)+'">'+escapeHTML(name)+' <span>Browse documents →</span></button>').join('')+'</div>'+(names.length?'':'<p class="muted">No collections found.</p>');
  $('results').querySelectorAll('[data-collection]').forEach(button=>button.addEventListener('click',()=>openCollection(button.dataset.collection)));
}
function drawDocuments() {
  const search = $('search').value.trim().toLowerCase();
  const docs = documentRows.filter(d=>d.id.toLowerCase().includes(search));
  $('results').innerHTML = '<p class="muted">Collection: '+escapeHTML(selectedCollection)+'</p><div class="list">'+docs.map(d=>'<button type="button" class="collection" data-doc="'+escapeHTML(d.path)+'">'+escapeHTML(d.id)+' <span>Subcollections →</span></button>').join('')+'</div><p class="small muted">'+docs.length+' documents shown; search covers loaded records only.</p>';
  $('results').querySelectorAll('[data-doc]').forEach(b=>b.addEventListener('click',async()=>{parentDocument=b.dataset.doc;selectedCollection='';pageToken='';await loadCollections();}));
}
async function openTab(tab) {
  selectedTab=tab;pageToken='';parentDocument='';selectedCollection='';userRows=[];documentRows=[];
  $('search').value='';$('results').textContent='Loading…';$('more').hidden=true;
  $('viewTabs').querySelectorAll('button').forEach(b=>b.classList.toggle('active',b.dataset.view===tab));
  if(tab==='users')await loadUsers();else await loadCollections();
}
async function loadUsers() {
  try {
    const r=await request('users',{project:selectedProject,pageToken});
    userRows.push(...r.users);pageToken=r.nextPageToken||'';
    drawUsers();$('more').hidden=!pageToken;
  }catch(error){$('results').textContent=error.message;$('more').hidden=true;}
}
async function loadCollections() {
  try {
    const r=await request('collections',{project:selectedProject,document:parentDocument,pageToken});
    pageToken=r.nextPageToken||'';
    drawCollections(r.collections||[]);$('more').hidden=!pageToken;
    $('trail').textContent=parentDocument?'Subcollections of '+parentDocument:'Root collections';
  }catch(error){$('results').textContent=error.message;$('more').hidden=true;}
}
async function openCollection(path) {
  selectedCollection=path;pageToken='';documentRows=[];$('results').textContent='Loading documents…';await loadDocuments();
}
async function loadDocuments() {
  try {
    const r=await request('documents',{project:selectedProject,collection:selectedCollection,pageToken});
    documentRows.push(...r.documents);pageToken=r.nextPageToken||'';
    drawDocuments();$('more').hidden=!pageToken;
    $('trail').textContent=selectedCollection;
  }catch(error){$('results').textContent=error.message;$('more').hidden=true;}
}
$('refresh').addEventListener('click',refresh);
$('search').addEventListener('input',()=>{if(selectedTab==='users')drawUsers();else if(selectedCollection)drawDocuments();});
$('viewTabs').querySelectorAll('button').forEach(b=>b.addEventListener('click',()=>openTab(b.dataset.view)));
$('more').addEventListener('click',()=>{if(selectedTab==='users')loadUsers();else if(selectedCollection)loadDocuments();else loadCollections();});
refresh();
