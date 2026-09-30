#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const root=process.cwd(),base=path.join(root,'version-lab-data');
const manifestPath=path.join(base,'releases.json');
if(!fs.existsSync(manifestPath))throw new Error('version-lab-data/releases.json not found');
const m=JSON.parse(fs.readFileSync(manifestPath,'utf8'));
if(!m.appId||!Array.isArray(m.releases))throw new Error('Invalid releases manifest');
const ids=new Set();
for(const r of m.releases){
  for(const k of ['checkpointId','appId','commit','createdAt','title','summary','sourceUrl','snapshotSafety'])if(!r[k])throw new Error(r.checkpointId+': missing '+k);
  if(ids.has(r.checkpointId))throw new Error('Duplicate checkpoint '+r.checkpointId);ids.add(r.checkpointId);
  if(r.snapshotUrl){
    const rel=r.snapshotUrl.replace(/^\.\//,'');
    if(!fs.existsSync(path.join(base,rel)))throw new Error(r.checkpointId+': snapshot entry missing '+rel);
  }
}
console.log('Version Lab validation passed: '+m.releases.length+' checkpoint(s).');
