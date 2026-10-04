import { createNotifications, CHANNELS } from './index.js';
import { createMemoryTransport } from './memory-transport.js';
import { mountRecipientPreferences, mountPolicyDefaults, mountRoleNotificationPolicy, mountMemberNotificationSettings } from './ui.js';

const scopeId='lab-workspace';
const members=[
  {userId:'owner-1',name:'Alex · Policy controller',role:'owner'},
  {userId:'admin-1',name:'Morgan · Administrator',role:'admin'},
  {userId:'member-1',name:'Riley · Member',role:'member'},
  {userId:'external-1',name:'Casey · External collaborator',role:'external'}
];
const events=[
  {id:'record.created',label:'New record created'},
  {id:'record.updated',label:'Record changed'},
  {id:'comment.added',label:'New comment'},
  {id:'deadline.approaching',label:'Deadline approaching'},
  {id:'security.new_login',label:'New sign-in'}
];

const initialPolicy={
  policyOwnerId:'owner-1',
  costBearerId:'owner-1',
  allowedChannels:{
    in_app:true,
    web_push:true,
    email:true,
    telegram:false,
    whatsapp:false,
    signal:false,
    slack:false,
    discord:false,
    sms:false,
    ios_push:false
  },
  allowedEvents:Object.fromEntries(events.map(x=>[x.id,true])),
  roleChannels:{
    admin:{slack:true},
    external:{email:false,web_push:true}
  },
  roleEvents:{
    external:{'security.new_login':false}
  },
  userChannels:{
    'member-1':{sms:false}
  },
  userEvents:{},
  mandatoryEvents:{'security.new_login':true}
};

const transport=createMemoryTransport({
  members,
  eventTypes:events.map(x=>x.id),
  initialPolicy,
  storageKey:'apps.notifications.lab.v2'
});
const client=createNotifications({app:'notifications-lab',transport,eventTypes:events.map(x=>x.id)});

const $=id=>document.getElementById(id);
let currentUserId='owner-1';
let selectedMemberId='member-1';
let selectedRole='member';

