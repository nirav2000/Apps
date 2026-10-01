#!/usr/bin/env node
import {performance} from 'node:perf_hooks';

const target=process.argv[2]||process.env.LOAD_TEST_URL||'';
const requests=Math.max(1,Number(process.env.LOAD_TEST_REQUESTS||100));
const concurrency=Math.max(1,Number(process.env.LOAD_TEST_CONCURRENCY||10));
const allowProduction=process.env.ALLOW_PRODUCTION_LOAD_TEST==='true';
if(!target)throw Error('Usage: node load-test.mjs <url> (or LOAD_TEST_URL)');
const url=new URL(target);
const local=['localhost','127.0.0.1','::1'].includes(url.hostname);
const staging=/(^|[.-])(staging|preview|test|dev)([.-]|$)/i.test(url.hostname);
if(!local&&!staging&&!allowProduction)throw Error('Refusing load test against a non-local/non-staging target. Set ALLOW_PRODUCTION_LOAD_TEST=true only for an explicitly approved safe endpoint.');

let next=0,ok=0,errors=0;const durations=[],statuses={};
async function worker(){
  while(true){
    const i=next++;if(i>=requests)return;
    const t=performance.now();
    try{
      const r=await fetch(url,{cache:'no-store',headers:{'x-apps-load-test':'1'}});
      durations.push(performance.now()-t);statuses[r.status]=(statuses[r.status]||0)+1;
      if(r.ok)ok++;else errors++;
      await r.arrayBuffer();
    }catch{durations.push(performance.now()-t);errors++}
  }
}
await Promise.all(Array.from({length:Math.min(concurrency,requests)},worker));
durations.sort((a,b)=>a-b);
const pct=p=>durations[Math.min(durations.length-1,Math.floor((durations.length-1)*p))]||0;
const result={target:url.origin+url.pathname,requests,concurrency,ok,errors,errorRate:errors/requests,p50Ms:Math.round(pct(.5)),p95Ms:Math.round(pct(.95)),p99Ms:Math.round(pct(.99)),maxMs:Math.round(durations.at(-1)||0),statuses};
console.log(JSON.stringify(result,null,2));
const maxErrorRate=Number(process.env.LOAD_TEST_MAX_ERROR_RATE||0.01),maxP95=Number(process.env.LOAD_TEST_MAX_P95_MS||3000);
if(result.errorRate>maxErrorRate||result.p95Ms>maxP95)process.exit(1);
