const grid = document.getElementById('grid');
const statusEl = document.getElementById('status');
const usernameInput = document.getElementById('username');
const loadBtn = document.getElementById('loadBtn');
const searchInput = document.getElementById('search');
const sortSelect = document.getElementById('sort');
const tileTemplate = document.getElementById('tileTemplate');

let cachedPagesRepos = [];

const repoUrl = (owner, repo) => `https://github.com/${owner}/${repo}`;
const pagesUrl = (repo) =>
  repo.homepage && repo.homepage.trim()
    ? repo.homepage.trim()
    : `https://${repo.owner.login}.github.io/${repo.name}/`;

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

async function fetchAllRepos(username, endpointType = 'users') {
  let page = 1;
  const repos = [];

  while (true) {
    const url = `https://api.github.com/${endpointType}/${encodeURIComponent(username)}/repos?per_page=100&page=${page}&sort=updated&type=owner`;
    const response = await fetch(url, {
      headers: { Accept: 'application/vnd.github+json' }
    });

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

function applyView() {
  const query = searchInput.value.trim().toLowerCase();
  const sortMode = sortSelect.value;

  let repos = [...cachedPagesRepos];

  if (query) {
    repos = repos.filter((repo) => repo.name.toLowerCase().includes(query));
  }

  if (sortMode === 'updated') {
    repos.sort((a, b) => new Date(b.pushed_at) - new Date(a.pushed_at));
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

  for (const repo of repos) {
    const clone = tileTemplate.content.cloneNode(true);
    clone.querySelector('.tile-title').textContent = repo.name;
    clone.querySelector('.tile-description').textContent = repo.description || 'No repository description provided.';
    clone.querySelector('.tile-meta').textContent = `Updated ${formatDate(repo.pushed_at)}`;

    const appLink = clone.querySelector('.app-link');
    appLink.href = pagesUrl(repo);

    const repoLink = clone.querySelector('.repo-link');
    repoLink.href = repoUrl(repo.owner.login, repo.name);

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
    const repos = await fetchAllRepos(username);
    cachedPagesRepos = repos.filter((repo) => repo.has_pages);
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
