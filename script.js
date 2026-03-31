const OWNER_WITH_CURATED_DATA = 'nirav2000';

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

function inferPreviewTheme(card) {
  const text = `${card.title} ${card.blurb} ${card.name}`.toLowerCase();

  if (/machine learning|ml|model|ai|neural|analytics/.test(text)) {
    return { motif: 'grid', accent: '#7bdfff', glow: '#59a8ff', subtitle: 'Machine Learning Projects' };
  }
  if (/fraction|math|abacus|times table|number|arithmetic/.test(text)) {
    return { motif: 'bars', accent: '#8effd1', glow: '#4fddb3', subtitle: 'Math Practice' };
  }
  if (/music|sight|note|reading/.test(text)) {
    return { motif: 'traces', accent: '#d4a4ff', glow: '#a66dff', subtitle: 'Music Trainer' };
  }
  if (/japanese|phonics|spelling|reading|grammar|language/.test(text)) {
    return { motif: 'nodes', accent: '#ffb084', glow: '#ff8a5b', subtitle: 'Language Learning' };
  }
  if (/fees|finance|analy/.test(text)) {
    return { motif: 'bars', accent: '#8effd1', glow: '#53f6c3', subtitle: 'Insights Dashboard' };
  }
  if (/dashboard|launcher|code/.test(text)) {
    return { motif: 'grid', accent: '#7bb1ff', glow: '#4f95ff', subtitle: 'App Dashboard' };
  }
  return { motif: 'nodes', accent: '#7bdfff', glow: '#59a8ff', subtitle: card.title };
}

function motifMarkup(kind, accent) {
  if (kind === 'bars') {
    return `
      <g opacity="0.55">
        <rect x="70" y="250" width="36" height="80" fill="${accent}"><animate attributeName="height" values="80;130;80" dur="2.4s" repeatCount="indefinite"/></rect>
        <rect x="120" y="220" width="36" height="110" fill="${accent}"><animate attributeName="height" values="110;70;110" dur="2.1s" repeatCount="indefinite"/></rect>
        <rect x="170" y="200" width="36" height="130" fill="${accent}"><animate attributeName="height" values="130;150;130" dur="2.7s" repeatCount="indefinite"/></rect>
      </g>`;
  }

  if (kind === 'traces') {
    return `
      <g fill="none" stroke="${accent}" stroke-width="2" opacity="0.75">
        <path d="M56 250 C120 200 200 310 270 240 C340 180 430 290 500 240">
          <animate attributeName="stroke-dasharray" values="0 800;120 680;0 800" dur="3s" repeatCount="indefinite"/>
        </path>
        <path d="M56 300 C110 260 190 350 280 290 C350 250 430 320 520 280" opacity="0.6">
          <animate attributeName="stroke-dasharray" values="0 900;140 760;0 900" dur="3.6s" repeatCount="indefinite"/>
        </path>
      </g>`;
  }

  if (kind === 'nodes') {
    return `
      <g stroke="${accent}" stroke-width="2" fill="none" opacity="0.7">
        <path d="M70 290 L150 220 L240 260 L320 190" />
        <circle cx="70" cy="290" r="7" fill="${accent}"><animate attributeName="r" values="7;10;7" dur="1.8s" repeatCount="indefinite"/></circle>
        <circle cx="150" cy="220" r="7" fill="${accent}"><animate attributeName="r" values="7;10;7" begin="0.4s" dur="1.8s" repeatCount="indefinite"/></circle>
        <circle cx="240" cy="260" r="7" fill="${accent}"><animate attributeName="r" values="7;10;7" begin="0.8s" dur="1.8s" repeatCount="indefinite"/></circle>
        <circle cx="320" cy="190" r="7" fill="${accent}"><animate attributeName="r" values="7;10;7" begin="1.2s" dur="1.8s" repeatCount="indefinite"/></circle>
      </g>`;
  }

  return `
    <g stroke="${accent}" stroke-opacity="0.45">
      <path d="M0 60 H800 M0 120 H800 M0 180 H800 M0 240 H800 M0 300 H800" />
      <path d="M80 0 V420 M160 0 V420 M240 0 V420 M320 0 V420 M400 0 V420" />
    </g>`;
}

function makeAnimatedPreview(card) {
  const theme = inferPreviewTheme(card);
  const title = String(card.title || card.name || 'App').replace(/[<>&"']/g, '');
  const subtitle = String(theme.subtitle || card.name).replace(/[<>&"']/g, '');

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="420" viewBox="0 0 800 420" role="img" aria-label="${title} preview">
    <defs>
      <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="#0e1730"/>
        <stop offset="100%" stop-color="#132a57"/>
      </linearGradient>
      <radialGradient id="halo" cx="0.78" cy="0.15" r="0.8">
        <stop offset="0%" stop-color="${theme.glow}" stop-opacity="0.32"/>
        <stop offset="100%" stop-color="${theme.glow}" stop-opacity="0"/>
      </radialGradient>
    </defs>
    <rect width="800" height="420" rx="24" fill="url(#bg)"/>
    <rect width="800" height="420" rx="24" fill="url(#halo)"/>
    ${motifMarkup(theme.motif, theme.accent)}
    <rect x="0" y="40" width="800" height="10" fill="${theme.accent}" opacity="0.22">
      <animate attributeName="y" values="40;360;40" dur="4.6s" repeatCount="indefinite"/>
    </rect>
    <rect x="34" y="30" width="732" height="360" rx="18" fill="none" stroke="${theme.accent}" stroke-opacity="0.32"/>
    <text x="58" y="86" fill="#93a7d1" font-family="Inter, Segoe UI, Arial" font-size="20">dashboard brand preview</text>
    <text x="58" y="152" fill="#e9f1ff" font-family="Inter, Segoe UI, Arial" font-size="44" font-weight="700">${title}</text>
    <text x="58" y="196" fill="#93a7d1" font-family="Inter, Segoe UI, Arial" font-size="28">${subtitle}</text>
  </svg>`;

  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

function normalizeRepo(curatedRepo) {
  const card = {
    name: curatedRepo.name,
    title: curatedRepo.title || curatedRepo.name,
    blurb: curatedRepo.blurb || 'Interactive app published with GitHub Pages.',
    appUrl: curatedRepo.appUrl,
    repoUrl: curatedRepo.repoUrl,
    updatedAt: curatedRepo.updatedAt
  };

  return {
    ...card,
    image: makeAnimatedPreview(card),
    fallbackImage: curatedRepo.image || screenshotImage(OWNER_WITH_CURATED_DATA, curatedRepo.name)
  };
}

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
  const card = {
    name: repo.name,
    title: repo.name,
    blurb: repo.description || 'Interactive app published with GitHub Pages.',
    appUrl: repo.homepage && repo.homepage.trim() ? repo.homepage.trim() : `https://${repo.owner.login}.github.io/${repo.name}/`,
    repoUrl: repoUrl(repo.owner.login, repo.name),
    updatedAt: repo.pushed_at
  };

  return {
    ...card,
    image: makeAnimatedPreview(card),
    fallbackImage: screenshotImage(repo.owner.login, repo.name)
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
usernameInput.addEventListener('keydown', (event) => {
  if (event.key === 'Enter') {
    event.preventDefault();
    loadDashboard();
  }
});
searchInput.addEventListener('input', applyView);
sortSelect.addEventListener('change', applyView);
window.addEventListener('DOMContentLoaded', loadDashboard);
