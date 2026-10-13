import test from 'node:test';
import assert from 'node:assert/strict';
import {annotationIssueTitle} from './server.js';
test('diagnostic titles use the owner comment rather than the whole report',()=>{
 const note={appId:'dol',anchorId:'diagnostics-report',text:'[dol] UI diagnostic report\nTarget repository: nirav2000/Dol\n## Owner comment\nI could not see the factors.\n\n## Findings\nLots of geometry.'};
 assert.equal(annotationIssueTitle(note),'[dol] I could not see the factors.');
 assert.equal(annotationIssueTitle({...note,text:'Report\n## Findings\nLots of geometry'}),'[dol] UI diagnostic report');
 assert.ok(annotationIssueTitle({...note,text:'## Owner comment\n'+ 'Long '.repeat(80)}).length<=106);
});
test('ordinary notes keep a readable single-line title',()=>{
 assert.equal(annotationIssueTitle({appId:'dol',text:'[dol] Fix spacing https://example.com\nSensitive extra report'}),'[dol] Fix spacing');
 assert.equal(annotationIssueTitle({appId:'dol',text:'\n\nFix café labels\nDetails'}),'[dol] Fix café labels');
});
