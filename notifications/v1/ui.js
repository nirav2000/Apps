import { CHANNELS, effectivePreferences, normalisePolicy, normalisePreferences } from './policy.js';
import { PROVIDER_SETUP } from './providers.js';

const LABELS = Object.fromEntries(Object.values(CHANNELS).map(x => [x.id, x.label]));

function row({label,checked=false,disabled=false,reason='',key,kind,extra='',actionLabel='',onAction=null}) {
  const wrapper = document.createElement('div');
  wrapper.className = 'apps-notification-row';

  const text = document.createElement('div');
  text.className = 'apps-notification-row-text';
  const strong = document.createElement('strong');
  strong.textContent = label;
  text.appendChild(strong);

  if (reason || extra) {
    const small = document.createElement('small');
    small.textContent = [reason,extra].filter(Boolean).join(' · ');
    text.appendChild(small);
  }

  const controls = document.createElement('div');
  controls.className = 'apps-notification-row-controls';

  if(actionLabel&&typeof onAction==='function'){
    const action=document.createElement('button');
    action.type='button';
    action.className='apps-notification-setup-button';
    action.textContent=actionLabel;
    action.onclick=event=>{event.preventDefault();event.stopPropagation();onAction()};
    controls.appendChild(action);
  }

  const checkLabel=document.createElement('label');
  checkLabel.className='apps-notification-check';
  const box = document.createElement('input');
  box.type = 'checkbox';
  box.checked = !!checked;
  box.disabled = !!disabled;
  box.dataset.kind = kind;
  box.dataset.key = key;
  checkLabel.appendChild(box);
  controls.appendChild(checkLabel);

  wrapper.append(text,controls);
  return wrapper;
}

