// A repository can contain multiple independently published apps.
// Match dashboard cards by their live URL, not by their shared source repository.
const urlKey = card => String(card?.appUrl || '').trim().toLowerCase().replace(/\/$/, '');

export function mergeCuratedAndDiscovered(curated, repositories, toGenericCard) {
  const cards = new Map();
  for (const card of curated) {
    if (urlKey(card)) cards.set(urlKey(card), card);
  }
  for (const repo of repositories.filter(repo => repo.has_pages)) {
    const live = toGenericCard(repo);
    const key = urlKey(live);
    if (!key) continue;
    const existing = cards.get(key);
    cards.set(key, existing ? { ...live, ...existing, updatedAt: live.updatedAt } : live);
  }
  return [...cards.values()];
}
