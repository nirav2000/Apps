// Read-only roadmap: actual core teaching, not predictions of fluency.
import {TRACKS,trackName} from './curriculum-meta.js';
import {unitsForTrack,guidedLesson,guidedStatus,guidedRefs} from './guided-lessons.js';
import {assessmentStats,checkResult} from './assessment.js';
import {normaliseAnswer} from './data.js';
const h=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const norm=normaliseAnswer;
const unique=(xs,key)=>{const seen=new Set();return xs.filter(x=>{const k=key(x);if(!k||seen.has(k))return false;seen.add(k);return true;});};
const model=s=>s.kind==='model'&&!['independent','transfer','review'].includes(s.stage);
const title=u=>[u.label,u.name].filter(Boolean).join(' · ');
export const ROADMAP_VIEWS=['journey','compare','curriculum','analysis'];
const minutes=[5,10,15,20,30,45,60],seconds=[15,20,30,45,60,90];
const choice=(v,a,d)=>a.includes(Number(v))?Number(v):d;
export function roadmapSettings(p={}){return {view:ROADMAP_VIEWS.includes(p.view)?p.view:'journey',track:TRACKS.some(t=>t.id===p.track)?p.track:'',minutes:choice(p.minutes,minutes,15),seconds:choice(p.seconds,seconds,30),query:String(p.query||'').slice(0,160)};}
export function teachingDays(steps,m=15,s=30){return Math.ceil(Math.max(0,steps)*choice(s,seconds,30)/(60*choice(m,minutes,15)));}
export function stepName(s){return ({introduce:'New building block',recall:'Say it from memory',build:'Build a sentence',reverse:'Understand the French',write:'Write without help'})[s.unlockAction]||({model:'Listen and repeat',choice:'Recognise the French',listen:'Listen for meaning',transcribe:'Listen and type',write:'Construct the French'})[s.kind]||'Practice';}
export function roadmapData(track,entries=[],now=Date.now(),settings={}){
 const p=roadmapSettings(settings),seen=new Set(),completedModels=new Set(),refs=new Set(entries.filter(e=>Number(e.at)<=now).map(e=>e.source?.ref));
 let total=0,done=0,remaining=0,repairs=0;
 const units=unitsForTrack(track).map(u=>{
  const steps=guidedLesson(u.id).steps,status=guidedStatus(u.id,entries,now);
  const complete=steps.filter(s=>refs.has(guidedRefs(s.id).complete)).length,left=steps.length-complete;
  const intro=u.blocks||unique(steps.filter(s=>s.stage==='present'&&model(s)),s=>norm(s.fr));
  const newItems=intro.filter(s=>{const k=norm(s.fr);if(!k||seen.has(k))return false;seen.add(k);return true;});
  for(const s of steps.filter(model))if(refs.has(guidedRefs(s.id).complete))completedModels.add(norm(s.fr));
  const example=(u.incremental?steps.filter(s=>model(s)&&s.unlockAction==='build').at(-1):u.bridge)||steps.filter(model).at(-1);
  const start=total+1;total+=steps.length;done+=complete;remaining+=left;
  const pendingRepairs=Math.max(0,(status.teaching.repairTotal||0)-(status.teaching.repairCompleted||0));repairs+=pendingRepairs;
  return {unit:u,steps,newItems,example,complete,total:steps.length,left,start,end:total,pendingRepairs,forecastDays:left?teachingDays(remaining,p.minutes,p.seconds):0,allComplete:left===0&&pendingRepairs===0};
 });
 return {track,units,coreTotal:total,coreCompleted:done,remaining,repairs,uniqueNew:seen.size,modelsCompleted:completedModels.size,days:teachingDays(remaining,p.minutes,p.seconds),refs};
}
// Proposed conversation syllabus, not yet taught or scheduled. Exact coverage
// is matched against displayed teaching models, not the assessment bank.
export const WEEKEND_GOALS=[
 ['Get ready and get moving','Dépêche-toi · On doit… · Tu as… ?',[
 ['Hurry up!','Dépêche-toi !'],['Hurry up, we need to go.','Dépêche-toi, on doit y aller.'],['Are you ready?','Tu es prêt ?'],['Not yet.','Pas encore.'],['I’m nearly ready.','Je suis presque prêt.'],['I’m coming.','J’arrive.'],['Wait a minute.','Attends une minute.'],['Have you got your bag?','Tu as ton sac ?']]],
 ['Get changed and find your kit','Mets… · Enlève… · Va… · J’ai oublié…',[
 ['Go and get changed.','Va te changer.'],['Put on your wetsuit.','Mets ta combinaison.'],['Put on your life jacket.','Mets ton gilet de sauvetage.'],['Take off your wet clothes.','Enlève tes vêtements mouillés.'],['Where are your shoes?','Où sont tes chaussures ?'],['I forgot my water bottle.','J’ai oublié ma gourde.'],['I can’t find it.','Je ne le trouve pas.'],['Can you help me?','Tu peux m’aider ?']]],
 ['Set up the boat together','Il faut… · Tu peux… ? · Où est… ? · Tiens…',[
 ['We need to rig the boat.','Il faut gréer le bateau.'],['Can you bring the sail?','Tu peux apporter la voile ?'],['Hold this for me, please.','Tiens-moi ça, s’il te plaît.'],['Where is the rudder?','Où est le safran ?'],['Pull the rope.','Tire sur le bout.'],['Is everything ready?','Tout est prêt ?'],['I’ve finished.','J’ai fini.'],['We still need the sail.','Il nous faut encore la voile.']]],
 ['Meals, snacks and eating up','Va chercher… · Mange… · Tu veux… ? · J’ai…',[
 ['Go and get your food.','Va chercher ton repas.'],['Eat up.','Finis ton repas.'],['Come and eat!','Viens manger !'],['Do you want some more?','Tu en veux encore ?'],['Have you eaten?','Tu as mangé ?'],['Drink some water.','Bois de l’eau.'],['I’m hungry.','J’ai faim.'],['I’m not hungry any more.','Je n’ai plus faim.']]],
 ['Leaving, timings and social plans','On va… · On doit… · On a… · À quelle heure… ?',[
 ['We need to go.','On doit y aller.'],['We’re going to a party.','On va à une fête.'],['We have to go to a party.','On doit aller à une fête.'],['We’re going to be late.','On va être en retard.'],['What time are we leaving?','On part à quelle heure ?'],['In five minutes.','Dans cinq minutes.'],['Are you coming with us?','Tu viens avec nous ?'],['Yes, I’m coming.','Oui, j’arrive.']]],
 ['Chat with children and understand their replies','Ça s’est bien passé ? · Tu as… ? · C’était… · Parce que…',[
 ['Did it go well?','Ça s’est bien passé ?'],['It went well.','Ça s’est bien passé.'],['Did you have fun?','Tu t’es bien amusé ?'],['What did you do today?','Qu’est-ce que tu as fait aujourd’hui ?'],['I went sailing.','J’ai fait de la voile.'],['It was difficult.','C’était difficile.'],['I’m tired.','Je suis fatigué.'],['Why?','Pourquoi ?'],['Because it was windy.','Parce qu’il y avait du vent.']]],
 ['Keep the conversation going','Quoi ? · Tu peux… ? · Ça veut dire quoi ?',[
 ['What did you say?','Qu’est-ce que tu as dit ?'],['Can you repeat?','Tu peux répéter ?'],['Can you say it more slowly?','Tu peux le dire plus lentement ?'],['I don’t understand.','Je ne comprends pas.'],['What does that mean?','Ça veut dire quoi ?'],['Show me.','Montre-moi.'],['I don’t know.','Je ne sais pas.'],['All right, I understand.','D’accord, je comprends.']]]
];
// Short, original exchanges to preview the desired conversational outcome.
const WEEKEND_DIALOGUES=[
 [['Parent','Hurry up, we need to go.','Dépêche-toi, on doit y aller.'],['Child','Wait, I’m coming!','Attends, j’arrive !']],
 [['Parent','Go and get changed.','Va te changer.'],['Child','I can’t find my wetsuit.','Je ne trouve pas ma combinaison.'],['Parent','Look in your bag.','Regarde dans ton sac.']],
 [['Adult','Can you bring me the sail?','Tu peux m’apporter la voile ?'],['Child','Where is it?','Elle est où ?'],['Adult','It’s next to the boat.','Elle est à côté du bateau.']],
 [['Parent','Come and eat!','Viens manger !'],['Child','I’m not hungry any more.','Je n’ai plus faim.'],['Parent','At least drink some water.','Bois au moins un peu d’eau.']],
 [['Parent','We’re going to be late.','On va être en retard.'],['Child','I’ve nearly finished.','J’ai presque fini.'],['Parent','We’re leaving in five minutes.','On part dans cinq minutes.']],
 [['Adult','Did you have fun?','Tu t’es bien amusé ?'],['Child','Yes, but it was difficult.','Oui, mais c’était difficile.'],['Adult','Why?','Pourquoi ?'],['Child','Because it was windy.','Parce qu’il y avait du vent.']],
 [['Child','I can’t find my shoes.','Je ne trouve pas mes chaussures.'],['Adult','Can you repeat that more slowly?','Tu peux répéter plus lentement ?'],['Child','My shoes!','Mes chaussures !']]
];
export function goalCoverage(data,goals=WEEKEND_GOALS){
 const map=new Map();
 // Keep question and statement distinct, even if the marking normalizer
 // ignores punctuation.
 const key=s=>norm(s)+'|'+(String(s).trim().endsWith('?')?'question':'statement');
 for(const u of data.units)for(const s of u.steps.filter(model)){
  const k=key(s.fr);if(!map.has(k))map.set(k,{unit:u.unit,completed:false});
  if(data.refs.has(guidedRefs(s.id).complete)){map.get(k).completed=true;map.get(k).completedUnit=u.unit;}
 }
 return goals.map(([name,frames,pairs])=>({name,frames,pairs:pairs.map(([en,fr])=>({en,fr,match:map.get(key(fr))||null}))}));
}
const audio=fr=>'<button type="button" class="ft-road-audio" data-act="roadmap-audio" data-roadmap-audio="'+h(fr)+'" aria-label="Hear the French">▶</button>';
const pair=(en,fr)=>'<div class="ft-road-pair"><div><small>ENGLISH</small><strong>'+h(en)+'</strong></div><div><small>FRENCH</small><strong lang="fr">'+h(fr)+'</strong></div>'+audio(fr)+'</div>';
const progress=(done,total)=>'<div class="ft-road-progress" role="progressbar" aria-valuemin="0" aria-valuemax="'+total+'" aria-valuenow="'+done+'"><span style="width:'+(total?Math.round(done/total*100):0)+'%"></span></div>';
const stat=(label,n,sub='')=>'<div class="ft-road-stat"><small>'+h(label)+'</small><strong>'+h(n)+'</strong>'+(sub?'<span>'+h(sub)+'</span>':'')+'</div>';
const grid=xs=>'<div class="ft-road-grid">'+xs.join('')+'</div>';
const days=n=>n===0?'Core teaching covered':'By learning day '+n;
const status=u=>u.allComplete?'Teaching completed':!u.left?'Corrections remaining':u.complete?'In progress':'Not started';
function select(name,options,current,format){return '<select data-roadmap-setting="'+name+'">'+options.map(x=>'<option value="'+h(x)+'"'+(x===current?' selected':'')+'>'+h(format(x))+'</option>').join('')+'</select>';}
function controls(p,track){return '<div class="ft-road-controls"><label>Browse course'+select('track',TRACKS.map(t=>t.id),track,trackName)+'</label><label>Minutes per learning day'+select('minutes',minutes,p.minutes,x=>x+' min')+'</label><label>Estimated seconds per step'+select('seconds',seconds,p.seconds,x=>x+' sec')+'</label></div><p class="ft-road-note">Forecast from remaining core steps, assuming daily practice at the chosen pace. Excludes breaks, extra corrections and revision. Not a promise of fluency.</p>';}
function goals(data,protectedUnits){
 const gs=goalCoverage(data),total=gs.reduce((n,g)=>n+g.pairs.length,0),covered=gs.reduce((n,g)=>n+g.pairs.filter(x=>x.match).length,0),hideExamples=protectedUnits.size>0;
 const exchanges=j=>hideExamples?'': '<details class="ft-road-dialogue"><summary>Example conversation · parent/child</summary><div class="ft-road-dialogue-body">'+WEEKEND_DIALOGUES[j].map(([role,en,fr])=>'<div class="ft-road-dialogue-turn'+(role==='Child'?' child':'')+'"><small>'+h(role)+'</small><div><strong lang="fr">'+h(fr)+'</strong>'+audio(fr)+'</div><span>'+h(en)+'</span></div>').join('')+'</div><p class="ft-road-note">Reference example only — not a recorded listening or speaking assessment.</p></details>';
 return '<section class="ft-road-goals"><p class="ft-eyebrow">YOUR REAL-WORLD GOAL</p><h2>French around the sailing club</h2><p>Understand parents and children, give everyday instructions and follow their replies. Focus on family life, the boat, meals, timings and social conversations — not tourist phrases.</p>'+grid([stat('Exact examples already in course',covered+' / '+total,'Coverage, not mastery'),stat('Priority situations',gs.length,'Proposed teaching focus')])+'<p class="ft-road-note">New examples are reference only, not scheduled lessons. Similar expressions may already be taught. Real conversations should practise both directions: what you say and what a child says back. Tu addresses one familiar child; vous addresses several people or is polite. For a girl or woman, some words change (prête, amusée, fatiguée).</p>'+gs.map((g,j)=>'<details class="ft-road-detail"><summary><span class="ft-road-num">'+(j+1)+'</span><span><strong>'+h(g.name)+'</strong><small>'+g.pairs.filter(x=>x.match).length+'/'+g.pairs.length+' exact examples in course</small></span></summary><div class="ft-road-body"><p class="ft-road-note">Reusable pieces: '+h(g.frames)+'</p>'+g.pairs.map(x=>(hideExamples?'<p>'+h(x.en)+' · French preview hidden until pending independent checks are completed</p>':pair(x.en,x.fr))+'<p class="ft-road-note">'+(x.match?h(title(x.match.unit))+' · '+(x.match.completed?'Model completed'+(x.match.completedUnit?.id!==x.match.unit.id?' in '+h(title(x.match.completedUnit)):''):'In teaching sequence'):'Proposed addition · reference only')+'</p>').join('')+exchanges(j)+'</div></details>').join('')+'</section>';
}
const TRACK_FOCUS={
 unlocking:'One spoken building block at a time; word recognition, sentence construction and practical language. Later units include family routines and sailing.',
 michaela:'Intensive practice of reusable sentence structures, listening, writing and linking ideas.',
 sai:'School-aligned topics, classroom language, phonics, spelling and cumulative retrieval.',
 'unlocking-archive':'Earlier complete-sentence approach; retained for comparison and existing learning records.'
};
function compare(entries,now,p){
 return '<section><h2>Compare learning tracks</h2><p>Counts are generated from the current curriculum, using the signed-in learner’s progress. Different assessments do not establish that one method is better.</p><div class="ft-road-compare">'+TRACKS.map(t=>{const d=roadmapData(t.id,entries,now,p);return '<article><p class="ft-eyebrow">'+(t.id==='unlocking-archive'?'ARCHIVED COURSE':'CURRENT CURRICULUM')+'</p><h3>'+h(t.name)+'</h3><p>'+h(TRACK_FOCUS[t.id]||t.summary)+'</p>'+grid([stat('Units',d.units.length),stat('Core steps',d.coreTotal),stat('Teaching days remaining',d.days),stat('Distinct introduced chunks',d.uniqueNew)])+'<details><summary>Teaching activity mix</summary><div class="ft-road-mix">'+Object.entries(d.units.flatMap(u=>u.steps).reduce((out,s)=>{const k=stepName(s);out[k]=(out[k]||0)+1;return out;},{})).map(([k,v])=>'<div><span>'+h(k)+'</span><b>'+v+'</b></div>').join('')+'</div><p class="ft-road-note">Counts of authored steps, not measured time spent speaking or listening.</p></details>'+progress(d.coreCompleted,d.coreTotal)+'<p class="ft-road-note">'+d.coreCompleted+'/'+d.coreTotal+' steps completed</p><details><summary>Teaching order</summary><ol>'+d.units.map(u=>'<li>'+h(u.unit.name)+' ('+u.total+' steps)</li>').join('')+'</ol></details><button type="button" data-act="roadmap-browse" data-roadmap-track="'+h(t.id)+'">View every teaching step →</button></article>';}).join('')+'</div></section>';
}
export function roadmapUnitMarkup(u,refs=new Set(),protectedUnit=false){
 return '<p>'+h(u.unit.goal)+'</p>'+progress(u.complete,u.total)+'<p class="ft-road-note">Core steps '+u.start+'–'+u.end+' · '+u.newItems.length+' distinct newly introduced chunks · '+u.pendingRepairs+' pending personal corrections.</p>'+
 (protectedUnit?'<p class="ft-road-note">Models hidden while this unit has an independent check due.</p>':u.newItems.length?'<details class="ft-road-detail"><summary>New building blocks ('+u.newItems.length+')</summary>'+u.newItems.map(s=>pair(s.en,s.fr)).join('')+'</details>':'')+
 '<h4>Every teaching step · in order</h4>'+u.steps.map((s,j)=>{
 const done=refs.has(guidedRefs(s.id).complete),hide=protectedUnit||(!done&&['independent','transfer'].includes(s.stage));
 return '<details class="ft-road-detail ft-road-step"><summary><span class="ft-road-num">'+(done?'✓':j+1)+'</span><span><strong>'+h(hide?stepName(s):s.en||stepName(s))+'</strong><small>'+h(stepName(s))+' · '+h(s.stage)+'</small></span></summary><div class="ft-road-body"><p>'+h(hide?'Independent practice — target hidden to protect recall.':s.prompt||'Practise this expression.')+'</p>'+
 (hide?'':pair(s.en,s.fr)+(s.components?.length?'<div class="ft-road-chunks">'+s.components.map(x=>'<span>'+h(x.en)+'<br><b lang="fr">'+h(x.fr)+'</b></span>').join('')+'</div>':'')+(s.note?'<p>'+h(s.note)+'</p>':'')+(s.pronunciation?'<p class="ft-road-note">Pronunciation: '+h(s.pronunciation)+'</p>':''))+'<p class="ft-road-note">Step '+(j+1)+' of '+u.total+' · '+(done?'Recorded completion':'Not completed')+'</p></div></details>';
 }).join('');
}
function curriculum(data,p,openUnit,protectedUnits){
 const q=norm(p.query),found=data.units.filter(u=>!q||u.unit.id===openUnit||norm([u.unit.name,u.unit.goal,...(!protectedUnits.has(u.unit.id)?u.steps.filter(s=>!['independent','transfer'].includes(s.stage)).flatMap(s=>[s.en,s.fr]):[])].join(' ')).includes(q));
 return '<section><h2>Detailed curriculum</h2><p>Expand a chapter, then any numbered teaching step. Repeated items stay in their actual order. Formal assessment banks and uncompleted independent targets are hidden.</p><form id="ft-roadmap-search" class="ft-road-search"><label for="ft-road-search">Find English, French or a topic</label><input id="ft-road-search" name="query" value="'+h(p.query)+'" placeholder="e.g. sailing, prêt, booking"><button type="submit">Find</button></form>'+
 (found.map(u=>'<details class="ft-road-detail ft-road-chapter" data-roadmap-unit="'+h(u.unit.id)+'"'+(openUnit===u.unit.id?' open data-loaded="1"':'')+'><summary><span><small>'+h(u.unit.label)+'</small><strong>'+h(u.unit.name)+'</strong><small>'+u.complete+'/'+u.total+' steps · '+h(status(u))+'</small></span><span class="ft-road-pill">'+h(days(u.forecastDays))+'</span></summary><div class="ft-road-body" data-roadmap-content>'+(openUnit===u.unit.id?roadmapUnitMarkup(u,data.refs,protectedUnits.has(u.unit.id)):'<p>Expand for the exact teaching sequence.</p>')+'</div></details>').join('')||'<p>No matching chapters.</p>')+'</section>';
}
const metric=m=>m?.total?m.percent+'% ('+m.correct+'/'+m.total+')':'Not measured';
function analysis(data,entries,now){
 const s=assessmentStats(entries,now,28,data.track);
 return '<section><h2>Course analysis</h2><p>Observations from the last 28 days. Teaching completion is not mastery or speaking fluency.</p>'+grid([stat('Independent assessment',metric(s.independent)),stat('7-day recall',metric(s.retention)),stat('28-day recall',metric(s.day28)),stat('Unseen transfer',metric(s.transfer),'Explicitly novel eligible items'),stat('Application / transfer',metric(s.application)),stat('Median assessed response',s.medianMs==null?'Not measured':(s.medianMs/1000).toFixed(1)+'s','Not total learning time')])+'<h3>How to improve the course</h3>'+s.tips.map(x=>'<p class="ft-road-tip">'+h(x)+'</p>').join('')+'<h3>Per-unit evidence</h3>'+data.units.map(u=>'<article class="ft-road-analysis"><strong>'+h(title(u.unit))+'</strong>'+grid(['immediate','day7','day28'].map((st,i)=>stat(['After teaching','Day 7','Day 28'][i],metric(checkResult(u.unit.id,st,entries,now).recall))))+'<p class="ft-road-note">'+u.complete+'/'+u.total+' teaching steps completed</p></article>').join('')+'<p class="ft-road-note">Per-unit observations use all eligible checks. Missing evidence is not a zero score. Active teaching time, confidence, vocabulary gained per hour and real-world spoken ability are not reliably measured. No causal comparison between tracks is implied.</p><button type="button" data-page="evidence">Open Learning dashboard →</button></section>';
}
export function roadmapPage({activeTrack,profile,entries=[],settings={},openUnit='',protectedUnits=new Set(),now=Date.now()}={}){
 const p=roadmapSettings(settings),track=p.track||activeTrack||'unlocking',data=roadmapData(track,entries,now,p);
 const journey=()=>grid([stat('Core steps completed',data.coreCompleted+'/'+data.coreTotal),stat('Learning days remaining','~'+data.days,'Estimated teaching only'),stat('Distinct introduced chunks',data.uniqueNew,'Whole course · not unique words'),stat('Distinct completed models',data.modelsCompleted,'Exposure, not mastery')])+progress(data.coreCompleted,data.coreTotal)+(profile==='adult'?goals(data,protectedUnits):'')+'<h2>Your course milestones</h2><p class="ft-road-note">These examples show what the course teaches, not what you have already mastered. Days are counted from now in learning days, rather than guaranteed dates.</p><div class="ft-road-timeline">'+data.units.map(u=>'<article class="ft-road-milestone"><span class="ft-road-num">'+(u.allComplete?'✓':h(u.unit.label?.split(' ').at(-1)||u.start))+'</span><div><div class="ft-road-head"><h3>'+h(u.unit.name)+'</h3><span class="ft-road-pill">'+h(days(u.forecastDays))+'</span></div><p>'+h(u.unit.goal)+'</p>'+(!protectedUnits.has(u.unit.id)&&u.example?pair(u.example.en,u.example.fr):'')+progress(u.complete,u.total)+'<p class="ft-road-note">'+u.complete+'/'+u.total+' steps · '+h(status(u))+'</p><button type="button" data-act="roadmap-open-unit" data-roadmap-unit-id="'+h(u.unit.id)+'">Explore teaching sequence →</button></div></article>').join('')+'</div>';
 return '<section class="ft-card ft-roadmap"><p class="ft-eyebrow">LEARNING ROADMAP</p><div class="ft-road-head"><h2>What will I be able to say?</h2><button type="button" data-page="lesson">Continue learning →</button></div><p>Explore the curriculum and your evidence of learning. Browsing does not change your active course or add progress.</p><nav class="ft-road-tabs" aria-label="Roadmap views">'+ROADMAP_VIEWS.map((v,i)=>'<button type="button" data-act="roadmap-view:'+v+'"'+(p.view===v?' class="active" aria-current="page"':'')+'>'+['My journey','Compare courses','Detailed curriculum','Course analysis'][i]+'</button>').join('')+'</nav>'+controls(p,track)+(p.view==='compare'?compare(entries,now,p):p.view==='curriculum'?curriculum(data,p,openUnit,protectedUnits):p.view==='analysis'?analysis(data,entries,now):journey())+'</section>';
}
