// Only owner-created, structured diagnostics can enter the automatic recipe queue.
// Text is data: never use it as code, shell input, a file path or an agent prompt.
export const VERSION='1.0.1';
export const RECIPE='tablet-factor-visibility-v1';
export function diagnostic(issue){
 const b=String(issue.body||'');
 if(!b.includes('UI diagnostic report')||!b.includes('Element: UI diagnostics (diagnostics-report)'))return null;
 const target=b.match(/^Target repository: (nirav2000\/(?:Apps|Dol))\s*$/m)?.[1];
 const app=b.match(/^App: (dol|app-monitor)\s*$/m)?.[1];
 return {target,app,owner:issue.user?.login==='nirav2000',known:issue.user?.login==='nirav2000'&&target==='nirav2000/Dol'&&app==='dol'&&/Profile: tablet; layout: classic; palette: slate; mode: timed/.test(b)&&/Visual viewport: 1210 x 675 CSS px/.test(b)&&/Round phase: finished; target: 231; pairs: 3 \/ 4/.test(b)&&/\[measured\] covered \/ pair-3/.test(b)&&/\[measured\] outside-viewport \/ target/.test(b)};
}
export function allowedChanges(paths){return paths.length>0&&paths.every(p=>['ui/pairboard-tablet.css','version.json','index.html','service-worker.js'].includes(p));}
export function nextPatch(version){if(!/^\d+\.\d+\.\d+$/.test(version))throw Error('Invalid product version');const n=version.split('.').map(Number);n[2]++;return n.join('.');}
export function labelsOf(issue){return (issue.labels||[]).map(l=>typeof l==='string'?l:l.name);}
export function paused(issue){return labelsOf(issue).some(l=>['diagnostic:paused','diagnostic:needs-review'].includes(l));}
