const OWNER_WITH_CURATED_DATA = 'nirav2000';


const APP_SPECIFIC_PREVIEWS = {
  Apps: 'dashboard_brand/previews/apps-dashboard-live.svg',
  'ML-ml101': 'https://nirav2000.github.io/ML/dashboard_brand/previews/ml101.svg',
  'ML-pong-evolution': 'https://nirav2000.github.io/ML/dashboard_brand/previews/pong-evolution.svg',
  'ML-pong-rl': 'https://nirav2000.github.io/ML/dashboard_brand/previews/pong-rl.svg',
  'ML-pong-compare': 'https://nirav2000.github.io/ML/dashboard_brand/previews/pong-compare.svg',
  'ML-pong-duel': 'https://nirav2000.github.io/ML/dashboard_brand/previews/pong-duel.svg',
  ML: 'https://nirav2000.github.io/ML/dashboard_brand/previews/ml.svg',
  'ML-GA-MLGA101': 'dashboard_brand/previews/ml-ga101.svg'
};

const grid = document.getElementById('grid');
const statusEl = document.getElementById('status');
const usernameInput = document.getElementById('username');
const loadBtn = document.getElementById('loadBtn');
const searchInput = document.getElementById('search');
const searchToggle = document.getElementById('searchToggle');
const searchField = document.getElementById('searchField');
const searchPanel = document.getElementById('searchPanel');
const sortSelect = document.getElementById('sort');
const tileTemplate = document.getElementById('tileTemplate');

let cachedPagesRepos = [];

const repoUrl = (owner, repo) => `https://github.com/${owner}/${repo}`;
const screenshotFromUrl = (url) => `https://image.thum.io/get/width/1200/crop/700/noanimate/${url}`;
const screenshotImage = (owner, repo) => screenshotFromUrl(`https://${owner}.github.io/${repo}/`);
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

function setStatus(message, isError = false) {
  statusEl.textContent = message;
  statusEl.classList.toggle('error', isError);
}

function normalizeRepo(curatedRepo) {
  const owner = (curatedRepo.repoUrl?.split('/')[3] || OWNER_WITH_CURATED_DATA).trim();
  const repo = (curatedRepo.repoUrl?.split('/')[4] || curatedRepo.name).trim();
  const fallbackImage = curatedRepo.image || screenshotFromUrl(curatedRepo.appUrl) || screenshotImage(owner, repo);
  const curatedPreview = APP_SPECIFIC_PREVIEWS[curatedRepo.name] || APP_SPECIFIC_PREVIEWS[repo] || null;

  return {
    name: curatedRepo.name,
    title: curatedRepo.title || curatedRepo.name,
    blurb: curatedRepo.blurb || 'Interactive app published with GitHub Pages.',
    image: curatedPreview || fallbackImage,
    fallbackImage,
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
  const appUrl = repo.homepage && repo.homepage.trim() ? repo.homepage.trim() : `https://${repo.owner.login}.github.io/${repo.name}/`;
  const fallbackImage = screenshotFromUrl(appUrl);
  const curatedPreview = APP_SPECIFIC_PREVIEWS[repo.name] || null;
  return {
    name: repo.name,
    title: repo.name,
    blurb: repo.description || 'Interactive app published with GitHub Pages.',
    image: curatedPreview || fallbackImage,
    fallbackImage,
    appUrl,
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

  if (sortMode === 'name') {
    repos.sort((a, b) => a.name.localeCompare(b.name));
  } else {
    repos.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
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
  setStatus(`Showing ${repos.length} of ${sourceCount} GitHub Pages ${appWord}.`);
}


function toggleSearch() {
  const isHidden = searchPanel.hasAttribute('hidden');
  if (isHidden) {
    searchPanel.removeAttribute('hidden');
    searchToggle.setAttribute('aria-expanded', 'true');
    searchInput.focus();
    return;
  }

  searchPanel.setAttribute('hidden', '');
  searchToggle.setAttribute('aria-expanded', 'false');
  if (searchInput.value.trim()) {
    searchInput.value = '';
    applyView();
  }
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

sortSelect.value = 'updated';
loadBtn.addEventListener('click', loadDashboard);
searchToggle.addEventListener('click', toggleSearch);
usernameInput.addEventListener('keydown', (event) => {
  if (event.key === 'Enter') {
    event.preventDefault();
    loadDashboard();
  }
});
searchInput.addEventListener('input', applyView);
sortSelect.addEventListener('change', applyView);
window.addEventListener('DOMContentLoaded', loadDashboard);
