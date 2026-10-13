import fs from 'node:fs';import {diagnostic,paused,RECIPE,VERSION} from './policy.mjs';import {api,repository} from './github.mjs';
if(repository!=='nirav2000/Dol')throw Error('Recipe is Dol-only');
let selected=null;
for(const origin of ['nirav2000/Apps','nirav2000/Dol']){
 const issues=await api(`/repos/${origin}/issues?state=open&per_page=100`);
 for(const issue of issues){if(issue.pull_request||paused(issue)||!diagnostic(issue)?.known)continue;
  const key=origin.split('/')[1]+'-'+issue.number;
  if(fs.existsSync(`docs/diagnostics/${key}.json`))continue;
  const runs=await api(`/repos/${repository}/actions/workflows/diagnostic-autofix.yml/runs?per_page=30`);
  let failures=0;
  for(const run of runs.workflow_runs.filter(r=>r.conclusion==='failure')){
   const jobs=await api(`/repos/${repository}/actions/runs/${run.id}/jobs`);
   if(jobs.jobs.some(j=>j.name===`Diagnostic ${key}`&&j.conclusion==='failure'))failures++;
  }
  if(failures>=2){console.log(`Retry limit reached for ${key}; review required`);continue;}
  selected={origin,number:issue.number,key,recipe:RECIPE,version:VERSION};break;
 }if(selected)break;
}
fs.mkdirSync('artifacts',{recursive:true});fs.writeFileSync('artifacts/diagnostic-plan.json',JSON.stringify(selected,null,2));
if(process.env.GITHUB_OUTPUT)fs.appendFileSync(process.env.GITHUB_OUTPUT,`selected=${!!selected}\nkey=${selected?.key||'none'}\n`);
console.log(selected?`Selected ${selected.key}: ${RECIPE}`:'No eligible familiar diagnostics.');