function showDeliverySetupPanel(root,channel,context={}){
  const meta=PROVIDER_SETUP[channel]||{title:channel,provider:'External provider',summary:'Provider setup is required.',secrets:[],destination:[]};
  let panel=root.querySelector('[data-delivery-setup-panel]');
  if(!panel){
    panel=document.createElement('section');
    panel.dataset.deliverySetupPanel='1';
    panel.className='apps-notification-setup-panel';
    root.appendChild(panel);
  }
  const host=context.credentialHost||'the credential-host repository/environment';
  const worker=context.workerName||'the notification backend';
  panel.innerHTML='';
  const head=document.createElement('div');
  head.className='apps-notification-setup-head';
  const title=document.createElement('div');
  title.innerHTML='<h3></h3><p class="apps-notification-help"></p>';
  title.querySelector('h3').textContent='Set up '+meta.title;
  title.querySelector('p').textContent=meta.summary;
  const close=document.createElement('button');close.type='button';close.textContent='Close';close.onclick=()=>panel.remove();
  head.append(title,close);panel.appendChild(head);

  const grid=document.createElement('div');grid.className='apps-notification-setup-grid';
  const provider=document.createElement('div');provider.innerHTML='<strong>Provider</strong><span></span>';provider.querySelector('span').textContent=meta.provider||'External provider';
  const location=document.createElement('div');location.innerHTML='<strong>Configure on</strong><span></span>';location.querySelector('span').textContent=worker+' via '+host;
  grid.append(provider,location);panel.appendChild(grid);

  if(context.providerState?.approved===false){
    const approval=document.createElement('div');
    approval.className='apps-notification-setup-section';
    const strong=document.createElement('strong');strong.textContent='Approval required';
    const p=document.createElement('p');p.className='apps-notification-help';p.textContent='This is an external third-party service and is not approved for use yet. Review the provider, data flow, pricing/cost triggers and alternatives before adding credentials or enabling it.';
    approval.append(strong,p);panel.appendChild(approval);
  }
  if((meta.publicSettings||[]).length){
    const sec=document.createElement('div');sec.className='apps-notification-setup-section';
    const h=document.createElement('strong');h.textContent='Public Firebase / browser settings';sec.appendChild(h);
    const list=document.createElement('div');list.className='apps-notification-secret-list';
    for(const name of meta.publicSettings){const code=document.createElement('code');code.textContent=name;list.appendChild(code)}
    sec.appendChild(list);panel.appendChild(sec);
  }
  if((meta.optionalPublicSettings||[]).length){
    const sec=document.createElement('div');sec.className='apps-notification-setup-section';
    const h=document.createElement('strong');h.textContent='Optional public settings';sec.appendChild(h);
    const list=document.createElement('div');list.className='apps-notification-secret-list';
    for(const name of meta.optionalPublicSettings){const code=document.createElement('code');code.textContent=name;list.appendChild(code)}
    sec.appendChild(list);panel.appendChild(sec);
  }
  if((meta.secrets||[]).length){
    const sec=document.createElement('div');sec.className='apps-notification-setup-section';
    const h=document.createElement('strong');h.textContent='Required server-side settings';sec.appendChild(h);
    const list=document.createElement('div');list.className='apps-notification-secret-list';
    for(const name of meta.secrets){const code=document.createElement('code');code.textContent=name;list.appendChild(code)}
    sec.appendChild(list);panel.appendChild(sec);
  }
  if((meta.optionalSecrets||[]).length){
    const sec=document.createElement('div');sec.className='apps-notification-setup-section';
    const h=document.createElement('strong');h.textContent='Optional server-side settings';sec.appendChild(h);
    const list=document.createElement('div');list.className='apps-notification-secret-list';
    for(const name of meta.optionalSecrets){const code=document.createElement('code');code.textContent=name;list.appendChild(code)}
    sec.appendChild(list);panel.appendChild(sec);
  }
  if((meta.destination||[]).length){
    const sec=document.createElement('div');sec.className='apps-notification-setup-section';
    const h=document.createElement('strong');h.textContent='Recipient/device setup';sec.appendChild(h);
    const ul=document.createElement('ul');for(const item of meta.destination){const li=document.createElement('li');li.textContent=item;ul.appendChild(li)}sec.appendChild(ul);panel.appendChild(sec);
  }
  if(meta.providerUrl){
    const a=document.createElement('a');a.href=meta.providerUrl;a.target='_blank';a.rel='noopener';a.className='apps-notification-setup-link';a.textContent='Open provider setup';panel.appendChild(a);
  }
  if(context.secretsUrl){
    const a=document.createElement('a');a.href=context.secretsUrl;a.target='_blank';a.rel='noopener';a.className='apps-notification-setup-link';a.textContent='Open credential-host Actions secrets';panel.appendChild(a);
  }
  if(context.afterSetup){
    const note=document.createElement('p');note.className='apps-notification-help';note.textContent=context.afterSetup;panel.appendChild(note);
  }
  if(context.guideUrl){
    const a=document.createElement('a');a.href=context.guideUrl;a.target='_blank';a.rel='noopener';a.className='apps-notification-setup-link secondary';a.textContent='Open full setup guide';panel.appendChild(a);
  }
  panel.scrollIntoView({behavior:'smooth',block:'nearest'});
}

export function createNotificationBell({ count = 0, label = 'Notifications' } = {}) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'apps-notification-bell';
  button.setAttribute('aria-label', label);

  const icon = document.createElement('span');
  icon.setAttribute('aria-hidden', 'true');
  icon.textContent = '🔔';

  const badge = document.createElement('span');
  badge.className = 'apps-notification-count';
  badge.textContent = count ? String(count) : '';

  button.append(icon, badge);
  return button;
}


