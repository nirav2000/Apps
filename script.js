const OWNER_WITH_CURATED_DATA = 'nirav2000';

const GENERATED_PREVIEW_BY_REPO = {
  Apps: 'apps.svg',
  Feesight: 'feesight.svg',
  'japanese-learning-app': 'japanese-learning.svg',
  MentalAbacus: 'mental-abacus.svg',
  Phonics: 'phonics.svg',
  's-fractions': 's-fractions.svg',
  SightReading: 'sight-reading.svg',
  TT38: 'tt38.svg',
  ML: 'ml.svg',
  'UI-template': 'ui-template.svg'
};

const grid = document.getElementById('grid');
const statusEl = document.getElementById('status');
const usernameInput = document.getElementById('username');
const loadBtn = document.getElementById('loadBtn');
const searchInput = document.getElementById('search');
const sortSelect = document.getElementById('sort');
const tileTemplate = document.getElementById('tileTemplate');

let cachedPagesRepos = [];

const repoUrl = (owner, repo) => `https://github.com/${owner}/${repo}`;
const screenshotImage = (owner, repo) => `https://image.thum.io/get/width/1200/crop/700/noanimate/https://${owner}.github.io/${repo}/`;
const fallbackRepoCard = (owner, repo) => `https://opengraph.githubassets.com/1/${owner}/${repo}`;
const generatedPreviewPath = (repoName) => {
  const file = GENERATED_PREVIEW_BY_REPO[repoName];
  return file ? `dashboard_brand/previews/${file}` : null;
};

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

function setStatus(message, isError = false) {
  statusEl.textContent = message;
  statusEl.classList.toggle('error', isError);
}

function normalizeRepo(curatedRepo) {
  return {
    name: curatedRepo.name,
    title: curatedRepo.title || curatedRepo.name,
    blurb: curatedRepo.blurb || 'Interactive app published with GitHub Pages.',
    image: generatedPreviewPath(curatedRepo.name) || curatedRepo.image || screenshotImage(OWNER_WITH_CURATED_DATA, curatedRepo.name),
    appUrl: curatedRepo.appUrl,
    repoUrl: curatedRepo.repoUrl,
    updatedAt: curatedRepo.updatedAt
  };
}

async function fetchCuratedAppsData() {
  const response = await fetch('apps-data.json', { headers: { Accept: 'application/json' } });
  if (!response.ok) {
    throw new Error(`Unable to load apps-data.json (${response.status}).`);
  }

  const data = await response.json();
  return data.map(normalizeRepo);
}

async function fetchAllRepos(username, endpointType = 'users') {
  let page = 1;
  const repos = [];

  while (true) {
    const url = `https://api.github.com/${endpointType}/${encodeURIComponent(username)}/repos?per_page=100&page=${page}&sort=updated&type=owner`;
    const response = await fetch(url, { headers: { Accept: 'application/vnd.github+json' } });

    if (response.status === 404 && endpointType === 'users') {
      return fetchAllRepos(username, 'orgs');
    }

    if (!response.ok) {
      const reset = response.headers.get('x-ratelimit-reset');
      if (response.status === 403 && reset) {
        const resetDate = new Date(Number(reset) * 1000);
        throw new Error(`GitHub API rate limit reached. Try again after ${resetDate.toLocaleString()}.`);
      }
      throw new Error(`GitHub API error ${response.status}`);
    }

    const chunk = await response.json();
    repos.push(...chunk);

    if (chunk.length < 100) break;
    page += 1;
  }

  return repos;
}

function toGenericCard(repo) {
  return {
    name: repo.name,
    title: repo.name,
    blurb: repo.description || 'Interactive app published with GitHub Pages.',
    image: generatedPreviewPath(repo.name) || screenshotImage(repo.owner.login, repo.name),
    appUrl: repo.homepage && repo.homepage.trim() ? repo.homepage.trim() : `https://${repo.owner.login}.github.io/${repo.name}/`,
    repoUrl: repoUrl(repo.owner.login, repo.name),
    updatedAt: repo.pushed_at
  };
}

function applyView() {
  const query = searchInput.value.trim().toLowerCase();
  const sortMode = sortSelect.value;

  let repos = [...cachedPagesRepos];

  if (query) {
    repos = repos.filter((repo) => `${repo.name} ${repo.title}`.toLowerCase().includes(query));
  }

  if (sortMode === 'updated') {
    repos.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
  } else {
    repos.sort((a, b) => a.name.localeCompare(b.name));
  }

  renderTiles(repos, query);
}

function renderTiles(repos, query = '') {
  grid.innerHTML = '';

  if (cachedPagesRepos.length === 0) {
    setStatus('No repositories with GitHub Pages enabled were found.');
    return;
  }

  if (repos.length === 0) {
    setStatus(`No GitHub Pages apps matched "${query}".`);
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
        imageEl.src = fallbackRepoCard(owner, repo.name);
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
  setStatus(`Showing ${repos.length} of ${sourceCount} GitHub Pages ${appWord}.`);
}

async function loadDashboard() {
  const username = usernameInput.value.trim();

  if (!username) {
    setStatus('Please enter a GitHub username.', true);
    return;
  }

  setStatus(`Loading repositories for ${username}...`);
  loadBtn.disabled = true;

  try {
    if (username.toLowerCase() === OWNER_WITH_CURATED_DATA) {
      cachedPagesRepos = await fetchCuratedAppsData();
    } else {
      const repos = await fetchAllRepos(username);
      cachedPagesRepos = repos.filter((repo) => repo.has_pages).map(toGenericCard);
    }
    applyView();
  } catch (error) {
    cachedPagesRepos = [];
    grid.innerHTML = '';
    setStatus(`Unable to load repositories: ${error.message}`, true);
  } finally {
    loadBtn.disabled = false;
  }
}

loadBtn.addEventListener('click', loadDashboard);
usernameInput.addEventListener('keydown', (event) => {
  if (event.key === 'Enter') {
    event.preventDefault();
    loadDashboard();
  }
});
searchInput.addEventListener('input', applyView);
sortSelect.addEventListener('change', applyView);
window.addEventListener('DOMContentLoaded', loadDashboard);
