/* Heating Intelligence v0.3.0 — local-only interface and validated history import.
 * Never interprets a scheduled target as proof of heating. No network calls.
 */
import {summarize,clipIntervals,unionDuration,ms} from "./heating-analytics.mjs";
const $=id=>document.getElementById(id);
const esc=v=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const finite=(v,min,max)=>{if(v===null||v===undefined||v==="")return null;const n=Number(v);return Number.isFinite(n)&&n>=min&&n<=max?n:null;};
const fmtTime=v=>new Date(v).toLocaleTimeString("en-GB",{hour:"2-digit",minute:"2-digit"});
const fmtStamp=v=>new Date(v).toLocaleString("en-GB",{day:"2-digit",month:"short",hour:"2-digit",minute:"2-digit"});
const duration=v=>v>=60?Math.floor(v/60)+"h "+Math.round(v%60)+"m":Math.round(v)+"m";
const midnight=offset=>{const d=new Date();d.setHours(0,0,0,0);d.setDate(d.getDate()+offset);return d;};
const key="home-studio-heating-preferences-v1";
let settings;
try{const s=JSON.parse(localStorage.getItem(key)||"{}");settings={price:finite(s.price,0,300)??23.10,powers:s.powers&&typeof s.powers==="object"?s.powers:{}};}
catch{settings={price:23.10,powers:{}};}
let data=createDemo(),period="today",imported=false;
function save(){try{localStorage.setItem(key,JSON.stringify(settings));}catch{}}
function range(){
  const now=new Date(),today=midnight(0);
  if(period==="yesterday")return {from:midnight(-1).toISOString(),until:today.toISOString()};
  if(period==="7d")return {from:midnight(-6).toISOString(),until:now.toISOString()};
  return {from:today.toISOString(),until:now.toISOString()};
}
function createDemo(){
  const zones=[
    {id:"wiser-downstairs",name:"Downstairs heating",provider:"wiser",energyType:"gas",kind:"heating",current:20.4,target:21,description:"Thermostat call for heat",powerW:null},
    {id:"wiser-upstairs",name:"Upstairs heating",provider:"wiser",energyType:"gas",kind:"heating",current:18.7,target:19.5,description:"Thermostat call for heat",powerW:null},
    {id:"warmup-bathroom",name:"Bathroom underfloor",provider:"warmup",energyType:"electric",kind:"heating",current:22.3,target:23,description:"Illustrative relay signal",powerW:750},
    {id:"wiser-hotwater",name:"Hot water cylinder",provider:"wiser",energyType:"gas",kind:"hot_water",current:null,target:null,description:"Hot water call",powerW:null}
  ];
  function active(z,t,slot){
    const hour=t.getHours()+t.getMinutes()/60,weekend=t.getDay()===0||t.getDay()===6,c=slot%9;
    if(z==="wiser-downstairs")return ((hour>=(weekend?7.5:6.5)&&hour<9.4)||(hour>=17.3&&hour<22.6))&&c<5;
    if(z==="wiser-upstairs")return ((hour>=6.2&&hour<8.2)||(hour>=19&&hour<22.8))&&c<4;
    if(z==="warmup-bathroom")return ((hour>=6&&hour<8.4)||(hour>=19.6&&hour<21.7))&&c<6;
    return ((hour>=5.8&&hour<6.8)||(hour>=17.6&&hour<18.4))&&c<7;
  }
  const intervals=[],now=Date.now();
  for(let day=-8;day<=0;day++){
    const start=midnight(day).getTime(),end=Math.min(midnight(day+1).getTime(),now);
    for(const z of zones){
      let open=null,step=0;
      for(let t=start;t<end;t+=600000){
        const next=Math.min(t+600000,end);
        const state=active(z.id,new Date(t),step++)?"on":"off";
        if(!open||open.state!==state){
          if(open)intervals.push(open);
          open={zoneId:z.id,start:new Date(t).toISOString(),end:new Date(next).toISOString(),state,evidence:z.description};
        }else{open.end=new Date(next).toISOString();}
      }
      if(open)intervals.push(open);
    }
  }
  return {schemaVersion:1,generatedAt:new Date(now).toISOString(),source:"fictional demo",zones,intervals};
}
function validateImport(obj){
  if(!obj||obj.schemaVersion!==1||!Array.isArray(obj.zones)||!Array.isArray(obj.intervals))throw Error("Expected schemaVersion: 1, zones[], and intervals[].");
  if(obj.zones.length<1||obj.zones.length>50||obj.intervals.length>40000)throw Error("Unsupported number of zones or history records.");
  const ids=new Set();
  const zones=obj.zones.map(z=>{
    const id=String(z.id||"").slice(0,72);
    if(!/^[A-Za-z0-9_-]+$/.test(id)||ids.has(id))throw Error("Invalid or duplicated zone ID.");
    ids.add(id);
    if(!["wiser","warmup"].includes(z.provider)||!["gas","electric"].includes(z.energyType))throw Error("Unknown device provider or energy type.");
    return {id,name:String(z.name||id).slice(0,80),provider:z.provider,energyType:z.energyType,
      kind:z.kind==="hot_water"?"hot_water":"heating",current:finite(z.current,-20,65),
      target:finite(z.target,0,45),powerW:finite(z.powerW,0,50000),description:String(z.description||z.evidence||"Imported state").slice(0,140)};
  });
  const intervals=obj.intervals.map((x,i)=>{
    const a=ms(x.start),b=ms(x.end),zoneId=String(x.zoneId||"");
    if(!ids.has(zoneId)||!["on","off","unknown"].includes(x.state)||!Number.isFinite(a)||!Number.isFinite(b)||b<=a||b-a>366*86400000)
      throw Error("Invalid history interval "+(i+1));
    return {zoneId,start:new Date(a).toISOString(),end:new Date(b).toISOString(),state:x.state,evidence:String(x.evidence||"Imported device state").slice(0,120)};
  }).sort((a,b)=>ms(a.start)-ms(b.start));
  for(const z of zones){
    const subset=intervals.filter(x=>x.zoneId===z.id);
    for(let i=1;i<subset.length;i++)if(ms(subset[i].start)<ms(subset[i-1].end))
      throw Error("Overlapping intervals for "+z.name+"; normalize collector output first.");
  }
  const at=ms(obj.generatedAt);
  return {schemaVersion:1,source:String(obj.source||"local import").slice(0,70),
    generatedAt:Number.isFinite(at)?new Date(at).toISOString():new Date().toISOString(),zones,intervals};
}
function power(z){
  const override=Object.prototype.hasOwnProperty.call(settings.powers,z.id)?finite(settings.powers[z.id],0,50000):null;
  return override!==null?override:z.powerW;
}
function modelZones(){return data.zones.map(z=>({...z,powerW:power(z)}));}
function latestState(id){
  const now=Date.now();
  const r=data.intervals.filter(x=>x.zoneId===id&&ms(x.start)<=now&&ms(x.end)>now-12*60000).sort((a,b)=>ms(b.end)-ms(a.end))[0];
  return !r||now-ms(r.end)>12*60000?"unknown":r.state;
}
function summarise(){
  const bounds=range();
  return summarize({zones:modelZones(),intervals:data.intervals,from:bounds.from,until:bounds.until,pricePence:settings.price});
}
function renderTop(s){
  const bounds=range();
  const wiser=s.rows.filter(r=>r.provider==="wiser"&&data.zones.some(z=>z.id===r.zoneId&&z.kind==="heating"));
  const ranges=wiser.flatMap(r=>clipIntervals(data.intervals,bounds.from,bounds.until,r.zoneId).filter(x=>x.state==="on"));
  const under=s.rows.filter(r=>r.provider==="warmup");
  const hasWiser=wiser.some(r=>r.coverage>0),hasUnder=under.some(r=>r.coverage>0);
  $("totalDemand").textContent=hasWiser?duration(unionDuration(ranges)/60000):"—";
  $("demandNote").textContent=hasWiser?"Union of Wiser room requests · not gas use":"No Wiser demand history";
  $("underfloorTime").textContent=hasUnder?duration(under.reduce((n,r)=>n+r.onMinutes,0)):"—";
  const havePower=hasUnder&&under.some(r=>r.kwh!==null);
  $("electricEnergy").textContent=havePower?s.estimateKwh.toFixed(2)+" kWh":"—";
  $("electricCost").textContent=havePower?"£"+s.estimatePounds.toFixed(2):"—";
  $("electricNote").textContent=havePower?"Estimated from heater wattage × ON hours":"Enter verified heater power";
  $("costNote").textContent="Electric only · gas excluded";
  $("zoneCount").textContent=data.zones.length+" EXAMPLE / IMPORTED DEVICES";
}
function renderZones(s){
  const byId=new Map(s.rows.map(r=>[r.zoneId,r]));
  $("zones").innerHTML=data.zones.map(z=>{
    const r=byId.get(z.id),state=latestState(z.id);
    const header='<div class="zone-head"><div><span class="zone-source">'+(z.provider==="wiser"?"DRAYTON WISER":"WARMUP ELEMENT")+
      ' · '+z.energyType.toUpperCase()+'</span><div class="zone-name">'+esc(z.name)+'</div></div><span class="heat-chip">'+
      (state==="on"?"● Calling for heat":state==="off"?"○ Idle":"? Unknown")+'</span></div>';
    const temp=z.current===null?"—":z.current.toFixed(1)+"°",target=z.target===null?"—":z.target.toFixed(1)+"°";
    const controls=z.target===null?"":'<div class="step-buttons"><button data-temp="'+esc(z.id)+'" data-delta="-0.5" title="Demo only: lower target" aria-label="Lower demo target for '+esc(z.name)+'">−</button><button data-temp="'+esc(z.id)+'" data-delta="0.5" title="Demo only: raise target" aria-label="Raise demo target for '+esc(z.name)+'">+</button></div>';
    const times=r.coverage>0?duration(r.onMinutes):"Unknown",energy=r.kwh===null?"":" · ~"+r.kwh.toFixed(2)+" kWh";
    return '<article class="zone-card '+(state==="on"?"active":"")+'">'+header+
      '<div class="zone-temp"><div><small>Temperature</small><strong>'+temp+'</strong></div><div class="target"><small>Target · demo only</small><strong>'+target+'</strong></div>'+controls+'</div>'+
      '<div class="zone-bottom"><span>Demand / ON time</span><strong>'+times+energy+'</strong></div>'+
      '<div class="zone-evidence">'+esc(z.description)+' · '+("Known state "+Math.round(100*r.coverage)+"%"+(r.unknownMinutes>0.1?" · gaps "+duration(r.unknownMinutes):""))+'</div></article>';
  }).join("");
}
function renderSettings(){
  $("tariff").value=String(settings.price);
  $("powerFields").innerHTML=data.zones.filter(z=>z.provider==="warmup"&&z.energyType==="electric").map(z=>
    '<label class="field"><span>'+esc(z.name)+' heater rating (W)</span><input type="number" inputmode="numeric" min="0" max="50000" step="10" data-watt="'+
    esc(z.id)+'" placeholder="Enter rated watts" value="'+(power(z)??"")+'"><small>'+
    (imported?"Verify the installed electrical rating":"750 W is a fictional example; enter installed rating")+'</small></label>').join("");
}
function renderTimeline(){
  const bounds=range(),a=ms(bounds.from),b=ms(bounds.until),length=b-a;
  const ticks=[0,.25,.5,.75,1].map(f=>'<span>'+(period==="7d"?new Date(a+length*f).toLocaleDateString("en-GB",{weekday:"short",day:"numeric"}):fmtTime(a+length*f))+'</span>').join("");
  const rows=data.zones.map(z=>{
    const parts=clipIntervals(data.intervals,bounds.from,bounds.until,z.id);
    const segments=parts.map(p=>{
      const left=(p.a-a)*100/length,width=(p.b-p.a)*100/length;
      return '<span class="segment '+p.state+'" style="left:'+left+'%;width:'+width+'%" title="'+esc(z.name)+' · '+p.state.toUpperCase()+' · '+esc(fmtStamp(p.a))+' to '+esc(fmtTime(p.b))+'"></span>';
    }).join("");
    const mins=unionDuration(parts.filter(p=>p.state==="on"))/60000;
    return '<div class="time-row"><div class="time-zone"><strong>'+esc(z.name)+'</strong><span>'+duration(mins)+' calling</span></div>'+
      '<div class="track" role="img" aria-label="'+esc(z.name)+': '+duration(mins)+' heating call; hatched portions have unknown state">'+segments+'</div></div>';
  }).join("");
  $("timeline").innerHTML='<div class="timeline-labels"><span>HEATING ZONE</span><div class="time-ticks">'+ticks+'</div></div>'+rows;
  $("rangeDescription").textContent=(period==="7d"?"Past seven days":period==="yesterday"?"Yesterday":"Today")+
    " · "+fmtStamp(a)+" to "+fmtStamp(b)+". Amber indicates heat demand/relay, not a schedule.";
  document.querySelectorAll("[data-period]").forEach(btn=>{const yes=btn.dataset.period===period;btn.classList.toggle("selected",yes);btn.setAttribute("aria-pressed",String(yes));});
}
function eventsInRange(){
  const b=range(),result=[];
  for(const z of data.zones){
    const on=clipIntervals(data.intervals,b.from,b.until,z.id).filter(x=>x.state==="on");
    for(const r of on)result.push({zone:z.name,provider:z.provider,evidence:r.evidence,start:r.a,end:r.b,minutes:(r.b-r.a)/60000});
  }
  return result.sort((a,b)=>b.start-a.start);
}
function renderEvents(){
  const events=eventsInRange();
  $("events").innerHTML=events.length?events.slice(0,18).map(e=>
    '<div class="event"><div><div class="event-name">'+esc(e.zone)+'</div><div class="event-detail">'+
    (e.provider==="wiser"?"Wiser":"Warmup")+' · '+esc(e.evidence)+'</div></div><div class="event-time">'+fmtStamp(e.start)+
    ' – '+fmtTime(e.end)+'<strong>'+duration(e.minutes)+'</strong></div></div>').join(""):
    '<p class="event-empty">No heat-on intervals were recorded. Missing history does not mean the heater was off.</p>';
}
function render(){
  const s=summarise();renderTop(s);renderZones(s);renderTimeline();renderEvents();
  $("sourceBadge").textContent=imported?"● IMPORTED HISTORY":"● DEMO DATA";
  $("sourceBadge").classList.toggle("imported",imported);
  const stale=Date.now()-ms(data.generatedAt)>15*60000;
  $("footerStatus").textContent=imported?"Imported "+fmtStamp(ms(data.generatedAt))+(stale?" · possibly stale":""):"Prototype v0.3.0 · no physical connections";
  $("importStatus").textContent=imported?"Loaded "+data.zones.length+" devices and "+data.intervals.length+
    " intervals locally. Nothing was uploaded. "+(stale?"The export may be stale; current statuses are not assumed.":""):
    "Fictional data only. The private bridge must supply actual Wiser heat demand and Warmup relay/energy observations before this becomes live.";
}
$("zones").addEventListener("click",event=>{
  const b=event.target.closest("button[data-temp]");if(!b)return;
  const z=data.zones.find(x=>x.id===b.dataset.temp);if(!z||z.target===null)return;
  z.target=Math.max(5,Math.min(35,Math.round((z.target+Number(b.dataset.delta))*2)/2));
  renderZones(summarise());
  $("importStatus").textContent="Only the on-screen demonstration target changed. No thermostat command was sent.";
});
document.querySelectorAll("[data-period]").forEach(b=>b.addEventListener("click",()=>{period=b.dataset.period;render();}));
$("tariff").addEventListener("change",event=>{
  const price=finite(event.target.value,0,300);if(price===null){event.target.value=String(settings.price);return;}
  settings.price=price;save();render();
});
$("powerFields").addEventListener("change",event=>{
  const el=event.target.closest("input[data-watt]");if(!el)return;
  const watts=finite(el.value,0,50000);if(watts===null)delete settings.powers[el.dataset.watt];else settings.powers[el.dataset.watt]=watts;
  save();render();
});
$("importFile").addEventListener("change",async event=>{
  const file=event.target.files?.[0];if(!file)return;
  try{
    if(file.size>5*1024*1024)throw Error("History file must be under 5 MB.");
    data=validateImport(JSON.parse(await file.text()));imported=true;period="today";renderSettings();render();
  }catch(err){$("importStatus").textContent="Import rejected: "+String(err.message||err).slice(0,240);}
  event.target.value="";
});
$("resetDemo").addEventListener("click",()=>{data=createDemo();imported=false;period="today";renderSettings();render();});
$("csvExport").addEventListener("click",()=>{
  const table=[["Zone","Provider","Start ISO","End ISO","Minutes","Evidence"],...eventsInRange().map(x=>[x.zone,x.provider,new Date(x.start).toISOString(),new Date(x.end).toISOString(),x.minutes.toFixed(2),x.evidence])];
  const csv=table.map(row=>row.map(v=>{const val=String(v??"");const safe=/^[=+\-@]/.test(val)?"'"+val:val;return '"'+safe.replace(/"/g,'""')+'"';}).join(",")).join("\r\n");
  const url=URL.createObjectURL(new Blob([csv],{type:"text/csv;charset=utf-8"})),link=document.createElement("a");
  link.href=url;link.download="heating-events.csv";document.body.append(link);link.click();link.remove();URL.revokeObjectURL(url);
});
$("loadLocal").addEventListener("click",()=>{
  $("importStatus").textContent="To connect: run a private Home Assistant/openHAB bridge on your Pi, record verified demand/relay state changes, then import a JSON export. See the integration guide. Do not place credentials or LAN IP addresses in the public repository.";
  $("sourcesTitle").scrollIntoView({behavior:"smooth",block:"start"});
});
renderSettings();render();
