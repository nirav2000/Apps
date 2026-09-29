(function(){
'use strict';
if(window.AppsPronunciation)return;

const VERSION=3;

function css(){
  if(document.getElementById('appsPronunciationStyles'))return;
  const s=document.createElement('style');
  s.id='appsPronunciationStyles';
  s.textContent=`
.apc{--apc-bg:#0d1724;--apc-panel:#142235;--apc-card:#1b2c43;--apc-text:#f6f8fb;--apc-muted:#aebdd0;--apc-accent:#64d8cb;--apc-good:#72d99a;--apc-warn:#ffd27a;--apc-bad:#ff8f8f;font:inherit;color:var(--apc-text);background:linear-gradient(145deg,#0d1724,#14283b);border-radius:22px;padding:18px;box-sizing:border-box;overflow:hidden}
.apc *{box-sizing:border-box}.apc button,.apc input,.apc select{font:inherit}.apc-head{display:flex;gap:12px;align-items:flex-start;justify-content:space-between;flex-wrap:wrap}.apc-eyebrow{font-size:11px;letter-spacing:.11em;text-transform:uppercase;color:var(--apc-muted);font-weight:800}.apc h3{margin:4px 0 0;font-size:22px}.apc-target{margin:14px 0;padding:14px 16px;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.1);border-radius:16px}.apc-target strong{display:block;font-size:clamp(20px,4vw,30px);line-height:1.25}.apc-target small{display:block;color:var(--apc-muted);margin-top:5px}.apc-model-status{display:flex;align-items:center;gap:7px;margin-top:9px;font-size:12px;color:var(--apc-muted)}.apc-model-status b{color:var(--apc-text)}.apc-actions{display:flex;gap:9px;flex-wrap:wrap;margin:12px 0}.apc button{min-height:44px;border:0;border-radius:13px;padding:10px 14px;cursor:pointer;font-weight:750}.apc button:disabled{opacity:.48;cursor:not-allowed}.apc-primary{background:var(--apc-accent);color:#08211f}.apc-secondary{background:rgba(255,255,255,.1);color:var(--apc-text);border:1px solid rgba(255,255,255,.12)!important}.apc-danger{background:#5b2430;color:white}.apc-wave{position:relative;background:rgba(0,0,0,.22);border-radius:18px;padding:8px;overflow:hidden}.apc canvas{display:block;width:100%;height:150px}.apc-wave-label{position:absolute;left:14px;top:11px;background:rgba(5,13,22,.66);padding:5px 8px;border-radius:999px;font-size:11px;color:var(--apc-muted)}.apc-meter{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:9px;margin-top:12px}.apc-score{background:rgba(255,255,255,.065);border-radius:14px;padding:11px;min-width:0}.apc-score strong{display:block;font-size:22px}.apc-score span{color:var(--apc-muted);font-size:11px;text-transform:uppercase;letter-spacing:.06em}.apc-result{margin-top:13px;display:grid;grid-template-columns:1.2fr .8fr;gap:10px}.apc-transcript,.apc-feedback{background:rgba(255,255,255,.055);border-radius:14px;padding:13px}.apc-transcript p,.apc-feedback p{margin:6px 0 0;line-height:1.4}.apc-feedback ul{margin:7px 0 0;padding-left:20px}.apc-feedback li{margin:5px 0}.apc-note{margin:11px 1px 0;color:var(--apc-muted);font-size:12px;line-height:1.4}.apc-status{display:inline-flex;align-items:center;gap:7px;color:var(--apc-muted);font-size:12px}.apc-dot{width:8px;height:8px;border-radius:50%;background:var(--apc-muted)}.apc-dot.live{background:#ff6f78;box-shadow:0 0 0 5px rgba(255,111,120,.12)}.apc-ref{color:var(--apc-good)}.apc-hidden{display:none!important}
@media(max-width:620px){.apc{padding:14px;border-radius:18px}.apc-meter{grid-template-columns:repeat(2,minmax(0,1fr))}.apc-result{grid-template-columns:1fr}.apc canvas{height:126px}.apc-actions button{flex:1 1 42%}}
`;
  document.head.appendChild(s);
}

function clamp(n,min,max){return Math.max(min,Math.min(max,n));}
function normText(s){return String(s||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[’']/g,"'").replace(/[^a-z0-9À-ž' -]/gi,' ').replace(/\s+/g,' ').trim();}
function tokens(s){const n=normText(s);return n?n.split(' '):[];}
function levenshtein(a,b){
  const m=a.length,n=b.length,dp=Array.from({length:m+1},()=>Array(n+1).fill(0));
  for(let i=0;i<=m;i++)dp[i][0]=i;
  for(let j=0;j<=n;j++)dp[0][j]=j;
  for(let i=1;i<=m;i++)for(let j=1;j<=n;j++)dp[i][j]=Math.min(dp[i-1][j]+1,dp[i][j-1]+1,dp[i-1][j-1]+(a[i-1]===b[j-1]?0:1));
  return dp[m][n];
}
function textScore(expected,heard){
  const a=tokens(expected),b=tokens(heard);
  if(!a.length||!b.length)return null;
  return Math.round(100*(1-levenshtein(a,b)/Math.max(a.length,b.length,1)));
}
function diffWords(expected,heard){
  const a=tokens(expected),b=tokens(heard),missing=[];
  a.forEach(w=>{if(!b.includes(w))missing.push(w)});
  return [...new Set(missing)].slice(0,5);
}
function autocorrelate(buf,sampleRate){
  let size=buf.length,rms=0;
  for(let i=0;i<size;i++)rms+=buf[i]*buf[i];
  rms=Math.sqrt(rms/size);
  if(rms<0.012)return null;
  let start=0,end=size-1,thr=.18;
  for(let i=0;i<size/2;i++){if(Math.abs(buf[i])<thr){start=i;break;}}
  for(let i=1;i<size/2;i++){if(Math.abs(buf[size-i])<thr){end=size-i;break;}}
  const data=buf.slice(start,end),n=data.length,c=new Array(n).fill(0);
  for(let lag=0;lag<n;lag++){let sum=0;for(let i=0;i<n-lag;i++)sum+=data[i]*data[i+lag];c[lag]=sum;}
  let d=0;while(d+1<c.length&&c[d]>c[d+1])d++;
  let max=-1,pos=-1;
  for(let i=d;i<c.length;i++)if(c[i]>max){max=c[i];pos=i;}
  if(pos<=0)return null;
  let x1=c[pos-1]||c[pos],x2=c[pos],x3=c[pos+1]||c[pos],den=(x1-2*x2+x3),shift=den?0.5*(x1-x3)/den:0;
  const freq=sampleRate/(pos+shift);
  return freq>=70&&freq<=900?freq:null;
}
function resample(arr,n){
  if(!arr.length)return [];
  if(arr.length===1)return Array(n).fill(arr[0]);
  const out=[];
  for(let i=0;i<n;i++){
    const p=i*(arr.length-1)/(n-1),lo=Math.floor(p),hi=Math.min(arr.length-1,lo+1),f=p-lo;
    out.push(arr[lo]*(1-f)+arr[hi]*f);
  }
  return out;
}
function zscore(arr){
  if(!arr.length)return [];
  const m=arr.reduce((a,b)=>a+b,0)/arr.length;
  const sd=Math.sqrt(arr.reduce((s,x)=>s+(x-m)*(x-m),0)/arr.length)||1;
  return arr.map(x=>(x-m)/sd);
}
function contourScore(a,b){
  if(a.length<4||b.length<4)return null;
  const aa=zscore(resample(a,32)),bb=zscore(resample(b,32));
  const err=aa.reduce((s,x,i)=>s+Math.abs(x-bb[i]),0)/aa.length;
  return Math.round(clamp(100-err*35,0,100));
}
function rhythmScore(ref,trial){
  if(!ref||!trial||!ref.duration||!trial.duration)return null;
  const ratio=Math.min(ref.duration,trial.duration)/Math.max(ref.duration,trial.duration);
  const voiceRatio=Math.min(ref.voicedRatio||0,trial.voicedRatio||0)/Math.max(ref.voicedRatio||.001,trial.voicedRatio||.001);
  return Math.round(clamp((ratio*.72+voiceRatio*.28)*100,0,100));
}
function grade(n){if(n==null)return '—';if(n>=90)return 'Excellent';if(n>=78)return 'Very close';if(n>=62)return 'Getting there';return 'Try again';}
function scoreLabel(n){return n==null?'—':Math.round(n)+'%';}

function mount(target,options={}){
  css();
  const root=typeof target==='string'?document.querySelector(target):target;
  if(!root)throw new Error('AppsPronunciation target not found');
  let opts={lang:'fr-FR',targetText:'Bonjour',title:'Pronunciation coach',...options};
  let stream=null,ctx=null,analyser=null,raf=0,recognition=null,recorder=null,chunks=[],started=0,lastFrame=0,mode=null;
  let current=null,reference=null,generatedReference=null,lastResult=null,spokenText='',speechConfidence=null;
  let referenceLoadId=0,referenceAudio=null;
  root.innerHTML=`
  <section class="apc" aria-label="Pronunciation coach">
    <div class="apc-head">
      <div><div class="apc-eyebrow">VOICE LAB · PROTOTYPE</div><h3 class="apc-title"></h3></div>
      <div class="apc-status"><span class="apc-dot"></span><span class="apc-status-text">Ready</span></div>
    </div>
    <div class="apc-target"><strong class="apc-target-text"></strong><small>Listen, then try to match the words, rhythm and rise/fall of the voice.</small><div class="apc-model-status"><span>Reference:</span><b class="apc-model-label">Preparing…</b></div></div>
    <div class="apc-actions">
      <button type="button" class="apc-secondary apc-hear">🔊 Hear target</button>
      <button type="button" class="apc-secondary apc-model">🎙 Replace model</button>
      <button type="button" class="apc-secondary apc-generated apc-hidden">↺ Use generated model</button>
      <button type="button" class="apc-primary apc-record">● Child's turn</button>
      <button type="button" class="apc-danger apc-stop apc-hidden">■ Stop</button>
    </div>
    <div class="apc-wave">
      <span class="apc-wave-label">live voice waveform</span>
      <canvas class="apc-canvas" width="1000" height="240" aria-label="Live stylised speech waveform"></canvas>
    </div>
    <div class="apc-meter">
      <div class="apc-score"><span>Words</span><strong class="apc-words">—</strong><small class="apc-words-grade"></small></div>
      <div class="apc-score"><span>Rhythm</span><strong class="apc-rhythm">—</strong><small class="apc-rhythm-grade"></small></div>
      <div class="apc-score"><span>Intonation</span><strong class="apc-pitch">—</strong><small class="apc-pitch-grade"></small></div>
      <div class="apc-score"><span>Overall</span><strong class="apc-overall">—</strong><small class="apc-overall-grade"></small></div>
    </div>
    <div class="apc-result">
      <div class="apc-transcript"><div class="apc-eyebrow">WHAT THE BROWSER HEARD</div><p class="apc-heard">No attempt yet.</p></div>
      <div class="apc-feedback"><div class="apc-eyebrow">COACHING CUE</div><ul class="apc-feedback-list"><li>The app is preparing a default pronunciation model.</li></ul></div>
    </div>
    <p class="apc-note">The generated reference is a consistent learning model, not a claim that only one accent is correct. A teacher recording can replace it. Student microphone audio stays in this browser unless a scoring adapter is explicitly configured.</p>
  </section>`;

  const q=s=>root.querySelector(s),canvas=q('.apc-canvas'),g=canvas.getContext('2d');
  const titleEl=q('.apc-title'),targetEl=q('.apc-target-text'),dot=q('.apc-dot'),status=q('.apc-status-text');
  const modelBtn=q('.apc-model'),generatedBtn=q('.apc-generated'),recordBtn=q('.apc-record'),stopBtn=q('.apc-stop'),hearBtn=q('.apc-hear'),modelLabel=q('.apc-model-label');
  function renderLabels(){titleEl.textContent=opts.title;targetEl.textContent=opts.targetText;}
  function setStatus(t,live=false){status.textContent=t;dot.classList.toggle('live',live);}
  function clearScores(){
    ['words','rhythm','pitch','overall'].forEach(k=>{q('.apc-'+k).textContent='—';q('.apc-'+k+'-grade').textContent='';});
    q('.apc-heard').textContent='No attempt yet.';
  }
  function paintIdle(){
    const w=canvas.width,h=canvas.height;g.clearRect(0,0,w,h);
    const grad=g.createLinearGradient(0,0,w,0);grad.addColorStop(0,'#2e6474');grad.addColorStop(.5,'#6bd9ce');grad.addColorStop(1,'#5576a3');
    g.strokeStyle=grad;g.lineWidth=6;g.lineCap='round';g.beginPath();
    for(let x=0;x<w;x+=6){const y=h/2+Math.sin(x/52)*8+Math.sin(x/21)*4;if(x===0)g.moveTo(x,y);else g.lineTo(x,y);}g.stroke();
  }
  function paintWave(data,rms){
    const w=canvas.width,h=canvas.height;g.clearRect(0,0,w,h);
    const grad=g.createLinearGradient(0,0,w,0);grad.addColorStop(0,'#3d8da2');grad.addColorStop(.5,'#6fe2d1');grad.addColorStop(1,'#7c89d9');
    g.fillStyle='rgba(255,255,255,.025)';g.fillRect(0,0,w,h);
    const mid=h/2,amp=Math.min(.95,.7+rms*4),step=data.length/w;
    g.strokeStyle='rgba(111,226,209,.18)';g.lineWidth=22;g.beginPath();
    for(let x=0;x<w;x++){const y=mid+data[Math.floor(x*step)]*mid*amp*.72;if(x===0)g.moveTo(x,y);else g.lineTo(x,y);}g.stroke();
    g.strokeStyle=grad;g.lineWidth=5;g.beginPath();
    for(let x=0;x<w;x++){const y=mid+data[Math.floor(x*step)]*mid*amp*.78;if(x===0)g.moveTo(x,y);else g.lineTo(x,y);}g.stroke();
    g.strokeStyle='rgba(255,255,255,.14)';g.lineWidth=1;g.beginPath();g.moveTo(0,mid);g.lineTo(w,mid);g.stroke();
  }
  function analyseBuffer(buffer){
    const data=buffer.getChannelData(0),sampleRate=buffer.sampleRate,frame=2048,hop=Math.max(512,Math.floor(sampleRate*.055));
    const out={pitch:[],energy:[],voiced:0,frames:0,duration:buffer.duration,voicedRatio:0,audioBlob:null,audioUrl:null,source:'generated'};
    for(let start=0;start+frame<data.length;start+=hop){
      const slice=data.subarray(start,start+frame);let rms=0;
      for(let i=0;i<slice.length;i++)rms+=slice[i]*slice[i];
      rms=Math.sqrt(rms/slice.length);out.energy.push(rms);out.frames++;if(rms>.018)out.voiced++;
      const p=autocorrelate(slice,sampleRate);if(p)out.pitch.push(p);
    }
    out.voicedRatio=out.frames?out.voiced/out.frames:0;
    return out;
  }
  async function referenceFromBlob(blob,label){
    const AC=window.AudioContext||window.webkitAudioContext;
    if(!AC)throw new Error('Audio decoding is unavailable');
    const ac=new AC();
    try{
      const buffer=await ac.decodeAudioData((await blob.arrayBuffer()).slice(0));
      const ref=analyseBuffer(buffer);ref.audioBlob=blob;ref.audioUrl=URL.createObjectURL(blob);ref.source=label||'generated';
      return ref;
    }finally{try{await ac.close();}catch(e){}}
  }
  function disposeReference(ref){
    if(ref&&ref.audioUrl)try{URL.revokeObjectURL(ref.audioUrl);}catch(e){}
  }
  function setReference(ref,label,isGenerated){
    if(reference&&reference!==generatedReference&&reference!==ref)disposeReference(reference);
    reference=ref||null;
    if(isGenerated){if(generatedReference&&generatedReference!==ref)disposeReference(generatedReference);generatedReference=ref;}
    modelLabel.textContent=label||'No acoustic model';
    generatedBtn.classList.toggle('apc-hidden',!generatedReference||reference===generatedReference);
    modelBtn.textContent=reference&&reference!==generatedReference?'✓ Re-record teacher model':'🎙 Replace model';
    modelBtn.classList.toggle('apc-ref',!!reference&&reference!==generatedReference);
  }
  async function loadGeneratedReference(){
    const id=++referenceLoadId;
    if(typeof opts.referenceProvider!=='function'){
      setReference(null,'Device voice only · record a model for acoustic scoring',false);
      q('.apc-feedback-list').innerHTML='<li>Use “Hear target” for the device voice, or record a teacher model to unlock rhythm and intonation scoring.</li>';
      return false;
    }
    setStatus('Preparing pronunciation model…');modelLabel.textContent='Generating…';recordBtn.disabled=true;
    try{
      const result=await opts.referenceProvider({targetText:opts.targetText,lang:opts.lang});
      if(id!==referenceLoadId)return false;
      let blob=null,label='Generated reference';
      if(result instanceof Blob)blob=result;
      else if(result instanceof ArrayBuffer)blob=new Blob([result],{type:'audio/wav'});
      else if(result&&result.blob instanceof Blob){blob=result.blob;label=result.label||result.source||label;}
      else if(result&&result.arrayBuffer instanceof ArrayBuffer){blob=new Blob([result.arrayBuffer],{type:result.type||'audio/wav'});label=result.label||result.source||label;}
      if(!blob)throw new Error('No reference audio returned');
      const ref=await referenceFromBlob(blob,label);
      if(id!==referenceLoadId){disposeReference(ref);return false;}
      setReference(ref,label,true);setStatus('Generated model ready');q('.apc-feedback-list').innerHTML='<li>Default pronunciation model ready. Listen once, then record the child.</li>';paintIdle();
      return true;
    }catch(e){
      if(id!==referenceLoadId)return false;
      setReference(null,'Generated model unavailable · device voice fallback',false);setStatus('Device voice fallback');
      q('.apc-feedback-list').innerHTML='<li>The generated model is unavailable. “Hear target” still uses the device voice; record a teacher model for acoustic comparison.</li>';
      return false;
    }finally{if(id===referenceLoadId)recordBtn.disabled=false;}
  }
  function playReference(){
    if(reference&&reference.audioUrl){
      if(referenceAudio){try{referenceAudio.pause();}catch(e){}}
      referenceAudio=new Audio(reference.audioUrl);referenceAudio.play().catch(()=>{});
      return;
    }
    if(!('speechSynthesis'in window))return;
    speechSynthesis.cancel();const u=new SpeechSynthesisUtterance(opts.targetText);u.lang=opts.lang;u.rate=.86;speechSynthesis.speak(u);
  }
  function paintComparison(ref,trial){
    const w=canvas.width,h=canvas.height;g.clearRect(0,0,w,h);
    g.fillStyle='rgba(255,255,255,.025)';g.fillRect(0,0,w,h);
    const rp=resample((ref&&ref.pitch)||[],64),tp=resample((trial&&trial.pitch)||[],64);
    if(rp.length<4||tp.length<4){paintIdle();return;}
    const all=rp.concat(tp),min=Math.min.apply(null,all),max=Math.max.apply(null,all),span=Math.max(30,max-min);
    const y=v=>h-28-((v-min)/span)*(h-60);
    const draw=(arr,stroke,width)=>{
      g.strokeStyle=stroke;g.lineWidth=width;g.lineCap='round';g.lineJoin='round';g.beginPath();
      arr.forEach((v,i)=>{const x=22+i*(w-44)/(arr.length-1),yy=y(v);if(i===0)g.moveTo(x,yy);else g.lineTo(x,yy);});
      g.stroke();
    };
    draw(rp,'rgba(255,255,255,.46)',8);
    draw(tp,'#6fe2d1',5);
    g.font='24px system-ui, sans-serif';g.fillStyle='rgba(255,255,255,.65)';g.fillText('model',22,28);
    g.fillStyle='#6fe2d1';g.fillText('child',116,28);
  }
  function startRecognition(){
    spokenText='';speechConfidence=null;
    const SR=window.SpeechRecognition||window.webkitSpeechRecognition;
    if(!SR)return;
    recognition=new SR();recognition.lang=opts.lang;recognition.interimResults=true;recognition.continuous=true;
    recognition.onresult=e=>{
      let final='',interim='',conf=[];
      for(let i=e.resultIndex;i<e.results.length;i++){
        const r=e.results[i],t=r[0].transcript;
        if(r.isFinal){final+=t+' ';if(typeof r[0].confidence==='number')conf.push(r[0].confidence);}else interim+=t;
      }
      if(final)spokenText=(spokenText+' '+final).trim();
      if(conf.length)speechConfidence=conf.reduce((a,b)=>a+b,0)/conf.length;
      q('.apc-heard').textContent=(spokenText+' '+interim).trim()||'Listening…';
    };
    recognition.onerror=()=>{};
    try{recognition.start();}catch(e){}
  }
  function stopRecognition(){if(recognition){try{recognition.stop();}catch(e){}recognition=null;}}
  async function begin(nextMode){
    if(mode)return;
    if(!navigator.mediaDevices||!navigator.mediaDevices.getUserMedia){setStatus('Microphone unavailable');return;}
    try{
      stream=await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:true,noiseSuppression:true,autoGainControl:true}});
      ctx=new (window.AudioContext||window.webkitAudioContext)();
      await ctx.resume();
      const src=ctx.createMediaStreamSource(stream);analyser=ctx.createAnalyser();analyser.fftSize=2048;src.connect(analyser);
      chunks=[];if(window.MediaRecorder){try{recorder=new MediaRecorder(stream);recorder.ondataavailable=e=>{if(e.data&&e.data.size)chunks.push(e.data)};recorder.start();}catch(e){recorder=null;}}
      current={pitch:[],energy:[],voiced:0,frames:0,duration:0,voicedRatio:0,audioBlob:null};started=performance.now();lastFrame=0;mode=nextMode;
      modelBtn.disabled=true;recordBtn.disabled=true;stopBtn.classList.remove('apc-hidden');setStatus(nextMode==='reference'?'Recording model…':'Listening to child…',true);
      if(nextMode==='attempt')startRecognition();
      const timeBuf=new Float32Array(analyser.fftSize);
      const tick=now=>{
        if(!mode)return;
        analyser.getFloatTimeDomainData(timeBuf);
        let rms=0;for(let i=0;i<timeBuf.length;i++)rms+=timeBuf[i]*timeBuf[i];rms=Math.sqrt(rms/timeBuf.length);
        paintWave(timeBuf,rms);
        if(now-lastFrame>55){
          lastFrame=now;current.frames++;current.energy.push(rms);if(rms>.018)current.voiced++;
          const p=autocorrelate(timeBuf,ctx.sampleRate);if(p)current.pitch.push(p);
        }
        raf=requestAnimationFrame(tick);
      };
      raf=requestAnimationFrame(tick);
    }catch(e){setStatus(e&&e.name==='NotAllowedError'?'Microphone permission denied':'Could not start microphone');mode=null;modelBtn.disabled=false;recordBtn.disabled=false;}
  }
  async function end(){
    if(!mode)return;
    const finishedMode=mode;mode=null;cancelAnimationFrame(raf);stopRecognition();
    if(recorder&&recorder.state!=='inactive'){await new Promise(resolve=>{recorder.onstop=resolve;recorder.stop();});current.audioBlob=chunks.length?new Blob(chunks,{type:recorder.mimeType||'audio/webm'}):null;}
    current.duration=(performance.now()-started)/1000;current.voicedRatio=current.frames?current.voiced/current.frames:0;
    if(stream)stream.getTracks().forEach(t=>t.stop());
    if(ctx)try{await ctx.close();}catch(e){}
    stream=null;ctx=null;analyser=null;recorder=null;
    modelBtn.disabled=false;recordBtn.disabled=false;stopBtn.classList.add('apc-hidden');
    if(finishedMode==='reference'){
      current.source='teacher recording';setReference(current,'Teacher-recorded model',false);setStatus('Teacher model ready');q('.apc-feedback-list').innerHTML='<li>Teacher model captured. It now replaces the generated reference for comparison.</li>';paintIdle();return;
    }
    setStatus('Scoring…');await scoreAttempt(current);if(reference)paintComparison(reference,current);else paintIdle();setStatus('Ready for another try');
  }
  async function scoreAttempt(trial){
    const words=textScore(opts.targetText,spokenText),rhythm=reference?rhythmScore(reference,trial):null,pitch=reference?contourScore(reference.pitch,trial.pitch):null;
    let provider=null;
    if(typeof opts.scoreAdapter==='function'){
      try{provider=await opts.scoreAdapter({targetText:opts.targetText,lang:opts.lang,audioBlob:trial.audioBlob,transcript:spokenText,features:{trial,reference}});}catch(e){provider={error:true};}
    }
    const phoneme=provider&&Number.isFinite(provider.overall)?clamp(provider.overall,0,100):null;
    const available=[phoneme!=null?[phoneme,.65]:null,words!=null?[words,.55]:null,rhythm!=null?[rhythm,.2]:null,pitch!=null?[pitch,.25]:null].filter(Boolean);
    const denom=available.reduce((s,x)=>s+x[1],0),overall=available.length?Math.round(available.reduce((s,x)=>s+x[0]*x[1],0)/denom):null;
    const out={words,rhythm,pitch,overall,provider,transcript:spokenText,confidence:speechConfidence,duration:trial.duration,reference:!!reference};
    lastResult=out;
    const map={words,rhythm,pitch,overall};Object.keys(map).forEach(k=>{q('.apc-'+k).textContent=scoreLabel(map[k]);q('.apc-'+k+'-grade').textContent=grade(map[k]);});
    q('.apc-heard').textContent=spokenText||'Speech-to-text was unavailable or did not return a transcript. Acoustic comparison can still work if a model voice was recorded.';
    const feedback=[];
    if(provider&&Array.isArray(provider.feedback))feedback.push(...provider.feedback.slice(0,3));
    const missing=diffWords(opts.targetText,spokenText);
    if(words!=null&&words<88&&missing.length)feedback.push('The recogniser did not confidently hear: '+missing.join(', ')+'. Say those parts slowly once, then repeat the whole phrase.');
    if(reference&&rhythm!=null&&rhythm<78){
      const faster=trial.duration<reference.duration;feedback.push((faster?'You were quicker than the model.':'You were slower than the model.')+' Try matching the model\'s pace and pauses.');
    }
    if(reference&&pitch!=null&&pitch<75)feedback.push('Match the rise and fall of the model voice rather than saying every part on one level.');
    if(!reference)feedback.push('No acoustic reference is available, so rhythm and intonation are not being scored.');
    if(!spokenText)feedback.push('Word scoring is unavailable on this browser, so do not treat the overall score as a pronunciation mark.');
    if(!feedback.length)feedback.push('Very close. Repeat it once more and see if the score stays high rather than treating one attempt as mastery.');
    q('.apc-feedback-list').innerHTML=feedback.map(x=>'<li>'+String(x).replace(/[&<>]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;'}[c]))+'</li>').join('');
    root.dispatchEvent(new CustomEvent('apps-pronunciation:result',{bubbles:true,detail:out}));
  }

  hearBtn.addEventListener('click',playReference);
  modelBtn.addEventListener('click',()=>begin('reference'));
  generatedBtn.addEventListener('click',()=>{if(generatedReference){setReference(generatedReference,generatedReference.source||'Generated reference',true);setStatus('Generated model restored');paintIdle();}});
  recordBtn.addEventListener('click',()=>begin('attempt'));
  stopBtn.addEventListener('click',end);
  renderLabels();clearScores();paintIdle();loadGeneratedReference();

  return {
    setTarget(text,lang){
      opts.targetText=String(text||'').trim()||opts.targetText;if(lang)opts.lang=lang;
      referenceLoadId++;disposeReference(reference);if(generatedReference&&generatedReference!==reference)disposeReference(generatedReference);
      reference=null;generatedReference=null;modelBtn.classList.remove('apc-ref');generatedBtn.classList.add('apc-hidden');
      renderLabels();clearScores();q('.apc-feedback-list').innerHTML='<li>Preparing the default pronunciation model for this target.</li>';loadGeneratedReference();
    },
    getLastResult(){return lastResult;},
    getReference(){return reference;},
    async destroy(){referenceLoadId++;if(mode)await end();if(referenceAudio)try{referenceAudio.pause();}catch(e){}if(window.speechSynthesis)window.speechSynthesis.cancel();disposeReference(reference);if(generatedReference&&generatedReference!==reference)disposeReference(generatedReference);root.innerHTML='';},
    version:VERSION
  };
}

window.AppsPronunciation={version:VERSION,mount};
})();