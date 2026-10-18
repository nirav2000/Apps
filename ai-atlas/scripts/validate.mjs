import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const root=path.resolve(process.argv[2]||'ai-atlas');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const html=read('index.html'),version=JSON.parse(read('version.json')).version;
assert.equal((html.match(/<\/html>/gi)||[]).length,1,'One closing html element');
assert.match(version,/^\d+\.\d+\.\d+$/);assert(html.includes('v'+version)&&html.includes('?v='+version),'Visible version and asset version must match');
let scripts=0;
for(const m of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)){
  const external=m[1].match(/src="([^"?]+)(?:\?[^"]*)?"/);
  new vm.Script(external?read(external[1]):m[2],{filename:external?external[1]:'inline'});scripts++;
}
assert(scripts>=2,'Application and independent startup watchdog required');
const css=read('styles.css');assert(!/Georgia|Iowan|Times New Roman/i.test(css),'Serif typefaces are not allowed');assert(css.includes('sans-serif'));
const base=JSON.parse(read('release-data/2026-10-18.json')),history=JSON.parse(read('release-data/history.json'));
for(const data of [base,history]){assert(data.sources&&typeof data.sources==='object');for(const s of Object.values(data.sources))assert(/^https:\/\//.test(s.url),'Sources must use HTTPS');}
const hasSource=(x,data)=>assert(data.sources[x.source],'Unknown source: '+x.source);
for(const x of [...base.capex,...(base.annualCapex||[])]){assert(Number.isFinite(x.bn)&&x.bn>=0);hasSource(x,base);}
for(const x of [...history.annual,...(history.quarterly||[])]){assert(Number.isFinite(x.bn)&&x.bn>=0);hasSource(x,history);}
for(const data of [base,history])for(const x of data.priceHistory){assert(Number.isFinite(x.input)&&x.input>=0&&Number.isFinite(x.output)&&x.output>=0);assert(/^\d{4}-\d{2}-\d{2}$/.test(x.date));hasSource(x,data);}
for(const x of history.events){assert(/^\d{4}-\d{2}-\d{2}$/.test(x.date));hasSource(x,history);}
for(const x of base.models){assert(typeof x.name==='string'&&typeof x.open==='boolean');for(const key of ['input','output','score'])assert(x[key]==null||(Number.isFinite(x[key])&&x[key]>=0));for(const key of ['pricingSource','scoreSource'])if(x[key])assert(base.sources[x[key]]);}
assert(base.models.length&&history.annual.length&&history.events.length,'Required datasets cannot be empty');
console.log(JSON.stringify({status:'passed',version,scripts,models:base.models.length,annual:history.annual.length,events:history.events.length,priceRecords:base.priceHistory.length+history.priceHistory.length}));
