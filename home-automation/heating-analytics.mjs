/* Heating Intelligence analytics — pure, dependency-free, independently testable.
   Units: timestamps are ISO strings; durations in ms/minutes; energy in kWh.
   Important: Wiser heating demand is NOT a gas-meter measurement. */
export const ms = value => {
  const result = Date.parse(value);
  return Number.isFinite(result) ? result : NaN;
};

export function clipIntervals(intervals, from, until, zoneId) {
  const start=typeof from==="number"?from:ms(from), end=typeof until==="number"?until:ms(until);
  if (!Number.isFinite(start)||!Number.isFinite(end)||end<=start) throw new Error("Invalid time window");
  return (Array.isArray(intervals)?intervals:[]).filter(x=>x && x.zoneId===zoneId && ["on","off","unknown"].includes(x.state)).map(x=>{
    const a=Math.max(start,ms(x.start)), b=Math.min(end,ms(x.end));
    return {...x,a,b};
  }).filter(x=>Number.isFinite(x.a)&&Number.isFinite(x.b)&&x.b>x.a).sort((a,b)=>a.a-b.a);
}

export function unionDuration(ranges) {
  const values=ranges.filter(x=>Number.isFinite(x.a)&&Number.isFinite(x.b)&&x.b>x.a).sort((a,b)=>a.a-b.a);
  let total=0, a=null, b=null;
  for(const item of values) {
    if(a===null){a=item.a;b=item.b;continue;}
    if(item.a<=b)b=Math.max(b,item.b);
    else{total+=b-a;a=item.a;b=item.b;}
  }
  if(a!==null)total+=b-a;
  return total;
}

export function hourlyActivity(intervals,from,until,zoneId) {
  const first=ms(from),last=ms(until);
  const count=Math.max(1,Math.ceil((last-first)/3600000));
  return Array.from({length:count},(_,i)=>{
    const a=first+i*3600000,b=Math.min(a+3600000,last);
    const segments=clipIntervals(intervals,a,b,zoneId);
    const on=unionDuration(segments.filter(x=>x.state==="on"));
    const known=unionDuration(segments.filter(x=>x.state!=="unknown"));
    return {start:new Date(a).toISOString(),onMinutes:on/60000,coverage:Math.min(1,known/(b-a))};
  });
}

export function summarize({zones,intervals,from,until,pricePence=23.10}) {
  const start=ms(from),end=ms(until);
  if(!Number.isFinite(start)||!Number.isFinite(end)||start>=end) throw new Error("Invalid time window");
  if(!Number.isFinite(Number(pricePence))||Number(pricePence)<0)throw new Error("Invalid electricity tariff");
  const rows=(zones||[]).map(zone=>{
    const points=clipIntervals(intervals,start,end,zone.id);
    const active=points.filter(x=>x.state==="on");
    const onMs=unionDuration(active);
    const coveredMs=unionDuration(points.filter(x=>x.state!=="unknown"));
    const unknownMs=Math.max(0,end-start-coveredMs);
    const powerW=Number(zone.powerW);
    const eligible=zone.provider==="warmup" && zone.energyType==="electric" && Number.isFinite(powerW) && powerW>0;
    const kwh=eligible?onMs/3600000*powerW/1000:null;
    const costPounds=kwh===null?null:kwh*Number(pricePence)/100;
    // Count transitions after merging overlaps, not duplicated polling records.
    let starts=0,lastOnEnd=-Infinity;
    for(const item of active) {if(item.a>lastOnEnd)starts++;lastOnEnd=Math.max(lastOnEnd,item.b);}
    return {zoneId:zone.id,name:zone.name,provider:zone.provider,energyType:zone.energyType,
      onMinutes:onMs/60000,unknownMinutes:unknownMs/60000,coverage:Math.min(1,coveredMs/(end-start)),
      cycles:starts,kwh,costPounds,estimated:kwh!==null,points:points.length};
  });
  const knownElectric=rows.filter(r=>r.kwh!==null);
  const gasZones=rows.filter(r=>r.energyType==="gas");
  const demandRanges=gasZones.flatMap(r=>clipIntervals(intervals,start,end,r.zoneId).filter(x=>x.state==="on"));
  return {rows,estimateKwh:knownElectric.reduce((v,r)=>v+r.kwh,0),estimatePounds:knownElectric.reduce((v,r)=>v+r.costPounds,0),
    hasElectricEstimate:knownElectric.length>0,boilerDemandMinutes:unionDuration(demandRanges)/60000,
    hasGasMeasurement:false,from:new Date(start).toISOString(),until:new Date(end).toISOString()};
}
