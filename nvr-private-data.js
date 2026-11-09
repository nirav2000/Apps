// NVR private-data gateway. Only callable AFTER the App Monitor Worker verifies
// an active administrator session created by a WebAuthn passkey.
const ROOT = '_app-monitor/v2/private/nvr/';
const REPO = 'nirav2000/Biz';
const DATA_DIR = 'ideas/nvr/data/';
const CACHE_MS = 15 * 60 * 1000;
const MAX_FILE_SIZE = 3 * 1024 * 1024;
const MAX_NOTES_SIZE = 240 * 1024;
const assetName = name => /^asset-[0-9]{4}\.(svg|png|jpe?g|webp|gif|bin)$/.test(String(name || ''));
const safeHeaders = headers => ({
  ...headers, 'Cache-Control': 'private, no-store, max-age=0',
  'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer'
});
const json = (value, status, headers) =>
  Response.json(value, { status, headers: safeHeaders(headers) });
const readToken = env => String(env.BIZ_CATALOG_GITHUB_TOKEN ||
  env.REPOSITORY_PRIVACY_GITHUB_TOKEN || env.NOTES_GITHUB_ISSUES_TOKEN || '').trim();
const urlFor = path => 'https://api.github.com/repos/' + REPO + '/contents/' +
  DATA_DIR + path + '?ref=main';

export function checkNvrAssetName(name) { return assetName(name); }

function decodeFile(payload, maxSize = MAX_FILE_SIZE) {
  if (!payload || payload.type !== 'file' || payload.encoding !== 'base64' ||
    typeof payload.content !== 'string' || !Number.isInteger(payload.size) ||
    payload.size < 0 || payload.size > maxSize ||
    payload.content.length > Math.ceil(maxSize * 4 / 3) + 100000) {
    throw new Error('Invalid private file response');
  }
  const encoded = payload.content.replace(/\s/g, '');
  const binary = atob(encoded);
  if (binary.length > maxSize) throw new Error('Private file size exceeds limit');
  return Uint8Array.from(binary, c => c.charCodeAt(0));
}

async function githubRead(path, token, fetcher) {
  if (!token) throw new Error('Private repository read credential missing');
  const response = await fetcher(urlFor(path), {
    method: 'GET', redirect: 'manual',
    headers: {
      'Accept': 'application/vnd.github+json',
      'Authorization': 'Bearer ' + token,
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'apps-nvr-private-reader'
    }
  });
  if (!response.ok) throw new Error('Private repository source unavailable');
  return decodeFile(await response.json());
}
const parseJsonBytes = bytes => JSON.parse(new TextDecoder().decode(bytes));
function validateData(activities, assets) {
  if (!Array.isArray(activities) || activities.length > 1000 ||
    !activities.every(a => a && typeof a.title === 'string' && a.title.length < 250 &&
      Array.isArray(a.questions) && a.questions.length < 400)) throw new Error('Invalid NVR activity dataset');
  if (!assets || typeof assets !== 'object' || Array.isArray(assets) ||
    Object.keys(assets).length > 2000 ||
    !Object.values(assets).every(path => typeof path === 'string' &&
      path.startsWith('assets/') && assetName(path.slice(7)))) throw new Error('Invalid NVR asset mapping');
}
const DATA_CACHE = ROOT + 'dataset-v1.json';
const NOTES_KEY = ROOT + 'parent-notes-v1.json';

async function getCachedDataset(env) {
  try {
    const obj = await env.APP_MONITOR_DATA.get(DATA_CACHE);
    if (!obj) return null;
    const data = JSON.parse(await obj.text());
    if (!data || !Array.isArray(data.activities) || !data.assets ||
      !Number.isFinite(Date.parse(data.checkedAt))) return null;
    return data;
  } catch { return null; }
}