export async function mountConsumerNotificationActivation(root, {
  enable,
  permission = () => (typeof Notification === 'undefined' ? 'unsupported' : Notification.permission),
  isIOS = () => /iPhone|iPad|iPod/.test(navigator.userAgent||''),
  isStandalone = () => navigator.standalone===true||window.matchMedia?.('(display-mode: standalone)')?.matches===true,
  title = 'Enable notifications',
  body = 'Get useful alerts from this app.',
  onInstallHelp,
  onNotNow,
  test,
  enabledText = 'Notifications are enabled on this device.'
} = {}) {
  if (typeof enable !== 'function') throw new Error('enable callback is required');
  const current = permission();
  const iosNeedsInstall = isIOS() && !isStandalone();
  const enabled = current === 'granted';
  root.innerHTML = '<section class="apps-notification-consumer-activation"><h3></h3><p class="apps-notification-help"></p><div class="apps-notification-consumer-actions"></div><div data-consumer-status role="status"></div></section>';
  root.querySelector('h3').textContent = enabled ? 'Notifications enabled' : (iosNeedsInstall ? 'Install this app for notifications' : title);
  root.querySelector('p').textContent = enabled ? enabledText : (iosNeedsInstall ? 'On iPhone and iPad, browser push is available from an installed Home Screen web app.' : body);
  const actions=root.querySelector('.apps-notification-consumer-actions'),status=root.querySelector('[data-consumer-status]');
  const button=(label,fn,primary=false)=>{const b=document.createElement('button');b.type='button';b.textContent=label;if(primary)b.className='primary';b.onclick=async()=>{b.disabled=true;try{const result=await fn();if(result?.message)status.textContent=result.message}catch(error){status.textContent=String(error?.message||error)}finally{b.disabled=false}};actions.appendChild(b);return b};
  if(enabled){if(typeof test==='function')button('Send test notification',test)}
  else if(iosNeedsInstall){button('How to add to Home Screen',async()=>{if(onInstallHelp)return onInstallHelp();return{message:'In Safari, use Share → Add to Home Screen, then open the installed app.'}},true)}
  else {button('Enable notifications',enable,true);if(typeof onNotNow==='function')button('Not now',onNotNow)}
  return {enabled,permission:current,iosNeedsInstall};
}

export async function mountRecipientPreferences(root, {
  client,
  scopeId = 'default',
  userId,
  role = 'member',
  eventTypes = [],
  respectReadiness = false,
  setupContext = {},
  visibleChannels = null,
  developerSetup = false
} = {}) {
  const [policy, preferences, readiness] = await Promise.all([
    client.policy(scopeId),
    client.preferences(scopeId, userId),
    respectReadiness ? client.readiness(scopeId) : Promise.resolve(null)
  ]);
  const eventIds = eventTypes.map(item => typeof item === 'string' ? item : item.id);
  const state = effectivePreferences({ policy, preferences, userId, role, eventTypes:eventIds });

  root.innerHTML = '<section class="apps-notification-preferences"><h2>My notifications</h2><p class="apps-notification-help">Choose where notifications are delivered and which events you want to receive. Options disabled by policy cannot be changed here.</p><h3>Delivery methods</h3><p class="apps-notification-help">Where should notifications be sent?</p><div data-channels></div><h3>Notification events</h3><p class="apps-notification-help">Which changes should trigger a notification?</p><div data-events></div><div data-status role="status"></div></section>';

  const channels = root.querySelector('[data-channels]');
  for (const [key, value] of Object.entries(state.channels)) {
    if(Array.isArray(visibleChannels)&&!visibleChannels.includes(key))continue;
    const providerState = key === 'in_app' ? readiness?.inApp?.status : readiness?.providers?.[key]?.status;
    const providerInfo=readiness?.providers?.[key]||{};
    const setupRequired = respectReadiness && key !== 'in_app' && providerState !== 'ready';
    const approvalRequired=providerState==='approval-required'||providerInfo.approved===false;
    const reason = value.lockedReason || (approvalRequired ? 'Third-party provider approval required before this delivery method can be used' : (setupRequired ? 'Setup required before this delivery method can be used' : ''));
    channels.appendChild(row({
      label: LABELS[key] || key,
      checked: value.enabled && !setupRequired,
      disabled: !value.allowed || key === 'in_app' || setupRequired,
      reason,
      extra: value.cost === 'metered' ? 'May incur usage charges' : '',
      key,
      kind: 'channel',
      actionLabel: developerSetup && setupRequired ? (approvalRequired?'Review provider':'Setup') : '',
      onAction: developerSetup && setupRequired ? ()=>showDeliverySetupPanel(root,key,{...setupContext,providerState:providerInfo}) : null
    }));
  }

  const events = root.querySelector('[data-events]');
  for (const item of eventTypes) {
    const key = typeof item === 'string' ? item : item.id;
    const label = typeof item === 'string' ? item : (item.label || item.id);
    const value = state.events[key];
    events.appendChild(row({
      label,
      checked: value?.enabled,
      disabled: !value?.allowed || value?.mandatory,
      reason: value?.mandatory ? 'Required by notification policy' : value?.lockedReason,
      key,
      kind: 'event'
    }));
  }

  root.addEventListener('change', async event => {
    const target = event.target;
    const next = normalisePreferences(await client.preferences(scopeId, userId));

    if (target.dataset.kind === 'channel') {
      next.channels[target.dataset.key] = target.checked;
    }
    if (target.dataset.kind === 'event') {
      next.events[target.dataset.key] = target.checked;
    }

    await client.savePreferences(scopeId, userId, next);
    root.querySelector('[data-status]').textContent = 'Preferences saved';
  });

  return { policy, preferences, effective: state };
}

