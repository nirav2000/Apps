import {chromium} from 'playwright';
import assert from 'node:assert/strict';

const browser=await chromium.launch({headless:true});
const page=await browser.newPage({viewport:{width:390,height:844}});
const errors=[],networkWords=[];
page.on('pageerror',e=>errors.push(e.message));
page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
await page.route('https://api.wiktapi.dev/**',async route=>{
  const url=new URL(route.request().url());
  networkWords.push(url.pathname.split('/').at(-1));
  const word=decodeURIComponent(url.pathname.split('/').at(-1));
  if(word==='jour'){
    return route.fulfill({status:200,contentType:'application/json',headers:{'access-control-allow-origin':'*'},body:JSON.stringify({
      word:'jour',edition:'en',entries:[{
        word:'jour',lang:'French',lang_code:'fr',pos:'noun',
        senses:[{glosses:['day','daytime',"<img src=x onerror=alert('unsafe')>"]}],
        sounds:[{ipa:'/ʒuʁ/'}],
        forms:[{form:'jours',tags:['plural']}]
      }]
    })});
  }
  if(word==='vouloir'){
    return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({
      word:'vouloir',edition:'en',entries:[{
        word:'vouloir',lang:'French',lang_code:'fr',pos:'verb',
        senses:[{glosses:['to want, to wish']}],
        sounds:[{ipa:'/vu.lwaʁ/'}],
        forms:[{form:'veux',tags:['first-person singular','present']}]
      }]
    })});
  }
  return route.fulfill({status:404,contentType:'application/json',body:'{"error":"Not found"}'});
});
try{
  await page.goto('http://127.0.0.1:8898/tests/french-browser-harness.html',{waitUntil:'domcontentloaded'});
  await page.locator('.ft-tabs').waitFor();
  await page.getByRole('button',{name:'Knowledge grid',exact:true}).click();
  // Curated verb explanation stays available without a network request.
  await page.locator('.ft-grid-row [data-word="veux"]').first().click();
  const dialog=page.locator('.ft-word-dialog');
  await dialog.waitFor();
  assert.match(await dialog.innerText(),/vouloir/);
  assert.equal(networkWords.length,0);
  await dialog.locator('.ft-dictionary-panel summary').click();
  await dialog.locator('[data-fetch-dictionary]').click();
  await dialog.locator('.ft-dictionary-result').getByText(/to want, to wish/).waitFor();
  assert.deepEqual(networkWords,['vouloir']);
  assert.match(await dialog.innerText(),/Selected word forms/);
  assert.match(await dialog.innerText(),/Wiktionary/);
  await dialog.locator('[data-close-word]').click();
  await dialog.waitFor({state:'detached'});

  // Any previously unknown word in a lesson is tappable and can load details.
  await page.locator('.ft-grid-row [data-word="jour"]').first().click();
  await dialog.waitFor();
  await dialog.locator('.ft-dictionary-result').getByText('day', {exact:true}).waitFor();
  assert.deepEqual(networkWords,['vouloir','jour']);
  const source=await dialog.locator('.ft-dictionary-links a').first().getAttribute('href');
  assert.equal(source,'https://en.wiktionary.org/wiki/jour#French');
  assert.equal(await dialog.locator('.ft-dictionary-result img').count(),0);
  assert.match(await dialog.locator('.ft-dictionary-result').innerText(),/ʒuʁ/);
  const evidenceBefore=await page.evaluate(()=>window.__testEvidence.size);
  await dialog.locator('[data-close-word]').click();
  await dialog.waitFor({state:'detached'});

  // Reopening this word uses memory/local cache rather than another request.
  await page.locator('.ft-grid-row [data-word="jour"]').first().click();
  await dialog.waitFor();
  await dialog.locator('.ft-dictionary-result').getByText('day', {exact:true}).waitFor();
  assert.equal(networkWords.length,2);
  assert.equal(await page.evaluate(()=>window.__testEvidence.size),evidenceBefore);

  await dialog.locator('[data-close-word]').click();
  await dialog.waitFor({state:'detached'});
  const dims=await page.evaluate(()=>({
    width:document.documentElement.scrollWidth,client:document.documentElement.clientWidth
  }));
  assert.ok(dims.width<=dims.client+2,JSON.stringify(dims));
  assert.deepEqual(errors,[]);
  console.log('French dictionary browser: curated-first, online word fallback, no XSS, cache, no evidence mutation');
}finally{
  await browser.close();
}
