import test from 'node:test';
import assert from 'node:assert/strict';
import { validateBizManifest, handleBizAppsCatalog } from '../app-monitor-app-catalog.js';

const manifest = () => ({
  schemaVersion: 1, sourceRepository: 'nirav2000/Biz',
  apps: [
    { id: 'gp-website-intelligence', title: 'GP Website Intelligence', summary: 'Public research dashboard',
      sourcePath: 'ideas/gp-website-intelligence', status: 'published',
      publicFolder: 'GPSites', liveUrl: 'https://nirav2000.github.io/GPSites/' },
    { id: 'nvr-review', title: 'NVR Review', summary: 'Private family review',
      sourcePath: 'ideas/nvr', status: 'private', publicFolder: null, liveUrl: null }
  ]
});
test('normalises a public app and a private app without sensitive data fields', () => {
  const input = manifest();
  input.apps[1].secret = 'must not be returned';
  const apps = validateBizManifest(input);
  assert.equal(apps.length, 2);
  assert.equal(apps[0].liveUrl, 'https://nirav2000.github.io/GPSites/');
  assert.equal(apps[1].liveUrl, null);
  assert.equal(apps[1].sourceUrl, 'https://github.com/nirav2000/Biz/tree/main/ideas/nvr');
  assert.equal('secret' in apps[1], false);
});

test('rejects private app publication and path traversal', () => {
  const invalid = manifest();
  invalid.apps[1].liveUrl = 'https://nirav2000.github.io/nvr/';
  assert.throws(() => validateBizManifest(invalid));
  invalid.apps[1].liveUrl = null;
  invalid.apps[1].sourcePath = 'ideas/../data';
  assert.throws(() => validateBizManifest(invalid));
});

test('rejects duplicate IDs and external published URLs', () => {
  const invalid = manifest();
  invalid.apps[1].id = invalid.apps[0].id;
  assert.throws(() => validateBizManifest(invalid));
  invalid.apps[1].id = 'nvr-review';
  invalid.apps[0].liveUrl = 'https://evil.example/GPSites/';
  assert.throws(() => validateBizManifest(invalid));
});

test('fails closed when a private GitHub token is not configured', async () => {
  const response = await handleBizAppsCatalog(new Request('https://example.test/'), {}, {});
  assert.equal(response.status, 503);
  assert.match((await response.json()).error, /read-only GitHub token/);
  assert.equal(response.headers.get('cache-control'), 'no-store');
});

test('reads Biz manifest only from the server with its bearer token', async () => {
  const readToken = 'private-server-token';
  let requestedUrl = '';
  const fetcher = async (url, init) => {
    requestedUrl = url;
    assert.equal(init.headers.Authorization, 'Bearer ' + readToken);
    assert.equal(init.redirect, 'manual');
    return new Response(JSON.stringify({
      type: 'file', size: 300, encoding: 'base64',
      content: Buffer.from(JSON.stringify(manifest())).toString('base64')
    }), { status: 200 });
  };
  const response = await handleBizAppsCatalog(new Request('https://example.test/'),
    { BIZ_CATALOG_GITHUB_TOKEN: readToken }, {}, fetcher);
  assert.equal(response.status, 200);
  assert.match(requestedUrl, /repos\/nirav2000\/Biz\/contents\/apps-manifest.json/);
  const data = await response.json();
  assert.equal(data.apps.length, 2);
  assert.equal(JSON.stringify(data).includes(readToken), false);
});

test('cannot leak upstream failure payloads', async () => {
  const response = await handleBizAppsCatalog(new Request('https://example.test/'),
    { BIZ_CATALOG_GITHUB_TOKEN: 'secret' }, {},
    async () => new Response('private error text', { status: 404 }));
  assert.equal(response.status, 503);
  assert.equal(JSON.stringify(await response.json()).includes('private error text'), false);
});
