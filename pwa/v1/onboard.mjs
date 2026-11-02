#!/usr/bin/env node
// Canonical Apps PWA onboarding: shared behaviour, app-specific branding.
// Run: node onboard.mjs --app-root /path/to/app --config pwa.config.json --apply
// Check: node onboard.mjs --app-root /path/to/app --config pwa.config.json --check
import fs from 'node:fs';
import path from 'node:path';
import {iconSvg,ICON_CONCEPTS} from './icon-factory.mjs';
import {pathToFileURL} from 'node:url';

const flags=process.argv.slice(2);
const get=(name,fallback)=>{const i=flags.indexOf(name);return i<0?fallback:flags[i+1];};
const apply=flags.includes('--apply');
const check=flags.includes('--check');
if(apply===check){console.error('Choose exactly one of --apply or --check');process.exit(2);}
const appRoot=path.resolve(get('--app-root','.'));
const configName=get('--config','pwa.config.json');
const configPath=path.resolve(appRoot,configName);
function fail(message){throw Error('[Apps PWA] '+message);}
function requireFile(filename){if(!fs.existsSync(filename))fail('Missing '+filename);}
requireFile(configPath);
const c=JSON.parse(fs.readFileSync(configPath,'utf8'));
const concept=get('--concept',c.concept||'insight-book');
if(!ICON_CONCEPTS.some(x=>x.id===concept))fail('Unknown concept '+concept);
for(const field of ['name','short_name','id','start_url','scope','background_color','theme_color'])if(!c[field])fail('Config missing '+field);
if(!/^#[0-9a-fA-F]{6}$/.test(c.theme_color)||!/^#[0-9a-fA-F]{6}$/.test(c.background_color))fail('Use 6-digit hexadecimal colours');
if(!/^(\.\/|\/)[^?#]*$/.test(c.start_url)||!/^(\.\/|\/)[^?#]*$/.test(c.scope))fail('start_url and scope must be local paths');
if(!/^\/[A-Za-z0-9\-_/]+\/$/.test(c.id))fail('id must be a root-relative app directory, e.g. /InClass/');
const assetDir=c.assets_dir||'icons';
if(!/^[a-zA-Z0-9][a-zA-Z0-9_/-]*$/.test(assetDir)||assetDir.includes('..'))fail('Unsafe assets_dir');
const asset=(name)=>path.join(appRoot,assetDir,name);
const rel=(name)=>assetDir+'/'+name;
const svg=iconSvg({concept,background:c.icon_background||c.theme_color,accent:c.icon_accent||'#1a6674'});
const mask=iconSvg({concept,background:c.icon_background||c.theme_color,accent:c.icon_accent||'#1a6674',maskable:true});
const icons=[
 {src:rel('icon-192.png'),sizes:'192x192',type:'image/png',purpose:'any'},
 {src:rel('icon-512.png'),sizes:'512x512',type:'image/png',purpose:'any'},
 {src:rel('icon-maskable-512.png'),sizes:'512x512',type:'image/png',purpose:'maskable'}
];
const manifest={
 name:c.name,short_name:c.short_name,id:c.id,start_url:c.start_url,scope:c.scope,
 display:'standalone',background_color:c.background_color,theme_color:c.theme_color,
 ...(c.description?{description:c.description}:{}),icons
};
const mf=JSON.stringify(manifest,null,2)+'\n';
const checks=[
 ['icon.svg',svg],
 [rel('favicon.svg'),svg],
 [rel('icon-maskable.svg'),mask],
 ['manifest.webmanifest',mf]
];
function validateWorker(){
 const worker=path.join(appRoot,'sw.js');
 if(!fs.existsSync(worker))return false;
 const existing=fs.readFileSync(worker,'utf8');
 if(!existing.includes('Apps/pwa/v1/service-worker.js')||!existing.includes('APPS_PWA_CONFIG')){
  fail('Existing sw.js is not a shared PWA worker. Inspect/compose existing push and fetch handlers manually; never overwrite it.');
 }
 return true;
}
function pngDimensions(filename){
 const bytes=fs.readFileSync(filename);
 if(bytes.length<24||bytes.subarray(0,8).toString('hex')!=='89504e470d0a1a0a')fail('Invalid PNG '+filename);
 return [bytes.readUInt32BE(16),bytes.readUInt32BE(20)];
}
function checkHTML(){
 const htmlPath=path.join(appRoot,'index.html');requireFile(htmlPath);
 const html=fs.readFileSync(htmlPath,'utf8');
 for(const token of ['rel="manifest"','manifest.webmanifest','rel="apple-touch-icon"',rel('icon-180.png'),'Apps/pwa/v1/index.js','serviceWorkerUrl'])if(!html.includes(token))fail('index.html missing '+token);
 const sw=fs.readFileSync(path.join(appRoot,'sw.js'),'utf8');
 if(!sw.includes('Apps/pwa/v1/service-worker.js'))fail('Missing shared worker import');
}
function verify(){
 for(const [file,content] of checks){
  const filename=path.join(appRoot,file);requireFile(filename);
  if(fs.readFileSync(filename,'utf8')!==content)fail('Generated file drift: '+file);
 }
 for(const [file,size] of [['icon-180.png',180],['icon-192.png',192],['icon-512.png',512],['icon-maskable-512.png',512]]){
  const filename=asset(file);requireFile(filename);
  const dimensions=pngDimensions(filename);
  if(dimensions[0]!==size||dimensions[1]!==size)fail(file+' must be '+size+'x'+size);
 }
 validateWorker();checkHTML();
 console.log('[Apps PWA] PASS '+c.short_name+': manifest, icons, shared worker and iOS touch icon.');
}
if(check){verify();process.exit(0);}
if(!fs.existsSync(path.join(appRoot,'index.html')))fail('index.html is required: no application shell will be created');
const hasWorker=validateWorker(); // inspect BEFORE edits
if(!hasWorker){
 const serviceWorker=`self.APPS_PWA_CONFIG = {
 cacheName: '${c.short_name.toLowerCase().replace(/[^a-z0-9]+/g,'-')}-pwa-v1',
 cachePrefix: '${c.short_name.toLowerCase().replace(/[^a-z0-9]+/g,'-')}-pwa-',
 defaultStrategy: 'cache-first',
 precache: ['./','./index.html','./manifest.webmanifest','./icon.svg',
 './${rel('icon-180.png')}','./${rel('icon-192.png')}','./${rel('icon-512.png')}']
};
importScripts('https://nirav2000.github.io/Apps/pwa/v1/service-worker.js');
`;
 fs.writeFileSync(path.join(appRoot,'sw.js'),serviceWorker);
}
fs.mkdirSync(path.dirname(asset('x')), {recursive:true});
for(const [file,content] of checks){const filename=path.join(appRoot,file);fs.mkdirSync(path.dirname(filename),{recursive:true});fs.writeFileSync(filename,content);}
let renderer;
try{({Resvg:renderer}=await import('@resvg/resvg-js'));}
catch{fail('Raster renderer missing. Run npm install --no-save @resvg/resvg-js@2.6.2 in the shared PWA generator environment.');}
for(const [filename,source,size] of [
 ['icon-180.png',svg,180],['icon-192.png',svg,192],
 ['icon-512.png',svg,512],['icon-maskable-512.png',mask,512]
]){
 const out=new renderer(source,{fitTo:{mode:'width',value:size}}).render().asPng();
 fs.writeFileSync(asset(filename),out);
}
const htmlPath=path.join(appRoot,'index.html');
let html=fs.readFileSync(htmlPath,'utf8');
const appleTag=`<link rel="apple-touch-icon" sizes="180x180" href="${rel('icon-180.png')}" />`;
if(/<link\b[^>]*rel=["']apple-touch-icon["'][^>]*>/i.test(html))html=html.replace(/<link\b[^>]*rel=["']apple-touch-icon["'][^>]*>/i,appleTag);
else html=html.replace('</head>',`  ${appleTag}\n</head>`);
if(!html.includes('rel="manifest"'))html=html.replace('</head>',`  <link rel="manifest" href="manifest.webmanifest" />\n</head>`);
if(!html.includes('rel="icon"'))html=html.replace('</head>',`  <link rel="icon" type="image/svg+xml" href="${rel('favicon.svg')}" />\n</head>`);
if(!html.includes('Apps/pwa/v1/index.js')){
 html=html.replace('</body>',`<script type="module">import{initPWA}from'https://nirav2000.github.io/Apps/pwa/v1/index.js';initPWA({serviceWorkerUrl:'./sw.js',scope:'./'}).catch(console.warn);</script>\n</body>`);
}
fs.writeFileSync(htmlPath,html);
verify();
console.log('[Apps PWA] Assets generated and shared integration retained. Inspect UI and publish the changes.');
