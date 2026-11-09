import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';

const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
test('public catalogue has unique live URL cards for both hosted folders', () => {
  const cards = JSON.parse(read('apps-data.json'));
  const urls = cards.map(card => card.appUrl.toLowerCase().replace(/\/$/, ''));
  assert.equal(new Set(urls).size, urls.length, 'Each publicly linked app URL should occur once');
  for (const id of ['GPSites', 'SightReadStudio']) {
    const card = cards.find(card => card.name === id);
    assert.ok(card, 'Missing public app ' + id);
    assert.match(card.appUrl, /^https:\/\/nirav2000\.github\.io\//);
  }
  const nvr = cards.find(card => card.name === 'NVR');
  assert.equal(nvr?.appUrl, 'https://nirav2000.github.io/NVR/');
  assert.match(nvr?.title || '', /Passkey Required/);
});

test('dashboard loads passkey client before private catalogue module', () => {
  const html = read('index.html');
  assert.ok(html.indexOf('apps-passkey-auth.js') < html.indexOf('js/biz-portfolio.js'));
  assert.match(html, /id="bizLogin"/);
  assert.match(html, /id="bizUnlocked" hidden/);
  assert.match(html, /id="bizCards"/);
  assert.match(read('js/biz-portfolio.js'), /verified\.method !== 'passkey'/);
});

test('Worker validates passkey server-side before reading Biz catalogue', () => {
  const worker = read('app-monitor-worker.js');
  const start = worker.indexOf("if(url.pathname==='/app-monitor/apps-catalog')");
  assert.ok(start > -1);
  const route = worker.slice(start, worker.indexOf("if(url.pathname==='/app-monitor/repository-privacy')", start));
  assert.match(route, /await appMonitorSession\(request,env\)/);
  assert.match(route, /session\.record\.method!=='passkey'/);
  assert.match(route, /return handleBizAppsCatalog\(request,env,headers\)/);
  assert.equal(read('js/biz-portfolio.js').includes('BIZ_CATALOG_GITHUB_TOKEN'), false);
});

test('all page-owned CSS and JS assets exist', () => {
  for (const file of ['biz-portfolio.css','js/biz-portfolio.js','js/site-folders.js','js/catalog-merge.js','apps-passkey-auth.js']) {
    assert.equal(existsSync(new URL('../' + file, import.meta.url)), true);
  }
});
