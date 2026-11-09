import { OWNER_WITH_CURATED_DATA } from './constants.js';
import { fetchAllRepos, fetchCuratedAppsData, fetchHostedPageFolders, toGenericCard } from './data.js';
import { applyView, renderTiles, setStatus } from './render.js';
import { mergeCuratedAndDiscovered } from './catalog-merge.js';

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
      applyCurrentView();
      try {
        const repos = await fetchAllRepos(username);
        cachedPagesRepos = mergeCuratedAndDiscovered(cachedPagesRepos, repos, toGenericCard);
        // Independent public apps can live in folders of the same Pages repository.
        // A failed GitHub tree lookup does not hide the curated catalogue.
        try {
          const pageRepo = repos.find(repo => repo.name === username + '.github.io');
          const folders = await fetchHostedPageFolders(pageRepo?.pushed_at);
          const known = new Set(cachedPagesRepos.map(card => card.appUrl.toLowerCase().replace(/\/$/, '')));
          folders.forEach(card => {
            const key = card.appUrl.toLowerCase().replace(/\/$/, '');
            if (!known.has(key)) { known.add(key); cachedPagesRepos.push(card); }
          });
        } catch (error) {
          console.warn('Shared Pages folder discovery unavailable; curated apps are preserved.', error);
        }
        localStorage.setItem('apps-discovered-v1', JSON.stringify(cachedPagesRepos));
      } catch (error) {
        try {
          const cached = JSON.parse(localStorage.getItem('apps-discovered-v1') || '[]');
          const urlKey = card => String(card.appUrl || '').trim().toLowerCase().replace(/\/$/, '');
          const cards = new Map(cachedPagesRepos.map(card => [urlKey(card), card]));
          cached.forEach(card => {
            if (card && /^https:\/\/nirav2000\.github\.io\//i.test(card.appUrl || '') &&
              !cards.has(urlKey(card))) cards.set(urlKey(card), card);
          });
          cachedPagesRepos = [...cards.values()];
        } catch { /* Curated catalogue remains usable. */ }
        applyCurrentView();
        setStatus(statusEl, `Showing saved apps. Automatic discovery could not refresh: ${error.message}`, true);
        return;
      }
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
