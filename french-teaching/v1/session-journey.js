// Private, structured UI diagnostics. No input values, typed text, credentials,
// screen recording, raw DOM or keystrokes. Persisted via the existing scoped
// answer-audit transport as non-scoring signal records.
const h=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const clean=(s,n=220)=>String(s??'').replace(/\s+/g,' ').trim().slice(0,n);
const textOf=(node,selector,n)=>clean(node.querySelector(selector)?.textContent,n);
export const JOURNEY_MARKER='session-journey-v1';
export const JOURNEY_APP='next-french-journey';
// Save each small event locally before doing anything else. Upload immutable
// batches rather than one Firestore document per click. Retain event IDs
// across a crash between committing the batch and clearing the pending list.
export function createJourneyRecorder(store,storage=globalThis.localStorage){
 const key=store.key+':pending';
 let pending=JSON.parse(storage.getItem(key)||'[]');
 if(!Array.isArray(pending))pending=[];
 const persist=next=>{storage.setItem(key,JSON.stringify(next));pending=next;};
 return {append(event){persist([...pending,event]);},pending:()=>pending.slice(),
  size:()=>pending.length,rows:()=>store.getEntries(),
  flush(){
   while(pending.length){
    const batch=pending.slice(0,12);
    store.record({ref:'journey:batch',activity:'Session journey',question:'Session interaction events',result:'signal',marker:JOURNEY_MARKER,context:{journeyBatch:batch}});
    persist(pending.slice(batch.length));
   }
  }
 };
}
export function journeyControl(node){
 const d=node?.dataset||{};
 const key=d.eact?'assessment:'+d.eact:d.gact?'guided:'+d.gact:d.act?'action:'+d.act:d.page?'page:'+d.page:d.gchoice!==undefined?'guided:choice':d.gunit!==undefined?'guided:unit':d.profile!==undefined?'learner:change':d.track!==undefined?'track:change':'';
 if(!key)return null;
 // Never include input values, choice text or account-related labels.
 const privateControl=/sign.?in|sign.?out|password|google|passkey|profile|learner:change|track:change|guided:choice/.test(key);
 return {key:clean(key,140),label:privateControl?'':clean(node.textContent,100)};
}
export function todaySnapshot(root){
 const nodes=[...root.querySelectorAll('.ft-timing-notice,section.ft-card')].filter(n=>!n.closest('[hidden],details:not([open])')&&!n.parentElement?.closest('section.ft-card'));
 return nodes.map(n=>{
  const kind=n.matches('.ft-timing-notice')?'practice-notice':n.matches('.ft-unified-path')?'learning-path':n.matches('.ft-revision-summary')?'personal-revision':n.matches('.ft-todays-lesson')?'guided-lesson':n.matches('.ft-identity')?'account':'card';
  const title=textOf(n,kind==='practice-notice'?'strong':'h2,h3',140)||textOf(n,'.ft-eyebrow',100)||'Controls';
  if(kind==='account')return {kind,title,controls:[]};
  const controls=[...n.querySelectorAll('button[data-act],button[data-eact],button[data-gact],button[data-page]')].filter(b=>!b.closest('[hidden],details:not([open])')).map(b=>{const c=journeyControl(b);return c?{...c,disabled:!!b.disabled}:null;}).filter(Boolean).slice(0,60);
  const details=kind==='learning-path'?{mode:n.dataset.learningMode||'',next:textOf(n,'.ft-path-next h3',150),description:textOf(n,'.ft-path-next > p:not(.ft-eyebrow)',220),sequence:[...n.querySelectorAll('.ft-path-row')].map(r=>({name:textOf(r,'strong',100),status:textOf(r,'.ft-path-status',80)}))}:kind==='practice-notice'?{description:textOf(n,'p',240)}:kind==='guided-lesson'?{description:textOf(n,'h2 + p',180),modules:[...n.querySelectorAll('.ft-guided-unit-summary > div')].map(r=>({name:textOf(r,'strong',60),topic:textOf(r,'span',120),status:[...r.querySelectorAll('small')].map(x=>clean(x.textContent,100)).join(' · ')}))}:kind==='personal-revision'?{description:textOf(n,'h2',150)}:{};
  return {kind,title,...details,controls};
 });
}
export function journeyEntries(rows,track='',pending=[]){
 const result=new Map();
 for(const r of rows){
  if(r.answerAudit?.marker!==JOURNEY_MARKER)continue;
  const c=r.answerAudit.context||{};
  const batch=Array.isArray(c.journeyBatch)?c.journeyBatch:c.journey?[{id:r.id,at:r.at,sessionId:c.sessionId,track:c.track,...c.journey}]:[];
  for(const e of batch)if(e.id&&(!track||e.track===track))result.set(e.id,e);
 }
 for(const e of pending)if(e.id&&(!track||e.track===track))result.set(e.id,e);
 return [...result.values()].sort((a,b)=>a.at-b.at||a.sequence-b.sequence||String(a.id).localeCompare(String(b.id)));
}
export function journeySessions(rows){
 const by=new Map();
 for(const e of rows){if(!by.has(e.sessionId))by.set(e.sessionId,[]);by.get(e.sessionId).push(e);}
 return [...by].map(([id,events])=>({id,events,started:events[0].at,last:events.at(-1).at,track:events[0].track})).sort((a,b)=>b.last-a.last);
}
const time=at=>new Date(at).toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit',second:'2-digit'});
const date=at=>new Date(at).toLocaleString('en-GB',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'});
export function journeyPage(rows,track,warning='',pending=[]){
 const sessions=journeySessions(journeyEntries(rows,track,pending));
 const event=e=>{
  const title=e.type==='screen'?e.page==='home'?'Today displayed / updated':'Opened '+e.page:e.type==='click'?'Clicked '+(e.control?.label||e.control?.key||'control'):e.type==='submit'?'Submitted '+(e.form||'exercise'):e.type==='change'?'Changed '+(e.control?.key||'selection'):e.type==='visibility'?'App '+e.visibility:e.type==='revision-outcome'?'Revision '+(e.outcome||'updated'):e.type==='exercise-result'?'Exercise: '+(e.outcome||'recorded'):e.type==='plan'?'Planner selected: '+(e.mode||'activity'):e.type;
  const cards=e.cards?.length?'<details><summary>'+e.cards.length+' Today cards · view exact state</summary>'+e.cards.map(c=>'<div class="ft-journey-card"><strong>'+h(c.title)+'</strong><small>'+h(c.kind)+(c.mode?' · '+h(c.mode):'')+'</small>'+(c.next?'<p>Recommended: '+h(c.next)+'</p>':'')+(c.description?'<p>'+h(c.description)+'</p>':'')+(c.sequence?.length?'<p>'+c.sequence.map(x=>h(x.name)+' — '+h(x.status)).join(' · ')+'</p>':'')+(c.modules?.length?'<details><summary>Module status</summary>'+c.modules.map(x=>'<p>'+h(x.name)+' · '+h(x.topic)+' · '+h(x.status)+'</p>').join('')+'</details>':'')+(c.controls?.length?'<p>Controls: '+c.controls.map(x=>h(x.label||x.key)+(x.disabled?' (disabled)':'')).join(' · ')+'</p>':'')+'</div>').join('')+'</details>':'';
  return '<li><time>'+h(time(e.at))+'</time><div><strong>'+h(title)+'</strong><small>'+h(e.page||'')+(e.activity? ' · '+h(e.activity):'')+(e.card?' · '+h(e.card):'')+(e.ref?' · '+h(e.ref):'')+(e.unitId?' · '+h(e.unitId):'')+(e.stage?' · '+h(e.stage):'')+'</small>'+cards+'</div></li>';
 };
 return '<section class="ft-card ft-journey"><p class="ft-eyebrow">PRIVATE SESSION DIAGNOSTICS</p><h2>Session journey</h2><p>See what Today offered, which route you chose and what appeared next. Events are separate from mastery scores and use the existing learner-specific Firebase sync. This is an interaction log, not a recording of your screen or typing.</p><div class="ft-actions"><button data-act="export-journey">Export all session events</button><button data-act="sync">Sync</button></div>'+(warning?'<p role="status">'+h(warning)+'</p>':'')+'<p class="ft-small">'+sessions.length+' recorded sessions in this course · a new session starts after 30 minutes of inactivity or when you start another learning session. Previous activity before this release is not reconstructed.</p>'+
 (sessions.length?sessions.slice(0,20).map((s,i)=>'<details class="ft-journey-session"'+(!i?' open':'')+'><summary><strong>'+h(date(s.started))+'</strong><small>'+s.events.length+' events · last '+h(time(s.last))+'</small></summary><ol>'+s.events.map(event).join('')+'</ol></details>').join(''):'<p>No session journey recorded yet. Use Today to begin.</p>')+'<p class="ft-small">The latest 20 sessions are shown; export includes every saved event for this learner and course.</p></section>';
}
