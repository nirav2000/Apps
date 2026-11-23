import test from 'node:test';
import assert from 'node:assert/strict';
import {ALPHABET,PASSAGE,PATTERNS,DRILLS,CUDDLES,normaliseAnswer,markAnswer} from '../french-teaching/v1/data.js';
import {reviewPlan} from '../french-teaching/v1/index.js';
import {createEvidenceStore} from '../learning-evidence/v1/index.js';
import {createFirestoreEvidenceCloud} from '../learning-evidence/v1/firestore-cloud.js';

const OWNER='test-owner',APP='next-french';
function storage(){const data=new Map();return{getItem:k=>data.get(k)||null,setItem:(k,v)=>data.set(k,v)};}
function scope(learnerId='adult'){return createEvidenceStore({appId:APP,accountId:OWNER,learnerId,storage:storage()});}
function record(store,id){
  return store.record({id,concept:'french:connectives:reason',phase:'practice',correct:true,total:1,
    support:'none',taughtAt:'2026-11-22',source:{kind:'test',ref:id}});
}
function firestoreMock(){
  const docs=new Map();
  return {
    docs,
    collection(_db,...parts){return parts.join('/');},
    doc(col,id){return col+'/'+id;},
    documentId(){return '__name__';},
    where(k,op,val){return {k,op,val};},
    query(col,...filters){return{col,filters};},
    async getDocsFromServer(q){
      const entries=[...docs].filter(([k])=>k.startsWith(q.col+'/') &&
        q.filters.every(f=>f.op==='>='?k.split('/').pop()>=f.val:k.split('/').pop()<f.val));
      return{forEach(cb){for(const [k,data] of entries)cb({id:k.split('/').pop(),data:()=>data});}};
    },
    serverTimestamp(){return 'server-time';},
    async runTransaction(_db,cb){
      const writes=[];
      const value=await cb({get:async key=>({exists:()=>docs.has(key),data:()=>docs.get(key)}),
        set:(key,row)=>writes.push([key,row])});
      for(const [k,v]of writes)docs.set(k,v);
      return value;
    }
  };
}

test('French alphabet contains exactly 26 different letters and pronunciation examples',()=>{
  assert.equal(ALPHABET.length,26);
  assert.equal(new Set(ALPHABET.map(x=>x.letter)).size,26);
  assert.deepEqual(ALPHABET.map(x=>x.letter).join(''),'ABCDEFGHIJKLMNOPQRSTUVWXYZ');
  assert.ok(ALPHABET.every(x=>x.name&&x.example));
});
test('bilingual grid and reusable patterns preserve valid French and original examples',()=>{
  assert.ok(PASSAGE.length>=10&&PATTERNS.length>=8);
  assert.ok(PASSAGE.every(x=>x.fr&&x.en&&x.literal&&x.focus&&x.sound));
  assert.ok(PASSAGE[0].fr.includes('appartement'));
  assert.ok(!JSON.stringify(PASSAGE).includes('double p and double m'));
  assert.ok(PATTERNS.some(x=>x.word==='parce que'));
  assert.ok(PATTERNS.some(x=>x.word==='d’abord / puis')===false);
});
test('CUDDLES includes all seven explicit elements',()=>{
  assert.equal(CUDDLES.map(x=>x[0]).join(''),'CUDDLES');
  assert.ok(CUDDLES[3][1].includes('silent'));
});
test('scored prompts have stable unique IDs and supported help/phase metadata',()=>{
  assert.equal(DRILLS.length,new Set(DRILLS.map(x=>x.id)).size);
  assert.ok(DRILLS.every(x=>x.prompt&&x.answer&&x.concept&&['practice','transfer'].includes(x.phase)));
  assert.ok(DRILLS.filter(x=>x.phase==='transfer').every(x=>x.novel===true));
  assert.equal(markAnswer('  J’aime le français. ',"j'aime le français"),true);
  assert.equal(markAnswer('Je prefere','Je préfère'),false);
  assert.equal(normaliseAnswer('D’ABORD !'),"d'abord");
});
test('reviews are due on days 1, 3 and 7, with no claim of observed retention',()=>{
  const base=Date.parse('2026-11-18T00:00:00.000Z');
  const entries=[{source:{ref:'intro-connectives'},at:base,taughtAt:base,score:{total:0}}];
  assert.equal(reviewPlan(entries,base).next,base+86400000);
  assert.equal(reviewPlan(entries,base+2*86400000).next,base+86400000);
  const done=[...entries,{phase:'retrieval',at:base+86400000,score:{total:1}}];
  assert.equal(reviewPlan(done,base+2*86400000).next,base+3*86400000);
  done.push({phase:'retrieval',at:base+3*86400000,score:{total:1}});
  assert.equal(reviewPlan(done,base+4*86400000).next,base+7*86400000);
});
test('two offline devices merge immutable evidence without overwriting either',async()=>{
  const api=firestoreMock(),auth={currentUser:{uid:OWNER}},db={};
  const make=store=>createFirestoreEvidenceCloud({store,auth,db,firestore:api,
    ownerUid:OWNER,learnerId:'adult',appId:APP});
  const a=scope(),b=scope();
  record(a,'device-a-1');record(b,'device-b-1');
  await make(a).sync();await make(b).sync();
  await make(a).sync();
  assert.equal(a.getEntries().length,2);
  assert.equal(b.getEntries().length,2);
  assert.equal(api.docs.size,2);
  assert.equal((await make(a).sync()).uploaded,0);
});
test('evidence is isolated by learner and a wrong Firebase identity cannot read it',async()=>{
  const api=firestoreMock(),db={},auth={currentUser:{uid:OWNER}};
  const adult=scope('adult'),sai=scope('sai');
  record(adult,'adult-1');record(sai,'child-1');
  await createFirestoreEvidenceCloud({store:adult,auth,db,firestore:api,
    ownerUid:OWNER,learnerId:'adult',appId:APP}).sync();
  await createFirestoreEvidenceCloud({store:sai,auth,db,firestore:api,
    ownerUid:OWNER,learnerId:'sai',appId:APP}).sync();
  assert.equal(api.docs.size,2);
  assert.ok([...api.docs.keys()].some(x=>x.includes('learners/adult/')));
  assert.ok([...api.docs.keys()].some(x=>x.includes('learners/sai/')));
  const wrongAuth={currentUser:{uid:'wrong-user'}};
  await assert.rejects(createFirestoreEvidenceCloud({store:adult,auth:wrongAuth,db,firestore:api,
    ownerUid:OWNER,learnerId:'adult',appId:APP}).sync(),/authorised/);
});
test('conflicting event IDs fail closed rather than deleting or overwriting history',async()=>{
  const api=firestoreMock(),auth={currentUser:{uid:OWNER}},db={};
  const first=scope(),second=scope();
  record(first,'collision');second.record({id:'collision',concept:'french:alphabet:A',
    phase:'practice',correct:false,total:1,support:'none'});
  const make=store=>createFirestoreEvidenceCloud({store,auth,db,firestore:api,
    ownerUid:OWNER,learnerId:'adult',appId:APP});
  await make(first).sync();
  await assert.rejects(make(second).sync(),/collision|Conflicting|different|scope mismatch/i);
  assert.equal(api.docs.size,1);
});
