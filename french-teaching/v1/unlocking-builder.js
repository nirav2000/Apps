// Original incremental companion. The teaching method is informed by Paul
// Noble's cover/retrieve/recombine approach; no publisher script is reproduced.
// A block is one new word or useful grammatical chunk. A build may only use
// blocks already introduced in THIS chapter. This also supports direct entry.
const block=(definition,...builds)=>({definition,builds});
const chapters=[
 ['past','Talk about what you did','Build the completed past from a helper and action. Learn one component, say it, cover it, and assemble the next phrase.',[
  block("have|I have (helper)|j’ai|/ʒe/|This is the helper for these completed actions."),
  block("prepared|prepared|préparé|/pʁepaʁe/|The ending é sounds like the vowel in café.","I have prepared|have prepared","I prepared|have prepared"),
  block("meal|the meal|le repas|/lə ʁəpa/|The final s is silent.","I prepared the meal|have prepared meal"),
  block("lunch|lunch (literally the lunch)|le déjeuner|/lə deʒœne/","I have prepared lunch|have prepared lunch","I prepared the meal|have prepared meal"),
  block("visited|visited|visité|/vizite/|The s between vowels sounds like z.","I have visited|have visited"),
  block("museum|the museum|le musée|/lə myze/","I visited the museum|have visited museum","I have visited the museum|have visited museum"),
  block("reserved|booked (reserved)|réservé|/ʁezɛʁve/","I booked|have reserved"),
  block("table|a table|une table|/yn tabl/","I booked a table|have reserved table"),
  block("and|and|et|/e/|The t is silent.","I prepared lunch and I booked a table|have prepared lunch and have reserved table"),
  block("yesterday|yesterday|hier|/jɛʁ/","Yesterday I visited the museum|yesterday have visited museum","Yesterday I prepared the meal and I booked a table|yesterday have prepared meal and have reserved table")
 ],[
  "I have booked a table and I have visited the museum|have reserved table and have visited museum",
  "Yesterday I booked a table|yesterday have reserved table",
  "Yesterday I prepared lunch|yesterday have prepared lunch",
  "I visited the museum and I prepared the meal|have visited museum and have prepared meal",
  "I booked a table and I prepared lunch|have reserved table and have prepared lunch",
  "Yesterday I prepared the meal|yesterday have prepared meal",
  "I prepared lunch and I visited the museum|have prepared lunch and have visited museum",
  "Yesterday I booked a table and I visited the museum|yesterday have reserved table and have visited museum",
  "Yesterday I visited the museum and I prepared lunch|yesterday have visited museum and have prepared lunch",
  "I have prepared the meal and I have booked a table|have prepared meal and have reserved table",
  "Yesterday I prepared lunch and I booked a table|yesterday have prepared lunch and have reserved table",
  "I have visited the museum and I have booked a table|have visited museum and have reserved table"
 ]],
 ['cognates','Recognise familiar words','Use familiar-looking words to express an opinion; check their actual French sounds and meanings.',[
  block("it|it is / that is|c’est|/sɛ/"),
  block("practical|practical|pratique|/pʁatik/|Many, but not all, English -ical words have a French -ique counterpart.","It is practical|it practical"),
  block("possible|possible|possible|/pɔsibl/","It is possible|it possible"),
  block("interesting|interesting|intéressant|/ɛ̃teʁesɑ̃/|Notice the nasal sounds and silent final t.","It is interesting|it interesting"),
  block("and|and|et|/e/","It is practical and interesting|it practical and interesting"),
  block("different|different|différent|/difeʁɑ̃/","It is different|it different"),
  block("but|but|mais|/mɛ/","It is possible but different|it possible but different"),
  block("normal|normal|normal|/nɔʁmal/","It is normal|it normal"),
  block("urgent|urgent|urgent|/yʁʒɑ̃/","It is urgent|it urgent"),
  block("invitation|an invitation|une invitation|/yn ɛ̃vitasjɔ̃/|Learn the article with the noun; English -tion often has a similar French word.","It is an invitation|it invitation"),
  block("important|important (feminine)|importante|/ɛ̃pɔʁtɑ̃t/|Invitation is feminine, so importante has a final e.","It is an important invitation|it invitation important")
 ],[
 "It is normal and practical|it normal and practical","It is urgent but possible|it urgent but possible",
 "It is different and interesting|it different and interesting","It is possible and practical|it possible and practical",
 "It is interesting but different|it interesting but different","It is normal but urgent|it normal but urgent",
 "It is practical but different|it practical but different","It is urgent and interesting|it urgent and interesting",
 "It is interesting and possible|it interesting and possible","It is different but practical|it different but practical",
 "It is possible but urgent|it possible but urgent","It is normal and interesting|it normal and interesting"
 ]],
 ['people','Talk about other people','Keep the past action unchanged and swap the helper to say who did it.',[
  block("i|I have (helper)|j’ai|/ʒe/"),
  block("prepared|prepared|préparé|/pʁepaʁe/","I prepared|i prepared"),
  block("dinner|dinner (literally the dinner)|le dîner|/lə dine/","I prepared dinner|i prepared dinner"),
  block("you|you have (informal singular helper)|tu as|/ty a/","You prepared dinner (informal)|you prepared dinner"),
  block("he|he has (helper)|il a|/il a/","He prepared dinner|he prepared dinner"),
  block("she|she has (helper)|elle a|/ɛl a/","She prepared dinner|she prepared dinner"),
  block("booked|booked|réservé|/ʁezɛʁve/","She booked|she booked"),
  block("room|a room|une chambre|/yn ʃɑ̃bʁ/","She booked a room|she booked room","You booked a room (informal)|you booked room"),
  block("we|we have (helper)|nous avons|/nuz avɔ̃/|Hear the z liaison.","We booked a room|we booked room"),
  block("vous|you have (polite or plural helper)|vous avez|/vuz ave/","You booked a room (formal or plural)|vous booked room"),
  block("they|they have (masculine or mixed helper)|ils ont|/ilz ɔ̃/","They booked a room (masculine/mixed)|they booked room"),
  block("elles|they have (all female helper)|elles ont|/ɛlz ɔ̃/","They prepared dinner (all female)|elles prepared dinner"),
  block("and|and|et|/e/","He prepared dinner and she booked a room|he prepared dinner and she booked room")
 ],[
 "He booked a room|he booked room","We prepared dinner|we prepared dinner",
 "They booked a room (all female)|elles booked room","You prepared dinner (formal or plural)|vous prepared dinner",
 "I booked a room|i booked room","They prepared dinner (masculine/mixed)|they prepared dinner",
 "She prepared dinner and he booked a room|she prepared dinner and he booked room",
 "We booked a room and you prepared dinner (informal)|we booked room and you prepared dinner",
 "You booked a room (formal or plural) and I prepared dinner|vous booked room and i prepared dinner",
 "They booked a room (all female) and we prepared dinner|elles booked room and we prepared dinner",
 "He booked a room and I prepared dinner|he booked room and i prepared dinner",
 "She prepared dinner and they booked a room (masculine/mixed)|she prepared dinner and they booked room"
 ]],
 ['plans','Plans, wishes and possibilities','Keep the action in its dictionary form and change the beginning to express what you want, can, must or plan to do.',[
  block("want|I want|je veux|/ʒə vø/"),
  block("visit|to visit|visiter|/vizite/","I want to visit|want visit"),
  block("museum|the museum|le musée|/lə myze/","I want to visit the museum|want visit museum"),
  block("can|I can|je peux|/ʒə pø/","I can visit the museum|can visit museum"),
  block("must|I must|je dois|/ʒə dwa/","I must visit the museum|must visit museum"),
  block("wish|I would like|je voudrais|/ʒə vudʁɛ/","I would like to visit the museum|wish visit museum"),
  block("future|I am going to|je vais|/ʒə vɛ/","I am going to visit the museum|future visit museum"),
  block("book|to book|réserver|/ʁezɛʁve/","I would like to book|wish book"),
  block("room|a room|une chambre|/yn ʃɑ̃bʁ/","I am going to book a room|future book room","I can book a room|can book room"),
  block("notwant|I do not want|je ne veux pas|/ʒə nə vø pa/","I do not want to book a room|notwant book room"),
  block("wait|to wait|attendre|/atɑ̃dʁ/","I do not want to wait|notwant wait"),
  block("notcan|I cannot|je ne peux pas|/ʒə nə pø pa/","I cannot wait|notcan wait"),
  block("notmust|I must not|je ne dois pas|/ʒə nə dwa pa/","I must not wait|notmust wait"),
  block("but|but|mais|/mɛ/","I want to visit the museum but I cannot wait|want visit museum but notcan wait")
 ],[
 "I want to book a room|want book room","I must book a room|must book room",
 "I would like to book a room|wish book room","I cannot book a room|notcan book room",
 "I must wait|must wait","I am going to wait|future wait",
 "I do not want to visit the museum|notwant visit museum","I can wait|can wait",
 "I would like to visit the museum but I must wait|wish visit museum but must wait",
 "I must book a room but I cannot wait|must book room but notcan wait",
 "I want to visit the museum but I must book a room|want visit museum but must book room",
 "I am going to book a room but I do not want to wait|future book room but notwant wait"
 ]],
 ['help','Questions and everyday needs','Build requests, needs and questions from short reusable chunks.',[
  block("need|I need (something)|j’ai besoin de|/ʒe bəzwɛ̃ də/|De joins a noun; use d’ before a vowel."),
  block("help|help (noun)|aide|/ɛd/","I need help|need help"), // contracted below
  block("wish|I would like|je voudrais|/ʒə vudʁɛ/"),
  block("water|a glass of water|un verre d’eau|/œ̃ vɛʁ do/","I would like a glass of water|wish water"),
  block("ticket|a ticket|un billet|/œ̃ bijɛ/","I would like a ticket|wish ticket","I need a ticket|need ticket"),
  block("looking|I am looking for|je cherche|/ʒə ʃɛʁʃ/","I am looking for a ticket|looking ticket"),
  block("station|the station|la gare|/la ɡaʁ/","I am looking for the station|looking station"),
  block("where|where is|où est|/u ɛ/","Where is the station?|where station"),
  block("museum|the museum|le musée|/lə myze/","Where is the museum?|where museum","I am looking for the museum|looking museum"),
  block("late|I am late|je suis en retard|/ʒə sɥi ɑ̃ ʁətaʁ/"),
  block("understand|I do not understand|je ne comprends pas|/ʒə nə kɔ̃pʁɑ̃ pa/"),
  block("can|can you (polite, inversion)|pouvez-vous|/puve vu/"),
  block("repeat|to repeat|répéter|/ʁepete/","Can you repeat? (polite, inversion)|can repeat"),
  block("and|and|et|/e/","I am late and I need help|late and need help")
 ],[
 "I need a glass of water|need water","I would like a ticket and I need help|wish ticket and need help",
 "I am looking for the museum and I am late|looking museum and late","I do not understand and I need help|understand and need help",
 "I need a ticket and I am looking for the station|need ticket and looking station","I am late and I need a ticket|late and need ticket",
 "I would like a glass of water and I am looking for the station|wish water and looking station","I am looking for a ticket and I need help|looking ticket and need help",
 "I am late and I am looking for the museum|late and looking museum","I need help and I would like a glass of water|need help and wish water",
 "I am looking for the station and I need help|looking station and need help","I am late and I would like a ticket|late and wish ticket"
 ]],
 ['time','What was happening?','Contrast a past plan or action in progress with a completed event.',[
  block("going|I was going to|j’allais|/ʒalɛ/"),
  block("leave|to leave|partir|/paʁtiʁ/","I was going to leave|going leave"),
  block("call|to call (phone)|téléphoner|/telefɔne/","I was going to call|going call"),
  block("when|when|quand|/kɑ̃/"),
  block("called|you called (informal)|tu as téléphoné|/ty a telefɔne/","I was going to leave when you called (informal)|going leave when called"),
  block("ongoing|I was in the middle of|j’étais en train de|/ʒetɛ ɑ̃ tʁɛ̃ də/"),
  block("work|working (infinitive)|travailler|/tʁavaje/","I was in the middle of working|ongoing work","I was in the middle of working when you called (informal)|ongoing work when called"),
  block("prepare|preparing (infinitive)|préparer|/pʁepaʁe/","I was going to prepare|going prepare"),
  block("dinner|dinner (literally the dinner)|le dîner|/lə dine/","I was in the middle of preparing dinner|ongoing prepare dinner"),
  block("arrived|you arrived (informal, male)|tu es arrivé|/ty ɛ aʁive/|Arriver uses être here."),
  block("arrivedf|you arrived (informal, female)|tu es arrivée|/ty ɛ aʁive/|The extra e is written, not heard.","I was in the middle of preparing dinner when you arrived (female, informal)|ongoing prepare dinner when arrivedf"),
  block("but|but|mais|/mɛ/","I was going to leave but you called (informal)|going leave but called")
 ],[
 "I was going to work|going work","I was going to call when you arrived (male, informal)|going call when arrived",
 "I was in the middle of calling|ongoing call","I was going to prepare dinner|going prepare dinner",
 "I was in the middle of working when you arrived (female, informal)|ongoing work when arrivedf","I was going to leave when you arrived (male, informal)|going leave when arrived",
 "I was in the middle of preparing dinner when you called (informal)|ongoing prepare dinner when called","I was going to work when you arrived (female, informal)|going work when arrivedf",
 "I was going to prepare dinner when you called (informal)|going prepare dinner when called","I was in the middle of calling when you arrived (male, informal)|ongoing call when arrived",
 "I was going to work but you called (informal)|going work but called","I was going to prepare dinner when you arrived (female, informal)|going prepare dinner when arrivedf"
 ]],
 ['school-ready','Getting Ready for School','May companion chapter rebuilt for a familiar morning routine: get ready, find your things, and encourage each other.',[
  block("youare|you are (informal)|tu es|/ty ɛ/"),
  block("ready|ready (male)|prêt|/pʁɛ/","You are ready (male, informal)|youare ready","Are you ready? (male, informal, rising intonation)|youare ready"),
  block("notyet|not yet|pas encore|/pa zɑ̃kɔʁ/"),
  block("iam|I am|je suis|/ʒə sɥi/","I am ready (male)|iam ready"),
  block("almost|almost|presque|/pʁɛsk/","I am almost ready (male)|iam almost ready"),
  block("hurry|hurry up (informal)|dépêche-toi|/depɛʃ twa/"),
  block("coming|I’m coming|j’arrive|/ʒaʁiv/"),
  block("youhave|you have (informal)|tu as|/ty a/"),
  block("bag|your bag (informal)|ton sac|/tɔ̃ sak/","Do you have your bag? (informal, rising intonation)|youhave bag"),
  block("forgot|I forgot / I have forgotten|j’ai oublié|/ʒe ublije/"),
  block("mybag|my bag|mon sac|/mɔ̃ sak/","I forgot my bag|forgot mybag"),
  block("bottle|your water bottle (informal)|ta gourde|/ta ɡuʁd/","Do you have your water bottle? (informal)|youhave bottle"),
  block("mybottle|my water bottle|ma gourde|/ma ɡuʁd/","I forgot my water bottle|forgot mybottle"),
  block("dontworry|don’t worry (informal)|ne t’inquiète pas|/nə tɛ̃kjɛt pa/"),
  block("manage|you will manage (informal)|tu vas y arriver|/ty va zi aʁive/"),
  block("and|and|et|/e/","And your water bottle? (informal)|and bottle","I forgot my bag and my water bottle|forgot mybag and mybottle")
 ],[
 "And your bag? (informal)|and bag","Do you have your bag and your water bottle? (informal)|youhave bag and bottle",
 "I forgot my water bottle and my bag|forgot mybottle and mybag","You are almost ready (male, informal)|youare almost ready",
 "Tell a boy to hurry up|hurry","Reply that you are not ready yet (use 'not yet')|notyet",
 "Tell someone you are coming|coming","Reassure a friend: don't worry|dontworry",
 "Say to a friend: you will manage|manage","I am almost ready and I am coming (male speaker)|iam almost ready and coming",
 "Ask a boy: are you almost ready? (informal)|youare almost ready","Say you forgot your bag|forgot mybag"
 ]],
 ['school-before-after','Before and After School','May companion chapter rebuilt around getting to school, music, collecting someone, snacks and useful questions.',[
  block("one|one minute|une minute|/yn minyt/"),
  block("forget|don’t forget (informal)|n’oublie pas|/nubli pa/"),
  block("bassoon|your bassoon (informal)|ton basson|/tɔ̃ basɔ̃/","Don’t forget your bassoon|forget bassoon"),
  block("have|I have|j’ai|/ʒe/"),
  block("music|a music lesson|un cours de musique|/œ̃ kuʁ də myzik/","I have a music lesson|have music"),
  block("today|today|aujourd’hui|/oʒuʁdɥi/","Today I have a music lesson|today have music"),
  block("pickup|I’m coming to pick you up (informal)|je viens te chercher|/ʒə vjɛ̃ tə ʃɛʁʃe/"),
  block("four|at four o’clock|à quatre heures|/a katʁ œʁ/","I’m coming to pick you up at four (informal)|pickup four"),
  block("mum|Mum is coming to pick you up (informal)|maman vient te chercher|/mamɑ̃ vjɛ̃ tə ʃɛʁʃe/","Mum is coming to pick you up at four|mum four"),
  block("hello|good morning, sir|bonjour monsieur|/bɔ̃ʒuʁ məsjø/"),
  block("money|some money|de l’argent|/də laʁʒɑ̃/","I have some money|have money"),
  block("snack|a snack|un goûter|/œ̃ ɡute/","I have a snack|have snack"),
  block("went|Did it go well? (rising intonation)|ça s’est bien passé|/sa sɛ bjɛ̃ pase/|With rising intonation, ask whether it went well."),
  block("maths|in maths|en maths|/ɑ̃ mat/","Did it go well in maths?|went maths"),
  block("english|in English|en anglais|/ɑ̃ nɑ̃ɡlɛ/","Did it go well in English?|went english"),
  block("school|at school|à l’école|/a lekɔl/","Did it go well at school?|went school")
 ],[
 "Today I have a snack|today have snack","Today Mum is coming to pick you up at four|today mum four",
 "Today I’m coming to pick you up at four (informal)|today pickup four","Today I have some money|today have money",
 "Say hello to a male teacher|hello","Tell a child not to forget their bassoon|forget bassoon",
 "Say you have a music lesson today|have music today","Mum is coming to pick you up today|mum today",
 "I have a snack today|have snack today","I’m coming to pick you up today (informal)|pickup today",
 "Ask if English went well|went english","Ask if school went well|went school"
 ]],
 ['school-day','Talking About the School Day','May companion chapter rebuilt as a conversation about weather, lessons, friends, lunch and feelings.',[
  block("cold|it is cold|il fait froid|/il fɛ fʁwa/"),
  block("raining|it is raining|il pleut|/il plø/"),
  block("put|put on (informal)|mets|/mɛ/"),
  block("coat|your coat (informal)|ton manteau|/tɔ̃ mɑ̃to/","Put on your coat|put coat"),
  block("went|did it go well?|ça s’est bien passé|/sa sɛ bjɛ̃ pase/"),
  block("yes|yes|oui|/wi/"),
  block("well|it went well|ça s’est bien passé|/sa sɛ bjɛ̃ pase/","Yes, it went well|yes well"),
  block("okay|it was all right|ça allait|/sa alɛ/"),
  block("difficult|it was difficult|c’était difficile|/setɛ difisil/"),
  block("fun|it was fun|c’était amusant|/setɛ amyzɑ̃/"),
  block("tired|I am tired (male speaker)|je suis fatigué|/ʒə sɥi fatiɡe/"),
  block("had|I had|j’ai eu|/ʒe y/"),
  block("maths|a maths lesson|un cours de maths|/œ̃ kuʁ də mat/","I had a maths lesson|had maths"),
  block("ate|I ate|j’ai mangé|/ʒe mɑ̃ʒe/"),
  block("lunch|lunch (literally the lunch)|le déjeuner|/lə deʒœne/","I ate lunch|ate lunch"),
  block("friends|with my friends|avec mes amis|/avɛk mez ami/","I ate lunch with my friends|ate lunch friends"),
  block("but|but|mais|/mɛ/","It was fun but I am tired (male speaker)|fun but tired")
 ],[
 "It went well but I am tired (male speaker)|well but tired","It was difficult but it was fun|difficult but fun",
 "It was all right but I am tired (male speaker)|okay but tired","I had a maths lesson but I am tired (male speaker)|had maths but tired",
 "It is raining but it was fun|raining but fun","It is cold but it went well|cold but well",
 "I ate lunch with my friends but I am tired (male speaker)|ate lunch friends but tired","I had a maths lesson but it was difficult|had maths but difficult",
 "I ate lunch but I am tired (male speaker)|ate lunch but tired","It was difficult but I am tired (male speaker)|difficult but tired",
 "I had a maths lesson but it went well|had maths but well","It is cold but it was fun|cold but fun"
 ]],
 ['sailing','Sailing Days','May companion chapter rebuilt: weather, getting ready for sailing and describing an outing.',[
  block("wind|it is windy|il y a du vent|/il i a dy vɑ̃/"),
  block("raining|it is raining|il pleut|/il plø/"),
  block("cold|it is cold|il fait froid|/il fɛ fʁwa/"),
  block("hot|it is hot|il fait chaud|/il fɛ ʃo/"),
  block("sail|to go sailing|faire de la voile|/fɛʁ də la vwal/"),
  block("future|I am going to|je vais|/ʒə vɛ/","I am going to go sailing|future sail"),
  block("today|today|aujourd’hui|/oʒuʁdɥi/","Today I am going sailing|today future sail"),
  block("wear|I am putting on|je mets|/ʒə mɛ/"),
  block("jacket|my life jacket|mon gilet de sauvetage|/mɔ̃ ʒilɛ də sovtaʒ/","I am putting on my life jacket|wear jacket"),
  block("ready|I am ready (male speaker)|je suis prêt|/ʒə sɥi pʁɛ/"),
  block("sailingpast|I went sailing|j’ai fait de la voile|/ʒe fɛ də la vwal/"),
  block("yesterday|yesterday|hier|/jɛʁ/","Yesterday I went sailing|yesterday sailingpast"),
  block("great|it was great|c’était super|/setɛ sypɛʁ/"),
  block("but|but|mais|/mɛ/","It is windy but I am going sailing|wind but future sail"),
  block("and|and|et|/e/","Yesterday I went sailing and it was great|yesterday sailingpast and great"),
  block("because|because|parce que|/paʁs kə/","I am putting on my life jacket because I am going sailing|wear jacket because future sail")
 ],[
 "It is cold but I am going sailing|cold but future sail","It is raining but I am going sailing|raining but future sail",
 "It is hot and it is windy|hot and wind","I am going sailing today|future sail today",
 "It is cold and it is raining|cold and raining","I am ready and I am going sailing (male speaker)|ready and future sail",
 "I am putting on my life jacket and I am ready (male speaker)|wear jacket and ready","It is cold but I am ready (male speaker)|cold but ready",
 "It is windy and it is raining|wind and raining","It is hot but it is windy|hot but wind",
 "I am going sailing because it is windy|future sail because wind","Today I am putting on my life jacket|today wear jacket"
 ]],
 ['sailing-water','Sailing Days · On the water','Extend the May sailing chapter with equipment, preparation and sailing actions.',[
 block("have|I have|j’ai|/ʒe/"),
 block("wetsuit|a wetsuit|une combinaison néoprène|/yn kɔ̃binɛzɔ̃ neopʁɛn/","I have a wetsuit|have wetsuit"),
 block("drysuit|a drysuit|une combinaison étanche|/yn kɔ̃binɛzɔ̃ etɑ̃ʃ/","I have a drysuit|have drysuit"),
 block("helmet|a helmet|un casque|/œ̃ kask/","I have a helmet|have helmet"),
 block("will|I am going to|je vais|/ʒə vɛ/"),
 block("rig|to rig the boat|gréer le bateau|/ɡʁee lə bato/","I am going to rig the boat|will rig"),
 block("helm|to steer the boat|barrer le bateau|/baʁe lə bato/","I am going to steer the boat|will helm"),
 block("tack|to tack|virer de bord|/viʁe də bɔʁ/","I am going to tack|will tack"),
 block("gybe|to gybe|empanner|/ɑ̃pane/","I am going to gybe|will gybe"),
 block("race|to race|faire une régate|/fɛʁ yn ʁeɡat/","I am going to race|will race"),
 block("boat|the boat|le bateau|/lə bato/"),
 block("capsized|capsized|a chaviré|/a ʃaviʁe/","The boat capsized|boat capsized"),
 block("we|we|nous|/nu/"),
 block("tacked|tacked|avons viré de bord|/avɔ̃ viʁe də bɔʁ/","We tacked|we tacked"),
 block("gybed|gybed|avons empanné|/avɔ̃ ɑ̃pane/","We gybed|we gybed"),
 block("and|and|et|/e/","We tacked and we gybed|we tacked and we gybed"),
 block("but|but|mais|/mɛ/","We tacked but the boat capsized|we tacked but boat capsized")
 ],[
 "I have a helmet and a wetsuit|have helmet and wetsuit","I have a wetsuit and a drysuit|have wetsuit and drysuit",
 "I am going to rig the boat and I am going to steer the boat|will rig and will helm","I am going to tack and I am going to gybe|will tack and will gybe",
 "I have a helmet and I am going to race|have helmet and will race","I have a drysuit and I am going to tack|have drysuit and will tack",
 "We gybed but the boat capsized|we gybed but boat capsized","I am going to race and I am going to steer the boat|will race and will helm",
 "I have a drysuit and I have a helmet|have drysuit and have helmet","We gybed and we tacked|we gybed and we tacked",
 "I am going to rig the boat and I am going to tack|will rig and will tack","I have a wetsuit and I am going to race|have wetsuit and will race"
 ]],
 ['homework','Sai’s French homework · Pets and opinions','Based on the recovered October animal-opinions homework and November revision anchors. Construct original answers before doing the school worksheet.',[
  block("name|my name is (literally I call myself)|je m’appelle|/ʒə mapɛl/"),
  block("leo|Léo|Léo|/leo/","My name is Léo|name leo"),
  block("have|I have|j’ai|/ʒe/"),
  block("dog|a dog|un chien|/œ̃ ʃjɛ̃/","I have a dog|have dog"),
  block("red|red|rouge|/ʁuʒ/","I have a red dog (imaginary animal)|have dog red"),
  block("small|a small dog|un petit chien|/œ̃ pəti ʃjɛ̃/|Petit normally goes before chien.","I have a small dog|have small"),
  block("clever|clever (masculine)|intelligent|/ɛ̃teliʒɑ̃/","I have a clever dog|have dog clever"),
  block("like|I like|j’aime|/ʒɛm/"),
  block("dogs|dogs (in general)|les chiens|/le ʃjɛ̃/|Use les for animals in general, un/une for one pet.","I like dogs|like dogs"),
  block("cats|cats (in general)|les chats|/le ʃa/","I like cats|like cats"),
  block("love|I love|j’adore|/ʒadɔʁ/","I love cats|love cats"),
  block("dislike|I do not like|je n’aime pas|/ʒə nɛm pa/","I do not like dogs|dislike dogs"),
  block("fish|fish (in general)|les poissons|/le pwasɔ̃/","I do not like fish|dislike fish"),
  block("hate|I hate|je déteste|/ʒə detɛst/","I hate fish|hate fish"),
  block("mice|mice (in general)|les souris|/le suʁi/","I hate mice|hate mice"),
  block("and|and|et|/e/","I like dogs and I love cats|like dogs and love cats"),
  block("but|but|mais|/mɛ/","I love cats but I do not like fish|love cats but dislike fish"),
  block("prefer|I prefer|je préfère|/ʒə pʁefɛʁ/","I prefer dogs|prefer dogs"),
  block("horses|horses (in general)|les chevaux|/le ʃəvo/","I prefer horses|prefer horses","I like dogs but I prefer horses|like dogs but prefer horses")
 ],[
 "I love dogs but I hate mice|love dogs but hate mice","I like fish and I love cats|like fish and love cats",
 "I do not like cats but I prefer dogs|dislike cats but prefer dogs","I have a small dog and I like cats|have small and like cats",
 "I love horses but I do not like fish|love horses but dislike fish","I have a clever dog and I like dogs|have dog clever and like dogs",
 "I hate cats but I love dogs|hate cats but love dogs","I do not like mice and I hate fish|dislike mice and hate fish",
 "I prefer cats but I have a dog|prefer cats but have dog","I like horses and I love cats|like horses and love cats",
 "I love dogs but I prefer horses|love dogs but prefer horses","I have a small dog but I prefer cats|have small but prefer cats"
 ]]
];
// A small explicitly constrained joiner. No inferred conjugations.
// Only de + vowel contraction is needed by the authored expressions.
function combine(parts){
 return parts.join(' ').replace(/\bde (aide|un billet|un verre)/g,(_m,x)=>"d’"+x);
}
const upper=s=>s.charAt(0).toUpperCase()+s.slice(1);
function compile([slug,name,goal,sections,application],index){
 const id='unlock2-'+slug, blocks=new Map(), sequence=[], builds=[], introduced=[];
 const concept=k=>'french:'+id+':'+k;
 const parse=(q,check=false)=>{
   const [en,keys]=q.split('|'),ids=keys.split(' ');
   if(!en||!keys||ids.some(k=>!blocks.has(k)))throw Error(id+' has an untaught block in '+q);
   const parts=ids.map(k=>blocks.get(k)),fr=upper(combine(parts.map(x=>x.fr)))+(en.includes('?')||/^Ask /i.test(en)?' ?':'');
   return {en,fr,parts:ids,components:parts.map(x=>({fr:x.fr,en:x.en})),id,verbId:id,concept:concept((check?'apply:':'build:')+ids.join('-'))};
 };
 const add=(stage,kind,row,action,extra={})=>sequence.push({...row,id:'guided-v2:'+id+':'+stage+':'+sequence.length,unitId:id,structure:id,verbId:id,track:'unlocking',stage,kind,unlockAction:action,novel:false,support:kind==='write'?'none':'worked-example',...extra});
 sections.forEach((section,i)=>{
   const [key,en,fr,pronunciation,note='']=section.definition.split('|');
   if(blocks.has(key)||!pronunciation)throw Error(id+' invalid block '+key);
   const row={key,en,fr,pronunciation,note,id,verbId:id,concept:concept('block:'+key),parts:[key]};
   // Insert an older covered retrieval before introducing the next chunk.
   if(i>=2){
     const old=introduced[i-2];
     add('recap','model',old,'recall',{modelInitiallyShown:false,prompt:'Can you still say this earlier building block?'});
   }
   blocks.set(key,row);introduced.push(row);
   add('present','model',row,'introduce',{modelInitiallyShown:true,prompt:'One building block. Listen, then say it.'});
   add('guided','model',row,'recall',{modelInitiallyShown:false,prompt:'Cover the French. Say the new building block.'});
   for(const q of section.builds){
     const r=parse(q);builds.push(r);
     add('guided','model',r,'build',{modelInitiallyShown:false,prompt:'Put the familiar pieces together. Say the answer first.'});
   }
   if(i>=3&&i%3===0&&builds.length>2){
     const old=builds[Math.max(0,builds.length-3)];
     add('guided','model',old,'build',{modelInitiallyShown:false,prompt:'Bring back an earlier combination without looking.'});
   }
 });
 // End of chapter: cover-and-reveal in both directions, then a few
 // independent written constructions. No self-reported oral mastery.
 const sample=[...introduced,...builds.slice(-3)];
 for(const r of [...introduced,...builds.slice(-3)]){
   add('recap','model',r,'reverse',{modelInitiallyShown:false,prompt:'Vocabulary checklist · What does this French mean?'});
   add('recap','model',r,'recall',{modelInitiallyShown:false,prompt:'Vocabulary checklist · Now say it in French.'});
 }
 for(const r of builds.slice(-3))add('independent','write',r,'write',{prompt:'Independent check · Write the complete French without looking.'});
 const applicationRows=application.map(q=>parse(q,true));
 if(applicationRows.length!==12||sample.length!==introduced.length+3)throw Error(id+' invalid check size');
 return {id,name,goal,track:'unlocking',incremental:true,label:'Chapter '+(index+1),rows:sample,blocks:introduced,sequence,application:applicationRows,verbs:[],structures:[],transfer:[]};
}
export const UNLOCKING_BUILDER_UNITS=Object.freeze(chapters.map(compile));
export const unlockingSteps=unit=>unit.sequence.map(x=>({...x}));
