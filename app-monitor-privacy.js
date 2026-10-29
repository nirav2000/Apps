// Authenticated repository privacy register UI for App Monitor.
// Only public HTML/JS lives here: private inventory and reviews are delivered by the protected Worker.
const API = 'https://apps-monitor-api.nirav2000-github.workers.dev/app-monitor/repository-privacy';
const SESSION_KEY = 'app-monitor.admin-session.v2';
const fields = {
  exposureRisk: [['unassessed', 'Unassessed'], ['low', 'Low'], ['medium', 'Medium'], ['high', 'High'], ['critical', 'Critical']],
  pagesPlan: [['unreviewed', 'Not reviewed'], ['migration-needed', 'Migration required'], ['not-needed', 'Not needed'], ['resolved', 'Publishing resolved']],
  sharedLibraries: [['unreviewed', 'Not reviewed'], ['consumer', 'Consumer'], ['provider', 'Provider'], ['both', 'Provider & consumer'], ['none', 'None']],
  secretsAudit: [['not-started', 'Not started'], ['in-progress', 'In progress'], ['passed', 'Passed'], ['findings', 'Findings']],
  migrationReadiness: [['not-reviewed', 'Not reviewed'], ['blocked', 'Blocked'], ['in-progress', 'In progress'], ['ready', 'Ready for approval'], ['complete', 'Migrated'], ['deferred', 'Keep public / defer']]
};
const htmlEscape = v => String(v ?? '').replace(/[&<>"']/g, ch => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[ch]));
const display = v => String(v ?? '').replace(/-/g, ' ');
const option = ([value, label], selected) => '<option value="' + htmlEscape(value) + '"' + (selected === value ? ' selected' : '') + '>' + htmlEscape(label) + '</option>';
const csvCell = v => {
  let x = String(v ?? '');
  if (/^\s*[=+@\-]/.test(x) || /^[\t\r]/.test(x)) x = "'" + x;
  return '"' + x.replace(/"/g, '""') + '"';
};
function token() {
  try { return JSON.parse(localStorage.getItem(SESSION_KEY) || 'null')?.token || ''; }
  catch { return ''; }
}
const formatStatus = (value, choices) => choices?.find(([id]) => id === value)?.[1] || display(value);
const find = (root, id) => root.querySelector('#' + id);

export function mountRepositoryPrivacy(root) {
  if (!root) return;
  let all = [], selected = '', pending = false, coverage = 'public-only';
  root.innerHTML = `
    <div class="top">
      <div><h2>Repository privacy register</h2><p class="muted small">Private-by-default for new apps. Existing repository visibility is unchanged until you explicitly approve a migration.</p></div>
      <div class="controls">
        <button type="button" id="privacyRefresh">Refresh repositories</button>
        <button type="button" id="privacyExport" disabled>Export CSV</button>
      </div>
    </div>
    <p id="privacyStatus" class="muted small" role="status" aria-live="polite">Sign in with your App Monitor passkey to inspect repository exposure.</p>
    <div id="privacySummary" class="privacy-summary"></div>
    <div class="privacy-filters" aria-label="Filter repository privacy">
      <label>Search <input id="privacySearch" type="search" placeholder="Repository, risk or dependency"></label>
      <label>Visibility <select id="privacyVisibility"><option value="all">All</option><option value="public">Public</option><option value="private">Private</option></select></label>
      <label>Exposure <select id="privacyRisk"><option value="all">All</option>${fields.exposureRisk.map(x => option(x)).join('')}</select></label>
      <label>Pages <select id="privacyPages"><option value="all">All</option><option value="yes">Pages enabled</option><option value="no">Not detected</option></select></label>
      <label>Audit <select id="privacyAudit"><option value="all">All</option>${fields.secretsAudit.map(x => option(x)).join('')}</select></label>
      <label>Readiness <select id="privacyReadiness"><option value="all">All</option>${fields.migrationReadiness.map(x => option(x)).join('')}</select></label>
    </div>
    <div class="table-wrap"><table class="table privacy-table"><thead><tr>
      <th>Repository</th><th>Visibility</th><th>Exposure</th><th>Pages</th><th>Shared libraries</th>
      <th>Secrets audit</th><th>Migration</th><th>Recommended next step</th><th></th>
    </tr></thead><tbody id="privacyRows"></tbody></table></div>
    <p id="privacyFootnote" class="muted small">Private repository names and review notes never appear in the public static build.</p>
    <div id="privacyDetail" class="privacy-detail" hidden></div>
  `;
  const E = Object.fromEntries(['privacyRefresh', 'privacyExport', 'privacyStatus', 'privacySummary', 'privacySearch', 'privacyVisibility', 'privacyRisk', 'privacyPages', 'privacyAudit', 'privacyReadiness', 'privacyRows', 'privacyFootnote', 'privacyDetail'].map(id => [id, find(root, id)]));
  const isUnlocked = () => !root.closest('#protectedApp')?.hasAttribute('inert');
  function filtered() {
    const q = E.privacySearch.value.trim().toLowerCase();
    return all.filter(row =>
      (!q || [row.fullName, row.exposureRisk, row.pagesDependencies, row.sharedLibraryDetails, row.notes, row.nextStep].join(' ').toLowerCase().includes(q)) &&
      (E.privacyVisibility.value === 'all' || row.visibility === E.privacyVisibility.value) &&
      (E.privacyRisk.value === 'all' || row.exposureRisk === E.privacyRisk.value) &&
      (E.privacyPages.value === 'all' || row.hasPages === (E.privacyPages.value === 'yes')) &&
      (E.privacyAudit.value === 'all' || row.secretsAudit === E.privacyAudit.value) &&
      (E.privacyReadiness.value === 'all' || row.migrationReadiness === E.privacyReadiness.value));
  }
  function render() {
    const showing = filtered();
    const total = all.length, publics = all.filter(r => r.visibility === 'public').length;
    const privates = all.filter(r => r.visibility === 'private').length;
    const high = all.filter(r => ['high', 'critical'].includes(r.exposureRisk) || r.secretsAudit === 'findings').length;
    const unassessed = all.filter(r => r.exposureRisk === 'unassessed').length;
    const awaiting = all.filter(r => r.secretsAudit !== 'passed').length;
    const pages = all.filter(r => r.hasPages).length;
    const metrics = [
      [total, 'Visible repositories'], [publics, 'Public'], [privates, 'Private'],
      [pages, 'Pages enabled'], [unassessed, 'Risk unassessed'], [high, 'Flagged risk'], [awaiting, 'Audit pending / findings']
    ];
    E.privacySummary.innerHTML = metrics.map(([n, name]) => '<div class="privacy-metric"><strong>' + n + '</strong><span>' + htmlEscape(name) + '</span></div>').join('');
    E.privacyRows.innerHTML = showing.map(row => {
      const risk = row.exposureRisk === 'critical' || row.exposureRisk === 'high' ? ' privacy-risk-high' : '';
      return '<tr><td><a href="' + htmlEscape(row.url) + '" target="_blank" rel="noopener noreferrer">' + htmlEscape(row.name) + '</a>' + (row.archived ? '<div class="muted">Archived</div>' : '') + '</td>' +
        '<td>' + htmlEscape(display(row.visibility)) + '</td>' +
        '<td class="' + risk.trim() + '">' + htmlEscape(formatStatus(row.exposureRisk, fields.exposureRisk)) + '</td>' +
        '<td>' + (row.hasPages ? 'Enabled' : 'Not detected') + '<div class="muted">' + htmlEscape(formatStatus(row.pagesPlan, fields.pagesPlan)) + '</div></td>' +
        '<td>' + htmlEscape(formatStatus(row.sharedLibraries, fields.sharedLibraries)) + '</td>' +
        '<td>' + htmlEscape(formatStatus(row.secretsAudit, fields.secretsAudit)) + '</td>' +
        '<td>' + htmlEscape(formatStatus(row.migrationReadiness, fields.migrationReadiness)) + '</td>' +
        '<td>' + htmlEscape(row.nextStep) + '</td>' +
        '<td><button type="button" data-privacy-review="' + htmlEscape(row.fullName) + '">Review</button></td></tr>';
    }).join('') || '<tr><td colspan="9" class="muted">No repositories match these filters.</td></tr>';
    for (const button of E.privacyRows.querySelectorAll('[data-privacy-review]')) button.addEventListener('click', () => openReview(button.dataset.privacyReview));
    E.privacyExport.disabled = !showing.length;
    E.privacyFootnote.textContent = showing.length + ' matching repositories. ' +
      (coverage === 'public-only'
        ? 'Public-only inventory: configure a read-only GitHub token on the App Monitor Worker to include private repositories. Totals are incomplete.'
        : 'Token-scoped inventory: confirm the GitHub token is authorised for all repositories, including new private ones.') +
      ' Risk and audit values are review statuses, not automated security-scan results.';
  }
  function openReview(fullName) {
    const row = all.find(r => r.fullName === fullName);
    if (!row) return;
    selected = fullName;
    const select = (id, label, value) => '<label>' + label + '<select name="' + id + '">' + fields[id].map(x => option(x, value)).join('') + '</select></label>';
    E.privacyDetail.hidden = false;
    E.privacyDetail.innerHTML = '<div class="top"><div><h3>Review ' + htmlEscape(row.fullName) + '</h3><p class="muted small">Visibility is read-only here. This review does not modify GitHub permissions, Pages, secrets or deployments.</p></div><button type="button" id="privacyClose">Close</button></div>' +
      '<form id="privacyForm"><div class="privacy-editor">' +
      select('exposureRisk', 'Exposure risk', row.exposureRisk) +
      select('pagesPlan', 'GitHub Pages migration', row.pagesPlan) +
      select('sharedLibraries', 'Shared-library role', row.sharedLibraries) +
      select('secretsAudit', 'Secrets audit', row.secretsAudit) +
      select('migrationReadiness', 'Migration readiness', row.migrationReadiness) +
      '<label class="privacy-editor-wide">Pages dependencies / live routes<textarea name="pagesDependencies" maxlength="1000" rows="2" placeholder="Deployment workflow, public URL, service worker and route dependencies">' + htmlEscape(row.pagesDependencies || '') + '</textarea></label>' +
      '<label class="privacy-editor-wide">Shared-library dependencies<textarea name="sharedLibraryDetails" maxlength="1000" rows="2" placeholder="apps-auth.js, shared validation, Version Labs, notifications...">' + htmlEscape(row.sharedLibraryDetails || '') + '</textarea></label>' +
      '<label class="privacy-editor-wide">Security findings, migration blockers and review notes<textarea name="notes" maxlength="2400" rows="3" placeholder="What has been checked, evidence and outstanding dependencies">' + htmlEscape(row.notes || '') + '</textarea></label>' +
      '</div><div class="controls"><button class="primary" type="submit" id="privacySave">Save protected review</button><span id="privacySaveStatus" class="muted small">' + (row.reviewedAt ? 'Last reviewed ' + htmlEscape(new Date(row.reviewedAt).toLocaleString('en-GB')) : 'Not reviewed yet') + '</span></div></form>';
    find(E.privacyDetail, 'privacyClose').onclick = () => { E.privacyDetail.hidden = true; selected = ''; };
    find(E.privacyDetail, 'privacyForm').addEventListener('submit', saveReview);
    E.privacyDetail.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }
  async function saveReview(event) {
    event.preventDefault();
    if (pending || !selected) return;
    const form = event.currentTarget;
    const patch = Object.fromEntries([...new FormData(form)].map(([key, value]) => [key, String(value)]));
    pending = true;
    const button = find(E.privacyDetail, 'privacySave'), status = find(E.privacyDetail, 'privacySaveStatus');
    button.disabled = true; status.textContent = 'Saving to private App Monitor storage…';
    try {
      const r = await fetch(API, {
        method: 'POST',
        headers: { 'X-App-Monitor-Session': token(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ repository: selected, patch }),
        cache: 'no-store'
      });
      if (!r.ok) throw Error('Review not saved (' + r.status + ')');
      const fullName = selected;
      await refresh();
      openReview(fullName);
      find(E.privacyDetail, 'privacySaveStatus').textContent = 'Saved securely at ' + new Date().toLocaleTimeString('en-GB');
    } catch (error) {
      status.textContent = error.message;
      button.disabled = false;
    } finally { pending = false; }
  }
  async function refresh() {
    if (!isUnlocked() || !token()) return;
    E.privacyRefresh.disabled = true;
    E.privacyStatus.textContent = 'Loading authenticated GitHub repository inventory…';
    try {
      const response = await fetch(API, { headers: { 'X-App-Monitor-Session': token() }, cache: 'no-store' });
      if (!response.ok) {
        if (response.status === 401) throw Error('App Monitor administrator session expired. Sign in again.');
        if (response.status === 403) throw Error('A passkey sign-in is required to view the privacy register.');
        throw Error('Repository inventory unavailable (' + response.status + ')');
      }
      const body = await response.json();
      if (!isUnlocked() || !token()) return;
      all = Array.isArray(body.repositories) ? body.repositories : [];
      coverage = body.coverage;
      E.privacyStatus.textContent = 'Refreshed ' + new Date().toLocaleTimeString('en-GB') + ' · ' +
        (coverage === 'public-only' ? 'Public GitHub data only — private repositories not yet included' : 'Private and public GitHub repositories within token scope');
      render();
    } catch (error) {
      if (isUnlocked()) E.privacyStatus.textContent = error.message;
      if (!all.length) E.privacyRows.replaceChildren();
    } finally { E.privacyRefresh.disabled = false; }
  }
  function clear() {
    all = []; selected = ''; coverage = 'public-only';
    E.privacyStatus.textContent = 'Sign in with your passkey to load the protected repository register.';
    E.privacySummary.replaceChildren(); E.privacyRows.replaceChildren();
    E.privacyDetail.hidden = true; E.privacyExport.disabled = true;
  }
  E.privacyRefresh.onclick = refresh;
  for (const element of [E.privacySearch, E.privacyVisibility, E.privacyRisk, E.privacyPages, E.privacyAudit, E.privacyReadiness]) element.addEventListener('input', render);
  E.privacyExport.onclick = () => {
    if (!all.length || !isUnlocked()) return;
    const cols = ['fullName', 'visibility', 'exposureRisk', 'hasPages', 'pagesPlan', 'pagesDependencies', 'sharedLibraries', 'sharedLibraryDetails', 'secretsAudit', 'migrationReadiness', 'nextStep', 'reviewedAt', 'notes'];
    const content = [cols.map(csvCell).join(','), ...filtered().map(row => cols.map(key => csvCell(row[key])).join(','))].join('\r\n');
    const url = URL.createObjectURL(new Blob([content], { type: 'text/csv;charset=utf-8' }));
    const a = document.createElement('a'); a.href = url; a.download = 'app-monitor-repository-privacy.csv'; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 3000);
  };
  window.addEventListener('app-monitor-privacy-auth', event => {
    if (event.detail?.authenticated) refresh();
    else clear();
  });
  if (isUnlocked() && token()) refresh();
}
if (typeof document !== 'undefined') mountRepositoryPrivacy(document.getElementById('repositoryPrivacy'));
