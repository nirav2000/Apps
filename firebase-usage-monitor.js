(function(){
  const KEY='firebase-usage-monitor.v2', LEGACY='firebase-usage-monitor.v1', LIMIT=31;
  const CLOUD='https://snag-media-api.nirav2000-github.workers.dev/usage';
  const SYNC_EVERY=15*60*1000, MIN_HIDE_SYNC=2*60*1000;
  const detectApp=()=>window.FIREBASE_USAGE_APP||((location.pathname.split('/').filter(Boolean)[0]||'root').toLowerCase());
  const detectProject=()=>window.FIREBASE_USAGE_PROJECT||window.SNAG_CLOUD?.primary?.projectId||window.SNAG_FIREBASE_CONFIG?.projectId||'unknown';
  const detectDatabase=()=>window.FIREBASE_USAGE_DATABASE||'(default)';
  const day=()=>new Date().toISOString().slice(0,10), hour=()=>new Date().toISOString().slice(0,13)+':00';
  const empty=()=>({version:2,days:{}});
  const load=()=>{try{return JSON.parse(localStorage.getItem(KEY)||'null')||empty()}catch{return empty()}};
  const save=d=>{localStorage.setItem(KEY,JSON.stringify(d));localStorage.setItem(KEY+'.dirty','1');window.dispatchEvent(new CustomEvent('firebase-usage-monitor:update',{detail:d}));scheduleSync()};
  const deviceId=()=>{let x=localStorage.getItem(KEY+'.device');if(!x){x=(crypto.randomUUID?.()||('d-'+Date.now()+'-'+Math.random().toString(36).slice(2))).replace(/[^A-Za-z0-9._-]/g,'');localStorage.setItem(KEY+'.device',x)}return x};
  function migrateLegacy(){
    if(localStorage.getItem(KEY)||!localStorage.getItem(LEGACY))return;
    try{
      const old=JSON.parse(localStorage.getItem(LEGACY)),d=empty();
      for(const [date,x] of Object.entries(old.days||{}))d.days[date]={targets:{legacy:{project:'legacy/unknown',database:'(default)',apps:x.apps||{}}},hours:x.hours||{}};
      localStorage.setItem(KEY,JSON.stringify(d));
    }catch{}
  }
  migrateLegacy();
  function record(type,count=1,label='other',app=detectApp(),project=detectProject(),database=detectDatabase()){
    count=Math.max(0,Number(count)||0);if(!count)return;
    const d=load(),k=day(),h=hour(),target=project+'/'+database;
    d.days[k]??={targets:{},hours:{}};
    const T=d.days[k].targets[target]??={project,database,apps:{}};
    const A=T.apps[app]??={reads:0,writes:0,deletes:0,listeners:0,ops:{}};
    const field=type==='read'?'reads':type==='write'?'writes':type==='delete'?'deletes':'listeners';
    A[field]=(A[field]||0)+count;A.ops[label]??={reads:0,writes:0,deletes:0,listeners:0};A.ops[label][field]+=count;
    const H=d.days[k].hours[h]??={reads:0,writes:0,deletes:0};if(field in H)H[field]+=count;
    const keys=Object.keys(d.days).sort();while(keys.length>LIMIT)delete d.days[keys.shift()];
    save(d);checkLocalThreshold(d,k,target,app);
  }
  function checkLocalThreshold(d,k,target,app){
    const a=d.days[k].targets?.[target]?.apps?.[app], thresholds=JSON.parse(localStorage.getItem(KEY+'.thresholds')||'{"reads":1000,"writes":1000}');
    for(const t of ['reads','writes']){const n=a?.[t]||0,mark=KEY+'.alert.'+k+'.'+target+'.'+app+'.'+t;if(n>=thresholds[t]&&!sessionStorage.getItem(mark)){sessionStorage.setItem(mark,'1');window.dispatchEvent(new CustomEvent('firebase-usage-monitor:threshold',{detail:{target,app,type:t,count:n,threshold:thresholds[t]}}));if(Notification?.permission==='granted')new Notification('Firebase usage warning',{body:target+' · '+app+': '+n+' '+t+' recorded on this device today'});}}
  }
  let syncTimer=null;
  function scheduleSync(){
    if(syncTimer)return;
    const last=Number(localStorage.getItem(KEY+'.lastSync')||0),wait=Math.max(30000,SYNC_EVERY-(Date.now()-last));
    syncTimer=setTimeout(()=>{syncTimer=null;syncCloud(false)},wait);
  }
  async function syncCloud(force=false){
    if(localStorage.getItem(KEY+'.dirty')!=='1')return {ok:true,skipped:'clean'};
    const last=Number(localStorage.getItem(KEY+'.lastSync')||0);
    if(!force&&Date.now()-last<SYNC_EVERY){scheduleSync();return {ok:true,skipped:'recent'};}
    const d=load(),k=day(),x=d.days?.[k];if(!x)return {ok:true,skipped:'empty'};
    const body={version:2,date:k,deviceId:deviceId(),targets:x.targets||{},hours:x.hours||{}};
    try{
      const r=await fetch(CLOUD+'/snapshot',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),keepalive:true});
      if(!r.ok)throw new Error('Cloud sync '+r.status);
      localStorage.setItem(KEY+'.dirty','0');localStorage.setItem(KEY+'.lastSync',String(Date.now()));
      window.dispatchEvent(new CustomEvent('firebase-usage-monitor:cloud',{detail:{ok:true,at:new Date().toISOString()}}));
      return {ok:true};
    }catch(error){
      window.dispatchEvent(new CustomEvent('firebase-usage-monitor:cloud',{detail:{ok:false,error:String(error)}}));scheduleSync();return {ok:false,error:String(error)};
    }
  }
  async function fetchCloud(date=day()){
    const r=await fetch(CLOUD+'/day?date='+encodeURIComponent(date),{cache:'no-store'});
    if(!r.ok)throw new Error('Cloud usage '+r.status);
    return r.json();
  }
  document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='hidden'&&localStorage.getItem(KEY+'.dirty')==='1'){const last=Number(localStorage.getItem(KEY+'.lastSync')||0);if(Date.now()-last>=MIN_HIDE_SYNC)syncCloud(true)}});
  window.addEventListener('online',()=>syncCloud(false));
  setInterval(()=>syncCloud(false),SYNC_EVERY);
  const api={
    record,
    read:(n=1,l='read',a,p,d)=>record('read',n,l,a,p,d),
    write:(n=1,l='write',a,p,d)=>record('write',n,l,a,p,d),
    del:(n=1,l='delete',a,p,d)=>record('delete',n,l,a,p,d),
    listener:(n=1,l='listener',a,p,d)=>record('listener',n,l,a,p,d),
    configure:x=>{if(x?.app)window.FIREBASE_USAGE_APP=x.app;if(x?.project)window.FIREBASE_USAGE_PROJECT=x.project;if(x?.database)window.FIREBASE_USAGE_DATABASE=x.database;},
    data:load,deviceId,syncCloud,fetchCloud,
    reset:()=>localStorage.removeItem(KEY),
    setThresholds:x=>localStorage.setItem(KEY+'.thresholds',JSON.stringify(x)),
    requestNotifications:()=>Notification?.requestPermission?.()
  };
  window.FirebaseUsageMonitor=api;
})();