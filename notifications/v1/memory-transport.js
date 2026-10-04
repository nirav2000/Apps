import { normalisePolicy, normalisePreferences, effectivePreferences } from './policy.js';

function clone(value){return JSON.parse(JSON.stringify(value))}
function key(scopeId,userId){return String(scopeId||'default')+'::'+String(userId||'')}

export function createMemoryTransport({
  members = [],
  eventTypes = [],
  initialPolicy = {},
  storageKey = 'apps.notifications.lab.v1'
} = {}) {
  const memberMap = new Map(members.map(member => [String(member.userId), {...member,userId:String(member.userId)}]));
  let state = {
    policies: { default: normalisePolicy(initialPolicy) },
    preferences: {},
    inboxes: {},
    deliveries: []
  };

  try{
    const saved = localStorage.getItem(storageKey);
    if(saved) state = {...state,...JSON.parse(saved)};
  }catch{}

  function persist(){
    try{localStorage.setItem(storageKey,JSON.stringify(state))}catch{}
  }
  function scopePolicy(scopeId='default'){
    const id=String(scopeId||'default');
    if(!state.policies[id]) state.policies[id]=normalisePolicy({...initialPolicy});
    return state.policies[id];
  }
  function prefs(scopeId,userId){
    const k=key(scopeId,userId);
    if(!state.preferences[k]) state.preferences[k]=normalisePreferences({updatedBy:String(userId||'')});
    return state.preferences[k];
  }
  function inboxKey(scopeId,userId){return key(scopeId,userId)}
  function log(entry){
    state.deliveries.unshift({...entry,at:new Date().toISOString()});
    state.deliveries=state.deliveries.slice(0,250);
  }

  return {
    async policy(scopeId='default'){return clone(scopePolicy(scopeId))},
    async savePolicy(scopeId='default',policy){
      state.policies[String(scopeId||'default')]=normalisePolicy(policy);persist();
      return clone(state.policies[String(scopeId||'default')]);
    },
    async preferences(scopeId='default',userId){
      return clone(prefs(scopeId,userId));
    },
    async savePreferences(scopeId='default',userId,preferences){
      const member=memberMap.get(String(userId))||{userId:String(userId),role:'member'};
      const policy=scopePolicy(scopeId);
      const current=prefs(scopeId,userId);
      const input=normalisePreferences(preferences);
      const next=normalisePreferences({...current,destinations:{...current.destinations,...input.destinations}});
      next.channels={...current.channels};
      next.events={...current.events};

      for(const [channel,value] of Object.entries(input.channels||{})){
        const effective=effectivePreferences({policy,preferences:{channels:{[channel]:value}},userId:member.userId,role:member.role,eventTypes:[]});
        if(effective.channels[channel]?.allowed) next.channels[channel]=value===true;
      }
      for(const [eventType,value] of Object.entries(input.events||{})){
        const effective=effectivePreferences({policy,preferences:{events:{[eventType]:value}},userId:member.userId,role:member.role,eventTypes:[eventType]});
        if(effective.events[eventType]?.allowed&&!effective.events[eventType]?.mandatory) next.events[eventType]=value!==false;
      }
      for(const [eventType,required] of Object.entries(policy.mandatoryEvents||{})) if(required===true) next.events[eventType]=true;
      next.updatedBy=String(userId||'');next.updatedAt=new Date().toISOString();
      state.preferences[key(scopeId,userId)]=next;persist();return clone(next);
    },
    async inbox(scopeId='default',userId,{limit=50}={}){
      return clone((state.inboxes[inboxKey(scopeId,userId)]||[]).slice(0,limit));
    },
    async deliveryLog(scopeId='default',{limit=100}={}){
      return clone(state.deliveries.filter(x=>x.scopeId===String(scopeId||'default')).slice(0,limit));
    },
    async emit(event){
      const scopeId=String(event.scopeId||'default'),policy=scopePolicy(scopeId),results=[];
      for(const recipient of event.recipients||[]){
        const member=memberMap.get(String(recipient));
        if(!member){results.push({recipient,status:'unknown-recipient'});continue}
        const pref=prefs(scopeId,recipient);
        const effective=effectivePreferences({policy,preferences:pref,userId:member.userId,role:member.role,eventTypes:[event.type]});
        if(!effective.events[event.type]?.enabled){
          const entry={scopeId,eventId:event.id,eventType:event.type,recipient:member.userId,channel:null,status:'blocked-event'};
          log(entry);results.push(entry);continue
        }

        for(const [channel,detail] of Object.entries(effective.channels)){
          if(!detail.enabled)continue;
          const entry={scopeId,eventId:event.id,eventType:event.type,recipient:member.userId,channel,status:channel==='in_app'?'stored':'simulated',cost:detail.cost,costBearerId:policy.costBearerId||policy.policyOwnerId||''};
          log(entry);results.push(entry);
          if(channel==='in_app'){
            const k=inboxKey(scopeId,member.userId);
            state.inboxes[k]=state.inboxes[k]||[];
            state.inboxes[k].unshift({...event,recipientId:member.userId,read:false,storedAt:new Date().toISOString()});
            state.inboxes[k]=state.inboxes[k].slice(0,100);
          }
        }
      }
      persist();
      return {ok:true,eventId:event.id,results:clone(results)};
    },
    members(){return clone([...memberMap.values()])},
    reset(){
      state={policies:{default:normalisePolicy(initialPolicy)},preferences:{},inboxes:{},deliveries:[]};persist();
    }
  };
}
