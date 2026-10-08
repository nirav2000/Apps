import test from 'node:test';
import assert from 'node:assert/strict';
import { ownerDataRoute } from './app-monitor-owner-routes.js';

const env={FIREBASE_ADMIN_SERVICE_ACCOUNT_JSON:'configured',FIREBASE_OWNER_PROJECT_IDS:'kk-syllabus,snag-509418'};
const headers={'Access-Control-Allow-Origin':'https://nirav2000.github.io'};
const route=(name,params={})=>new URL('https://example.test/app-monitor/owner/data/'+name+'?'+new URLSearchParams(params));
const run=(name,params={})=>ownerDataRoute(new Request(route(name,params)),env,headers,route(name,params),async()=> 'test-access-token');

test('dashboard handles partial Google failures without HTTP 502',async()=>{
 const previous=globalThis.fetch;
 globalThis.fetch=async input=>{
  const u=String(input);
  if(u.includes('identitytoolkit'))return Response.json({users:[{localId:'u1',email:'person@example.com',passwordHash:'not-for-client'}]});
  return Response.json({error:{status:'PERMISSION_DENIED'}},{status:403});
 };
 try{
  const response=await run('dashboard');
  assert.equal(response.status,200);
  const body=await response.json();
  assert.equal(body.projects.length,2);
  assert.equal(body.projects[0].firestore.ok,false);
  assert.equal(body.projects[0].authentication.users[0].email,'person@example.com');
  assert.equal(JSON.stringify(body).includes('not-for-client'),false);
 }finally{globalThis.fetch=previous}
});

test('users endpoint supports pagination',async()=>{
 const previous=globalThis.fetch;
 globalThis.fetch=async input=>{
  assert.equal(new URL(String(input)).searchParams.get('nextPageToken'),'page2');
  return Response.json({users:[{localId:'u2'}],nextPageToken:'page3'});
 };
 try{
  const response=await run('users',{project:'snag-509418',pageToken:'page2'});
  assert.equal(response.status,200);
  assert.equal((await response.json()).nextPageToken,'page3');
 }finally{globalThis.fetch=previous}
});

test('rejects unknown projects and invalid collection paths',async()=>{
 assert.equal((await run('users',{project:'not-allowed'})).status,400);
 assert.equal((await run('documents',{project:'snag-509418',collection:'snag_projects/id'})).status,400);
});

test('Firestore browsing requests are read-only',async()=>{
 const previous=globalThis.fetch;
 globalThis.fetch=async (input,options)=>{
  assert.equal(options.method,'POST');
  assert.equal(new URL(String(input)).pathname.endsWith('/documents:listCollectionIds'),true);
  return Response.json({collectionIds:['snag_projects']});
 };
 try{
  const response=await run('collections',{project:'snag-509418'});
  assert.deepEqual((await response.json()).collections,['snag_projects']);
 }finally{globalThis.fetch=previous}
});
