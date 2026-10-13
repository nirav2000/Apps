import {VERSION,RollingEvidence,cleanFrame,context,rect,viewport,intersect,makeReport,id} from './core.mjs';
import {saveReport,exportReport,downloadBlob} from './storage.mjs';
export {VERSION};
const CSS=`:host{font:14px system-ui,sans-serif;color:#f4f6fb;color-scheme:dark}*{box-sizing:border-box}button,a,input,textarea{font:inherit}button,a{min-height:44px;border-radius:10px;padding:10px 14px;background:#253044;color:#f4f6fb;border:1px solid #52627a;cursor:pointer}button:focus-visible,a:focus-visible{outline:3px solid #8dc8ff;outline-offset:2px}button:disabled{opacity:.5}button.primary{background:#c9e4ff;color:#10243b}button.danger{background:#512d39}button:hover{filter:brightness(1.15)}[hidden]{display:none!important}.badge{position:fixed;z-index:2147482000;left:max(8px,env(safe-area-inset-left));top:max(5px,env(safe-area-inset-top));display:flex;gap:5px;padding:3px;border-radius:12px;background:#172238;box-shadow:0 2px 14px #0008}.badge button{min-height:34px;padding:5px 9px;font-size:12px}.badge strong{align-self:center;font-size:12px;padding:0 5px}.dot{color:#ffbd75}dialog{width:min(540px,calc(100vw - 24px));max-height:calc(100dvh - 24px);background:#101925;color:#f4f6fb;border:1px solid #53627a;border-radius:18px;padding:22px;overflow:auto;box-shadow:0 12px 60px #0009}dialog::backdrop{background:#000a}h2{font-size:24px;margin:0 0 12px}p{line-height:1.55;color:#b9c9dc}.row{display:flex;flex-wrap:wrap;gap:9px;margin:14px 0}.close{float:right}.consent{display:flex;gap:10px;align-items:start;line-height:1.5}.consent input{width:20px;height:20px;flex-shrink:0}textarea{display:block;width:100%;height:90px;resize:vertical;background:#1e293a;color:white;border:1px solid #53627a;padding:10px;border-radius:10px;margin-top:7px}.status{min-height:22px;color:#b9e6ce}.warning{color:#ffd4a0}a{display:inline-flex;text-decoration:none;align-items:center}.limits{font-size:12px}.capture{border-top:1px solid #36465d;margin-top:18px;padding-top:8px}`;
const NS='http://www.w3.org/2000/svg';
export function measure({targets=[],getContext=()=>({})}={}){
  const start=performance.now(),vv=window.visualViewport;
  const v=viewport({x:vv?.offsetLeft||0,y:vv?.offsetTop||0,width:vv?.width||innerWidth,height:vv?.height||innerHeight,scale:vv?.scale||1,layoutWidth:innerWidth,layoutHeight:innerHeight});
  const c=context(getContext());
  const nodes=[];const bindings=[];
  for(const spec of targets.slice(0,64)){
    const el=spec.element;if(!el||!(el instanceof Element))continue;
    const r=rect(el.getBoundingClientRect()),style=getComputedStyle(el);
    const visible=!!el.getClientRects().length&&r.width>0&&r.height>0&&style.visibility!=='hidden'&&style.display!=='none'&&Number(style.opacity)!==0;
    let clipped=false;
    if(visible)for(let p=el.parentElement;p&&p!==document.body;p=p.parentElement){const s=getComputedStyle(p),b=p.getBoundingClientRect();
      if(/hidden|clip|auto|scroll/.test(s.overflowX)&&(r.x<b.left-1||r.x+r.width>b.right+1))clipped=true;
      if(/hidden|clip|auto|scroll/.test(s.overflowY)&&(r.y<b.top-1||r.y+r.height>b.bottom+1))clipped=true;
    }
    let obstructed=false;
    if(visible&&intersect(r,v)>0&&spec.required){
      const points=[[.5,.5],[.15,.15],[.85,.85]];
      let blocked=0,checked=0;
      for(const [px,py] of points){const x=r.x+r.width*px,y=r.y+r.height*py;if(x<v.x||y<v.y||x>v.x+v.width||y>v.y+v.height)continue;
        const hit=document.elementsFromPoint(x,y).find(n=>!n.closest('[data-diagnostics-ignore]'));
        checked++;if(hit&&hit!==el&&!el.contains(hit)&&!hit.contains(el))blocked++;
      }
      obstructed=checked>0&&blocked>0;
    }
    // Labels come only from the app's explicit target list, never scraped page text.
    nodes.push({id:id(spec.id),role:spec.role,label:spec.label||spec.id,rect:r,visible,required:spec.required===true,clipped,obstructed,blocker:''});bindings.push(el);
  }
  for(let i=0;i<nodes.length;i++){const n=nodes[i];if(!n.required||!n.visible)continue;
    for(let j=0;j<nodes.length;j++){const b=nodes[j];if(i===j||b.role!=='blocker'||!b.visible||bindings[j].contains(bindings[i]))continue;
      if(intersect(n.rect,b.rect)>4){n.blocker=b.id;break;}
    }
  }
  const a=document.activeElement;
  return cleanFrame({time:Date.now(),viewport:v,context:c,nodes,scroll:{x:scrollX,y:scrollY},durationMs:performance.now()-start,
    focusedEditable:!!(a&&a.matches('input:not([readonly]):not([disabled]),textarea:not([readonly]):not([disabled]),[contenteditable="true"]')&&!a.closest('[data-diagnostics-ignore]'))});
}
export function init(options={}){
  if(!/^[a-zA-Z0-9_.-]{1,80}$/.test(options.appId||''))throw Error('Diagnostics requires an appId.');
  const root=options.root||document.body;
  if(root.__appsDiagnostics)return root.__appsDiagnostics;
  const evidence=new RollingEvidence();let frozen=null;let recording=false,interval=null,pending=null,lastFrame=0,lastReport=null,previousFocus=null,hiddenPause=false,destroyed=false;
  const host=document.createElement('div');host.dataset.diagnosticsIgnore='true';host.id='appsDiagnostics';
  const shadow=host.attachShadow({mode:'open'});const style=document.createElement('style');style.textContent=CSS;shadow.append(style);
  const box=document.createElement('div');box.innerHTML=`<div class="badge" hidden><strong><span class="dot">&#9679;</span> Diagnostics</strong><button data-do="report">Report</button><button data-do="stop">Stop</button></div><dialog aria-labelledby="diagTitle"><button class="close" data-do="close" aria-label="Close diagnostics">&#215;</button><h2 id="diagTitle">Help improve ${id(options.appId)}</h2><p>Inspect this screen or capture the last two minutes of app events and layout measurements. No paid service, replay library or AI API is used.</p><label class="consent"><input id="consent" type="checkbox">I agree to capture this app's approved controls and geometry on this device. Capture stops on reload and pauses while the page is hidden.</label><p class="limits">No microphone, camera, account data, arbitrary page text or typed text. Nothing uploads during capture. Measurements are not screenshots and cannot show Safari's own interface.</p><div class="row"><button data-do="inspect">Inspect screen</button><button data-do="start" class="primary">Start diagnostics</button><button data-do="stop" class="danger">Stop</button></div><label>Optional comment<textarea id="comment" maxlength="1200" placeholder="What felt wrong?"></textarea></label><div class="row"><button data-do="save" class="primary">Save report locally</button><button data-do="export">Export JSON</button><button data-do="clear">Delete captured history</button></div><a id="review" hidden target="_blank" rel="noopener">Review report / create issue</a><p id="status" class="status" role="status" aria-live="polite"></p><div class="capture"><strong>Real pixels, separately</strong><p id="pixels" class="limits"></p><div class="row"><button data-do="pixels">Record real screen</button><button data-do="endpixels" hidden>Stop video</button></div><p class="limits">Supported browsers ask you to choose a screen. No audio is requested. Video is limited to two minutes / 25 MB, stays local, and is not attached to an issue automatically. On iPhone/iPad, use the built-in screen recorder and open the original file in the review page.</p></div><p class="limits">Shared Diagnostics v${VERSION}. Up to 12 local reports retained; deleting a report here does not delete an already-published issue.</p></dialog>`;shadow.append(box);document.body.append(host);
  const q=s=>shadow.querySelector(s),dialog=q('dialog'),status=q('#status');
  let mediaRecorder=null,mediaStream=null,mediaTimer=null,mediaChunks=[],mediaBytes=0;
  const supportsPixels=typeof navigator.mediaDevices?.getDisplayMedia==='function'&&typeof MediaRecorder!=='undefined';
  q('[data-do="pixels"]').disabled=!supportsPixels;
  q('#pixels').textContent=supportsPixels?'Your browser exposes screen capture. Choose the app tab for the closest evidence.':'This browser cannot record screen pixels from a webpage. No reconstructed image will be presented as a real screenshot.';
  function targets(){try{return options.targets?.()||[];}catch{return [];}}
  const getContext=()=>{try{return options.getContext?.()||{};}catch{return {};}};
  function inspect(reason='inspect'){
    if(destroyed)return null;
    const f=measure({targets:targets(),getContext});f.reason=reason;
    evidence.frame(f);if(!recording)frozen=evidence.snapshot();lastFrame=performance.now();options.onFrame?.(f);return f;
  }
  function schedule(reason){if(!recording||document.hidden||dialog.open||pending!==null)return;
    pending=setTimeout(()=>{pending=null;if(recording&&!document.hidden&&!dialog.open)inspect(reason);},Math.max(0,160-(performance.now()-lastFrame)));
  }
  function recognised(el){if(!(el instanceof Element)||el.closest('[data-diagnostics-ignore]'))return '';
    return id(options.eventTarget?.(el)||'');
  }
  const click=e=>{if(!recording||document.hidden)return;const target=recognised(e.target);if(!target)return;
    evidence.event({type:e.type,target,pointer:e.pointerType||'mouse',x:e.clientX,y:e.clientY});schedule('interaction');};
  const focus=e=>{if(!recording||document.hidden)return;const target=recognised(e.target);if(!target)return;evidence.event({type:'focus',target});schedule('focus');};
  const key=e=>{if(!recording||document.hidden||e.composedPath().includes(host))return;const target=recognised(e.target);if(!target)return;
    // Raw keys / typed characters are deliberately never recorded.
    evidence.event({type:'key-received',target,pointer:'keyboard'});schedule('key');};
  const changed=()=>schedule('viewport');const visibility=()=>{if(!recording)return;hiddenPause=document.hidden;evidence.event({type:document.hidden?'hidden':'visible',target:'page'});if(!document.hidden)schedule('visible');};
  const pageExit=()=>{stop();endPixels();};
  function start(){if(!q('#consent').checked){status.textContent='Please enable the capture consent checkbox first.';return false;}if(recording)return true;
    frozen=null;recording=true;hiddenPause=document.hidden;q('.badge').hidden=false;status.textContent='Diagnostics on. Events remain on this device.';
    root.addEventListener('pointerdown',click,{passive:true});root.addEventListener('click',click,{passive:true});root.addEventListener('focusin',focus);document.addEventListener('keydown',key,true);
    window.addEventListener('resize',changed);window.addEventListener('scroll',changed,{passive:true});window.visualViewport?.addEventListener('resize',changed);window.visualViewport?.addEventListener('scroll',changed);
    document.addEventListener('visibilitychange',visibility);window.addEventListener('pagehide',pageExit);
    interval=setInterval(()=>schedule('interval'),2000);close();inspect('start');return true;
  }
  function stop(){if(recording)frozen=evidence.snapshot();recording=false;clearInterval(interval);clearTimeout(pending);pending=null;interval=null;q('.badge').hidden=true;
    root.removeEventListener('pointerdown',click);root.removeEventListener('click',click);root.removeEventListener('focusin',focus);document.removeEventListener('keydown',key,true);
    window.removeEventListener('resize',changed);window.removeEventListener('scroll',changed);window.visualViewport?.removeEventListener('resize',changed);window.visualViewport?.removeEventListener('scroll',changed);
    document.removeEventListener('visibilitychange',visibility);window.removeEventListener('pagehide',pageExit);status.textContent='Capture stopped. The bounded recent history remains local until you save or delete it.';
  }
  function make(){return makeReport({appId:options.appId,appVersion:options.appVersion,repository:options.repository,evidence:frozen||evidence.snapshot(),comment:q('#comment').value});}
  function close(){if(dialog.open)dialog.close();if(previousFocus?.isConnected&&!previousFocus.matches('input,textarea'))previousFocus.focus({preventScroll:true});}
  function open(){previousFocus=document.activeElement;if(!dialog.open)dialog.showModal();q('[data-do="start"]').disabled=recording;q('[data-do="stop"]').disabled=!recording;}
  function endPixels(){window.removeEventListener('pagehide',endPixels);if(mediaRecorder?.state==='recording')mediaRecorder.stop();mediaStream?.getTracks().forEach(t=>t.stop());clearTimeout(mediaTimer);q('[data-do="endpixels"]').hidden=true;q('[data-do="pixels"]').disabled=!supportsPixels;}
  async function recordPixels(){
    if(!supportsPixels)return;
    q('[data-do="pixels"]').disabled=true;
    try{
      window.addEventListener('pagehide',endPixels,{once:true});
      mediaStream=await navigator.mediaDevices.getDisplayMedia({video:{frameRate:15},audio:false});
      // Explicitly drop any unexpected audio tracks.
      mediaStream.getAudioTracks().forEach(t=>{t.stop();mediaStream.removeTrack(t);});
      mediaChunks=[];mediaBytes=0;mediaRecorder=new MediaRecorder(mediaStream);
      mediaRecorder.addEventListener('dataavailable',e=>{if(!e.data.size)return;mediaChunks.push(e.data);mediaBytes+=e.data.size;if(mediaBytes>=25_000_000)endPixels();});
      mediaRecorder.addEventListener('stop',()=>{const blob=new Blob(mediaChunks,{type:mediaRecorder.mimeType||'video/webm'});downloadBlob(blob,'diagnostics-real-screen.'+(blob.type.includes('mp4')?'mp4':'webm'));mediaChunks=[];status.textContent='Real screen video saved locally. Review its privacy before sharing it separately.';});
      mediaStream.getVideoTracks()[0]?.addEventListener('ended',endPixels,{once:true});mediaRecorder.start(1000);mediaTimer=setTimeout(endPixels,120000);q('[data-do="endpixels"]').hidden=false;status.textContent='Real screen recording is active. Use Stop video here or the browser recording indicator.';
    }catch{mediaStream?.getTracks().forEach(t=>t.stop());q('[data-do="pixels"]').disabled=!supportsPixels;status.textContent='Screen recording was cancelled or is unavailable. Local diagnostics still work.';}
  }
  box.addEventListener('click',async e=>{const b=e.target.closest('[data-do]');if(!b)return;const action=b.dataset.do;
    try{
      if(action==='close')close();
      else if(action==='start')start();
      else if(action==='stop')stop();
      else if(action==='report'){inspect('report');stop();open();}
      else if(action==='inspect'){close();await new Promise(requestAnimationFrame);inspect('inspect');open();const r=make();status.textContent=r.findings.length+' potential finding(s). Save to review the measurements.';}
      else if(action==='clear'){stop();endPixels();evidence.clear();frozen=null;lastReport=null;q('#review').hidden=true;q('#comment').value='';status.textContent='Unsaved captured history deleted. Saved reports can be deleted in the review page.';}
      else if(action==='export'){const r=lastReport||make();exportReport(r);}
      else if(action==='save'){
        b.disabled=true;if(!evidence.frames.length){close();await new Promise(requestAnimationFrame);inspect('save');open();}stop();lastReport=make();
        await saveReport(lastReport);const u=new URL(options.reviewUrl||'https://nirav2000.github.io/Apps/diagnostics/');u.searchParams.set('report',lastReport.id);
        q('#review').href=u.href;q('#review').hidden=false;status.textContent='Saved locally. Review opens separately so you do not lose the current question.';
      }else if(action==='pixels')await recordPixels();else if(action==='endpixels')endPixels();
    }catch(error){status.textContent=error.message||'Operation failed. Export your report before leaving.';}finally{b.disabled=false;q('[data-do="pixels"]').disabled=!supportsPixels||mediaRecorder?.state==='recording';}
  });
  dialog.addEventListener('cancel',()=>{}); // Native Escape closes the modal; no game action.
  const api={version:VERSION,open,start,stop,inspect,mark:schedule,report:make,export:()=>exportReport(lastReport||make()),get recording(){return recording;},get paused(){return hiddenPause;},
    destroy(){stop();endPixels();destroyed=true;host.remove();delete root.__appsDiagnostics;}};
  root.__appsDiagnostics=api;return api;
}
