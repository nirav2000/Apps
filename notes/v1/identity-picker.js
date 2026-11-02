// Shared Notes account selector, usable by any app with authenticated transports.
// The caller supplies sign-in functions. No tokens, passwords or app-specific data
// are saved here; authorisation always belongs to the chosen transport/server.
const css=`
.apps-notes-identity{box-sizing:border-box;width:min(520px,calc(100vw - 24px));max-height:min(90dvh,780px);overflow:auto;border:1px solid #d5e1eb;border-radius:24px;background:#fff;color:#142f46;padding:24px;box-shadow:0 28px 95px #071e3440;font:14px -apple-system,BlinkMacSystemFont,"SF Pro Text",sans-serif}
.apps-notes-identity::backdrop{background:#07192b80;backdrop-filter:blur(5px)}
.apps-notes-identity h2{margin:3px 0 0;font-size:clamp(22px,3vw,27px);line-height:1.18;letter-spacing:-.025em}
.apps-notes-identity p{line-height:1.5}
.apps-notes-identity .ni-heading{display:flex;align-items:center;gap:13px}
.apps-notes-identity .ni-icon{display:grid;place-items:center;background:#e6f4fa;color:#136485;border-radius:15px;width:50px;height:50px;font-size:26px;flex:none}
.apps-notes-identity .ni-eyebrow{color:#4d7c90;font-size:10px;letter-spacing:.12em;font-weight:800;margin:0}
.apps-notes-identity .ni-caption{color:#556f82}
.apps-notes-identity .ni-status{background:#f3f8f7;border:1px solid #d9e7e5;border-radius:14px;padding:12px 14px;display:flex;gap:11px;align-items:flex-start}
.apps-notes-identity .ni-dot{width:10px;height:10px;border-radius:50%;background:#d6a337;margin-top:5px;flex:none}
.apps-notes-identity .ni-status[data-state=synced] .ni-dot{background:#16966f}
.apps-notes-identity .ni-status[data-state=error] .ni-dot{background:#c34a4a}
.apps-notes-identity .ni-status p{font-size:12px;color:#4d6677;margin:4px 0 0;overflow-wrap:anywhere}
.apps-notes-identity .ni-options{display:grid;gap:9px;margin-top:16px}
.apps-notes-identity .ni-choice{display:flex;align-items:center;gap:13px;text-align:left;border:1px solid #d9e4ee;border-radius:14px;background:#fff;width:100%;padding:12px;min-height:65px;color:#173246;cursor:pointer}
.apps-notes-identity .ni-choice:active{background:#eaf3f9}
.apps-notes-identity .ni-choice-icon{flex:none;width:36px;height:36px;background:#eaf2f8;border-radius:11px;color:#246083;font-size:20px;display:grid;place-items:center}
.apps-notes-identity .ni-choice-copy{flex:1;display:grid;gap:3px}
.apps-notes-identity .ni-choice small{font-size:12px;color:#617587;line-height:1.3}
.apps-notes-identity .ni-choice strong{font-size:14px}
.apps-notes-identity .ni-error{min-height:1em;color:#a32d2d;font-size:13px;margin:10px 0;overflow-wrap:anywhere}
.apps-notes-identity .ni-actions{display:flex;justify-content:space-between;gap:10px;align-items:center}
.apps-notes-identity .ni-actions button{border:0;background:transparent;color:#46647c;padding:12px 8px;cursor:pointer;font-weight:600}
.apps-notes-identity .ni-actions .ni-done{background:#153e5b;color:#fff;border-radius:12px;padding:11px 22px}
.apps-notes-identity button:focus-visible,.apps-notes-identity input:focus-visible{outline:3px solid #56a6d7;outline-offset:2px}
.apps-notes-identity input{box-sizing:border-box;width:100%;border:1px solid #b9cbd7;border-radius:10px;padding:12px;font:inherit;margin-top:5px}
.apps-notes-identity label{display:block;margin:8px 0;font-weight:600}
.apps-notes-identity [hidden]{display:none!important}
.apps-notes-identity [aria-busy=true]{opacity:.75}
.apps-notes-identity .ni-version{font-size:11px;display:block;text-align:center;color:#6b8291;margin-top:10px}
@media(max-width:460px){.apps-notes-identity{padding:17px;border-radius:19px}}
`;
function ensureStyle(){
 if(document.getElementById('apps-notes-identity-style'))return;
 const style=document.createElement('style');style.id='apps-notes-identity-style';style.textContent=css;document.head.append(style);
}
export function showNotesIdentityPicker({title='Keep your notes in sync',mode='local',error='',onFirebase,onPasskey,onEmail,onLocal,versionInfo=''}={}){
 ensureStyle();
 const dialog=document.createElement('dialog');dialog.className='apps-notes-identity';
 const status=error?'error':mode==='local'?'local':'synced';
 const label=mode==='firebase'?'Connected with Firebase':mode==='app-monitor'?'Connected with App Monitor passkey':'Notes saved on this device';
 dialog.innerHTML=`<div class="ni-heading"><span class="ni-icon" aria-hidden="true">☁</span><div><p class="ni-eyebrow">PRIVATE LEARNING NOTES</p><h2></h2></div></div><p class="ni-caption">Use the same notes on your iPad, iPhone and other devices. Local notes are preserved.</p><div class="ni-status" data-state="${status}"><span class="ni-dot"></span><div><strong data-identity></strong><p data-details></p></div></div><div class="ni-options"><button type="button" class="ni-choice" data-action="firebase"><span class="ni-choice-icon">✓</span><span class="ni-choice-copy"><strong>Existing Firebase account</strong><small>Reuse the parent session in this browser</small></span><span aria-hidden="true">›</span></button><button type="button" class="ni-choice" data-action="passkey"><span class="ni-choice-icon">⌁</span><span class="ni-choice-copy"><strong>App Monitor passkey</strong><small>Secure account without another password</small></span><span aria-hidden="true">›</span></button><button type="button" class="ni-choice" data-action="email"><span class="ni-choice-icon">@</span><span class="ni-choice-copy"><strong>Firebase email and password</strong><small>Alternative account sign-in</small></span><span aria-hidden="true">›</span></button></div><form data-email-form hidden><label>Email<input name="email" type="email" autocomplete="username" required></label><label>Password<input name="password" type="password" autocomplete="current-password" required></label><button type="submit" class="ni-choice">Sign in and sync</button></form><p class="ni-error" role="status" aria-live="polite" data-message></p><div class="ni-actions"><button type="button" data-action="local">Keep notes on this device</button><button class="ni-done" type="button" data-action="close">Done</button></div>`;
 dialog.querySelector('h2').textContent=title;
 dialog.querySelector('.ni-version').textContent=versionInfo;
 dialog.querySelector('[data-identity]').textContent=label;
 dialog.querySelector('[data-details]').textContent=error|| (mode==='local'?'Select a sign-in method to enable cross-device sync.':'Account recognised. Note storage is checked separately.');
 const message=dialog.querySelector('[data-message]');
 let busy=false;
 const setMessage=(text,isError=true)=>{message.textContent=text||'';message.style.color=isError?'#a32d2d':'#217759'};
 async function run(action,callback){
  if(busy||typeof callback!=='function')return;
  busy=true;dialog.setAttribute('aria-busy','true');setMessage('Checking account…',false);
  try{await callback();if(action!=='email')dialog.close();else dialog.close();}
  catch(e){setMessage(String(e?.message||e));}
  finally{busy=false;dialog.removeAttribute('aria-busy');}
 }
 dialog.addEventListener('click',e=>{
  const action=e.target.closest('button[data-action]')?.dataset.action;
  if(!action)return;
  if(action==='close'){dialog.close();return;}
  if(action==='email'){dialog.querySelector('[data-email-form]').hidden=false;dialog.querySelector('[name=email]').focus();return;}
  if(action==='firebase')void run(action,onFirebase);
  if(action==='passkey')void run(action,onPasskey);
  if(action==='local')void run(action,onLocal);
 });
 dialog.querySelector('[data-email-form]').addEventListener('submit',e=>{
  e.preventDefault();
  const form=e.currentTarget,email=form.elements.namedItem('email').value.trim();
  const password=form.elements.namedItem('password').value;
  void run('email',()=>onEmail(email,password));
 });
 dialog.addEventListener('close',()=>dialog.remove(),{once:true});
 document.body.append(dialog);dialog.showModal();
 return dialog;
}
