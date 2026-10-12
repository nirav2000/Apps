// Shared Notes v1.1: authenticated central cloud transport.
// No Firebase SDK or duplicate listener is created in a consuming application.
// The backend verifies the administrator session and writes to Firestore.
export function createCloudTransport({apiBase, getHeaders, appId, fetchImpl=fetch}={}){
  if(!/^[-a-zA-Z0-9_.]{1,80}$/.test(String(appId||'')))throw Error('Cloud notes require a valid appId');
  if(!/^https:\/\//.test(String(apiBase||'')))throw Error('Cloud notes require an HTTPS API');
  if(typeof getHeaders!=='function')throw Error('Cloud notes require an authenticated getHeaders function');
  const base=apiBase.replace(/\/$/,'');
  const draftKey='apps.notes.'+appId+'.v1.draft';
  const request=async(path,method='GET',body)=>{
    const headers={...getHeaders(),...(body?{'Content-Type':'application/json'}:{})};
    if(!headers['X-App-Monitor-Session']&&!headers.Authorization)throw Error('Sign in before accessing cloud notes');
    const response=await fetchImpl(base+path,{method,headers,cache:'no-store',...(body?{body:JSON.stringify(body)}:{})});
    if(!response.ok)throw Error('Cloud notes '+(response.status===401?'session expired':response.status===503?'not configured':'request failed ('+response.status+')'));
    return response.json();
  };
  const localDraft=()=>{try{return JSON.parse(localStorage.getItem(draftKey)||'null')}catch{return null}};
  return {
    mode:'firebase',
    async list(){return (await request('?appId='+encodeURIComponent(appId))).notes||[]},
    async save(note){const result=await request('','POST',{action:'save',note:{...note,appId}});return {note:result.note,review:result.review}},
    async remove(id){await request('','POST',{action:'remove',appId,id})},
    async getDraft(){return localDraft()},
    async saveDraft(value){if(value)localStorage.setItem(draftKey,JSON.stringify(value));else localStorage.removeItem(draftKey)},
    async clearDraft(){localStorage.removeItem(draftKey)},
    async publishReviewFeed(pack){return request('/sync','POST',{appId,notes:pack.notes})},
    async pullStatuses(){return request('/statuses?appId='+encodeURIComponent(appId))}
  };
}
