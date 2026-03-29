const grid = document.getElementById('grid');
const statusEl = document.getElementById('status');
const usernameInput = document.getElementById('username');
const loadBtn = document.getElementById('loadBtn');
const tileTemplate = document.getElementById('tileTemplate');

const repoUrl = (user, repo) => `https://github.com/${user}/${repo}`;
const pagesUrl = (repo) => repo.homepage && repo.homepage.trim() ? repo.homepage.trim() : `https://${repo.owner.login}.github.io/${repo.name}/`;

async function fetchAllRepos(username) {
  let page = 1;
  const repos = [];

  while (true) {
    const url = `https://api.github.com/users/${encodeURIComponent(username)}/repos?per_page=100&page=${page}&sort=updated`;
    const response = await fetch(url, {
      headers: {
        Accept: 'application/vnd.github+json'
      }
    });

    if (!response.ok) {
      throw new Error(`GitHub API error ${response.status}`);
    }

    const chunk = await response.json();
    repos.push(...chunk);

    if (chunk.length < 100) {
      break;
    }

    page += 1;
  }

  return repos;
}

function renderTiles(repos) {
  grid.innerHTML = '';

  if (repos.length === 0) {
    statusEl.textContent = 'No repositories with GitHub Pages enabled were found.';
    return;
  }

  const sortedRepos = [...repos].sort((a, b) => a.name.localeCompare(b.name));

  for (const repo of sortedRepos) {
    const clone = tileTemplate.content.cloneNode(true);
    clone.querySelector('.tile-title').textContent = repo.name;
    clone.querySelector('.tile-description').textContent = repo.description || 'No repository description provided.';

    const appLink = clone.querySelector('.app-link');
    appLink.href = pagesUrl(repo);

    const repoLink = clone.querySelector('.repo-link');
    repoLink.href = repoUrl(repo.owner.login, repo.name);

    grid.appendChild(clone);
  }

  statusEl.textContent = `Found ${repos.length} GitHub Pages app${repos.length === 1 ? '' : 's'}.`;
}

async function loadDashboard() {
  const username = usernameInput.value.trim();

  if (!username) {
    statusEl.textContent = 'Please enter a GitHub username.';
    return;
  }

  statusEl.textContent = 'Loading repositories from GitHub...';
  loadBtn.disabled = true;

  try {
    const repos = await fetchAllRepos(username);
    const pagesRepos = repos.filter((repo) => repo.has_pages);
    renderTiles(pagesRepos);
  } catch (error) {
    statusEl.textContent = `Unable to load repositories: ${error.message}`;
    grid.innerHTML = '';
  } finally {
    loadBtn.disabled = false;
  }
}

loadBtn.addEventListener('click', loadDashboard);
window.addEventListener('DOMContentLoaded', loadDashboard);
