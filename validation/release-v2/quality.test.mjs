import {test} from 'node:test';
import assert from 'node:assert/strict';
import {checkSource} from './quality.mjs';
test('history collision is rejected',()=>assert(checkSource('function history(){}; history.replaceState(null,"","?")').some(x=>x.ruleId==='platform/browser-binding')));
test('explicit window.history passes',()=>assert.equal(checkSource('function historyChart(){}; window.history.replaceState(null,"","?")').length,0));
test('unqualified history API rejected',()=>assert(checkSource('history.replaceState(null,"","?")').some(x=>x.ruleId==='no-restricted-globals')));
test('event global rejected',()=>assert(checkSource('const click = () => event.target.value;').some(x=>x.ruleId==='no-restricted-globals')));
