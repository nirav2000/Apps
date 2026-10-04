import{createNotifications,mountRecipientPreferences,mountDeliveryDestinations,mountNotificationInbox,showNotificationToast,notificationStyles,registerWebPush}from'./notifications/v1/index.js';

const USER='app-monitor-admin',SCOPE='admin',EVENTS=[{id:'security.new_human',label:'New human visitor'}];

function styles(){
 if(document.getElementById('appMonitorNotificationsStyles'))return;
 const s=document.createElement('style');s.id='appMonitorNotificationsStyles';
 s.textContent=notificationStyles()+'.amn{display:grid;gap:14px}.amn-head,.amn-actions{display:flex;gap:10px;align-items:center;justify-content:space-between;flex-wrap:wrap}.amn-box{padding:12px;border:1px solid #dfe6eb;border-radius:12px;background:#f8fafb}.amn-people{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:7px;margin:9px 0}.amn-people label{display:flex;gap:7px;align-items:center;padding:8px;border:1px solid #dfe6eb;border-radius:9px;background:#fff}.amn-pill{border:1px solid #d7e0e6;border-radius:999px;padding:5px 8px;font-size:11px}.amn-pill.ok{background:#e9f8ef;color:#166534}.amn-pill.setup{background:#fff5df;color:#8a4b00}.amn-badge{min-width:20px;height:20px;padding:0 6px;border-radius:999px;background:#b42318;color:#fff;display:inline-grid;place-items:center;font-size:11px}.amn-badge.hidden{display:none}@media(max-width:640px){.amn-people{grid-template-columns:1fr}}';
 document.head.appendChild(s);
}

