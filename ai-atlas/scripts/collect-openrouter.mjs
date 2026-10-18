import fs from 'node:fs';
import path from 'node:path';
const dir='ai-atlas/data/provider-snapshots';fs.mkdirSync(dir,{recursive:true});
const date=new Date().toISOString().slice(0,10),file=path.join(dir,date+'.json');
if(fs.existsSync(file)){console.log('Immutable snapshot already exists for '+date);process.exit(0);}
const controller=new AbortController();const timeout=setTimeout(()=>controller.abort(),25000);
try{
 const r=await fetch('https://openrouter.ai/api/v1/models',{headers:{'Accept':'application/json','User-Agent':'AIAtlasResearch/1.0 (public research catalog)'},signal:controller.signal});
 if(!r.ok)throw Error('OpenRouter HTTP '+r.status);
 const json=await r.json();if(!Array.isArray(json.data)||json.data.length<20)throw Error('Missing/short model catalog');
 const models=json.data.map(x=>({id:x.id,name:x.name,created:x.created??null,context_length:x.context_length??null,pricing:{prompt:x.pricing?.prompt??null,completion:x.pricing?.completion??null,request:x.pricing?.request??null,image:x.pricing?.image??null},architecture:{modality:x.architecture?.modality??null,tokenizer:x.architecture?.tokenizer??null},supported_parameters:x.supported_parameters??[]})).filter(x=>x.id&&x.pricing.prompt!=null);
 if(models.length<20)throw Error('Insufficient models with pricing');
 const out={schemaVersion:1,source:'https://openrouter.ai/api/v1/models',sourceType:'third-party router prices, not direct provider list prices',collectedAt:new Date().toISOString(),units:'USD per token as published by OpenRouter; multiply by 1,000,000 for USD per million tokens',models};
 fs.writeFileSync(file,JSON.stringify(out,null,2)+'\n');console.log('Saved '+file+' ('+models.length+' models)');
}catch(e){console.error('Evidence collection failed; no historical records changed: '+e.message);process.exitCode=1;}finally{clearTimeout(timeout)}
