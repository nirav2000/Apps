// Word-level learning signals, separate from assessed mastery.
const DAY=86400000,MIN=60000;
export const wordKey=s=>String(s??'').normalize('NFC').toLocaleLowerCase('fr').replace(/[’‘]/g,"'").trim();
const flat=s=>wordKey(s).normalize('NFD').replace(/\p{M}/gu,'');
export function frenchTokens(s){
 return [...String(s??'').matchAll(/[\p{L}\p{M}]+(?:['’\-][\p{L}\p{M}]+)*/gu)].map(m=>({text:m[0],key:wordKey(m[0]),start:m.index,end:m.index+m[0].length}));
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
export function correctionSummary(answer,expected){
 const d=compareFrench(answer,expected).filter(x=>x.kind!=='match');
 if(!d.length)return 'Compare the punctuation and spacing with the model.';
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
    return {index,word:w.text,start:w.start,msPerChar:gaps.length>=2&&w.text.length>=3?Math.round(median(gaps)):null,samples:gaps.length};
   }).filter(x=>x.msPerChar!==null);
   if(rows.length<3)return [];
   const baseline=Math.max(40,median(rows.map(x=>x.msPerChar)));
   return rows.map(x=>({...x,baseline,ratio:Math.round(x.msPerChar/baseline*100)/100,slow:x.msPerChar>=2.2*baseline&&x.msPerChar-baseline>=180}));
  }
 };
}
const frenchWritten=x=>!x.signal&&(x.targetLang==='fr'||!x.targetLang&&['guided-exact-v1','curriculum-v1','assessment-v1'].includes(x.marker));
export function auditSignals(x){
 if(!frenchWritten(x)||!['correct','incorrect'].includes(x.result)||!x.answer||!x.expected)return [];
 const pairs=compareFrench(x.answer,x.expected),out=[];
 if(x.result==='incorrect')for(const d of pairs)if(d.near&&d.right&&d.left)out.push({kind:'spelling',word:d.right.text,actual:d.left.text,sentence:x.expected,ref:x.ref,at:x.at,id:x.id+':spelling:'+d.right.start});
 for(const timing of x.typing||[]){
  if(!timing.slow)continue;
  const d=pairs.find(pair=>pair.left?.start===timing.start);
  const word=x.result==='correct'?timing.word:d?.kind==='match'?d.right.text:null;
  if(word)out.push({kind:'hesitation',word,sentence:x.result==='correct'?x.answer:x.expected,ref:x.ref,at:x.at,id:x.id+':typing:'+timing.start,ratio:timing.ratio,msPerChar:timing.msPerChar,baseline:timing.baseline});
 }
 return out;
}
export function revisionEvents(audits,visible){
 return [...visible.flatMap(auditSignals),...audits.filter(x=>x.answerAudit?.signal).map(x=>({...x.answerAudit.signal,id:x.id,at:x.at,ref:x.answerAudit.ref}))];
}
export function revisionQueue(events,now=Date.now()){
 const map=new Map(),seen=new Set();
 for(const e of [...events].sort((a,b)=>a.at-b.at||String(a.id).localeCompare(String(b.id)))){
  if(!e.id||seen.has(e.id)||!e.word||!Number.isFinite(e.at)||!['spelling','pronunciation','hesitation','manual','review'].includes(e.kind))continue;
  seen.add(e.id);const key=wordKey(e.word);
  const row=map.get(key)||{key,word:e.word,score:0,level:0,dueAt:null,counts:{spelling:0,pronunciation:0,hesitation:0,manual:0,review:0},signals:[],sentence:''};
  row.counts[e.kind]++;row.signals.push(e);
  if(e.sentence)row.sentence=e.sentence;
  if(e.kind==='review'){
   row.lastReview=e.at;
   if(e.correct){row.level=Math.min(5,row.level+1);row.score=Math.max(0,row.score-2);row.dueAt=row.level>=5?null:e.at+[DAY,3*DAY,7*DAY,28*DAY][row.level-1];}
   else{row.level=0;row.score=Math.min(20,row.score+4);row.dueAt=e.at+10*MIN;}
  }else{
   const weight={spelling:4,pronunciation:1,hesitation:.5,manual:4}[e.kind];
   row.score=Math.min(20,row.score+weight);
   if(e.kind==='spelling'||e.kind==='manual')row.level=0;
   const interval=e.kind==='spelling'||e.kind==='manual'||row.score>=4?0:row.score>=2?6*60*MIN:e.kind==='hesitation'?3*DAY:DAY;
   if(e.kind!=='hesitation'||row.counts.hesitation>=2||row.counts.pronunciation||row.counts.spelling||row.counts.manual){
    const proposed=e.at+interval;row.dueAt=row.dueAt===null?proposed:Math.min(row.dueAt,proposed);
   }
  }
  map.set(key,row);
 }
 return [...map.values()].map(x=>({...x,due:x.dueAt!==null&&x.dueAt<=now,priority:x.score>=4?'High':x.score>=2?'Medium':'Low'})).sort((a,b)=>Number(b.due)-Number(a.due)||(a.due&&b.due?b.score-a.score:0)||(a.dueAt??Infinity)-(b.dueAt??Infinity)||b.score-a.score||a.key.localeCompare(b.key));
}
export function clozeFor(sentence,word){
 const src=String(sentence||''),target=wordKey(word);
 if(!src||wordKey(src)===target)return '';
 let found=false;
 const result=src.replace(/[\p{L}\p{M}]+(?:['’\-][\p{L}\p{M}]+)*/gu,w=>{if(wordKey(w)===target){found=true;return '____';}return w;});
 return found?result:'';
}
