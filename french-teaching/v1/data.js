// Human-reviewed pilot content. Original material inspired by documented Michaela routines.
// These are not verbatim Michaela knowledge organisers or official Barry Smith materials.
export const COURSE_VERSION='1.0.2';
const letters='ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
const names=['a','bé','cé','dé','e','effe','gé','ache','i','ji','ka','elle','emme','enne','o','pé','cu','erre','esse','té','u','vé','double vé','iks','i grec','zède'];
const examples=['ami','bonjour','chat','demain','école','français','grand','hôtel','ici','je','kilo','livre','maison','non','oui','parce que','question','rue','salut','toujours','utile','ville','wagon','exemple','yeux','zéro'];
export const ALPHABET=letters.map((letter,i)=>({letter,name:names[i],example:examples[i]}));
export const CUDDLES=[
 ['C','Count letters','Count every letter in a tricky French word.'],
 ['U','Underline vowel combinations','Notice groups such as ou, au, eau, ai and oi.'],
 ['D','Double underline double consonants','Look for doubled letters such as pp, nn and ss.'],
 ['D','Dot silent letters','Notice endings such as the silent t in petit.'],
 ['L','Link liaison','Mark a sounded connection such as les‿amis.'],
 ['E','Exaggerate accents','Notice é, è, ê, à, ù and the cedilla ç.'],
 ['S','Stories','Use a short spelling story or mnemonic for difficult patterns.']
];
export const PASSAGE=[
 {fr:"J'habite un petit appartement, mais je préfère une grande maison.",en:"I live in a small flat, but I prefer a big house.",literal:"I inhabit a small flat, but I prefer a big house.",focus:"mais · contrast",sound:"In petit, final t is normally silent; appartement has double p (only one m)."},
 {fr:"J'aime le français parce que c'est utile.",en:"I like French because it is useful.",literal:"I like the French because it is useful.",focus:"parce que · reason",sound:"The s in français is pronounced; the final s of mais is normally silent."},
 {fr:"Je veux apprendre, donc je pratique chaque jour.",en:"I want to learn, so I practise every day.",literal:"I want to learn, therefore I practise each day.",focus:"donc · consequence",sound:"The vowel group eu in veux has a distinct French sound."},
 {fr:"D'abord, j'écoute, puis je répète.",en:"First, I listen, then I repeat.",literal:"First, I listen, then I repeat.",focus:"d'abord / puis · sequence",sound:"The accent in répète is important; the ending -ent in many verb forms is silent."},
 {fr:"Je travaille et j'écoute de la musique.",en:"I work and I listen to music.",literal:"I work and I listen to some music.",focus:"et · addition",sound:"In travaille the -ill- represents a y-like sound; final e is usually weak or silent."},
 {fr:"J'étudie aussi le soir.",en:"I also study in the evening.",literal:"I study also the evening.",focus:"aussi · addition",sound:"au makes the /o/ sound in aussi."},
 {fr:"Quand j'ai le temps, je lis en français.",en:"When I have time, I read in French.",literal:"When I have the time, I read in French.",focus:"quand · time",sound:"The d of quand is often silent unless linking in a suitable context."},
 {fr:"Si je fais une erreur, je recommence.",en:"If I make a mistake, I start again.",literal:"If I make an error, I begin again.",focus:"si · condition",sound:"The -ais in fais does not sound like English 'ays'."},
 {fr:"Hier, j'ai parlé français avec un ami.",en:"Yesterday I spoke French with a friend.",literal:"Yesterday I have spoken French with a friend.",focus:"j'ai parlé · past",sound:"é gives the /e/ sound in parlé."},
 {fr:"Demain, je vais regarder une vidéo en français.",en:"Tomorrow I'm going to watch a video in French.",literal:"Tomorrow I go to watch a video in French.",focus:"je vais · future",sound:"ain in demain makes a nasal vowel."},
 {fr:"À mon avis, c'est difficile, cependant c'est intéressant.",en:"In my opinion it is difficult, however it is interesting.",literal:"To my opinion, it is difficult, however it is interesting.",focus:"à mon avis / cependant · opinion and contrast",sound:"The final t in intéressant is normally silent."},
 {fr:"Je voudrais parler français plus souvent.",en:"I would like to speak French more often.",literal:"I would-want to speak French more often.",focus:"je voudrais · polite wish",sound:"ou in voudrais is the /u/ sound, different from French u."},
 {fr:"Pour apprendre, il faut pratiquer régulièrement.",en:"To learn, you have to practise regularly.",literal:"For learning, it is necessary to practise regularly.",focus:"il faut · necessity",sound:"The è accent and single l in régulièrement help you spell it accurately."},
 {fr:"Bien que ce soit difficile, je veux continuer.",en:"Although it is difficult, I want to carry on.",literal:"Although this be difficult, I want to continue.",focus:"bien que ... soit · subjunctive",sound:"oi in soit has the /wa/ sound; final t is silent."}
];
export const PATTERNS=[
 {name:'Add information',word:'et / aussi',frame:"J'aime le français et j'aime la musique.",english:"I like French and I like music."},
 {name:'Give a reason',word:'parce que',frame:"J'aime le français parce que c'est utile.",english:"I like French because it is useful."},
 {name:'Contrast ideas',word:'mais / cependant',frame:"J'aime le français, mais c'est difficile.",english:"I like French, but it is difficult."},
 {name:'State a consequence',word:'donc',frame:"Je veux progresser, donc je pratique.",english:"I want to improve, so I practise."},
 {name:'Add a condition',word:'si',frame:"Si j'ai le temps, je lis.",english:"If I have time, I read."},
 {name:'Say what comes next',word:"d'abord / puis",frame:"D'abord, j'écoute, puis je répète.",english:"First I listen, then I repeat."},
 {name:'Use the past',word:"j'ai + past participle",frame:"Hier, j'ai parlé français.",english:"Yesterday I spoke French."},
 {name:'Use the future',word:'je vais + infinitive',frame:"Demain, je vais parler français.",english:"Tomorrow I am going to speak French."}
];
export const DRILLS=[
 {id:'find-mais',kind:'find',line:0,prompt:'Find the French for “but”.',answer:'mais',concept:'french:connectives:contrast',phase:'practice',hint:"Look just after appartement."},
 {id:'find-reason',kind:'find',line:1,prompt:'Find the French for “because”.',answer:'parce que',concept:'french:connectives:reason',phase:'practice',hint:"It follows le français."},
 {id:'find-so',kind:'find',line:2,prompt:'Find the French for “so / therefore”.',answer:'donc',concept:'french:connectives:result',phase:'practice',hint:"It links the wish with the practice."},
 {id:'find-first',kind:'find',line:3,prompt:'Find the French for “first”.',answer:"d'abord",concept:'french:connectives:sequence',phase:'practice',hint:"It begins the sentence."},
 {id:'find-then',kind:'find',line:3,prompt:'Find the French for “then”.',answer:'puis',concept:'french:connectives:sequence',phase:'practice',hint:"It comes after j'écoute."},
 {id:'find-if',kind:'find',line:7,prompt:'Find the French for “if”.',answer:'si',concept:'french:connectives:condition',phase:'practice',hint:"The first word."},
 {id:'find-however',kind:'find',line:10,prompt:'Find the French for “however”.',answer:'cependant',concept:'french:connectives:contrast',phase:'practice',hint:"It follows difficile."},
 {id:'understand-1',kind:'toEnglish',prompt:"J'aime le français parce que c'est utile.",answer:'I like French because it is useful.',concept:'french:sentence:reason',phase:'practice',hint:'Break it into j’aime + le français + parce que + c’est utile.'},
 {id:'produce-1',kind:'toFrench',prompt:'I like French because it is useful.',answer:"J'aime le français parce que c'est utile.",concept:'french:sentence:reason',phase:'practice',hint:"J'aime le français + parce que + c'est utile."},
 {id:'produce-2',kind:'toFrench',prompt:'I live in a small flat, but I prefer a big house.',answer:"J'habite un petit appartement, mais je préfère une grande maison.",concept:'french:sentence:contrast',phase:'practice',hint:"J'habite un petit appartement + mais + je préfère une grande maison."},
 {id:'produce-3',kind:'toFrench',prompt:'First I listen, then I repeat.',answer:"D'abord, j'écoute, puis je répète.",concept:'french:sentence:sequence',phase:'practice',hint:"D'abord + j'écoute + puis + je répète."},
 {id:'produce-4',kind:'toFrench',prompt:"If I make a mistake, I start again.",answer:"Si je fais une erreur, je recommence.",concept:'french:sentence:condition',phase:'practice',hint:"Si je fais une erreur + je recommence."},
 {id:'produce-5',kind:'toFrench',prompt:"Tomorrow I'm going to watch a video in French.",answer:"Demain, je vais regarder une vidéo en français.",concept:'french:profs:future',phase:'practice',hint:"Demain + je vais + regarder + une vidéo en français."},
 {id:'produce-6',kind:'toFrench',prompt:"Yesterday I spoke French with a friend.",answer:"Hier, j'ai parlé français avec un ami.",concept:'french:profs:past',phase:'practice',hint:"Hier + j'ai parlé + français + avec un ami."},
 {id:'transfer-1',kind:'toFrench',prompt:'I like music because it is interesting.',answer:"J'aime la musique parce que c'est intéressant.",concept:'french:connectives:reason',phase:'transfer',novel:true,hint:"J'aime la musique + parce que + c'est intéressant."},
 {id:'transfer-2',kind:'toFrench',prompt:'I like music, but I prefer French.',answer:"J'aime la musique, mais je préfère le français.",concept:'french:connectives:contrast',phase:'transfer',novel:true,hint:"J'aime la musique + mais + je préfère le français."},
 {id:'transfer-3',kind:'toFrench',prompt:'If I have time, I listen to music.',answer:"Si j'ai le temps, j'écoute de la musique.",concept:'french:connectives:condition',phase:'transfer',novel:true,hint:"Si j'ai le temps + j'écoute de la musique."},
 {id:'transfer-4',kind:'toFrench',prompt:"Tomorrow I'm going to speak French with a friend.",answer:"Demain, je vais parler français avec un ami.",concept:'french:profs:future',phase:'transfer',novel:true,hint:"Demain + je vais parler + français + avec un ami."},
 {id:'transfer-5',kind:'toFrench',prompt:'I want to learn, so I listen and I repeat.',answer:"Je veux apprendre, donc j'écoute et je répète.",concept:'french:connectives:result',phase:'transfer',novel:true,hint:"Je veux apprendre + donc + j'écoute et je répète."},
 {id:'transfer-6',kind:'toFrench',prompt:"Yesterday I listened to music, but today I study French.",answer:"Hier, j'ai écouté de la musique, mais aujourd'hui j'étudie le français.",concept:'french:profs:past',phase:'transfer',novel:true,hint:"Hier j'ai écouté + mais aujourd'hui j'étudie."}
];
// One written-answer policy: accept formatting, never remove meaningful accents or word joins.
export function normaliseAnswer(s){
  return String(s??'').normalize('NFC').toLocaleLowerCase('fr').replace(/[’‘]/g,"'")
    .replace(/[«»“”"]/g,' ')
    .replace(/[.!?,;:]+/g,(p,i,v)=>/^[.,]$/.test(p)&&/\d/.test(v[i-1]||'')&&/\d/.test(v[i+p.length]||'')?p:' ')
    .replace(/\s+/g,' ').trim();
}
export function markAnswer(input,answer){return normaliseAnswer(input)===normaliseAnswer(answer);}


// A controlled language workshop: five grammatical structures × four beginnings × four endings.
// Every combination is original course content; practising an already revealed version is not novel transfer.
export const SENTENCE_WORKSHOP=[
 {id:'reason',title:'Explain why',frJoin:' parce que ',enJoin:' because ',left:[
  {fr:"J'apprends le français",en:'I learn French'},
  {fr:'Je pratique chaque jour',en:'I practise every day'},
  {fr:'Je lis en français',en:'I read in French'},
  {fr:"J'écoute la radio",en:'I listen to the radio'}],
  right:[
  {fr:'je veux progresser',en:'I want to improve'},
  {fr:"c'est utile",en:'it is useful'},
  {fr:"j'aime apprendre",en:'I like learning'},
  {fr:"j'ai le temps",en:'I have time'}]},
 {id:'contrast',title:'Contrast two ideas',frJoin:', mais ',enJoin:', but ',left:[
  {fr:"J'aime le français",en:'I like French'},
  {fr:'Je comprends les mots',en:'I understand the words'},
  {fr:'Je veux parler français',en:'I want to speak French'},
  {fr:'Je travaille beaucoup',en:'I work a lot'}],
  right:[
  {fr:'je fais parfois des erreurs',en:'I sometimes make mistakes'},
  {fr:'je parle lentement',en:'I speak slowly'},
  {fr:'je trouve la grammaire difficile',en:'I find the grammar difficult'},
  {fr:"j'ai besoin de pratiquer",en:'I need to practise'}]},
 {id:'result',title:'Explain the result',frJoin:', donc ',enJoin:', so ',left:[
  {fr:'Je veux progresser',en:'I want to improve'},
  {fr:"J'ai un examen demain",en:'I have a test tomorrow'},
  {fr:'Je veux comprendre',en:'I want to understand'},
  {fr:'Je dois apprendre',en:'I have to learn'}],
  right:[
  {fr:'je pratique chaque jour',en:'I practise every day'},
  {fr:"je demande de l'aide",en:'I ask for help'},
  {fr:"j'écoute attentivement",en:'I listen carefully'},
  {fr:'je révise les phrases',en:'I revise the sentences'}]},
 {id:'condition',title:'State a condition',frJoin:', ',enJoin:', ',left:[
  {fr:"Si j'ai le temps",en:'If I have time'},
  {fr:'Si je fais une erreur',en:'If I make a mistake'},
  {fr:'Si je ne comprends pas',en:"If I don't understand"},
  {fr:"Si j'ai besoin d'aide",en:'If I need help'}],
  right:[
  {fr:"je demande de l'aide",en:'I ask for help'},
  {fr:'je recommence',en:'I try again'},
  {fr:'je lis en français',en:'I read in French'},
  {fr:'je vérifie mon travail',en:'I check my work'}]},
 {id:'sequence',title:'Sequence actions',frJoin:', puis ',enJoin:', then ',left:[
  {fr:"D'abord, j'écoute",en:'First, I listen'},
  {fr:"D'abord, je lis",en:'First, I read'},
  {fr:"D'abord, j'écris",en:'First, I write'},
  {fr:'D’abord, je réfléchis',en:'First, I think'}],
  right:[
  {fr:'je répète',en:'I repeat'},
  {fr:'je parle',en:'I speak'},
  {fr:'je vérifie',en:'I check'},
  {fr:'je recommence',en:'I try again'}]}
];
export function assembleWorkshop(mode,left,right){
  const p=SENTENCE_WORKSHOP[mode],a=p?.left[left],b=p?.right[right];
  if(!p||!a||!b)throw Error('Invalid French workshop selection');
  return {id:'workshop-'+p.id+'-'+left+'-'+right,concept:'french:connectives:'+p.id,
    fr:a.fr+p.frJoin+b.fr+'.',en:a.en+p.enJoin+b.en+'.',mode:p};
}
