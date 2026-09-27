(function(){
'use strict';
if(window.AppsAccount)return;
const VERSION=1;
const listeners=new Set();
let adapter=null;
const clean=(v,n=180)=>String(v??'').trim().slice(0,n);
const snapshot=()=>({
  version:VERSION,
  configured:!!adapter,
  user:adapter?.auth?.currentUser?{
    uid:adapter.auth.currentUser.uid,
    email:adapter.auth.currentUser.email||'',
    emailVerified:!!adapter.auth.currentUser.emailVerified,
    isAnonymous:!!adapter.auth.currentUser.isAnonymous,
    provider:adapter.auth.currentUser.providerData?.[0]?.providerId||(adapter.auth.currentUser.isAnonymous?'anonymous':'firebase')
  }:null
});
function emit(){const detail=snapshot();try{window.dispatchEvent(new CustomEvent('apps-account:change',{detail}))}catch{}for(const fn of listeners){try{fn(detail)}catch{}}}
function requireAdapter(){if(!adapter)throw new Error('AppsAccount is not bound to this app Firebase Authentication instance.');return adapter}
function bindFirebase({auth,authMod,app='App'}={}){
  if(!auth||!authMod)throw new Error('auth and authMod are required');
  adapter={auth,authMod,app:clean(app,80)};
  authMod.onAuthStateChanged(auth,user=>{window.AppsAuth?.setAppIdentity?.(user,{app:adapter.app});emit()});
  window.AppsAuth?.setAppIdentity?.(auth.currentUser,{app:adapter.app});emit();
  return api;
}
async function ensureAnonymous(){const A=requireAdapter();if(!A.auth.currentUser)return A.authMod.signInAnonymously(A.auth);return A.auth.currentUser}
async function protectOrCreate(email,password){
  const A=requireAdapter(),e=clean(email,160);
  if(!e||String(password||'').length<8)throw new Error('Use a valid email and a password of at least 8 characters.');
  if(A.auth.currentUser?.isAnonymous){
    const c=A.authMod.EmailAuthProvider.credential(e,password);
    return A.authMod.linkWithCredential(A.auth.currentUser,c);
  }
  if(!A.auth.currentUser)return A.authMod.createUserWithEmailAndPassword(A.auth,e,password);
  throw new Error('This account is already protected.');
}
async function signIn(email,password){const A=requireAdapter();return A.authMod.signInWithEmailAndPassword(A.auth,clean(email,160),String(password||''))}
async function signOut(){const A=requireAdapter();return A.authMod.signOut(A.auth)}
async function resetPassword(email){const A=requireAdapter();return A.authMod.sendPasswordResetEmail(A.auth,clean(email,160))}
async function sendVerification(){const A=requireAdapter();if(!A.auth.currentUser||A.auth.currentUser.isAnonymous)throw new Error('Protect the account first.');return A.authMod.sendEmailVerification(A.auth.currentUser)}
async function reload(){const A=requireAdapter();if(A.auth.currentUser)await A.authMod.reload(A.auth.currentUser);emit();return snapshot()}
async function updatePassword(currentPassword,newPassword){
  const A=requireAdapter(),u=A.auth.currentUser;if(!u?.email)throw new Error('A protected email account is required.');
  if(String(newPassword||'').length<8)throw new Error('Use a password of at least 8 characters.');
  const c=A.authMod.EmailAuthProvider.credential(u.email,currentPassword);await A.authMod.reauthenticateWithCredential(u,c);await A.authMod.updatePassword(u,newPassword);return reload();
}
async function deleteCurrentUser(){const A=requireAdapter();if(!A.auth.currentUser)throw new Error('No signed-in account.');return A.authMod.deleteUser(A.auth.currentUser)}
const api={version:VERSION,bindFirebase,snapshot,ensureAnonymous,protectOrCreate,signIn,signOut,resetPassword,sendVerification,reload,updatePassword,deleteCurrentUser,onChange(fn){listeners.add(fn);fn(snapshot());return()=>listeners.delete(fn)}};
window.AppsAccount=api;
})();