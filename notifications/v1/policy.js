export const CHANNELS = Object.freeze({
  in_app:   { id:'in_app',   label:'In app',          cost:'free' },
  web_push: { id:'web_push', label:'Browser push',    cost:'free' },
  email:    { id:'email',    label:'Email',           cost:'provider' },
  telegram: { id:'telegram', label:'Telegram',        cost:'provider' },
  whatsapp: { id:'whatsapp', label:'WhatsApp',        cost:'metered' },
  signal:   { id:'signal',   label:'Signal',          cost:'provider' },
  slack:    { id:'slack',    label:'Slack',           cost:'provider' },
  discord:  { id:'discord',  label:'Discord',         cost:'provider' },
  sms:      { id:'sms',      label:'SMS',             cost:'metered' },
  ios_push: { id:'ios_push', label:'iPhone/iPad push',cost:'provider' }
});

export function normaliseOwnerPolicy(input = {}) {
  return {
    version: 1,
    ownerId: String(input.ownerId || ''),
    allowedChannels: { in_app:true, ...(input.allowedChannels || {}) },
    allowedEvents: { ...(input.allowedEvents || {}) },
    roleChannels: { ...(input.roleChannels || {}) },
    roleEvents: { ...(input.roleEvents || {}) },
    userChannels: { ...(input.userChannels || {}) },
    userEvents: { ...(input.userEvents || {}) },
    mandatoryEvents: { ...(input.mandatoryEvents || {}) },
    paidChannelApprovalRequired: input.paidChannelApprovalRequired !== false,
    updatedAt: input.updatedAt || new Date().toISOString(),
    updatedBy: String(input.updatedBy || input.ownerId || '')
  };
}

export function normalisePreferences(input = {}) {
  return {
    version: 1,
    channels: { in_app:true, ...(input.channels || {}) },
    events: { ...(input.events || {}) },
    updatedAt: input.updatedAt || new Date().toISOString(),
    updatedBy: String(input.updatedBy || '')
  };
}

function setting(map, key, fallback = true) {
  return Object.prototype.hasOwnProperty.call(map || {}, key) ? map[key] !== false : fallback;
}

function ownerPolicyValue(globalMap, roleMap, userMap, key, fallback) {
  if (userMap && Object.prototype.hasOwnProperty.call(userMap,key)) return userMap[key] !== false;
  if (roleMap && Object.prototype.hasOwnProperty.call(roleMap,key)) return roleMap[key] !== false;
  return setting(globalMap,key,fallback);
}

export function channelAllowed(policy, { userId, role, channel }) {
  const p = normaliseOwnerPolicy(policy);
  return ownerPolicyValue(
    p.allowedChannels,
    p.roleChannels?.[role],
    p.userChannels?.[userId],
    channel,
    channel === 'in_app'
  );
}

export function eventAllowed(policy, { userId, role, eventType }) {
  const p = normaliseOwnerPolicy(policy);
  return ownerPolicyValue(
    p.allowedEvents,
    p.roleEvents?.[role],
    p.userEvents?.[userId],
    eventType,
    true
  );
}

export function effectivePreferences({ policy, preferences, userId, role, eventTypes = [] }) {
  const p = normaliseOwnerPolicy(policy);
  const pref = normalisePreferences(preferences);

  const channels = {};
  for (const channel of Object.keys(CHANNELS)) {
    const allowed = channelAllowed(p,{ userId, role, channel });
    channels[channel] = {
      allowed,
      enabled: allowed && setting(pref.channels, channel, channel === 'in_app'),
      lockedReason: allowed ? '' : 'Not enabled by the app owner',
      cost: CHANNELS[channel].cost
    };
  }

  const events = {};
  for (const eventType of eventTypes) {
    const allowed = eventAllowed(p,{ userId, role, eventType });
    const mandatory = p.mandatoryEvents?.[eventType] === true;
    events[eventType] = {
      allowed,
      mandatory,
      enabled: allowed && (mandatory || setting(pref.events,eventType,true)),
      lockedReason: allowed ? '' : 'Not enabled by the app owner'
    };
  }

  return { channels, events };
}

export function canRecipientChange({ policy, userId, role, kind, key }) {
  if (kind === 'channel') return channelAllowed(policy,{userId,role,channel:key});
  if (kind === 'event') return eventAllowed(policy,{userId,role,eventType:key});
  return false;
}
