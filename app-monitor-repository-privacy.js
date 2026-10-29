// Repository privacy register: backend-only inventory and private R2 review state.
// This module MUST be called only after App Monitor's authenticated passkey check.
export const REPOSITORY_PRIVACY_POLICY = Object.freeze({
  newRepositoryVisibility: 'private',
  publishing: 'approved-built-assets-only',
  existingVisibilityChanges: 'explicit-approval-required'
});

const KEY = '_app-monitor/v2/security/repository-privacy/register-v1.json';
const OWNER = 'nirav2000';
const choices = Object.freeze({
  exposureRisk: ['unassessed', 'low', 'medium', 'high', 'critical'],
  pagesPlan: ['unreviewed', 'migration-needed', 'not-needed', 'resolved'],
  sharedLibraries: ['unreviewed', 'consumer', 'provider', 'both', 'none'],
  secretsAudit: ['not-started', 'in-progress', 'passed', 'findings'],
  migrationReadiness: ['not-reviewed', 'blocked', 'in-progress', 'ready', 'complete', 'deferred']
});
const defaults = Object.freeze({
  exposureRisk: 'unassessed',
  pagesPlan: 'unreviewed',
  sharedLibraries: 'unreviewed',
  secretsAudit: 'not-started',
  migrationReadiness: 'not-reviewed',
  pagesDependencies: '',
  sharedLibraryDetails: '',
  notes: ''
});
const repoName = value => /^nirav2000\/[A-Za-z0-9._-]{1,100}$/.test(String(value || ''));
const json = (value, status, headers) => Response.json(value, { status, headers });

export function validatePrivacyPatch(payload) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return null;
  if (Object.keys(payload).some(key => !Object.hasOwn(defaults, key))) return null;
  const cleaned = {};
  for (const [field, values] of Object.entries(choices)) {
    if (!Object.hasOwn(payload, field)) continue;
    if (typeof payload[field] !== 'string' || !values.includes(payload[field])) return null;
    cleaned[field] = payload[field];
  }
  for (const [field, maxLength] of Object.entries({ pagesDependencies: 1000, sharedLibraryDetails: 1000, notes: 2400 })) {
    if (!Object.hasOwn(payload, field)) continue;
    if (typeof payload[field] !== 'string' || payload[field].length > maxLength) return null;
    cleaned[field] = payload[field].trim();
  }
  return Object.keys(cleaned).length ? cleaned : null;
}
export function publicRepoMetadata(repo) {
  const name = String(repo?.name || '');
  const owner = String(repo?.owner?.login || '');
  if (owner.toLowerCase() !== OWNER || !/^[A-Za-z0-9._-]{1,100}$/.test(name)) return null;
  const visibility = repo.private === true ? 'private' : repo.visibility === 'private' ? 'private' : 'public';
  return {
    fullName: OWNER + '/' + name,
    name,
    visibility,
    hasPages: repo.has_pages === true,
    archived: repo.archived === true,
    fork: repo.fork === true,
    defaultBranch: String(repo.default_branch || ''),
    updatedAt: String(repo.updated_at || ''),
    url: 'https://github.com/' + OWNER + '/' + name
  };
}
export function derivePrivacyState(repo, review) {
  const saved = { ...defaults, ...(review || {}) };
  const pages = repo.hasPages ? 'enabled' : 'not-detected';
  let nextStep = 'Review repository';
  if (saved.migrationReadiness === 'deferred') nextStep = 'Retain public: review later';
  else if (saved.exposureRisk === 'critical' || saved.exposureRisk === 'high' || saved.secretsAudit === 'findings') nextStep = 'Resolve security findings';
  else if (repo.visibility === 'private') nextStep = 'Already private';
  else if (repo.hasPages && saved.pagesPlan !== 'resolved') nextStep = 'Migrate Pages first';
  else if (saved.secretsAudit !== 'passed') nextStep = 'Run secrets audit';
  else if (saved.sharedLibraries === 'unreviewed') nextStep = 'Check shared dependencies';
  else if (saved.migrationReadiness !== 'ready' && saved.migrationReadiness !== 'complete') nextStep = 'Review migration readiness';
  else nextStep = 'Eligible for approval';
  return { ...repo, ...saved, pages, nextStep, reviewedAt: String(review?.reviewedAt || '') };
}
// Listing public repositories separately prevents a GitHub token limited to a
// single public repo from hiding the rest of the owner's public inventory.
async function listGithubRepositories(fetcher, urlForPage, token = '', installation = false) {
  const entries = [];
  for (let page = 1; page <= 10; page++) {
    const response = await fetcher(urlForPage(page), {
      headers: {
        'Accept': 'application/vnd.github+json',
        'User-Agent': 'apps-monitor-repository-privacy',
        ...(token ? { 'Authorization': 'Bearer ' + token } : {})
      },
      redirect: 'manual'
    });
    if (!response.ok) throw Error('GitHub repository inventory request failed (' + response.status + ')');
    const data = await response.json();
    const rows = installation ? data?.repositories : data;
    if (!Array.isArray(rows)) throw Error('GitHub repository inventory response was invalid');
    for (const repo of rows) {
      const metadata = publicRepoMetadata(repo);
      if (metadata) entries.push(metadata);
    }
    if (rows.length < 100) return entries;
  }
  throw Error('GitHub repository pagination limit reached; inventory incomplete');
}

