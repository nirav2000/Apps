// Discover actual public apps in the root-level folders of the shared Pages repository.
// Git trees are public, and each published app is identified by its own /index.html.
export function rootPublishedAppFolders(tree) {
  if (!tree || tree.truncated || !Array.isArray(tree.tree)) throw Error('Incomplete Pages tree');
  return [...new Set(tree.tree
    .filter(row => row?.type === 'blob' && typeof row.path === 'string' &&
      /^[A-Za-z0-9][A-Za-z0-9._-]{0,80}\/index\.html$/.test(row.path))
    .map(row => row.path.split('/')[0]))].sort();
}
