import assert from 'node:assert/strict';
import { createR2NotificationService } from './r2-transport.js';

class FakeR2 {
  constructor(){this.map=new Map()}
  async get(key){
    if(!this.map.has(key))return null;
    const value=this.map.get(key);
    return {text:async()=>value};
  }
  async put(key,value){this.map.set(key,String(value))}
  async list({prefix='',limit=1000}={}){
    const objects=[...this.map.keys()].filter(k=>k.startsWith(prefix)).slice(0,limit).map(key=>({key}));
    return {objects,truncated:false};
  }
}

const bucket=new FakeR2();
const service=createR2NotificationService({
  bucket,
  app:'consumer-test',
  eventTypes:['security.new_human'],
  defaultPolicy:{
    policyOwnerId:'admin',
    costBearerId:'admin',
    allowedChannels:{in_app:true,email:true},
    allowedEvents:{'security.new_human':true}
  },
  resolveMember:async userId=>userId==='admin'?{userId:'admin',role:'owner'}:null
});

await service.savePreferences('admin','admin',{
  channels:{in_app:true,email:false},
  events:{'security.new_human':true}
});

const event={
  version:1,id:'evt-1',type:'security.new_human',app:'consumer-test',scopeId:'admin',
  recipients:['admin'],title:'New human visitor',body:'Test visitor',createdAt:new Date().toISOString()
};

const result=await service.emit(event,{});
assert.equal(result.ok,true);
assert.equal(result.results.some(x=>x.channel==='in_app'&&x.status==='stored'),true);

const inbox=await service.inbox('admin','admin',{limit:10});
assert.equal(inbox.length,1);
assert.equal(inbox[0].title,'New human visitor');
assert.equal(await service.unreadCount('admin','admin'),1);

await service.markRead('admin','admin','evt-1');
assert.equal(await service.unreadCount('admin','admin'),0);

const readiness=await service.readiness('admin',{});
assert.equal(readiness.core.status,'ready');
assert.equal(readiness.inApp.status,'ready');
assert.equal(readiness.production.status,'ready');
assert.equal(readiness.providers.email.status,'setup-required');
assert.equal(readiness.providers.web_push.status,'setup-required');

console.log('R2 notification production transport test passed');
