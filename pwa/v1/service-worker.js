const CFG=self.APPS_PWA_CONFIG||{};
const CACHE=CFG.cacheName||'apps-pwa-v1';
const CACHE_PREFIX=CFG.cachePrefix||'apps-pwa-';
const PRECACHE=Array.isArray(CFG.precache)?CFG.precache:[];
const DEFAULT_STRATEGY=CFG.defaultStrategy||'cache-first';
const NETWORK_FIRST=Array.isArray(CFG.networkFirstPaths)?CFG.networkFirstPaths:[];

function matches(path,patterns){return patterns.some(item=>typeof item==='string'&&(path===item||path.endsWith(item)||path.includes(item)))}
async function networkFirst(request){
  const cache=await caches.open(CACHE);
  try{const fresh=await fetch(request,{cache:'no-store'});if(fresh?.ok)cache.put(request,fresh.clone());return fresh}
  catch{const cached=await cache.match(request);return cached||Response.error()}
}
async function cacheFirst(request){
  const cache=await caches.open(CACHE),cached=await cache.match(request);
  if(cached)return cached;
  try{const fresh=await fetch(request);if(fresh?.ok)cache.put(request,fresh.clone());return fresh}catch{return Response.error()}
}

self.addEventListener('install',event=>{
  event.waitUntil((async()=>{
    if(PRECACHE.length){const cache=await caches.open(CACHE);await cache.addAll(PRECACHE)}
    await self.skipWaiting();
  })());
});
self.addEventListener('activate',event=>{
  event.waitUntil((async()=>{
    for(const key of await caches.keys())if(key.startsWith(CACHE_PREFIX)&&key!==CACHE)await caches.delete(key);
    await self.clients.claim();
  })());
});
self.addEventListener('fetch',event=>{
  const req=event.request;
  if(req.method!=='GET')return;
  const url=new URL(req.url);
  if(url.origin!==self.location.origin)return;
  const forceNetwork=req.mode==='navigate'||matches(url.pathname,NETWORK_FIRST)||DEFAULT_STRATEGY==='network-first';
  event.respondWith(forceNetwork?networkFirst(req):cacheFirst(req));
});
