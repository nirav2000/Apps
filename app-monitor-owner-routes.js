import { ownerProjectIds, ownerDocumentPath, ownerPageToken, ownerGoogleRequest, ownerDocSummary, ownerUserSummary, ownerAppMap } from './app-monitor-owner-data.js';

const response = (body, headers, status = 200) => Response.json(body, { status, headers: { ...headers, 'Cache-Control': 'no-store' } });
const database = project => 'https://firestore.googleapis.com/v1/projects/' + project + '/databases/(default)/documents';
const identity = project => 'https://identitytoolkit.googleapis.com/v1/projects/' + project + '/accounts:batchGet';

export async function ownerDataRoute(request, env, headers, url, getAccessToken) {
  if (request.method !== 'GET') return response({ error: 'Method not allowed' }, headers, 405);
  if (!env.FIREBASE_ADMIN_SERVICE_ACCOUNT_JSON) return response({ error: 'Firebase credentials not configured' }, headers, 503);
  const allowed = ownerProjectIds(env.FIREBASE_OWNER_PROJECT_IDS);
  const project = url.searchParams.get('project') || '';
  const action = url.pathname.split('/').pop();
  if (action !== 'dashboard' && !allowed.includes(project)) return response({ error: 'Project not available' }, headers, 400);
  let token;
  try { token = await getAccessToken(env); } catch { return response({ error: 'Google authentication failed' }, headers, 502); }
  const get = (endpoint, options) => ownerGoogleRequest(endpoint, token, options);
  if (action === 'dashboard') {
    const projects = await Promise.all(allowed.map(async id => {
      const [collections, users] = await Promise.all([
        get(database(id) + ':listCollectionIds', { method: 'POST', body: { pageSize: 100 } }),
        get(identity(id) + '?maxResults=25')
      ]);
      return { projectId: id, apps: ownerAppMap[id] || [], shared: id === 'kk-syllabus',
        firestore: { ok: collections.ok, status: collections.status, error: collections.reason || null, collections: collections.data?.collectionIds || [], hasMore: !!collections.data?.nextPageToken },
        authentication: { ok: users.ok, status: users.status, error: users.reason || null, users: (users.data?.users || []).map(ownerUserSummary), hasMore: !!users.data?.nextPageToken },
        sampleOnly: true };
    }));
    return response({ ok: true, projects, readOnly: true, checkedAt: new Date().toISOString() }, headers);
  }
  if (action === 'users') {
    const endpoint = new URL(identity(project));
    endpoint.searchParams.set('maxResults', '100');
    const cursor = ownerPageToken(url.searchParams.get('pageToken'));
    if (cursor) endpoint.searchParams.set('nextPageToken', cursor);
    const r = await get(endpoint.toString());
    return response(r.ok ? { ok: true, users: (r.data.users || []).map(ownerUserSummary), nextPageToken: r.data.nextPageToken || null } : { ok: false, error: r.reason, upstreamStatus: r.status }, headers, r.ok ? 200 : 502);
  }
  if (action === 'collections') {
    const parent = url.searchParams.get('document') || '';
    const path = parent ? ownerDocumentPath(parent, false) : '';
    if (parent && !path) return response({ error: 'Invalid document path' }, headers, 400);
    const cursor = ownerPageToken(url.searchParams.get('pageToken'));
    const r = await get(database(project) + (path ? '/' + path : '') + ':listCollectionIds', { method: 'POST', body: { pageSize: 100, ...(cursor ? { pageToken: cursor } : {}) } });
    return response(r.ok ? { ok: true, collections: r.data.collectionIds || [], nextPageToken: r.data.nextPageToken || null } : { ok: false, error: r.reason, upstreamStatus: r.status }, headers, r.ok ? 200 : 502);
  }
  if (action === 'documents') {
    const path = ownerDocumentPath(url.searchParams.get('collection'), true);
    if (!path) return response({ error: 'Invalid collection path' }, headers, 400);
    const endpoint = new URL(database(project) + '/' + path);
    endpoint.searchParams.set('pageSize', '50');
    const cursor = ownerPageToken(url.searchParams.get('pageToken'));
    if (cursor) endpoint.searchParams.set('pageToken', cursor);
    const r = await get(endpoint.toString());
    return response(r.ok ? { ok: true, documents: (r.data.documents || []).map(ownerDocSummary), nextPageToken: r.data.nextPageToken || null } : { ok: false, error: r.reason, upstreamStatus: r.status }, headers, r.ok ? 200 : 502);
  }
  return response({ error: 'Not found' }, headers, 404);
}
