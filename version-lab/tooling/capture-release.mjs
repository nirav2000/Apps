#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {execFileSync} from 'node:child_process';

const root=process.cwd();
const configPath=path.join(root,'.version-lab.json');
if(!fs.existsSync(configPath)) throw new Error('Missing .version-lab.json');
const config=JSON.parse(fs.readFileSync(configPath,'utf8'));
for(const k of ['appId','repository','liveUrl']) if(!config[k]) throw new Error('.version-lab.json missing '+k);

const title=(process.env.VERSION_LAB_TITLE||'').trim();
const summary=(process.env.VERSION_LAB_SUMMARY||'').trim();
const areasText=(process.env.VERSION_LAB_AREAS||'').trim();
if(!title||!summary) throw new Error('VERSION_LAB_TITLE and VERSION_LAB_SUMMARY are required');

const sha=(process.env.GITHUB_SHA||execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'})).trim();
const short=sha.slice(0,8);
const now=new Date();
const stamp=now.toISOString().replace(/[-:]/g,'').replace(/\.\d{3}Z$/,'Z');
const checkpointId=(process.env.VERSION_LAB_CHECKPOINT||('vl-'+stamp+'-'+short)).replace(/[^A-Za-z0-9._-]/g,'-');
const outRoot=path.join(root,'version-lab-data');
const snapshots=path.join(outRoot,'snapshots');
const snapDir=path.join(snapshots,checkpointId);
const releasesPath=path.join(outRoot,'releases.json');
fs.mkdirSync(snapDir,{recursive:true});

const defaultExclude=[
  '.git/','.github/','version-lab-data/','node_modules/',
  '.env','.env.local','.env.production'
];
const excludes=[...defaultExclude,...(config.snapshot?.exclude||[])];
const includes=config.snapshot?.include||null;
const tracked=execFileSync('git',['ls-files','-z'],{encoding:'utf8'}).split('\0').filter(Boolean);
const norm=s=>s.replaceAll('\\','/');
const blocked=f=>excludes.some(x=>{x=norm(x);return x.endsWith('/')?f.startsWith(x):f===x||f.startsWith(x+'/')});
const allowed=f=>!includes||includes.some(x=>{x=norm(x);return x.endsWith('/')?f.startsWith(x):f===x||f.startsWith(x+'/')});

for(const rel0 of tracked){
  const rel=norm(rel0);
  if(blocked(rel)||!allowed(rel))continue;
  const src=path.join(root,rel),dst=path.join(snapDir,rel);
  if(!fs.existsSync(src)||!fs.statSync(src).isFile())continue;
  fs.mkdirSync(path.dirname(dst),{recursive:true});
  fs.copyFileSync(src,dst);
}

const safety=config.snapshotSafety||'visual-only';
const entry=config.snapshot?.entry||'index.html';
const entryPath=path.join(snapDir,entry);
if(fs.existsSync(entryPath)&&safety!=='interactive-safe'){
  let html=fs.readFileSync(entryPath,'utf8');
  const csp=safety==='source-only'
    ? "default-src 'none'; style-src 'unsafe-inline'; img-src data:; font-src data:;"
    : "default-src 'self' data: blob: https:; connect-src 'none'; form-action 'none'; frame-ancestors *; script-src 'self' 'unsafe-inline' 'unsafe-eval' https:; style-src 'self' 'unsafe-inline' https:; img-src 'self' data: blob: https:; font-src 'self' data: https:; media-src 'self' data: blob: https:;";
  const meta='<meta http-equiv="Content-Security-Policy" content="'+csp.replaceAll('"','&quot;')+'">';
  html=/<head[^>]*>/i.test(html)?html.replace(/<head([^>]*)>/i,'<head$1>'+meta):meta+html;
  fs.writeFileSync(entryPath,html);
}

let productVersion=null;
if(config.productVersionFile){
  try{
    const pv=JSON.parse(fs.readFileSync(path.join(root,config.productVersionFile),'utf8'));
    productVersion=String(pv.version||pv.build||'').trim()||null;
  }catch{}
}
if(process.env.VERSION_LAB_PRODUCT_VERSION?.trim())productVersion=process.env.VERSION_LAB_PRODUCT_VERSION.trim();

const areas=areasText?areasText.split(/\r?\n|\|/).map((v,i)=>{
  const text=v.trim(); if(!text)return null;
  const parts=text.split('::').map(x=>x.trim());
  return {id:(parts[0]||('area-'+(i+1))).toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,''),title:parts[0]||('Area '+(i+1)),kind:parts[1]||'change',summary:parts[2]||''};
}).filter(Boolean):[];

const data=config.data?{...config.data}:null;
const compatibility={
  frontend:'archived',
  source:'git',
  snapshot:safety==='source-only'?'source-only':'generated',
  backend:safety==='interactive-safe'?'declared safe by app config':safety==='read-only-adapter'?'requires read-only adapter':'live backend connections blocked',
  data:data?'contract recorded':'not declared'
};
const release={
  checkpointId,appId:config.appId,productVersion,commit:sha,createdAt:now.toISOString(),
  title,summary,areas,
  sourceUrl:'https://github.com/'+config.repository+'/tree/'+sha,
  snapshotUrl:safety==='source-only'?null:'./snapshots/'+checkpointId+'/'+entry,
  snapshotSafety:safety,compatibility,data,
  platform:config.platform||null,
  generator:{name:'Apps Version Lab',contractVersion:1}
};
fs.writeFileSync(path.join(snapDir,'version-lab-release.json'),JSON.stringify(release,null,2)+'\n');

let manifest={schemaVersion:1,appId:config.appId,repository:config.repository,liveUrl:config.liveUrl,releases:[]};
if(fs.existsSync(releasesPath)){
  try{manifest=JSON.parse(fs.readFileSync(releasesPath,'utf8'))}catch{}
}
manifest.schemaVersion=1;manifest.appId=config.appId;manifest.repository=config.repository;manifest.liveUrl=config.liveUrl;
manifest.generatedAt=now.toISOString();
manifest.releases=[release,...(manifest.releases||[]).filter(x=>x.checkpointId!==checkpointId)];
fs.mkdirSync(outRoot,{recursive:true});
fs.writeFileSync(releasesPath,JSON.stringify(manifest,null,2)+'\n');

const hash=crypto.createHash('sha256').update(JSON.stringify(release)).digest('hex');
console.log(JSON.stringify({checkpointId,productVersion,commit:sha,snapshotSafety:safety,files:tracked.filter(f=>!blocked(norm(f))&&allowed(norm(f))).length,releaseHash:hash},null,2));
