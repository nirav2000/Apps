import test from "node:test";
import assert from "node:assert/strict";
import handler,{Limits,BUILD} from "./worker.mjs";
const origin="https://nirav2000.github.io", env={OWNER_UID:"test-owner",FIREBASE_WEB_API_KEY:"dummy",LIMITS:{}};
const req=(body,headers={})=>new Request("https://translation.example/",{method:"POST",headers:{Origin:origin,"Content-Type":"application/json",...headers},body:JSON.stringify(body)});
test("health only exposes booleans",async()=>{const r=await handler.fetch(new Request("https://translation.example/health"),env);const b=await r.json();assert.equal(b.build,BUILD);assert.equal(b.authConfigured,true);assert.equal(b.quotaConfigured,true);assert.ok(!JSON.stringify(b).includes("dummy"))});
test("no anonymous proxy",async()=>assert.equal((await handler.fetch(req({action:"translate"}),env)).status,401));
test("reject untrusted origin",async()=>assert.equal((await handler.fetch(req({action:"status"},{Origin:"https://example.org"}),env)).status,403));
test("preflight",async()=>{const r=await handler.fetch(new Request("https://translation.example/",{method:"OPTIONS",headers:{Origin:origin}}),env);assert.equal(r.status,204);assert.equal(r.headers.get("Access-Control-Allow-Origin"),origin)});
test("independent quotas",async()=>{const m=new Map(),l=new Limits({storage:{transaction:f=>f({get:k=>m.get(k),put:(k,v)=>m.set(k,v)})}});const run=(kind,amount)=>l.fetch(new Request("https://quota.internal/",{method:"POST",body:JSON.stringify({kind,amount})}));assert.equal((await run("google",12000)).status,200);assert.equal((await run("google",1)).status,429);assert.equal((await run("deepl",1)).status,200);assert.equal((await run("ai",10)).status,200);assert.equal((await run("ai",1)).status,429);assert.equal((await run("unknown",1)).status,400)});
test("real RS256 signatures, owner claims, provider provenance",async()=>{
 const originalFetch=globalThis.fetch;
 const kp=await crypto.subtle.generateKey({name:"RSASSA-PKCS1-v1_5",modulusLength:2048,publicExponent:new Uint8Array([1,0,1]),hash:"SHA-256"},true,["sign","verify"]);
 const jwk=await crypto.subtle.exportKey("jwk",kp.publicKey);jwk.kid="test-signing-key";
 const enc=x=>Buffer.from(JSON.stringify(x)).toString("base64url");
 const now=Math.floor(Date.now()/1000);
 const claims={aud:"kk-syllabus",iss:"https://securetoken.google.com/kk-syllabus",sub:"test-owner",exp:now+120,iat:now,auth_time:now};
 async function signed(overrides={}){const h=enc({alg:"RS256",kid:jwk.kid}),p=enc({...claims,...overrides});const sig=await crypto.subtle.sign("RSASSA-PKCS1-v1_5",kp.privateKey,new TextEncoder().encode(h+"."+p));return h+"."+p+"."+Buffer.from(sig).toString("base64url")}
 let actual=false;
 globalThis.fetch=async(url,opts)=>{if(url==="https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com")return Response.json({keys:[jwk]});if(url.startsWith("https://translation.googleapis.com/")){actual=true;assert.equal(JSON.parse(opts.body).source,"en");return Response.json({data:{translations:[{translatedText:"Bonjour"}]}})}throw Error("Unexpected upstream");};
 try{
 const e={...env,GOOGLE_TRANSLATE_KEY:"dummy",LIMITS:{idFromName:()=>1,get:()=>({fetch:async()=>new Response("ok")})}};
 const bearer=token=>({Authorization:"Bearer "+token});
 const valid=await signed();
 const r=await handler.fetch(req({action:"translate",source:"Hello",from:"en",to:"fr"},bearer(valid)),e);
 assert.equal(r.status,200);assert.equal((await r.json()).google,"Bonjour");assert.ok(actual);
 for(const invalid of [await signed({aud:"other"}),await signed({sub:"other"}),await signed({exp:now-1}),await signed({iat:now+3600}),valid.split(".").slice(0,2).join(".")+".YWJj"]){
 assert.equal((await handler.fetch(req({action:"status"},bearer(invalid)),e)).status,401);
 }
 }finally{globalThis.fetch=originalFetch}
});
