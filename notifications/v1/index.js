import { CHANNELS, normaliseOwnerPolicy, normalisePreferences, effectivePreferences, canRecipientChange } from './policy.js';

export const VERSION = '1.0.0';

function eventId() {
  return globalThis.crypto?.randomUUID?.() || ('evt-' + Date.now() + '-' + Math.random().toString(16).slice(2));
}

export function normaliseEvent(input = {}) {
  if (!input.type) throw new Error('Notification event type is required');
  if (!input.app) throw new Error('Notification app is required');

  return {
    version: 1,
    id: String(input.id || eventId()),
    type: String(input.type),
    app: String(input.app),
    projectId: String(input.projectId || ''),
    audience: input.audience === 'admin' ? 'admin' : 'user',
    actorId: String(input.actorId || ''),
    recipients: Array.isArray(input.recipients) ? input.recipients.map(String) : [],
    title: String(input.title || ''),
    body: String(input.body || ''),
    url: String(input.url || ''),
    priority: ['low','normal','high','urgent'].includes(input.priority) ? input.priority : 'normal',
    data: input.data && typeof input.data === 'object' ? input.data : {},
    createdAt: input.createdAt || new Date().toISOString()
  };
}

export function createNotifications({ app, transport, eventTypes = [] } = {}) {
  if (!app) throw new Error('app is required');
  if (!transport) throw new Error('transport is required');

  return {
    version: VERSION,
    app,
    channels: CHANNELS,
    eventTypes: [...eventTypes],
    emit(type, payload = {}) {
      return transport.emit(normaliseEvent({ ...payload, type, app: payload.app || app }));
    },
    policy(projectId) {
      return transport.policy(projectId);
    },
    savePolicy(projectId, policy) {
      return transport.savePolicy(projectId, normaliseOwnerPolicy(policy));
    },
    preferences(projectId, userId) {
      return transport.preferences(projectId, userId);
    },
    savePreferences(projectId, userId, preferences) {
      return transport.savePreferences(projectId, userId, normalisePreferences(preferences));
    },
    inbox(projectId, userId, options = {}) {
      return transport.inbox(projectId, userId, options);
    },
    effective({ policy, preferences, userId, role }) {
      return effectivePreferences({ policy, preferences, userId, role, eventTypes });
    }
  };
}

export {
  CHANNELS,
  normaliseOwnerPolicy,
  normalisePreferences,
  effectivePreferences,
  canRecipientChange
};

if (typeof window !== 'undefined') {
  window.AppsNotifications = {
    version: VERSION,
    create: createNotifications,
    normaliseEvent,
    channels: CHANNELS
  };
}
