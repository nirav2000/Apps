import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
const root=path.resolve(process.env.ATLAS_CANDIDATE||'.atlas-candidate');
const check=dir=>spawnSync(process.execPath,['ai-atlas/scripts/validate.mjs',dir],{encoding:'utf8'});
test('Complete candidate passes syntax, version and source checks',()=>{const result=check(root);assert.equal(result.status,0,result.stderr);});
for(const kind of ['syntax','source','font'])test('Rejects '+kind+' regression before publication',()=>{
  const dir=fs.mkdtempSync(path.join(process.cwd(),'.atlas-mutant-'));
  try{
    fs.cpSync(root,dir,{recursive:true});
    if(kind==='syntax')fs.appendFileSync(path.join(dir,'app.js'),'\nfunction broken( {\n');
    if(kind==='font')fs.appendFileSync(path.join(dir,'styles.css'),'\nbody{font-family:Georgia,serif}');
    if(kind==='source'){const file=path.join(dir,'release-data/2026-10-18.json');const data=JSON.parse(fs.readFileSync(file));delete data.sources[data.capex[0].source];fs.writeFileSync(file,JSON.stringify(data));}
    assert.notEqual(check(dir).status,0,'A broken candidate must fail');
  }finally{fs.rmSync(dir,{recursive:true,force:true});}
});
test('Publication helper rejects altered tested bytes',()=>{
  const dir=fs.mkdtempSync(path.join(process.cwd(),'.atlas-mutant-'));
  try{fs.cpSync(root,dir,{recursive:true});fs.appendFileSync(path.join(dir,'app.js'),'\n// changed after testing\n');
    const r=spawnSync(process.execPath,['validation/subapp-release.mjs','check','ai-atlas/release.config.json',path.relative(process.cwd(),dir)],{encoding:'utf8'});
    assert.notEqual(r.status,0);assert.match(r.stderr,/Tested artifact changed/);
  }finally{fs.rmSync(dir,{recursive:true,force:true});}
});