export async function mountAppMonitorNotifications({root,apiBase,getHeaders,onUnauthorized}={}){
 if(!root||!apiBase||!getHeaders)throw new Error('Notification mount requires root, apiBase and getHeaders');
 styles();let cache=null;
 async function req(path,options={}){
  const r=await fetch(apiBase+'/notifications'+path,{cache:'no-store',...options,headers:{...(options.body?{'Content-Type':'application/json'}:{}),...getHeaders(),...(options.headers||{})}});
  if(r.status===401){onUnauthorized?.();throw new Error('App Monitor session expired')}
  let data=null;try{data=await r.json()}catch{}
  if(!r.ok)throw new Error(data?.error||('Notification service '+r.status));
  return data;
 }
 async function state(force=false){if(!cache||force)cache=await req('/state');return cache}
 const transport={
  policy:async()=>(await state()).policy,
  preferences:async()=>(await state()).preferences,
  savePreferences:async(scope,user,prefs)=>{const d=await req('/preferences',{method:'POST',body:JSON.stringify({preferences:prefs})});cache=null;return d.preferences},
  inbox:async(scope,user,{limit=50}={})=>((await state()).inbox||[]).slice(0,limit),
  deliveryLog:async(scope,{limit=80}={})=>((await state()).deliveryLog||[]).slice(0,limit),
  readiness:async()=>(await state()).readiness,
  unreadCount:async()=>Number((await state()).unread)||0,
  markRead:async(scope,user,id)=>{const d=await req('/read',{method:'POST',body:JSON.stringify({id})});cache=null;return d.item},
  emit:async()=>{throw new Error('App Monitor events are emitted by the trusted backend')}
 };
 const client=createNotifications({app:'app-monitor',transport,eventTypes:EVENTS.map(x=>x.id)});
 root.innerHTML='<div class="amn"><div class="amn-head"><div><h2>Notifications</h2><p class="muted small">Shared Notifications v1 is installed in App Monitor.</p></div><div class="amn-actions"><span id="amnUnread" class="amn-badge hidden">0</span><button id="amnTest" type="button">Run notification test</button></div></div><div id="amnReady" class="amn-actions"></div><div class="amn-box"><h3>New visitor alerts</h3><label class="small"><input id="amnEnabled" type="checkbox"> Alert me when a genuinely new human visitor is first seen on a tracked app</label><p class="small muted">Choose the existing App Monitor Person labels that represent you so your own activity is ignored.</p><div id="amnPeople" class="amn-people"></div><p id="amnPeopleHelp" class="small muted"></p><button id="amnSave" type="button">Save visitor alert settings</button><p id="amnStatus" class="small muted"></p></div><div id="amnPrefs"></div><div id="amnDest"></div><div class="amn-box"><h3>Browser push on this device</h3><button id="amnPush" type="button">Enable browser push</button><p id="amnPushStatus" class="small muted"></p></div><div id="amnInbox"></div></div>';

 async function render(){
  const s=await state(true),ready=s.readiness||{},rr=root.querySelector('#amnReady');
  const pills=[['In-app',ready.inApp?.status],['Push',ready.providers?.web_push?.status],['Email',ready.providers?.email?.status],['SMS',ready.providers?.sms?.status],['WhatsApp',ready.providers?.whatsapp?.status]];
  rr.innerHTML=pills.map(([l,v])=>'<span class="amn-pill '+(v==='ready'?'ok':'setup')+'">'+l+': '+(v==='ready'?'Ready':'Setup required')+'</span>').join('');
  root.querySelector('#amnEnabled').checked=s.settings?.enabled===true;
  const people=root.querySelector('#amnPeople');people.innerHTML='';
  for(const p of s.availablePeople||[]){const l=document.createElement('label'),b=document.createElement('input'),t=document.createElement('span');b.type='checkbox';b.value=p;b.checked=(s.settings?.ownerPeople||[]).includes(p);t.textContent=p;l.append(b,t);people.appendChild(l)}
  root.querySelector('#amnPeopleHelp').textContent=(s.availablePeople||[]).length?'Select every Person label that is you.':'No Person labels exist yet. Assign your own sessions to a Person before enabling visitor alerts.';
  await mountRecipientPreferences(root.querySelector('#amnPrefs'),{client,scopeId:SCOPE,userId:USER,role:'owner',eventTypes:EVENTS,respectReadiness:true,setupContext:{credentialHost:'Snag repository Actions secrets',workerName:'Cloudflare Worker apps-monitor-api',secretsUrl:'https://github.com/nirav2000/snag/settings/secrets/actions',guideUrl:'https://nirav2000.github.io/Apps/NOTIFICATIONS_SETUP.md'}});
  await mountDeliveryDestinations(root.querySelector('#amnDest'),{client,scopeId:SCOPE,userId:USER});
  await mountNotificationInbox(root.querySelector('#amnInbox'),{client,scopeId:SCOPE,userId:USER,limit:80,onUnreadChange:n=>{const x=root.querySelector('#amnUnread');x.textContent=String(n);x.classList.toggle('hidden',!n)}});
  const pc=s.publicConfig?.webPush?.configured===true;root.querySelector('#amnPush').disabled=!pc;root.querySelector('#amnPushStatus').textContent=pc?'Provider ready; this device still needs your permission.':'Push provider is not configured yet.';
 }
 root.querySelector('#amnSave').onclick=async()=>{const ownerPeople=[...root.querySelectorAll('#amnPeople input:checked')].map(x=>x.value),enabled=root.querySelector('#amnEnabled').checked;try{await req('/settings',{method:'POST',body:JSON.stringify({enabled,ownerPeople})});cache=null;root.querySelector('#amnStatus').textContent=enabled?'New human visitor alerts enabled.':'New human visitor alerts disabled.';await render()}catch(e){root.querySelector('#amnStatus').textContent=e.message==='owner-identity-required'?'Choose at least one of your Person labels before enabling alerts.':e.message}};
 root.querySelector('#amnTest').onclick=async()=>{const b=root.querySelector('#amnTest');b.disabled=true;try{await req('/test',{method:'POST'});cache=null;showNotificationToast({title:'App Monitor notifications are working',body:'The test reached the production R2 notification inbox.'});await render()}finally{b.disabled=false}};
 root.querySelector('#amnPush').onclick=async()=>{const status=root.querySelector('#amnPushStatus');try{const s=await state(true),appId=s.publicConfig?.webPush?.appId;if(!appId){status.textContent='Push provider is not configured yet.';return}const externalId='app-monitor:'+USER,result=await registerWebPush({appId,externalId});if(!result.ok){status.textContent='Push was not enabled: '+result.reason;return}const p=await client.preferences(SCOPE,USER);p.destinations=p.destinations||{};p.channels=p.channels||{};p.destinations.oneSignalExternalId=externalId;p.channels.web_push=true;await client.savePreferences(SCOPE,USER,p);cache=null;status.textContent='Browser push enabled on this device.';await render()}catch(e){status.textContent=String(e?.message||e)}};
 await render();return{client,refresh:render};
}
