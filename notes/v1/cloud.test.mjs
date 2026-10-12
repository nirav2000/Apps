import test from 'node:test';
import assert from 'node:assert/strict';
import {createCloudTransport} from './cloud.js';
import {createNotes} from './index.js';

test('cloud adapter requires authentication and HTTPS',async()=>{
 assert.throws(()=>createCloudTransport({appId:'test',apiBase:'http://example.com',getHeaders:()=>({})}),/HTTPS/);
 const t=createCloudTransport({appId:'test',apiBase:'https://example.com',getHeaders:()=>({}),fetchImpl:async()=>{throw Error('should not fetch')}});
 await assert.rejects(t.list(),/Sign in/);
});
test('cloud adapter sends scoped authenticated requests',async()=>{
 const calls=[];
 const transport=createCloudTransport({appId:'app-monitor',apiBase:'https://example.com/notes',getHeaders:()=>({'X-App-Monitor-Session':'secret'}),fetchImpl:async(url,options)=>{calls.push({url,options});return {ok:true,json:async()=>({notes:[],note:{id:'one'},status:'processed',results:[]})}}});
 await transport.list();await transport.save({id:'one',text:'A note'});await transport.publishReviewFeed({notes:[]});await transport.pullStatuses();
 assert.match(calls[0].url,/appId=app-monitor/);
 assert.equal(calls[1].options.method,'POST');
 assert.equal(JSON.parse(calls[1].options.body).note.appId,'app-monitor');
 assert.match(calls[2].url,/\/sync$/);
 assert.match(calls[3].url,/\/statuses\?appId=app-monitor$/);
});
test('cloud save failure must not add a false local note',async()=>{
 const notes=createNotes({appId:'test',page:()=>'/test',transport:{list:async()=>[],save:async()=>{throw Error('cloud down')}}});
 await notes.load();await assert.rejects(notes.upsert({text:'Not persisted'}),/cloud down/);
 assert.equal(notes.list().length,0);
});

test('cloud save returns issue status without dropping note metadata',async()=>{
 const transport=createCloudTransport({appId:'app-monitor',apiBase:'https://example.com/notes',getHeaders:()=>({'X-App-Monitor-Session':'test'}),fetchImpl:async()=>({ok:true,json:async()=>({note:{id:'one',appId:'app-monitor',text:'Test',metadata:{developmentIssue:{number:42,url:'https://github.com/nirav2000/Apps/issues/42'}}},review:{status:'created',number:42}})})});
 const result=await transport.save({id:'one',text:'Test'});
 assert.equal(result.review.number,42);
 assert.equal(result.note.metadata.developmentIssue.number,42);
});
test('verified status API sends deployment evidence',async()=>{
 let body;
 const transport=createCloudTransport({appId:'app-monitor',apiBase:'https://example.com/notes',getHeaders:()=>({'X-App-Monitor-Session':'test'}),fetchImpl:async(_url,options)=>{body=JSON.parse(options.body);return {ok:true,json:async()=>({ok:true})}}});
 await transport.verify('one',{version:'1.2.0',commit:'abcdef1234567',message:'Tested',testsVerified:true,deploymentVerified:true});
 assert.equal(body.action,'verify');assert.equal(body.appId,'app-monitor');assert.equal(body.testsVerified,true);
});
