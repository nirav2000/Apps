import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {chromium} from 'playwright';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const script=fs.readFileSync(path.join(root,'version-lab/isolated-preview.js'),'utf8');
const cases=[
  {id:'dol',repository:'nirav2000/Dol',commit:'e1e8f489fdecef85d160b28adf90646b0c64d1a2',selector:'#focusToggle',attribute:'aria-pressed'},
  {id:'openday',repository:'nirav2000/Openday',commit:'a931176fb713e6fe51a80541f887b060920881a5',selector:'#primaryPhaseBtn',attribute:'class'},
  {id:'snag',repository:'nirav2000/snag',commit:'729408962a16943fc05536b2dd30bf976eaf547f',selector:'button[data-nav="rooms"]',attribute:'class'}
];
const results=[];
const browser=await chromium.launch({headless:true});
try{
  for(const test of cases){
    const page=await browser.newPage({viewport:{width:1200,height:900}});
    const errors=[];
    page.on('pageerror',e=>errors.push(e.message.slice(0,240)));
    page.on('console',m=>{if(m.type()==='error'&&errors.length<12)errors.push(m.text().slice(0,240))});
    await page.setContent('<!doctype html><html><body style="margin:0"><iframe id="preview" sandbox="allow-scripts allow-modals" style="width:100%;height:850px;border:0"></iframe></body></html>');
    await page.addScriptTag({content:script});
    const result={app:test.id,source:test.repository+'@'+test.commit,htmlLoaded:false,interaction:false,issue:null,consoleErrors:[]};
    try{
      await page.evaluate(async ({repository,commit})=>{
        const html=await window.VersionLabIsolated.build({repository},{commit});
        document.getElementById('preview').srcdoc=html;
      },test);
      result.htmlLoaded=true;
      const control=page.frameLocator('#preview').locator(test.selector).first();
      await control.waitFor({state:'attached',timeout:18000});
      await page.waitForTimeout(1200);
      const before=await control.getAttribute(test.attribute);
      // A DOM click also tests listener wiring when historical focus or auth
      // overlays hide the element on this arbitrary test viewport.
      await control.evaluate(el=>el.click());
      await page.waitForTimeout(650);
      const after=await control.getAttribute(test.attribute);
      result.before=before;result.after=after;
      result.interaction=before!==after;
      if(!result.interaction)result.issue='No observed state change; backend or legacy code may be needed';
      await page.screenshot({path:path.join(root,'version-lab-probe-'+test.id+'.png'),fullPage:false});
    }catch(error){result.issue=String(error.message||error).slice(0,360)}
    result.consoleErrors=errors.slice(0,6);
    results.push(result);
    await page.close();
  }
}finally{await browser.close()}
fs.writeFileSync(path.join(root,'version-lab-live-probe.json'),JSON.stringify(results,null,2)+'\n');
for(const result of results)console.log(JSON.stringify(result));
if(results.every(x=>!x.htmlLoaded))process.exitCode=1;
