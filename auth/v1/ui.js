import { Auth } from './index.js';

const CSS = [
':host{--auth-bg:#fff;--auth-fg:#182235;--auth-muted:#687386;--auth-border:#d8dee7;--auth-accent:#245edb;--auth-accent-2:#3478f6;--auth-soft:#f5f8fd;--auth-danger:#b42318;display:block;font-family:-apple-system,BlinkMacSystemFont,"SF Pro Text",Inter,system-ui,sans-serif;color:var(--auth-fg)}',
'*{box-sizing:border-box}button,input{font:inherit}.panel{width:min(100%,430px);margin:auto;background:var(--auth-bg);border:1px solid var(--auth-border);border-radius:24px;padding:24px;box-shadow:0 18px 55px rgba(28,42,70,.09)}',
'.head{margin-bottom:20px}h2{font-size:28px;line-height:1.08;margin:0 0 8px;letter-spacing:-.035em}.sub{margin:0;color:var(--auth-muted);font-size:14px;line-height:1.45}.center{text-align:center}.center .sub{max-width:310px;margin:auto}',
'.feature{width:62px;height:62px;border-radius:20px;margin:0 auto 18px;display:grid;place-items:center;background:linear-gradient(145deg,#eef4ff,#f8fbff);border:1px solid #dae5f5;color:var(--auth-accent);font-size:27px}',
'.stack{display:grid;gap:11px}.field{position:relative}.field .ico{position:absolute;left:14px;top:50%;transform:translateY(-50%);color:#718097;font-size:16px}.field input{width:100%;border:1px solid var(--auth-border);background:#fff;color:var(--auth-fg);border-radius:13px;padding:13px 14px 13px 42px;outline:none}.field input:focus{border-color:var(--auth-accent);box-shadow:0 0 0 3px rgba(36,94,219,.12)}',
'.primary,.secondary,.provider,.text-btn,.guest-card{cursor:pointer}.primary{width:100%;border:0;border-radius:13px;padding:13px 16px;background:linear-gradient(135deg,var(--auth-accent),var(--auth-accent-2));color:#fff;font-weight:750;box-shadow:0 8px 18px rgba(36,94,219,.18)}',
'.secondary{border:1px solid var(--auth-border);background:#fff;color:var(--auth-fg);border-radius:12px;padding:11px 13px;font-weight:650}.divider{display:flex;align-items:center;gap:12px;color:#8792a3;font-size:12px;margin:15px 0}.divider:before,.divider:after{content:"";height:1px;background:#e4e8ee;flex:1}',
'.providers{display:grid;grid-template-columns:repeat(3,1fr);gap:9px}.provider{border:1px solid var(--auth-border);background:#fff;border-radius:12px;padding:11px 8px;color:var(--auth-fg);font-weight:650;min-height:44px}.links{display:flex;justify-content:center;gap:8px 14px;flex-wrap:wrap;margin-top:14px}.text-btn{border:0;background:none;padding:2px;color:var(--auth-accent);font-size:12px}',
'.guest-card{width:100%;margin-top:15px;border:1px solid #e0e7f1;background:linear-gradient(135deg,#f5f8fe,#fbfdff);border-radius:14px;padding:12px 14px;display:flex;align-items:center;gap:11px;text-align:left;color:var(--auth-fg)}.guest-icon{width:35px;height:35px;border-radius:11px;background:#e7efff;color:var(--auth-accent);display:grid;place-items:center;flex:none}.guest-card b{display:block;font-size:13px}.guest-card small{display:block;color:var(--auth-muted);font-size:11px;margin-top:2px}',
'.status{display:block;min-height:18px;margin-top:10px;font-size:12px;color:var(--auth-muted)}.status.error{color:var(--auth-danger)}.mode-switch{display:flex;background:#f4f6f9;border-radius:12px;padding:3px;margin-bottom:16px}.mode-switch button{flex:1;border:0;background:transparent;border-radius:9px;padding:8px;color:var(--auth-muted);font-weight:650}.mode-switch button.active{background:#fff;color:var(--auth-fg);box-shadow:0 1px 4px rgba(20,35,60,.09)}',
'.alt-list{display:grid;gap:8px;margin-top:12px}.alt-list .secondary{width:100%}.magic-note{text-align:center;color:var(--auth-muted);font-size:11px;margin-top:10px}.benefits{display:grid;gap:8px;margin:18px 0 2px}.benefit{display:flex;gap:8px;color:var(--auth-muted);font-size:12px}.tick{color:#19a060;font-weight:900}.more{border-top:1px solid #edf0f4;margin-top:14px;padding-top:12px}.more summary{cursor:pointer;color:var(--auth-accent);font-size:12px;text-align:center;list-style:none}.more summary::-webkit-details-marker{display:none}',
'.compact.panel{padding:18px;border-radius:18px;max-width:390px}.compact h2{font-size:22px}.compact .head{margin-bottom:14px}.compact .providers{grid-template-columns:repeat(3,1fr)}',
'.identity{display:flex;gap:12px;align-items:center}.avatar{width:44px;height:44px;border-radius:50%;background:linear-gradient(135deg,#dfe9ff,#f2f6ff);display:grid;place-items:center;color:var(--auth-accent);font-weight:800}.identity small{display:block;color:var(--auth-muted);margin-top:3px}.signed-actions{display:flex;gap:8px;flex-wrap:wrap;margin-top:14px}',
'[hidden]{display:none!important}@media(max-width:480px){.panel{padding:20px;border-radius:20px}h2{font-size:25px}.providers{grid-template-columns:1fr}.compact .providers{grid-template-columns:repeat(3,1fr)}}'
].join('');

