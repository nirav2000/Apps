import test from 'node:test';
import assert from 'node:assert/strict';
import { mergeCuratedAndDiscovered } from '../js/catalog-merge.js';

test('keeps two apps hosted in one repository as separate catalogue cards', () => {
  const curated = [
    { name: 'GPSites', repoUrl: 'https://github.com/nirav2000/Biz', appUrl: 'https://nirav2000.github.io/GPSites/', title: 'GP Website Intelligence' },
    { name: 'SightReadStudio', repoUrl: 'https://github.com/nirav2000/nirav2000.github.io', appUrl: 'https://nirav2000.github.io/SightReadStudio/', title: 'SightRead Studio' },
    { name: 'SiteRoot', repoUrl: 'https://github.com/nirav2000/nirav2000.github.io', appUrl: 'https://nirav2000.github.io/', title: 'Home' }
  ];
  const repos = [{ has_pages: true, name: 'nirav2000.github.io' }];
  const result = mergeCuratedAndDiscovered(curated, repos,
    () => ({ name: 'nirav2000.github.io', repoUrl: 'https://github.com/nirav2000/nirav2000.github.io', appUrl: 'https://nirav2000.github.io/', updatedAt: '2026-11-09T00:00:00Z' }));
  assert.equal(result.length, 3);
  assert.deepEqual(result.map(x => x.title), ['GP Website Intelligence','SightRead Studio','Home']);
  assert.equal(result[2].updatedAt, '2026-11-09T00:00:00Z');
});

test('adds newly discovered repositories without replacing curated cards', () => {
  const result = mergeCuratedAndDiscovered(
    [{ appUrl: 'https://nirav2000.github.io/Apps/', title: 'Curated' }],
    [{ has_pages: true }, { has_pages: false }],
    () => ({ appUrl: 'https://nirav2000.github.io/New/', title: 'Discovered' })
  );
  assert.deepEqual(result.map(x => x.title), ['Curated','Discovered']);
});
