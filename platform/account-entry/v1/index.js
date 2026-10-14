// Shared Apps Platform Account Entry v1.0.0. No automatic installation in consumer apps.
// Import Auth separately and initialise it before calling mountAccountEntry.
const STYLE = `
.apps-account-entry{display:inline-flex;align-items:center;justify-content:center;gap:7px;min-width:44px;min-height:44px;border:1px solid #485061;border-radius:999px;background:#212838;color:#fff;padding:6px 12px;font:inherit;cursor:pointer}
.apps-account-entry:focus-visible,.apps-account-close:focus-visible{outline:3px solid #8cb7ff;outline-offset:3px}
.apps-account-entry .apps-account-avatar{display:grid;place-items:center;width:27px;height:27px;border-radius:50%;background:#53678d;font-size:13px;font-weight:800}
.apps-account-entry .apps-account-dot{height:7px;width:7px;border-radius:50%;background:#e1b95f}
.apps-account-entry.is-signed-in .apps-account-dot{background:#6de2ab}
.apps-account-dialog{border:1px solid #485061;border-radius:23px;padding:0;background:#111723;color:#f7f9ff;max-width:min(470px,calc(100vw - 24px));width:100%;max-height:calc(100dvh - 24px);overflow:auto;box-shadow:0 28px 80px #0009}
.apps-account-dialog::backdrop{background:#000b;backdrop-filter:blur(3px)}
.apps-account-dialog-head{display:flex;align-items:center;justify-content:space-between;padding:16px 18px 0;gap:12px}
.apps-account-dialog-head strong{font-size:16px}
.apps-account-close{width:44px;height:44px;background:#253044;color:white;border:0;border-radius:50%;font-size:23px;cursor:pointer}
.apps-account-dialog-body{padding:12px 12px 20px}
.apps-account-dialog-body apps-auth-panel{display:block;width:100%;--auth-bg:#121a29}
@media(max-width:600px){.apps-account-dialog{margin:auto auto 0;max-width:100%;width:100%;border-radius:22px 22px 0 0;max-height:92dvh}.apps-account-entry .apps-account-label{display:none}.apps-account-entry{padding:5px;min-width:44px}}
@media(prefers-reduced-motion:reduce){.apps-account-dialog::backdrop{backdrop-filter:none}}
`;
function installStyle(doc){if(doc.getElementById('apps-account-entry-style'))return;const el=doc.createElement('style');el.id='apps-account-entry-style';el.textContent=STYLE;doc.head.append(el)}
function initials(user){return (user?.displayName||user?.email||'G').trim().charAt(0).toUpperCase()}
export function mountAccountEntry({Auth,appId,slot,settingsTrigger,variant='balanced',theme='midnight',methods='emailPassword,google',heading='Your account',subheading='Save and access your progress across devices.'}={}){
  if(!Auth||!appId||!slot)throw new Error('Account Entry requires Auth, appId and a header slot.');
  const doc=slot.ownerDocument;installStyle(doc);
  const button=doc.createElement('button');button.type='button';button.className='apps-account-entry';button.setAttribute('aria-label','Open account');button.setAttribute('title','Your account');
  button.innerHTML='<span class="apps-account-avatar" aria-hidden="true">G</span><span class="apps-account-label">Guest</span><span class="apps-account-dot" aria-hidden="true"></span>';
  slot.append(button);
  const dialog=doc.createElement('dialog');dialog.className='apps-account-dialog';dialog.setAttribute('aria-label','Account');
  dialog.innerHTML='<div class="apps-account-dialog-head"><strong>Account</strong><button class="apps-account-close" type="button" aria-label="Close account dialog">×</button></div><div class="apps-account-dialog-body"></div>';
  const panel=doc.createElement('apps-auth-panel');panel.setAttribute('variant',variant);panel.setAttribute('theme',theme);panel.setAttribute('methods',methods);panel.setAttribute('heading',heading);panel.setAttribute('subheading',subheading);dialog.querySelector('.apps-account-dialog-body').append(panel);
  doc.body.append(dialog);
  const close=()=>dialog.close();
  const open=()=>{if(!dialog.open)dialog.showModal()};
  button.addEventListener('click',open);
  settingsTrigger?.addEventListener('click',open);
  dialog.querySelector('.apps-account-close').addEventListener('click',close);
  dialog.addEventListener('click',event=>{if(event.target===dialog)close()});
  const render=()=>{const user=Auth.snapshot().user;button.classList.toggle('is-signed-in',!!user);button.querySelector('.apps-account-avatar').textContent=initials(user);button.querySelector('.apps-account-label').textContent=user?(user.displayName||user.email||'Account'):'Guest';button.title=user?(user.email||'Manage account'):'Sign in to sync progress';button.setAttribute('aria-label',button.title);if(settingsTrigger)settingsTrigger.textContent=user?'Manage account':'Sign in or create account'};
  const unsubscribe=Auth.onChange(render);render();
  return {open,close,dialog,button,destroy(){unsubscribe?.();button.remove();dialog.remove()}};
}
export const AccountEntry={mount:mountAccountEntry,version:'1.0.0'};
