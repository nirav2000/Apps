(function(){
  const KEY='firebase-usage-monitor.v3', V2='firebase-usage-monitor.v2', V1='firebase-usage-monitor.v1', CANONICAL_DEVICE_KEY='apps-platform.v1.device', LIMIT=31;
  const CLOUD='https://snag-media-api.nirav2000-github.workers.dev/usage';
  const ACTIVE_SYNC=5*60*1000, FIRST_SYNC=30*1000;
  const detectApp=()=>window.FIREBASE_USAGE_APP||((location.pathname.split('/').filter(Boolean)[0]||'root').toLowerCase());
  const detectProject=()=>window.FIREBASE_USAGE_PROJECT||window.SNAG_CLOUD?.primary?.projectId||window.SNAG_FIREBASE_CONFIG?.projectId||'unknown';
  const detectDatabase=()=>window.FIREBASE_USAGE_DATABASE||'(default)';
  const pad=n=>String(n).padStart(2,'0');
  const day=()=>{const d=new Date();return d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate())};
  const hour=()=>{const d=new Date();return day()+'T'+pad(d.getHours())+':00'};
  const bucket=()=>{const d=new Date(),m=Math.floor(d.getMinutes()/5)*5;return day()+'T'+pad(d.getHours())+':'+pad(m)};
  const empty=()=>({version:3,days:{}});
  const load=()=>{try{return JSON.parse(localStorage.getItem(KEY)||'null')||empty()}catch{return empty()}};
  const rawSave=d=>localStorage.setItem(KEY,JSON.stringify(d));
  const deviceId=()=>{let x=window.AppsAuth?.deviceId?.()||localStorage.getItem(CANONICAL_DEVICE_KEY)||localStorage.getItem(KEY+'.device')||localStorage.getItem(V2+'.device');if(!x){x=('d-'+(crypto.randomUUID?.()||Date.now()+'-'+Math.random().toString(36).slice(2))).replace(/[^A-Za-z0-9._-]/g,'');}localStorage.setItem(CANONICAL_DEVICE_KEY,x);localStorage.setItem(KEY+'.device',x);localStorage.setItem(V2+'.device',x);return x};
  const deviceInfo=()=>{
    const ua=navigator.userAgent||'',touch=navigator.maxTouchPoints||0;
    let kind='Browser';
    if(/iPhone/i.test(ua))kind='iPhone';
    else if(/iPad/i.test(ua)||(/Macintosh/i.test(ua)&&touch>1))kind='iPad';
    else if(/Android/i.test(ua))kind='Android';
    else if(/Macintosh|Mac OS X/i.test(ua))kind='Mac';
    else if(/Windows/i.test(ua))kind='Windows';
    let browser='Browser';
    if(/CriOS|Chrome/i.test(ua))browser='Chrome';
    else if(/FxiOS|Firefox/i.test(ua))browser='Firefox';
    else if(/Safari/i.test(ua))browser='Safari';
    const id=deviceId(),short=id.slice(-4).toUpperCase();
    return {kind,browser,label:window.AppsAuth?.deviceLabel?.()||kind+' · '+short};
  };
  function migrate(){
    if(localStorage.getItem(KEY))return;
    try{
      const old2=JSON.parse(localStorage.getItem(V2)||'null');
      if(old2?.days){const d=empty();for(const [date,x] of Object.entries(old2.days))d.days[date]={targets:x.targets||{},hours:x.hours||{},buckets:x.buckets||{}};rawSave(d);return;}
      const old1=JSON.parse(localStorage.getItem(V1)||'null');
      if(old1?.days){const d=empty();for(const [date,x] of Object.entries(old1.days))d.days[date]={targets:{legacy:{project:'kk-syllabus',database:'(default)',apps:x.apps||{}}},hours:x.hours||{},buckets:{}};rawSave(d);}
    }catch{}
  }
  migrate();
  let syncTimer=null;
  function scheduleSync(){
    if(syncTimer)return;
    const last=Number(localStorage.getItem(KEY+'.lastSync')||0),elapsed=Date.now()-last;
    const wait=last?Math.max(FIRST_SYNC,ACTIVE_SYNC-elapsed):FIRST_SYNC;
    syncTimer=setTimeout(()=>{syncTimer=null;syncCloud(false)},wait);
  }
  const save=d=>{rawSave(d);localStorage.setItem(KEY+'.dirty','1');window.dispatchEvent(new CustomEvent('firebase-usage-monitor:update',{detail:d}));scheduleSync()};
  function appCounter(container,app){
    const A=container[app]??={reads:0,writes:0,deletes:0,listeners:0,ops:{}};
    A.ops??={};return A;
  }
  function inc(A,field,count,label){
    A[field]=(A[field]||0)+count;
    A.ops[label]??={reads:0,writes:0,deletes:0,listeners:0};
    A.ops[label][field]=(A.ops[label][field]||0)+count;
  }
  function record(type,count=1,label='other',app=detectApp(),project=detectProject(),database=detectDatabase()){
    count=Math.max(0,Number(count)||0);if(!count)return;
    const d=load(),k=day(),h=hour(),b=bucket(),target=project+'/'+database;
    d.days[k]??={targets:{},hours:{},buckets:{}};
    const D=d.days[k];D.targets??={};D.hours??={};D.buckets??={};
    const T=D.targets[target]??={project,database,apps:{}};
    const field=type==='read'?'reads':type==='write'?'writes':type==='delete'?'deletes':'listeners';
    inc(appCounter(T.apps,app),field,count,label);
    const H=D.hours[h]??={reads:0,writes:0,deletes:0};if(field in H)H[field]=(H[field]||0)+count;
    const B=D.buckets[b]??={targets:{}},BT=B.targets[target]??={project,database,apps:{}};
    inc(appCounter(BT.apps,app),field,count,label);
    const keys=Object.keys(d.days).sort();while(keys.length>LIMIT)delete d.days[keys.shift()];
    save(d);checkLocalThreshold(d,k,target,app);
  }
  function checkLocalThreshold(d,k,target,app){
    const a=d.days[k].targets?.[target]?.apps?.[app], thresholds=JSON.parse(localStorage.getItem(KEY+'.thresholds')||'{"reads":1000,"writes":1000}');
    for(const t of ['reads','writes']){
      const n=(a?.[t]||0)+(t==='writes'?(a?.deletes||0):0),mark=KEY+'.alert.'+k+'.'+target+'.'+app+'.'+t;
      if(n>=thresholds[t]&&!sessionStorage.getItem(mark)){
        sessionStorage.setItem(mark,'1');
        window.dispatchEvent(new CustomEvent('firebase-usage-monitor:threshold',{detail:{target,app,type:t,count:n,threshold:thresholds[t]}}));
        if(Notification?.permission==='granted')new Notification('Firebase usage warning',{body:target+' · '+app+': '+n+' '+t+' recorded on this device today'});
      }
    }
  }
  async function syncCloud(force=false){
    if(localStorage.getItem(KEY+'.dirty')!=='1')return {ok:true,skipped:'clean'};
    const last=Number(localStorage.getItem(KEY+'.lastSync')||0);
    if(!force&&last&&Date.now()-last<ACTIVE_SYNC){scheduleSync();return {ok:true,skipped:'recent'};}
    const d=load(),k=day(),x=d.days?.[k];if(!x)return {ok:true,skipped:'empty'};
    const body={version:3,date:k,deviceId:deviceId(),device:deviceInfo(),targets:x.targets||{},hours:x.hours||{},buckets:x.buckets||{}};
    const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),8000);
    try{
      const r=await fetch(CLOUD+'/snapshot',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),keepalive:true,signal:controller.signal});
      if(!r.ok)throw new Error('Cloud sync '+r.status);
      localStorage.setItem(KEY+'.dirty','0');localStorage.setItem(KEY+'.lastSync',String(Date.now()));
      window.dispatchEvent(new CustomEvent('firebase-usage-monitor:cloud',{detail:{ok:true,at:new Date().toISOString()}}));
      return {ok:true};
    }catch(error){
      window.dispatchEvent(new CustomEvent('firebase-usage-monitor:cloud',{detail:{ok:false,error:String(error)}}));scheduleSync();return {ok:false,error:String(error)};
    }finally{clearTimeout(timer)}
  }
  async function fetchCloud(date=day()){
    const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),8000);
    try{
      const r=await fetch(CLOUD+'/day?date='+encodeURIComponent(date),{cache:'no-store',signal:controller.signal});
      if(!r.ok)throw new Error('Cloud usage '+r.status);
      return await r.json();
    }finally{clearTimeout(timer)}
  }
  const flush=()=>{if(localStorage.getItem(KEY+'.dirty')==='1')syncCloud(true)};
  document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='hidden')flush()});
  window.addEventListener('pagehide',flush);
  window.addEventListener('online',()=>syncCloud(false));
  setInterval(()=>syncCloud(false),ACTIVE_SYNC);
  if(localStorage.getItem(KEY+'.dirty')==='1')setTimeout(()=>syncCloud(true),1000);
  const api={
    record,
    read:(n=1,l='read',a,p,d)=>record('read',n,l,a,p,d),
    write:(n=1,l='write',a,p,d)=>record('write',n,l,a,p,d),
    del:(n=1,l='delete',a,p,d)=>record('delete',n,l,a,p,d),
    listener:(n=1,l='listener',a,p,d)=>record('listener',n,l,a,p,d),
    configure:x=>{if(x?.app)window.FIREBASE_USAGE_APP=x.app;if(x?.project)window.FIREBASE_USAGE_PROJECT=x.project;if(x?.database)window.FIREBASE_USAGE_DATABASE=x.database;},
    data:load,deviceId,deviceInfo,syncCloud,fetchCloud,
    reset:()=>localStorage.removeItem(KEY),
    setThresholds:x=>localStorage.setItem(KEY+'.thresholds',JSON.stringify(x)),
    requestNotifications:()=>Notification?.requestPermission?.()
  };
  window.FirebaseUsageMonitor=api;
})();