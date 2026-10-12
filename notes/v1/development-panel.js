// Development Control Centre: shared annotation queue, without a second task database.
import {createCloudTransport} from './cloud.js';
export async function mountAnnotationQueue(root){
 const session=()=>{try{return JSON.parse(localStorage.getItem('app-monitor.admin-session.v2')||'null')?.token||''}catch{return ''}};
 const api='https://apps-monitor-api.nirav2000-github.workers.dev/app-monitor/notes';
 const headers=()=>({'X-App-Monitor-Session':session()});
 root.innerHTML='<h2>Cloud annotations</h2><p class="muted">Notes from installed applications awaiting development review. GitHub issues remain the durable development tasks.</p><div class="capture-actions"><button id="notesRefresh" class="primary-btn">Refresh annotations</button><span id="notesStatus" class="muted"></span></div><div id="notesItems"></div>';
 const status=root.querySelector('#notesStatus'),host=root.querySelector('#notesItems');
 const escape=s=>String(s||'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 async function load(){
  if(!session()){status.textContent='Sign in to App Monitor first to view private cloud annotations.';return}
  status.textContent='Loading…';host.textContent='';
  try{
   const manifest=await (await fetch('./shared-libraries.json',{cache:'no-store'})).json();
   const apps=[...new Set(['app-monitor',...(manifest.apps||[]).map(x=>String(x).toLowerCase().replace(/[^a-z0-9_.-]/g,'-'))])];
   const results=await Promise.allSettled(apps.map(async app=>({app,notes:await createCloudTransport({apiBase:api,appId:app,getHeaders:headers}).list()})));
   const notes=results.filter(r=>r.status==='fulfilled').flatMap(r=>r.value.notes).filter(n=>n.status==='open'&&n.reviewRequired&&!n.metadata?.developmentIssue?.number);
   const failures=results.filter(r=>r.status==='rejected');
   status.textContent=notes.length+' open annotation(s)'+(failures.length?' · '+failures.length+' app query failures':'');
   notes.sort((a,b)=>String(b.updatedAt).localeCompare(String(a.updatedAt)));
   host.innerHTML=notes.length?notes.map(n=>'<article class="panel" style="margin:12px 0"><strong>'+escape(n.appId)+' · '+escape(n.anchorLabel)+'</strong><p>'+escape(n.text)+'</p><p class="muted">'+escape(n.page)+' · '+escape(n.appVersion)+' · '+escape(n.updatedAt)+'</p>'+(n.metadata?.developmentIssue?.url?'<a href="'+escape(n.metadata.developmentIssue.url)+'" target="_blank" rel="noopener">Open GitHub issue</a>':'<span class="muted">Issue sync pending; retry from the annotation panel</span>')+'</article>').join(''):'<p class="muted">No open annotations found.</p>';
  }catch(error){status.textContent='Annotation queue unavailable: '+String(error.message||error)}
 }
 root.querySelector('#notesRefresh').onclick=load;await load();
}
