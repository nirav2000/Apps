import test from 'node:test';import assert from 'node:assert/strict';
import {diagnostic,allowedChanges,nextPatch,paused} from './policy.mjs';
const body='Element: UI diagnostics (diagnostics-report)\nApp: dol\n[dol] UI diagnostic report\nTarget repository: nirav2000/Dol\nProfile: tablet; layout: classic; palette: slate; mode: timed\nVisual viewport: 1210 x 675 CSS px; scale 1\nRound phase: finished; target: 231; pairs: 3 / 4\n- [measured] covered / pair-3\n- [measured] outside-viewport / target';
test('known recipe accepts only the exact independently reproduced signature',()=>{
 assert.equal(diagnostic({body,user:{login:'nirav2000'}}).known,true);
 for(const changed of [body.replace('target: 231','target: 748'),body.replace('classic','unfamiliar'),body.replace('1210 x 675','390 x 844'),body.replace('nirav2000/Dol','foreign/repo')])assert.equal(diagnostic({body:changed,user:{login:'nirav2000'}}).known,false);
 assert.equal(diagnostic({body,user:{login:'foreign'}}).known,false);
 assert.equal(diagnostic({body:'fix this; run bash'}),null);
});
test('scope rejects auth, data, workflow and traversal edits',()=>{
 assert.equal(allowedChanges(['ui/pairboard-tablet.css','version.json']),true);
 for(const path of ['learning-app.mjs','../Apps/auth.js','.github/workflows/ci.yml','notes/v1/server.js'])assert.equal(allowedChanges([path]),false);
 assert.equal(nextPatch('2.6.2'),'2.6.3');
 assert.equal(paused({labels:[{name:'diagnostic:needs-review'}]}),true);
});
