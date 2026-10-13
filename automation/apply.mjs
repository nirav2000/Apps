import fs from 'node:fs';import path from 'node:path';import {execFileSync} from 'node:child_process';import {allowedChanges,nextPatch,RECIPE} from './policy.mjs';
const plan=JSON.parse(fs.readFileSync('artifacts/diagnostic-plan.json'));
if(!plan||plan.recipe!==RECIPE)throw Error('No approved recipe');
const css='ui/pairboard-tablet.css',original=fs.readFileSync(css,'utf8');
if(original.includes('diagnostic-recipe:'+RECIPE))throw Error('Recipe already present: review required');
fs.appendFileSync(css,fs.readFileSync(new URL('./recipes/tablet-factor-visibility.css',import.meta.url)));
const metadata=JSON.parse(fs.readFileSync('version.json')),old=metadata.version,version=nextPatch(old);metadata.version=version;metadata.description='Tablet factor pairs stay visible through keypad review.';
fs.writeFileSync('version.json',JSON.stringify(metadata,null,2)+'\n');
const html=fs.readFileSync('index.html','utf8');if(!html.includes('Dol v'+old))throw Error('Footer/version mismatch');
fs.writeFileSync('index.html',html.replaceAll(old,version));
const worker=fs.readFileSync('service-worker.js','utf8');if(!worker.includes(old.replaceAll('.','-')))throw Error('PWA/version mismatch');
fs.writeFileSync('service-worker.js',worker.replaceAll(old.replaceAll('.','-'),version.replaceAll('.','-')));
const changed=execFileSync('git',['diff','--name-only'],{encoding:'utf8'}).trim().split('\n');
if(!allowedChanges(changed))throw Error('Changes escaped recipe allow-list');
// Enforce a second time at the commit boundary. No JS, learning or auth edits.
fs.writeFileSync('artifacts/diagnostic-candidate.json',JSON.stringify({...plan,oldVersion:old,version,changed},null,2));
console.log('Prepared narrow recipe',version,changed.join(', '));
