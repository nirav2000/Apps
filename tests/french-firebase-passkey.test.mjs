import test from 'node:test';
import assert from 'node:assert/strict';
import {webcrypto} from 'node:crypto';
import {
  FRENCH_FIREBASE_AUTH_VERSION,mintFrenchFirebaseToken,frenchFirebaseOwnerTokenRoute
} from '../french-teaching/v1/firebase-passkey-bridge.js';

const origin='https://nirav2000.github.io';
const headers={'Access-Control-Allow-Origin':origin};
const request=(method='POST',site=origin)=>new Request('https://example.test/app-monitor/owner/french/firebase-token',{
  method,headers:{Origin:site}
});
const passkey={ok:true,record:{method:'passkey'}};
const service={project_id:'kk-syllabus',client_email:'owner@kk-syllabus.iam.gserviceaccount.com',
  private_key:'-----BEGIN PRIVATE KEY-----\ndGVzdA==\n-----END PRIVATE KEY-----\n'};
const env={FIREBASE_ADMIN_SERVICE_ACCOUNT_JSON:JSON.stringify(service)};
const decode=x=>JSON.parse(new TextDecoder().decode(Buffer.from(x.replace(/-/g,'+').replace(/_/g,'/'),'base64')));

test('fixed-scope endpoint requires POST, correct Origin and a verified passkey',async()=>{
  assert.equal(FRENCH_FIREBASE_AUTH_VERSION,'1.0.0');
  const signer=async()=>{throw Error('Must never sign unauthenticated requests')};
  for(const [req,session,status] of [
    [request('GET'),passkey,405],
    [request('POST','https://example.org'),passkey,403],
    [request('POST'),undefined,401],
    [request('POST'),{ok:false,record:{method:'passkey'}},401],
    [request('POST'),{ok:true,record:{method:'recovery'}},401],
    [request('POST'),{ok:true,record:{method:'password'}},401]
  ]){
    const response=await frenchFirebaseOwnerTokenRoute(req,env,headers,{passkeySession:session,signer});
    assert.equal(response.status,status);
    assert.match(response.headers.get('cache-control'),/no-store/);
    assert.equal((await response.json()).customToken,undefined);
  }
});
test('rejects missing or wrong-project signing configuration',async()=>{
  const signer=async()=>{throw Error('Signing must not start for wrong project')};
  for(const bad of [undefined,{},{
    FIREBASE_ADMIN_SERVICE_ACCOUNT_JSON:'invalid json'
  },{
    FIREBASE_ADMIN_SERVICE_ACCOUNT_JSON:JSON.stringify({...service,project_id:'other-project'})
  }]){
    const response=await frenchFirebaseOwnerTokenRoute(request(),bad,headers,{passkeySession:passkey,signer});
    assert.equal(response.status,503);
    assert.equal((await response.json()).customToken,undefined);
  }
});
test('returns only a short-lived token for the configured Firebase project',async()=>{
  let invoked=0;
  const signer=async account=>{invoked++;assert.equal(account.project_id,'kk-syllabus');return 'test.token.value'};
  const response=await frenchFirebaseOwnerTokenRoute(request(),env,headers,{passkeySession:passkey,signer});
  assert.equal(response.status,200);
  assert.deepEqual(await response.json(),{
    ok:true,customToken:'test.token.value',projectId:'kk-syllabus',expiresIn:3600
  });
  assert.equal(invoked,1);
  assert.match(response.headers.get('cache-control'),/no-store/);
  assert.equal(response.headers.get('cache-control').includes('no-store'),true);
});
test('signs a valid RS256 Firebase custom JWT with the established parent UID',async()=>{
  const pair=await webcrypto.subtle.generateKey({
    name:'RSASSA-PKCS1-v1_5',modulusLength:2048,
    publicExponent:new Uint8Array([1,0,1]),hash:'SHA-256'
  },true,['sign','verify']);
  const bytes=new Uint8Array(await webcrypto.subtle.exportKey('pkcs8',pair.privateKey));
  const pem='-----BEGIN PRIVATE KEY-----\n'+Buffer.from(bytes).toString('base64').match(/.{1,64}/g).join('\n')+
    '\n-----END PRIVATE KEY-----';
  const jwt=await mintFrenchFirebaseToken({...service,private_key:pem},
    {now:1800000000,cryptoImpl:webcrypto});
  const parts=jwt.split('.');
  assert.equal(parts.length,3);
  assert.deepEqual(decode(parts[0]),{alg:'RS256',typ:'JWT'});
  const claims=decode(parts[1]);
  assert.equal(claims.iss,service.client_email);
  assert.equal(claims.sub,service.client_email);
  assert.equal(claims.aud,'https://identitytoolkit.googleapis.com/google.identity.identitytoolkit.v1.IdentityToolkit');
  assert.equal(claims.uid,'2AJSfYdtg5URWHv7HCzpNMmKIlg2');
  assert.equal(claims.exp-claims.iat,3600);
  assert.equal(claims.iat,1800000000);
  assert.equal(Object.hasOwn(claims,'claims'),false);
  const signature=Buffer.from(parts[2].replace(/-/g,'+').replace(/_/g,'/'),'base64');
  assert.equal(await webcrypto.subtle.verify('RSASSA-PKCS1-v1_5',pair.publicKey,signature,
    new TextEncoder().encode(parts[0]+'.'+parts[1])),true);
  await assert.rejects(mintFrenchFirebaseToken({...service,project_id:'wrong'},
    {now:1800000000,cryptoImpl:webcrypto}),/kk-syllabus/);
});