async function catalog(env, fetcher) {
  // Reuse the existing Notes GitHub secret ONLY when no narrower, dedicated
  // read-only inventory secret has been configured. Neither credential is
  // returned to the browser or written to R2.
  const dedicatedToken = String(env.REPOSITORY_PRIVACY_GITHUB_TOKEN || '');
  const sharedToken = String(env.NOTES_GITHUB_ISSUES_TOKEN || '');
  const token = dedicatedToken || sharedToken;
  const credentialSource = dedicatedToken ? 'dedicated' : sharedToken ? 'existing-notes' : 'none';

  const publicRepos = await listGithubRepositories(
    fetcher,
    page => 'https://api.github.com/users/' + OWNER + '/repos?type=owner&per_page=100&sort=updated&page=' + page
  );
  const byName = new Map(publicRepos.map(repo => [repo.fullName.toLowerCase(), repo]));
  let credentialStatus = token ? 'access-unavailable' : 'not-configured';

  if (token) {
    let accessible = null;
    try {
      // Works with user-bound classic and fine-grained PATs.
      accessible = await listGithubRepositories(
        fetcher,
        page => 'https://api.github.com/user/repos?affiliation=owner&per_page=100&sort=updated&page=' + page,
        token
      );
    } catch {
      try {
        // GitHub App installation tokens use a different inventory endpoint.
        accessible = await listGithubRepositories(
          fetcher,
          page => 'https://api.github.com/installation/repositories?per_page=100&page=' + page,
          token,
          true
        );
      } catch {
        // Keep the public list visible. Do not infer private access from a
        // configured credential or expose authentication error details.
      }
    }
    if (accessible) {
      for (const repo of accessible) byName.set(repo.fullName.toLowerCase(), repo);
      credentialStatus = accessible.some(repo => repo.visibility === 'private')
        ? 'private-visible'
        : 'no-private-visible';
    }
  }

  const entries = [...byName.values()];
  const privateVisible = entries.filter(repo => repo.visibility === 'private').length;
  return {
    entries,
    // A token can be valid yet restricted to some repositories. Never call
    // its scope complete unless the owner independently verifies it.
    coverage: privateVisible > 0 ? 'token-scoped' : 'public-only',
    credentialSource,
    credentialStatus,
    privateVisible
  };
}
async function readReviews(env) {
  const object = await env.APP_MONITOR_DATA.get(KEY);
  if (!object) return {};
  try {
    const value = JSON.parse(await object.text());
    return value?.version === 1 && value.reviews && typeof value.reviews === 'object' && !Array.isArray(value.reviews) ? value.reviews : {};
  } catch { return {}; }
}
export async function handleRepositoryPrivacyRoute(request, env, headers, _url, fetcher = fetch) {
  if (request.method === 'GET') {
    try {
      const [{ entries, coverage, credentialSource, credentialStatus, privateVisible }, reviews] = await Promise.all([catalog(env, fetcher), readReviews(env)]);
      const repositories = entries.map(repo => derivePrivacyState(repo, reviews[repo.fullName]));
      return json({ ok: true, coverage, credentialSource, credentialStatus, privateVisible, repositories, capturedAt: new Date().toISOString(), policy: REPOSITORY_PRIVACY_POLICY, reviewStorage: 'protected-r2' }, 200, headers);
    } catch (error) {
      return json({ ok: false, error: String(error?.message || 'Inventory unavailable').slice(0, 130) }, 502, headers);
    }
  }
  if (request.method === 'POST') {
    const size = Number(request.headers.get('Content-Length') || 0);
    if (size > 8 * 1024) return json({ error: 'Payload too large' }, 413, headers);
    let body;
    try { body = await request.json(); } catch { return json({ error: 'Invalid JSON' }, 400, headers); }
    if (!repoName(body?.repository)) return json({ error: 'Invalid repository' }, 400, headers);
    const patch = validatePrivacyPatch(body?.patch);
    if (!patch) return json({ error: 'Invalid review fields' }, 400, headers);
    const reviews = await readReviews(env);
    const previous = reviews[body.repository] || {};
    const updated = {
      ...defaults, ...previous, ...patch,
      reviewedAt: new Date().toISOString()
    };
    reviews[body.repository] = updated;
    await env.APP_MONITOR_DATA.put(KEY, JSON.stringify({ version: 1, reviews }), { httpMetadata: { contentType: 'application/json' } });
    return json({ ok: true, repository: body.repository, review: updated }, 200, headers);
  }
  return json({ error: 'Method not allowed' }, 405, headers);
}
