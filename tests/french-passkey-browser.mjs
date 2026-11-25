import {chromium} from 'playwright';
import assert from 'node:assert/strict';
const browser=await chromium.launch({headless:true});
const base='http://127.0.0.1:8898/tests/french-auth-harness.html?passkey';
try{
  const page=await browser.newPage({viewport:{width:390,height:844}});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(base);
  await page.getByRole('button',{name:'Continue with App Monitor passkey'}).waitFor();
  await page.getByRole('button',{name:'Continue with App Monitor passkey'}).click();
  await page.locator('.ft-tabs').waitFor();
  assert.equal(await page.evaluate(()=>window.__testAuth.calls.passkey),1);
  assert.equal(await page.evaluate(()=>window.__testAuth.calls.google),0);
  assert.equal(await page.evaluate(()=>window.__testAuth.calls.email),0);
  assert.equal(await page.evaluate(()=>window.__testAuth.auth.currentUser.uid),'test-owner');
  await page.getByRole('button',{name:'Alphabet',exact:true}).click();
  await page.locator('[data-letter="1"]').click();
  await page.waitForFunction(()=>window.__testAuth.docs.size>0,null,{timeout:9000});
  const documents=await page.evaluate(()=>[...window.__testAuth.docs.entries()]);
  assert.ok(documents.some(([path,data])=>path.includes('/learners/adult/progress/')&&data.ownerUid==='test-owner'));
  assert.ok(documents.every(([path])=>!path.includes('next-french-preview')));
  assert.equal(await page.locator('[data-cloud-status]').filter({hasText:'Saved to Firebase'}).count(),1);
  assert.equal(await page.locator('[data-cloud-status]').isVisible(),false);
  await page.locator('[data-profile]').selectOption('sai');
  await page.locator('[data-cloud-status]').filter({hasText:'Saved to Firebase'}).waitFor({state:'attached',timeout:9000});
  assert.match(await page.locator('.ft-e-dashboard .ft-e-metrics').first().innerText(),/Not measured/);
  assert.deepEqual(errors,[]);
  console.log('French passkey browser smoke: authenticated owner, live Firebase sync, isolated learners');
}finally{await browser.close();}
