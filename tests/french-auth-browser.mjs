import {chromium} from 'playwright';
import assert from 'node:assert/strict';
const browser=await chromium.launch({headless:true});
try{
  const page=await browser.newPage({viewport:{width:390,height:844}});
  const errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.goto('http://127.0.0.1:8898/tests/french-auth-harness.html');
  await page.getByRole('button',{name:'Continue with Google'}).waitFor();
  assert.match(await page.locator('.ft-signin').innerText(),/existing kk-syllabus parent Firebase account/);
  await page.getByRole('button',{name:'Continue with Google'}).click();
  await page.locator('.ft-tabs').waitFor();
  assert.equal(await page.evaluate(()=>window.__testAuth.calls.google),1);
  assert.match(await page.locator('.ft-identity').innerText(),/parent@example.test/);
  await page.getByRole('button',{name:'Link Google to this account'}).click();
  await page.locator('.ft-identity').getByText('Google sign-in linked to this Firebase account.').waitFor();
  assert.equal(await page.evaluate(()=>window.__testAuth.calls.link),1);
  assert.equal(await page.evaluate(()=>window.__testAuth.auth.currentUser.uid),'test-owner');
  assert.equal(await page.getByRole('button',{name:'Link Google to this account'}).count(),0);
  assert.deepEqual(errors,[]);
  await page.close();

  const wrong=await browser.newPage({viewport:{width:390,height:844}});
  wrong.on('pageerror',e=>errors.push(e.message));
  await wrong.goto('http://127.0.0.1:8898/tests/french-auth-harness.html?wrong');
  await wrong.getByRole('button',{name:'Continue with Google'}).click();
  await wrong.locator('[data-cloud-status]').filter({hasText:'Google account is not linked'}).waitFor();
  assert.equal(await wrong.locator('.ft-tabs').count(),0);
  assert.equal(await wrong.evaluate(()=>window.__testAuth.auth.currentUser),null);
  assert.deepEqual(errors,[]);
  console.log('French auth smoke passed: Google entry, link existing UID, wrong identity fail closed');
}finally{await browser.close();}
