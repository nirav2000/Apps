// Timed learning breaks and schedule warnings. Evidence, not a resettable
// countdown, determines eligibility. These defaults are a teaching policy,
// not a claim that these exact intervals are scientifically optimal.
import {ALL_UNITS,unitsForTrack} from './guided-lessons.js';
import {teachingFinishedAt,checkResult,pendingChecks} from './assessment.js';
import {CHECK_WINDOWS,ASSESSMENT_DAY as DAY} from '../../learning-evidence/v1/assessment.js';
export const MINUTE=60000;
export const MINIMUM_REST_MS=5*MINUTE;
export const GRACE_MS=Object.freeze({immediate:30*MINUTE,day1:12*60*MINUTE,day3:DAY,day7:2*DAY,day28:7*DAY});
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const shortDate=ms=>new Date(ms).toLocaleString('en-GB',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'});
const REST_TITLE='Time to let it settle';
const REST_COPY='Do something unrelated. Return and see what you can remember without looking.';
const LOCK_ICON='<svg class="ft-rest-lock" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3m-4 4v3"/></svg>';
export const restButtonContent=active=>active?LOCK_ICON+'<span>Continue when the break finishes</span>':'Start independent recall';
export function restForUnit(unitId,entries,now=Date.now()){
 const anchor=teachingFinishedAt(unitId,entries,now);
 if(anchor===null||now<anchor||now>=anchor+DAY)return null;
 // Do not invalidate any observations made before this policy was installed.
 const immediate=checkResult(unitId,'immediate',entries,now);
 if(immediate.attempted.length)return null;
 const readyAt=anchor+MINIMUM_REST_MS;
 return {unitId,anchor,readyAt,remaining:Math.max(0,readyAt-now),active:now<readyAt};
}
export function activeRest(entries,now=Date.now(),track='michaela'){
 // Only recent completions can possibly require a five-minute break.
 const recent=new Set(entries.filter(e=>e.at>now-MINIMUM_REST_MS&&e.at<=now&&e.source?.ref?.startsWith('guided-v2:')&&e.source.ref.endsWith(':complete')&&!e.source.ref.includes(':review-')).map(e=>e.source.ref.split(':')[1]));
 const units=track==null?ALL_UNITS:unitsForTrack(track);
 return units.filter(u=>recent.has(u.id)).map(u=>{const rest=restForUnit(u.id,entries,now);return rest?{...rest,track:u.track||'michaela'}:null;}).filter(x=>x?.active).sort((a,b)=>b.readyAt-a.readyAt)[0]||null;
}
const dueTime=(anchor,w)=>anchor+(w.id==='immediate'?MINIMUM_REST_MS:w.from*DAY);
export function scheduledPractice(entries,now=Date.now(),track='michaela'){
 const due=[];
 let next=null;
 const touched=new Set(entries.filter(e=>e.source?.ref?.startsWith('guided-v2:')&&e.source.ref.endsWith(':complete')).map(e=>e.source.ref.split(':')[1]));
 for(const u of unitsForTrack(track)){
  if(!touched.has(u.id))continue;
  const anchor=teachingFinishedAt(u.id,entries,now);
  if(anchor===null||now<anchor)continue;
  const current=CHECK_WINDOWS.find(w=>now>=dueTime(anchor,w)&&now<anchor+w.to*DAY)||(now<anchor+MINIMUM_REST_MS&&checkResult(u.id,'immediate',entries,now).attempted.length?CHECK_WINDOWS[0]:null);
  const upcoming=CHECK_WINDOWS.find(w=>dueTime(anchor,w)>now);
  if(upcoming){const at=dueTime(anchor,upcoming);if(!next||at<next.at)next={at,stage:upcoming.id,unitId:u.id,name:u.name};}
  if(!current)continue;
  const result=checkResult(u.id,current.id,entries,now);
  if(result.complete)continue;
  const at=dueTime(anchor,current),lateAt=at+GRACE_MS[current.id];
  const missed=CHECK_WINDOWS.filter(w=>w.from<current.from&&!checkResult(u.id,w.id,entries,now).complete).map(w=>w.id);
  due.push({unitId:u.id,name:u.name,stage:current.id,label:current.label,at,lateAt,overdue:now>=lateAt||missed.length>0,lateMs:Math.max(0,now-at),missed,key:u.id+':'+current.id+':'+anchor});
 }
 due.sort((a,b)=>Number(b.overdue)-Number(a.overdue)||a.at-b.at);
 return {due,next,overdue:due.filter(x=>x.overdue)};
}
export function prioritizedChecks(entries,now=Date.now(),track='michaela'){
 const schedule=scheduledPractice(entries,now,track);
 const order=new Map(schedule.due.map((x,i)=>[x.unitId+':'+x.stage,i]));
 return pendingChecks(entries,now,track).filter(d=>order.has(d.unitId+':'+d.stage)).sort((a,b)=>order.get(a.unitId+':'+a.stage)-order.get(b.unitId+':'+b.stage));
}
export function overdueWords(rows,now=Date.now()){
 return rows.filter(x=>x.dueAt!==null&&Number.isFinite(x.dueAt)&&now>=x.dueAt+30*MINUTE)
 .map(x=>({key:'word:'+x.key+':'+x.dueAt,at:x.dueAt})).sort((a,b)=>a.at-b.at);
}
export function countdownText(ms){
 const s=Math.max(0,Math.ceil(ms/1000)),m=Math.floor(s/60);
 return String(m).padStart(2,'0')+':'+String(s%60).padStart(2,'0');
}
export function lateText(ms){
 const minutes=Math.max(0,Math.floor(ms/MINUTE));
 if(minutes<60)return minutes+' min';
 const hours=Math.floor(minutes/60);
 if(hours<48)return hours+' h';
 return Math.floor(hours/24)+' d '+hours%24+' h';
}
export function restMarkup(rest,now=Date.now()){
 if(!rest)return '';
 const active=now<rest.readyAt;
 const ticks=Array.from({length:60},(_,i)=>'<line x1="60" y1="'+(i%5===0?7:9)+'" x2="60" y2="13" transform="rotate('+(i*6)+' 60 60)" stroke="currentColor" stroke-width="'+(i%5===0?1.8:.8)+'" opacity="'+(i%5===0?.7:.25)+'"/>').join('');
 return '<div class="ft-rest-clock" data-rest-until="'+rest.readyAt+'" data-rest-anchor="'+rest.anchor+'" role="timer" aria-label="Learning break: '+countdownText(rest.readyAt-now)+' remaining"><svg class="ft-rest-dial" viewBox="0 0 120 120" aria-hidden="true"><circle cx="60" cy="60" r="54" class="ft-rest-track"/><circle cx="60" cy="60" r="54" class="ft-rest-ring" data-rest-ring transform="rotate(-90 60 60)"/>'+ticks+'<line x1="60" y1="60" x2="60" y2="19" data-rest-hand class="ft-rest-hand"/><circle cx="60" cy="60" r="3.4" class="ft-rest-pivot"/><text x="60" y="43" text-anchor="middle" data-rest-time>'+countdownText(rest.readyAt-now)+'</text></svg>'+
 '<div class="ft-rest-copy"><strong data-rest-label>'+(active?REST_TITLE:'Ready for independent recall')+'</strong><p data-rest-description>'+(active?REST_COPY:'The minimum break has elapsed. Try to recall the French without reviewing it first.')+'</p><small>Minimum break: '+Math.round((rest.readyAt-rest.anchor)/MINUTE)+' minutes</small><small class="ft-rest-resume">Resume '+esc(shortDate(rest.readyAt))+'</small><div class="ft-rest-live" aria-live="polite" data-rest-live></div></div></div>';
}
export function updateStudyClocks(root,now=Date.now()){
 for(const clock of root.querySelectorAll('[data-rest-until]')){
  const remaining=Math.max(0,Number(clock.dataset.restUntil)-now),active=remaining>0;
  const duration=Number(clock.dataset.restUntil)-Number(clock.dataset.restAnchor);
  const fraction=Math.min(1,remaining/Math.max(1,duration));
  const c=2*Math.PI*54;
  clock.querySelector('[data-rest-time]').textContent=countdownText(remaining);
  clock.setAttribute('aria-label','Learning break: '+countdownText(remaining)+' remaining');
  clock.querySelector('[data-rest-ring]').setAttribute('stroke-dasharray',(fraction*c)+' '+c);
  clock.querySelector('[data-rest-hand]').setAttribute('transform','rotate('+(fraction*360)+' 60 60)');
  clock.querySelector('[data-rest-label]').textContent=active?REST_TITLE:'Ready for independent recall';
  clock.querySelector('[data-rest-description]').textContent=active?REST_COPY:'The minimum break has elapsed. Try to recall the French without reviewing it first.';
  const area=clock.closest('.ft-guided-congrats,.ft-path-next,.ft-global-rest')||clock.parentElement;
  const button=area.querySelector('[data-rest-continue]');
  if(button){button.disabled=active;button.setAttribute('aria-disabled',String(active));if(button.dataset.restLocked!==String(active)){button.innerHTML=restButtonContent(active);button.dataset.restLocked=String(active);}}
  const unitSelector=clock.closest('.ft-guided-shell')?.querySelector('[data-gunit]');
  if(unitSelector){unitSelector.disabled=active;if(!active)unitSelector.removeAttribute('aria-label');}
  if(clock.dataset.restRunning==='true'&&!active)clock.querySelector('[data-rest-live]').textContent='Break complete. You can continue.';
  clock.dataset.restRunning=String(active);
 }
}
export function noticeMarkup(schedule,words,rest,{enabled=false,supported=false,actions=true}={}){
 const n=schedule.overdue.length+words.length;
 if(!n&&!schedule.due.length&&!rest&&!schedule.next&&!supported)return '';
 const earliest=schedule.overdue[0],oldest=Math.min(...schedule.overdue.map(x=>x.at),words[0]?.at??Infinity),late=Number.isFinite(oldest)?lateText(Date.now()-oldest):'';
 const title=n?'Practice overdue':rest?'Learning break in progress':schedule.due.length?'Practice ready':schedule.next?'Next scheduled practice':'Practice reminders';
 const message=n?(schedule.overdue.length?schedule.overdue.length+' lesson check'+(schedule.overdue.length===1?'':'s')+' overdue. ':'')+(words.length?words.length+' personal revision item'+(words.length===1?'':'s')+' overdue. ':'')+(late?'Oldest shown: '+late+' since due.':'')+(earliest?.missed.length?' An earlier check was missed; do the current check rather than backdating it.':''):
 rest?'Your next independent check unlocks at '+shortDate(rest.readyAt)+'.':
 schedule.due.length?schedule.due[0].name+' · '+schedule.due[0].label+' check is ready.':
 schedule.next?schedule.next.name+' · '+shortDate(schedule.next.at)+'.':'No practice is currently scheduled.';
 return '<aside class="ft-timing-notice'+(n?' overdue':'')+'" aria-label="Practice schedule"><div><strong>'+esc(title)+'</strong><p>'+esc(message)+'</p></div><div class="ft-actions">'+
 (actions&&(rest||schedule.due.length)?'<button type="button" data-eact="daily" class="ft-primary">'+(rest?'View countdown':'Practise now')+'</button>':actions&&words.length?'<button type="button" data-act="revision-start" class="ft-primary">Review words</button>':'')+
 (supported?'<button type="button" data-act="practice-alerts">'+(enabled?'Turn off device alerts':'Enable device alerts')+'</button>':'')+
 '</div>'+(supported?'<small>Device alerts work while Next is running; reopen the app to see missed practice. No background push schedule is installed.</small>':'')+'</aside>';
}
// Keep system notifications generic and deduplicate per device and learner.
// Notification consent is requested only by a real user gesture in index.js.
export function alertKeys(schedule,words){return [...schedule.overdue.map(x=>x.key),...words.map(x=>x.key)];}
