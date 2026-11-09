// Uses the existing App Monitor passkey and server session; never fetch private Biz data in the public page.
const API = 'https://apps-monitor-api.nirav2000-github.workers.dev/app-monitor';
const SESSION_STORE = 'app-monitor.admin-session.v2';
const $ = id => document.getElementById(id);
const E = {
  login: $('bizLogin'), loginButton: $('bizPasskeyBtn'), loginMessage: $('bizLoginMessage'),
  unlocked: $('bizUnlocked'), authState: $('bizAuthState'),
  status: $('bizSourceStatus'), cards: $('bizCards'),
  refresh: $('bizRefresh'), logout: $('bizLogout')
};
const Auth = window.AppsPasskeyAuth;
const auth = Auth?.create({ baseUrl: API, sessionStoreKey: SESSION_STORE });

function lock(message) {
  E.unlocked.hidden = true;
  E.login.hidden = false;
  E.authState.textContent = 'Passkey required';
  E.authState.classList.remove('authenticated');
  E.cards.replaceChildren();
  E.status.textContent = '';
  E.loginMessage.textContent = message || 'Private app details are hidden until you sign in.';
}

function unlock() {
  E.login.hidden = true;
  E.unlocked.hidden = false;
  E.authState.textContent = 'Passkey verified';
  E.authState.classList.add('authenticated');
}

function addLink(parent, url, label) {
  const a = document.createElement('a');
  a.href = url;
  a.target = '_blank';
  a.rel = 'noopener noreferrer';
  a.textContent = label;
  parent.appendChild(a);
}

function renderApps(apps) {
  E.cards.replaceChildren();
  if (!apps.length) {
    E.status.textContent = 'No Biz applications are registered yet.';
    return;
  }
  const ordered = [...apps].sort((a, b) => {
    const priority = { published: 0, development: 1, private: 2 };
    return (priority[a.status] ?? 3) - (priority[b.status] ?? 3) || a.title.localeCompare(b.title);
  });
  for (const app of ordered) {
    const card = document.createElement('article');
    card.className = 'biz-card';
    const status = document.createElement('span');
    status.className = 'biz-card-status ' + app.status;
    status.textContent = app.status === 'published' ? 'Published' :
      app.status === 'development' ? 'In development · private' : 'Private prototype';
    const title = document.createElement('h3');
    title.textContent = app.title;
    const summary = document.createElement('p');
    summary.textContent = app.summary;
    const links = document.createElement('div');
    links.className = 'biz-card-links';
    if (app.status === 'published' && app.liveUrl) addLink(links, app.liveUrl, 'Open live app');
    addLink(links, app.sourceUrl, 'View private source');
    card.append(status, title, summary, links);
    E.cards.appendChild(card);
  }
}

async function loadCatalog() {
  E.refresh.disabled = true;
  E.status.textContent = 'Checking private Biz app catalogue…';
  try {
    const response = await fetch(API + '/apps-catalog', {
      headers: auth.authHeaders(), cache: 'no-store'
    });
    if (response.status === 401 || response.status === 403) {
      auth.clearCached();
      lock('Your passkey session has expired. Sign in again.');
      return;
    }
    const result = await response.json().catch(() => ({}));
    if (!response.ok) {
      E.cards.replaceChildren();
      E.status.textContent = result.error || 'Private Biz app catalogue is unavailable.';
      return;
    }
    if (!result.ok || !Array.isArray(result.apps)) throw new Error('Invalid catalogue response');
    renderApps(result.apps);
    E.status.textContent = 'Biz · ' + result.apps.length + ' registered ' +
      (result.apps.length === 1 ? 'application' : 'applications') + ' · checked ' +
      new Date(result.checkedAt).toLocaleString('en-GB');
  } catch {
    E.cards.replaceChildren();
    E.status.textContent = 'Could not reach the protected Biz catalogue. Check the App Monitor Worker deployment.';
  } finally {
    E.refresh.disabled = false;
  }
}

async function signIn() {
  if (!auth || !window.PublicKeyCredential) {
    E.loginMessage.textContent = 'Passkeys are not available in this browser.';
    return;
  }
  E.loginButton.disabled = true;
  E.loginMessage.textContent = 'Confirm the passkey with your device or password manager…';
  try {
    const session = await auth.passkeyLogin();
    if (session.method && session.method !== 'passkey') throw new Error('A passkey session is required');
    unlock();
    await loadCatalog();
  } catch (error) {
    lock(error?.name === 'NotAllowedError'
      ? 'Passkey sign-in was cancelled.'
      : 'Could not sign in: ' + String(error?.message || error));
  } finally {
    E.loginButton.disabled = false;
  }
}

async function restore() {
  if (!auth) return lock('Passkey authentication is unavailable. Reload the page.');
  const session = auth.restoreSession();
  if (!session) return lock();
  try {
    const verified = await auth.validateSession();
    if (!verified) return lock('Your previous session has expired. Sign in again.');
    if (verified.method !== 'passkey') {
      return lock('A passkey is required for the private Biz catalogue. Sign in with your passkey.');
    }
    unlock();
    await loadCatalog();
  } catch {
    lock('Could not verify the previous passkey session. Try signing in again.');
  }
}

E.loginButton.addEventListener('click', signIn);
E.refresh.addEventListener('click', loadCatalog);
E.logout.addEventListener('click', async () => {
  E.logout.disabled = true;
  try { await auth.logout(); }
  catch { auth.clearCached(); }
  finally {
    E.logout.disabled = false;
    lock('Signed out of Apps and the shared App Monitor administrator session.');
  }
});
window.addEventListener('storage', event => {
  if (event.key === SESSION_STORE) {
    if (event.newValue) restore();
    else lock('Signed out in another tab.');
  }
});
restore();