export async function mountPolicyDefaults(root, {
  client,
  scopeId = 'default',
  eventTypes = []
} = {}) {
  const policy = normalisePolicy(await client.policy(scopeId));

  root.innerHTML = '<section class="apps-notification-policy"><h2>Notification permissions</h2><p class="apps-notification-help">Set the default notification permissions for everyone. You can then change them for a role or for an individual person.</p><h3>Delivery methods available by default</h3><div data-policy-channels></div><h3>Notification events available by default</h3><div data-policy-events></div><div data-status role="status"></div></section>';

  const channelRoot = root.querySelector('[data-policy-channels]');
  for (const [key, meta] of Object.entries(CHANNELS)) {
    channelRoot.appendChild(row({
      label: meta.label,
      checked: policy.allowedChannels?.[key] !== false,
      disabled: key === 'in_app',
      extra: meta.cost === 'metered' ? 'May incur usage charges' : '',
      key,
      kind: 'policy-channel'
    }));
  }

  const eventRoot = root.querySelector('[data-policy-events]');
  for (const item of eventTypes) {
    const key = typeof item === 'string' ? item : item.id;
    const label = typeof item === 'string' ? item : (item.label || item.id);
    const group = document.createElement('div');
    group.className = 'apps-notification-dual-row';
    group.innerHTML = '<div><strong></strong><small>Default for everyone</small></div><label><span>Allowed for everyone</span><input type="checkbox" data-policy-event></label><label><span>Always on</span><input type="checkbox" data-policy-required></label>';
    group.querySelector('strong').textContent = label;
    const available = group.querySelector('[data-policy-event]');
    const required = group.querySelector('[data-policy-required]');
    available.dataset.key = key;
    required.dataset.key = key;
    available.checked = policy.allowedEvents?.[key] !== false;
    required.checked = policy.mandatoryEvents?.[key] === true;
    required.disabled = !available.checked;
    eventRoot.appendChild(group);
  }

  root.addEventListener('change', async event => {
    const target = event.target;
    const key = target.dataset.key;
    if (target.dataset.kind === 'policy-channel') policy.allowedChannels[key] = target.checked;
    if (target.matches('[data-policy-event]')) {
      policy.allowedEvents[key] = target.checked;
      const required = root.querySelector('[data-policy-required][data-key="'+CSS.escape(key)+'"]');
      if (required) {
        required.disabled = !target.checked;
        if (!target.checked) {
          required.checked = false;
          policy.mandatoryEvents[key] = false;
        }
      }
    }
    if (target.matches('[data-policy-required]')) policy.mandatoryEvents[key] = target.checked;
    await client.savePolicy(scopeId, policy);
    root.querySelector('[data-status]').textContent = 'Notification policy saved';
  });

  return policy;
}

