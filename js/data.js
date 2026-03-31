import { APP_SPECIFIC_PREVIEWS, OWNER_WITH_CURATED_DATA } from './constants.js';

const repoUrl = (owner, repo) => `https://github.com/${owner}/${repo}`;
const screenshotFromUrl = (url) => `https://image.thum.io/get/width/1200/crop/700/noanimate/${url}`;
const screenshotImage = (owner, repo) => screenshotFromUrl(`https://${owner}.github.io/${repo}/`);

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

export async function fetchCuratedAppsData() {
  const response = await fetch('apps-data.json', { headers: { Accept: 'application/json' } });
  if (!response.ok) {
    throw new Error(`Unable to load apps-data.json (${response.status}).`);
  }

  const data = await response.json();
  return data.map(normalizeRepo);
}

export async function fetchAllRepos(username, endpointType = 'users') {
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

export function toGenericCard(repo) {
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
