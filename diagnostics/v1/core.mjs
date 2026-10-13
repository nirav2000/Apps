/** Shared Diagnostics 1.0.0. Pure, bounded, allow-listed evidence; no network. */
export const VERSION = '1.0.0';
export const LIMITS = Object.freeze({events:600, frames:36, nodes:64, seconds:120, reports:12, bytes:2_000_000});
const num = (x, fallback=0) => Number.isFinite(Number(x)) ? Number(x) : fallback;
export const round = x => Math.round(num(x)*10)/10;
export const id = x => String(x||'').replace(/[^a-zA-Z0-9_.:-]/g,'').slice(0,100);
export const cleanText = (x, max=160) => String(x??'').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g,'').slice(0,max);
export const rect = r => ({x:round(r?.x),y:round(r?.y),width:Math.max(0,round(r?.width)),height:Math.max(0,round(r?.height))});
export function viewport(v={}) { return {...rect(v),scale:Math.max(.1,Math.min(10,num(v.scale,1))),layoutWidth:round(v.layoutWidth),layoutHeight:round(v.layoutHeight)}; }
export function context(c={}) {
  // No arbitrary app state, typed text, user identifiers, URLs or storage is accepted.
  const result={};
  for(const key of ['phase','view','layout','palette','profile','mode','orientation','inputMode']) if(c[key]!=null) result[key]=id(c[key]);
  for(const key of ['target','round','found','total','remainingMs']) if(Number.isFinite(c[key])) result[key]=Math.max(0,round(c[key]));
  result.customKeypad=c.customKeypad===true;
  return result;
}
export const intersect = (a,b) => Math.max(0,Math.min(a.x+a.width,b.x+b.width)-Math.max(a.x,b.x))*Math.max(0,Math.min(a.y+a.height,b.y+b.height)-Math.max(a.y,b.y));
export function cleanFrame(f={}) {
  return {time:Math.max(0,num(f.time)), reason:id(f.reason),viewport:viewport(f.viewport),context:context(f.context),
    focusedEditable:f.focusedEditable===true,scroll:{x:round(f.scroll?.x),y:round(f.scroll?.y)},
    durationMs:Math.max(0,round(f.durationMs)),nodes:(Array.isArray(f.nodes)?f.nodes:[]).slice(0,LIMITS.nodes).map(n=>({
      id:id(n.id),role:['target','pair','action','key','blocker','other'].includes(n.role)?n.role:'other',
      label:cleanText(n.label,40),rect:rect(n.rect),visible:n.visible===true,required:n.required===true,
      clipped:n.clipped===true,obstructed:n.obstructed===true,blocker:id(n.blocker)
    }))};
}
export function cleanEvent(e={}) {
  return {time:Math.max(0,num(e.time)),type:id(e.type),target:id(e.target),pointer:['mouse','touch','pen','keyboard'].includes(e.pointer)?e.pointer:'',
    ...(Number.isFinite(e.x)&&Number.isFinite(e.y)?{x:round(e.x),y:round(e.y)}:{})};
}
export class RollingEvidence {
  constructor(now=()=>Date.now()){this.now=now;this.events=[];this.frames=[];}
  prune(){const since=this.now()-LIMITS.seconds*1000;this.events=this.events.filter(e=>e.time>=since).slice(-LIMITS.events);this.frames=this.frames.filter(e=>e.time>=since).slice(-LIMITS.frames);}
  event(e){this.events.push(cleanEvent({...e,time:this.now()}));this.prune();}
  frame(f){this.frames.push(cleanFrame({...f,time:this.now()}));this.prune();}
  clear(){this.events=[];this.frames=[];}
  snapshot(){this.prune();return structuredClone({events:this.events,frames:this.frames});}
}
const suggestion={
  'outside-viewport':'Keep the target and every factor pair inside the visible play area; resize the board, not just the page.',
  'clipped':'Remove unintended overflow clipping or allocate enough space for this element.',
  'covered':'Reserve space for the keypad or navigation so it does not cover the board.',
  'hit-test-obstruction':'Inspect the element above this control; hit testing alone does not prove visual occlusion.',
  'native-focus':'Route custom-keypad entry without focusing an editable field. Verify on the real device.',
  'action-moved':'Keep the same Enter/Next action anchor through the play-to-review transition.',
  'small-target':'Consider a larger touch target without reducing the space reserved for answers.'
};
export function analyse(frames=[]) {
  const results=new Map();
  const add=(f,n,code,level,evidence)=>{
    const key=[code,n?.id||'input',f.context.profile,f.context.layout].join(':');
    const prior=results.get(key);
    if(prior){prior.count++;prior.lastSeen=f.time;return;}
    results.set(key,{id:key,code,level,element:n?.id||'input',profile:f.context.profile||'unknown',layout:f.context.layout||'unknown',
      firstSeen:f.time,lastSeen:f.time,count:1,evidence,suggestion:suggestion[code]});
  };
  let before=null;
  for(const raw of frames){
    const f=cleanFrame(raw),v=f.viewport;
    if(!v.width||!v.height)continue;
    const blocked=new Map(f.nodes.filter(n=>n.role==='blocker'&&n.visible).map(n=>[n.id,n]));
    for(const n of f.nodes){
      if(n.required&&(!n.visible||n.rect.x<v.x-1||n.rect.y<v.y-1||n.rect.x+n.rect.width>v.x+v.width+1||n.rect.y+n.rect.height>v.y+v.height+1))
        add(f,n,'outside-viewport','measured',`${n.id}: ${JSON.stringify(n.rect)}; visible viewport ${JSON.stringify(v)}; rendered=${n.visible}`);
      if(n.required&&n.clipped)add(f,n,'clipped','measured','The element intersects an ancestor clipping boundary.');
      if(n.required&&n.blocker&&blocked.has(n.blocker))add(f,n,'covered','measured',`Overlaps the visible ${n.blocker} by ${round(intersect(n.rect,blocked.get(n.blocker).rect))} square CSS pixels.`);
      else if(n.required&&n.obstructed)add(f,n,'hit-test-obstruction','suspected','A different element receives hit tests at the centre and/or sampled edges.');
      if(['action','key'].includes(n.role)&&n.visible&&(n.rect.width<44||n.rect.height<44))add(f,n,'small-target','suggestion',`Touch target ${n.rect.width} x ${n.rect.height} CSS px; design goal 44 x 44.`);
    }
    if(f.context.customKeypad&&f.focusedEditable)add(f,null,'native-focus','suspected','An editable field has focus while the custom keypad is active. This is not proof that the OS keyboard is displayed.');
    if(before&&before.context.phase==='running'&&f.context.phase==='finished'&&before.context.profile===f.context.profile&&before.context.layout===f.context.layout&&JSON.stringify(before.viewport)===JSON.stringify(v)){
      const a=before.nodes.find(n=>n.role==='action'&&n.visible),b=f.nodes.find(n=>n.role==='action'&&n.visible);
      if(a&&b&&['x','y','width','height'].some(k=>Math.abs(a.rect[k]-b.rect[k])>1))add(f,b,'action-moved','measured',`Play ${JSON.stringify(a.rect)}; review ${JSON.stringify(b.rect)}.`);
    }
    before=f;
  }
  return [...results.values()].slice(0,100);
}
export function makeReport({appId,appVersion,repository,evidence={},comment=''}){
  const frames=(evidence.frames||[]).slice(-LIMITS.frames).map(cleanFrame),events=(evidence.events||[]).slice(-LIMITS.events).map(cleanEvent);
  return {schema:'apps.diagnostics.v1',libraryVersion:VERSION,id:'diag-'+crypto.randomUUID(),appId:id(appId),appVersion:cleanText(appVersion,40),
    repository:/^[\w.-]+\/[\w.-]+$/.test(repository||'')?repository:'',createdAt:new Date().toISOString(),
    evidenceType:'Measured app geometry and received events; NOT a screenshot or video',comment:cleanText(comment,1200),frames,events,findings:analyse(frames)};
}
export function importReport(text){
  if(typeof text!=='string'||new TextEncoder().encode(text).length>LIMITS.bytes)throw Error('Report exceeds the 2 MB import limit.');
  let x;try{x=JSON.parse(text);}catch{throw Error('This is not a diagnostic JSON report.');}
  if(x?.schema!=='apps.diagnostics.v1'||!Array.isArray(x.frames)||!Array.isArray(x.events)||!/^diag-[a-f0-9-]{36}$/.test(x.id||''))throw Error('Unsupported diagnostic report.');
  const r=makeReport({...x,evidence:x});r.id=x.id;r.createdAt=Number.isFinite(Date.parse(x.createdAt))?new Date(x.createdAt).toISOString():r.createdAt;
  // Never trust imported publication status, findings, credentials, HTML or arbitrary fields.
  return r;
}
export function issueText(report,comment=report.comment){
  const r=importReport(JSON.stringify(report)),f=r.frames.at(-1),c=f?.context||{},v=f?.viewport||{};
  const evidence=r.findings.slice(0,10).map(x=>`- [${x.level}] ${x.code} / ${x.element} (${x.count} observations)\n  Evidence: ${x.evidence}\n  Suggested fix: ${x.suggestion}`).join('\n');
  return [`[${r.appId}] UI diagnostic report`, `Target repository: ${r.repository||'Confirm before editing'}`,
    `App version: ${r.appVersion}; shared diagnostics: ${VERSION}`,`Report ID: ${r.id}; captured ${r.createdAt}`,
    `Profile: ${c.profile||'unknown'}; layout: ${c.layout||'unknown'}; palette: ${c.palette||'unknown'}; mode: ${c.mode||'unknown'}`,
    `Visual viewport: ${v.width||0} x ${v.height||0} CSS px; scale ${v.scale||1}; orientation ${c.orientation||'unknown'}`,
    `Round phase: ${c.phase||'unknown'}; target: ${c.target??'not captured'}; pairs: ${c.found??'?'} / ${c.total??'?'}`,
    '', '## Owner comment',cleanText(comment,1200)||'No additional comment.', '', '## Findings',evidence||'No measured problem was detected in this sample. This is not a guarantee of visual correctness.',
    '', '## Evidence limits',`${r.frames.length} geometry frames and ${r.events.length} received events. Not a pixel recording. No system UI, typed text, account data or credentials are included. Native media remains local unless the owner separately attaches it.`,
    '', '## Acceptance', 'Reproduce the evidence; keep the target and all pairs visible. Preserve the action position and shared learning data. Test phone and tablet independently in Chromium and WebKit. A closed issue alone is not a verified deployment.'
  ].join('\n').slice(0,5800);
}
