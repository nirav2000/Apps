// Original reusable French structures inspired by Jessica Lund's description
// of Michaela's "Magic 10"; these are NOT an official or verbatim Michaela list.
// Text is authored for this course. Do not auto-conjugate arbitrary dictionary verbs.
export const MAGIC10_VERSION='2.0.0';
export const MAGIC10_STRUCTURE_IDS=Object.freeze([
  'infinitive','like','want','present','negative','can','must','near-future','past','polite'
]);
export const MAGIC10_STRUCTURES=Object.freeze([
  {id:'infinitive',name:'Action',cue:'to …',family:'Base'},
  {id:'like',name:'Give an opinion',cue:'I like to …',family:'Opinion'},
  {id:'want',name:'Say what you want',cue:'I want to …',family:'Opinion'},
  {id:'present',name:'Say what you do',cue:'I …',family:'Present'},
  {id:'negative',name:'Say what you do not do',cue:"I don't …",family:'Present'},
  {id:'can',name:'Say what you can do',cue:'I can …',family:'Present'},
  {id:'must',name:'Say what you must do',cue:'I must …',family:'Present'},
  {id:'near-future',name:'Talk about a plan',cue:"I'm going to …",family:'Future'},
  {id:'past',name:'Talk about a completed action',cue:'I … yesterday',family:'Past'},
  {id:'polite',name:'Say what you would like',cue:'I would like to …',family:'Opinion'}
]);

// Every phrase in this small set is curated, including the irregular past
// participle of lire and the elisions after je/ne. Preserve the complements:
// e.g. écouter la radio, not the incorrect "écouter à la radio".
export const MAGIC10_VERBS=Object.freeze({
  parler:{lemma:'parler',action:'parler français',english:'speak French',present:'parle',
    past:'parlé',pastEnglish:'spoke French',complement:'français',elide:false},
  écouter:{lemma:'écouter',action:'écouter la radio',english:'listen to the radio',present:'écoute',
    past:'écouté',pastEnglish:'listened to the radio',complement:'la radio',elide:true},
  étudier:{lemma:'étudier',action:'étudier le français',english:'study French',present:'étudie',
    past:'étudié',pastEnglish:'studied French',complement:'le français',elide:true},
  habiter:{lemma:'habiter',action:'habiter à Londres',english:'live in London',present:'habite',
    past:'habité',pastEnglish:'lived in London',complement:'à Londres',elide:true},
  travailler:{lemma:'travailler',action:'travailler le soir',english:'work in the evening',present:'travaille',
    past:'travaillé',pastEnglish:'worked in the evening',complement:'le soir',elide:false},
  regarder:{lemma:'regarder',action:'regarder la télévision',english:'watch television',present:'regarde',
    past:'regardé',pastEnglish:'watched television',complement:'la télévision',elide:false},
  pratiquer:{lemma:'pratiquer',action:'pratiquer le français',english:'practise French',present:'pratique',
    past:'pratiqué',pastEnglish:'practised French',complement:'le français',elide:false},
  lire:{lemma:'lire',action:'lire en français',english:'read in French',present:'lis',
    past:'lu',pastEnglish:'read in French (past)',complement:'en français',elide:false}
});
const one=(v,prefix)=>prefix+(v.complement?' '+v.complement:'');
const frPhrase=(v,id)=>{
  switch(id){
    case 'infinitive':return v.action;
    case 'like':return 'j’aime '+v.action;
    case 'want':return 'je veux '+v.action;
    case 'present':return one(v,(v.elide?"j'":'je ')+v.present);
    case 'negative':return one(v,(v.elide?"je n'":'je ne ')+v.present+' pas');
    case 'can':return 'je peux '+v.action;
    case 'must':return 'je dois '+v.action;
    case 'near-future':return 'je vais '+v.action;
    case 'past':return one(v,"j'ai "+v.past);
    case 'polite':return 'je voudrais '+v.action;
    default:throw Error('Unknown Magic 10 structure '+id);
  }
};
const englishPhrase=(v,id)=>{
  switch(id){
    case 'infinitive':return 'to '+v.english;
    case 'like':return 'I like to '+v.english;
    case 'want':return 'I want to '+v.english;
    case 'present':return 'I '+v.english;
    case 'negative':return "I don't "+v.english;
    case 'can':return 'I can '+v.english;
    case 'must':return 'I must '+v.english;
    case 'near-future':return "I'm going to "+v.english;
    case 'past':return 'I '+v.pastEnglish;
    case 'polite':return 'I would like to '+v.english;
    default:throw Error('Unknown structure '+id);
  }
};
export function magicTenFor(verbId='parler'){
  const verb=MAGIC10_VERBS[verbId];
  if(!verb)throw Error('Magic 10 phrases require a specifically reviewed verb');
  return MAGIC10_STRUCTURES.map((s,index)=>Object.freeze({
    id:s.id,index,verbId,lemma:verb.lemma,kind:s.name,family:s.family,
    cue:s.cue,fr:frPhrase(verb,s.id),en:englishPhrase(verb,s.id),
    concept:'french:magic10:'+verbId+':'+s.id
  }));
}
export function magicTenPhrase(verbId,structureId){
  const row=magicTenFor(verbId).find(x=>x.id===structureId);
  if(!row)throw Error('Unsupported curated French structure');
  return row;
}
export function magicTenUnitHints(){
  return [
    {id:'infinitive',note:'This is the useful action phrase. We use it after je veux, je peux and je vais.'},
    {id:'present',note:'This says what I do now or usually. Je becomes j’ before a vowel sound.'},
    {id:'negative',note:'In written French, ne / n’ comes before the verb and pas after it.'},
    {id:'near-future',note:'Je vais + infinitive describes a plan or a near-future action.'},
    {id:'past',note:"J’ai + past participle describes a completed action for these curated verbs. Other verbs may use être instead."},
    {id:'polite',note:'Je voudrais + infinitive is a polite wish, not a simple future.'}
  ];
}


