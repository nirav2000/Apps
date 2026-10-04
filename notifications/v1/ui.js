import { CHANNELS, effectivePreferences } from './policy.js';

const LABELS = Object.fromEntries(Object.values(CHANNELS).map(x => [x.id, x.label]));

function row(label, checked, disabled, reason, key, kind) {
  const wrapper = document.createElement('label');
  wrapper.className = 'apps-notification-row';

  const box = document.createElement('input');
  box.type = 'checkbox';
  box.checked = !!checked;
  box.disabled = !!disabled;
  box.dataset.kind = kind;
  box.dataset.key = key;

  const text = document.createElement('span');
  const strong = document.createElement('strong');
  strong.textContent = label;
  text.appendChild(strong);

  if (reason) {
    const small = document.createElement('small');
    small.textContent = reason;
    text.appendChild(document.createElement('br'));
    text.appendChild(small);
  }

  wrapper.append(box, text);
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
  projectId,
  userId,
  role,
  eventTypes = []
} = {}) {
  const [policy, preferences] = await Promise.all([
    client.policy(projectId),
    client.preferences(projectId, userId)
  ]);

  let state = effectivePreferences({ policy, preferences, userId, role, eventTypes });

  root.innerHTML = '<section class="apps-notification-preferences"><h2>Notifications</h2><p>Choose how you want to hear about changes.</p><div data-channels></div><h3>What to notify me about</h3><div data-events></div><div data-status role="status"></div></section>';

  const channels = root.querySelector('[data-channels]');
  for (const [key, value] of Object.entries(state.channels)) {
    channels.appendChild(row(
      LABELS[key] || key,
      value.enabled,
      !value.allowed,
      value.lockedReason,
      key,
      'channel'
    ));
  }

  const events = root.querySelector('[data-events]');
  for (const item of eventTypes) {
    const key = typeof item === 'string' ? item : item.id;
    const label = typeof item === 'string' ? item : (item.label || item.id);
    const value = state.events[key];
    events.appendChild(row(
      label,
      value?.enabled,
      !value?.allowed || value?.mandatory,
      value?.mandatory ? 'Required by the app owner' : value?.lockedReason,
      key,
      'event'
    ));
  }

  root.addEventListener('change', async event => {
    const target = event.target;
    const preferences = await client.preferences(projectId, userId);

    if (target.dataset.kind === 'channel') {
      preferences.channels = preferences.channels || {};
      preferences.channels[target.dataset.key] = target.checked;
    }
    if (target.dataset.kind === 'event') {
      preferences.events = preferences.events || {};
      preferences.events[target.dataset.key] = target.checked;
    }

    await client.savePreferences(projectId, userId, preferences);
    root.querySelector('[data-status]').textContent = 'Saved';
  });

  return { policy, preferences, effective: state };
}

export async function mountOwnerPolicy(root, {
  client,
  projectId,
  members = [],
  eventTypes = []
} = {}) {
  const policy = await client.policy(projectId);

  root.innerHTML = '<section class="apps-notification-owner"><h2>Notification access</h2><p>Choose which notifications and channels people on this app may use.</p><div data-owner-channels></div><div data-members></div><div data-status role="status"></div></section>';

  const channelRoot = root.querySelector('[data-owner-channels]');
  for (const [key, meta] of Object.entries(CHANNELS)) {
    const costText = meta.cost === 'metered' ? 'May incur usage charges' : '';
    channelRoot.appendChild(row(
      meta.label,
      policy.allowedChannels?.[key] !== false,
      key === 'in_app',
      costText,
      key,
      'owner-channel'
    ));
  }

  const membersRoot = root.querySelector('[data-members]');
  for (const member of members) {
    const section = document.createElement('section');
    section.className = 'apps-notification-member';
    const heading = document.createElement('h3');
    heading.textContent = member.name || member.userId || 'User';
    section.appendChild(heading);

    for (const item of eventTypes) {
      const key = typeof item === 'string' ? item : item.id;
      const label = typeof item === 'string' ? item : (item.label || item.id);
      const enabled = policy.userEvents?.[member.userId]?.[key] !== false;
      const control = row(label, enabled, false, '', key, 'member-event');
      control.querySelector('input').dataset.userId = member.userId;
      section.appendChild(control);
    }

    membersRoot.appendChild(section);
  }

  root.addEventListener('change', async event => {
    const target = event.target;
    if (target.dataset.kind === 'owner-channel') {
      policy.allowedChannels = policy.allowedChannels || {};
      policy.allowedChannels[target.dataset.key] = target.checked;
    }
    if (target.dataset.kind === 'member-event') {
      policy.userEvents = policy.userEvents || {};
      policy.userEvents[target.dataset.userId] = policy.userEvents[target.dataset.userId] || {};
      policy.userEvents[target.dataset.userId][target.dataset.key] = target.checked;
    }

    await client.savePolicy(projectId, policy);
    root.querySelector('[data-status]').textContent = 'Saved';
  });

  return policy;
}

export function notificationStyles() {
  return '.apps-notification-bell{position:relative;border:1px solid #d6dde5;background:#fff;border-radius:12px;padding:8px 10px;font:inherit}.apps-notification-count{position:absolute;right:-5px;top:-6px;min-width:18px;height:18px;border-radius:999px;background:#b42318;color:#fff;font-size:11px;line-height:18px}.apps-notification-row{display:flex;gap:10px;align-items:flex-start;padding:11px 12px;margin:8px 0;border:1px solid #e1e7ec;border-radius:12px;background:#fff}.apps-notification-row small{color:#667085}.apps-notification-member{padding:12px;border:1px solid #e1e7ec;border-radius:14px;margin:10px 0}[data-status]{min-height:20px;color:#08783e}';
}
