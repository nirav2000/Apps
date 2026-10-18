import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
const root=path.resolve('ai-atlas');
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
let scripts=0;
for(const m of html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)){new vm.Script(m[1],{filename:'ai-atlas/index.html:script-'+(++scripts)});}
if(scripts<2)throw Error('Expected application and history scripts');
const baseline=JSON.parse(fs.readFileSync(path.join(root,'data/2026-10-18.json'),'utf8'));
const history=JSON.parse(fs.readFileSync(path.join(root,'data/history.json'),'utf8'));
for(const [name,data] of [['baseline',baseline],['history',history]])if(!data.sources||Object.keys(data.sources).length<15)throw Error(name+' source register missing');
if(history.annual.length<20||history.events.length<15||history.priceHistory.length<8)throw Error('Insufficient backfill');
for(const item of history.annual){if(!Number.isFinite(item.bn)||!history.sources[item.source]||!/^20\d\d-\d\d-\d\d$/.test(item.periodEnd))throw Error('Invalid annual capex '+item.id);}
for(const item of [...history.events,...history.priceHistory])if(!history.sources[item.source]||!/^20\d\d-\d\d-\d\d$/.test(item.date))throw Error('Invalid dated source '+item.id);
for(const file of fs.readdirSync(path.join(root,'data/provider-snapshots'),{withFileTypes:true}).filter(x=>x.isFile()&&x.name.endsWith('.json'))){const x=JSON.parse(fs.readFileSync(path.join(root,'data/provider-snapshots',file.name),'utf8'));if(!x.collectedAt||!Array.isArray(x.models))throw Error('Invalid provider snapshot '+file.name);}
console.log('AI Atlas validated: '+scripts+' scripts, '+history.annual.length+' annual capex records, '+history.events.length+' events, '+history.priceHistory.length+' historical prices.');
