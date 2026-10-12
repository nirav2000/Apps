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
 const notes=createNotes({appId:'test',transport:{list:async()=>[],save:async()=>{throw Error('cloud down')}}});
 await notes.load();await assert.rejects(notes.upsert({text:'Not persisted'}),/cloud down/);
 assert.equal(notes.list().length,0);
});
