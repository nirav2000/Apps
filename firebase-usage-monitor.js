(function(){
  const KEY='firebase-usage-monitor.v1', LIMIT=31;
  const detect=()=>window.FIREBASE_USAGE_APP||((location.pathname.split('/').filter(Boolean)[0]||'root').toLowerCase());
  const day=()=>new Date().toISOString().slice(0,10);
  const hour=()=>new Date().toISOString().slice(0,13)+':00';
  const load=()=>{try{return JSON.parse(localStorage.getItem(KEY)||'{"version":1,"days":{}}')}catch{return{version:1,days:{}}}};
  const save=d=>{localStorage.setItem(KEY,JSON.stringify(d));window.dispatchEvent(new CustomEvent('firebase-usage-monitor:update',{detail:d}))};
  function record(type,count=1,label='other',app=detect()){
    count=Math.max(0,Number(count)||0);if(!count)return;
    const d=load(),k=day(),h=hour();d.days[k]??={apps:{},hours:{}};
    const A=d.days[k].apps[app]??={reads:0,writes:0,deletes:0,listeners:0,ops:{}};
    const field=type==='read'?'reads':type==='write'?'writes':type==='delete'?'deletes':'listeners';
    A[field]=(A[field]||0)+count;A.ops[label]??={reads:0,writes:0,deletes:0,listeners:0};A.ops[label][field]+=count;
    const H=d.days[k].hours[h]??={reads:0,writes:0,deletes:0};if(field in H)H[field]+=count;
    const keys=Object.keys(d.days).sort();while(keys.length>LIMIT){delete d.days[keys.shift()]}
    save(d);checkLocalThreshold(d,k,app);
  }
  function checkLocalThreshold(d,k,app){
    const a=d.days[k].apps[app], thresholds=JSON.parse(localStorage.getItem(KEY+'.thresholds')||'{"reads":1000,"writes":1000}');
    for(const t of ['reads','writes']){const n=a?.[t]||0,mark=KEY+'.alert.'+k+'.'+app+'.'+t;if(n>=thresholds[t]&&!sessionStorage.getItem(mark)){sessionStorage.setItem(mark,'1');window.dispatchEvent(new CustomEvent('firebase-usage-monitor:threshold',{detail:{app,type:t,count:n,threshold:thresholds[t]}}));if(Notification?.permission==='granted')new Notification('Firebase usage warning',{body:`${app}: ${n} ${t} recorded on this device today`});}}
  }
  const api={record,read:(n=1,l='read',a)=>record('read',n,l,a),write:(n=1,l='write',a)=>record('write',n,l,a),del:(n=1,l='delete',a)=>record('delete',n,l,a),listener:(n=1,l='listener',a)=>record('listener',n,l,a),data:load,reset:()=>{localStorage.removeItem(KEY)},setThresholds:(x)=>localStorage.setItem(KEY+'.thresholds',JSON.stringify(x)),requestNotifications:()=>Notification?.requestPermission?.()};
  window.FirebaseUsageMonitor=api;
})();