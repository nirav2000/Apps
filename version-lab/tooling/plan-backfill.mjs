#!/usr/bin/env node
import {execFileSync} from 'node:child_process';

const max=Number(process.env.VERSION_LAB_BACKFILL_MAX||12);
const raw=execFileSync('git',['log','--date=short','--pretty=format:%H%x09%ad%x09%s','--reverse'],{encoding:'utf8'});
const rows=raw.split(/\r?\n/).filter(Boolean).map(line=>{const [sha,date,...rest]=line.split('\t');return {sha,date,subject:rest.join('\t')}});
const tagRaw=execFileSync('git',['tag','--sort=creatordate','--format=%(objectname)%09%(refname:short)'],{encoding:'utf8'}).trim();
const tags=new Map((tagRaw?tagRaw.split(/\r?\n/):[]).map(line=>{const [sha,tag]=line.split('\t');return [sha,tag]}));
const important=/\b(release|version|v\d|launch|redesign|migrat|firebase|auth|database|schema|major|ui|workflow|snapshot|version lab)\b/i;
const scored=rows.map((r,i)=>({...r,tag:tags.get(r.sha)||'',score:(tags.has(r.sha)?100:0)+(important.test(r.subject)?30:0)+(i===0?20:0)+(i===rows.length-1?20:0)}));
const chosen=[];
for(const r of scored.filter(x=>x.score>0))chosen.push(r);
if(chosen.length<max&&rows.length){
  const step=Math.max(1,Math.floor(rows.length/Math.max(1,max-chosen.length+1)));
  for(let i=0;i<rows.length&&chosen.length<max;i+=step)if(!chosen.some(x=>x.sha===rows[i].sha))chosen.push({...rows[i],score:5});
}
if(!chosen.some(x=>x.sha===rows.at(-1)?.sha)&&rows.length)chosen.push({...rows.at(-1),score:20});
const final=[...new Map(chosen.map(x=>[x.sha,x])).values()].sort((a,b)=>rows.findIndex(r=>r.sha===a.sha)-rows.findIndex(r=>r.sha===b.sha)).slice(-max);
process.stdout.write(JSON.stringify({generatedAt:new Date().toISOString(),totalCommits:rows.length,max,checkpoints:final.map((r,i)=>({
  sha:r.sha,date:r.date,tag:r.tag||null,
  suggestedTitle:r.tag?('Historical '+r.tag):r.subject,
  suggestedSummary:'Reconstructed historical checkpoint from Git history.',
  areas:[],
  order:i+1
}))},null,2));
