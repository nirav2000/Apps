'use strict';
(()=>{
 const status=document.getElementById('releaseHealthStatus'),results=document.getElementById('releaseHealthResults');
 if(!status||!results)return;
 const repo='nirav2000/Openday',api='https://api.github.com/repos/'+repo;
 const workflows=['Deploy GitHub Pages','Validate app','Primary interaction regression','Validate shared PWA adoption','pages build and deployment'];
 const safe=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const link=(url,label)=>'<a href="'+safe(url)+'" target="_blank" rel="noopener">'+safe(label)+'</a>';
 async function refresh(){
  status.textContent='Checking public GitHub Actions results…';results.replaceChildren();
  try{
   const response=await fetch(api+'/actions/runs?per_page=60',{headers:{Accept:'application/vnd.github+json'},cache:'no-store'});
   if(!response.ok)throw Error('GitHub API returned '+response.status);
   const runs=(await response.json()).workflow_runs||[];
   const latest=runs.find(r=>r.name==='Deploy GitHub Pages');
   if(!latest)throw Error('No deployment workflow found');
   const sha=latest.head_sha,matching=runs.filter(r=>r.head_sha===sha);
   const summary=workflows.map(name=>({name,run:matching.find(r=>r.name===name)}));
   status.textContent='Latest gated deployment commit '+sha.slice(0,10)+' · '+(latest.status==='completed'?(latest.conclusion||'unknown'):latest.status)+' · '+new Date(latest.created_at).toLocaleString()+'. Checks must pass before production deployment.';
   results.innerHTML=summary.map(({name,run})=>'<div class="security-box"><strong>'+safe(name)+'</strong><p class="small '+(run?.conclusion==='success'?'active':run?.conclusion==='failure'?'danger':'muted')+'">'+safe(run?.conclusion||run?.status||'Not reported')+'</p><p class="small">'+(run?link(run.html_url,'Open run and evidence ↗'):'No run for this commit')+'</p></div>').join('');
  }catch(e){status.textContent='Could not load GitHub workflow evidence ('+e.message+'). '+repo;results.innerHTML=link('https://github.com/'+repo+'/actions','Open GitHub Actions ↗');}
 }
 document.getElementById('releaseHealthRefresh')?.addEventListener('click',refresh);
 refresh();
})();
