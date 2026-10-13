// Learning Sync v1.0.0 — opt-in local-first learning records, identity-scoped cloud transport.
import {initialLearningState,recordLearningEvent,recordLearningSession} from '../../learning/v1/index.js';
export const VERSION='1.0.0';
const valid=s=>{s=String(s||'');if(!/^[a-zA-Z0-9._-]{1,128}$/.test(s)||s==='.'||s==='..')throw Error('Invalid identifier');return s;};
const copy=x=>JSON.parse(JSON.stringify(x));
const blank=()=>({schema:1,seq:0,chunks:{},pending:[],seen:{events:0,sessions:0},imports:{}});
const checkChunk=x=>x&&x.schema===1&&/^[a-zA-Z0-9._-]{1,180}$/.test(x.id)&&Array.isArray(x.events)&&Array.isArray(x.sessions)&&x.events.length<=100&&x.sessions.length<=100&&Number.isFinite(x.createdAt)&&JSON.stringify(x).length<400000;
export function mergeChunks(chunks){
 const rows=kind=>chunks.flatMap(c=>(c[kind]||[]).map((v,i)=>({id:c.id+':'+kind+':'+i,v}))).sort((a,b)=>(Number(a.v.timestamp||0)-Number(b.v.timestamp||0))||a.id.localeCompare(b.id));
 const seen=new Set();let state=initialLearningState();
 for(const {id,v} of rows('events'))if(!seen.has(id)){seen.add(id);state=recordLearningEvent(state,v);}
 seen.clear();for(const {id,v} of rows('sessions'))if(!seen.has(id)){seen.add(id);state=recordLearningSession(state,v);}
 return state;
}
export function createLearningSync({appId,learnerId='default',accountId='guest',storage=typeof localStorage==='undefined'?null:localStorage,transport=null,deviceId,onChange=()=>{},onSnapshot=()=>{}}={}){
 appId=valid(appId);learnerId=valid(learnerId);
 if(!storage?.getItem||!storage?.setItem)throw Error('Durable storage required');
 const read=(k,f)=>{try{return JSON.parse(storage.getItem(k)||'null')??f}catch{return f}};
 const base='apps-learning-sync-v1:'+appId,deviceKey=base+':device';
 const device=valid(deviceId||read(deviceKey,null)||globalThis.crypto?.randomUUID?.()||'device-'+Date.now().toString(36));
 storage.setItem(deviceKey,JSON.stringify(device));
 let owner=valid(accountId),busy=false,disposed=false;
 const key=u=>base+':'+u+':'+learnerId;
 const load=u=>{const v=read(key(u),null);return v?.schema===1&&v.chunks&&Array.isArray(v.pending)?v:blank()};
 let state=load(owner);
 const status=()=>({version:VERSION,appId,learnerId,accountId:owner,pending:state.pending.length,localChunks:Object.keys(state.chunks).length,cloud:owner!=='guest'&&!!transport,working:busy});
 const notify=()=>{try{onChange(status())}catch{}};
 const save=()=>{storage.setItem(key(owner),JSON.stringify(state));notify()};
 const snapshot=()=>mergeChunks(Object.values(state.chunks));
 const add=(events,sessions,source)=>{
  events=copy(events);sessions=copy(sessions);
  while(events.length||sessions.length){
   const chunk={schema:1,id:device+'-'+(++state.seq),createdAt:Date.now(),source,events:events.splice(0,100),sessions:sessions.splice(0,100)};
   if(!checkChunk(chunk))throw Error('Learning chunk too large');
   state.chunks[chunk.id]=chunk;state.pending.push(chunk.id);
  }
  save();
 };
 function capture(data){
  if(disposed)throw Error('Disposed');
  if(!Array.isArray(data?.events)||!Array.isArray(data?.sessions))throw Error('Invalid learning snapshot');
  // Explicit reset or capped learning history: do not accidentally reupload old rows.
  if(data.events.length<state.seen.events||data.sessions.length<state.seen.sessions){state.seen={events:0,sessions:0};}
  const events=data.events.slice(state.seen.events),sessions=data.sessions.slice(state.seen.sessions);
  state.seen={events:data.events.length,sessions:data.sessions.length};
  if(events.length||sessions.length)add(events,sessions,'learning');else save();
  return status();
 }
 function switchAccount(next){
  if(busy)throw Error('Sync in progress');
  owner=valid(next);state=load(owner);onSnapshot(snapshot(),owner);notify();return status();
 }
 function importGuest({approved=false}={}){
  if(owner==='guest')throw Error('Sign in first');
  if(!approved)throw Error('Explicit approval required to import guest history');
  const guest=load('guest'),marker=device+':guest';
  if(state.imports[marker])return status();
  for(const original of Object.values(guest.chunks)){
   const id='import-'+original.id;
   if(!state.chunks[id]){const c={...copy(original),id,source:'guest-import'};if(!checkChunk(c))throw Error('Invalid guest data');state.chunks[id]=c;state.pending.push(id);}
  }
  state.imports[marker]=true;save();onSnapshot(snapshot(),owner);return status();
 }
 async function sync(){
  if(disposed)throw Error('Disposed');
  if(owner==='guest'||!transport)return {...status(),reason:'local-only'};
  if(busy)return {...status(),reason:'busy'};
  if(!transport.verifyUser||!transport.putChunks||!transport.getChunks)throw Error('Authenticated transport required');
  busy=true;notify();
  try{
   await transport.verifyUser(owner);
   const ids=[...state.pending];
   for(let i=0;i<ids.length;i+=20){
    const batch=ids.slice(i,i+20).map(id=>state.chunks[id]).filter(Boolean);
    await transport.putChunks({appId,learnerId,accountId:owner,chunks:batch});
    const sent=new Set(batch.map(x=>x.id));state.pending=state.pending.filter(id=>!sent.has(id));save();
   }
   const remote=await transport.getChunks({appId,learnerId,accountId:owner});
   if(!Array.isArray(remote))throw Error('Invalid cloud result');
   for(const chunk of remote){
    if(!checkChunk(chunk))throw Error('Invalid cloud chunk');
    if(state.chunks[chunk.id]&&JSON.stringify(state.chunks[chunk.id])!==JSON.stringify(chunk))throw Error('Cloud ID collision');
    state.chunks[chunk.id]=copy(chunk);
   }
   save();onSnapshot(snapshot(),owner);return status();
  }finally{busy=false;notify()}
 }
 const onOnline=()=>{if(owner!=='guest')sync().catch(()=>{})};
 const observeOnline=(host=typeof window==='undefined'?null:window)=>{host?.addEventListener?.('online',onOnline);return()=>host?.removeEventListener?.('online',onOnline)};
 notify();return {capture,snapshot,status,switchAccount,importGuest,sync,observeOnline,dispose(){disposed=true}};
}
// Firebase Auth and Firestore must use the SAME Firebase project. Firestore rules enforce request.auth.uid.
export function createFirestoreTransport({db,auth,sdk}={}){
 if(!db||!auth||!sdk)throw Error('Firestore, Auth and modular Firebase SDK required');
 const project=auth.app?.options?.projectId;
 if(!project||project!==db.app?.options?.projectId)throw Error('Auth and Firestore project mismatch');
 const verify=uid=>{if(!auth.currentUser||auth.currentUser.uid!==uid)throw Error('Account mismatch')};
 const path=(appId,accountId,learnerId)=>['learningSyncApps',valid(appId),'users',valid(accountId),'learners',valid(learnerId),'chunks'];
 return {
  async verifyUser(uid){verify(uid);await auth.currentUser.getIdToken();verify(uid)},
  async putChunks({appId,accountId,learnerId,chunks}){
   verify(accountId);
   for(const chunk of chunks){if(!checkChunk(chunk))throw Error('Invalid chunk');await sdk.setDoc(sdk.doc(db,...path(appId,accountId,learnerId),chunk.id),{...chunk,ownerUid:accountId});verify(accountId);}
  },
  async getChunks({appId,accountId,learnerId}){
   verify(accountId);
   const result=await sdk.getDocs(sdk.collection(db,...path(appId,accountId,learnerId)));verify(accountId);
   return result.docs.map(d=>{const {ownerUid,...chunk}=d.data();if(ownerUid!==accountId||chunk.id!==d.id)throw Error('Cloud ownership mismatch');return chunk;});
  }
 };
}
export const LearningSync={version:VERSION,init({appId}={}){this.appId=valid(appId);return this;},create:createLearningSync,firestore:createFirestoreTransport};
export default LearningSync;
