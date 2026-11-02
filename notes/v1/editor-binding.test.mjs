import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const ui=readFileSync(new URL('./ui.js',import.meta.url),'utf8');
test('shared editor never targets the first hidden ChatGPT import textarea',()=>{
 assert.doesNotMatch(ui,/q\(dialog,'textarea'\)/);
 assert.match(ui,/q\(dialog,'\.note-composer textarea'\)\.value\.trim\(\)/);
 assert.match(ui,/q\(dialog,'\.note-composer textarea'\)\.oninput/);
 assert.match(ui,/data-note-error/);
});
