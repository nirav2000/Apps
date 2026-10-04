import { normalisePolicy, normalisePreferences, effectivePreferences } from './policy.js';
import { providerStatus, deliverNotification } from './providers.js';

function clone(value){return JSON.parse(JSON.stringify(value))}
function clean(value){return String(value||'').replace(/[^A-Za-z0-9._:@-]/g,'-').slice(0,180)||'default'}

async function getJSON(bucket,key){
  const object=await bucket.get(key);
  if(!object)return null;
  try{return JSON.parse(await object.text())}catch{return null}
}
async function putJSON(bucket,key,value){
  await bucket.put(key,JSON.stringify(value),{httpMetadata:{contentType:'application/json'}});
}
async function listJSON(bucket,prefix,limit=100){
  const page=await bucket.list({prefix,limit:Math.min(1000,limit)});
  const out=[];
  for(const item of page.objects){
    const value=await getJSON(bucket,item.key);
    if(value)out.push(value);
  }
  return out;
}

export function createR2NotificationService({
  bucket,
  prefix='_notifications/v1/',
  app,
  eventTypes=[],
  defaultPolicy={},
  resolveMember=async userId=>({userId:String(userId),role:'member'})
}={}){
  if(!bucket)throw new Error('R2 bucket is required');
  if(!app)throw new Error('app is required');

  const root=prefix.endsWith('/')?prefix:prefix+'/';
  const policyKey=scopeId=>root+'scopes/'+clean(scopeId)+'/policy.json';
  const prefKey=(scopeId,userId)=>root+'scopes/'+clean(scopeId)+'/preferences/'+clean(userId)+'.json';
  const inboxPrefix=(scopeId,userId)=>root+'scopes/'+clean(scopeId)+'/inbox/'+clean(userId)+'/';
  const deliveryPrefix=scopeId=>root+'scopes/'+clean(scopeId)+'/deliveries/';
  const eventKey=(scopeId,eventId)=>root+'scopes/'+clean(scopeId)+'/events/'+clean(eventId)+'.json';

  async function policy(scopeId='default'){
    return normalisePolicy(await getJSON(bucket,policyKey(scopeId))||defaultPolicy);
  }
  async function savePolicy(scopeId='default',value){
    const next=normalisePolicy(value);
    await putJSON(bucket,policyKey(scopeId),next);
    return clone(next);
  }
  async function preferences(scopeId='default',userId){
    return normalisePreferences(await getJSON(bucket,prefKey(scopeId,userId))||{updatedBy:String(userId||'')});
  }
  async function savePreferences(scopeId='default',userId,value){
    const member=await resolveMember(userId);
    const p=await policy(scopeId);
    const current=await preferences(scopeId,userId);
    const input=normalisePreferences(value);
    const next=normalisePreferences({...current,destinations:{...current.destinations,...input.destinations}});
    next.channels={...current.channels};
    next.events={...current.events};

    const effective=effectivePreferences({
      policy:p,
      preferences:input,
      userId:String(userId),
      role:member?.role||'member',
      eventTypes
    });

    for(const [channel,detail] of Object.entries(effective.channels)){
      if(detail.allowed)next.channels[channel]=input.channels?.[channel]===true;
    }
    for(const type of eventTypes){
      const detail=effective.events[type];
      if(detail?.mandatory)next.events[type]=true;
      else if(detail?.allowed&&Object.prototype.hasOwnProperty.call(input.events||{},type))next.events[type]=input.events[type]!==false;
    }
    next.updatedAt=new Date().toISOString();
    next.updatedBy=String(userId||'');
    await putJSON(bucket,prefKey(scopeId,userId),next);
    return clone(next);
  }
  async function inbox(scopeId='default',userId,{limit=50}={}){
    const items=await listJSON(bucket,inboxPrefix(scopeId,userId),limit);
    items.sort((a,b)=>String(b.storedAt||b.createdAt).localeCompare(String(a.storedAt||a.createdAt)));
    return clone(items.slice(0,limit));
  }
  async function deliveryLog(scopeId='default',{limit=100}={}){
    const items=await listJSON(bucket,deliveryPrefix(scopeId),limit);
    items.sort((a,b)=>String(b.at).localeCompare(String(a.at)));
    return clone(items.slice(0,limit));
  }
  async function unreadCount(scopeId='default',userId){
    const items=await inbox(scopeId,userId,{limit:200});
    return items.filter(x=>x.read!==true).length;
  }
  async function markRead(scopeId='default',userId,id){
    const key=inboxPrefix(scopeId,userId)+clean(id)+'.json';
    const item=await getJSON(bucket,key);
    if(!item)return null;
    item.read=true;item.readAt=new Date().toISOString();
    await putJSON(bucket,key,item);
    return clone(item);
  }
  async function emit(event,env={}){
    const scopeId=String(event.scopeId||'default');
    const dedupe=event.id?await getJSON(bucket,eventKey(scopeId,event.id)):null;
    if(dedupe)return {ok:true,duplicate:true,eventId:event.id,results:dedupe.results||[]};

    const p=await policy(scopeId),providers=providerStatus(env),results=[];
    for(const userId of event.recipients||[]){
      const member=await resolveMember(userId);
      if(!member){results.push({recipient:String(userId),status:'unknown-recipient'});continue}
      const pref=await preferences(scopeId,userId);
      const effective=effectivePreferences({
        policy:p,preferences:pref,userId:String(userId),role:member.role||'member',eventTypes:[event.type]
      });
      if(!effective.events[event.type]?.enabled){
        results.push({recipient:String(userId),channel:null,status:'blocked-event'});
        continue;
      }

      for(const [channel,detail] of Object.entries(effective.channels)){
        if(!detail.enabled)continue;
        let status='blocked';
        let result={ok:false};
        if(channel==='in_app'){
          const stored={...event,recipientId:String(userId),read:false,storedAt:new Date().toISOString()};
          await putJSON(bucket,inboxPrefix(scopeId,userId)+clean(event.id)+'.json',stored);
          result={ok:true,status:'stored'};
          status='stored';
        }else if(!providers[channel]?.configured){
          status='setup-required';
          result={ok:false,status};
        }else{
          try{
            result=await deliverNotification(env,channel,event,pref.destinations||{});
            status=result.ok?'sent':(result.error||'failed');
          }catch(error){
            status='failed';result={ok:false,error:String(error?.message||error).slice(0,200)};
          }
        }
        const delivery={
          version:1,id:crypto.randomUUID(),app,scopeId,eventId:event.id,eventType:event.type,
          recipient:String(userId),channel,status,cost:detail.cost,
          costBearerId:p.costBearerId||p.policyOwnerId||'',at:new Date().toISOString()
        };
        await putJSON(bucket,deliveryPrefix(scopeId)+clean(delivery.id)+'.json',delivery);
        results.push({...delivery,result});
      }
    }
    if(event.id)await putJSON(bucket,eventKey(scopeId,event.id),{version:1,eventId:event.id,results,at:new Date().toISOString()});
    return {ok:true,eventId:event.id,results};
  }
  async function readiness(scopeId='default',env={}){
    const providers=providerStatus(env);
    return {
      version:1,scopeId:String(scopeId),
      core:{status:'ready',detail:'Shared Notifications service loaded'},
      inApp:{status:'ready',detail:'R2-backed inbox available'},
      production:{status:'ready',detail:'Authenticated production transport installed'},
      publicConfig:{webPush:{configured:!!env.ONESIGNAL_APP_ID,appId:String(env.ONESIGNAL_APP_ID||'')}},
      providers:Object.fromEntries(Object.entries(providers).map(([key,value])=>[
        key,{status:value.configured?'ready':'setup-required',cost:value.cost}
      ]))
    };
  }

  return {policy,savePolicy,preferences,savePreferences,inbox,deliveryLog,unreadCount,markRead,emit,readiness};
}
