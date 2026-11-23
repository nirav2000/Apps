import test from 'node:test';
import assert from 'node:assert/strict';
import {isIOSStandalone,browserAuthContext} from '../french-teaching/v1/auth-context.js';

const iphone='Mozilla/5.0 (iPhone; CPU iPhone OS 26_2 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148';
test('blocks popup OAuth for iOS standalone web app, not iOS browser',()=>{
  assert.equal(isIOSStandalone({userAgent:iphone,navigatorStandalone:true}),true);
  assert.equal(isIOSStandalone({userAgent:iphone,displayStandalone:true}),true);
  assert.equal(isIOSStandalone({userAgent:iphone}),false);
  assert.equal(isIOSStandalone({userAgent:'Mozilla/5.0 (Android) Chrome/120',navigatorStandalone:true}),false);
});
test('iPad desktop-style user agent with touch input is treated as Apple PWA',()=>{
  assert.equal(isIOSStandalone({platform:'MacIntel',maxTouchPoints:5,displayStandalone:true}),true);
  assert.equal(isIOSStandalone({platform:'MacIntel',maxTouchPoints:0,displayStandalone:true}),false);
  assert.equal(isIOSStandalone({platform:'MacIntel',maxTouchPoints:5,displayStandalone:false}),false);
});
test('checks both navigator.standalone and display-mode:standalone',()=>{
  const ios={navigator:{userAgent:iphone,standalone:true},matchMedia:()=>({matches:false})};
  assert.deepEqual(browserAuthContext(ios),{iosStandalone:true,allowGooglePopup:false,reason:'ios-home-screen'});
  assert.equal(browserAuthContext({navigator:{userAgent:iphone,standalone:false},matchMedia:()=>({matches:false})}).allowGooglePopup,true);
  assert.equal(browserAuthContext({navigator:{userAgent:iphone},matchMedia:()=>({matches:true})}).allowGooglePopup,false);
  assert.equal(browserAuthContext({navigator:{userAgent:'Android'},matchMedia:()=>({matches:true})}).allowGooglePopup,true);
  assert.equal(browserAuthContext({navigator:{userAgent:iphone},matchMedia(){throw Error('unsupported')}}).allowGooglePopup,true);
});
