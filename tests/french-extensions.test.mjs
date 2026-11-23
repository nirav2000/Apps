import test from 'node:test';
import assert from 'node:assert/strict';
import {ALPHABET} from '../french-teaching/v1/data.js';
import {
 LETTER_NAME_GROUPS,LETTER_IPA,SOUND_FAMILIES,SOUND_QUIZ,CUDDLES_DEMOS,soundById
} from '../french-teaching/v1/phonics.js';
import {SUBJECTS,VERBS,WORD_NOTES,lookupFrenchWord,tokenizeFrench} from '../french-teaching/v1/lexicon.js';

test('all 26 French alphabet letters are grouped once, with a name and IPA',()=>{
 const flattened=LETTER_NAME_GROUPS.flatMap(group=>group.letters);
 assert.equal(flattened.length,26);
 assert.deepEqual([...flattened].sort(),ALPHABET.map(a=>a.letter).sort());
 assert.equal(new Set(flattened).size,26);
 for(const letter of ALPHABET){
   assert.ok(letter.name&&letter.example);
   assert.match(LETTER_IPA[letter.letter],/^\/.+\/$/);
 }
 const e=LETTER_NAME_GROUPS.find(g=>g.id==='e-ending');
 assert.deepEqual(e.letters,['B','C','D','G','P','T','V']);
});
test('sound families expose teachable phonics, examples, contextual whole sentence, and contrasts',()=>{
 assert.equal(SOUND_FAMILIES.length,4);
 const all=SOUND_FAMILIES.flatMap(x=>x.sounds);
 assert.ok(all.length>=20);
 assert.equal(new Set(all.map(x=>x.id)).size,all.length);
 for(const pattern of all){
   assert.equal(soundById(pattern.id),pattern);
   assert.ok(pattern.spell&&pattern.ipa&&pattern.clue&&pattern.sentence);
   assert.ok(pattern.examples.length>=2&&pattern.compare?.length===2);
 }
 assert.equal(soundById('does-not-exist'),null);
 for(const id of ['u','ou','eu-open','eu-close','oi','o-variants','in-ain-ein','ch','gn','qu','c','g','liaison'])
   assert.ok(soundById(id),id);
});
test('sound-recognition checks have unique keys, correct alternatives and limited evidence concepts',()=>{
 assert.ok(SOUND_QUIZ.length>=10);
 assert.equal(new Set(SOUND_QUIZ.map(q=>q.id)).size,SOUND_QUIZ.length);
 for(const item of SOUND_QUIZ){
   assert.ok(item.target&&item.correct&&item.why&&item.concept.startsWith('french:phonics:'));
   assert.equal(item.options.length,3);
   assert.equal(new Set(item.options).size,3);
   assert.ok(item.options.includes(item.correct),item.id);
   assert.equal(item.target,item.correct);
 }
});
test('CUDDLES sample annotations preserve exact words rather than guessing sound from arbitrary spelling',()=>{
 assert.ok(CUDDLES_DEMOS.length>=5);
 for(const sample of CUDDLES_DEMOS){
   assert.equal(sample.pieces.map(p=>p[0]).join('').replace(/‿/g,' '),sample.word);
   assert.ok(sample.description);
   assert.ok(sample.pieces.every(p=>['normal','double','silent','vowel','accent','liaison'].includes(p[1])));
 }
 const flat=CUDDLES_DEMOS.find(x=>x.id==='appartement');
 assert.equal(flat.word.length,11);
 assert.ok(flat.pieces.some(x=>x[0]==='pp'&&x[1]==='double'));
 assert.ok(flat.pieces.some(x=>x[0]==='t'&&x[1]==='silent'));
});
test('clicking veux resolves to vouloir and accurate irregular present conjugations',()=>{
 const x=lookupFrenchWord('veux');
 assert.equal(x.type,'verb');
 assert.equal(x.entry.lemma,'vouloir');
 assert.deepEqual(x.entry.forms,['veux','veux','veut','voulons','voulez','veulent']);
 assert.equal(x.entry.endingHints,undefined);
 assert.match(x.entry.note,/infinitive/);
 assert.equal(x.personIndex,0);
});
test('tappable elisions, past participle, subjunctive and impersonal verb resolve accurately',()=>{
 const cases=[
  ["J'habite",'habiter','present'],
  ["j'ai",'avoir','present'],
  ["c'est",'être','present'],
  ['voudrais','vouloir','conditional present'],
  ['soit','être','present subjunctive'],
  ['parlé','parler','past participle'],
  ['faut','falloir','impersonal present'],
  ['il faut','falloir','impersonal present']
 ];
 for(const [surface,lemma,formKind] of cases){
   const word=lookupFrenchWord(surface);
   assert.equal(word?.type,'verb',surface);
   assert.equal(word.entry.lemma,lemma,surface);
   assert.equal(word.formKind,formKind,surface);
 }
});
test('regular -er endings are explicit; stem-changing and spelling-changing exceptions remain named',()=>{
 assert.deepEqual(SUBJECTS,['je / j’','tu','il / elle / on','nous','vous','ils / elles']);
 assert.deepEqual(VERBS.habiter.endingHints,['-e','-es','-e','-ons','-ez','-ent']);
 assert.deepEqual(VERBS.habiter.forms,['habite','habites','habite','habitons','habitez','habitent']);
 assert.equal(VERBS.préférer.forms[0],'préfère');
 assert.equal(VERBS.préférer.forms[3],'préférons');
 assert.equal(VERBS.recommencer.forms[3],'recommençons');
 assert.deepEqual(VERBS.falloir.forms,[]);
 for(const entry of Object.values(VERBS))
   assert.ok(entry.lemma&&entry.meaning&&entry.group&&entry.example&&entry.note);
});
test('curated notes explain reusable chunks; tokenisation keeps original French character-for-character',()=>{
 assert.equal(lookupFrenchWord('parce que').meaning,'because');
 assert.equal(lookupFrenchWord('appartement').kind,'noun');
 assert.equal(lookupFrenchWord('une').meaning,'a / an (feminine)');
 assert.equal(lookupFrenchWord('unknownword'),null);
 const sentence="J'habite un petit appartement, mais je veux apprendre parce que c'est utile.";
 const tokens=tokenizeFrench(sentence);
 assert.equal(tokens.map(x=>x.text).join(''),sentence);
 assert.equal(tokens.find(x=>x.text==='veux')?.info?.entry.lemma,'vouloir');
 assert.equal(tokens.find(x=>x.text==='parce que')?.info?.meaning,'because');
 assert.equal(tokens.find(x=>x.text==='petit')?.info?.kind,'adjective');
 assert.equal(tokens.find(x=>x.text==="J'habite")?.info?.entry.lemma,'habiter');
 assert.deepEqual(tokenizeFrench(''),[]);
});