export async function mountRoleNotificationPolicy(root, {
  client,
  scopeId = 'default',
  role,
  eventTypes = []
} = {}) {
  if (!role) throw new Error('role is required');
  const policy = normalisePolicy(await client.policy(scopeId));
  policy.roleChannels[role] = policy.roleChannels[role] || {};
  policy.roleEvents[role] = policy.roleEvents[role] || {};

  root.innerHTML = '<section class="apps-notification-role-editor"><h2>Role notification permissions</h2><p class="apps-notification-help">Set different notification permissions for one role. If you do not set a special rule, this role follows the default for everyone.</p><h3>Delivery methods</h3><div data-role-channels></div><h3>Notification events</h3><div data-role-events></div><div data-status role="status"></div></section>';

  const channels = root.querySelector('[data-role-channels]');
  for (const [key, meta] of Object.entries(CHANNELS)) {
    const explicit = Object.prototype.hasOwnProperty.call(policy.roleChannels[role], key);
    const scopeDefault = policy.allowedChannels?.[key] !== false;
    channels.appendChild(row({
      label: meta.label,
      checked: explicit ? policy.roleChannels[role][key] !== false : scopeDefault,
      disabled: key === 'in_app',
      reason: explicit ? 'Role override' : 'Using the default for everyone',
      extra: meta.cost === 'metered' ? 'May incur usage charges' : '',
      key,
      kind: 'role-channel'
    }));
  }

  const events = root.querySelector('[data-role-events]');
  for (const item of eventTypes) {
    const key = typeof item === 'string' ? item : item.id;
    const label = typeof item === 'string' ? item : (item.label || item.id);
    const explicit = Object.prototype.hasOwnProperty.call(policy.roleEvents[role], key);
    const scopeDefault = policy.allowedEvents?.[key] !== false;
    events.appendChild(row({
      label,
      checked: explicit ? policy.roleEvents[role][key] !== false : scopeDefault,
      reason: explicit ? 'Role override' : 'Using the default for everyone',
      key,
      kind: 'role-event'
    }));
  }

  root.addEventListener('change', async event => {
    const target = event.target;
    const key = target.dataset.key;
    if (target.dataset.kind === 'role-channel') policy.roleChannels[role][key] = target.checked;
    if (target.dataset.kind === 'role-event') policy.roleEvents[role][key] = target.checked;
    await client.savePolicy(scopeId, policy);
    root.querySelector('[data-status]').textContent = 'Role notification policy saved';
  });

  return policy;
}

