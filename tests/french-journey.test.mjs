import test from 'node:test';
import assert from 'node:assert/strict';
import {createAnswerHistory} from '../french-teaching/v1/answer-history.js';
import {JOURNEY_APP,JOURNEY_MARKER,createJourneyRecorder,journeyControl,journeyEntries,journeySessions,journeyPage,todaySnapshot} from '../french-teaching/v1/session-journey.js';
import {repairDecision,revisionResultsMarkup,lastRevisionBatch} from '../french-teaching/v1/revision-repair.js';
import {missedLanguage,frenchTokens} from '../french-teaching/v1/revision-signals.js';
import {roadmapData,languageInventory,coveredConversations,roadmapPage} from '../french-teaching/v1/roadmap.js';
import {guidedLesson,guidedRefs,guidedTeachingRef} from '../french-teaching/v1/guided-lessons.js';
import {assessmentDeck,STAGES} from '../french-teaching/v1/assessment.js';
import {normaliseAnswer} from '../french-teaching/v1/data.js';
const now=1700000000000;
const memory=()=>{const m=new Map();return {getItem:k=>m.get(k)??null,setItem:(k,v)=>m.set(k,String(v)),removeItem:k=>m.delete(k)};};
test('journey batches are durable, scoped separately, and deduplicated after interrupted flush',()=>{
 const storage=memory(),scope={accountId:'parent',learnerId:'adult',storage};
 const answer=createAnswerHistory(scope),store=createAnswerHistory({...scope,appId:JOURNEY_APP});
 assert.equal(answer.key,'next-french-answers-v1:parent:adult');
 assert.notEqual(store.key,answer.key);
 const rec=createJourneyRecorder(store,storage);
 for(let i=0;i<13;i++)rec.append({id:'evt'+i,at:now+i,sessionId:'s',track:'unlocking',type:i?'click':'screen',page:'home',sequence:i});
 assert.equal(rec.size(),13);
 const restored=createJourneyRecorder(store,storage);assert.equal(restored.size(),13);
 restored.flush();assert.equal(restored.rows().length,2);assert.equal(restored.size(),0);assert.equal(answer.getEntries().length,0);
 const rows=journeyEntries(restored.rows(),'unlocking');assert.equal(rows.length,13);
 assert.equal(journeyEntries(restored.rows(),'unlocking',[rows[0]]).length,13);
 assert.equal(journeyEntries(restored.rows(),'sai').length,0);
 assert.equal(createJourneyRecorder(createAnswerHistory({...scope,learnerId:'sai',appId:JOURNEY_APP}),storage).size(),0);
 assert.equal(journeySessions(rows).length,1);
 assert.match(journeyPage(restored.rows(),'unlocking'),/13 events/);
});
test('journey captures card headings and planner status but never account details or input values',()=>{
 const account={dataset:{},matches:s=>s==='.ft-identity',closest:()=>null,parentElement:null,querySelector:s=>s==='h2,h3'?{textContent:'Your learning account'}:{textContent:'private@example.com'},querySelectorAll:()=>{throw Error('must not inspect account controls')}};
 const root={querySelectorAll:()=>[account]};
 assert.deepEqual(todaySnapshot(root),[{kind:'account',title:'Your learning account',controls:[]}]);
 assert.deepEqual(journeyControl({dataset:{act:'google-signin'},textContent:'private@example.com',value:'secret'}),{key:'action:google-signin',label:''});
 assert.deepEqual(journeyControl({dataset:{eact:'daily'},textContent:'Continue learning',value:'secret'}),{key:'assessment:daily',label:'Continue learning'});
 assert.equal(journeyControl({dataset:{},value:'secret'}),null);
});
test('serious missing language triggers immediate repair, while spelling escalates after recurrence',()=>{
 assert.equal(repairDecision('la maison','le repas').kind,'meaning');
 assert.equal(repairDecision('','le repas',[],true).kind,'meaning');
 assert.equal(repairDecision('le repa','le repas',[]),null);
 assert.equal(repairDecision('le repa','le repas',[{word:'repas',counts:{spelling:1}}]).kind,'spelling');
 assert.equal(repairDecision('Le repas.','le repas'),null);
 assert.equal(missedLanguage("J’ai préparé le musée","J’ai préparé le repas","I prepared the meal").word,'le repas');
});
test('revision recap includes every original question, submitted answer and expected answer without turning a supported retry into success',()=>{
 const rows=[{question:'Listen and type the phrase',answer:'la maison',expected:'le repas',english:'the meal',result:'incorrect',repair:'Supported rebuild correct'},{question:'Listen and type the word',answer:'possible',expected:'possible',result:'correct',assisted:true}];
 const html=revisionResultsMarkup(rows,{summary:true});assert.match(html,/la maison/);assert.match(html,/le repas/);assert.match(html,/the meal/);assert.match(html,/1 correct with help/);assert.match(html,/1 incorrect or revealed/);assert.match(html,/Continue learning/);
 const history=rows.map((r,i)=>({at:now+i,answerAudit:{...r,marker:'revision-v1',support:r.assisted?'small-prompt':'none',context:{revisionBatch:'batch',track:'unlocking',en:r.english}}}));
 assert.equal(lastRevisionBatch(history,'unlocking').length,2);assert.equal(lastRevisionBatch(history,'sai').length,0);
});
test('conversation previews use only covered token forms and exclude reserved assessments',()=>{
 const empty=roadmapData('unlocking',[],now);
 assert.equal(coveredConversations(languageInventory(empty,[],now),empty).length,0);
 const entries=empty.units[0].steps.filter(s=>s.kind==='model').map((s,i)=>({at:now-1000+i,source:{ref:guidedRefs(s.id).complete},phase:'practice',support:'worked-example',score:{total:0,correct:0}}));
 const data=roadmapData('unlocking',entries,now),inv=languageInventory(data,entries,now),chats=coveredConversations(inv,data);
 assert.ok(chats.length>0);
 const known=new Set(inv.filter(x=>x.covered).flatMap(x=>frenchTokens(x.fr).map(t=>t.key)));
 const reserved=new Set(data.units.flatMap(u=>STAGES.flatMap(st=>assessmentDeck(u.unit.id,st.id).filter(q=>q.kind==='transfer'||q.kind==='application').map(q=>normaliseAnswer(q.fr)))));
 for(const c of chats)for(const t of c.turns){assert.ok(frenchTokens(t.fr).every(w=>known.has(w.key)));assert.ok(!reserved.has(normaliseAnswer(t.fr)));}
 const html=roadmapPage({activeTrack:'unlocking',profile:'adult',entries,now});assert.match(html,/A conversation using your French/);
 const protectedPage=roadmapPage({activeTrack:'unlocking',profile:'adult',entries,now,protectedUnits:new Set([data.units[0].unit.id])});assert.match(protectedPage,/Available after your independent checks/);assert.ok(!protectedPage.includes('data-roadmap-audio'));
});
