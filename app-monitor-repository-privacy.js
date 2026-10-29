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

// GitHub can rate-limit public API requests from shared Cloudflare IPs.
// Prefer an available server-side token and cache *metadata*, never credentials.
const INVENTORY_KEY = '_app-monitor/v2/security/repository-privacy/inventory-v1.json';
const INVENTORY_TTL_MS = 10 * 60 * 1000;
// Only historically public names from GitHub search, checked 2026-10-29.
// This is a degraded-mode index, NOT proof of current visibility or Pages.
const PUBLIC_BASELINE_NAMES = Object.freeze(["Claudetrials","monkeytype","bank-spark","deep-learning-with-python-notebooks","web_scraping_tutorial","Apps","bank-kafka","bulb-test","keyzen","tamagotchi","ML-GA","dawn-exuberant-aftermath","DX-Dashboard","azureml-sdk-fashion","Versioning-SubAgent","charm-mud-seahorse","TouchType","skills-github-pages","angular-course-demo-app-v2","angular-daterangepicker","NFER","MemoryMastery","techolympics","fifth-frosted-bookcase","Feesight","gdg-angular-course","simple-vimeo-downloader-extension","Py.touchTyping","TT38","Flashcard","food-delivery-app","Kk-syllabus","ripe-wealthy-chauffer","GDocsMarkdownPreview","skimmers","3dviewer","ML","Openday","todopyramid","ExportChatGPT","beyond100","snag","nirav2000.github.io","firebase-react-lesson-3","artifacts","hackathon_june_2018","google-api-php-client","tuitioning-fcl","screeching-stitch-swordfish","MentalMaths","Phonics","InClass","AIJavascript-meetup","Memory","House-preview","firebase-react-lesson-1","emoji-trainer","MentalAbacus","UI-template","Comprehension","Next","ancient-stingy-acai","skillshare-downloader","longing-statuesque-windscreen","firebase-react-lesson-2","GlobalAIBootcamp2019","SightReading","Notation","code.angularjs.org","gan_public","coursebook","BoatRace2026","Dol","tensorflow-js-instagram","halifax-share-dealing-sdk","G5","PerodicTable","japanese-learning-app","Grammar-Tree-Coach","bank-accumulo","angular.js","asyncio-example","Horn-fir-yellowhorn","s-fractions","JavaScript30","LearnLatin","ExamQuestions","MachineLearningOps","progress-bar","Deep-Learning-with-Keras","get_iplayer","amplified-rightful-middle","QuickMath","Extraordinary"]);
function publicBaseline() {
  return PUBLIC_BASELINE_NAMES.map(name => ({
    fullName: OWNER + '/' + name, name, visibility: 'public',
    visibilityVerified: false, hasPages: false, pagesVerified: false,
    archived: false, fork: false, defaultBranch: '', updatedAt: '',
    url: 'https://github.com/' + OWNER + '/' + name
  }));
}
async function readInventoryCache(env) {
  try {
    const item = await env.APP_MONITOR_DATA.get(INVENTORY_KEY);
    if (!item) return null;
    const data = JSON.parse(await item.text());
    if (data?.version !== 1 || !Number.isFinite(Date.parse(data.storedAt)) ||
        !Array.isArray(data.entries) || data.entries.length > 3000) return null;
    // The saved entry is our normalised metadata, not the original GitHub
    // object; check its shape without trusting unvalidated R2 objects.
    return data.entries.every(row => row && row.fullName === OWNER + '/' + row.name &&
      ['private', 'public'].includes(row.visibility) && typeof row.hasPages === 'boolean')
      ? { ...data, entries: data.entries } : null;
  } catch { return null; }
}
async function saveInventoryCache(env, value) {
  try {
    await env.APP_MONITOR_DATA.put(INVENTORY_KEY, JSON.stringify({
      version: 1, storedAt: value.inventoryCapturedAt,
      credentialSource: value.credentialSource,
      entries: value.entries,
      credentialStatus: value.credentialStatus,
      publicStatus: value.publicStatus
    }), { httpMetadata: { contentType: 'application/json' } });
  } catch {
    // Inventory still functions when caching fails; reviews remain separate.
  }
}
function inventorySummary(entries, credentialSource, credentialStatus, publicStatus, inventorySource, inventoryCapturedAt) {
  const privateVisible = entries.filter(repo => repo.visibility === 'private').length;
  return {
    entries, credentialSource, credentialStatus, publicStatus, inventorySource,
    inventoryCapturedAt, privateVisible,
    // No token scope proves complete repository coverage.
    coverage: privateVisible ? 'token-scoped' : 'public-only'
  };
}
async function catalog(env, fetcher, forceRefresh = false) {
  const dedicatedToken = String(env.REPOSITORY_PRIVACY_GITHUB_TOKEN || '');
  const sharedToken = String(env.NOTES_GITHUB_ISSUES_TOKEN || '');
  const token = dedicatedToken || sharedToken;
  const credentialSource = dedicatedToken ? 'dedicated' : sharedToken ? 'existing-notes' : 'none';
  const cached = await readInventoryCache(env);
  const cacheAge = cached ? Date.now() - Date.parse(cached.storedAt) : Infinity;
  if (!forceRefresh && cached && cacheAge >= 0 && cacheAge < INVENTORY_TTL_MS &&
      cached.credentialSource === credentialSource) {
    return inventorySummary(cached.entries, credentialSource, cached.credentialStatus,
      cached.publicStatus, 'cache', cached.storedAt);
  }

  let accessible = null;
  let credentialStatus = token ? 'access-unavailable' : 'not-configured';
  if (token) {
    try {
      // Personal access tokens / authenticated user installations.
      accessible = await listGithubRepositories(fetcher,
        page => 'https://api.github.com/user/repos?affiliation=owner&per_page=100&sort=updated&page=' + page, token);
    } catch {
      try {
        // GitHub App installation tokens use a distinct inventory endpoint.
        accessible = await listGithubRepositories(fetcher,
          page => 'https://api.github.com/installation/repositories?per_page=100&page=' + page, token, true);
      } catch {
        // Continue with public listings or trusted cached metadata.
      }
    }
    if (accessible) {
      credentialStatus = accessible.some(repo => repo.visibility === 'private')
        ? 'private-visible' : 'no-private-visible';
    }
  }

  let publicRepos = null;
  const publicUrl = page => 'https://api.github.com/users/' + OWNER +
    '/repos?type=owner&per_page=100&sort=updated&page=' + page;
  if (token) {
    try {
      publicRepos = await listGithubRepositories(fetcher, publicUrl, token);
    } catch {
      // Some narrowly scoped tokens are not accepted by this endpoint.
    }
  }
  if (!publicRepos) {
    try { publicRepos = await listGithubRepositories(fetcher, publicUrl); }
    catch { /* degraded GitHub public API; try accessible/cached data */ }
  }

  if (!accessible && !publicRepos) {
    if (!cached) {
      // Fail with a clearly unverified historic public snapshot rather than
      // an unhelpful 502 or a misleading zero-repositories response.
      return inventorySummary(publicBaseline(), credentialSource, credentialStatus,
        'baseline-unverified', 'baseline', new Date().toISOString());
    }
    // Cached private names are never served when there is no credential.
    const entries = token ? cached.entries : cached.entries.filter(repo => repo.visibility === 'public');
    return inventorySummary(entries, credentialSource, credentialStatus, 'cached',
      'stale-cache', cached.storedAt);
  }

  const cachedPublic = (!publicRepos && cached)
    ? cached.entries.filter(repo => repo.visibility === 'public') : [];
  const historicalPublic = !publicRepos && !cachedPublic.length ? publicBaseline() : [];
  const byName = new Map(
    [...historicalPublic, ...cachedPublic, ...(publicRepos || []), ...(accessible || [])]
      .map(repo => [repo.fullName.toLowerCase(), repo])
  );
  const publicStatus = publicRepos ? 'verified'
    : cachedPublic.length ? 'cached' : 'baseline-unverified';
  const entries = [...byName.values()];
  const now = new Date().toISOString();
  const result = inventorySummary(entries, credentialSource, credentialStatus,
    publicStatus, publicRepos ? 'live' : 'partial-cache', now);
  // A transient public API failure must not overwrite a previously complete
  // cached inventory with an incomplete subset.
  if (publicRepos) await saveInventoryCache(env, result);
  return result;
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
      const [{ entries, coverage, credentialSource, credentialStatus, privateVisible, publicStatus, inventorySource, inventoryCapturedAt }, reviews] =
        await Promise.all([catalog(env, fetcher, _url.searchParams.get('refresh') === '1'), readReviews(env)]);
      const repositories = entries.map(repo => derivePrivacyState(repo, reviews[repo.fullName]));
      return json({ ok: true, coverage, credentialSource, credentialStatus, privateVisible, publicStatus, inventorySource, inventoryCapturedAt, repositories, capturedAt: new Date().toISOString(), policy: REPOSITORY_PRIVACY_POLICY, reviewStorage: 'protected-r2' }, 200, headers);
    } catch (error) {
      return json({ ok: false, error: 'GitHub repository inventory is unavailable and has no usable cache. Please retry.', retryable: true }, 503, headers);
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
