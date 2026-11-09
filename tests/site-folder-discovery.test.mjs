import test from 'node:test';
import assert from 'node:assert/strict';
import { rootPublishedAppFolders } from '../js/site-folders.js';

test('discovers root-level public apps, but not nested fixtures or .github', () => {
  const folders = rootPublishedAppFolders({ truncated: false, tree: [
    { path: 'GPSites/index.html', type: 'blob' },
    { path: 'SightReadStudio/index.html', type: 'blob' },
    { path: 'GPSites/subfolder/index.html', type: 'blob' },
    { path: '.github/index.html', type: 'blob' },
    { path: 'README.md', type: 'blob' },
    { path: 'SightReadStudio/index.html', type: 'blob' },
    { path: 'not-a-site/index.html', type: 'tree' }
  ]});
  assert.deepEqual(folders, ['GPSites', 'SightReadStudio']);
});
test('refuses truncated or invalid trees', () => {
  assert.throws(() => rootPublishedAppFolders({ truncated: true, tree: [] }));
  assert.throws(() => rootPublishedAppFolders({ tree: 'bad' }));
});