export async function mountMemberNotificationSettings(root, {
  client,
  scopeId = 'default',
  member,
  eventTypes = []
} = {}) {
  if (!member?.userId) throw new Error('member.userId is required');

  const [rawPolicy, rawPreferences] = await Promise.all([
    client.policy(scopeId),
    client.preferences(scopeId, member.userId)
  ]);
  const policy = normalisePolicy(rawPolicy);
  const preferences = normalisePreferences(rawPreferences);
  const effective = effectivePreferences({
    policy,
    preferences,
    userId: member.userId,
    role: member.role || 'member',
    eventTypes:eventTypes.map(item => typeof item === 'string' ? item : item.id)
  });

  root.innerHTML = '<section class="apps-notification-member-editor"><h2>Member notification access</h2><p class="apps-notification-help">For this person, “Allowed” means the notification option is available to them. “Currently on” means they are set to receive it now. They can change “Currently on” only when the option is allowed.</p><h3>Delivery methods</h3><div data-member-channels></div><h3>Notification events</h3><div data-member-events></div><div data-status role="status"></div></section>';

  const channels = root.querySelector('[data-member-channels]');
  for (const [key, meta] of Object.entries(CHANNELS)) {
    const current = effective.channels[key];
    const group = document.createElement('div');
    group.className = 'apps-notification-dual-row';
    group.innerHTML = '<div><strong></strong><small></small></div><label>Allowed <input type="checkbox" data-allow-channel></label><label>Currently on <input type="checkbox" data-receive-channel></label>';
    group.querySelector('strong').textContent = meta.label;
    group.querySelector('small').textContent = meta.cost === 'metered' ? 'May incur usage charges' : '';
    const allow = group.querySelector('[data-allow-channel]');
    const receive = group.querySelector('[data-receive-channel]');
    allow.dataset.key = key;
    receive.dataset.key = key;
    allow.checked = current.allowed;
    allow.disabled = key === 'in_app';
    receive.checked = current.enabled;
    receive.disabled = !current.allowed || key === 'in_app';
    channels.appendChild(group);
  }

  const events = root.querySelector('[data-member-events]');
  for (const item of eventTypes) {
    const key = typeof item === 'string' ? item : item.id;
    const label = typeof item === 'string' ? item : (item.label || item.id);
    const current = effective.events[key];
    const group = document.createElement('div');
    group.className = 'apps-notification-dual-row';
    group.innerHTML = '<div><strong></strong><small></small></div><label>Allowed <input type="checkbox" data-allow-event></label><label>Currently on <input type="checkbox" data-receive-event></label>';
    group.querySelector('strong').textContent = label;
    group.querySelector('small').textContent = current.mandatory ? 'Required by policy' : '';
    const allow = group.querySelector('[data-allow-event]');
    const receive = group.querySelector('[data-receive-event]');
    allow.dataset.key = key;
    receive.dataset.key = key;
    allow.checked = current.allowed;
    receive.checked = current.enabled;
    receive.disabled = !current.allowed || current.mandatory;
    events.appendChild(group);
  }

  root.addEventListener('change', async event => {
    const target = event.target;
    const key = target.dataset.key;
    if (!key) return;

    policy.userChannels[member.userId] = policy.userChannels[member.userId] || {};
    policy.userEvents[member.userId] = policy.userEvents[member.userId] || {};

    if (target.matches('[data-allow-channel]')) {
      policy.userChannels[member.userId][key] = target.checked;
      const receive = root.querySelector('[data-receive-channel][data-key="'+CSS.escape(key)+'"]');
      if (receive) {
        receive.disabled = !target.checked || key === 'in_app';
        if (!target.checked) receive.checked = false;
      }
      await client.savePolicy(scopeId, policy);
    }
    if (target.matches('[data-allow-event]')) {
      policy.userEvents[member.userId][key] = target.checked;
      const receive = root.querySelector('[data-receive-event][data-key="'+CSS.escape(key)+'"]');
      if (receive) {
        receive.disabled = !target.checked;
        if (!target.checked) receive.checked = false;
      }
      await client.savePolicy(scopeId, policy);
    }
    if (target.matches('[data-receive-channel]')) {
      preferences.channels[key] = target.checked;
      await client.savePreferences(scopeId, member.userId, preferences);
    }
    if (target.matches('[data-receive-event]')) {
      preferences.events[key] = target.checked;
      await client.savePreferences(scopeId, member.userId, preferences);
    }

    root.querySelector('[data-status]').textContent = 'Member notification settings saved';
  });

  return { policy, preferences, effective };
}

export const mountOwnerPolicy = mountPolicyDefaults;

