export const repository=process.env.GITHUB_REPOSITORY||'nirav2000/Apps';
export async function api(path,{method='GET',body,optional=false,retryDelayMs=500}={}){
 if(!/^\/repos\/nirav2000\/(Apps|Dol)\//.test(path))throw Error('Repository outside allow-list');
 // Reads and status replacement are idempotent. Never blindly repeat creation POSTs.
 const attempts=['GET','PATCH'].includes(method)?3:1;
 for(let attempt=1;attempt<=attempts;attempt++){
  let r;
  try{
   r=await fetch('https://api.github.com'+path,{method,headers:{Accept:'application/vnd.github+json',Authorization:'Bearer '+process.env.GITHUB_TOKEN,'X-GitHub-Api-Version':'2022-11-28',Connection:'close'},body:body===undefined?undefined:JSON.stringify(body),signal:AbortSignal.timeout(45000)});
  }catch(error){if(attempt===attempts)throw error;await new Promise(resolve=>setTimeout(resolve,retryDelayMs*attempt));continue;}
  if(optional&&r.status===404)return null;
  if(r.status>=500&&attempt<attempts){await r.arrayBuffer();await new Promise(resolve=>setTimeout(resolve,retryDelayMs*attempt));continue;}
  if(!r.ok)throw Error(`GitHub ${method} ${path.split('?')[0]}: ${r.status}`);
  return r.status===204?null:r.json();
 }
}
export const issuePath=(repo,n)=>`/repos/${repo}/issues/${n}`;
export async function commentStatus(repo,issue,status,message){
 if(repo!==repository)throw Error('No cross-repository writes');
 const marker=`<!-- diagnostic-control:v1:${status} -->`;
 const comments=await api(issuePath(repo,issue.number)+'/comments?per_page=100');
 if(!comments.some(c=>c.body?.includes(marker)))await api(issuePath(repo,issue.number)+'/comments',{method:'POST',body:{body:marker+'\n'+message}});
 const label='diagnostic:'+status;
 try{await api(`/repos/${repo}/labels`,{method:'POST',body:{name:label,color:status==='verified'?'238636':status==='needs-review'?'d29922':'1f6feb',description:'Controlled diagnostic automation state'}});}catch(e){if(!e.message.endsWith('422'))throw e;}
 await api(issuePath(repo,issue.number),{method:'PATCH',body:{labels:[...(issue.labels||[]).map(l=>l.name).filter(n=>!n.startsWith('diagnostic:')||n==='diagnostic:paused'),label]}});
}
