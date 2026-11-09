// Passkey-only catalogue bridge for the private Biz app manifest.
// This handler must be called AFTER App Monitor verifies an administrator passkey session.
const OWNER = 'nirav2000';
const REPOSITORY = 'Biz';
const MANIFEST_URL = 'https://api.github.com/repos/' + OWNER + '/' + REPOSITORY + '/contents/apps-manifest.json?ref=main';
const MAX_MANIFEST_BYTES = 128 * 1024;
const privateSource = path => 'https://github.com/' + OWNER + '/' + REPOSITORY + '/tree/main/' + path;
const response = (body, status, headers) => Response.json(body, {
  status, headers: { ...headers, 'Cache-Control': 'no-store' }
});
const slug = value => /^[a-z0-9][a-z0-9-]{0,63}$/.test(String(value || ''));
const folder = value => /^[A-Za-z][A-Za-z0-9-]{0,63}$/.test(String(value || ''));
const text = (value, max) => typeof value === 'string' && value.trim() && value.length <= max;

export function validateBizManifest(manifest) {
  if (!manifest || manifest.schemaVersion !== 1 || manifest.sourceRepository !== OWNER + '/' + REPOSITORY ||
    !Array.isArray(manifest.apps) || manifest.apps.length > 100) {
    throw new Error('Invalid Biz catalogue schema');
  }
  const seen = new Set();
  const apps = manifest.apps.map(record => {
    if (!record || !slug(record.id) || seen.has(record.id) ||
      !text(record.title, 90) || !text(record.summary, 320) ||
      !/^ideas\/[a-z0-9][a-z0-9-]{0,63}$/.test(String(record.sourcePath || '')) ||
      !['private', 'development', 'published'].includes(record.status)) {
      throw new Error('Invalid Biz app entry');
    }
    seen.add(record.id);
    let liveUrl = null;
    if (record.status === 'published') {
      if (!folder(record.publicFolder)) throw new Error('Invalid public app folder');
      liveUrl = 'https://nirav2000.github.io/' + record.publicFolder + '/';
      if (record.liveUrl !== liveUrl) throw new Error('Unexpected public app URL');
    } else if (record.publicFolder !== null || record.liveUrl !== null) {
      throw new Error('Private app must not have a public URL');
    }
    return {
      id: record.id, title: record.title.trim(), summary: record.summary.trim(),
      status: record.status, sourceUrl: privateSource(record.sourcePath),
      liveUrl
    };
  });
  return apps;
}

function decodeGithubBase64(contents) {
  if (!contents || contents.type !== 'file' || contents.encoding !== 'base64' ||
    !Number.isInteger(contents.size) || contents.size > MAX_MANIFEST_BYTES ||
    typeof contents.content !== 'string' || contents.content.length > MAX_MANIFEST_BYTES * 2) {
    throw new Error('Unexpected GitHub manifest response');
  }
  const binary = atob(contents.content.replace(/\s/g, ''));
  if (binary.length > MAX_MANIFEST_BYTES) throw new Error('Manifest too large');
  return JSON.parse(new TextDecoder().decode(Uint8Array.from(binary, character => character.charCodeAt(0))));
}

export async function handleBizAppsCatalog(request, env, headers, fetcher = fetch) {
  if (request.method !== 'GET') return response({ ok: false, error: 'Method not allowed' }, 405, headers);
  const token = String(env.BIZ_CATALOG_GITHUB_TOKEN || env.REPOSITORY_PRIVACY_GITHUB_TOKEN ||
    env.NOTES_GITHUB_ISSUES_TOKEN || '').trim();
  if (!token) return response({
    ok: false, error: 'Private Biz catalogue needs a server-side read-only GitHub token with access to nirav2000/Biz.'
  }, 503, headers);
  let upstream;
  try {
    upstream = await fetcher(MANIFEST_URL, {
      method: 'GET', redirect: 'manual',
      headers: {
        Accept: 'application/vnd.github+json',
        Authorization: 'Bearer ' + token,
        'User-Agent': 'nirav2000-app-monitor-catalog',
        'X-GitHub-Api-Version': '2022-11-28'
      }
    });
    if (!upstream.ok) return response({
      ok: false, error: 'Private Biz catalogue could not be read with the configured GitHub credential.'
    }, 503, headers);
    const apps = validateBizManifest(decodeGithubBase64(await upstream.json()));
    return response({ ok: true, source: OWNER + '/' + REPOSITORY, apps, checkedAt: new Date().toISOString() }, 200, headers);
  } catch {
    // Do not return GitHub, token or private manifest payloads in errors.
    return response({ ok: false, error: 'Private Biz catalogue validation or retrieval failed.' }, 502, headers);
  }
}
