import fs from 'node:fs';import {execFileSync} from 'node:child_process';import {diagnostic,allowedChanges,paused} from './policy.mjs';import {api,commentStatus,issuePath,repository} from './github.mjs';
const issues=await api(`/repos/${repository}/issues?state=open&per_page=100`);
for(const issue of issues){
 if(issue.pull_request||paused(issue)||!diagnostic(issue)?.known)continue;
 const key=repository.split('/')[1]+'-'+issue.number;
 const raw=await api(`/repos/nirav2000/Dol/contents/docs/diagnostics/${key}.json?ref=main`,{optional:true});
 if(!raw){
  const runs=await api('/repos/nirav2000/Dol/actions/workflows/diagnostic-autofix.yml/runs?per_page=30',{optional:true});
  if(!runs)continue;
  let failures=0,active=false;
  for(const run of runs.workflow_runs){
   const jobs=await api(`/repos/nirav2000/Dol/actions/runs/${run.id}/jobs`);
   for(const j of jobs.jobs.filter(j=>j.name===`Diagnostic ${key}`)){if(j.conclusion==='failure')failures++;if(j.status!=='completed')active=true;}
  }
  if(failures>=2)await commentStatus(repository,issue,'needs-review','Two bounded automated attempts failed. Review is required; no automatic retries until the cause is reviewed. Actions: https://github.com/nirav2000/Dol/actions/workflows/diagnostic-autofix.yml');
  else if(active)await commentStatus(repository,issue,'testing','The Dol worker is reproducing the report and running gated regression checks. This issue remains open.');
  continue;
 }
 let e;try{e=JSON.parse(Buffer.from(raw.content,'base64').toString());}catch{throw Error('Invalid deployment receipt');}
 if(e.issueRepository!==repository||e.issueNumber!==issue.number||e.status!=='verified'||!/^\d+\.\d+\.\d+$/.test(e.version)||!Number.isSafeInteger(e.workflowRun)||!/^([a-f0-9]{40})$/.test(e.commit)||!/^([a-f0-9]{40})$/.test(e.baseCommit)||!e.regressionTestsPassed||!e.baselineReproduced||e.liveCases?.length!==12||!e.liveCases.every(c=>c.allPairsVisible&&c.actionPreserved&&c.learningPreserved))throw Error('Incomplete deployment evidence');
 const run=await api(`/repos/nirav2000/Dol/actions/runs/${e.workflowRun}`);
 if(run.status!=='completed')continue;
 if(run.conclusion!=='success'||run.path!=='.github/workflows/diagnostic-autofix.yml'||run.head_sha!==e.baseCommit)throw Error('Fix workflow did not succeed against recorded baseline');
 const changed=await api(`/repos/nirav2000/Dol/compare/${e.baseCommit}...${e.commit}`);
 if(!allowedChanges(changed.files.map(f=>f.filename)))throw Error('Deployment exceeded approved file scope');
 await commentStatus(repository,issue,'deployed',`Dol v${e.version} deployed at https://nirav2000.github.io/Dol/ . Source: https://github.com/nirav2000/Dol/commit/${e.commit} . Successful gated run: ${run.html_url} . Running an independent deployed browser verification before resolving.`);
 const live=await fetch('https://nirav2000.github.io/Dol/version.json?diagnostic='+e.commit,{signal:AbortSignal.timeout(30000)});if(!live.ok||(await live.json()).version!==e.version)continue;
 execFileSync('node',['tests/diagnostic-25-browser.mjs'],{cwd:process.env.DOL_CHECKOUT||'Dol-target',env:{...process.env,TEST_BASE_URL:`https://nirav2000.github.io/Dol/?verified=${e.commit}`},stdio:'inherit',timeout:240000});
 fs.mkdirSync('artifacts',{recursive:true});fs.copyFileSync((process.env.DOL_CHECKOUT||'Dol-target')+'/artifacts/issue25-browser.json',`artifacts/${key}-independent-live.json`);
 await commentStatus(repository,issue,'verified',`Verified Dol v${e.version}, commit ${e.commit}. Both Chromium and WebKit passed phone (390×844), tablet portrait (834×1194), tablet landscape (1210×675), Classic and Pair Board: all four factor pairs visible, action key position preserved, learner evidence unchanged. Source workflow: ${run.html_url} . Independent verification: https://github.com/${repository}/actions/runs/${process.env.GITHUB_RUN_ID} . Evidence: https://github.com/nirav2000/Dol/blob/main/docs/diagnostics/${key}.json .`);
 await api(issuePath(repository,issue.number),{method:'PATCH',body:{state:'closed',state_reason:'completed'}});
}
