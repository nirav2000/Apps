import assert from 'node:assert/strict';
import {ICON_CONCEPTS,iconSvg} from './icon-factory.mjs';
assert.equal(ICON_CONCEPTS.length,6,'The design lab should offer six concepts');
assert.equal(new Set(ICON_CONCEPTS.map(c=>c.id)).size,6,'Concept identifiers must be unique');
for(const c of ICON_CONCEPTS){
 const regular=iconSvg({concept:c.id,background:'#102a43',accent:'#1a6674'});
 const maskable=iconSvg({concept:c.id,background:'#102a43',accent:'#1a6674',maskable:true});
 for(const svg of [regular,maskable]){
  assert.match(svg,/^<svg[^>]*viewBox="0 0 512 512"/);
  assert.match(svg,/<\/svg>\s*$/);
  assert.match(svg,/<rect width="512" height="512"/);
  assert.ok(!svg.includes('<script'),'Icon SVG must be static');
 }
 assert.ok(regular!==maskable,'Maskable source must move foreground into safe area');
 assert.ok(maskable.includes('transform="translate(51.2 51.2) scale(.8)"'));
}
assert.throws(()=>iconSvg({concept:'not-real'}),/Unknown icon concept/);
console.log('PASS: Six original icon concepts and maskable-safe vector assets');
