import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  REPOSITORY_PRIVACY_POLICY, validatePrivacyPatch, publicRepoMetadata,
  derivePrivacyState, handleRepositoryPrivacyRoute
} from './app-monitor-repository-privacy.js';

const publicRepo = { name: 'Apps', owner: { login: 'nirav2000' }, visibility: 'public', private: false, has_pages: true, default_branch: 'main' };
const privateRepo = { name: 'Biz', owner: { login: 'nirav2000' }, visibility: 'private', private: true, has_pages: false, default_branch: 'main' };
function harness(withToken = false) {
  const store = new Map();
  const requests = [];
  const env = {
    APP_MONITOR_DATA: {
      get: async key => store.has(key) ? { text: async () => store.get(key) } : null,
      put: async (key, body) => { store.set(key, body); }
    },
    ...(withToken ? { REPOSITORY_PRIVACY_GITHUB_TOKEN: 'test-backend-token' } : {})
  };
  async function mockFetch(url, init) {
    requests.push({ url, headers: init.headers });
    const token = Boolean(init.headers.Authorization);
    if (url.includes('/user/repos') && !token) throw Error('Expected token');
    if (url.includes('/users/nirav2000/repos') && token) throw Error('Public endpoint must not receive token');
    const data = token ? [publicRepo, privateRepo] : [publicRepo];
    return new Response(JSON.stringify(data), { status: 200, headers: { 'Content-Type': 'application/json' } });
  }
  const route = (request) => handleRepositoryPrivacyRoute(
    request, env, { 'Cache-Control': 'no-store' }, new URL(request.url), mockFetch
  );
  const get = () => route(new Request('https://example.com/app-monitor/repository-privacy'));
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
  const h = harness(true);
  const response = await h.get();
  const content = await response.text();
  const data = JSON.parse(content);
  assert.equal(data.coverage, 'token-scoped');
  assert.equal(data.repositories.length, 2);
  assert.ok(data.repositories.some(r => r.fullName === 'nirav2000/Biz' && r.visibility === 'private'));
  assert.equal(h.requests[0].headers.Authorization, 'Bearer test-backend-token');
  assert.ok(!content.includes('test-backend-token'));
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
  assert.equal(h.store.size, 1);
  const data = await (await h.get()).json();
  const repo = data.repositories.find(r => r.name === 'Apps');
  assert.equal(repo.pagesDependencies, 'Public Pages route and shared tracker');
  assert.equal(repo.sharedLibraryDetails, 'apps-auth, validation, Version Labs');
  assert.equal(repo.migrationReadiness, 'blocked');
  assert.ok(repo.reviewedAt);
  assert.ok(!JSON.stringify(data).includes('test-backend-token'));
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
  assert.ok(ui.includes('app-monitor-privacy.js?v=1'));
  assert.ok(ui.includes("app-monitor-privacy-auth"));
});
