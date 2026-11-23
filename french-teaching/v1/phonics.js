// Sound-first French phonics for the Next course.
// Curated examples, not a grapheme-to-phoneme synthesiser.
// All listening uses French (fr-FR) device speech; scores measure recognition only.
export const SOUND_VERSION='1.0.0';
export const LETTER_IPA={
 A:'/a/',B:'/be/',C:'/se/',D:'/de/',E:'/ə/',F:'/ɛf/',G:'/ʒe/',H:'/aʃ/',I:'/i/',J:'/ʒi/',
 K:'/ka/',L:'/ɛl/',M:'/ɛm/',N:'/ɛn/',O:'/o/',P:'/pe/',Q:'/ky/',R:'/ɛʁ/',S:'/ɛs/',T:'/te/',
 U:'/y/',V:'/ve/',W:'/dublə ve/',X:'/iks/',Y:'/i ɡʁɛk/',Z:'/zɛd/'
};
export const LETTER_NAME_GROUPS=[
 {id:'e-ending',title:'Names ending in é',letters:['B','C','D','G','P','T','V'],
  note:'These names finish with the /e/ sound, although their opening consonants differ. Compare bé, cé, dé and gé.'},
 {id:'eh-start',title:'Names starting with è',letters:['F','L','M','N','R','S'],
  note:'These names begin with an /ɛ/ sound: effe, elle, emme, enne, erre and esse.'},
 {id:'vowels',title:'Vowel letter names',letters:['A','E','I','O','U'],
  note:'A, E, I, O, U: learn their names, then notice that a vowel can have several sounds inside words.'},
 {id:'remaining',title:'Distinctive names',letters:['H','J','K','Q','W','X','Y','Z'],
  note:'These have distinctive names. Notice that Q is cu, U is u, Y is i grec and W is double vé.'}
];