// The optional explorer shows irregular verbs only from explicit, reviewed
// examples. Never infer a verb's future, past or auxiliary from spelling.
export const CURATED_IRREGULAR_TIMELINES=Object.freeze({
  devoir:[
    {kind:'Present',fr:'je dois étudier',en:'I must study / I have to study'},
    {kind:'Imperfect past',fr:'je devais étudier',en:'I had to study / used to have to study'},
    {kind:'Completed past',fr:"j'ai dû étudier",en:'I had to study'},
    {kind:'Near future',fr:'je vais devoir étudier',en:'I am going to have to study'},
    {kind:'Simple future',fr:'je devrai étudier',en:'I will have to study'},
    {kind:'Conditional',fr:'je devrais étudier',en:'I should study / I would have to study'}
  ],
  vouloir:[
    {kind:'Present',fr:'je veux apprendre',en:'I want to learn'},
    {kind:'Imperfect past',fr:'je voulais apprendre',en:'I wanted to learn / used to want to learn'},
    {kind:'Completed past',fr:"j'ai voulu apprendre",en:'I wanted to learn (completed action)'},
    {kind:'Simple future',fr:'je voudrai apprendre',en:'I will want to learn'},
    {kind:'Polite conditional',fr:'je voudrais apprendre',en:'I would like to learn'}
  ],
  aller:[
    {kind:'Present',fr:'je vais à Londres',en:'I go / am going to London'},
    {kind:'Completed past',fr:'je suis allé à Londres',en:'I went to London (masculine speaker; feminine allée)'},
    {kind:'Near future',fr:'je vais aller à Londres',en:'I am going to go to London'},
    {kind:'Simple future',fr:"j'irai à Londres",en:'I will go to London'}
  ],
  avoir:[
    {kind:'Present',fr:"j'ai le temps",en:'I have time'},
    {kind:'Completed past',fr:"j'ai eu le temps",en:'I had time'},
    {kind:'Simple future',fr:"j'aurai le temps",en:'I will have time'},
    {kind:'Conditional',fr:"j'aurais le temps",en:'I would have time'}
  ],
  être:[
    {kind:'Present',fr:'je suis prêt',en:'I am ready (masculine speaker; feminine prête)'},
    {kind:'Completed past',fr:"j'ai été prêt",en:'I was ready (masculine speaker; feminine prête)'},
    {kind:'Simple future',fr:'je serai prêt',en:'I will be ready (masculine speaker; feminine prête)'},
    {kind:'Conditional',fr:'je serais prêt',en:'I would be ready (masculine speaker; feminine prête)'}
  ],
  faire:[
    {kind:'Present',fr:'je fais une erreur',en:'I make a mistake'},
    {kind:'Completed past',fr:"j'ai fait une erreur",en:'I made a mistake'},
    {kind:'Near future',fr:'je vais faire un effort',en:'I am going to make an effort'},
    {kind:'Simple future',fr:'je ferai un effort',en:'I will make an effort'}
  ]
});
export function optionalVerbTimeline(lemma){
  return CURATED_IRREGULAR_TIMELINES[lemma]||(
    Object.hasOwn(MAGIC10_VERBS,lemma)?magicTenFor(lemma).map(x=>({
      kind:x.kind,fr:x.fr,en:x.en
    })):null);
}
