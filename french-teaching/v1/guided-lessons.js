// Original, repeat-rich French lessons. Inspired by the *principles* described by
// Jessica Lund and Paul Noble, not a reproduction of either person's course.
import {magicTenFor,magicTenPhrase} from './magic10.js';
export const GUIDED_VERSION='2.0.0';
export const GUIDED_PREFIX='guided-v2:';
export const GUIDED_REVIEW_DAYS=Object.freeze([1,3,7]);
const DAY=86400000;
const LESSONS=Object.freeze([
  {id:'speak-and-listen',name:'Speak and listen',label:'Lesson 1',verbs:['parler','écouter'],
    structures:['infinitive','like','want','present'],
    goal:'Say what you do, enjoy and want to do, using French in useful sentences.',
    bridge:{fr:"J'aime le français parce que c'est utile.",en:'I like French because it is useful.',point:'parce que joins a claim to a reason.'},
    transfer:[
      ["Je veux parler français parce que j'aime écouter la radio.",
        'I want to speak French because I like listening to the radio.','reason'],
      ["Je parle français, mais je veux écouter la radio.",
        'I speak French, but I want to listen to the radio.','contrast'],
      ["J'aime écouter la radio, donc je veux parler français.",
        'I like listening to the radio, so I want to speak French.','result'],
      ["Je veux écouter la radio parce que j'aime le français.",
        'I want to listen to the radio because I like French.','reason']
    ]},
  {id:'make-a-choice',name:'Choose what to do',label:'Lesson 2',verbs:['étudier','travailler'],
    structures:['present','negative','can','must'],
    goal:'Explain what you do, do not do, can do and must do.',
    bridge:{fr:"Je travaille le soir, mais j'étudie aussi le français.",
      en:'I work in the evening, but I also study French.',point:'mais gives a contrast; aussi adds information.'},
    transfer:[
      ["Je dois étudier le français parce que je travaille le soir.",
        'I must study French because I work in the evening.','reason'],
      ["Je peux travailler le soir, mais je dois étudier le français.",
        'I can work in the evening, but I must study French.','contrast'],
      ["Je n'étudie pas le français, donc je dois travailler le soir.",
        'I do not study French, so I must work in the evening.','result'],
      ["Je travaille le soir, mais je ne pratique pas le français.",
        'I work in the evening, but I do not practise French.','contrast']
    ]},
  {id:'plans-and-memories',name:'Plans and memories',label:'Lesson 3',verbs:['habiter','regarder'],
    structures:['present','want','near-future','past'],
    goal:'Tell somebody where you live, what you did and what you plan to do.',
    bridge:{fr:"Hier, j'ai regardé la télévision. Demain, je vais regarder une vidéo.",
      en:'Yesterday I watched television. Tomorrow I am going to watch a video.',
      point:'Hier commonly goes with the past; demain introduces the future.'},
    transfer:[
      ["Hier, j'ai regardé la télévision, mais demain je vais habiter à Londres.",
        'Yesterday I watched television, but tomorrow I am going to live in London.','contrast'],
      ["J'ai habité à Londres, mais je vais regarder la télévision ce soir.",
        'I lived in London, but I am going to watch television this evening.','contrast'],
      ["Je veux habiter à Londres parce que j'aime regarder la télévision.",
        'I want to live in London because I like watching television.','reason'],
      ["Je vais regarder la télévision, mais j'habite à Londres.",
        'I am going to watch television, but I live in London.','contrast']
    ]},
  {id:'express-an-opinion',name:'Explain and reflect',label:'Lesson 4',verbs:['lire','pratiquer'],
    structures:['present','past','near-future','polite'],
    goal:'Compare past and future, and express a polite wish.',
    bridge:{fr:"Je voudrais parler français parce que c'est utile.",
      en:'I would like to speak French because it is useful.',
      point:'je voudrais is a polite wish, not a past or future tense.'},
    transfer:[
      ["J'ai lu en français, mais je voudrais pratiquer le français.",
        'I read in French, but I would like to practise French.','contrast'],
      ["Je vais lire en français parce que je voudrais pratiquer le français.",
        'I am going to read in French because I would like to practise French.','reason'],
      ["Je voudrais lire en français, mais je vais pratiquer le français.",
        'I would like to read in French, but I am going to practise French.','contrast'],
      ["J'ai pratiqué le français, donc je voudrais lire en français.",
        'I practised French, so I would like to read in French.','result']
    ]}
]);
export const GUIDED_UNITS=LESSONS;
const idOf=(unit,stage,part)=>GUIDED_PREFIX+unit+':'+stage+':'+part;
export const guidedRefs=id=>({
  first:id+':first',complete:id+':complete'
});
const markerOf=unit=>GUIDED_PREFIX+unit+':taught';
const rowsFor=unit=>unit.verbs.flatMap(verb=>unit.structures.map(id=>magicTenPhrase(verb,id)));
function construct(unit){
  const rows=rowsFor(unit),deck=[];
  const add=(stage,kind,row,part,extra={})=>deck.push({
    id:idOf(unit.id,stage,part),unitId:unit.id,stage,kind,concept:row.concept,
    fr:row.fr,en:row.en,structure:row.id,verbId:row.verbId,
    cue:'',...extra
  });
  // First lesson: these are *models*, not a false prior-knowledge recap.
  // Subsequent units deliberately revisit previously encountered constructions.
  for(let i=0;i<10;i++){
    const r=rows[(i*3)%rows.length];
    add('recap','model',r,String(i),{
      prompt:i<3?'Listen, repeat and notice the useful expression.':
        'Try to say the French from the English, then reveal it. No score here.',
      modelInitiallyShown:i<3
    });
  }
  // Tiny bilingual presentation. It is followed by FAR more practice.
  for(let i=0;i<rows.length;i++){
    add('present','model',rows[i],String(i),{
      prompt:'Hear this complete, useful expression. Repeat it; grammar is optional.',
      modelInitiallyShown:true
    });
  }
  add('present','model',{
    ...rows[0],fr:unit.bridge.fr,en:unit.bridge.en,
    concept:'french:connectives:'+unit.id
  },'connector',{prompt:'Notice one linking word: '+unit.bridge.point,modelInitiallyShown:true});
  // Same small set is revisited in varied modalities.
  for(let i=0;i<rows.length;i++){
    const r=rows[i],other1=rows[(i+1)%rows.length],other2=rows[(i+3)%rows.length];
    add('guided','choice',r,'recognise-'+i,{
      prompt:'Which French phrase matches the English?',
      choices:[r.fr,other1.fr,other2.fr],support:'small-prompt'
    });
  }
  for(let i=0;i<rows.length;i++){
    const r=rows[(i+3)%rows.length];
    const distractors=[rows[(i+2)%rows.length].en,rows[(i+5)%rows.length].en];
    add('guided','listen',r,'hear-'+i,{
      prompt:'Listen without reading the French, then choose what it means.',
      choices:[r.en,...distractors],support:'small-prompt',
      audioOnly:true
    });
  }
  for(let i=0;i<rows.length;i++){
    const r=rows[(i+5)%rows.length],words=r.fr.split(/\s+/);
    add('guided','write',r,'build-'+i,{
      prompt:'Rebuild the French from the English. Use the starter if you need it.',
      cue:'Start: '+words.slice(0,Math.min(2,words.length)).join(' ')+' …',
      support:'small-prompt'
    });
  }
  // English-only, no starter or model. Each phrase is familiar from guided work.
  for(let i=0;i<rows.length;i++){
    const r=rows[(i+2)%rows.length];
    add('independent','write',r,'no-help-'+i,{
      prompt:'Write the full French without a model. Hear it only after answering.',
      support:'none'
    });
  }
  // New combinations, never used as exercises or models earlier in this deck.
  for(let i=0;i<unit.transfer.length;i++){
    const [fr,en,connector]=unit.transfer[i];
    add('transfer','write',{
      ...rows[i%rows.length],fr,en,
      concept:'french:guided:transfer:'+unit.id+':'+connector
    },'new-'+i,{
      prompt:'New combination: put familiar parts together without a model.',
      support:'none',novel:true
    });
  }
  return deck;
}
export function guidedLesson(unitId){
  const u=GUIDED_UNITS.find(x=>x.id===unitId);
  if(!u)throw Error('Unsupported guided French lesson');
  return {unit:u,steps:construct(u)};
}
export function guidedTeachingRef(unitId){
  guidedLesson(unitId);
  return markerOf(unitId);
}
export function guidedCompletionRefs(stepId){
  if(typeof stepId!=='string'||!stepId.startsWith(GUIDED_PREFIX))
    throw Error('Unsupported guided step identifier');
  return guidedRefs(stepId);
}
function entriesFor(rows){return(Array.isArray(rows)?rows:[]).filter(e=>e&&typeof e==='object');}
function refSet(rows){return new Set(entriesFor(rows).map(e=>e.source?.ref).filter(Boolean));}
export function guidedCompleted(unitId,entries){
  const done=refSet(entries);
  return guidedLesson(unitId).steps.every(x=>done.has(guidedRefs(x.id).complete));
}
function firstTaught(entries,unitId){
  const taught=entriesFor(entries).filter(e=>e.source?.ref===markerOf(unitId));
  if(!taught.length)return null;
  return Math.min(...taught.map(x=>Number(x.taughtAt||x.at)).filter(Number.isFinite));
}
function reviewSteps(unit,dayNumber){
  // No false day-7 retention: these steps only become available after the
  // teaching date, and the shared evidence store rechecks elapsed days.
  const rows=rowsFor(unit);
  return rows.map((r,i)=>({
    id:idOf(unit.id,'review-'+dayNumber,String(i)),
    unitId:unit.id,stage:'review',kind:'write',concept:r.concept,
    fr:r.fr,en:r.en,structure:r.id,verbId:r.verbId,support:'none',
    prompt:'Recall from memory after '+dayNumber+' day'+(dayNumber===1?'':'s')+'. No model.',novel:false
  }));
}
export function guidedStatus(unitId,entries,now=Date.now()){
  const lesson=guidedLesson(unitId);
  const rows=entriesFor(entries),refs=refSet(rows);
  const taughtAt=firstTaught(rows,unitId);
  const main=lesson.steps.map(step=>({...step,completed:refs.has(guidedRefs(step.id).complete)}));
  const unfinished=main.filter(x=>!x.completed);
  if(unfinished.length){
    const firstWrong=rows.filter(e=>e.source?.ref?.endsWith(':first')&&
      e.source.ref.startsWith(GUIDED_PREFIX+unitId+':')&&e.score?.total>0&&
      e.score.correct===0);
    const repairBase=lesson.steps.filter(x=>firstWrong.some(e=>e.source.ref===guidedRefs(x.id).first)&&
      refs.has(guidedRefs(x.id).complete));
    const repairs=repairBase.map(x=>({
      ...x,id:idOf(unitId,'repair',x.id.slice(GUIDED_PREFIX.length)),kind:'write',
      stage:'repair',prompt:'One more try at a phrase that needed correction.',
      support:'small-prompt',cue:'Remember the structure: '+x.structure,novel:false,
      completed:refs.has(guidedRefs(idOf(unitId,'repair',x.id.slice(GUIDED_PREFIX.length))).complete)
    }));
    return {unit:lesson.unit,mode:taughtAt?'resume':'new',taughtAt,
      steps:[...main,...repairs],next:unfinished[0],remaining:unfinished.length+repairs.filter(x=>!x.completed).length,
      completed:main.filter(x=>x.completed).length,total:main.length,reviewDay:null};
  }
  if(taughtAt!=null){
    const elapsed=Math.floor((now-taughtAt)/DAY);
    // If late, do NOT backfill missed review days as separate observations.
    const dueDay=GUIDED_REVIEW_DAYS.filter(x=>elapsed>=x).at(-1);
    if(dueDay){
      const review=reviewSteps(lesson.unit,dueDay);
      const todo=review.filter(s=>!refs.has(guidedRefs(s.id).complete));
      if(todo.length)return {unit:lesson.unit,mode:'review',taughtAt,
        steps:review.map(s=>({...s,completed:refs.has(guidedRefs(s.id).complete)})),
        next:todo[0],remaining:todo.length,total:review.length,
        completed:review.length-todo.length,reviewDay:dueDay};
    }
  }
  const elapsed=taughtAt==null?0:Math.floor((now-taughtAt)/DAY);
  const nextDay=GUIDED_REVIEW_DAYS.find(x=>x>elapsed);
  return {unit:lesson.unit,mode:'complete',taughtAt,steps:[],next:null,remaining:0,
    total:lesson.steps.length,completed:lesson.steps.length,reviewDay:null,
    nextReviewAt:nextDay&&taughtAt?taughtAt+nextDay*DAY:null};
}
export function recommendedGuidedUnit(entries,now=Date.now()){
  // Reviews first, then the first unfinished/new teaching unit.
  const statuses=GUIDED_UNITS.map(u=>guidedStatus(u.id,entries,now));
  return statuses.find(x=>x.mode==='review') ||
    statuses.find(x=>x.mode==='resume') ||
    statuses.find(x=>x.mode==='new') ||
    statuses[0];
}
export function guidedFirstAttemptPhase(step,existingEntries,taughtAt,now=Date.now()){
  if(step.stage==='transfer'&&step.novel)return 'transfer';
  if(step.stage==='review'&&taughtAt&&now-taughtAt>=DAY)return 'retrieval';
  // Same-day recap and repair are practice, not evidence of long-term memory.
  return 'practice';
}