const esc=s=>String(s||'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
const fields=password=>'<div class="stack"><label class="field"><span class="ico">✉</span><input data-email type="email" autocomplete="email" placeholder="Email address" aria-label="Email address"></label>'+(password?'<label class="field"><span class="ico">⌑</span><input data-password type="password" autocomplete="current-password" placeholder="Password" aria-label="Password"></label>':'')+'</div>';
const head=(title,sub,center)=>'<div class="head'+(center?' center':'')+'"><h2>'+esc(title)+'</h2><p class="sub">'+esc(sub)+'</p></div>';

class AppsAuthPanel extends HTMLElement{
  static get observedAttributes(){return['variant','methods','heading','subheading']}
  constructor(){super();this.localMode='sign-in'}
  connectedCallback(){
    if(!this.shadowRoot)this.attachShadow({mode:'open'});
    this.unsubscribe=Auth.onChange(()=>this.render());
    this.render();
  }
  disconnectedCallback(){this.unsubscribe?.()}
  attributeChangedCallback(){if(this.shadowRoot)this.render()}
  get methods(){return new Set((this.getAttribute('methods')||'passkey,emailLink,emailPassword').split(',').map(x=>x.trim()).filter(Boolean))}
  get variant(){return this.getAttribute('variant')||'balanced'}
  has(name){return this.methods.has(name)}
  status(text,error){
    const el=this.shadowRoot.querySelector('[data-status]');
    if(el){el.textContent=text||'';el.className='status'+(error?' error':'')}
  }
  async run(fn,success){
    this.status('Working…');
    try{await fn();this.status(success||'')}catch(e){this.status(e?.message||String(e),true)}
  }
  providers(){
    const b=[];
    if(this.has('google'))b.push('<button class="provider" data-google>G&nbsp; Google</button>');
    if(this.has('apple'))b.push('<button class="provider" data-apple>●&nbsp; Apple</button>');
    if(this.has('passkey'))b.push('<button class="provider" data-passkey>⌘&nbsp; Passkey</button>');
    return b.length?'<div class="providers">'+b.join('')+'</div>':'';
  }
  bind(){
    const q=s=>this.shadowRoot.querySelector(s);
    const email=()=>q('[data-email]')?.value.trim()||'';
    const password=()=>q('[data-password]')?.value||'';
    q('[data-email-password]')?.addEventListener('click',()=>this.run(()=>Auth.signInEmail(email(),password())));
    q('[data-create-account]')?.addEventListener('click',()=>this.run(()=>Auth.createEmailAccount(email(),password())));
    q('[data-email-link]')?.addEventListener('click',()=>this.run(async()=>{if(!email())throw new Error('Enter your email address.');await Auth.sendEmailLink(email())},'Sign-in link sent.'));
    q('[data-forgot-password]')?.addEventListener('click',()=>this.run(async()=>{if(!email())throw new Error('Enter your email address first.');await Auth.resetPassword(email())},'Password reset email requested.'));
    q('[data-passkey]')?.addEventListener('click',()=>this.run(()=>Auth.signInWithPasskey()));
    q('[data-google]')?.addEventListener('click',()=>this.run(()=>Auth.signInGoogle()));
    q('[data-apple]')?.addEventListener('click',()=>this.run(()=>Auth.signInApple()));
    q('[data-anonymous]')?.addEventListener('click',()=>this.run(()=>Auth.signInAnonymous()));
    q('[data-create-mode]')?.addEventListener('click',()=>{this.localMode='create';this.render()});
    q('[data-signin-mode]')?.addEventListener('click',()=>{this.localMode='sign-in';this.render()});
    q('[data-email-mode]')?.addEventListener('click',()=>{this.localMode='email';this.render()});
    q('[data-back-mode]')?.addEventListener('click',()=>{this.localMode='sign-in';this.render()});
    q('[data-protect]')?.addEventListener('click',()=>{
      const e=q('[data-upgrade-email]')?.value.trim()||'',p=q('[data-upgrade-password]')?.value||'';
      this.run(()=>Auth.upgradeAnonymousWithEmailPassword(e,p));
    });
    q('[data-add-passkey]')?.addEventListener('click',()=>this.run(()=>Auth.registerPasskey('Passkey'),'Passkey added.'));
    q('[data-reset-password]')?.addEventListener('click',()=>this.run(async()=>{const e=Auth.getCurrentUser()?.email;if(!e)throw new Error('This account has no email address.');await Auth.resetPassword(e)},'Password reset email sent.'));
    q('[data-signout]')?.addEventListener('click',()=>this.run(()=>Auth.logout()));
  }
  signedIn(user){
    return '<section class="panel"><div class="identity"><div class="avatar">'+esc((user.displayName||user.email||'U').slice(0,1).toUpperCase())+'</div><div><b>'+esc(user.displayName||user.email||(user.isAnonymous?'Guest account':'Signed in'))+'</b><small>'+(user.isAnonymous?'Guest account · protect it to use on other devices':esc(user.email||user.provider||''))+'</small></div></div>'+
      (user.isAnonymous&&this.has('emailPassword')?'<div class="stack" style="margin-top:14px"><label class="field"><span class="ico">✉</span><input data-upgrade-email type="email" placeholder="Email address"></label><label class="field"><span class="ico">⌑</span><input data-upgrade-password type="password" placeholder="Create password"></label><button class="primary" data-protect>Protect guest account</button></div>':'')+
      '<div class="signed-actions">'+(!user.isAnonymous&&this.has('passkey')?'<button class="secondary" data-add-passkey>Add passkey</button>':'')+(user.email&&this.has('emailPassword')?'<button class="secondary" data-reset-password>Reset password</button>':'')+'<button class="secondary" data-signout>Sign out</button></div><small class="status" data-status></small></section>';
  }
  balanced(title,sub){
    const create=this.localMode==='create';
    return '<section class="panel">'+head(title,sub,false)+'<div class="mode-switch"><button class="'+(!create?'active':'')+'" data-signin-mode>Sign in</button><button class="'+(create?'active':'')+'" data-create-mode>Create account</button></div>'+fields(true)+'<button class="primary" style="margin-top:11px" '+(create?'data-create-account':'data-email-password')+'>'+(create?'Create account':'Continue')+' →</button>'+
      (this.providers()?'<div class="divider">or continue with</div>'+this.providers():'')+
      '<div class="links">'+(this.has('emailLink')?'<button class="text-btn" data-email-link>Email me a sign-in link</button>':'')+(this.has('emailPassword')?'<button class="text-btn" data-forgot-password>Forgot password?</button>':'')+'</div>'+
      (this.has('anonymous')?'<button class="guest-card" data-anonymous><span class="guest-icon">◎</span><span><b>Continue as guest</b><small>Explore now and protect your account later.</small></span></button>':'')+'<small class="status" data-status></small></section>';
  }
  passkeyFirst(title,sub){
    if(this.localMode==='email'){
      return '<section class="panel">'+head(title,sub,true)+fields(true)+'<button class="primary" style="margin-top:11px" data-email-password>Sign in →</button><div class="links"><button class="text-btn" data-back-mode>Back to passkey</button>'+(this.has('emailLink')?'<button class="text-btn" data-email-link>Email link</button>':'')+'</div><small class="status" data-status></small></section>';
    }
    return '<section class="panel"><div class="feature">⌘</div>'+head(title,sub,true)+(this.has('passkey')?'<button class="primary" data-passkey>Use passkey →</button>':'')+'<div class="divider">or</div>'+this.providers()+'<div class="links"><button class="text-btn" data-email-mode>Use email instead</button></div>'+(this.has('anonymous')?'<button class="guest-card" data-anonymous><span class="guest-icon">◎</span><span><b>Continue as guest</b><small>No account needed yet.</small></span></button>':'')+'<small class="status" data-status></small></section>';
  }
  magicLink(title,sub){
    return '<section class="panel">'+head(title,sub,true)+'<div class="feature">✉</div>'+fields(false)+'<button class="primary" style="margin-top:11px" data-email-link>Send secure sign-in link →</button><p class="magic-note">No password to remember. Open the link on this device to continue.</p><details class="more"><summary>Other ways to sign in</summary><div class="alt-list">'+(this.has('passkey')?'<button class="secondary" data-passkey>Use passkey</button>':'')+(this.has('google')?'<button class="secondary" data-google>Continue with Google</button>':'')+(this.has('apple')?'<button class="secondary" data-apple>Continue with Apple</button>':'')+'</div></details>'+(this.has('anonymous')?'<div class="links"><button class="text-btn" data-anonymous>Continue as guest</button></div>':'')+'<small class="status" data-status></small></section>';
  }
  guestFirst(title,sub){
    return '<section class="panel">'+head(title,sub,true)+'<div class="feature">◎</div>'+(this.has('anonymous')?'<button class="primary" data-anonymous>Start now as guest →</button>':'')+'<div class="benefits"><div class="benefit"><span class="tick">✓</span><span>No sign-up required to start</span></div><div class="benefit"><span class="tick">✓</span><span>Your progress stays on this device</span></div><div class="benefit"><span class="tick">✓</span><span>Protect the account later without losing progress</span></div></div><div class="divider">already have an account?</div><div class="alt-list">'+(this.has('passkey')?'<button class="secondary" data-passkey>Use passkey</button>':'')+'<button class="secondary" data-email-mode>Email sign in</button></div>'+(this.localMode==='email'?'<div style="margin-top:12px">'+fields(true)+'<button class="primary" style="margin-top:10px" data-email-password>Sign in</button></div>':'')+'<small class="status" data-status></small></section>';
  }
  compact(title,sub){
    return '<section class="panel compact">'+head(title,sub,false)+fields(true)+'<button class="primary" style="margin-top:10px" data-email-password>Sign in →</button><div class="divider">or</div>'+this.providers()+'<details class="more"><summary>More options</summary><div class="links">'+(this.has('emailLink')?'<button class="text-btn" data-email-link>Email link</button>':'')+(this.has('emailPassword')?'<button class="text-btn" data-forgot-password>Forgot password</button>':'')+(this.has('anonymous')?'<button class="text-btn" data-anonymous>Continue as guest</button>':'')+'<button class="text-btn" data-create-mode>Create account</button></div>'+(this.localMode==='create'?'<div style="margin-top:10px">'+fields(true)+'<button class="primary" style="margin-top:10px" data-create-account>Create account</button></div>':'')+'</details><small class="status" data-status></small></section>';
  }
  render(){
    const snap=Auth.snapshot(),user=snap.user,v=this.variant;
    const title=this.getAttribute('heading')||(v==='guest-first'?'Start exploring':v==='magic-link'?'Sign in with a link':v==='passkey-first'?'Welcome back':v==='compact'?'Sign in':'Shared account');
    const sub=this.getAttribute('subheading')||(v==='guest-first'?'Try the app first. Create an account only when you need one.':v==='magic-link'?'We will email you a secure link. No password required.':v==='passkey-first'?'Use Face ID, Touch ID or your device passkey for the quickest route in.':v==='compact'?'Pick up where you left off.':'Save your progress and access it from any device.');
    const body=user?this.signedIn(user):v==='passkey-first'?this.passkeyFirst(title,sub):v==='magic-link'?this.magicLink(title,sub):v==='guest-first'?this.guestFirst(title,sub):v==='compact'?this.compact(title,sub):this.balanced(title,sub);
    this.shadowRoot.innerHTML='<style>'+CSS+'</style>'+body;
    this.bind();
  }
}
if(!customElements.get('apps-auth-panel'))customElements.define('apps-auth-panel',AppsAuthPanel);
export { AppsAuthPanel };