export async function handleNvrDataRoute(request, env, headers, url = new URL(request.url), fetcher = fetch) {
  const path = url.pathname.replace(/^\/app-monitor\/nvr\/?/, '');
  const token = readToken(env);
  const action = path.split('/')[0];
  if (action === 'activities' && path === 'activities') {
    if (request.method !== 'GET') return json({error:'Method not allowed'}, 405, headers);
    const cached = await getCachedDataset(env);
    if (cached && url.searchParams.get('refresh') !== '1' &&
      Date.now() - Date.parse(cached.checkedAt) < CACHE_MS) {
      return json({ok:true,...cached,source:'private-cache'}, 200, headers);
    }
    if (!token) {
      if (cached) return json({ok:true,...cached,source:'private-cache-stale'}, 200, headers);
      return json({ok:false,code:'configuration-required',error:
        'Private NVR data is not connected. Configure BIZ_CATALOG_GITHUB_TOKEN with read-only access to the private Biz repository.'},503,headers);
    }
    try {
      const [activitiesBytes, assetsBytes] = await Promise.all([
        githubRead('activities.json', token, fetcher), githubRead('assets.json', token, fetcher)
      ]);
      const activities = parseJsonBytes(activitiesBytes), assets = parseJsonBytes(assetsBytes);
      validateData(activities, assets);
      const data = {activities,assets,checkedAt:new Date().toISOString()};
      await env.APP_MONITOR_DATA.put(DATA_CACHE, JSON.stringify(data),
        {httpMetadata:{contentType:'application/json'}});
      return json({ok:true,...data,source:'private-Biz'},200,headers);
    } catch {
      if (cached) return json({ok:true,...cached,source:'private-cache-stale'},200,headers);
      return json({ok:false,code:'source-unavailable',error:
        'Unable to read the private NVR dataset. Check the GitHub Worker secret and its access to Biz.'},503,headers);
    }
  }
  if (action === 'assets' && path.startsWith('assets/')) {
    if (request.method !== 'GET') return json({error:'Method not allowed'},405,headers);
    const name = path.slice('assets/'.length);
    if (!assetName(name)) return json({error:'Asset not found'},404,headers);
    const key = ROOT + 'assets/' + name;
    let bytes = null;
    try {
      const cached = await env.APP_MONITOR_DATA.get(key);
      if (cached) bytes = new Uint8Array(await cached.arrayBuffer());
    } catch { /* Source fallback. */ }
    if (!bytes) {
      if (!token) return json({ok:false,code:'configuration-required',error:'Private image access is not configured.'},503,headers);
      try {
        bytes = await githubRead('assets/' + name,token,fetcher);
        await env.APP_MONITOR_DATA.put(key, bytes);
      } catch { return json({error:'Private image is unavailable.'},404,headers); }
    }
    const type = detectImageType(name, bytes);
    if (!type) return json({error:'Unsupported image format.'},415,headers);
    return new Response(bytes, {status:200,headers:{
      ...safeHeaders(headers), 'Content-Type':type,
      'Content-Security-Policy': "default-src 'none'; sandbox; style-src 'unsafe-inline'"
    }});
  }
  if (action === 'notes' && path === 'notes') {
    if (request.method === 'GET') {
      let notes = {};
      try { const item = await env.APP_MONITOR_DATA.get(NOTES_KEY); if (item) {
        const saved = JSON.parse(await item.text());
        if (saved && saved.version === 1 && saved.notes && typeof saved.notes === 'object') notes = saved.notes;
      }} catch { return json({error:'Private notes are temporarily unavailable.'},503,headers); }
      return json({ok:true,notes},200,headers);
    }
    if (request.method === 'PUT') {
      const length = Number(request.headers.get('Content-Length') || '0');
      if (length > MAX_NOTES_SIZE) return json({error:'Notes exceed storage limit.'},413,headers);
      let data;
      try {
        const raw = await request.text();
        if (raw.length > MAX_NOTES_SIZE) return json({error:'Notes exceed storage limit.'},413,headers);
        data = JSON.parse(raw);
      } catch { return json({error:'Invalid notes JSON.'},400,headers); }
      const validated = validateNvrNotes(data?.notes);
      if (!validated) return json({error:'Invalid notes format.'},400,headers);
      const updatedAt = new Date().toISOString();
      try { await env.APP_MONITOR_DATA.put(NOTES_KEY,JSON.stringify({version:1,notes:validated,updatedAt}),
        {httpMetadata:{contentType:'application/json'}}); }
      catch { return json({error:'Private note save failed.'},503,headers); }
      return json({ok:true,updatedAt},200,headers);
    }
    return json({error:'Method not allowed'},405,headers);
  }
  return json({error:'Not found'},404,headers);
}

function detectImageType(name, bytes) {
  const b = bytes;
  if (name.endsWith('.svg')) {
    const start = new TextDecoder().decode(b.slice(0,1500));
    // Reject script-bearing and XML entity-based SVG documents before creating image Blob URLs.
    const full = new TextDecoder().decode(b);
    if (!/<svg\b/i.test(start) ||
      /<\s*(script|foreignObject|iframe|object|embed)\b|<!\s*(DOCTYPE|ENTITY)|\bon\w+\s*=|javascript\s*:/i.test(full))
      return null;
    return 'image/svg+xml';
  }
  if (b.length >= 8 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return 'image/png';
  if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'image/jpeg';
  if (b.length >= 6 && new TextDecoder().decode(b.slice(0,3)) === 'GIF') return 'image/gif';
  if (b.length >= 12 && new TextDecoder().decode(b.slice(0,4)) === 'RIFF' &&
    new TextDecoder().decode(b.slice(8,12)) === 'WEBP') return 'image/webp';
  return null;
}

export function validateNvrNotes(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value) ||
    Object.keys(value).length > 1500) return null;
  const result = Object.create(null);
  for (const [id, note] of Object.entries(value)) {
    if (!id || id.length > 300 || /[\u0000-\u001f]/.test(id) ||
      !note || typeof note !== 'object' || Array.isArray(note) ||
      typeof note.bookmarked !== 'boolean' ||
      typeof note.text !== 'string' || note.text.length > 5000) return null;
    result[id] = {bookmarked:note.bookmarked,text:note.text};
  }
  return result;
}
