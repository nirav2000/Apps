const raw=[
  [
    "sai-pets",
    "Pets",
    [
      "J’ai un chien|I have a dog",
      "J’ai un chat|I have a cat",
      "J’ai un lapin|I have a rabbit",
      "J’ai un cheval|I have a horse",
      "J’ai un oiseau|I have a bird",
      "J’ai un poisson|I have a fish",
      "J’ai un hamster|I have a hamster",
      "J’ai une souris|I have a mouse"
    ],
    [
      "Tu as un lapin|You have a rabbit",
      "Il a un chien|He has a dog"
    ]
  ],
  [
    "sai-colours",
    "Pets and colours",
    [
      "un serpent vert|a green snake",
      "un chien noir|a black dog",
      "une souris blanche|a white mouse",
      "un poisson rouge|a red fish",
      "un oiseau bleu|a blue bird",
      "un chat brun|a brown cat",
      "un hamster jaune|a yellow hamster",
      "un cochon d’Inde gris|a grey guinea pig"
    ],
    [
      "un lapin gris|a grey rabbit",
      "une souris verte|a green mouse"
    ]
  ],
  [
    "sai-avoir",
    "Avoir",
    [
      "j’ai|I have",
      "tu as|you have (singular)",
      "il a|he has",
      "elle a|she has",
      "nous avons|we have",
      "vous avez|you have (plural)",
      "ils ont|they have (masculine)",
      "elles ont|they have (feminine)"
    ],
    [
      "Nous avons un chat|We have a cat",
      "Elles ont un lapin|They (feminine) have a rabbit"
    ]
  ],
  [
    "sai-opinions",
    "Opinions",
    [
      "J’aime les chiens|I like dogs",
      "J’adore les chats|I love cats",
      "Je préfère les lapins|I prefer rabbits",
      "Je déteste les serpents|I hate snakes",
      "Je n’aime pas les souris|I do not like mice",
      "J’aime les chevaux|I like horses",
      "J’adore les oiseaux|I love birds",
      "Je préfère les poissons rouges|I prefer goldfish"
    ],
    [
      "Je déteste les chats|I hate cats",
      "Je préfère les chiens|I prefer dogs"
    ]
  ],
  [
    "sai-greetings",
    "Greetings and feelings",
    [
      "Comment ça va ?|How are you?",
      "Ça va bien|I am well",
      "Ça va très bien|I am very well",
      "Je suis malade|I am ill",
      "Je suis fatigué|I am tired (male)",
      "Bonjour|Hello",
      "Merci|Thank you",
      "Au revoir|Goodbye"
    ],
    [
      "Je suis fatiguée|I am tired (female)",
      "Bonjour, comment ça va ?|Hello, how are you?"
    ]
  ],
  [
    "sai-classroom",
    "Classroom French",
    [
      "J’ai oublié mes devoirs|I forgot my homework",
      "J’ai perdu mon cahier|I lost my exercise book",
      "Je voudrais de la colle|I would like some glue",
      "Mon stylo ne marche pas|My pen does not work",
      "Pouvez-vous répéter ?|Can you repeat?",
      "Je ne comprends pas|I do not understand",
      "J’ai besoin d’aide|I need help",
      "J’ai fini|I have finished"
    ],
    [
      "J’ai oublié mon stylo|I forgot my pen",
      "J’ai perdu mes devoirs|I lost my homework"
    ]
  ],
  [
    "sai-days",
    "Days of the week",
    [
      "lundi|Monday",
      "mardi|Tuesday",
      "mercredi|Wednesday",
      "jeudi|Thursday",
      "vendredi|Friday",
      "samedi|Saturday",
      "dimanche|Sunday",
      "Aujourd’hui, c’est lundi|Today is Monday"
    ],
    [
      "Aujourd’hui, c’est jeudi|Today is Thursday",
      "Aujourd’hui, c’est dimanche|Today is Sunday"
    ]
  ],
  [
    "sai-months",
    "Months",
    [
      "janvier|January",
      "février|February",
      "mars|March",
      "avril|April",
      "mai|May",
      "juin|June",
      "juillet|July",
      "août|August",
      "septembre|September",
      "octobre|October",
      "novembre|November",
      "décembre|December"
    ],
    [
      "en mars|in March",
      "en octobre|in October"
    ]
  ],
  [
    "sai-dates",
    "Dates and birthdays",
    [
      "le deux janvier|the second of January",
      "le quatorze mars|the fourteenth of March",
      "le vingt juillet|the twentieth of July",
      "le quinze avril|the fifteenth of April",
      "le dix-huit octobre|the eighteenth of October",
      "le premier mai|the first of May",
      "le trois juin|the third of June",
      "le dix août|the tenth of August"
    ],
    [
      "le quinze mars|the fifteenth of March",
      "le vingt octobre|the twentieth of October"
    ]
  ],
  [
    "sai-questions",
    "Asking questions",
    [
      "Tu aimes les chiens ?|Do you like dogs? (informal)",
      "Est-ce que tu aimes les chiens ?|Do you like dogs?",
      "Est-ce que tu as un chat ?|Do you have a cat?",
      "Est-ce que je peux aller aux toilettes ?|May I go to the toilet?",
      "Est-ce que je peux aller à un cours de musique ?|May I go to a music lesson?",
      "Est-ce qu’il y a un challenge ?|Is there a challenge?",
      "Comment dit-on chien en français ?|How do you say dog in French?",
      "Je ne sais pas|I do not know"
    ],
    [
      "Est-ce que tu as un lapin blanc ?|Do you have a white rabbit?",
      "Est-ce que tu aimes les chats ?|Do you like cats?"
    ]
  ]
];
export const SAI_UNITS=raw.map(([id,name,pairs,transfer],i)=>({id,name,track:'sai',label:'Sai '+(i+1),goal:'Recall and use '+name.toLowerCase()+' independently.',verbs:[],structures:[],rows:pairs.map((p,j)=>{const [fr,en]=p.split('|');return {fr,en,id:name,verbId:id,concept:'french:'+id+':'+j}}),soundFocus:{word:pairs[0].split('|')[0],spelling:'',note:'Listen and repeat carefully.'},bridge:{fr:pairs[0].split('|')[0],en:pairs[0].split('|')[1],point:'Notice the complete expression.'},transfer:transfer.map(p=>[...p.split('|'),'recombine'])}));
