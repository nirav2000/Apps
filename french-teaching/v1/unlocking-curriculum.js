// Original exercises informed by Paul Noble's general teaching principles; no book text reproduced.
const raw=[
  [
    "unlock-cognates",
    "Recognise familiar words",
    [
      "C’est pratique|It is practical",
      "C’est magnifique|It is magnificent",
      "C’est normal|It is normal",
      "C’est possible|It is possible",
      "C’est urgent|It is urgent",
      "C’est différent|It is different",
      "C’est intéressant|It is interesting",
      "C’est une invitation|It is an invitation",
      "C’est logique|It is logical",
      "C’est typique|It is typical",
      "C’est une information|It is a piece of information",
      "C’est important|It is important",
      "C’est une situation|It is a situation"
    ],
    [
      "C’est une information importante|It is an important piece of information",
      "C’est une situation normale|It is a normal situation"
    ],
    "Notice practical → pratique, logical → logique, typical → typique and invitation → invitation. The ending -ique sounds like “eek”. Cognates help you guess meaning, but not every English ending converts. In une information importante, the adjective agrees with the feminine noun."
  ],
  [
    "unlock-past",
    "Build past-tense sentences",
    [
      "préparer|to prepare",
      "j’ai préparé|I prepared",
      "J’ai préparé le déjeuner|I prepared lunch",
      "J’ai visité le château|I visited the castle",
      "J’ai organisé une réunion|I organised a meeting",
      "J’ai réservé une chambre|I booked a room",
      "J’ai terminé le travail|I finished the work",
      "J’ai changé le billet|I changed the ticket",
      "J’ai acheté un livre|I bought a book",
      "J’ai oublié mon sac|I forgot my bag",
      "J’ai visité le musée|I visited the museum",
      "J’ai préparé le repas|I prepared the meal",
      "J’ai réservé une table|I booked a table"
    ],
    [
      "J’ai préparé le travail|I prepared the work",
      "J’ai réservé un billet|I booked a ticket"
    ],
    "Start with préparer (to prepare), then j’ai préparé (I prepared), then add an object. Reuse j’ai with each past participle. Most regular -er verbs take -é, which sounds like -er. This is not the rule for every verb."
  ],
  [
    "unlock-people",
    "Talk about other people",
    [
      "Tu as préparé le dîner|You prepared dinner (informal)",
      "Il a visité le musée|He visited the museum",
      "Elle a organisé la fête|She organised the party",
      "Nous avons réservé une table|We booked a table",
      "Vous avez changé le billet|You changed the ticket (formal or plural)",
      "Ils ont terminé le travail|They finished the work (masculine)",
      "Elles ont acheté des livres|They bought books (feminine)",
      "J’ai visité le musée|I visited the museum"
    ],
    [
      "Elle a réservé une table|She booked a table",
      "Nous avons visité le musée|We visited the museum"
    ],
    "Change the helping verb with the person; the regular past participle remains the same in these examples."
  ],
  [
    "unlock-plans",
    "Plans, wishes and possibilities",
    [
      "Je veux visiter le musée|I want to visit the museum",
      "Je peux réserver une chambre|I can book a room",
      "Je dois terminer le travail|I must finish the work",
      "Je voudrais acheter un billet|I would like to buy a ticket",
      "Je vais préparer le dîner|I am going to prepare dinner",
      "Je ne veux pas attendre|I do not want to wait",
      "Je ne peux pas venir|I cannot come",
      "Je ne dois pas oublier|I must not forget",
      "attendre|to wait",
      "venir|to come"
    ],
    [
      "Je vais réserver une chambre|I am going to book a room",
      "Je voudrais visiter le musée|I would like to visit the museum"
    ],
    "The ending -ais in voudrais sounds like an open e. After veux, peux, dois, voudrais and vais, use the infinitive. Keep ne and pas around the first verb."
  ],
  [
    "unlock-help",
    "Questions and everyday needs",
    [
      "J’ai besoin d’aide|I need help",
      "J’ai besoin d’un billet|I need a ticket",
      "Je voudrais un verre d’eau|I would like a glass of water",
      "Je cherche la gare|I am looking for the station",
      "Je suis en retard|I am late",
      "Je ne comprends pas|I do not understand",
      "Est-ce que vous pouvez répéter ?|Can you repeat? (formal)",
      "Où est le musée ?|Where is the museum?"
    ],
    [
      "Je cherche le musée|I am looking for the museum",
      "Où est la gare ?|Where is the station?"
    ],
    "Use short complete requests, then swap in a familiar noun."
  ],
  [
    "unlock-time",
    "Actions in progress and explanations",
    [
      "J’allais partir|I was going to leave",
      "J’allais téléphoner|I was going to call",
      "J’étais en train de travailler|I was in the middle of working",
      "J’étais en train de préparer le dîner|I was in the middle of preparing dinner",
      "Tu as téléphoné|You called (informal)",
      "Tu es arrivé|You arrived (male, informal)",
      "Tu es arrivée|You arrived (female, informal)",
      "Je suis arrivé|I arrived (male speaker)",
      "Je suis arrivée|I arrived (female speaker)",
      "Je reste ici parce que c’est pratique|I am staying here because it is practical"
    ],
    [
      "J’allais partir quand tu as téléphoné|I was going to leave when you called",
      "Je reste ici parce que c’est magnifique|I am staying here because it is magnificent"
    ],
    "J’allais + infinitive expresses a plan in the past. J’étais en train de + infinitive describes an ongoing action; quand introduces an event that may interrupt it. Arriver uses être here; arrivé/arrivée agrees with the subject."
  ]
];
const sounds={'unlock-cognates':['logique','ique'],'unlock-past':['préparé','é'],'unlock-people':['vous avez','liaison'],'unlock-plans':['voudrais','ais'],'unlock-help':['besoin','oin'],'unlock-time':['arrivée','ée']};
export const UNLOCKING_UNITS=raw.map(([id,name,pairs,transfer,note],i)=>{const [word,spelling]=sounds[id];return {id,name,track:'unlocking',label:'Lesson '+(i+1),goal:'Build useful French by reusing familiar patterns.',verbs:[],structures:[],rows:pairs.map((p,j)=>{const [fr,en]=p.split('|');return {fr,en,id,verbId:id,concept:'french:'+id+':'+j,hint:note}}),soundFocus:{word,spelling,note},bridge:{fr:pairs[0].split('|')[0],en:pairs[0].split('|')[1],point:note},transfer:transfer.map(p=>[...p.split('|'),'recombine'])};});
