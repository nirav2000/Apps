// Passkey-gated Firebase custom-token bridge for the existing Next/French owner.
// Fail closed unless app-monitor-worker.js passes a VERIFIED administrator
// passkey session. No UID, Firebase project, role or target path comes from the caller.
// The existing owner-only Firestore security rules remain unchanged.
export const FRENCH_FIREBASE_AUTH_VERSION='1.0.0';
const PROJECT='kk-syllabus';
const OWNER_UID='2AJSfYdtg5URWHv7HCzpNMmKIlg2';
const ALLOWED_ORIGIN='https://nirav2000.github.io';
const AUDIENCE='https://identitytoolkit.googleapis.com/google.identity.identitytoolkit.v1.IdentityToolkit';
const encoder=new TextEncoder();
const base64url=bytes=>{
  let text='';
  for(const value of bytes instanceof Uint8Array?bytes:new Uint8Array(bytes))text+=String.fromCharCode(value);
  return btoa(text).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
};
const json=(body,status,headers)=>Response.json(body,{status,headers});
export async function mintFrenchFirebaseToken(serviceAccount,{
  now=Math.floor(Date.now()/1000),cryptoImpl=globalThis.crypto
}={}){
  if(serviceAccount?.project_id!==PROJECT ||
     !/^[^@]+@[^@]+\.iam\.gserviceaccount\.com$/.test(String(serviceAccount?.client_email||'')) ||
     !String(serviceAccount?.private_key||'').includes('-----BEGIN PRIVATE KEY-----'))
    throw Error('The signing service account must belong to kk-syllabus');
  const iat=Math.floor(Number(now));
  if(!Number.isFinite(iat)||iat<1000000000)throw Error('Invalid signing time');
  const payload={iss:serviceAccount.client_email,sub:serviceAccount.client_email,
    aud:AUDIENCE,iat,exp:iat+3600,uid:OWNER_UID};
  const unsigned=base64url(encoder.encode(JSON.stringify({alg:'RS256',typ:'JWT'})))+'.'+
                 base64url(encoder.encode(JSON.stringify(payload)));
  const pem=serviceAccount.private_key.replace(/-----[^-]+-----/g,'').replace(/\s/g,'');
  const privateBytes=Uint8Array.from(atob(pem),character=>character.charCodeAt(0));
  const key=await cryptoImpl.subtle.importKey('pkcs8',privateBytes,
    {name:'RSASSA-PKCS1-v1_5',hash:'SHA-256'},false,['sign']);
  const signature=await cryptoImpl.subtle.sign('RSASSA-PKCS1-v1_5',key,encoder.encode(unsigned));
  return unsigned+'.'+base64url(new Uint8Array(signature));
}
// passkeySession must be obtained by the Worker from its private R2-backed
// session verifier, never from JSON or user-provided request values.
export async function frenchFirebaseOwnerTokenRoute(request,env,headers,{
  passkeySession,signer=mintFrenchFirebaseToken
}={}){
  const responseHeaders={...headers,'Cache-Control':'no-store, private','Pragma':'no-cache'};
  if(request.headers.get('Origin')!==ALLOWED_ORIGIN)
    return json({error:'Forbidden origin'},403,responseHeaders);
  if(request.method!=='POST')
    return json({error:'Method not allowed'},405,responseHeaders);
  if(!passkeySession?.ok || passkeySession.record?.method!=='passkey')
    return json({error:'Verified administrator passkey required'},401,responseHeaders);
  if(!env?.FIREBASE_ADMIN_SERVICE_ACCOUNT_JSON)
    return json({error:'Firebase signing is not configured'},503,responseHeaders);
  let serviceAccount;
  try{serviceAccount=JSON.parse(env.FIREBASE_ADMIN_SERVICE_ACCOUNT_JSON);}
  catch{return json({error:'Firebase signing configuration invalid'},503,responseHeaders);}
  // Never allow another project service account to mint owner access.
  if(serviceAccount.project_id!==PROJECT)
    return json({error:'Dedicated kk-syllabus signing account required'},503,responseHeaders);
  try{
    const customToken=await signer(serviceAccount);
    return json({ok:true,customToken,projectId:PROJECT,expiresIn:3600},200,responseHeaders);
  }catch{
    // Never include secrets, keys, or upstream errors in user-visible output.
    return json({error:'Unable to establish family Firebase session'},503,responseHeaders);
  }
}
