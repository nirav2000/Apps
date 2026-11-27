// Original everyday-French expansion, informed by the general spoken
// cover/retrieve/recombine method. Stable IDs; no publisher script copied.
const b=(key,en,fr,note='')=>({key,en,fr,note});
const p=(en,fr)=>({en,fr});
const pile=(label,items)=>({label,items:items.map(([en,fr])=>({en,fr}))});
const upper=s=>s.charAt(0).toUpperCase()+s.slice(1);
const lower=s=>s.charAt(0).toLowerCase()+s.slice(1);
const clean=s=>String(s).normalize('NFC').trim().toLowerCase().replace(/[.!?]+$/,'').trim();
const tidy=s=>s.replace(/\s+/g,' ').replace(/,\s*,/g,',').replace(/\bparce que (il|elle|on|ils|elles)\b/gi,"parce qu’$1").replace(/\bsi (il|ils)\b/gi,"s’$1").trim();
export function assemblePiles(workshop,indices){
 if(!workshop||indices.length!==workshop.piles.length)return null;
 const parts=indices.map((n,i)=>workshop.piles[i].items[n]);
 if(parts.some(x=>!x))return null;
 const en=upper(tidy(parts.map(x=>x.en).filter(Boolean).join(' ')))+(workshop.question?'?':'.');
 const fr=upper(tidy(parts.map(x=>x.fr).filter(Boolean).join(' ')))+(workshop.question?' ?':'.');
 return {en,fr,parts,key:indices.join('-')};
}
export const pileCount=w=>w.piles.reduce((n,x)=>n*x.items.length,1);
export function pileCombinations(w){
 let result=[[]];for(const pile of w.piles)result=result.flatMap(a=>pile.items.map((_,i)=>[...a,i]));
 return result.map(i=>assemblePiles(w,i));
}
const specs=[
 {
  slug:'moving',after:'past',label:'Expansion A',name:'Get ready, go and help',goal:'Use everyday actions with I must, we must, I can and I am going to; understand short replies from children.',
  sections:[
   {blocks:[b('must','I must / I need to','je dois'),b('we-must','we must / we need to','on doit'),b('go','to go / leave','partir')],models:[p('I need to leave.','Je dois partir.'),p('We need to leave.','On doit partir.')]},
   {blocks:[b('y-aller','to get going / go','y aller'),b('hurry','hurry up (to one child)','dépêche-toi'),b('not-yet','not yet','pas encore'),b('coming','I’m coming','j’arrive')],models:[p('Hurry up, we need to go.','Dépêche-toi, on doit y aller.'),p('Not yet, I’m coming!','Pas encore, j’arrive !')]},
   {blocks:[b('can','I can','je peux'),b('you-can','you can','tu peux'),b('going','I’m going to','je vais'),b('wait','to wait a little','attendre un peu'),b('eat','to eat','manger')],models:[p('I can wait a little.','Je peux attendre un peu.'),p('I’m going to eat.','Je vais manger.'),p('You can wait a little.','Tu peux attendre un peu.')]},
   {blocks:[b('boat','to prepare the boat','préparer le bateau'),b('bag','to look for the bag','chercher le sac'),b('kit','to put the equipment away','ranger le matériel')],models:[p('We need to prepare the boat.','On doit préparer le bateau.'),p('I’m going to look for the bag.','Je vais chercher le sac.'),p('I can put the equipment away.','Je peux ranger le matériel.')]},
   {blocks:[b('now','now','maintenant'),b('five','in five minutes','dans cinq minutes'),b('soon','in a little while','tout à l’heure'),b('before','before leaving','avant de partir'),b('before-food','before eating','avant de manger'),b('reason','because we’re leaving soon','parce qu’on part bientôt')],models:[p('Now, we need to prepare the boat before leaving.','Maintenant, on doit préparer le bateau avant de partir.'),p('In five minutes, I’m going to put the equipment away because we’re leaving soon.','Dans cinq minutes, je vais ranger le matériel parce qu’on part bientôt.')]},
   {blocks:[b('help','can you help me?','tu peux m’aider ?'),b('finished','I’ve nearly finished','j’ai presque fini'),b('minute','wait a minute','attends une minute')],models:[p('Wait a minute, I’ve nearly finished.','Attends une minute, j’ai presque fini.'),p('Can you help me? We need to prepare the boat.','Tu peux m’aider ? On doit préparer le bateau.')]}
  ],
  workshop:{name:'Before leaving for the sailing club',question:false,piles:[
   pile('When',[['now,','maintenant,'],['in five minutes,','dans cinq minutes,'],['in a little while,','tout à l’heure,']]),
   pile('What is possible or needed',[['I must','je dois'],['we must','on doit'],['I can','je peux'],['I’m going to','je vais'],['you can','tu peux']]),
   pile('Action',[['prepare the boat','préparer le bateau'],['look for the bag','chercher le sac'],['put the equipment away','ranger le matériel'],['wait a little','attendre un peu']]),
   pile('Extra detail',[['',''],['before leaving','avant de partir'],['before eating','avant de manger'],['because we’re leaving soon','parce qu’on part bientôt']])
  ]},
  checks:[p('We need to go.','On doit y aller.'),p('Can you help me?','Tu peux m’aider ?'),p('I’ve nearly finished.','J’ai presque fini.'),p('Now, we need to prepare the boat before leaving.','Maintenant, on doit préparer le bateau avant de partir.')],
  practice:[p('I must look for the bag before eating.','Je dois chercher le sac avant de manger.'),p('We need to wait a little because we’re leaving soon.','On doit attendre un peu parce qu’on part bientôt.')],
  application:[
   p('I can look for the bag before leaving.','Je peux chercher le sac avant de partir.'),p('I must put the equipment away before eating.','Je dois ranger le matériel avant de manger.'),
   p('In five minutes, we need to prepare the boat.','Dans cinq minutes, on doit préparer le bateau.'),p('Now, I can put the equipment away before leaving.','Maintenant, je peux ranger le matériel avant de partir.'),
   p('I’m going to prepare the boat before eating.','Je vais préparer le bateau avant de manger.'),p('We need to look for the bag because we’re leaving soon.','On doit chercher le sac parce qu’on part bientôt.'),
   p('In a little while, you can put the equipment away.','Tout à l’heure, tu peux ranger le matériel.'),p('Now, I must wait a little before eating.','Maintenant, je dois attendre un peu avant de manger.'),
   p('I can prepare the boat because we’re leaving soon.','Je peux préparer le bateau parce qu’on part bientôt.'),p('In five minutes, I’m going to look for the bag before leaving.','Dans cinq minutes, je vais chercher le sac avant de partir.'),
   p('You can prepare the boat before leaving.','Tu peux préparer le bateau avant de partir.'),p('In a little while, we need to put the equipment away before eating.','Tout à l’heure, on doit ranger le matériel avant de manger.')
  ]
 },
 {
  slug:'words',after:'cognates',label:'Expansion B',name:'Borrow familiar words and tell people what happened',goal:'Discover English–French word families, then reuse them in past actions and opinions instead of memorising long lists.',
  sections:[
   {blocks:[b('fantastic','fantastic','fantastique','Try changing the familiar English ending -ic to -ique.'),b('logical','logical','logique','Try the familiar -ical → -ique sound.'),b('practical','practical','pratique','Use prat- and the familiar -ique ending.'),b('possible','possible','possible','Keep the English spelling; say it with a French accent.'),b('itwas','it was','c’était')],models:[p('It was fantastic.','C’était fantastique.'),p('It was logical.','C’était logique.'),p('It was practical.','C’était pratique.'),p('It was possible.','C’était possible.')]},
   {blocks:[b('organisation','organisation','organisation','Keep the English spelling; listen to the French -tion ending.'),b('confirmation','confirmation','confirmation','Keep the English spelling; listen to the French -tion ending.'),b('reparation','repair / reparation','réparation','Start from reparation and give its first e an acute accent.'),b('organised','organised','organisé','Related to organisation: in this family, -ation changes to -é.'),b('confirmed','confirmed','confirmé','Related to confirmation: use the -é action form.'),b('repaired','repaired','réparé','Related to réparation: keep the first é and use -é at the end.')],models:[p('I organised the party.','J’ai organisé la fête.'),p('I confirmed the time.','J’ai confirmé l’heure.'),p('I repaired the boat.','J’ai réparé le bateau.')] ,extras:[b('i','I have (for a completed action)','j’ai'),b('party','the party','la fête'),b('time','the time','l’heure'),b('boat','the boat','le bateau')]},
   {blocks:[b('you','you have (one familiar person)','tu as'),b('we','we have (everyday spoken French)','on a'),b('we-formal','we have','nous avons'),b('prepared','prepared the equipment','préparé le matériel'),b('finished','finished the work','terminé le travail'),b('organised-party','organised the party','organisé la fête'),b('confirmed-time','confirmed the time','confirmé l’heure'),b('repaired-boat','repaired the boat','réparé le bateau')],models:[p('You organised the party.','Tu as organisé la fête.'),p('We prepared the equipment.','On a préparé le matériel.'),p('We repaired the boat.','Nous avons réparé le bateau.'),p('I finished the work.','J’ai terminé le travail.')]},
   {blocks:[b('yesterday','yesterday','hier'),b('morning','this morning','ce matin'),b('today','today','aujourd’hui'),b('great','and it was fantastic','et c’était fantastique'),b('practical2','and it was practical','et c’était pratique'),b('butdifficult','but it was difficult','mais c’était difficile')],models:[p('Yesterday, we repaired the boat, but it was difficult.','Hier, on a réparé le bateau, mais c’était difficile.'),p('This morning, I organised the party and it was fantastic.','Ce matin, j’ai organisé la fête et c’était fantastique.')]}
  ],
  workshop:{name:'Tell another parent what happened',question:false,piles:[
   pile('When',[['yesterday,','hier,'],['this morning,','ce matin,'],['today,','aujourd’hui,']]),
   pile('Who',[['I','j’ai'],['you','tu as'],['we','on a'],['we','nous avons']]),
   pile('Completed action',[['organised the party','organisé la fête'],['confirmed the time','confirmé l’heure'],['repaired the boat','réparé le bateau'],['prepared the equipment','préparé le matériel'],['finished the work','terminé le travail']]),
   pile('Comment',[['',''],['and it was fantastic','et c’était fantastique'],['and it was practical','et c’était pratique'],['but it was difficult','mais c’était difficile']])
  ]},
  checks:[p('It was fantastic.','C’était fantastique.'),p('I organised the party.','J’ai organisé la fête.'),p('We prepared the equipment.','On a préparé le matériel.'),p('Yesterday, we repaired the boat, but it was difficult.','Hier, on a réparé le bateau, mais c’était difficile.')],
  practice:[p('This morning, you repaired the boat and it was fantastic.','Ce matin, tu as réparé le bateau et c’était fantastique.'),p('Today, we finished the work, but it was difficult.','Aujourd’hui, nous avons terminé le travail, mais c’était difficile.')],
  application:[
   p('Yesterday, I confirmed the time.','Hier, j’ai confirmé l’heure.'),p('This morning, you organised the party, but it was difficult.','Ce matin, tu as organisé la fête, mais c’était difficile.'),
   p('Today, we prepared the equipment and it was practical.','Aujourd’hui, on a préparé le matériel et c’était pratique.'),p('Yesterday, we organised the party.','Hier, nous avons organisé la fête.'),
   p('This morning, I repaired the boat.','Ce matin, j’ai réparé le bateau.'),p('Today, you finished the work and it was fantastic.','Aujourd’hui, tu as terminé le travail et c’était fantastique.'),
   p('Yesterday, we confirmed the time and it was practical.','Hier, nous avons confirmé l’heure et c’était pratique.'),p('Today, I prepared the equipment, but it was difficult.','Aujourd’hui, j’ai préparé le matériel, mais c’était difficile.'),
   p('This morning, we finished the work and it was fantastic.','Ce matin, on a terminé le travail et c’était fantastique.'),p('Yesterday, you repaired the boat.','Hier, tu as réparé le bateau.'),
   p('Today, we organised the party and it was fantastic.','Aujourd’hui, nous avons organisé la fête et c’était fantastique.'),p('This morning, I confirmed the time and it was practical.','Ce matin, j’ai confirmé l’heure et c’était pratique.')
  ]
 },
 {
  slug:'children',after:'people',label:'Expansion C',name:'Ask children, give instructions and understand their answers',goal:'Use the language of getting changed, finding things, eating and helping; listen for natural short responses.',
  sections:[
   {blocks:[b('can','can you…?','tu peux'),b('want','do you want to…?','tu veux'),b('going','are you going to…?','tu vas'),b('must','do you have to…?','tu dois'),b('change','to get changed (talking to one child)','te changer'),b('lifejacket','to put on your life jacket','mettre ton gilet de sauvetage'),b('water','to take your water bottle','prendre ta gourde'),b('shoes','to look for your shoes','chercher tes chaussures')],models:[p('Can you get changed?','Tu peux te changer ?'),p('Are you going to put on your life jacket?','Tu vas mettre ton gilet de sauvetage ?'),p('Do you want to take your water bottle?','Tu veux prendre ta gourde ?')]},
   {blocks:[b('tell','tell me','dis-moi'),b('so','so / well','alors'),b('now','now','maintenant'),b('before','before leaving','avant de partir'),b('after','after the meal','après le repas')],models:[p('Tell me, can you look for your shoes now?','Dis-moi, tu peux chercher tes chaussures maintenant ?'),p('So, are you going to get changed before leaving?','Alors, tu vas te changer avant de partir ?')]},
   {blocks:[b('change-command','go and get changed','va te changer'),b('put-command','put on your life jacket','mets ton gilet de sauvetage'),b('get-command','go and get your bag','va chercher ton sac'),b('eat-command','come and eat','viens manger'),b('finish-command','finish your meal','finis ton repas'),b('drink-command','drink some water','bois de l’eau')],models:[p('Go and get changed, then put on your life jacket.','Va te changer, puis mets ton gilet de sauvetage.'),p('Come and eat, then go and get your bag.','Viens manger, puis va chercher ton sac.')],extras:[b('then','then','puis')]},
   {blocks:[b('forgot','I forgot my water bottle','j’ai oublié ma gourde'),b('cantfind','I can’t find my shoes','je ne trouve pas mes chaussures'),b('not-hungry','I’m not hungry any more','je n’ai plus faim'),b('nearly','I’m nearly ready','je suis presque prêt'),b('notfinished','I haven’t finished yet','je n’ai pas encore fini'),b('no','no','non'),b('yes','yes','oui'),b('but','but','mais')],models:[p('No, I can’t find my shoes.','Non, je ne trouve pas mes chaussures.'),p('Yes, but I forgot my water bottle.','Oui, mais j’ai oublié ma gourde.'),p('I’m nearly ready, but I haven’t finished yet.','Je suis presque prêt, mais je n’ai pas encore fini.')]}
  ],
  workshop:{name:'Questions for a child',question:true,piles:[
   pile('Start',[['',''],['tell me,','dis-moi,'],['so,','alors,']]),
   pile('Question',[['can you','tu peux'],['do you want to','tu veux'],['are you going to','tu vas'],['do you have to','tu dois']]),
   pile('Action',[['get changed','te changer'],['put on your life jacket','mettre ton gilet de sauvetage'],['take your water bottle','prendre ta gourde'],['look for your shoes','chercher tes chaussures']]),
   pile('When',[['now','maintenant'],['before leaving','avant de partir'],['after the meal','après le repas']])
  ]},
  checks:[p('Go and get changed.','Va te changer.'),p('I forgot my water bottle.','J’ai oublié ma gourde.'),p('I’m not hungry any more.','Je n’ai plus faim.'),p('I’m nearly ready, but I haven’t finished yet.','Je suis presque prêt, mais je n’ai pas encore fini.')],
  practice:[p('So, can you take your water bottle now?','Alors, tu peux prendre ta gourde maintenant ?'),p('Tell me, are you going to look for your shoes before leaving?','Dis-moi, tu vas chercher tes chaussures avant de partir ?')],
  application:[
   p('Can you put on your life jacket now?','Tu peux mettre ton gilet de sauvetage maintenant ?'),p('Tell me, do you want to get changed after the meal?','Dis-moi, tu veux te changer après le repas ?'),
   p('So, do you have to take your water bottle before leaving?','Alors, tu dois prendre ta gourde avant de partir ?'),p('Are you going to look for your shoes now?','Tu vas chercher tes chaussures maintenant ?'),
   p('Tell me, can you take your water bottle before leaving?','Dis-moi, tu peux prendre ta gourde avant de partir ?'),p('So, are you going to put on your life jacket after the meal?','Alors, tu vas mettre ton gilet de sauvetage après le repas ?'),
   p('Do you have to get changed now?','Tu dois te changer maintenant ?'),p('Tell me, do you want to look for your shoes before leaving?','Dis-moi, tu veux chercher tes chaussures avant de partir ?'),
   p('So, can you look for your shoes after the meal?','Alors, tu peux chercher tes chaussures après le repas ?'),p('Do you want to put on your life jacket before leaving?','Tu veux mettre ton gilet de sauvetage avant de partir ?'),
   p('Tell me, are you going to take your water bottle after the meal?','Dis-moi, tu vas prendre ta gourde après le repas ?'),p('So, do you have to look for your shoes before leaving?','Alors, tu dois chercher tes chaussures avant de partir ?')
  ]
 },
 {
  slug:'weekend',after:'plans',label:'Expansion D',name:'Make plans, explain problems and have a sailing-weekend conversation',goal:'Join three or more ideas, talk about a party, the weather and the boat, and understand replies.',
  sections:[
   {blocks:[b('return','we’re going to go back','on va rentrer'),b('wait','we’re going to wait a little','on va attendre un peu'),b('pack','we’re going to put the equipment away','on va ranger le matériel'),b('stay','we’re going to stay at the club','on va rester au club'),b('because','because','parce que'),b('if','if','si')],models:[p('We’re going to go back.','On va rentrer.'),p('We’re going to wait a little.','On va attendre un peu.')]},
   {blocks:[b('rain','it’s raining','il pleut'),b('wind','there is too much wind','il y a trop de vent'),b('cold','you’re cold','tu as froid'),b('race','the race is over','la course est terminée'),b('now','now','maintenant'),b('soon','soon','bientôt'),b('later','in a little while','tout à l’heure')],models:[p('We’re going to go back because it’s raining.','On va rentrer parce qu’il pleut.'),p('We’re going to stay at the club if there is too much wind.','On va rester au club s’il y a trop de vent.'),p('In a little while, we’re going to put the equipment away because the race is over.','Tout à l’heure, on va ranger le matériel parce que la course est terminée.')]},
   {blocks:[b('party','we have to go to a party','on doit aller à une fête'),b('late','we’re going to be late','on va être en retard'),b('need','we need to rig the boat','il faut gréer le bateau'),b('sail','can you bring the sail?','tu peux apporter la voile ?'),b('hold','hold this for me, please','tiens-moi ça, s’il te plaît'),b('done','I’ve finished','j’ai fini'),b('when','when','quand'),b('then','then','puis')],models:[p('Can you bring the sail? We need to rig the boat.','Tu peux apporter la voile ? Il faut gréer le bateau.'),p('We have to go to a party and we’re going to be late.','On doit aller à une fête et on va être en retard.'),p('When I’ve finished, we’re going to go back.','Quand j’ai fini, on va rentrer.')],extras:[b('and','and','et')]},
   {blocks:[b('well','did it go well?','ça s’est bien passé ?'),b('fun','did you have fun?','tu t’es bien amusé ?'),b('difficult','it was difficult','c’était difficile'),b('windy','it was windy','il y avait du vent'),b('repeat','can you repeat more slowly?','tu peux répéter plus lentement ?'),b('but','but','mais'),b('yesterday','yesterday','hier'),b('sailed','I went sailing','j’ai fait de la voile')],models:[p('It was difficult because it was windy.','C’était difficile parce qu’il y avait du vent.'),p('Did it go well? Can you repeat more slowly?','Ça s’est bien passé ? Tu peux répéter plus lentement ?'),p('Yesterday I went sailing, but it was difficult because it was windy.','Hier, j’ai fait de la voile, mais c’était difficile parce qu’il y avait du vent.'),p('When I’ve finished, we’re going to go back because we have to go to a party.','Quand j’ai fini, on va rentrer parce qu’on doit aller à une fête.')]}
  ],
  workshop:{name:'Explain the plan and the reason',question:false,piles:[
   pile('When',[['now,','maintenant,'],['soon,','bientôt,'],['in a little while,','tout à l’heure,']]),
   pile('Plan',[['we’re going to go back','on va rentrer'],['we’re going to wait a little','on va attendre un peu'],['we’re going to put the equipment away','on va ranger le matériel'],['we’re going to stay at the club','on va rester au club']]),
   pile('Link',[['because','parce que'],['if','si']]),
   pile('Reason or condition',[['it’s raining','il pleut'],['there is too much wind','il y a trop de vent'],['you’re cold','tu as froid'],['the race is over','la course est terminée']])
  ]},
  checks:[p('We have to go to a party.','On doit aller à une fête.'),p('Can you bring the sail?','Tu peux apporter la voile ?'),p('It was difficult because it was windy.','C’était difficile parce qu’il y avait du vent.'),p('When I’ve finished, we’re going to go back because we have to go to a party.','Quand j’ai fini, on va rentrer parce qu’on doit aller à une fête.')],
  practice:[p('Soon, we’re going to go back if you’re cold.','Bientôt, on va rentrer si tu as froid.'),p('Now, we’re going to wait a little because there is too much wind.','Maintenant, on va attendre un peu parce qu’il y a trop de vent.'),p('When the race is over, we’re going to put the equipment away, then we’re going to go back because we have to go to a party.','Quand la course est terminée, on va ranger le matériel, puis on va rentrer parce qu’on doit aller à une fête.'),p('If you’re cold, we’re going to stay at the club, then we’re going to go back when the race is over.','Si tu as froid, on va rester au club, puis on va rentrer quand la course est terminée.')],
  application:[
   p('In a little while, we’re going to go back if it’s raining.','Tout à l’heure, on va rentrer s’il pleut.'),p('Soon, we’re going to put the equipment away because the race is over.','Bientôt, on va ranger le matériel parce que la course est terminée.'),
   p('Now, we’re going to stay at the club if you’re cold.','Maintenant, on va rester au club si tu as froid.'),p('In a little while, we’re going to wait a little because it’s raining.','Tout à l’heure, on va attendre un peu parce qu’il pleut.'),
   p('Soon, we’re going to go back because the race is over.','Bientôt, on va rentrer parce que la course est terminée.'),p('Now, we’re going to put the equipment away if there is too much wind.','Maintenant, on va ranger le matériel s’il y a trop de vent.'),
   p('In a little while, we’re going to stay at the club because you’re cold.','Tout à l’heure, on va rester au club parce que tu as froid.'),p('Soon, we’re going to wait a little if it’s raining.','Bientôt, on va attendre un peu s’il pleut.'),
   p('Now, we’re going to go back because you’re cold.','Maintenant, on va rentrer parce que tu as froid.'),p('In a little while, we’re going to put the equipment away if the race is over.','Tout à l’heure, on va ranger le matériel si la course est terminée.'),
   p('Soon, we’re going to stay at the club because there is too much wind.','Bientôt, on va rester au club parce qu’il y a trop de vent.'),p('Now, we’re going to wait a little if there is too much wind.','Maintenant, on va attendre un peu s’il y a trop de vent.')
  ]
 }
];
function compile(spec){
 const id='unlock2-expand-'+spec.slug,sequence=[],blocks=[],known=new Set();
 const concept=k=>'french:'+id+':'+k;
 const row=(r,key)=>({...r,id,verbId:id,concept:concept(key)});
 const add=(stage,kind,r,key,action,extra={})=>sequence.push({...row(r,key),id:'guided-v2:'+id+':'+stage+':'+key,unitId:id,structure:id,track:'unlocking',stage,kind,unlockAction:action,novel:false,support:kind==='write'?'none':'worked-example',...extra});
 spec.sections.forEach((section,i)=>{
  for(const x of [...(section.extras||[]),...section.blocks]){
   const k=clean(x.fr);if(known.has(k))continue;known.add(k);blocks.push(row(x,'block:'+x.key));
   const robbery=spec.slug==='words'&&['fantastic','logical','practical','possible','organisation','confirmation','reparation','organised','confirmed','repaired'].includes(x.key);
   add('present','model',x,'intro-'+x.key,'introduce',{modelInitiallyShown:!robbery,discovery:robbery,prompt:robbery?'Borrow a familiar word. Try it aloud, then reveal.':'Listen to a useful new building block, then say it.'});
   add('guided','model',x,'recall-'+x.key,'recall',{modelInitiallyShown:false,prompt:'Say it in French without looking.'});
  }
  section.models.forEach((x,j)=>add('guided','model',x,'mix-'+i+'-'+j,'build',{modelInitiallyShown:false,prompt:'Use the familiar pieces in a useful sentence. Say it aloud first.'}));
 });
 const replies={
  moving:[
   [p('Not yet, I’m coming!','Pas encore, j’arrive !'),'A child replies when you ask them to hurry up.', ['Wait a minute, I’ve nearly finished.','We need to prepare the boat.']],
   [p('Wait a minute, I’ve nearly finished.','Attends une minute, j’ai presque fini.'),'A child responds while putting their equipment away.',['Not yet, I’m coming!','I can wait a little.']]
  ],
  words:[
   [p('Yesterday, we repaired the boat, but it was difficult.','Hier, on a réparé le bateau, mais c’était difficile.'),'Another parent is telling you about yesterday.',['We prepared the equipment this morning.','This morning, I organised the party and it was fantastic.']]
  ],
  children:[
   [p('No, I can’t find my shoes.','Non, je ne trouve pas mes chaussures.'),'You ask a child if they are ready to leave.',['Yes, but I forgot my water bottle.','I’m nearly ready, but I haven’t finished yet.']],
   [p('Yes, but I forgot my water bottle.','Oui, mais j’ai oublié ma gourde.'),'Listen to the child’s reply about their kit.',['No, I can’t find my shoes.','I’m not hungry any more.']],
   [p('I’m nearly ready, but I haven’t finished yet.','Je suis presque prêt, mais je n’ai pas encore fini.'),'A child is responding while getting changed.',['Yes, but I forgot my water bottle.','No, I can’t find my shoes.']]
  ],
  weekend:[
   [p('Yesterday I went sailing, but it was difficult because it was windy.','Hier, j’ai fait de la voile, mais c’était difficile parce qu’il y avait du vent.'),'A child explains how yesterday went.',['It was difficult because it was raining.','We’re going to go back because it’s raining.']],
   [p('When I’ve finished, we’re going to go back because we have to go to a party.','Quand j’ai fini, on va rentrer parce qu’on doit aller à une fête.'),'Listen to a parent explaining the plan.',['We’re going to stay at the club if there is too much wind.','We have to go to a party and we’re going to be late.']]
  ]
 }[spec.slug]||[];
 replies.forEach(([r,context,distractors],j)=>add('guided','listen',r,'reply-'+j,'listen',{audioContext:context,choices:[r.en,...distractors],support:'small-prompt',prompt:'Listen to what someone says. Work out the meaning.'}));
 const w=spec.workshop,example=assemblePiles(w,w.piles.map(()=>0));
 add('guided','workshop',p(example.en,example.fr),'four-piles','workshop',{workshop:w,prompt:'Choose one piece from each pile. Say the sentence aloud, then compare.'});
 spec.practice.forEach((x,j)=>add('guided','model',x,'long-'+j,'build',{modelInitiallyShown:false,prompt:'Now put more ideas together. Say the whole sentence before revealing.'}));
 // The short written tasks are checks of construction, not automatic scoring of speech.
 spec.checks.slice(-2).forEach((x,j)=>add('independent','write',x,'write-'+j,'write',{prompt:'Write the French without a model.'}));
 return {...spec,id,track:'unlocking',incremental:true,expansion:true,rows:spec.checks.map((x,i)=>row(x,'check-'+i)),blocks,sequence,application:spec.application.map((x,i)=>row(x,'application-'+i)),verbs:[],structures:[],transfer:[]};
}
export const EXPANSION_UNITS=Object.freeze(specs.map(compile));
export function withExpansions(units){return units.flatMap(u=>[u,...EXPANSION_UNITS.filter(x=>u.id==='unlock2-'+x.after)]);}
