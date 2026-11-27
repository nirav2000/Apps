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

// A narrow, conservative typing-slip detector, not an alternative answer marker.
// Strong matching context is essential. Accent errors, different valid forms,
// missing content and short isolated words must still receive normal teaching.
const keyboardRows=['qwertyuiop','asdfghjkl','zxcvbnm','azertyuiop','qsdfghjklm','wxcvbn'];
const adjacentKey=(a,b)=>a!==b&&keyboardRows.some(row=>row.includes(a)&&row.includes(b)&&Math.abs(row.indexOf(a)-row.indexOf(b))===1);
const shortForms=new Set(("le la les un une des du de au aux ce cet cette ces je tu il elle on nous vous ils elles me te se ne pas et est ou où a as ai suis es sont avec sans en y mon ma mes ton ta tes son sa ses").split(' '));
function singleKeySlip(actual,wanted){
 if(actual.length!==wanted.length||shortForms.has(actual)||flat(actual)===flat(wanted))return false;
 const d=[...wanted].map((c,i)=>c===actual[i]?-1:i).filter(i=>i>=0);
 if(d.length===1)return adjacentKey(actual[d[0]],wanted[d[0]]);
 return wanted.length>=5&&d.length===2&&d[1]===d[0]+1&&actual[d[0]]===wanted[d[1]]&&actual[d[1]]===wanted[d[0]];
}
export function likelyTypingSlip(answer,expected){
 const a=frenchTokens(answer).map(t=>t.key),b=frenchTokens(expected).map(t=>t.key);
 if(b.length<5||!a.length||a.length>b.length||b.length-a.length>2)return false;
 let i=0,j=0,matches=0,errors=0;
 while(i<a.length&&j<b.length){
  if(a[i]===b[j]){i++;j++;matches++;continue;}
  if(singleKeySlip(a[i],b[j])){i++;j++;errors++;continue;}
  // Adjacent words accidentally joined, optionally with an adjacent stray key
  // at the space: require both full words to remain present, not a guess.
  if(j+1<b.length&&b[j+1].length>=4&&a[i].startsWith(b[j])&&a[i].endsWith(b[j+1])){
   const extra=a[i].slice(b[j].length,a[i].length-b[j+1].length);
   if(extra.length<=1&&(!extra||/^[a-z]$/.test(extra))){i++;j+=2;errors++;continue;}
  }
  return false;
 }
 return i===a.length&&j===b.length&&errors>0&&errors<=2&&matches>=Math.ceil(b.length*.65);
}
const determiners=new Set('le la les un une des du ce cet cette ces mon ma mes ton ta tes son sa ses notre nos votre vos leur leurs'.split(' '));
const connectorWords=new Set('et mais ou donc car parce que puis alors'.split(' '));
const isDeterminer=s=>determiners.has(wordKey(s));
const isConnector=s=>connectorWords.has(wordKey(s));
// A legacy automatic target can be a malformed slice across a clause.
// It is retained as historical evidence, but cannot schedule a nonsensical
// standalone article or a fragment ending mid-frame.
export function malformedAutoTarget(word){
 const a=frenchTokens(word).map(t=>t.key);
 if(!a.length)return true;
 if(a.length===1)return isDeterminer(a[0]);
 // Explicit reusable frames are complete teaching objectives in their own right.
 if(/^(?:je (?:vais|veux|dois|peux|voudrais|suis|ne)|tu (?:as|es|vas|veux|dois|peux)|nous (?:avons|sommes|allons|voulons|devons|pouvons)|vous (?:avez|êtes|allez|voulez|devez|pouvez)|(?:il|elle) (?:a|est|va|veut|doit|peut)|(?:ils|elles) (?:ont|sont|vont)|parce que|pas encore)$/.test(a.join(' ')))return false;
 return isDeterminer(a.at(-1))||isConnector(a.at(-1))||
  /^(?:j'ai|j'|n'|je|tu|il|elle|nous|vous|ils|elles|vais|veux|dois|peux|voudrais|avons|avez)$/.test(a.at(-1))||
  isConnector(a[0])&&a.length>2;
}
export function isProtectedRevision(row){
 return row.level>0||['manual','pronunciation'].includes(row.lastDifficulty?.kind)||
  row.lastDifficulty?.kind==='review'&&!!row.lastAction;
}
const noise=new Set(("le la les un une des du de d' au aux l' ce cet cette ces je tu il elle on nous vous ils elles me te se ne pas et ou mais donc car parce que puis alors hier demain aujourd'hui matin soir encore déjà très bien à en y pour dans sur avec sans j'ai ai as a avons avez ont suis es est sommes êtes sont").split(' '));
export function targetContent(s){
 return [...new Set(frenchTokens(s).map(t=>t.key).filter(w=>!noise.has(w)&&!isDeterminer(w)))];
}
// Group only overlapping automatic targets, not every word that happened
// to occur in the same sentence. Preserve distinct legitimate weaknesses.
export function relatedRevisionTargets(a,b){
 if(!a?.word||!b?.word)return false;
 if(wordKey(a.word)===wordKey(b.word))return true;
 const x=targetContent(a.word),y=targetContent(b.word);
 if(!x.length||!y.length)return false;
 const common=x.filter(w=>y.includes(w)).length;
 return common>0&&(common===Math.min(x.length,y.length)||
  common/Math.max(x.length,y.length)>=.75)&&
  (containsTarget(a.word,b.word)||containsTarget(b.word,a.word)||
   common===Math.min(x.length,y.length));
}
export function groupRevisionTargets(rows){
 const chosen=[],out=[];
 for(const row of rows){
  if(!row.due||isProtectedRevision(row)){out.push(row);continue;}
  if(malformedAutoTarget(row.word)){out.push({...row,due:false,groupedReason:'Incomplete automatic fragment — use a meaningful word or phrase instead.'});continue;}
  const overlap=chosen.find(x=>relatedRevisionTargets(x,row));
  if(overlap){out.push({...row,due:false,groupedWith:overlap.word,groupedReason:'Grouped with '+overlap.word+' for this practice opportunity.'});continue;}
  chosen.push(row);out.push(row);
 }
 return out;
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
const frenchWritten=x=>!x.signal&&!['listening-rebuild-v1','pattern-practice-v1'].includes(x.marker)&&(x.targetLang==='fr'||!x.targetLang&&['guided-exact-v1','curriculum-v1','assessment-v1'].includes(x.marker));
export function auditSignals(x){
 if(!frenchWritten(x)||!['correct','incorrect'].includes(x.result)||!x.answer||!x.expected)return [];
 if(x.result==='incorrect'&&['guided','adaptive','repair'].includes(x.context?.stage)&&likelyTypingSlip(x.answer,x.expected))return [];
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
// Target the actual missing or substituted part, rather than automatically
// practising the first verb frame when the learner forgot an object.
export function missedLanguageTargets(answer,expected,en='',structure=''){
 const tokens=frenchTokens(expected),diffs=compareFrench(answer,expected);
 if(!tokens.length||likelyTypingSlip(answer,expected))return [];
 const bad=diffs.filter(x=>x.right&&x.kind!=='match'&&!x.near);
 if(!bad.length)return [phraseTarget(expected,en,structure)];
 const positions=[...new Set(bad.map(d=>tokens.findIndex(t=>t.start===d.right.start)).filter(i=>i>=0))];
 if(!positions.length)return [phraseTarget(expected,en,structure)];
 // Split at matched words and clause boundaries, never take the entire
 // span between the first and last error.
 const runs=[];
 for(const i of positions){
  const last=runs.at(-1);
  if(last&&i===last.at(-1)+1&&!isConnector(tokens[i].key)&&!isConnector(tokens[last.at(-1)].key))last.push(i);else runs.push([i]);
 }
 const out=[];
 for(const run of runs){
  let first=run[0],last=run.at(-1);
  if(first>0&&isDeterminer(tokens[first-1].key))first--;
  if(isDeterminer(tokens[last].key)&&last+1<tokens.length&&!isConnector(tokens[last+1].key))last++;
  const word=String(expected).slice(tokens[first].start,tokens[last].end);
  if(malformedAutoTarget(word))continue;
  out.push({word,sentence:expected,english:en,targetKind:frenchTokens(word).length>1?'phrase':'word',structure});
 }
 return [...new Map(out.map(x=>[wordKey(x.word),x])).values()];
}
export function missedLanguage(answer,expected,en='',structure=''){
 return missedLanguageTargets(answer,expected,en,structure)[0]||phraseTarget(expected,en,structure);
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
 const explicit=audits.filter(x=>x.answerAudit?.signal&&!['adaptive-plan','pattern-review','typing-slip'].includes(x.answerAudit.signal.kind)).map(x=>{
  const a=x.answerAudit,s=a.signal;
  // Reinterpret legacy manual review false negatives for scheduling only.
  // The immutable original audit is retained for transparency.
  const formattingOnly=a.marker==='revision-v1'&&s.kind==='review'&&!s.correct&&!a.context?.listeningAssisted&&a.answer?.trim()&&a.expected&&markAnswer(a.answer,a.expected);
  if(a.result==='incorrect'&&['guided','adaptive','repair'].includes(a.context?.stage)&&likelyTypingSlip(a.answer,a.expected))return null;
  return {...s,...(formattingOnly?{correct:true}:{}),context:a.context||{},id:x.id,at:x.at,ref:a.ref};
 }).filter(Boolean);
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
  if(x.marker==='listening-rebuild-v1'||x.marker==='pattern-practice-v1')continue;
  if(x.result==='incorrect'&&['guided','adaptive','repair'].includes(x.context?.stage)&&likelyTypingSlip(x.answer,x.expected))continue;
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
    const targets=missedLanguageTargets(x.answer,fr,english,context.structure);
    if(!seen.has(first)){seen.add(first);for(const target of targets)add({...target,kind:'construction',id:x.id+':construction:'+wordKey(target.word),ref:x.ref,at:x.at,context});}
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

// Personal revision is a view of recorded learning, never of the entire
// curriculum. Diagnostic errors and old revision-only attempts cannot seed it.
export function revisionEligibility({events=[],history=[],evidence=[],steps=[],track,now=Date.now()}={}){
 const selected=steps.filter(s=>(s.track||'michaela')===track);
 const units=new Set(selected.map(s=>s.unitId));
 const byStep=new Map(selected.map(s=>[s.id,s]));
 const byRef=new Map(selected.map(s=>[s.id+':complete',s]));
 const learned=[];
 const baseline=(context,ref)=>context?.stage==='baseline'||/^assess-v1:[^:]+:baseline:/.test(ref||'');
 const inTrack=(context={},ref='')=>{
   if(context.track&&context.track!==track)return false;
   if(context.unitId&&!units.has(context.unitId))return false;
   const unit=String(ref).match(/^(?:guided-v2|assess-v1|adaptive-v1):([^:]+):/)?.[1];
   return !unit||units.has(unit);
 };
 for(const row of evidence){
   const ref=row.source?.ref,step=byRef.get(ref),at=Number(row.at);
   if(!step||!Number.isFinite(at)||at>now||['independent','transfer','review'].includes(step.stage))continue;
   learned.push({fr:step.fr,at,stepId:step.id,unitId:step.unitId,unitName:step.unitName||'',type:'teaching',ref});
 }
 for(const x of history){
   const ctx=x.context||{},at=Number(x.at);
   // A genuinely correct pre-test can establish prior knowledge, but not
   // teaching. No prompted, listening-only, revision or reveal can do so.
   if(x.result!=='correct'||x.support!=='none'||x.targetLang!=='fr'||x.legacy||x.signal||
      /^revision:/.test(x.ref||'')||['transcribe','listen','model'].includes(ctx.kind)||
      !inTrack(ctx,x.ref)||!Number.isFinite(at)||at>now||!x.answer?.trim()||!x.expected||!markAnswer(x.answer,x.expected))continue;
   learned.push({fr:x.expected,at,stepId:ctx.stepId||'',unitId:ctx.unitId||'',unitName:x.activity||'',type:'prior-correct',ref:x.ref});
 }
 learned.sort((a,b)=>a.at-b.at);
 const matchCache=new Map();
 function proof(word){
   const key=wordKey(word);if(!key)return [];
   if(!matchCache.has(key))matchCache.set(key,learned.filter(x=>containsTarget(x.fr,word)));
   return matchCache.get(key);
 }
 const allowed=[],deferred=[],seeded=new Set();
 const derivedKinds=new Set(['review','assisted','exposure','success']);
 for(const e of [...events].sort((a,b)=>a.at-b.at||String(a.id).localeCompare(String(b.id)))){
   const context=e.context||{},key=wordKey(e.word);
   if(!key||!inTrack(context,e.ref)||!Number.isFinite(e.at)||e.at>now)continue;
   if(baseline(context,e.ref)){deferred.push({...e,reason:'starting check — not yet evidence of forgotten learning'});continue;}
   const available=proof(e.word),sameStep=context.stepId&&byStep.has(context.stepId);
   const first=available.find(p=>p.at<=e.at||(sameStep&&p.stepId===context.stepId));
   if(!first){deferred.push({...e,reason:available.length?'signal predates recorded learning':'no completed teaching or correct independent answer recorded'});continue;}
   if(derivedKinds.has(e.kind)&&!seeded.has(key)){deferred.push({...e,reason:'no eligible original revision signal'});continue;}
   if(!derivedKinds.has(e.kind))seeded.add(key);
   allowed.push({...e,learningProof:first});
 }
 const rows=revisionQueue(allowed,now).map(row=>{
   const proofs=proof(row.word),first=proofs[0];
   return {...row,learningProof:first,firstTaught:proofs.find(p=>p.type==='teaching')||null,firstCorrect:proofs.find(p=>p.type==='prior-correct')||null};
 });
 // Keep all historical records intact; only the derived scheduling view changes.
 const active=new Set(rows.map(x=>x.key)),pending=new Map();
 for(const e of deferred){const key=wordKey(e.word);if(!active.has(key))pending.set(key,{word:e.word,key,reason:e.reason,at:e.at,firstTaught:proof(e.word).find(p=>p.type==='teaching')||null,firstCorrect:proof(e.word).find(p=>p.type==='prior-correct')||null});}
 return {rows,deferred:[...pending.values()],excludedSignals:deferred.length,lookup:word=>{
   const key=wordKey(word),matches=proof(word),row=rows.find(r=>r.key===key);
   const related=history.filter(x=>!x.legacy&&x.result!=='withheld'&&inTrack(x.context||{},x.ref)&&containsTarget(x.context?.fr||x.expected||'',word));
   const diagnostic=related.filter(x=>baseline(x.context,x.ref));
   return {word,firstTaught:matches.find(p=>p.type==='teaching')||null,firstCorrect:matches.find(p=>p.type==='prior-correct')||null,diagnosticCount:diagnostic.length,attemptCount:related.length,revisionCount:related.filter(x=>/^revision:/.test(x.ref||'')).length,eligible:!!row,reason:row?'Eligible prior learning and a later revision signal':pending.get(key)?.reason||'No eligible revision signal recorded'};
 }};

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
