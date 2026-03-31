import { OWNER_WITH_CURATED_DATA } from './constants.js';
import { fetchAllRepos, fetchCuratedAppsData, toGenericCard } from './data.js';
import { applyView, renderTiles, setStatus } from './render.js';

const grid = document.getElementById('grid');
const statusEl = document.getElementById('status');
const usernameInput = document.getElementById('username');
const loadBtn = document.getElementById('loadBtn');
const searchInput = document.getElementById('search');
const searchToggle = document.getElementById('searchToggle');
const searchPanel = document.getElementById('searchPanel');
const sortSelect = document.getElementById('sort');
const tileTemplate = document.getElementById('tileTemplate');

let cachedPagesRepos = [];

function renderView(repos, query = '') {
  renderTiles({ repos, query, cachedPagesRepos, grid, statusEl, tileTemplate });
}

function applyCurrentView() {
  applyView({ cachedPagesRepos, searchInput, sortSelect, renderTiles: renderView });
}

function toggleSearchPanel() {
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
    applyCurrentView();
  }
}

async function loadDashboard() {
  const username = usernameInput.value.trim();

  if (!username) {
    setStatus(statusEl, 'Please enter a GitHub username.', true);
    return;
  }

  setStatus(statusEl, `Loading repositories for ${username}...`);
  loadBtn.disabled = true;

  try {
    if (username.toLowerCase() === OWNER_WITH_CURATED_DATA) {
      cachedPagesRepos = await fetchCuratedAppsData();
    } else {
      const repos = await fetchAllRepos(username);
      cachedPagesRepos = repos.filter((repo) => repo.has_pages).map(toGenericCard);
    }
    applyCurrentView();
  } catch (error) {
    cachedPagesRepos = [];
    grid.innerHTML = '';
    setStatus(statusEl, `Unable to load repositories: ${error.message}`, true);
  } finally {
    loadBtn.disabled = false;
  }
}

sortSelect.value = 'updated';
loadBtn.addEventListener('click', loadDashboard);
searchToggle.addEventListener('click', toggleSearchPanel);
usernameInput.addEventListener('keydown', (event) => {
  if (event.key === 'Enter') {
    event.preventDefault();
    loadDashboard();
  }
});
searchInput.addEventListener('input', applyCurrentView);
sortSelect.addEventListener('change', applyCurrentView);
window.addEventListener('DOMContentLoaded', loadDashboard);
