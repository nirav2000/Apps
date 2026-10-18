export async function run({page,assert,waitForQuiescence,metrics}){
  assert.equal(await page.evaluate(()=>AIAtlas.renders),1,'Both datasets render once, regardless of network order');
  assert.equal(await page.locator('[data-tab]').count(),9,'All nine views exist');
  for(const id of ['overview','money','models','pricing','customers','world','local','history','method']){
    await page.locator('[data-tab="'+id+'"]').click();
    assert(await page.locator('#view-'+id).isVisible(),'View works: '+id);
    assert(await page.locator('#view-'+id+' h2').count()>0,'Populated view: '+id);
  }
  await page.locator('[data-tab=history]').click();
  assert(await page.locator('#histTable tbody tr').count()>0,'Annual history loaded');
  await page.locator('#histChart [data-bar]').first().click();
  assert(await page.locator('#histChart .bar-detail a').count()>0,'Tap chart to inspect original source');
  await page.locator('[data-tab=models]').click();await page.locator('#modelSearch').fill('no-such-model-xyz');
  assert.equal(await page.locator('#modelTable tbody tr').count(),0,'Empty filters are handled');
  await page.locator('#modelSearch').fill('');
  const quiet=await waitForQuiescence(()=>page.evaluate(()=>({renders:AIAtlas.renders,state:AIAtlas.status})),{quietMs:600,maxChanges:0});
  assert.equal(quiet.changes,0,'No repeated render or loading loop after convergence');
  const serif=await page.evaluate(()=>[...document.querySelectorAll('h1,h2,body,button')].some(el=>/Georgia|Iowan|Times New Roman/.test(getComputedStyle(el).fontFamily)));
  assert.equal(serif,false,'No serif typography');metrics.scenario.views=9;
}
