export function pwaStyles(){
  return '.apps-pwa-status{display:grid;gap:8px;padding:12px;border:1px solid #dfe6eb;border-radius:12px;background:#f8fafb}.apps-pwa-row{display:flex;justify-content:space-between;gap:12px}.apps-pwa-badge{padding:4px 8px;border-radius:999px;background:#eef3f7;font-size:12px}.apps-pwa-badge.ok{background:#e9f8ef;color:#166534}.apps-pwa-badge.warn{background:#fff5df;color:#8a4b00}.apps-pwa-help{margin:0;color:#66727d;font-size:13px}';
}
export async function mountPWAStatus(root,{readiness}={}){
  const r=readiness||{};
  root.innerHTML='<section class="apps-pwa-status"><div class="apps-pwa-row"><strong>PWA status</strong><span class="apps-pwa-badge"></span></div><p class="apps-pwa-help"></p></section>';
  const badge=root.querySelector('.apps-pwa-badge'),help=root.querySelector('.apps-pwa-help');
  if(r.status==='ready'){badge.textContent=r.standalone?'Installed':'PWA ready';badge.classList.add('ok');help.textContent=r.standalone?'Running as an installed web app.':'This app is installable. Add it to the Home Screen for the full app experience.'}
  else if(r.status==='install-required'){badge.textContent='Install required';badge.classList.add('warn');help.textContent='On iPhone/iPad, use Safari Share → Add to Home Screen, then launch the app from the new icon.'}
  else{badge.textContent='Setup required';badge.classList.add('warn');help.textContent='Manifest or service-worker setup is incomplete.'}
  return r;
}
