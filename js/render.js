import { OWNER_WITH_CURATED_DATA } from './constants.js';

const fallbackRepoCard = (owner, repo) => `https://opengraph.githubassets.com/1/${owner}/${repo}`;

const formatDate = (iso) => {
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  } catch {
    return 'Unknown date';
  }
};

export function setStatus(statusEl, message, isError = false) {
  statusEl.textContent = message;
  statusEl.classList.toggle('error', isError);
}

export function applyView({ cachedPagesRepos, searchInput, sortSelect, renderTiles }) {
  const query = searchInput.value.trim().toLowerCase();
  const sortMode = sortSelect.value;

  let repos = [...cachedPagesRepos];

  if (query) {
    repos = repos.filter((repo) => `${repo.name} ${repo.title}`.toLowerCase().includes(query));
  }

  if (sortMode === 'name') {
    repos.sort((a, b) => a.name.localeCompare(b.name));
  } else {
    repos.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
  }

  renderTiles(repos, query);
}

export function renderTiles({ repos, query = '', cachedPagesRepos, grid, statusEl, tileTemplate }) {
  grid.innerHTML = '';

  if (cachedPagesRepos.length === 0) {
    setStatus(statusEl, 'No repositories with GitHub Pages enabled were found.');
    return;
  }

  if (repos.length === 0) {
    setStatus(statusEl, `No GitHub Pages apps matched "${query}".`);
    return;
  }

  for (const [index, repo] of repos.entries()) {
    const clone = tileTemplate.content.cloneNode(true);
    const tileEl = clone.querySelector('.tile');
    tileEl.style.setProperty('--tile-index', index);
    const imageEl = clone.querySelector('.tile-image');
    const owner = repo.repoUrl.split('/')[3] || OWNER_WITH_CURATED_DATA;

    imageEl.src = repo.image;
    imageEl.alt = `${repo.title} preview image`;
    imageEl.addEventListener(
      'error',
      () => {
        imageEl.src = repo.fallbackImage || fallbackRepoCard(owner, repo.name);
      },
      { once: true }
    );

    clone.querySelector('.tile-image-link').href = repo.appUrl;
    clone.querySelector('.tile-title').textContent = repo.title;
    clone.querySelector('.tile-description').textContent = repo.blurb;
    clone.querySelector('.tile-meta').textContent = `Updated ${formatDate(repo.updatedAt)} · ${repo.name}`;

    clone.querySelector('.app-link').href = repo.appUrl;
    clone.querySelector('.repo-link').href = repo.repoUrl;

    grid.appendChild(clone);
  }

  const appWord = repos.length === 1 ? 'app' : 'apps';
  const sourceCount = cachedPagesRepos.length;
  setStatus(statusEl, `Showing ${repos.length} of ${sourceCount} GitHub Pages ${appWord}.`);
}
