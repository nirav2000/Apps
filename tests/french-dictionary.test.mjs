import test from 'node:test';
import assert from 'node:assert/strict';
import {
  dictionaryWord,dictionaryURL,frenchWiktionaryURL,lookupURL,
  parseDictionary,fetchDictionary,DICTIONARY_VERSION
} from '../french-teaching/v1/dictionary.js';

test('only a single French word or short lexical expression is sent to the third-party API',()=>{
  assert.equal(dictionaryWord('  école  '),'école');
  assert.equal(dictionaryWord("d’abord"),"d'abord");
  assert.equal(dictionaryWord('parce que'),'parce que');
  for(const phrase of [
    'Bonjour. Je suis élève.', 'aujourd’hui je ne sais pas pourquoi',
    'https://example.com', 'x'.repeat(80), '', 'foo\nbar'
  ])assert.throws(()=>dictionaryWord(phrase));
  assert.equal(lookupURL('vouloir'),'https://api.wiktapi.dev/v1/en/word/vouloir?lang=fr');
  assert.match(dictionaryURL('école'),/^https:\/\/en\.wiktionary\.org\//);
  assert.match(frenchWiktionaryURL('école'),/^https:\/\/fr\.wiktionary\.org\//);
  assert.equal(DICTIONARY_VERSION,'1.0.0');
});
test('strictly French entries only, English definitions, IPA and limited word forms',()=>{
 const payload={entries:[
   {lang_code:'en',pos:'noun',senses:[{glosses:['an English false friend']}],sounds:[{ipa:'wrong'}]},
   {word:'livre',lang:'French',lang_code:'fr',pos:'noun',
     senses:[{glosses:['book','pound (unit)']}],
     sounds:[{ipa:'/livʁ/'}],
     forms:[{form:'livres',tags:['plural']}]}
 ]};
 const data=parseDictionary(payload,'livre');
 assert.equal(data.found,true);
 assert.deepEqual(data.senses,['book','pound (unit)']);
 assert.deepEqual(data.ipa,['/livʁ/']);
 assert.deepEqual(data.parts,['noun']);
 assert.deepEqual(data.forms,[{word:'livres',label:'plural'}]);
 assert.ok(data.source.includes('wiktionary.org/wiki/livre'));
 assert.equal(parseDictionary({entries:[{lang_code:'en',senses:[{glosses:['not french']}]}]},'chat').found,false);
 assert.throws(()=>parseDictionary(null,'chat'));
});
test('dictionary entries do not inject HTML and extremely long entries are capped',()=>{
 const data=parseDictionary({entries:[{lang_code:'fr',pos:'verb',senses:[
  {glosses:['<img src=x onerror=alert(1)>']},{glosses:['a'.repeat(1000)]}
 ],sounds:Array(10).fill({ipa:'/a/'}),forms:Array.from({length:15},(_,i)=>({form:'f'+i,tags:['present']}))}]},'aller');
 assert.equal(data.senses[0],'<img src=x onerror=alert(1)>');
 assert.equal(data.senses[1].length,220);
 assert.equal(data.forms.length,8);
 assert.equal(data.ipa.length,1);
});
test('lookup uses no credentials, caches safe results and avoids duplicate requests',async()=>{
 const store=new Map(),storage={
   getItem:key=>store.get(key)||null,setItem:(key,value)=>store.set(key,value)
 };
 let requests=0;
 const fetcher=async(url,opts)=>{
   requests++;
   assert.ok(url.includes('/v1/en/word/coussin?lang=fr'));
   assert.equal(opts.credentials,'omit');
   return{ok:true,headers:{get:()=> 'application/json'},json:async()=>({
     entries:[{lang_code:'fr',lang:'French',pos:'noun',senses:[{glosses:['cushion']}]}]
   })};
 };
 const [one,two]=await Promise.all([
   fetchDictionary('coussin',{fetcher,storage}),
   fetchDictionary('coussin',{fetcher,storage})
 ]);
 assert.equal(one.senses[0],'cushion');
 assert.deepEqual(one,two);
 assert.equal(requests,1);
 const again=await fetchDictionary('coussin',{fetcher,storage});
 assert.deepEqual(again,one);
 assert.equal(requests,1);
 assert.ok([...store.keys()].some(key=>key.startsWith('next-french:wiktionary:v1:')));
});
test('offline, errors, CORS and timeouts do not contaminate local learning evidence',async()=>{
 for(const fetcher of [
   async()=>{throw TypeError('Failed to fetch');},
   async()=>({ok:false}),
   async()=>({ok:true,headers:{get:()=> 'text/html'},json:async()=>({})})
 ]){
   await assert.rejects(fetchDictionary('inconnu',{fetcher,storage:null}));
 }
 await assert.rejects(fetchDictionary('chat',{fetcher:async(_u,{signal})=>{
   await new Promise((_,reject)=>signal.addEventListener('abort',()=>reject(Object.assign(
    new Error('Aborted'),{name:'AbortError'})),{once:true}));
 },storage:null,timeoutMs:5}),/timed out/i);
});