export function notificationStyles() {
  return '.apps-notification-bell{position:relative;border:1px solid #d6dde5;background:#fff;border-radius:12px;padding:8px 10px;font:inherit}.apps-notification-count{position:absolute;right:-5px;top:-6px;min-width:18px;height:18px;border-radius:999px;background:#b42318;color:#fff;font-size:11px;line-height:18px}.apps-notification-help{color:#667085}.apps-notification-consumer-activation{border:1px solid #dbe6ed;background:#f8fbfd;border-radius:14px;padding:14px;margin:10px 0}.apps-notification-consumer-activation h3{margin:0 0 6px}.apps-notification-consumer-actions{display:flex;gap:8px;flex-wrap:wrap;margin-top:10px}.apps-notification-consumer-actions button{border:1px solid #ccd5db;border-radius:9px;background:#fff;padding:8px 11px;font-weight:700}.apps-notification-consumer-actions button.primary{background:#102033;color:#fff;border-color:#102033}.apps-notification-row,.apps-notification-dual-row{display:flex;gap:14px;align-items:center;justify-content:space-between;padding:13px 14px;margin:8px 0;border:1px solid #e1e7ec;border-radius:12px;background:#fff}.apps-notification-row-text{display:grid;gap:4px;min-width:0;line-height:1.35}.apps-notification-row-controls{display:flex;align-items:center;gap:10px;flex:0 0 auto}.apps-notification-check{display:grid;place-items:center;width:30px;height:30px}.apps-notification-check input{width:20px;height:20px;margin:0}.apps-notification-setup-button{padding:7px 10px;border:1px solid #ccd5db;border-radius:9px;background:#fff;font-size:12px;font-weight:700}.apps-notification-row small,.apps-notification-dual-row small{display:block;color:#667085;margin-top:3px}.apps-notification-dual-row{display:grid;grid-template-columns:minmax(190px,1fr) minmax(140px,auto) minmax(125px,auto);gap:14px;align-items:center}.apps-notification-dual-row label{display:flex;gap:9px;align-items:center;justify-content:space-between;min-height:38px;padding:6px 10px;border-left:1px solid #edf1f4;font-size:13px;white-space:nowrap}.apps-notification-dual-row input[type="checkbox"]{width:20px;height:20px;margin:0}.apps-notification-fields{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;margin:10px 0}.apps-notification-field{display:grid;gap:5px;font-size:13px}.apps-notification-field input{padding:9px 10px;border:1px solid #d6dde5;border-radius:10px}.apps-notification-inbox-item{display:flex;justify-content:space-between;gap:12px;padding:11px 12px;margin:8px 0;border:1px solid #e1e7ec;border-radius:12px;background:#fff}.apps-notification-inbox-item.unread{background:#f6fbff;border-color:#98bdd6}.apps-notification-inbox-item p{margin:4px 0;color:#667085}.apps-notification-inbox-item small{color:#667085}.apps-notification-toast{position:fixed;right:20px;top:20px;z-index:99999;display:grid;grid-template-columns:auto 1fr auto;gap:10px;align-items:start;width:min(390px,calc(100vw - 32px));padding:14px;border:1px solid #cfdde7;border-radius:15px;background:#fff;box-shadow:0 18px 55px rgba(20,45,65,.2)}.apps-notification-toast-icon{width:36px;height:36px;display:grid;place-items:center;border-radius:11px;background:#eef6fb}.apps-notification-toast p{margin:4px 0 0;color:#667085}.apps-notification-toast-close{border:0;background:transparent;color:#667085;font-size:20px;padding:0 4px}.apps-notification-setup-panel{margin:12px 0;padding:14px;border:1px solid #cbdce8;border-radius:14px;background:#f8fbfd}.apps-notification-setup-head{display:flex;justify-content:space-between;gap:12px;align-items:flex-start}.apps-notification-setup-head h3{margin:0 0 4px}.apps-notification-setup-head p{margin:0}.apps-notification-setup-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;margin:12px 0}.apps-notification-setup-grid>div{display:grid;gap:4px;padding:10px;border:1px solid #dfe7ec;border-radius:10px;background:#fff}.apps-notification-setup-section{margin:12px 0}.apps-notification-secret-list{display:flex;gap:6px;flex-wrap:wrap;margin-top:7px}.apps-notification-secret-list code{padding:5px 7px;border-radius:7px;background:#eef3f7;font-size:12px}.apps-notification-setup-link{display:inline-block;margin:5px 8px 0 0;padding:8px 10px;border-radius:9px;background:#102033;color:#fff;text-decoration:none;font-weight:700;font-size:12px}.apps-notification-setup-link.secondary{background:#fff;color:#102033;border:1px solid #ccd5db}[data-status]{min-height:20px;color:#08783e}@media(max-width:640px){.apps-notification-fields,.apps-notification-setup-grid{grid-template-columns:1fr}.apps-notification-row{align-items:flex-start}.apps-notification-row-controls{flex-direction:column-reverse;align-items:flex-end}.apps-notification-setup-button{min-width:72px}.apps-notification-dual-row{grid-template-columns:1fr}.apps-notification-dual-row label{border-left:0;border-top:1px solid #edf1f4;padding:9px 0 2px}}';
}


