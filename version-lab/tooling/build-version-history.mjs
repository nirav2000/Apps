#!/usr/bin/env node
// Generate a complete Version Lab index from the released Git version history.
// This runs only in Dol's already-tested Pages deployment. It does not change
// production app code, publish new checkpoints, or modify Git history.
import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';

const root=process.cwd();
const config=JSON.parse(fs.readFileSync(path.join(root,'.version-lab.json'),'utf8'));
const manifestPath=path.join(root,'version-lab-data/releases.json');
const current=JSON.parse(fs.readFileSync(path.join(root,config.productVersionFile||'version.json'),'utf8'));
const version=String(current.version||'').trim();
if(!/^\d+\.\d+\.\d+$/.test(version))throw Error('Invalid current version: '+version);
const git=(...args)=>execFileSync('git',args,{cwd:root,encoding:'utf8',maxBuffer:8*1024*1024}).trim();
const currentCommit=git('rev-parse','HEAD');
const currentDate=git('show','-s','--format=%cI','HEAD');
const records=new Map();
const history=git('log','--format=%H%x09%cI%x09%s','--',config.productVersionFile||'version.json');
for(const line of history.split('\n')){
  if(!line.trim())continue;
  const [sha,date,...summary]=line.split('\t');
  if(!/^[a-f0-9]{40}$/i.test(sha))continue;
  let metadata;
  try{metadata=JSON.parse(git('show',sha+':'+(config.productVersionFile||'version.json')))}catch{continue}
  const v=String(metadata.version||'').trim();
  if(!/^\d+\.\d+\.\d+$/.test(v)||records.has(v))continue;
  records.set(v,{sha,date,description:String(metadata.description||'').trim(),subject:summary.join('\t')});
}
if(!records.has(version))throw Error('The deployed version '+version+' has no recorded Git revision');
let manifest={schemaVersion:1,appId:config.appId,repository:config.repository,liveUrl:config.liveUrl,releases:[]};
if(fs.existsSync(manifestPath))manifest=JSON.parse(fs.readFileSync(manifestPath,'utf8'));
const existing=Array.isArray(manifest.releases)?manifest.releases:[];
const historicVersions=new Set(existing.map(r=>r.productVersion).filter(Boolean));
const knownCommits=new Set(existing.map(r=>r.commit).filter(Boolean));
function asRelease(v,row,{isCurrent=false}={}){
  const sha=isCurrent?currentCommit:row.sha;
  const date=isCurrent?currentDate:row.date;
  return {
    checkpointId:'git-version-'+v+'-'+sha.slice(0,8),
    appId:config.appId,
    productVersion:v,
    commit:sha,
    sourceRef:sha,
    createdAt:date,
    title:isCurrent?'Current published Dol v'+v:(row.subject||'Dol v'+v),
    summary:isCurrent?(String(current.description||'').trim()||'Current tested application release.'):(row.description||row.subject||'Historical release.'),
    areas:[],
    sourceUrl:'https://github.com/'+config.repository+'/tree/'+sha,
    snapshotUrl:null,
    snapshotSafety:'source-only',
    compatibility:{
      frontend:'Immutable Git source; isolated read-only replay',
      source:'git',
      snapshot:'CDN on demand',
      backend:'Production network writes blocked',
      data:'Independent sandbox memory'
    },
    generator:{name:'Apps Version Lab release history',contractVersion:1,backfilled:!isCurrent}
  };
}
const newer=[];
for(const [v,row] of records){
  if(v===version){newer.push(asRelease(v,row,{isCurrent:true}));continue}
  // Existing immutable snapshots are preserved, never overwritten or renamed.
  if(historicVersions.has(v)||knownCommits.has(row.sha))continue;
  newer.push(asRelease(v,row));
}
const combined=[...newer,...existing.filter(r=>!(r.productVersion===version&&r.generator?.name==='Apps Version Lab release history'))];
combined.sort((a,b)=>(Date.parse(b.createdAt||0)||0)-(Date.parse(a.createdAt||0)||0));
if(combined[0]?.productVersion!==version)throw Error('Latest release mismatch: '+combined[0]?.productVersion+' != '+version);
if(combined[0]?.commit!==currentCommit)throw Error('Latest release commit mismatch');
const seen=new Set();
manifest.releases=combined.filter(r=>{const id=r.checkpointId;if(seen.has(id))return false;seen.add(id);return true});
manifest.schemaVersion=1;manifest.appId=config.appId;manifest.repository=config.repository;manifest.liveUrl=config.liveUrl;
manifest.generatedAt=new Date().toISOString();
manifest.publishedVersion=version;
manifest.publishedCommit=currentCommit;
fs.mkdirSync(path.dirname(manifestPath),{recursive:true});
fs.writeFileSync(manifestPath,JSON.stringify(manifest,null,2)+'\n');
console.log(JSON.stringify({
  version,currentCommit,recordedVersions:records.size,generatedRecords:newer.length,
  totalCheckpoints:manifest.releases.length,
  newest:manifest.releases.slice(0,4).map(x=>x.productVersion)
},null,2));
