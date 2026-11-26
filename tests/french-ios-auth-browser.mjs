import {chromium} from 'playwright';
import assert from 'node:assert/strict';

const iphoneUA='Mozilla/5.0 (iPhone; CPU iPhone OS 26_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Mobile/15E148 Safari/604.1';
const base='http://127.0.0.1:8898/tests/french-auth-harness.html';
const browser=await chromium.launch({headless:true});
try{
  // An installed iPhone PWA must never start a Google popup.
  const context=await browser.newContext({viewport:{width:390,height:844},userAgent:iphoneUA});
  await context.addInitScript(()=>{
    Object.defineProperty(navigator,'standalone',{configurable:true,get:()=>true});
  });
  const pwa=await context.newPage(),errors=[];
  pwa.on('pageerror',error=>errors.push(error.message));
  await pwa.goto(base);
  await pwa.locator('.ft-ios-login-note').waitFor();
  assert.equal(await pwa.getByRole('button',{name:'Continue with Google'}).count(),0);
  assert.equal(await pwa.locator('.ft-password-option').evaluate(el=>el.open),true);
  assert.equal(await pwa.locator('#ft-login input[name="email"]').isVisible(),true);
  assert.match(await pwa.locator('.ft-ios-login-note').innerText(),/Google popup can become unresponsive/);
  assert.equal(await pwa.evaluate(()=>window.__testAuth.calls.google),0);
  await pwa.getByRole('button',{name:'Copy link for Safari'}).click();
  await pwa.locator('[data-cloud-status]').filter({hasText:/Safari|Course link copied/}).waitFor();

  // Real user action can request a password-reset email without invoking Google.
  await pwa.locator('#ft-login input[name="email"]').fill('parent@example.test');
  await pwa.getByRole('button',{name:'Forgot Firebase password?'}).click();
  assert.equal(await pwa.evaluate(()=>window.__testAuth.calls.reset),1);
  assert.equal(await pwa.evaluate(()=>window.__testAuth.resetEmail),'parent@example.test');
  assert.match(await pwa.locator('[data-reset-status]').innerText(),/check its inbox/i);
  assert.equal(await pwa.evaluate(()=>window.__testAuth.calls.google),0);

  // Parent email/password path still signs in and preserves existing owner UID.
  await pwa.locator('#ft-login input[name="password"]').fill('test-only-not-a-real-password');
  await pwa.getByRole('button',{name:'Sign in & sync'}).click();
  await pwa.locator('.ft-tabs').waitFor();
  assert.equal(await pwa.evaluate(()=>window.__testAuth.calls.email),1);
  assert.equal(await pwa.evaluate(()=>window.__testAuth.auth.currentUser.uid),'test-owner');
  assert.equal(await pwa.getByRole('button',{name:'Link Google to this account'}).count(),0);
  await pwa.locator('[data-page="settings"]').click();
  assert.match(await pwa.locator('.ft-identity').innerText(),/linking is available when you open the course in Safari/i);
  assert.deepEqual(errors,[]);
  await context.close();

  // Safari (same Apple UA but not installed) still offers the existing Google button.
  const safari=await browser.newContext({viewport:{width:390,height:844},userAgent:iphoneUA});
  const page=await safari.newPage();
  await page.goto(base);
  await page.getByRole('button',{name:'Continue with Google'}).waitFor();
  assert.equal(await page.locator('.ft-ios-login-note').count(),0);
  assert.equal(await page.locator('.ft-password-option').evaluate(el=>el.open),false);
  await safari.close();
  console.log('French iOS PWA regression: Google popup blocked, local password/reset works, owner unchanged, Safari preserved.');
}finally{
  await browser.close();
}
