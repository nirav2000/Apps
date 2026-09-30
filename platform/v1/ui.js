(function(){
'use strict';
if(window.AppsPlatformUIV1)return;
function findSlots(name){
  return [...document.querySelectorAll('[data-apps-component="'+CSS.escape(name)+'"]')];
}
function mount(name,renderer,options={}){
  const mode=options.mode||'explicit';
  if(mode==='headless')return [];
  let slots=findSlots(name);
  if(mode==='auto'&&!slots.length&&typeof options.createSlot==='function'){
    const slot=options.createSlot();if(slot){slot.dataset.appsComponent=name;document.body.appendChild(slot);slots=[slot]}
  }
  for(const slot of slots)renderer(slot,options);
  return slots;
}
window.AppsPlatformUIV1={version:'1.0.0',findSlots,mount};
})();