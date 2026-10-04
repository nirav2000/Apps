const CACHE='apps-pwa-v1';
self.addEventListener('install',event=>{event.waitUntil(self.skipWaiting())});
self.addEventListener('activate',event=>{event.waitUntil((async()=>{for(const key of await caches.keys())if(key.startsWith('apps-pwa-')&&key!==CACHE)await caches.delete(key);await self.clients.claim()})())});
self.addEventListener('fetch',event=>{
  const req=event.request;
  if(req.method!=='GET')return;
  const url=new URL(req.url);
  if(url.origin!==self.location.origin)return;
  if(req.mode==='navigate'){
    event.respondWith((async()=>{try{const fresh=await fetch(req);const cache=await caches.open(CACHE);cache.put(req,fresh.clone());return fresh}catch{const cached=await caches.match(req);return cached||Response.error()}})());
    return;
  }
  if(/\.(?:css|js|png|svg|webmanifest)$/.test(url.pathname)){
    event.respondWith((async()=>{const cache=await caches.open(CACHE);const cached=await cache.match(req);const network=fetch(req).then(r=>{if(r.ok)cache.put(req,r.clone());return r}).catch(()=>null);return cached||(await network)||Response.error()})());
  }
});
