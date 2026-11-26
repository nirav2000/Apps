// Word-level learning signals, separate from assessed mastery.
import {normaliseAnswer,markAnswer} from './data.js';
const DAY=86400000,MIN=60000;
export const wordKey=normaliseAnswer;
const flat=s=>wordKey(s).normalize('NFD').replace(/\p{M}/gu,'');
export function frenchTokens(s){
 return [...String(s??'').matchAll(/[\p{L}\p{M}]+(?:['’‘\-][\p{L}\p{M}]+)*|\p{N}+(?:[.,]\p{N}+)*/gu)].map(m=>({text:m[0],key:wordKey(m[0]),start:m.index,end:m.index+m[0].length}));
}
function distance(a,b){
 let row=Array.from({length:b.length+1},(_,i)=>i);
 for(let i=1;i<=a.length;i++){const next=[i];for(let j=1;j<=b.length;j++)next[j]=Math.min(next[j-1]+1,row[j]+1,row[j-1]+(a[i-1]===b[j-1]?0:1));row=next;}
 return row[b.length];
}
function similar(a,b){
 const x=flat(a),y=flat(b),n=Math.max(x.length,y.length),d=distance(x,y);
 return x===y||n>=4&&x[0]===y[0]&&d<=Math.max(1,Math.floor(n*.32))||n>=6&&x.slice(0,2)===y.slice(0,2)&&d<=Math.floor(n*.5);
}
export function compareFrench(answer,expected){
 const a=frenchTokens(answer),b=frenchTokens(expected),m=a.length,n=b.length;
 if(m>160||n>160)return [];
 const dp=Array.from({length:m+1},()=>Array(n+1).fill(0)),ops=Array.from({length:m+1},()=>Array(n+1).fill(''));
 for(let i=1;i<=m;i++){dp[i][0]=i;ops[i][0]='extra';}
 for(let j=1;j<=n;j++){dp[0][j]=j;ops[0][j]='missing';}
 for(let i=1;i<=m;i++)for(let j=1;j<=n;j++){
  const x=a[i-1],y=b[j-1],same=x.key===y.key,near=similar(x.key,y.key);
  const diag=dp[i-1][j-1]+(same?0:near?.65:1.8),del=dp[i-1][j]+1,ins=dp[i][j-1]+1;
  if(diag<=del&&diag<=ins){dp[i][j]=diag;ops[i][j]=same?'match':'replace';}
  else if(del<=ins){dp[i][j]=del;ops[i][j]='extra';}else{dp[i][j]=ins;ops[i][j]='missing';}
 }
 const out=[];let i=m,j=n;
 while(i||j){
  const kind=ops[i][j],left=kind==='missing'?null:a[i-1],right=kind==='extra'?null:b[j-1];
  out.push({kind,left,right,near:kind==='replace'&&similar(left.key,right.key),accent:kind==='replace'&&flat(left.key)===flat(right.key)});
  if(left)i--;if(right)j--;
 }
 return out.reverse();
}
// Keep the learner's exact characters; for equal-length near spellings
// highlight the changed letters only. Insertions/deletions mark the word.
export function differenceSegments(value,other){
 const a=Array.from(String(value??'')),b=Array.from(String(other??''));
 const same=(x,y)=>String(x).normalize('NFC').toLocaleLowerCase('fr').replace(/[’‘]/g,"'")===String(y).normalize('NFC').toLocaleLowerCase('fr').replace(/[’‘]/g,"'");
 if(!other||a.length!==b.length||!a.some((c,i)=>same(c,b[i])))return [{text:a.join(''),changed:true}];
 return a.map((text,i)=>({text,changed:!same(text,b[i])}));
}
export function writingConvention(answer,expected){
 if(!markAnswer(answer,expected))return '';
 const a=String(answer??'').trim(),b=String(expected??'').trim(),notes=[];
 if(/^\p{Lu}/u.test(b)&&/^\p{Ll}/u.test(a))notes.push('Start the sentence with a capital '+b[0]+'.');
 if(/[.!?]$/.test(a)&&!/[.!?]$/.test(b))notes.push('Your sentence-ending punctuation is accepted.');
 if(notes.length)return notes.join(' ')+' These writing conventions do not affect your mark.';
 if(a!==b&&a.normalize('NFC').replace(/[’‘]/g,"'")!==b.normalize('NFC').replace(/[’‘]/g,"'"))return 'Harmless capitalisation, punctuation or spacing differences are accepted.';
 return '';
}
export function revisionLabel(item){
 const value=String(item?.word??'').trim(),count=frenchTokens(value).length;
 return count<=1?'word':count>=5||value===String(item?.sentence??'').trim()?'sentence':'phrase';
}
export function correctionSummary(answer,expected){
 const d=compareFrench(answer,expected).filter(x=>x.kind!=='match');
 if(!d.length)return markAnswer(answer,expected)?'The words match. Formatting differences are accepted.':'Check the apostrophes, hyphens or number punctuation against the model.';
 const items=d.slice(0,5).map(x=>x.kind==='extra'?'extra “'+x.left.text+'”':x.kind==='missing'?'missing “'+x.right.text+'”':'“'+x.left.text+'” → “'+x.right.text+'”');
 return (d.every(x=>x.accent)?'Check the French accents: ':'Compare with the expected spelling or word form: ')+items.join('; ')+(d.length>5?'; see the highlighted words':'')+'.';
}
const median=a=>{const s=a.slice().sort((x,y)=>x-y),i=Math.floor(s.length/2);return s.length%2?s[i]:(s[i-1]+s[i])/2;};
export function createTypingSample(initial=''){
 let value=String(initial),times=[],last=null,invalid=!!value;
 return {
  add(next,at,{inputType='insertText',composing=false}={}){
   next=String(next??'');const tail=next.slice(value.length);
   if(composing||inputType!=='insertText'||!next.startsWith(value)||tail.length!==1||!Number.isFinite(at)||last!==null&&(at-last>8000||at<=last))invalid=true;
   if(!invalid)times.push(last===null?null:at-last);
   value=next;last=at;
  },
  invalidate(){invalid=true;},
  finish(final){
   if(invalid||String(final)!==value||value.length!==times.length)return [];
   const rows=frenchTokens(value).map((w,index)=>{
    const gaps=times.slice(w.start,w.end).filter(t=>Number.isFinite(t)&&t>0);
    return {index,word:w.text,start:w.start,msPerChar:gaps.length>=2&&w.text.length>=3?Math.round(median(gaps)):null,samples:gaps.length,startDelayMs:times[w.start]??null};
   }).filter(x=>x.msPerChar!==null);
   if(rows.length<3)return [];
   const baseline=Math.max(40,median(rows.map(x=>x.msPerChar)));
   const starts=rows.map(x=>x.startDelayMs).filter(Number.isFinite);
   const startBaseline=starts.length>=3?Math.max(40,median(starts)):baseline;
   return rows.map(x=>{
    const slowKeys=x.msPerChar>=2.2*baseline&&x.msPerChar-baseline>=180;
    const slowStart=x.startDelayMs!==null&&x.startDelayMs>=3*startBaseline&&x.startDelayMs-startBaseline>=500;
    const mode=slowKeys?'typing':slowStart?'before-word':null;
    return {...x,baseline,startBaseline,ratio:Math.round((slowStart&&!slowKeys?x.startDelayMs/startBaseline:x.msPerChar/baseline)*100)/100,slow:!!mode,mode};
   });
  }
 };
}
const frenchWritten=x=>!x.signal&&x.marker!=='listening-rebuild-v1'&&(x.targetLang==='fr'||!x.targetLang&&['guided-exact-v1','curriculum-v1','assessment-v1'].includes(x.marker));
export function auditSignals(x){
 if(!frenchWritten(x)||!['correct','incorrect'].includes(x.result)||!x.answer||!x.expected)return [];
 const pairs=compareFrench(x.answer,x.expected),out=[];
 if(x.result==='incorrect')for(const d of pairs)if(d.near&&d.right&&d.left)out.push({kind:'spelling',word:d.right.text,actual:d.left.text,sentence:x.expected,ref:x.ref,at:x.at,id:x.id+':spelling:'+d.right.start});
 for(const timing of x.typing||[]){
  if(!timing.slow)continue;
  const d=pairs.find(pair=>pair.left?.start===timing.start);
  const word=x.result==='correct'?timing.word:d?.kind==='match'?d.right.text:null;
  if(word)out.push({kind:'hesitation',word,sentence:x.result==='correct'?x.answer:x.expected,ref:x.ref,at:x.at,id:x.id+':typing:'+timing.start,ratio:timing.ratio,msPerChar:timing.msPerChar,baseline:timing.baseline,mode:timing.mode||'typing',startDelayMs:timing.startDelayMs??null});
 }
 return out;
}
// A phrase target is used when the difficulty is construction, not spelling.
// Reusable frames are only extracted from the actual expected French.
export function phraseTarget(fr,en='',structure=''){
 const sentence=String(fr||'').trim(),key=wordKey(sentence);
 const frames=["je ne","je n'","je vais","je veux","je peux","je dois","je voudrais","j'ai","nous avons","vous avez","tu as","il a","elle a","parce que"];
 const frame=frames.find(x=>key===x||key.startsWith(x+' ')||(x==="je n'"&&key.startsWith(x)));
 return {word:frame&&frame!=="je n'"?frame:sentence,sentence,english:en,targetKind:'phrase',structure};
}
export function containsTarget(sentence,target){
 const a=frenchTokens(sentence).map(x=>x.key),b=frenchTokens(target).map(x=>x.key);
 return b.length>0&&a.some((_,i)=>b.every((w,j)=>a[i+j]===w));
}
export function revisionEvents(audits,visible){
 const explicit=audits.filter(x=>x.answerAudit?.signal&&!['adaptive-plan'].includes(x.answerAudit.signal.kind)).map(x=>{
  const a=x.answerAudit,s=a.signal;
  // Reinterpret legacy manual review false negatives for scheduling only.
  // The immutable original audit is retained for transparency.
  const formattingOnly=a.marker==='revision-v1'&&s.kind==='review'&&!s.correct&&!a.context?.listeningAssisted&&a.answer?.trim()&&a.expected&&markAnswer(a.answer,a.expected);
  return {...s,...(formattingOnly?{correct:true}:{}),context:a.context||{},id:x.id,at:x.at,ref:a.ref};
 });
 // Use actual chronology. An independent answer can reduce an existing
 // difficulty; it cannot invent a difficulty or cancel a later event.
 const timeline=[...visible.filter(x=>!x.legacy&&x.result!=='withheld').map(x=>({at:x.at,id:x.id,audit:x})),...explicit.map(x=>({at:x.at,id:x.id,event:x}))].sort((a,b)=>a.at-b.at||String(a.id).localeCompare(String(b.id)));
 const out=[],targets=new Map(),seen=new Set();
 function add(e){
  if(!e.word||!e.id)return;
  const unique=(e.kind==='review'||e.kind==='exposure'||e.kind==='assisted')&&e.adaptive?e.planId+':'+e.kind:e.id;
  if(seen.has(unique))return;
  // A manually launched review has a shared legacy reference, so its
  // individual immutable event ID remains the identity.
  if(e.ref==='revision:review'){
   if(seen.has(e.id))return;seen.add(e.id);
  }else seen.add(unique);
  const key=wordKey(e.word);
  if(e.kind!=='success')targets.set(key,{...targets.get(key),word:e.word,targetKind:e.targetKind||targets.get(key)?.targetKind||'word'});
  out.push(e);
 }
 for(const item of timeline){
  if(item.event){add(item.event);continue;}
  const x=item.audit;
  if(x.marker==='listening-rebuild-v1')continue;
  if(x.signal){
   // In a personalised sentence, a second word can also reveal a spelling
   // difficulty. Record it, but do not double-count the targeted outcome.
   if(x.signal.adaptive&&x.result==='incorrect')for(const e of auditSignals({...x,signal:null}))if(e.kind==='spelling'&&wordKey(e.word)!==wordKey(x.signal.word))add({...e,context:x.context||{},english:x.question,targetKind:'word'});
   continue;
  }
  const context=x.context||{},first=x.ref+'|'+x.result;
  if(!['correct','incorrect','unknown','revealed'].includes(x.result))continue;
  const written=frenchWritten(x),fr=written?x.expected:context.fr,english=context.en||x.question;
  if(!fr)continue;
  if(x.result==='incorrect'&&written){
   if(x.answer?.trim()&&x.expected&&markAnswer(x.answer,x.expected))continue;
   const wordEvents=auditSignals(x);
   wordEvents.forEach(e=>add({...e,context,english,targetKind:'word'}));
   const diffs=compareFrench(x.answer,x.expected).filter(d=>d.kind!=='match');
   if(!diffs.length||diffs.some(d=>!d.near)){
    const target=phraseTarget(fr,english,context.structure);
    if(!seen.has(first)){seen.add(first);add({...target,kind:'construction',id:x.id+':construction',ref:x.ref,at:x.at,context});}
   }
  }else if((x.result==='incorrect'&&!written&&['choice','listen'].includes(context.kind))||x.result==='unknown'||(x.result==='revealed'&&written)){
   if(!seen.has(first)){seen.add(first);add({...phraseTarget(fr,english,context.structure),kind:x.result==='revealed'?'reveal':x.result==='unknown'?'construction':'recognition',id:x.id+':difficulty',ref:x.ref,at:x.at,context});}
  }else if(written&&x.result==='correct'){
   auditSignals(x).forEach(e=>add({...e,context,english,targetKind:'word'}));
   if(x.support!=='none'||context.kind==='transcribe'||context.kind==='model'||seen.has(first))continue;
   seen.add(first);
   for(const target of targets.values()){
    if(!containsTarget(x.answer,target.word))continue;
    if(x.typing?.some(t=>t.slow&&containsTarget(target.word,t.word)))continue;
    add({...target,kind:'success',sentence:x.answer,english,ref:x.ref,at:x.at,id:x.id+':success:'+wordKey(target.word),context,delayed:/^(day[137]|day28)$/.test(context.stage||'')||/review-[137]/.test(x.ref)});
   }
  }
 }
 return out;
}
export function revisionQueue(events,now=Date.now()){
 const map=new Map(),seen=new Set();
 for(const e of [...events].sort((a,b)=>a.at-b.at||String(a.id).localeCompare(String(b.id)))){
  if(!e.id||seen.has(e.id)||!e.word||!Number.isFinite(e.at)||!['spelling','pronunciation','hesitation','manual','review','hint','reveal','construction','recognition','success','exposure','assisted'].includes(e.kind))continue;
  seen.add(e.id);const key=wordKey(e.word);
  const row=map.get(key)||{key,word:e.word,score:0,level:0,dueAt:null,counts:{spelling:0,pronunciation:0,hesitation:0,manual:0,review:0,hint:0,reveal:0,construction:0,recognition:0,success:0,exposure:0,assisted:0},signals:[],sentence:'',english:'',targetKind:'word',structure:'',lastDifficulty:null,lastAction:null};
  row.counts[e.kind]++;row.signals.push(e);
  if(e.sentence&&e.english){row.sentence=e.sentence;row.english=e.english;}
  else if(e.sentence&&!row.sentence)row.sentence=e.sentence;
  if(e.targetKind)row.targetKind=e.targetKind;
  if(e.structure)row.structure=e.structure;
  if(e.kind==='review'){
   row.lastReview=e.at;row.lastAction=e;
   if(e.correct){
    // Dictation is spelling evidence, not proof of translation or transfer.
    // A supported answer never advances the unaided recall ladder.
    row.score=Math.max(0,row.score-2);
    if(e.mode==='dictation'&&e.adaptive){row.dueAt=e.at+DAY;row.needsRecall=true;}
    else{row.level=Math.min(5,row.level+1);row.dueAt=row.level>=5?null:e.at+[DAY,3*DAY,7*DAY,28*DAY][row.level-1];row.needsRecall=false;}
   }else{row.level=0;row.score=Math.min(20,row.score+4);row.dueAt=e.at+10*MIN;row.lastDifficulty=e;}
  }else if(e.kind==='success'){
   row.score=Math.max(0,row.score-(e.delayed?3:1.5));
   row.lastIndependentAt=e.at;
   // Natural unaided success weakens the signal, but does not fabricate
   // a scheduled retention pass; reserve that for an actual later test.
   if(row.score===0&&row.level===0&&row.dueAt!==null&&row.dueAt<e.at+DAY)row.dueAt=e.at+DAY;
  }else if(e.kind==='exposure'||e.kind==='assisted'){
   row.lastAction=e;row.needsRecall=true;row.dueAt=e.at+10*MIN;
   if(e.kind==='assisted')row.score=Math.min(20,row.score+1);
  }else{
   const weight={spelling:4,pronunciation:1,hesitation:.5,manual:4,hint:2,reveal:4,construction:4,recognition:2}[e.kind];
   row.score=Math.min(20,row.score+weight);row.lastDifficulty=e;
   if(['spelling','manual','reveal','construction'].includes(e.kind))row.level=0;
   const interval=['spelling','manual','reveal','construction'].includes(e.kind)||row.score>=4?0:row.score>=3?10*MIN:row.score>=2?6*60*MIN:e.kind==='hesitation'?3*DAY:DAY;
   if(e.kind!=='hesitation'||row.counts.hesitation>=2||row.counts.pronunciation||row.counts.spelling||row.counts.manual){
    const proposed=e.at+interval;row.dueAt=row.dueAt===null?proposed:Math.min(row.dueAt,proposed);
   }
  }
  map.set(key,row);
 }
 return [...map.values()].map(x=>({...x,due:x.dueAt!==null&&x.dueAt<=now,priority:x.score>=4?'High':x.score>=2?'Medium':'Low',strength:Math.min(100,Math.round(x.score*5))})).sort((a,b)=>Number(b.due)-Number(a.due)||(a.due&&b.due?b.score-a.score:0)||(a.dueAt??Infinity)-(b.dueAt??Infinity)||b.score-a.score||a.key.localeCompare(b.key));
}
export function clozeFor(sentence,word){
 const src=String(sentence||''),target=wordKey(word);
 if(!src||wordKey(src)===target)return '';
 let found=false;
 const result=src.replace(/[\p{L}\p{M}]+(?:['’\-][\p{L}\p{M}]+)*/gu,w=>{if(wordKey(w)===target){found=true;return '____';}return w;});
 return found?result:'';
}

// A URL fragment is only a proposed private manual import, never a write.
export function revisionImport(hash){
 const raw=new URLSearchParams(String(hash||'').replace(/^#/,'')).get('revise');
 if(!raw)return [];
 const words=raw.split(',').map(w=>w.trim()).filter(w=>w.length<=80&&/^[\p{L}\p{M}]+(?:['’\- ][\p{L}\p{M}]+)*$/u.test(w));
 return [...new Map(words.map(w=>[wordKey(w),w])).values()].slice(0,10);
}
