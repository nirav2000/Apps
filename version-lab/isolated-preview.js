/* Version Lab isolated historical replay.
 * Loads immutable public Git commits as static assets only. Historical code executes
 * inside a sandboxed opaque-origin iframe with in-memory storage and NO production API access.
 * Do not enable allow-same-origin on the preview iframe.
 */
(function(){
'use strict';
const CDN='https://cdn.jsdelivr.net/gh/';
function assetRoot(repository,commit){
  if(!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repository||''))throw Error('Invalid repository');
  if(!/^[a-f0-9]{40}$/i.test(commit||''))throw Error('This checkpoint needs a verified Git commit to replay');
  return CDN+repository+'@'+commit+'/';
}
function runtime(){
  return String.raw`(()=>{
    'use strict';
    function memoryStorage(){
      const data=new Map();
      return {
        get length(){return data.size},
        key(i){return Array.from(data.keys())[i]||null},
        getItem(k){return data.has(String(k))?data.get(String(k)):null},
        setItem(k,v){data.set(String(k),String(v))},
        removeItem(k){data.delete(String(k))},
        clear(){data.clear()}
      };
    }
    const memory={localStorage:memoryStorage(),sessionStorage:memoryStorage()};
    // Sandboxed about:srcdoc documents have opaque origins. Their native Storage throws.
    // Isolated memory stores let ordinary UI state work without reading production data.
    for(const name of ['localStorage','sessionStorage']){
      try{Object.defineProperty(window,name,{configurable:true,get:()=>memory[name]})}catch(e){}
    }
    function report(type,detail){
      try{parent.postMessage({type:'apps-version-lab-'+type,detail:String(detail||'')},'*')}catch(e){}
    }
    const nativeFetch=window.fetch?window.fetch.bind(window):null;
    if(nativeFetch)window.fetch=function(input,init){
      const raw=typeof input==='string'||input instanceof URL?String(input):input.url;
      let url;try{url=new URL(raw,document.baseURI)}catch(e){return Promise.reject(e)}
      const method=String((init&&init.method)||(input&&input.method)||'GET').toUpperCase();
      if(url.hostname!=='cdn.jsdelivr.net'||!['GET','HEAD'].includes(method)){
        report('blocked-write',method+' '+url.origin);
        return Promise.reject(new TypeError('Version Lab preview: only read-only static CDN requests are permitted'));
      }
      return nativeFetch(input,{...(init||{}),credentials:'omit',method});
    };
    try{Object.defineProperty(navigator,'sendBeacon',{configurable:true,value:()=>false})}catch(e){}
    document.addEventListener('submit',e=>e.preventDefault(),true);
    document.addEventListener('click',e=>{
      const a=e.target.closest&&e.target.closest('a[href]');
      if(!a)return;
      const href=a.getAttribute('href')||'';
      // Keep SPA hash links, but prevent a preview accidentally opening a live app.
      if(href&&!href.startsWith('#'))e.preventDefault();
    },true);
    addEventListener('error',e=>report('runtime-error',e.message||'Script error'));
    addEventListener('unhandledrejection',e=>report('runtime-error',e.reason&&e.reason.message||String(e.reason)));
    // Scroll synchronization is opt-in in the central comparison UI.
    let ignoreScroll=false,frame=0;
    const scrollRatio=()=>{
      const height=Math.max(document.documentElement.scrollHeight,document.body?.scrollHeight||0)-innerHeight;
      return height>0?Math.max(0,Math.min(1,scrollY/height)):0;
    };
    addEventListener('scroll',()=>{
      if(ignoreScroll)return;
      cancelAnimationFrame(frame);
      frame=requestAnimationFrame(()=>parent.postMessage({type:'apps-version-lab-preview-scroll',ratio:scrollRatio()},'*'));
    },{passive:true});
    addEventListener('message',e=>{
      if(e.source!==parent||e.data?.type!=='apps-version-lab-set-scroll'||typeof e.data.ratio!=='number')return;
      const max=Math.max(document.documentElement.scrollHeight,document.body?.scrollHeight||0)-innerHeight;
      ignoreScroll=true;scrollTo(0,Math.max(0,max)*Math.max(0,Math.min(1,e.data.ratio)));
      setTimeout(()=>ignoreScroll=false,80);
    });
    addEventListener('DOMContentLoaded',()=>report('preview-ready','Interactive sandbox initialised'));
  })();`;
}
function prepare(html,base){
  if(!/<html\b|<body\b/i.test(html))throw Error('Historical index.html does not contain an HTML app');
  const doc=new DOMParser().parseFromString(html,'text/html');
  for(const meta of doc.querySelectorAll('meta[http-equiv]')){
    if(/^(content-security-policy|refresh)$/i.test(meta.getAttribute('http-equiv')||''))meta.remove();
  }
  for(const el of doc.querySelectorAll('base,link[rel="manifest"],link[rel="apple-touch-icon"]'))el.remove();
  // A restrictive CSP runs before any archived scripts and prevents production API calls.
  const policy=[
    "default-src 'none'",
    "base-uri https://cdn.jsdelivr.net",
    "script-src 'unsafe-inline' 'unsafe-eval' https://cdn.jsdelivr.net https://www.gstatic.com https://nirav2000.github.io/Apps/",
    "style-src 'unsafe-inline' https://cdn.jsdelivr.net https://fonts.googleapis.com https://nirav2000.github.io/Apps/",
    "connect-src https://cdn.jsdelivr.net",
    "img-src data: blob: https://cdn.jsdelivr.net https://nirav2000.github.io/Apps/",
    "font-src data: https://cdn.jsdelivr.net https://fonts.gstatic.com",
    "media-src data: blob: https://cdn.jsdelivr.net",
    "object-src 'none'",
    "frame-src 'none'",
    "worker-src 'none'",
    "form-action 'none'"
  ].join('; ')+';';
  const meta=doc.createElement('meta');
  meta.setAttribute('http-equiv','Content-Security-Policy');meta.setAttribute('content',policy);
  const baseTag=doc.createElement('base');baseTag.href=base;
  doc.head.prepend(baseTag);doc.head.prepend(meta);
  // Convert root-relative assets to the immutable commit path, not the live app.
  for(const el of doc.querySelectorAll('[src],[href]')){
    for(const attr of ['src','href']){
      const v=el.getAttribute(attr);
      if(v&&v.startsWith('/')&&!v.startsWith('//'))el.setAttribute(attr,base+v.replace(/^\/+/,''));
    }
  }
  const guard=doc.createElement('script');
  guard.textContent=runtime();
  baseTag.after(guard);
  return '<!doctype html>'+doc.documentElement.outerHTML;
}
async function build(app,release){
  const base=assetRoot(app.repository,release.commit);
  const res=await fetch(base+'index.html',{cache:'force-cache',credentials:'omit'});
  if(!res.ok)throw Error('Historical HTML '+res.status+' at '+base+'index.html');
  return prepare(await res.text(),base);
}
window.VersionLabIsolated={build,prepare,assetRoot};
})();