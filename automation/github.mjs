export const repository=process.env.GITHUB_REPOSITORY||'nirav2000/Apps';
export async function api(path,{method='GET',body,optional=false}={}){
 if(!/^\/repos\/nirav2000\/(Apps|Dol)\//.test(path))throw Error('Repository outside allow-list');
 const r=await fetch('https://api.github.com'+path,{method,headers:{Accept:'application/vnd.github+json',Authorization:'Bearer '+process.env.GITHUB_TOKEN,'X-GitHub-Api-Version':'2022-11-28'},body:body===undefined?undefined:JSON.stringify(body),signal:AbortSignal.timeout(45000)});
 if(optional&&r.status===404)return null;
 if(!r.ok)throw Error(`GitHub ${method} ${path.split('?')[0]}: ${r.status}`);
 return r.status===204?null:r.json();
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
