import {normaliseAnswer} from './data.js';
export const TRACKS=Object.freeze([
 {id:'michaela',name:'Michaela foundations',summary:'Original four intensive sentence-building lessons.'},
 {id:'sai',name:'Sai · school French',summary:'School vocabulary, classroom language, grammar and cumulative revision.'},
 {id:'unlocking',name:'Unlocking French',summary:'One new building block at a time, spoken recall, sentence construction and independent checks.'},
 {id:'unlocking-archive',name:'Earlier Unlocking · archive',summary:'The original six sentence-based lessons and their existing progress.'}
]);
export const trackName=id=>TRACKS.find(t=>t.id===id)?.name||TRACKS[0].name;
export const validTrack=id=>TRACKS.some(t=>t.id===id);
export const curriculumNormalize=s=>normaliseAnswer(s).replace(/[«»“”"]/g,'').replace(/\s*[,;.!?]\s*/g,' ').replace(/\s+/g,' ').trim();
export function curriculumVariants(fr,en=''){
 const base=curriculumNormalize(fr),prompt=String(en).toLowerCase(),xs=new Set([base]);
 const add=s=>xs.add(curriculumNormalize(s));
 if(base.includes('marron'))add(base.replaceAll('marron',base.includes('souris')?'brune':'brun'));
 if(base.includes('un défi'))add(base.replace('un défi','un challenge'));
 if(base==='ça va bien')add('je vais bien');
 if(base==='ça va très bien')add('je vais très bien');
 if(base==='ça va mal')add('je vais mal');
 if(base==='comment ça va'){add('ça va');add('comment vas-tu');add('comment allez-vous');}
 if(base==='pouvez-vous répéter'){add('est-ce que vous pouvez répéter');add('vous pouvez répéter');}
 if(base==="c'est quand ton anniversaire"){add('quand est ton anniversaire');add("quand est-ce que c'est ton anniversaire");}
 if(base.startsWith("mon anniversaire c'est le "))add(base.replace("mon anniversaire c'est le ","mon anniversaire est le "));
 if(!prompt.includes('use est-ce que')&&!prompt.includes('with est-ce que')&&base.startsWith('est-ce que tu '))add(base.slice(11));
 if(base==='est-ce que je peux aller aux toilettes'&&!prompt.includes('use est-ce que')){add('puis-je aller aux toilettes');add('je peux aller aux toilettes');}
 if(base==='je suis en retard')add('je suis en retard');
 if(base==='est-ce que vous pouvez répéter'&&!prompt.includes('use est-ce que'))add('pouvez-vous répéter');
 return [...xs];
}