export const SOUND_FAMILIES=[
 {id:'vowel-contrasts',title:'Hear the vowel differences',intro:'French u and ou are different. French eu also has two common sounds. Do not rely on English spelling.',
  sounds:[
   {id:'u',spell:'u',ipa:'/y/',examples:['tu','lune','utile'],sentence:"J'aime le français parce que c'est utile.",
    clue:'Keep the tongue high as for ee, then round the lips. This is not the English oo sound.',
    compare:['tu','tout']},
   {id:'ou',spell:'ou',ipa:'/u/',examples:['vous','jour','tout'],sentence:'Je pratique chaque jour.',
    clue:'The ou in vous and jour is closer to English oo. Compare it with the rounded French u.',
    compare:['tu','tout']},
   {id:'eu-close',spell:'eu · œu',ipa:'/ø/',examples:['veux','deux','peu'],sentence:'Je veux apprendre, donc je pratique chaque jour.',
    clue:'In veux and deux, eu is a close rounded vowel. Keep it distinct from the vowel in peur.',
    compare:['peu','peur']},
   {id:'eu-open',spell:'eu · œu',ipa:'/œ/',examples:['peur','jeune','sœur'],sentence:"J'aime apprendre.",
    clue:'The more open vowel in peur and jeune is not the same as the one in veux.',
    compare:['peu','peur']},
   {id:'e-closed',spell:'é · -er · -ez',ipa:'/e/',examples:['parlé','été','parler'],sentence:"Hier, j'ai parlé français avec un ami.",
    clue:'The é of parlé normally has a clear /e/ sound. Infinitive -er and verb -ez often share it.',
    compare:['été','était']},
   {id:'e-open',spell:'è · ê · ai',ipa:'/ɛ/ (often)',examples:['préfère','mais','tête'],sentence:"J'habite un petit appartement, mais je préfère une grande maison.",
    clue:'The vowel in mais and préfère is more open than the é in parlé. Ai changes sound in some forms, e.g. j’ai /e/.',
    compare:['été','était']}
  ]},
 {id:'useful-combinations',title:'Common vowel combinations',intro:'Spot these groups inside sentences. One sound may have several spellings.',
  sounds:[
   {id:'oi',spell:'oi',ipa:'/wa/',examples:['moi','soir','trois'],sentence:"J'étudie aussi le soir.",
    clue:'Oi is typically pronounced as one /wa/ sound, not as the names of O and I.',
    compare:['moi','mou']},
   {id:'o-variants',spell:'au · eau · o',ipa:'/o/ (in these examples)',examples:['aussi','beau','chaud'],sentence:"J'étudie aussi le soir.",
    clue:'Au and eau often give /o/. The written o can also sound /ɔ/ in other words.',
    compare:['beau','bon']},
   {id:'ai-ei',spell:'ai · ei',ipa:'/ɛ/ or /e/ depending on word',examples:['mais','maison','peine'],sentence:"J'habite un petit appartement, mais je préfère une grande maison.",
    clue:'Mais and maison start with the more open /ɛ/; j’ai is normally /ʒe/. Learn each in context.',
    compare:['mais','mes']},
   {id:'silent-final',spell:'Final silent letters',ipa:'depends on the word',examples:['petit','grand','parlent'],sentence:"J'habite un petit appartement.",
    clue:'Many final consonants, such as the t in petit, are normally silent. There are exceptions: do not delete every final letter.',
    compare:['petit','petite']}
  ]},
 {id:'nasal-vowels',title:'Nasal vowel families',intro:'With many vowels followed by n or m, the vowel is nasal and n/m is not pronounced separately.',
  sounds:[
   {id:'an-en',spell:'an · en · am · em',ipa:'/ɑ̃/',examples:['grand','enfant','dans'],sentence:"J'habite un petit appartement, mais je préfère une grande maison.",
    clue:'Let air flow through your nose as you pronounce the vowel. Compare grand with grande.',
    compare:['grand','grande']},
   {id:'on-om',spell:'on · om',ipa:'/ɔ̃/',examples:['bon','non','maison'],sentence:"J'habite un petit appartement, mais je préfère une grande maison.",
    clue:'The n is not spoken separately in bon. In bonne it is, so the sound changes.',
    compare:['bon','bonne']},
   {id:'in-ain-ein',spell:'in · ain · ein',ipa:'/ɛ̃/',examples:['vin','pain','demain'],sentence:'Demain, je vais regarder une vidéo en français.',
    clue:'Vin, pain and the final syllable of demain share a common nasal vowel.',
    compare:['pain','pan']},
   {id:'un',spell:'un · um',ipa:'/œ̃/ (varies by accent)',examples:['un','lundi','parfum'],sentence:'J’habite un petit appartement.',
    clue:'Some speakers distinguish this vowel from in; many modern accents merge them. Both are normal.',
    compare:['un','pain']}
  ]},
 {id:'consonants',title:'Consonants that change',intro:'One letter may have different sounds depending on what follows it.',
  sounds:[
   {id:'ch',spell:'ch',ipa:'/ʃ/ (usually)',examples:['chat','chercher','chaud'],sentence:'Je cherche un petit appartement.',
    clue:'Often the sh-like sound. Some learned words are exceptions.',
    compare:['chat','ça']},
   {id:'gn',spell:'gn',ipa:'/ɲ/',examples:['montagne','ligne','gagner'],sentence:'Je regarde la montagne.',
    clue:'The two letters usually create a single palatal nasal sound, as in montagne.',
    compare:['ligne','lire']},
   {id:'qu',spell:'qu',ipa:'/k/ (usually)',examples:['que','quand','question'],sentence:"J'aime le français parce que c'est utile.",
    clue:'In common que, quand and question, the u is not pronounced separately.',
    compare:['que','jeu']},
   {id:'c',spell:'c + e/i versus c + a/o/u',ipa:'/s/ versus /k/',examples:['cinéma','café','ce'],sentence:'Je pratique chaque jour.',
    clue:'C before e/i usually says /s/; c before a/o/u normally says /k/. Ç keeps /s/ in garçon.',
    compare:['café','cinéma']},
   {id:'g',spell:'g + e/i versus g + a/o/u',ipa:'/ʒ/ versus /g/',examples:['girafe','gare','génial'],sentence:'Je regarde une vidéo.',
    clue:'G before e/i is usually soft, as in girafe; before a/o/u it is usually hard, as in gare.',
    compare:['girafe','gare']},
   {id:'ill',spell:'-ill- / -ille',ipa:'/j/ in these words',examples:['travaille','fille','famille'],sentence:'Je travaille et j’écoute de la musique.',
    clue:'Often a y-like sound, as in travaille and fille. Ville is an important exception: /vil/.',
    compare:['fille','ville']},
   {id:'liaison',spell:'liaison ‿',ipa:'connecting consonant',examples:['les amis','vous avez','un ami'],sentence:"Hier, j'ai parlé français avec un ami.",
    clue:'A normally silent consonant may link into the next word. In les amis, the s sounds /z/. Never force liaison everywhere.',
    compare:['les amis','les maisons']}
  ]}
];

