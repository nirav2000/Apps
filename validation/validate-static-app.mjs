#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';

const root=path.resolve(process.argv[2]||'.');
const configPath=path.resolve(root,process.argv[3]||'validation.config.json');
const defaults={ignore:[".git","node_modules","coverage","dist","version-lab/snapshots"],html:true,version:true};
let config={};
if(fs.existsSync(configPath)) config=JSON.parse(fs.readFileSync(configPath,'utf8'));
const ignored=[...defaults.ignore,...(config.ignore||[])].map(x=>x.replace(/\\/g,'/').replace(/^\.\//,'').replace(/\/$/,''));
const rel=p=>path.relative(root,p).replace(/\\/g,'/');
const isIgnored=p=>{const r=rel(p);return ignored.some(i=>r===i||r.startsWith(i+'/'))};

function walk(dir,out=[]){
  for(const ent of fs.readdirSync(dir,{withFileTypes:true})){
    const full=path.join(dir,ent.name); if(isIgnored(full)) continue;
    if(ent.isDirectory()) walk(full,out); else out.push(full);
  } return out;
}
const files=walk(root), errors=[], notes=[];
const fail=(file,msg)=>errors.push(`${rel(file)}: ${msg}`);

for(const file of files){
  const ext=path.extname(file).toLowerCase();
  if(ext==='.js'||ext==='.mjs'||ext==='.cjs'){
    const r=spawnSync(process.execPath,['--check',file],{encoding:'utf8'});
    if(r.status!==0) fail(file,(r.stderr||r.stdout||'JavaScript parse failed').trim());
  } else if(ext==='.json'){
    try{JSON.parse(fs.readFileSync(file,'utf8'))}catch(e){fail(file,'Invalid JSON: '+e.message)}
  } else if(ext==='.py' && config.python!==false){
    const r=spawnSync('python3',['-m','py_compile',file],{encoding:'utf8'});
    if(r.status!==0) fail(file,(r.stderr||'Python compile failed').trim());
  }
}

if(defaults.html && config.html!==false){
  for(const file of files.filter(f=>path.extname(f).toLowerCase()==='.html')){
    const source=fs.readFileSync(file,'utf8');
    const attrs=[...source.matchAll(/(?:src|href)=["']([^"'#]+)["']/gi)].map(m=>m[1]);
    for(const raw of attrs){
      if(/^(?:https?:|mailto:|tel:|data:|javascript:|webcal:|\/\/)/i.test(raw)) continue;
      const clean=raw.split('?')[0].split('#')[0]; if(!clean||clean==='.') continue;
      const target=clean.startsWith('/')?path.join(root,clean.replace(/^\/+/,'')):path.resolve(path.dirname(file),clean);
      if(!fs.existsSync(target)) fail(file,`Missing local reference: ${raw}`);
    }
  }
}

if(defaults.version && config.version!==false){
  const vf=path.join(root,'version.json'),index=path.join(root,'index.html');
  if(fs.existsSync(vf)){
    try{
      const v=JSON.parse(fs.readFileSync(vf,'utf8')).version;
      if(!/^\d+\.\d+\.\d+$/.test(String(v||''))) fail(vf,'version must be SemVer x.y.z');
      if(fs.existsSync(index) && config.requireVersionInIndex!==false){
        const html=fs.readFileSync(index,'utf8');
        if(!html.includes('v'+v)) fail(index,`does not display v${v}`);
        if(!html.includes('?v='+v)) fail(index,`does not contain cache-bust ?v=${v}`);
      }
    }catch(e){fail(vf,'Version validation failed: '+e.message)}
  }
}

for(const rule of config.jsonSchemas||[]){
  const file=path.join(root,rule.file); if(!fs.existsSync(file)){fail(file,'Required dataset missing');continue}
  try{
    const data=JSON.parse(fs.readFileSync(file,'utf8'));
    let value=data; for(const key of rule.path||[]) value=value?.[key];
    if(rule.type==='array'&&!Array.isArray(value)) fail(file,`${(rule.path||[]).join('.')} must be an array`);
    if(rule.type==='object'&&(value===null||Array.isArray(value)||typeof value!=='object')) fail(file,`${(rule.path||[]).join('.')} must be an object`);
    if(rule.minItems&&(!Array.isArray(value)||value.length<rule.minItems)) fail(file,`${(rule.path||[]).join('.')} needs at least ${rule.minItems} items`);
    if(rule.minKeys&&(!value||typeof value!=='object'||Object.keys(value).length<rule.minKeys)) fail(file,`${(rule.path||[]).join('.')} needs at least ${rule.minKeys} keys`);
  }catch(e){fail(file,'Schema check failed: '+e.message)}
}

if(errors.length){console.error('\nVALIDATION FAILED\n'+errors.map(x=>' - '+x).join('\n'));process.exit(1)}
console.log(`Validation passed: ${files.length} files checked recursively.`);
if(notes.length) console.log(notes.join('\n'));