function member(id){return members.find(x=>x.userId===id)}
function escapeHtml(value){return String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function fresh(id){
  const old=$(id),next=old.cloneNode(false);
  old.replaceWith(next);
  return next;
}
function chip(label,on=true){return '<span class="chip '+(on?'on':'off')+'">'+escapeHtml(label)+'</span>'}
function eventLabel(id){return events.find(x=>x.id===id)?.label||id}
function showNotificationToast(title,body){
  $('notificationToastTitle').textContent=title||'Notification';
  $('notificationToastBody').textContent=body||'';
  $('notificationToast').classList.remove('hidden');
  clearTimeout(showNotificationToast.timer);
  showNotificationToast.timer=setTimeout(()=>$('notificationToast').classList.add('hidden'),5000);
}
function updatePreviewBadge(count){
  $('previewBadge').textContent=String(count||0);
  $('previewBadge').classList.toggle('hidden',!count);
}
function setReadinessResult(name,value,state='ok'){
  const el=document.querySelector('[data-readiness="'+name+'"]');
  if(!el)return;
  el.textContent=value;
  el.dataset.state=state;
}

async function seed(){
  const marker=localStorage.getItem('apps.notifications.lab.seeded.v2');
  if(marker)return;
  await client.savePreferences(scopeId,'owner-1',{channels:{in_app:true,web_push:true,email:true,sms:true},events:{}});
  await client.savePreferences(scopeId,'admin-1',{channels:{in_app:true,email:true,slack:true},events:{}});
  await client.savePreferences(scopeId,'member-1',{channels:{in_app:true,email:true},events:{}});
  await client.savePreferences(scopeId,'external-1',{channels:{in_app:true,web_push:true},events:{}});
  localStorage.setItem('apps.notifications.lab.seeded.v2','1');
}

function populateStaticControls(){
  $('personaSelect').innerHTML=members.map(x=>'<option value="'+x.userId+'">'+escapeHtml(x.name)+'</option>').join('');
  $('personaSelect').value=currentUserId;
  $('roleSelect').innerHTML=[...new Set(members.filter(x=>x.role!=='owner').map(x=>x.role))].map(role=>'<option value="'+escapeHtml(role)+'">'+escapeHtml(role)+'</option>').join('');
  $('roleSelect').value=selectedRole;
  $('memberSelect').innerHTML=members.filter(x=>x.userId!=='owner-1').map(x=>'<option value="'+x.userId+'">'+escapeHtml(x.name)+'</option>').join('');
  $('memberSelect').value=selectedMemberId;
  $('eventSelect').innerHTML=events.map(x=>'<option value="'+x.id+'">'+escapeHtml(x.label)+'</option>').join('');
  $('recipientChecks').innerHTML=members.map(x=>'<label><input type="checkbox" value="'+x.userId+'" '+(x.userId!=='owner-1'?'checked':'')+'> '+escapeHtml(x.name)+'</label>').join('');
}

async function renderPersona(){
  const user=member(currentUserId);
  const policy=await client.policy(scopeId);
  const preferences=await client.preferences(scopeId,currentUserId);
  const effective=client.effective({policy,preferences,userId:user.userId,role:user.role});

  $('previewPersona').textContent=user.name;
  $('personaSummary').innerHTML='<strong>'+escapeHtml(user.name)+'</strong><span>Role supplied by the consuming app: <code>'+escapeHtml(user.role)+'</code></span><br><span>'+(policy.policyOwnerId===user.userId?'This user controls notification policy and is recorded as the cost bearer in this demo.':'This user is governed by the policy ceiling plus their own preferences.')+'</span>';

  const enabledChannels=Object.entries(effective.channels).filter(([,v])=>v.enabled);
  const blockedChannels=Object.entries(effective.channels).filter(([,v])=>!v.allowed);
  const enabledEvents=Object.entries(effective.events).filter(([,v])=>v.enabled);
  const blockedEvents=Object.entries(effective.events).filter(([,v])=>!v.allowed);
  $('effectiveSummary').innerHTML=
    '<div class="effective-box"><h3>Delivery methods enabled</h3><div class="chips">'+(enabledChannels.map(([k])=>chip(CHANNELS[k]?.label||k)).join('')||chip('None',false))+'</div></div>'+
    '<div class="effective-box"><h3>Delivery methods blocked by policy</h3><div class="chips">'+(blockedChannels.map(([k])=>chip(CHANNELS[k]?.label||k,false)).join('')||chip('None')).replaceAll('chip on','chip off')+'</div></div>'+
    '<div class="effective-box"><h3>Notification events enabled</h3><div class="chips">'+(enabledEvents.map(([k])=>chip(eventLabel(k))).join('')||chip('None',false))+'</div></div>'+
    '<div class="effective-box"><h3>Notification events blocked by policy</h3><div class="chips">'+(blockedEvents.map(([k])=>chip(eventLabel(k),false)).join('')||chip('None'))+'</div></div>';

  const prefRoot=fresh('recipientPreferences');
  await mountRecipientPreferences(prefRoot,{client,scopeId,userId:user.userId,role:user.role,eventTypes:events});

  const isController=policy.policyOwnerId===user.userId;
  $('controllerCard').classList.toggle('hidden',!isController);
  $('roleAccessCard').classList.toggle('hidden',!isController);
  $('memberAccessCard').classList.toggle('hidden',!isController);
  if(isController){
    const policyRoot=fresh('policyDefaults');
    await mountPolicyDefaults(policyRoot,{client,scopeId,eventTypes:events});
    const roleRoot=fresh('roleEditor');
    await mountRoleNotificationPolicy(roleRoot,{client,scopeId,role:selectedRole,eventTypes:events});
    const memberRoot=fresh('memberEditor');
    await mountMemberNotificationSettings(memberRoot,{client,scopeId,member:member(selectedMemberId),eventTypes:events});
  }

  await renderInbox();
  await renderDeliveryLog();
}

async function renderInbox(){
  const items=await client.inbox(scopeId,currentUserId,{limit:50});
  $('inboxTitle').textContent='In-app notifications · '+member(currentUserId).name.split(' · ')[0];
  $('inboxList').innerHTML=items.map(item=>
    '<article class="inbox-item"><strong>'+escapeHtml(item.title||eventLabel(item.type))+'</strong><div>'+escapeHtml(item.body||'')+'</div><small>'+new Date(item.storedAt||item.createdAt).toLocaleString()+' · '+escapeHtml(eventLabel(item.type))+'</small></article>'
  ).join('')||'<p>No in-app notifications for this user yet.</p>';
  updatePreviewBadge(items.length);
  return items;
}

async function renderDeliveryLog(){
  const rows=await client.deliveryLog(scopeId,{limit:100});
  $('deliveryRows').innerHTML=rows.map(row=>
    '<tr><td>'+new Date(row.at).toLocaleTimeString()+'</td><td>'+escapeHtml(eventLabel(row.eventType))+'</td><td>'+escapeHtml(member(row.recipient)?.name||row.recipient)+'</td><td>'+escapeHtml(row.channel?CHANNELS[row.channel]?.label||row.channel:'—')+'</td><td>'+escapeHtml(row.status)+'</td><td>'+escapeHtml(row.cost||'—')+'</td><td>'+escapeHtml(member(row.costBearerId)?.name||row.costBearerId||'—')+'</td></tr>'
  ).join('')||'<tr><td colspan="7">No deliveries yet. Send a simulated event.</td></tr>';
}

async function sendEvent(){
  const recipients=[...$('recipientChecks').querySelectorAll('input:checked')].map(x=>x.value);
  const type=$('eventSelect').value;
  if(!recipients.length){$('sendStatus').textContent='Select at least one recipient.';return}
  const result=await client.emit(type,{
    scopeId,
    actorId:currentUserId,
    recipients,
    title:$('eventTitle').value.trim()||eventLabel(type),
    body:$('eventBody').value.trim(),
    priority:type==='security.new_login'?'high':'normal'
  });
  const sent=result.results.filter(x=>x.status==='stored'||x.status==='simulated').length;
  const blocked=result.results.filter(x=>x.status.startsWith('blocked')).length;
  $('sendStatus').textContent='Event processed: '+sent+' delivery route'+(sent===1?'':'s')+', '+blocked+' blocked by policy/preferences.';
  const currentReceived=result.results.some(x=>x.recipient===currentUserId&&x.channel==='in_app'&&x.status==='stored');
  if(currentReceived)showNotificationToast($('eventTitle').value.trim()||eventLabel(type),$('eventBody').value.trim());
  await renderInbox();
  await renderDeliveryLog();
}

async function runReadinessTest(){
  $('previewReadinessPill').textContent='Testing…';
  $('previewReadinessPill').className='service-state setup';
  setReadinessResult('module','Loaded','ok');
  setReadinessResult('policy','Checking…','pending');
  setReadinessResult('popup','Checking…','pending');

  const policy=await client.policy(scopeId);
  const user=member(currentUserId);
  const prefs=await client.preferences(scopeId,currentUserId);
  const effective=client.effective({policy,preferences:prefs,userId:user.userId,role:user.role});

  if(!effective.events['record.updated']?.enabled){
    setReadinessResult('policy','Blocked by current settings','fail');
    setReadinessResult('popup','Not tested','fail');
    $('previewReadinessPill').textContent='Blocked by settings';
    $('previewReadinessPill').className='service-state setup';
    return;
  }
  if(!effective.channels.in_app?.enabled){
    setReadinessResult('policy','Event allowed','ok');
    setReadinessResult('popup','In-app delivery is off','fail');
    $('previewReadinessPill').textContent='In-app is off';
    $('previewReadinessPill').className='service-state setup';
    return;
  }

  setReadinessResult('policy','Passed','ok');
  const before=(await client.inbox(scopeId,currentUserId,{limit:100})).length;
  const title='Notifications are working';
  const body='This test passed through the shared policy, preferences, inbox and app-style popup.';
  const result=await client.emit('record.updated',{
    scopeId,
    actorId:currentUserId,
    recipients:[currentUserId],
    title,
    body,
    priority:'normal'
  });
  const afterItems=await client.inbox(scopeId,currentUserId,{limit:100});
  const stored=result.results.some(x=>x.recipient===currentUserId&&x.channel==='in_app'&&x.status==='stored')&&afterItems.length>before;

  if(stored){
    showNotificationToast(title,body);
    setReadinessResult('popup','Passed','ok');
    $('previewReadinessPill').textContent='Shared module ready';
    $('previewReadinessPill').className='service-state live';
  }else{
    setReadinessResult('popup','Failed','fail');
    $('previewReadinessPill').textContent='Test failed';
    $('previewReadinessPill').className='service-state setup';
  }
  await renderInbox();
  await renderDeliveryLog();
}

async function rerender(){
  await renderPersona();
}

$('personaSelect').addEventListener('change',async e=>{currentUserId=e.target.value;await rerender()});
$('roleSelect').addEventListener('change',async e=>{selectedRole=e.target.value;await rerender()});
$('memberSelect').addEventListener('change',async e=>{selectedMemberId=e.target.value;await rerender()});
$('sendEvent').addEventListener('click',sendEvent);
$('runReadinessTest').addEventListener('click',()=>runReadinessTest().catch(error=>{
  console.error(error);
  $('previewReadinessPill').textContent='Test error';
  $('previewReadinessPill').className='service-state setup';
  setReadinessResult('popup',String(error?.message||error),'fail');
}));
$('previewBell').addEventListener('click',()=>document.getElementById('inboxList')?.scrollIntoView({behavior:'smooth',block:'center'}));
$('closeNotificationToast').addEventListener('click',()=>$('notificationToast').classList.add('hidden'));
$('resetLab').addEventListener('click',()=>{
  transport.reset();
  localStorage.removeItem('apps.notifications.lab.seeded.v2');
  location.reload();
});

async function init(){
  await seed();
  populateStaticControls();
  await rerender();
}
init().catch(error=>{
  console.error(error);
  const status=document.getElementById('sendStatus');
  if(status) status.textContent='Notifications Lab failed to initialise: '+String(error?.message||error);
});
