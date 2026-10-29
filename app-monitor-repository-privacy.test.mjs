import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  REPOSITORY_PRIVACY_POLICY, validatePrivacyPatch, publicRepoMetadata,
  derivePrivacyState, handleRepositoryPrivacyRoute
} from './app-monitor-repository-privacy.js';

const publicRepo = { name: 'Apps', owner: { login: 'nirav2000' }, visibility: 'public', private: false, has_pages: true, default_branch: 'main' };
const privateRepo = { name: 'Biz', owner: { login: 'nirav2000' }, visibility: 'private', private: true, has_pages: false, default_branch: 'main' };
function harness(mode = 'none') {
  const store = new Map();
  const requests = [];
  const env = {
    APP_MONITOR_DATA: {
      get: async key => store.has(key) ? { text: async () => store.get(key) } : null,
      put: async (key, body) => { store.set(key, body); }
    },
    ...(mode === 'dedicated' ? { REPOSITORY_PRIVACY_GITHUB_TOKEN: 'test-dedicated-token' } : {}),
    ...(['notes', 'installation', 'restricted', 'invalid', 'public-rate-limited', 'all-rate-limited'].includes(mode)
      ? { NOTES_GITHUB_ISSUES_TOKEN: 'test-existing-notes-token' } : {})
  };
  async function mockFetch(url, init) {
    requests.push({ url, headers: init.headers });
    const authorised = Boolean(init.headers.Authorization);
    let data, status = 200;
    if (url.includes('/users/nirav2000/repos')) {
      if (mode === 'public-rate-limited' || mode === 'all-rate-limited') {
        data = { message: 'GitHub API rate limit exceeded' }; status = 403;
      } else data = [publicRepo];
    } else if (url.includes('/user/repos')) {
      assert.equal(authorised, true, 'private repository API requires a token');
      if (mode === 'installation' || mode === 'invalid' || mode === 'all-rate-limited') {
        data = { message: 'not supported' }; status = 401;
      } else {
        data = mode === 'restricted' ? [publicRepo] : [publicRepo, privateRepo];
      }
    } else if (url.includes('/installation/repositories')) {
      assert.equal(authorised, true);
      if (mode === 'installation') data = { repositories: [publicRepo, privateRepo], total_count: 2 };
      else { data = { message: 'not supported' }; status = 403; }
    } else {
      throw Error('Unexpected GitHub inventory URL ' + url);
    }
    return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });
  }
  const route = (request) => handleRepositoryPrivacyRoute(
    request, env, { 'Cache-Control': 'no-store' }, new URL(request.url), mockFetch
  );
  const get = (refresh = false) => route(new Request('https://example.com/app-monitor/repository-privacy' + (refresh ? '?refresh=1' : '')));
  const post = (body) => route(new Request('https://example.com/app-monitor/repository-privacy', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body)
  }));
  return { store, requests, get, post, route };
}
test('private is the default policy; existing changes require explicit approval', () => {
  assert.equal(REPOSITORY_PRIVACY_POLICY.newRepositoryVisibility, 'private');
  assert.equal(REPOSITORY_PRIVACY_POLICY.existingVisibilityChanges, 'explicit-approval-required');
});
test('repository metadata includes owner-scoped visibility and Pages without inventing audits', () => {
  assert.equal(publicRepoMetadata(publicRepo).hasPages, true);
  assert.equal(publicRepoMetadata(privateRepo).visibility, 'private');
  assert.equal(publicRepoMetadata({ ...privateRepo, owner: { login: 'other-user' } }), null);
  const row = derivePrivacyState(publicRepoMetadata(publicRepo));
  assert.equal(row.secretsAudit, 'not-started');
  assert.equal(row.exposureRisk, 'unassessed');
  assert.equal(row.migrationReadiness, 'not-reviewed');
  assert.equal(row.nextStep, 'Migrate Pages first');
});
test('review validation rejects unknown fields, oversized strings and fabricated status values', () => {
  assert.equal(validatePrivacyPatch({ visibility: 'private' }), null);
  assert.equal(validatePrivacyPatch({ secretsAudit: 'passed', notes: 'fine' }).secretsAudit, 'passed');
  assert.equal(validatePrivacyPatch({ exposureRisk: 'absolutely-safe' }), null);
  assert.equal(validatePrivacyPatch({ notes: 'a'.repeat(2401) }), null);
  assert.equal(validatePrivacyPatch({ pagesDependencies: 'a'.repeat(1001) }), null);
  assert.equal(validatePrivacyPatch({ migrationReadiness: 'deferred' }).migrationReadiness, 'deferred');
});
test('public-only mode is clearly incomplete and does not invent private repositories', async () => {
  const h = harness();
  const response = await h.get();
  assert.equal(response.status, 200);
  const data = await response.json();
  assert.equal(data.coverage, 'public-only');
  assert.deepEqual(data.repositories.map(r => r.fullName), ['nirav2000/Apps']);
  assert.equal(h.requests[0].headers.Authorization, undefined);
});
test('private repositories remain backend-only and the token never appears in JSON responses', async () => {
  const h = harness('dedicated');
  const response = await h.get();
  const content = await response.text();
  const data = JSON.parse(content);
  assert.equal(data.coverage, 'token-scoped');
  assert.equal(data.repositories.length, 2);
  assert.ok(data.repositories.some(r => r.fullName === 'nirav2000/Biz' && r.visibility === 'private'));
  assert.equal(h.requests.find(r => r.url.includes('/user/repos')).headers.Authorization, 'Bearer test-dedicated-token');
  assert.ok(!content.includes('test-dedicated-token'));
});
test('existing Notes GitHub secret is reused without copying or exposing its value', async () => {
  const h = harness('notes');
  const result = await (await h.get()).json();
  assert.equal(result.coverage, 'token-scoped');
  assert.equal(result.credentialSource, 'existing-notes');
  assert.equal(result.credentialStatus, 'private-visible');
  assert.equal(result.privateVisible, 1);
  assert.equal(result.repositories.length, 2);
  assert.equal(h.requests.find(r => r.url.includes('/user/repos')).headers.Authorization, 'Bearer test-existing-notes-token');
  assert.ok(!JSON.stringify(result).includes('test-existing-notes-token'));
});
test('GitHub App installation token can enumerate accessible private repositories', async () => {
  const h = harness('installation');
  const result = await (await h.get()).json();
  assert.equal(result.credentialSource, 'existing-notes');
  assert.equal(result.credentialStatus, 'private-visible');
  assert.equal(result.privateVisible, 1);
  assert.ok(h.requests.some(r => r.url.includes('/installation/repositories')));
});
test('existing token restricted to public repositories never claims full private access', async () => {
  const h = harness('restricted');
  const result = await (await h.get()).json();
  assert.equal(result.coverage, 'public-only');
  assert.equal(result.credentialStatus, 'no-private-visible');
  assert.equal(result.privateVisible, 0);
  assert.deepEqual(result.repositories.map(r => r.name), ['Apps']);
});
test('invalid existing token preserves public metadata and explains unavailable access', async () => {
  const h = harness('invalid');
  const result = await (await h.get()).json();
  assert.equal(result.coverage, 'public-only');
  assert.equal(result.credentialStatus, 'access-unavailable');
  assert.equal(result.credentialSource, 'existing-notes');
  assert.deepEqual(result.repositories.map(r => r.name), ['Apps']);
});
test('rate-limited public GitHub API does not return 502 when authenticated inventory works', async () => {
  const h = harness('public-rate-limited');
  const result = await h.get();
  assert.equal(result.status, 200);
  const body = await result.json();
  assert.equal(body.inventorySource, 'partial-cache');
  assert.equal(body.publicStatus, 'baseline-unverified');
  assert.equal(body.privateVisible, 1);
  assert.ok(body.repositories.some(r => r.fullName === 'nirav2000/Biz'));
  assert.ok(body.repositories.length >= 94, 'last known public baseline is available');
  assert.equal(h.requests[0].url.includes('/user/repos'), true, 'token inventory must be tried before public endpoints');
});
test('successful inventory is privately cached and avoids repeated GitHub API queries', async () => {
  const h = harness('notes');
  const first = await (await h.get()).json();
  const queries = h.requests.length;
  const second = await (await h.get()).json();
  assert.equal(second.inventorySource, 'cache');
  assert.deepEqual(first.repositories.map(r => r.fullName), second.repositories.map(r => r.fullName));
  assert.equal(h.requests.length, queries);
  assert.ok([...h.store.keys()].some(k => k.includes('inventory-v1.json')));
  await h.get(true);
  assert.ok(h.requests.length > queries, 'explicit refresh bypasses TTL');
});
test('outage returns saved inventory, never a 502, and marks it stale', async () => {
  const h = harness('all-rate-limited');
  h.store.set('_app-monitor/v2/security/repository-privacy/inventory-v1.json', JSON.stringify({
    version: 1, storedAt: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
    credentialSource: 'existing-notes', credentialStatus: 'private-visible', publicStatus: 'verified',
    entries: [
      { fullName: 'nirav2000/Apps', name: 'Apps', visibility: 'public', hasPages: true },
      { fullName: 'nirav2000/Biz', name: 'Biz', visibility: 'private', hasPages: false }
    ]
  }));
  const response = await h.get();
  assert.equal(response.status, 200);
  const result = await response.json();
  assert.equal(result.inventorySource, 'stale-cache');
  assert.equal(result.publicStatus, 'cached');
  assert.equal(result.repositories.length, 2);
});
test('total GitHub outage without cache yields a labelled historical public fallback, not 502', async () => {
  const h = harness('all-rate-limited');
  const response = await h.get();
  assert.equal(response.status, 200);
  const result = await response.json();
  assert.equal(result.publicStatus, 'baseline-unverified');
  assert.equal(result.inventorySource, 'baseline');
  assert.equal(result.coverage, 'public-only');
  assert.ok(result.repositories.length >= 90, 'preserve historical known-public listing');
  assert.equal(result.repositories.some(r => r.visibility === 'private'), false);
  assert.ok(result.repositories.every(r => r.pagesVerified === false && r.visibilityVerified === false));
  assert.ok(!JSON.stringify(result).includes('test-existing-notes-token'));
});
test('review annotations persist in private R2 and reappear on the next load', async () => {
  const h = harness(true);
  const edit = await h.post({
    repository: 'nirav2000/Apps',
    patch: {
      exposureRisk: 'medium', pagesPlan: 'migration-needed',
      pagesDependencies: 'Public Pages route and shared tracker',
      sharedLibraries: 'provider', sharedLibraryDetails: 'apps-auth, validation, Version Labs',
      secretsAudit: 'in-progress', migrationReadiness: 'blocked', notes: 'Review dependencies before moving'
    }
  });
  assert.equal(edit.status, 200);
  assert.ok([...h.store.keys()].some(k => k.includes('register-v1.json')), 'private review stored in R2');
  const data = await (await h.get()).json();
  const repo = data.repositories.find(r => r.name === 'Apps');
  assert.equal(repo.pagesDependencies, 'Public Pages route and shared tracker');
  assert.equal(repo.sharedLibraryDetails, 'apps-auth, validation, Version Labs');
  assert.equal(repo.migrationReadiness, 'blocked');
  assert.ok(repo.reviewedAt);
  assert.ok(!JSON.stringify(data).includes('test-dedicated-token'));
});
test('register API does not implement visibility changes or accept unknown repositories', async () => {
  const h = harness();
  const r = await h.post({ repository: 'attacker/Apps', patch: { exposureRisk: 'medium' } });
  assert.equal(r.status, 400);
  const invalid = await h.post({ repository: 'nirav2000/Apps', patch: { visibility: 'private' } });
  assert.equal(invalid.status, 400);
  const method = await h.route(new Request('https://example.com/app-monitor/repository-privacy', { method: 'DELETE' }));
  assert.equal(method.status, 405);
});
test('Worker authenticates before invoking the repository-privacy handler', () => {
  const worker = readFileSync('app-monitor-worker.js', 'utf8');
  const bridgeStart = worker.indexOf('async function sharedNotificationBridge(');
  const mainStart = worker.indexOf('async function appMonitorRoute(');
  assert.ok(bridgeStart > 0 && mainStart > bridgeStart, 'main router exists after notifications bridge');
  assert.ok(!worker.slice(bridgeStart, mainStart).includes("url.pathname==='/app-monitor/repository-privacy'"), 'privacy route must never run in the notifications bridge');
  const start = worker.indexOf("if(url.pathname==='/app-monitor/repository-privacy')", mainStart);
  const end = worker.indexOf('  }', start);
  assert.ok(start > mainStart, 'privacy route belongs to main App Monitor router');
  const route = worker.slice(start, end);
  assert.match(route, /appMonitorSession\(request,env\)/);
  assert.match(route, /status:401/);
  assert.match(route, /method!==['"]passkey['"]/);
  assert.match(route, /status:403/);
  assert.match(route, /handleRepositoryPrivacyRoute/);
});
test('App Monitor UI mounts register inside the authenticated content only', () => {
  const ui = readFileSync('app-monitor.html', 'utf8');
  assert.ok(ui.indexOf('id="repositoryPrivacy"') > ui.indexOf('id="protectedApp"'));
  assert.ok(ui.indexOf('id="repositoryPrivacy"') < ui.indexOf('</div>\n</div><script>'));
  assert.ok(ui.includes('app-monitor-privacy.js?v=2'));
  assert.ok(ui.includes("app-monitor-privacy-auth"));
});