export async function mountDeliveryDestinations(root,{
  client,
  scopeId='default',
  userId
}={}){
  const prefs=normalisePreferences(await client.preferences(scopeId,userId));
  const d=prefs.destinations||{};
  root.innerHTML='<section class="apps-notification-destinations"><h3>Delivery details</h3><p class="apps-notification-help">These details are used only for delivery methods that are enabled and configured.</p><div class="apps-notification-fields"></div><button type="button" data-save-destinations>Save delivery details</button><div data-status role="status"></div></section>';
  const fields=root.querySelector('.apps-notification-fields');
  const defs=[
    ['email','Email address','email'],
    ['phone','Mobile number for SMS','tel'],
    ['whatsapp','WhatsApp number','tel'],
    ['telegramChatId','Telegram chat ID','text']
  ];
  for(const [key,label,type] of defs){
    const row=document.createElement('label');
    row.className='apps-notification-field';
    const span=document.createElement('span');span.textContent=label;
    const input=document.createElement('input');input.type=type;input.value=String(d[key]||'');input.dataset.destination=key;
    row.append(span,input);fields.appendChild(row);
  }
  root.querySelector('[data-save-destinations]').onclick=async()=>{
    const next=normalisePreferences(await client.preferences(scopeId,userId));
    next.destinations=next.destinations||{};
    fields.querySelectorAll('[data-destination]').forEach(input=>next.destinations[input.dataset.destination]=input.value.trim());
    await client.savePreferences(scopeId,userId,next);
    root.querySelector('[data-status]').textContent='Delivery details saved';
  };
  return prefs;
}

export async function mountNotificationInbox(root,{
  client,
  scopeId='default',
  userId,
  limit=50,
  onUnreadChange
}={}){
  async function render(){
    const items=await client.inbox(scopeId,userId,{limit});
    const unread=items.filter(x=>x.read!==true).length;
    root.innerHTML='<section class="apps-notification-inbox"><div class="apps-notification-inbox-head"><div><h3>Notification inbox</h3><p class="apps-notification-help"></p></div></div><div data-items></div></section>';
    root.querySelector('.apps-notification-help').textContent=unread?unread+' unread':'No unread notifications';
    const host=root.querySelector('[data-items]');
    if(!items.length){
      host.innerHTML='<p class="apps-notification-help">No notifications yet.</p>';
    }else{
      for(const item of items){
        const card=document.createElement('article');
        card.className='apps-notification-inbox-item'+(item.read!==true?' unread':'');
        const content=document.createElement('div');
        const title=document.createElement('strong');title.textContent=item.title||item.type||'Notification';
        const body=document.createElement('p');body.textContent=item.body||'';
        const meta=document.createElement('small');meta.textContent=new Date(item.storedAt||item.createdAt||Date.now()).toLocaleString();
        content.append(title,body,meta);
        card.appendChild(content);
        if(item.read!==true&&client.markRead){
          const button=document.createElement('button');button.type='button';button.textContent='Mark read';
          button.onclick=async()=>{await client.markRead(scopeId,userId,item.id);await render()};
          card.appendChild(button);
        }
        host.appendChild(card);
      }
    }
    onUnreadChange?.(unread,items);
    return {items,unread};
  }
  return render();
}

export function showNotificationToast({title='Notification',body='',duration=5000}={}){
  let toast=document.getElementById('appsNotificationToast');
  if(!toast){
    toast=document.createElement('div');toast.id='appsNotificationToast';toast.className='apps-notification-toast';
    const icon=document.createElement('div');icon.className='apps-notification-toast-icon';icon.textContent='🔔';
    const text=document.createElement('div');text.innerHTML='<strong></strong><p></p>';
    const close=document.createElement('button');close.type='button';close.className='apps-notification-toast-close';close.textContent='×';close.onclick=()=>toast.remove();
    toast.append(icon,text,close);document.body.appendChild(toast);
  }
  toast.querySelector('strong').textContent=title;
  toast.querySelector('p').textContent=body;
  clearTimeout(showNotificationToast.timer);
  showNotificationToast.timer=setTimeout(()=>toast.remove(),duration);
  return toast;
}
