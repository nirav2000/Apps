const USER_KEY='auth-lab.mock.user';
const LINK_KEY='auth-lab.mock.linked-app-uid';
const PASSKEY_KEY='auth-lab.mock.passkeys';
const AUDIT_KEY='auth-lab.mock.audit';

const clean=(v,n=180)=>String(v??'').trim().slice(0,n);
const uidFor=email=>'mock-'+clean(email,80).toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,60);
const loadJSON=(k,fallback)=>{try{return JSON.parse(sessionStorage.getItem(k)||'null')??fallback}catch{return fallback}};
const saveJSON=(k,v)=>sessionStorage.setItem(k,JSON.stringify(v));
const now=()=>new Date().toISOString();

export function createMockIdentityProvider(){
  let user=loadJSON(USER_KEY,null);
  const listeners=new Set();
  const notify=()=>{
    saveJSON(USER_KEY,user);
    for(const fn of listeners){try{fn(user)}catch{}}
    return user;
  };
  const ensureEmail=(email,password)=>{
    email=clean(email,160);
    if(!email.includes('@'))throw new Error('Enter a valid email address.');
    if(String(password||'').length<8)throw new Error('Use at least 8 characters for the lab password.');
    return email;
  };
  const setUser=u=>{user=u;return notify()};
  return {
    kind:'mock',
    async init(){return{user}},
    onChange(fn){listeners.add(fn);return()=>listeners.delete(fn)},
    currentUser:()=>user,
    async getIdToken(){if(!user)return'';return'mock-token:'+user.uid},
    async signInAnonymous(){
      if(user)return user;
      return setUser({uid:'mock-anon-'+crypto.randomUUID().slice(0,8),displayName:'Guest user',email:'',isAnonymous:true,providerData:[]});
    },
    async upgradeAnonymousWithEmailPassword(email,password){
      email=ensureEmail(email,password);
      if(!user?.isAnonymous)throw new Error('Current mock user is not anonymous.');
      return setUser({...user,email,displayName:email,isAnonymous:false,providerData:[{providerId:'password'}]});
    },
    async signInEmail(email,password){
      email=ensureEmail(email,password);
      return setUser({uid:uidFor(email),displayName:email,email,isAnonymous:false,providerData:[{providerId:'password'}]});
    },
    async createEmailAccount(email,password){return this.signInEmail(email,password)},
    async resetPassword(email){
      email=clean(email,160);if(!email.includes('@'))throw new Error('Enter a valid email address.');
      audit('password-reset-request',{email});return{ok:true,email};
    },
    async sendEmailLink(email){
      email=clean(email,160);if(!email.includes('@'))throw new Error('Enter a valid email address.');
      audit('email-link-request',{email});return{ok:true,email};
    },
    async completeEmailLink(url,email){
      email=clean(email||'lab@example.test',160);
      return setUser({uid:uidFor(email),displayName:email,email,isAnonymous:false,providerData:[{providerId:'emailLink'}]});
    },
    async signInProvider(name){
      const email=name+'-user@example.test';
      return setUser({uid:'mock-'+name+'-user',displayName:'Mock '+name+' user',email,isAnonymous:false,providerData:[{providerId:name}]});
    },
    async linkProvider(name){
      if(!user)throw new Error('Sign in first.');
      const providers=[...(user.providerData||[]).filter(x=>x.providerId!==name),{providerId:name}];
      return setUser({...user,providerData:providers});
    },
    async logout(){user=null;sessionStorage.removeItem(USER_KEY);return notify()},
    _setUser:setUser
  };
}

function audit(action,meta={}){
  const rows=loadJSON(AUDIT_KEY,[]);
  rows.unshift({id:crypto.randomUUID(),action,createdAt:now(),meta});
  saveJSON(AUDIT_KEY,rows.slice(0,50));
}

export function createMockServiceAdapter(identityProvider){
  let linkedAppUserId=sessionStorage.getItem(LINK_KEY)||'';
  let sessionId=sessionStorage.getItem('auth-lab.mock.session')||'';
  if(!sessionId){sessionId='mock-auth-session-'+crypto.randomUUID().slice(0,8);sessionStorage.setItem('auth-lab.mock.session',sessionId)}
  const sessions=()=>[
    {id:sessionId,current:true,label:'This Auth Lab tab',createdAt:now(),lastSeenAt:now(),expiresAt:new Date(Date.now()+7*86400000).toISOString()},
    {id:'mock-auth-session-old',current:false,label:'Example older device',createdAt:new Date(Date.now()-3*86400000).toISOString(),lastSeenAt:new Date(Date.now()-86400000).toISOString(),expiresAt:new Date(Date.now()+4*86400000).toISOString()}
  ].filter(s=>sessionStorage.getItem('auth-lab.mock.revoked.'+s.id)!=='1');
  return {
    kind:'mock',
    async getMe({appId,user}){
      if(!user)return{user:null,membership:null,permissions:{globalRoles:[],appRoles:[]},session:null};
      return{
        user:{globalUserId:'usr-'+user.uid,displayName:user.displayName||user.email||'Mock user',email:user.email||'',isAnonymous:!!user.isAnonymous,provider:user.providerData?.[0]?.providerId||(user.isAnonymous?'anonymous':'mock')},
        membership:{appId,appUserId:linkedAppUserId,roles:['tester'],status:'active'},
        permissions:{globalRoles:user.email==='owner@example.test'?['owner']:[],appRoles:['tester']},
        session:sessions().find(x=>x.current)||null
      };
    },
    async listSessions(){return sessions()},
    async revokeSession(id){
      sessionStorage.setItem('auth-lab.mock.revoked.'+id,'1');audit('session-revoked',{id});return{ok:true,id};
    },
    async disableCurrentAccount(){audit('account-disabled');return{ok:true,status:'disabled'}},
    async linkLegacyIdentity({appUser}){
      const uid=clean(appUser?.appUserId||appUser?.authSubjectId,180);
      if(!uid)throw new Error('No legacy UID to link.');
      if(linkedAppUserId&&linkedAppUserId!==uid)throw new Error('Mock membership is already linked to a different app UID.');
      linkedAppUserId=uid;sessionStorage.setItem(LINK_KEY,uid);audit('legacy-linked',{appUserId:uid});return{ok:true,appUserId:uid};
    },
    async registerPasskey(label='Passkey'){
      const rows=loadJSON(PASSKEY_KEY,[]),p={id:'mock-passkey-'+crypto.randomUUID().slice(0,8),label:clean(label,80)||'Passkey',createdAt:now()};
      rows.push(p);saveJSON(PASSKEY_KEY,rows);audit('passkey-registered',{id:p.id,label:p.label});return{ok:true,passkey:p};
    },
    async signInWithPasskey(){
      const rows=loadJSON(PASSKEY_KEY,[]);
      if(!rows.length)throw new Error('Register a mock passkey first.');
      const user={uid:'mock-passkey-user',displayName:'Passkey user',email:'passkey@example.test',isAnonymous:false,providerData:[{providerId:'passkey'}]};
      identityProvider._setUser(user);audit('passkey-sign-in',{id:rows[0].id});return{ok:true,user};
    },
    async getAuditHistory(){return loadJSON(AUDIT_KEY,[])},
    async request(path){throw new Error('Mock service does not implement raw request '+path)}
  };
}

export function resetMockAuthLab(){
  for(const key of Object.keys(sessionStorage)){
    if(key.startsWith('auth-lab.mock.'))sessionStorage.removeItem(key);
  }
}
