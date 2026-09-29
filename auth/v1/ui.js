import { Auth } from './index.js';

const template=document.createElement('template');
template.innerHTML=`
<style>
:host{--auth-bg:#fff;--auth-fg:#172033;--auth-muted:#667085;--auth-border:#d0d5dd;--auth-accent:#2457d6;display:block;font:inherit;color:var(--auth-fg)}
*{box-sizing:border-box}.panel{background:var(--auth-bg);border:1px solid var(--auth-border);border-radius:16px;padding:18px;max-width:420px}.row{display:grid;gap:10px}.actions{display:flex;gap:8px;flex-wrap:wrap;margin-top:12px}input,button{font:inherit;border-radius:10px;padding:10px 12px}input{border:1px solid var(--auth-border);width:100%}button{border:0;background:var(--auth-accent);color:white;cursor:pointer}button.secondary{background:transparent;color:var(--auth-fg);border:1px solid var(--auth-border)}small,.muted{color:var(--auth-muted)}[hidden]{display:none!important}.error{color:#b42318}
</style>
<section class="panel" part="panel">
  <div data-signed-out>
    <slot name="title"><strong>Sign in</strong></slot>
    <div class="row" style="margin-top:12px">
      <input data-email type="email" autocomplete="email" placeholder="Email">
      <input data-password type="password" autocomplete="current-password" placeholder="Password">
    </div>
    <div class="actions">
      <button data-email-password>Sign in</button>
      <button data-email-link class="secondary">Email me a sign-in link</button>
      <button data-passkey class="secondary">Use passkey</button>
    </div>
  </div>
  <div data-signed-in hidden>
    <strong data-name>Signed in</strong>
    <div class="muted" data-detail></div>
    <div class="actions"><button data-signout class="secondary">Sign out</button></div>
  </div>
  <small data-status></small>
</section>`;

class AppsAuthPanel extends HTMLElement{
  connectedCallback(){
    if(this.shadowRoot)return;
    this.attachShadow({mode:'open'}).append(template.content.cloneNode(true));
    this.$=s=>this.shadowRoot.querySelector(s);
    this.$('[data-email-password]').onclick=()=>this.run(async()=>{
      const email=this.$('[data-email]').value.trim(),password=this.$('[data-password]').value;
      await Auth.signInEmail(email,password);
    });
    this.$('[data-email-link]').onclick=()=>this.run(async()=>{
      const email=this.$('[data-email]').value.trim();if(!email)throw new Error('Enter your email address.');
      await Auth.sendEmailLink(email);this.status('Sign-in link sent.');
    });
    this.$('[data-passkey]').onclick=()=>this.run(()=>Auth.signInWithPasskey());
    this.$('[data-signout]').onclick=()=>this.run(()=>Auth.logout());
    this.unsubscribe=Auth.onChange(()=>this.render());
    this.render();
  }
  disconnectedCallback(){this.unsubscribe?.()}
  status(text,error=false){const el=this.$('[data-status]');el.textContent=text||'';el.className=error?'error':''}
  async run(fn){this.status('Working…');try{await fn();this.status('')}catch(e){this.status(e?.message||String(e),true)}}
  render(){
    const snap=Auth.snapshot(),user=snap.user;
    this.$('[data-signed-out]').hidden=!!user;this.$('[data-signed-in]').hidden=!user;
    if(user){this.$('[data-name]').textContent=user.displayName||user.email||'Signed in';this.$('[data-detail]').textContent=user.email||user.provider||''}
    const methods=new Set((this.getAttribute('methods')||'passkey,emailLink,emailPassword').split(',').map(x=>x.trim()));
    this.$('[data-email-password]').hidden=!methods.has('emailPassword');
    this.$('[data-password]').hidden=!methods.has('emailPassword');
    this.$('[data-email-link]').hidden=!methods.has('emailLink');
    this.$('[data-passkey]').hidden=!methods.has('passkey');
  }
}
if(!customElements.get('apps-auth-panel'))customElements.define('apps-auth-panel',AppsAuthPanel);
export { AppsAuthPanel };