export const SOUND_QUIZ=[
 {id:'u-ou',target:'tu',options:['tu','tout','toi'],correct:'tu',concept:'french:phonics:u-ou',why:'French u in tu is /y/; ou in tout is /u/.'},
 {id:'ou-u',target:'tout',options:['tout','tu','tôt'],correct:'tout',concept:'french:phonics:u-ou',why:'Tout uses ou, pronounced /u/. It differs from the French u in tu.'},
 {id:'eu-open',target:'peur',options:['peur','peu','pour'],correct:'peur',concept:'french:phonics:eu',why:'Peur has an open /œ/; peu has the closer /ø/.'},
 {id:'eu-close',target:'peu',options:['peu','peur','pour'],correct:'peu',concept:'french:phonics:eu',why:'Peu normally has /ø/, unlike the open /œ/ in peur.'},
 {id:'oi',target:'moi',options:['moi','mou','ma'],correct:'moi',concept:'french:phonics:oi',why:'Oi has /wa/ in moi.'},
 {id:'ai',target:'mais',options:['mais','mes','mou'],correct:'mais',concept:'french:phonics:ai',why:'Mais has /ɛ/; mes has /e/. Local pronunciation can vary.'},
 {id:'e-accent',target:'été',options:['été','était','tête'],correct:'été',concept:'french:phonics:accents',why:'É often corresponds to /e/. Était ends in /ɛ/ for most speakers.'},
 {id:'nasal-on',target:'bon',options:['bon','beau','bonne'],correct:'bon',concept:'french:phonics:nasal-on',why:'Bon has nasal /ɔ̃/; bonne ends with a pronounced n.'},
 {id:'nasal-an',target:'grand',options:['grand','grande','grain'],correct:'grand',concept:'french:phonics:nasal-an',why:'Grand has a nasal /ɑ̃/ and silent d; grande pronounces the d.'},
 {id:'nasal-in',target:'pain',options:['pain','pan','pont'],correct:'pain',concept:'french:phonics:nasal-in',why:'Pain uses nasal /ɛ̃/; pan and pont use different nasal vowels.'},
 {id:'sh-ch',target:'chat',options:['chat','ça','chou'],correct:'chat',concept:'french:phonics:ch',why:'Ch makes /ʃ/ in chat, not the /s/ of ça.'},
 {id:'soft-g',target:'girafe',options:['girafe','gare','griffe'],correct:'girafe',concept:'french:phonics:g',why:'G before i is soft (/ʒ/) in girafe.'}
];

export const CUDDLES_DEMOS=[
 {id:'appartement',word:'appartement',description:'11 letters. Double underline pp; underline en as a nasal vowel; dot the final silent t.',
  pieces:[['a','normal'],['pp','double'],['artem','normal'],['en','vowel'],['t','silent']]},
 {id:'petit',word:'petit',description:'Five letters. The final t is normally silent.',
  pieces:[['peti','normal'],['t','silent']]},
 {id:'maison',word:'maison',description:'Six letters. Underline ai and on. The s between vowels sounds /z/.',
  pieces:[['m','normal'],['ai','vowel'],['s','normal'],['on','vowel']]},
 {id:'prefere',word:'préfère',description:'Seven letters. É is /e/ and è is /ɛ/: mark the difference.',
  pieces:[['pr','normal'],['é','accent'],['f','normal'],['è','accent'],['re','normal']]},
 {id:'liaison',word:'les amis',description:'The written s links to amis and is pronounced /z/ in this liaison.',
  pieces:[['les','normal'],['‿','liaison'],['amis','normal']]}
];
export const soundById=id=>SOUND_FAMILIES.flatMap(g=>g.sounds).find(s=>s.id===id)||null;
