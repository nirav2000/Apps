import fs from 'node:fs';import {diagnostic,paused,VERSION} from './policy.mjs';import {api,commentStatus,repository} from './github.mjs';
if(!['nirav2000/Apps','nirav2000/Dol'].includes(repository))throw Error('Unexpected repository');
const issues=await api(`/repos/${repository}/issues?state=open&per_page=100`),summary=[];
for(const issue of issues){
 if(issue.pull_request)continue;const d=diagnostic(issue);if(!d)continue;
 if(paused(issue)){summary.push({number:issue.number,status:'paused or review required'});continue;}
 const status=d.known?'queued':'needs-review';
 await commentStatus(repository,issue,status,d.known
  ?`Diagnostic control v${VERSION}: recognised tablet factor-visibility regression. Queued for an exact reproduction, narrow CSS recipe, full regression suite and deployed Chromium/WebKit checks. This issue remains open until deployment is verified.`
  :`Diagnostic control v${VERSION}: investigation complete. ${d.owner?'No familiar, independently tested recipe matches this report.':'The report was not created by the authorised owner.'} Human review is required. No app code or learner data was changed. Target: ${d.target||'unrecognised'}.`);
 summary.push({number:issue.number,target:d.target,status});
}
fs.mkdirSync('artifacts',{recursive:true});fs.writeFileSync('artifacts/diagnostic-triage.json',JSON.stringify({version:VERSION,checkedAt:new Date().toISOString(),repository,issues:summary},null,2));
console.log(JSON.stringify(summary));
