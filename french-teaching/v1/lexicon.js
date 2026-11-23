// Optional word and grammar explorer. Only curated forms are annotated;
// never infer a French verb's conjugation or gender from spelling alone.
export const LEXICON_VERSION='1.0.0';
export const SUBJECTS=['je / j’','tu','il / elle / on','nous','vous','ils / elles'];
const ER_ENDINGS=['-e','-es','-e','-ons','-ez','-ent'];
const regular=(lemma,meaning,forms,example,note='')=>({
 lemma,meaning,group:'Regular -er (present)',forms,endingHints:ER_ENDINGS,
 example,note:note||'In the present tense, these endings attach to the stem. The written -ent of ils/elles is silent.'
});
export const VERBS={
 habiter:regular('habiter','to live / inhabit',['habite','habites','habite','habitons','habitez','habitent'],"J'habite un petit appartement.",
  'Habiter can take a dwelling directly: J’habite une maison. Dans is also possible: J’habite dans une maison. With city names, à Londres is usual.'),
 aimer:regular('aimer','to like / love',['aime','aimes','aime','aimons','aimez','aiment'],"J'aime le français."),
 pratiquer:regular('pratiquer','to practise',['pratique','pratiques','pratique','pratiquons','pratiquez','pratiquent'],'Je pratique chaque jour.'),
 écouter:regular('écouter','to listen to',['écoute','écoutes','écoute','écoutons','écoutez','écoutent'],"J'écoute de la musique.",
  'Écouter takes a direct object in French: écouter de la musique (not écouter à de la musique).'),
 travailler:regular('travailler','to work',['travaille','travailles','travaille','travaillons','travaillez','travaillent'],'Je travaille beaucoup.'),
 étudier:regular('étudier','to study',['étudie','étudies','étudie','étudions','étudiez','étudient'],"J'étudie le français."),
 regarder:regular('regarder','to watch / look at',['regarde','regardes','regarde','regardons','regardez','regardent'],'Je vais regarder une vidéo.'),
 parler:regular('parler','to speak',['parle','parles','parle','parlons','parlez','parlent'],'Je parle français.'),
 continuer:regular('continuer','to continue',['continue','continues','continue','continuons','continuez','continuent'],'Je veux continuer.'),
 demander:regular('demander','to ask / request',['demande','demandes','demande','demandons','demandez','demandent'],"Je demande de l'aide."),
 vérifier:regular('vérifier','to check',['vérifie','vérifies','vérifie','vérifions','vérifiez','vérifient'],'Je vérifie mon travail.'),
 trouver:regular('trouver','to find',['trouve','trouves','trouve','trouvons','trouvez','trouvent'],'Je trouve la grammaire difficile.'),
 chercher:regular('chercher','to look for',['cherche','cherches','cherche','cherchons','cherchez','cherchent'],'Je cherche un appartement.'),
 réviser:regular('réviser','to revise',['révise','révises','révise','révisons','révisez','révisent'],'Je révise les phrases.'),
 préférer:{lemma:'préférer',meaning:'to prefer',group:'Stem-changing -er (present)',
  forms:['préfère','préfères','préfère','préférons','préférez','préfèrent'],
  example:'Je préfère une grande maison.',
  note:'The vowel in the stem changes: je préfère, but nous préférons. The present endings are -e, -es, -e, -ons, -ez, -ent.'},
 répéter:{lemma:'répéter',meaning:'to repeat',group:'Stem-changing -er (present)',
  forms:['répète','répètes','répète','répétons','répétez','répètent'],
  example:'Je répète après le professeur.',
  note:'Notice je répète versus nous répétons. This spelling change preserves the pronunciation pattern.'},
 recommencer:{lemma:'recommencer',meaning:'to start again',group:'Spelling-changing -er (present)',
  forms:['recommence','recommences','recommence','recommençons','recommencez','recommencent'],
  example:'Si je fais une erreur, je recommence.',
  note:'Nous recommençons takes ç to keep the soft /s/ sound before o; endings are otherwise the familiar -er set.'},
 vouloir:{lemma:'vouloir',meaning:'to want',group:'Irregular -oir (present)',
  forms:['veux','veux','veut','voulons','voulez','veulent'],
  example:'Je veux apprendre le français.',
  note:'Je veux + infinitive means “I want to …” (je veux apprendre). The stems vary: veu-, voul-, veul-. Do NOT apply the regular -er endings to vouloir.',
  formsExtra:{voudrais:{label:'je voudrais',tense:'conditional present',note:'A polite “I would like”. It comes from vouloir, not a different verb.'}}},
 avoir:{lemma:'avoir',meaning:'to have',group:'Irregular (present)',
  forms:['ai','as','a','avons','avez','ont'],example:"J'ai le temps.",
  note:'J’ai is je + ai contracted. J’ai parlé uses avoir + past participle to form the passé composé.'},
 être:{lemma:'être',meaning:'to be',group:'Irregular (present)',
  forms:['suis','es','est','sommes','êtes','sont'],example:"C'est intéressant.",
  note:'C’est contracts ce + est. Bien que ce soit uses soit, a present subjunctive form of être.',
  formsExtra:{soit:{label:'qu’il / qu’elle soit; que ce soit',tense:'present subjunctive',note:'Often introduced after bien que, il faut que and other triggers; not a regular present-tense ending.'}}},
 aller:{lemma:'aller',meaning:'to go',group:'Irregular (present)',
  forms:['vais','vas','va','allons','allez','vont'],example:'Demain, je vais regarder une vidéo.',
  note:'Je vais + infinitive is the near future: je vais parler, je vais regarder.'},
 faire:{lemma:'faire',meaning:'to do / make',group:'Irregular (present)',
  forms:['fais','fais','fait','faisons','faites','font'],example:'Si je fais une erreur, je recommence.',
  note:'Je fais une erreur means “I make a mistake”. Do not use the English word order literally.'},
 lire:{lemma:'lire',meaning:'to read',group:'Irregular -re (present)',
  forms:['lis','lis','lit','lisons','lisez','lisent'],example:'Quand j’ai le temps, je lis en français.',
  note:'Je lis has a written final s but is pronounced without that s. Il lit has a final silent t.'},
 apprendre:{lemma:'apprendre',meaning:'to learn',group:'Irregular -re (present)',
  forms:['apprends','apprends','apprend','apprenons','apprenez','apprennent'],
  example:"Je veux apprendre le français.",
  note:'After je veux, keep the infinitive apprendre: “je veux apprendre”, not “je veux apprends”.'},
 comprendre:{lemma:'comprendre',meaning:'to understand',group:'Irregular -re (present)',
  forms:['comprends','comprends','comprend','comprenons','comprenez','comprennent'],
  example:'Je comprends les mots.',
  note:'Comprendre follows the same broad present-tense pattern as apprendre.'},
 devoir:{lemma:'devoir',meaning:'to have to / must',group:'Irregular -oir (present)',
  forms:['dois','dois','doit','devons','devez','doivent'],example:'Je dois apprendre.',
  note:'Je dois + infinitive expresses obligation; contrast je veux (desire).'},
 pouvoir:{lemma:'pouvoir',meaning:'to be able to / can',group:'Irregular -oir (present)',
  forms:['peux','peux','peut','pouvons','pouvez','peuvent'],example:'Je peux parler français.',
  note:'Je peux + infinitive means I can do something; compare je veux + infinitive.'},
 falloir:{lemma:'falloir',meaning:'to be necessary / must',group:'Impersonal verb',
  forms:[],example:'Il faut pratiquer régulièrement.',
  note:'Falloir is normally impersonal: il faut (present), il fallait (imperfect), il faudra (future), il faudrait (conditional). It is not conjugated as je faux / tu faux.'}
};
const EXTRA_FORMS={
 parlé:['parler','past participle','In j’ai parlé, parlé is the past participle used with avoir.'],
 écouté:['écouter','past participle','J’ai écouté means I listened / I have listened.'],
 préféré:['préférer','past participle','Préféré is the past participle of préférer.'],
 été:['être','past participle','Été is the past participle of être.'],
 voudrais:['vouloir','conditional present','Je voudrais is a polite way to say “I would like”.'],
 soit:['être','present subjunctive','Ce soit is used in the subjunctive, for example bien que ce soit difficile.']
};
export const WORD_NOTES={
 'mais':{kind:'connector',meaning:'but',tip:'Introduces a contrast. J’aime le français, mais c’est difficile.',example:"Je veux apprendre, mais je fais des erreurs."},
 'parce que':{kind:'connector',meaning:'because',tip:'Introduces a reason. It is two written words but one useful chunk.',example:"J'aime le français parce que c'est utile."},
 'donc':{kind:'connector',meaning:'so / therefore',tip:'Introduces a consequence. What follows is the result.',example:'Je veux progresser, donc je pratique.'},
 'si':{kind:'connector',meaning:'if',tip:'Introduces a condition. In simple realistic conditions, si usually takes a present tense verb.',example:"Si j'ai le temps, je lis."},
 'puis':{kind:'connector',meaning:'then',tip:'Links steps in a sequence.',example:"D'abord, j'écoute, puis je répète."},
 "d'abord":{kind:'connector',meaning:'first / to begin with',tip:'The apostrophe represents an elision. Often followed by puis.',example:"D'abord, j'écoute, puis je répète."},
 'aussi':{kind:'connector',meaning:'also',tip:'Adds information. Its au spelling typically represents /o/.',example:"J'étudie aussi le soir."},
 'et':{kind:'connector',meaning:'and',tip:'Connects two equal ideas. In ordinary speech et is /e/.',example:'Je travaille et je pratique.'},
 'quand':{kind:'connector',meaning:'when',tip:'Introduces the time or circumstance of another action.',example:"Quand j'ai le temps, je lis."},
 'cependant':{kind:'connector',meaning:'however / nevertheless',tip:'More formal contrast than mais.',example:"C'est difficile, cependant c'est intéressant."},
 'à mon avis':{kind:'expression',meaning:'in my opinion',tip:'An introductory phrase for stating what you think; literally “to my opinion”.',example:"À mon avis, c'est utile."},
 'il faut':{kind:'expression',meaning:'it is necessary / you have to',tip:'Impersonal structure followed by an infinitive: il faut pratiquer.',example:'Il faut pratiquer régulièrement.'},
 'bien que':{kind:'connector',meaning:'although',tip:'Commonly introduces the subjunctive: bien que ce soit difficile.',example:'Bien que ce soit difficile, je continue.'},
 'dans':{kind:'preposition',meaning:'in / inside',tip:'Describes being inside somewhere. With habiter, a dwelling may be the direct object: j’habite une maison OR j’habite dans une maison.',example:'J’habite dans une maison.'},
 'chez':{kind:'preposition',meaning:'at the home / place of',tip:'Use with a person or organisation: chez mes parents, chez le médecin.',example:"J'habite chez mes parents."},
 'à':{kind:'preposition',meaning:'at / to / in (cities)',tip:'With city names, à is usual: j’habite à Londres.',example:'J’habite à Londres.'},
 'en':{kind:'preposition',meaning:'in / to, among other uses',tip:'Often used with feminine countries: en France. Exact usage depends on the phrase.',example:'J’habite en France.'},
 'avec':{kind:'preposition',meaning:'with',tip:'Marks company or accompaniment.',example:'Je parle avec un ami.'},
 'un':{kind:'article',meaning:'a / an (masculine)',tip:'Un appartement, un ami. French nouns have grammatical gender.',example:'Un petit appartement.'},
 'une':{kind:'article',meaning:'a / an (feminine)',tip:'Une maison, une vidéo. French nouns have grammatical gender.',example:'Une grande maison.'},
 'le':{kind:'article',meaning:'the (masculine)',tip:'Le français. With a vowel sound, le often becomes l’.',example:'Le français est utile.'},
 'la':{kind:'article',meaning:'the (feminine)',tip:'La maison, la musique. With a vowel sound, la often becomes l’.',example:'La musique est intéressante.'},
 'petit':{kind:'adjective',meaning:'small (masculine)',tip:'Une petite maison is feminine; un petit appartement is masculine.',example:'Un petit appartement.'},
 'petite':{kind:'adjective',meaning:'small (feminine)',tip:'The feminine adjective usually adds a written e here, and the final t is pronounced.',example:'Une petite maison.'},
 'grand':{kind:'adjective',meaning:'big / large (masculine)',tip:'Grand becomes grande with a feminine noun.',example:'Un grand appartement.'},
 'grande':{kind:'adjective',meaning:'big / large (feminine)',tip:'Grande agrees with maison (feminine). Compare un grand appartement.',example:'Une grande maison.'},
 'appartement':{kind:'noun',meaning:'flat / apartment (masculine)',tip:'Un appartement. With habiter, you can say j’habite un appartement or j’habite dans un appartement.',example:"J'habite un petit appartement."},
 'maison':{kind:'noun',meaning:'house (feminine)',tip:'Une maison. Its ai is usually /ɛ/, and on is a nasal vowel.',example:'Je préfère une grande maison.'},
 'français':{kind:'noun / adjective',meaning:'French (language or masculine adjective)',tip:'Le français is the French language; française is the feminine adjective.',example:"J'apprends le français."},
 'musique':{kind:'noun',meaning:'music (feminine)',tip:'De la musique: the article is part of the natural expression écouter de la musique.',example:"J'écoute de la musique."},
 'utile':{kind:'adjective',meaning:'useful',tip:'The written adjective utile has the same form for masculine and feminine.',example:"C'est utile."},
 'difficile':{kind:'adjective',meaning:'difficult',tip:'Same written form in masculine and feminine singular.',example:"C'est difficile."},
 'intéressant':{kind:'adjective',meaning:'interesting (masculine)',tip:'The feminine is intéressante; the final written t of intéressant is normally silent.',example:"C'est intéressant."},
 'confortable':{kind:'adjective',meaning:'comfortable',tip:'Same written form in masculine and feminine singular.',example:"C'est confortable."},
 'hier':{kind:'time word',meaning:'yesterday',tip:'Often introduces a past-tense sentence.',example:"Hier, j'ai parlé français."},
 'demain':{kind:'time word',meaning:'tomorrow',tip:'Its ain has a nasal vowel. Often introduces future meaning.',example:'Demain, je vais parler français.'},
 'maintenant':{kind:'time word',meaning:'now',tip:'Useful when contrasting past and present.',example:'Maintenant, je parle français.'}
};
const normalise=s=>String(s??'').normalize('NFC').toLocaleLowerCase('fr').replace(/[’‘]/g,"'").trim();
const verbForms=new Map();
for(const entry of Object.values(VERBS)){
 for(let i=0;i<entry.forms.length;i++){
  const key=normalise(entry.forms[i]);
  if(!verbForms.has(key))verbForms.set(key,{entry,formKind:'present',personIndex:i});
 }
 verbForms.set(normalise(entry.lemma),{entry,formKind:'infinitive',personIndex:null});
}
verbForms.set('faut',{entry:VERBS.falloir,formKind:'impersonal present',personIndex:null,
  explain:'Il faut is the present of falloir; it normally appears only with il.'});
