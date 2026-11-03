// Passkey-gated InClass family notes bridge. Authentication is enforced by
// app-monitor-worker.js before this route runs. The bridge never accepts an
// arbitrary Firestore path or Firebase owner ID from the caller.
const OWNER='2AJSfYdtg5URWHv7HCzpNMmKIlg2';
const PROJECT='kk-syllabus';
const valid=value=>/^[A-Za-z0-9_-]{1,80}$/.test(String(value||''));
const error=(status,message,headers)=>Response.json({ok:false,error:message},{status,headers});
const docUrl=(learner,pack)=>'https://firestore.googleapis.com/v1/projects/'+PROJECT+'/databases/(default)/documents/families/'+OWNER+'/learners/'+learner+'/progress/inclass-notes-'+pack;
const encode=value=>{
 if(value===null)return {nullValue:null};
 if(typeof value==='boolean')return {booleanValue:value};
 if(typeof value==='number')return Number.isInteger(value)?{integerValue:String(value)}:{doubleValue:value};
 if(typeof value==='string')return {stringValue:value};
 if(Array.isArray(value))return {arrayValue:{values:value.map(encode)}};
 if(typeof value==='object'){
  const fields={};for(const [key,item] of Object.entries(value))if(item!==undefined)fields[key]=encode(item);
  return {mapValue:{fields}};
 }
 throw Error('Unsupported note field');
};
const decode=value=>{
 if(!value||typeof value!=='object')return null;
 if('nullValue' in value)return null;
 if('stringValue' in value)return value.stringValue;
 if('integerValue' in value)return Number(value.integerValue);
 if('doubleValue' in value)return Number(value.doubleValue);
 if('booleanValue' in value)return value.booleanValue;
 if('arrayValue' in value)return (value.arrayValue?.values||[]).map(decode);
 if('mapValue' in value)return Object.fromEntries(Object.entries(value.mapValue?.fields||{}).map(([k,v])=>[k,decode(v)]));
 return null;
};
const decodeDoc=data=>Object.fromEntries(Object.entries(data.fields||{}).map(([k,v])=>[k,decode(v)]));
const encodeDoc=data=>({fields:Object.fromEntries(Object.entries(data).map(([k,v])=>[k,encode(v)]))});
function validateNotes(notes,learner,pack){
 if(!Array.isArray(notes)||notes.length>50)throw Error('Expected up to 50 notes');
 const ids=new Set(),prefix='inclass:lesson:'+pack+':';
 for(const n of notes){
  if(!n||typeof n!=='object'||Array.isArray(n)||!valid(n.id)||ids.has(n.id))
   throw Error('Invalid or duplicate note ID');
  ids.add(n.id);
  if(n.appId!=='inclass'||typeof n.page!=='string'||!n.page.startsWith(prefix)||
     n.page.slice(prefix.length).toLowerCase()!==learner.toLowerCase())
   throw Error('Note is outside the requested learner or homework pack');
  if(typeof n.text!=='string'||!n.text.trim()||n.text.length>6000)
   throw Error('Note text is empty or too long');
  if(!['open','archived','wont-fix','implemented'].includes(n.status))
   throw Error('Invalid note status');
 }
 const length=new TextEncoder().encode(JSON.stringify(notes)).byteLength;
 if(length>700000)throw Error('Lesson notes exceed permitted size');
 return notes;
}
export async function inclassFamilyNotesRoute(request,env,headers,url,{getGoogleToken,fetchImpl=fetch}={}){
 const learner=url.searchParams.get('learner'),pack=url.searchParams.get('pack');
 if(!valid(learner)||!valid(pack))return error(400,'Invalid learner or homework pack',headers);
 if(!['GET','POST'].includes(request.method))return error(405,'Method not allowed',headers);
 if(!env.FIREBASE_ADMIN_SERVICE_ACCOUNT_JSON)return error(503,'Family notes backend not configured',headers);
 let token;try{token=await getGoogleToken(env)}catch{return error(503,'Firebase service account unavailable',headers)}
 const h={Authorization:'Bearer '+token};
 const path=docUrl(learner,pack);
 if(request.method==='GET'){
  const reply=await fetchImpl(path,{headers:h,cache:'no-store'});
  if(reply.status===404)return Response.json({ok:true,notes:[],revision:null},{headers});
  if(!reply.ok)return error(502,'Firebase read failed',headers);
  let raw;try{raw=await reply.json()}catch{return error(502,'Invalid Firebase response',headers)}
  const record=decodeDoc(raw);
  if(record.app!=='inclass'||record.learner!==learner||record.pack!==pack)return error(409,'This document does not belong to the requested lesson',headers);
  try{validateNotes(record.notes||[],learner,pack)}
  catch{return error(502,'Stored notes have an invalid format',headers)}
  return Response.json({ok:true,notes:record.notes||[],revision:raw.updateTime||null},{headers});
 }
 const declared=Number(request.headers.get('Content-Length')||0);
 if(declared>750000)return error(413,'Payload too large',headers);
 let payload;try{payload=await request.json()}catch{return error(400,'Invalid JSON',headers)}
 if(!payload||typeof payload!=='object')return error(400,'Expected notes payload',headers);
 const revision=payload.revision;
 if(revision!==null&&!(typeof revision==='string'&&/^\d{4}-\d\d-\d\dT/.test(revision)&&revision.length<100))
  return error(400,'Read revision before saving',headers);
 try{validateNotes(payload.notes,learner,pack)}
 catch(e){return error(400,String(e.message||e),headers)}
 const document={app:'inclass',schema:1,learner,pack,notes:payload.notes,updatedAt:new Date().toISOString()};
 const precondition=revision===null?'currentDocument.exists=false':'currentDocument.updateTime='+encodeURIComponent(revision);
 const reply=await fetchImpl(path+'?'+precondition,{method:'PATCH',headers:{...h,'Content-Type':'application/json'},body:JSON.stringify(encodeDoc(document)),cache:'no-store'});
 if(!reply.ok){
  if([409,412].includes(reply.status))return error(409,'Lesson changed on another device; reload and merge',headers);
  if(reply.status===400){
   const data=await reply.json().catch(()=>({}));
   if(data.error?.status==='FAILED_PRECONDITION')return error(409,'Lesson changed on another device; reload and merge',headers);
  }
  return error(502,'Firebase write failed',headers);
 }
 const updated=await reply.json().catch(()=>({}));
 return Response.json({ok:true,notes:payload.notes,revision:updated.updateTime||null},{headers});
}


// A private, non-destructive health check. The Worker must verify an App Monitor
// administrator passkey session BEFORE invoking this handler. Never return
// Firestore document contents, bearer tokens, service account data, or UIDs.
export async function inclassFamilyNotesHealth(env,{getGoogleToken,fetchImpl=fetch}={}){
 const headers={'Cache-Control':'no-store'};
 const status=(code,stage,detail)=>Response.json(
   {ok:code===200,service:'inclass-family-notes',stage,...(detail?{detail}:{})},
   {status:code,headers}
 );
 if(!env.FIREBASE_ADMIN_SERVICE_ACCOUNT_JSON)return status(503,'firebase-credential-missing');
 let token;
 try{token=await getGoogleToken(env)}
 catch{return status(503,'firebase-google-auth-failed')}
 const check=docUrl('sai','backend-healthcheck');
 let response;
 try{response=await fetchImpl(check,{headers:{Authorization:'Bearer '+token},cache:'no-store'})}
 catch{return status(502,'firestore-unreachable')}
 if(response.status===200||response.status===404)return status(200,'ready');
 if(response.status===401||response.status===403)return status(502,'firestore-permission-denied');
 return status(502,'firestore-read-failed',String(response.status));
}
