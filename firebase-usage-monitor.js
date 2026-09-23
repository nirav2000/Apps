(function(){
  const KEY='firebase-usage-monitor.v2', LEGACY='firebase-usage-monitor.v1', LIMIT=31;
  const detectApp=()=>window.FIREBASE_USAGE_APP||((location.pathname.split('/').filter(Boolean)[0]||'root').toLowerCase());
  const detectProject=()=>window.FIREBASE_USAGE_PROJECT||window.SNAG_CLOUD?.primary?.projectId||window.SNAG_FIREBASE_CONFIG?.projectId||'unknown';
  const detectDatabase=()=>window.FIREBASE_USAGE_DATABASE||'(default)';
  const day=()=>new Date().toISOString().slice(0,10), hour=()=>new Date().toISOString().slice(0,13)+':00';
  const empty=()=>({version:2,days:{}});
  const load=()=>{try{return JSON.parse(localStorage.getItem(KEY)||'null')||empty()}catch{return empty()}};
  const save=d=>{localStorage.setItem(KEY,JSON.stringify(d));window.dispatchEvent(new CustomEvent('firebase-usage-monitor:update',{detail:d}))};
  function migrateLegacy(){
    if(localStorage.getItem(KEY)||!localStorage.getItem(LEGACY))return;
    try{
      const old=JSON.parse(localStorage.getItem(LEGACY)),d=empty();
      for(const [date,x] of Object.entries(old.days||{})){
        d.days[date]={targets:{legacy:{project:'legacy/unknown',database:'(default)',apps:x.apps||{}}},hours:x.hours||{}};
      }
      save(d);
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
  const api={
    record,
    read:(n=1,l='read',a,p,d)=>record('read',n,l,a,p,d),
    write:(n=1,l='write',a,p,d)=>record('write',n,l,a,p,d),
    del:(n=1,l='delete',a,p,d)=>record('delete',n,l,a,p,d),
    listener:(n=1,l='listener',a,p,d)=>record('listener',n,l,a,p,d),
    configure:x=>{if(x?.app)window.FIREBASE_USAGE_APP=x.app;if(x?.project)window.FIREBASE_USAGE_PROJECT=x.project;if(x?.database)window.FIREBASE_USAGE_DATABASE=x.database;},
    data:load,reset:()=>localStorage.removeItem(KEY),
    setThresholds:x=>localStorage.setItem(KEY+'.thresholds',JSON.stringify(x)),
    requestNotifications:()=>Notification?.requestPermission?.()
  };
  window.FirebaseUsageMonitor=api;
})();