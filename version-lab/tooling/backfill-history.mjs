#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const root=process.cwd();
const toolDir=path.dirname(fileURLToPath(import.meta.url));
const planPath=process.env.VERSION_LAB_BACKFILL_PLAN||path.join(root,'version-lab-backfill-plan.json');
if(!fs.existsSync(planPath)){
  const plan=execFileSync('node',[path.join(toolDir,'plan-backfill.mjs')],{encoding:'utf8'});
  fs.writeFileSync(planPath,plan+'\n');
}
const plan=JSON.parse(fs.readFileSync(planPath,'utf8'));
for(const cp of plan.checkpoints||[]){
  const env={...process.env,
    VERSION_LAB_SOURCE_REF:cp.sha,
    VERSION_LAB_TITLE:cp.suggestedTitle||('Historical '+cp.sha.slice(0,8)),
    VERSION_LAB_SUMMARY:cp.suggestedSummary||'Reconstructed historical checkpoint from Git history.',
    VERSION_LAB_AREAS:(cp.areas||[]).join('|'),
    VERSION_LAB_CHECKPOINT:'vl-historical-'+(cp.date||'unknown')+'-'+cp.sha.slice(0,8)
  };
  execFileSync('node',[path.join(toolDir,'capture-release.mjs')],{stdio:'inherit',env});
}
const head=execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim();
const env={...process.env,
  VERSION_LAB_TITLE:process.env.VERSION_LAB_BASELINE_TITLE||'Version Lab adoption baseline',
  VERSION_LAB_SUMMARY:process.env.VERSION_LAB_BASELINE_SUMMARY||'Baseline checkpoint created when the shared Version Lab was installed and future checkpoint management became shared.',
  VERSION_LAB_AREAS:'Version Lab adoption::platform::Shared Version Lab management enabled',
  VERSION_LAB_CHECKPOINT:'vl-adoption-'+new Date().toISOString().slice(0,10)+'-'+head.slice(0,8)
};
execFileSync('node',[path.join(toolDir,'capture-release.mjs')],{stdio:'inherit',env});
console.log('Historical backfill complete. Review '+path.relative(root,planPath)+' before deleting it.');
