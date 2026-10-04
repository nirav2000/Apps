import { CHANNELS, effectivePreferences, normalisePolicy, normalisePreferences } from './policy.js';

const LABELS = Object.fromEntries(Object.values(CHANNELS).map(x => [x.id, x.label]));

function row({label,checked=false,disabled=false,reason='',key,kind,extra=''}) {
  const wrapper = document.createElement('label');
  wrapper.className = 'apps-notification-row';

  const text = document.createElement('span');
  const strong = document.createElement('strong');
  strong.textContent = label;
  text.appendChild(strong);

  if (reason || extra) {
    const small = document.createElement('small');
    small.textContent = [reason,extra].filter(Boolean).join(' · ');
    text.appendChild(document.createElement('br'));
    text.appendChild(small);
  }

  const box = document.createElement('input');
  box.type = 'checkbox';
  box.checked = !!checked;
  box.disabled = !!disabled;
  box.dataset.kind = kind;
  box.dataset.key = key;

  wrapper.append(text, box);
  return wrapper;
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

export async function mountRecipientPreferences(root, {
  client,
  scopeId = 'default',
  userId,
  role = 'member',
  eventTypes = []
} = {}) {
  const [policy, preferences] = await Promise.all([
    client.policy(scopeId),
    client.preferences(scopeId, userId)
  ]);
  const state = effectivePreferences({ policy, preferences, userId, role, eventTypes });

  root.innerHTML = '<section class="apps-notification-preferences"><h2>My notifications</h2><p class="apps-notification-help">Choose where notifications are delivered and which events you want to receive. Options disabled by policy cannot be changed here.</p><h3>Delivery methods</h3><p class="apps-notification-help">Where should notifications be sent?</p><div data-channels></div><h3>Notification events</h3><p class="apps-notification-help">Which changes should trigger a notification?</p><div data-events></div><div data-status role="status"></div></section>';

  const channels = root.querySelector('[data-channels]');
  for (const [key, value] of Object.entries(state.channels)) {
    channels.appendChild(row({
      label: LABELS[key] || key,
      checked: value.enabled,
      disabled: !value.allowed || key === 'in_app',
      reason: value.lockedReason,
      extra: value.cost === 'metered' ? 'May incur usage charges' : '',
      key,
      kind: 'channel'
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

  root.innerHTML = '<section class="apps-notification-policy"><h2>Notification permissions</h2><p class="apps-notification-help">Set the default maximum permissions for people in this scope. Role and individual overrides can narrow or expand these defaults.</p><h3>Delivery methods available by default</h3><div data-policy-channels></div><h3>Notification events available by default</h3><div data-policy-events></div><div data-status role="status"></div></section>';

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
    group.innerHTML = '<div><strong></strong><small>Scope default</small></div><label>Available <input type="checkbox" data-policy-event></label><label>Required <input type="checkbox" data-policy-required></label>';
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

  root.innerHTML = '<section class="apps-notification-role-editor"><h2>Role notification permissions</h2><p class="apps-notification-help">Override the scope defaults for one app-defined role. Leave an item matching the scope default when no special role rule is needed.</p><h3>Delivery methods</h3><div data-role-channels></div><h3>Notification events</h3><div data-role-events></div><div data-status role="status"></div></section>';

  const channels = root.querySelector('[data-role-channels]');
  for (const [key, meta] of Object.entries(CHANNELS)) {
    const explicit = Object.prototype.hasOwnProperty.call(policy.roleChannels[role], key);
    const scopeDefault = policy.allowedChannels?.[key] !== false;
    channels.appendChild(row({
      label: meta.label,
      checked: explicit ? policy.roleChannels[role][key] !== false : scopeDefault,
      disabled: key === 'in_app',
      reason: explicit ? 'Role override' : 'Using scope default',
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
      reason: explicit ? 'Role override' : 'Using scope default',
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
    eventTypes
  });

  root.innerHTML = '<section class="apps-notification-member-editor"><h2>Member notification access</h2><p class="apps-notification-help">For this member, “Allow” controls the maximum permission. “Receive” controls their current preference. A member may change Receive only while Allow remains enabled.</p><h3>Delivery methods</h3><div data-member-channels></div><h3>Notification events</h3><div data-member-events></div><div data-status role="status"></div></section>';

  const channels = root.querySelector('[data-member-channels]');
  for (const [key, meta] of Object.entries(CHANNELS)) {
    const current = effective.channels[key];
    const group = document.createElement('div');
    group.className = 'apps-notification-dual-row';
    group.innerHTML = '<div><strong></strong><small></small></div><label>Allow <input type="checkbox" data-allow-channel></label><label>Receive <input type="checkbox" data-receive-channel></label>';
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
    group.innerHTML = '<div><strong></strong><small></small></div><label>Allow <input type="checkbox" data-allow-event></label><label>Receive <input type="checkbox" data-receive-event></label>';
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
  return '.apps-notification-bell{position:relative;border:1px solid #d6dde5;background:#fff;border-radius:12px;padding:8px 10px;font:inherit}.apps-notification-count{position:absolute;right:-5px;top:-6px;min-width:18px;height:18px;border-radius:999px;background:#b42318;color:#fff;font-size:11px;line-height:18px}.apps-notification-help{color:#667085}.apps-notification-row,.apps-notification-dual-row{display:flex;gap:12px;align-items:flex-start;justify-content:space-between;padding:11px 12px;margin:8px 0;border:1px solid #e1e7ec;border-radius:12px;background:#fff}.apps-notification-row small,.apps-notification-dual-row small{display:block;color:#667085;margin-top:3px}.apps-notification-dual-row{display:grid;grid-template-columns:minmax(0,1fr) auto auto}.apps-notification-dual-row label{display:flex;gap:6px;align-items:center;font-size:13px}[data-status]{min-height:20px;color:#08783e}';
}
