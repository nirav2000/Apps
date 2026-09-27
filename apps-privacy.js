(function(){
'use strict';
if(window.AppsPrivacy)return;
const VERSION=2,KEY='apps-platform.v1.privacy',listeners=new Set();
function defaults(){
  const cfg=window.APPS_PRIVACY_CONFIG||{};
  return {version:VERSION,choiceMade:false,analytics:cfg.defaultAnalytics===true,personalisedMonitoring:cfg.defaultPersonalisedMonitoring===true,updatedAt:null};
}
function read(){try{return{...defaults(),...JSON.parse(localStorage.getItem(KEY)||'null')}}catch{return defaults()}}
function write(next){const value={...read(),...next,version:VERSION,choiceMade:true,updatedAt:new Date().toISOString()};try{localStorage.setItem(KEY,JSON.stringify(value))}catch{}emit(value);return value}
function emit(value=read()){try{window.dispatchEvent(new CustomEvent('apps-privacy:change',{detail:value}))}catch{}for(const fn of listeners){try{fn(value)}catch{}}}
const api={version:VERSION,key:KEY,get:read,set:write,hasChoice:()=>!!read().choiceMade,analyticsAllowed:()=>read().analytics===true,personalisedMonitoringAllowed:()=>read().personalisedMonitoring===true,reset(){try{localStorage.removeItem(KEY)}catch{}const value=defaults();emit(value);return value},onChange(fn){listeners.add(fn);fn(read());return()=>listeners.delete(fn)}};
window.AppsPrivacy=api;
})();