for(const [spelling,[lemma,formKind,explain]] of Object.entries(EXTRA_FORMS)){
 verbForms.set(normalise(spelling),{entry:VERBS[lemma],formKind,personIndex:null,explain});
}
export function lookupFrenchWord(surface){
 const original=String(surface||'');
 let key=normalise(original);
 if(key==='il faut')return {type:'verb',surface:original,matched:'faut',entry:VERBS.falloir,
   formKind:'impersonal present',personIndex:null};
 if(WORD_NOTES[key])return {type:'note',surface:original,key,...WORD_NOTES[key]};
 if(!verbForms.has(key)){
   // Handle common elisions, preserving the actual surface form in the UI.
   const m=key.match(/^(?:j|c|l|qu|d|n|s|m|t)'(.+)$/);
   if(m)key=m[1];
 }
 if(verbForms.has(key)){
  const value=verbForms.get(key);
  return {type:'verb',surface:original,matched:key,...value};
 }
 if(WORD_NOTES[key])return {type:'note',surface:original,key,...WORD_NOTES[key]};
 return null;
}
// Precedence: multiword teaching chunks first; then elisions as single tappable units.
// Preserves every original character, gap, punctuation and accent in the result.
const TOKENS=/(parce\s+que|à\s+mon\s+avis|il\s+faut|bien\s+que|d['’]abord|[\p{L}\p{M}]+(?:['’][\p{L}\p{M}]+)*)/giu;
export function tokenizeFrench(text){
 const source=String(text||'');
 const out=[];let cursor=0;
 for(const match of source.matchAll(TOKENS)){
  const start=match.index??0;
  if(start>cursor)out.push({text:source.slice(cursor,start),info:null});
  const token=match[0];
  out.push({text:token,info:lookupFrenchWord(token)});
  cursor=start+token.length;
 }
 if(cursor<source.length)out.push({text:source.slice(cursor),info:null});
 return out;
}
