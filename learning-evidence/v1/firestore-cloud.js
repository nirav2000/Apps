// Cloud transport for Shared Learning Evidence. Additive: it never edits legacy progress.
// Uses the existing kk-syllabus owner-only /families/.../progress rule.
export const EVIDENCE_CLOUD_VERSION = '1.0.0';
const valid=x=>/^[a-zA-Z0-9._:-]{1,100}$/.test(String(x||''));
const canonical=x=>Array.isArray(x)?'['+x.map(canonical).join(',')+']':x&&typeof x==='object'?'{'+Object.keys(x).sort().map(k=>JSON.stringify(k)+':'+canonical(x[k])).join(',')+'}':JSON.stringify(x);
const same=(a,b)=>canonical(a)===canonical(b);

export function createFirestoreEvidenceCloud({store,db,auth,firestore,ownerUid,learnerId,appId}) {
  if(!store||!db||!auth||!firestore)throw Error('Evidence store, Firestore and Auth are required');
  for(const [name,value] of Object.entries({ownerUid,learnerId,appId}))
    if(!valid(value))throw Error('Invalid evidence '+name);
  if(store.scope.appId!==appId||store.scope.learnerId!==learnerId||store.scope.accountId!==ownerUid)
    throw Error('Evidence scope and Firebase identity do not match');
  const prefix='evidence-'+appId+'-v1-';
  const col=firestore.collection(db,'families',ownerUid,'learners',learnerId,'progress');
  const checkAuth=()=>{
    if(!auth.currentUser||auth.currentUser.uid!==ownerUid)
      throw Error('Sign in with the authorised family Firebase account to synchronise evidence');
  };
  let active=null,lastSuccess=null;
  async function syncOnce(){
    checkAuth();
    // Server retrieval is mandatory: an offline cache is not cloud confirmation.
    if(typeof firestore.getDocsFromServer!=='function')
      throw Error('Firestore server retrieval is unavailable');
    const q=firestore.query(col,
      firestore.where(firestore.documentId(),'>=',prefix),
      firestore.where(firestore.documentId(),'<',prefix+'\uf8ff'));
    const remote=await firestore.getDocsFromServer(q);
    checkAuth();
    const seen=new Map();
    const incoming=[];
    remote.forEach(snapshot=>{
      if(!snapshot.id.startsWith(prefix))return;
      const data=snapshot.data(),row=data?.event;
      if(data?.schema!==1||data.ownerUid!==ownerUid||
         data.learnerId!==learnerId||data.app!==appId||
         !row||row.id!==snapshot.id.slice(prefix.length)||
         row.appId!==appId||row.accountId!==ownerUid||row.learnerId!==learnerId)
        throw Error('Cloud evidence scope mismatch; no records were changed');
      seen.set(row.id,row);
      incoming.push(row);
    });
    // Fail closed before any merge when an ID refers to different events.
    // Immutable evidence must never be silently replaced by a different device.
    const localBefore=new Map(store.getEntries().map(row=>[row.id,row]));
    for(const row of incoming){
      if(localBefore.has(row.id)&&!same(localBefore.get(row.id),row))
        throw Error('Evidence collision. Both original records were preserved.');
    }
    if(incoming.length)store.ingest(incoming);
    let uploaded=0;
    for(const row of store.getEntries()){
      if(seen.has(row.id)){
        if(!same(seen.get(row.id),row))throw Error('Conflicting evidence ID; export before resolving');
        continue;
      }
      checkAuth();
      const target=firestore.doc(col,prefix+row.id);
      // A transaction cannot silently overwrite a record created by another device.
      await firestore.runTransaction(db,async tx=>{
        const existing=await tx.get(target);
        if(existing.exists()){
          if(!same(existing.data()?.event,row))throw Error('Evidence collision. Existing record preserved.');
        }else{
          tx.set(target,{schema:1,app:appId,ownerUid,learnerId,
            event:row,createdAt:firestore.serverTimestamp()});
        }
      });
      uploaded++;
    }
    lastSuccess=new Date().toISOString();
    return {downloaded:incoming.length,uploaded,total:store.getEntries().length,at:lastSuccess};
  }
  function sync(){
    if(active)return active;
    active=syncOnce().finally(()=>{active=null;});
    return active;
  }
  return {sync,getLastSuccess:()=>lastSuccess};
}
