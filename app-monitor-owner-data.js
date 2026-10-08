// Firebase Owner Console: read-only data access behind the Worker's passkey guard.
export const ownerProjectIds = raw => [...new Set(String(raw || 'kk-syllabus,snag-509418').split(',').map(x => x.trim()).filter(x => /^[a-z][a-z0-9-]{4,40}$/.test(x)))].slice(0,25);

export const ownerAppMap = {
  'kk-syllabus': ['Openday', 'Shared Firebase apps'],
  'snag-509418': ['Snag']
};

export function ownerDocumentPath(value, collection) {
  const parts = String(value || '').split('/');
  if (parts.length < 1 || parts.length > 16 || (parts.length % 2 === 1) !== Boolean(collection)) return null;
  if (parts.some(part => !part || part.length > 256 || part === '.' || part === '..' || /[?#%\\]/.test(part))) return null;
  return parts.map(encodeURIComponent).join('/');
}

export const ownerPageToken = value => typeof value === 'string' && value.length <= 2048 ? value : '';

export async function ownerGoogleRequest(url, accessToken, options = {}) {
  try {
    const response = await fetch(url, {
      method: options.method || 'GET',
      headers: { Authorization: 'Bearer ' + accessToken, ...(options.body ? { 'Content-Type': 'application/json' } : {}) },
      body: options.body ? JSON.stringify(options.body) : undefined,
      redirect: 'manual'
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) return { ok: false, status: response.status, reason: String(result.error?.status || result.error?.message || 'Google API error').slice(0, 160) };
    return { ok: true, status: response.status, data: result };
  } catch (error) {
    return { ok: false, status: 0, reason: String(error?.message || 'Network error').slice(0, 160) };
  }
}

export const ownerDocSummary = doc => ({
  id: doc.name?.split('/').pop() || '',
  path: doc.name?.split('/documents/')[1] || '',
  createdAt: doc.createTime || null,
  updatedAt: doc.updateTime || null
});

export const ownerUserSummary = user => ({
  uid: user.localId || '',
  email: user.email || '',
  displayName: user.displayName || '',
  disabled: user.disabled === true,
  createdAt: user.createdAt || null,
  lastLoginAt: user.lastLoginAt || null,
  providers: (user.providerUserInfo || []).map(x => x.providerId).filter(Boolean)
});
