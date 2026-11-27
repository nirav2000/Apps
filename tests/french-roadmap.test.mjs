import test from 'node:test';
import assert from 'node:assert/strict';
import {roadmapData,roadmapPage,roadmapUnitMarkup,roadmapSettings,teachingDays,goalCoverage,WEEKEND_GOALS,ROADMAP_VIEWS,LANGUAGE_SCOPES,languageInventory,selectLanguage} from '../french-teaching/v1/roadmap.js';
import {unitsForTrack,guidedLesson,guidedRefs} from '../french-teaching/v1/guided-lessons.js';
const now=1700000000000;
test('roadmap is generated from all tracks and every ordered core teaching step',()=>{
 for(const track of ['unlocking','michaela','sai','unlocking-archive']){
  const d=roadmapData(track,[],now);
  const units=unitsForTrack(track);
  assert.equal(d.units.length,units.length);
  assert.equal(d.coreTotal,units.reduce((n,u)=>n+guidedLesson(u.id).steps.length,0));
  assert.deepEqual(d.units.flatMap(u=>u.steps.map(s=>s.id)),units.flatMap(u=>guidedLesson(u.id).steps.map(s=>s.id)));
  assert.equal(d.remaining,d.coreTotal);assert.equal(d.coreCompleted,0);
  for(const view of ROADMAP_VIEWS)assert.match(roadmapPage({activeTrack:track,profile:'adult',settings:{view},now}),/LEARNING ROADMAP/);
 }
});
test('forecast adjusts to the pace and recorded progress but is not mastery',()=>{
 const base=roadmapData('unlocking',[],now),s=base.units[0].steps[0],ref=guidedRefs(s.id).complete;
 const entries=[{id:'one',at:now-1000,source:{ref},phase:'practice',support:'worked-example',score:{total:0,correct:0}}];
 const d=roadmapData('unlocking',entries,now,{minutes:30,seconds:30});
 assert.equal(d.coreCompleted,1);assert.equal(d.remaining,base.coreTotal-1);assert.equal(d.modelsCompleted,1);
 assert.equal(d.days,teachingDays(d.remaining,30,30));assert.ok(d.days<base.days);
 assert.equal(roadmapData('michaela',entries,now).coreCompleted,0);
 assert.equal(roadmapSettings({minutes:-1,seconds:0,view:'bad'}).minutes,15);
 assert.equal(roadmapSettings({minutes:-1,seconds:0,view:'bad'}).view,'language');
});
test('roadmap has expandable chapters and every core step, retaining repeated practice',()=>{
 const d=roadmapData('unlocking',[],now),u=d.units[0];
 const html=roadmapUnitMarkup(u,d.refs);
 assert.equal((html.match(/class="ft-road-detail ft-road-step"/g)||[]).length,u.total);
 assert.match(html,/New building blocks/);assert.match(html,/Step 1 of /);
 assert.match(html,/Target|target hidden/);
 const page=roadmapPage({activeTrack:'unlocking',profile:'adult',settings:{view:'curriculum'},now});
 assert.equal((page.match(/data-roadmap-unit="/g)||[]).length,d.units.length);
 assert.ok(!page.includes('class="ft-road-detail ft-road-step"')); // lazy expansion
 const opened=roadmapPage({activeTrack:'unlocking',profile:'adult',settings:{view:'curriculum'},openUnit:u.unit.id,now});
 assert.equal((opened.match(/class="ft-road-detail ft-road-step"/g)||[]).length,u.total);
});
test('uncompleted independent and transfer answers and due-check models are protected',()=>{
 const d=roadmapData('unlocking',[],now),u=d.units[0];
 const html=roadmapUnitMarkup(u,d.refs,true);
 assert.ok(!html.includes('data-roadmap-audio'));
 assert.ok(!html.includes('New building blocks'));
 assert.match(html,/Models hidden/);
 const protectedPage=roadmapPage({activeTrack:'unlocking',profile:'adult',settings:{view:'journey'},protectedUnits:new Set([u.unit.id]),now});
 assert.match(protectedPage,/French preview hidden/);
 assert.ok(!protectedPage.includes('Example conversation · parent/child'));
});
test('weekend priorities distinguish exact model matches from proposed additions',()=>{
 const d=roadmapData('unlocking',[],now),g=goalCoverage(d);
 assert.equal(g.length,WEEKEND_GOALS.length);
 assert.ok(g.flatMap(x=>x.pairs).some(x=>x.match&&!x.match.completed));
 assert.ok(g.flatMap(x=>x.pairs).some(x=>!x.match));
 const html=roadmapPage({activeTrack:'unlocking',profile:'adult',settings:{view:'journey'},now});
 assert.match(html,/French around the sailing club/);assert.match(html,/Proposed addition · reference only/);
 assert.match(html,/Example conversation · parent\/child/);
 assert.match(html,/Go and get changed/);assert.match(html,/Eat up/);
 assert.ok(!roadmapPage({activeTrack:'sai',profile:'sai',settings:{view:'journey'},now}).includes('French around the sailing club'));
 assert.match(roadmapPage({activeTrack:'unlocking',profile:'adult',settings:{view:'analysis'},now}),/Not measured/);
});


test('default roadmap provides actual distinct language by now, module, and cumulatively',()=>{
 const empty=roadmapData('unlocking',[],now),u=empty.units[0],v=empty.units.find(x=>x.unit.id==='unlock2-cognates');
 const evidence=u.steps.slice(0,10).map((s,j)=>({id:'covered'+j,at:now-1000+j,source:{ref:guidedRefs(s.id).complete},phase:'practice',support:'worked-example',score:{total:0,correct:0}}));
 const d=roadmapData('unlocking',evidence,now),rows=languageInventory(d,evidence,now);
 assert.ok(rows.length>400);
 assert.equal(selectLanguage(d,rows,{scope:'now'}).rows.length,5);
 const phrase=rows.find(r=>r.fr==='J’ai préparé');
 assert.deepEqual(phrase.translations,['I have prepared','I prepared']);
 assert.equal(phrase.covered,true);assert.equal(phrase.written,null);
 assert.equal(rows.filter(r=>/^tu es prêt\s*\??$/i.test(r.fr)).length,2);
 assert.equal(selectLanguage(d,rows,{scope:'through',module:u.unit.id}).rows.length,20);
 assert.equal(selectLanguage(d,rows,{scope:'through',module:v.unit.id}).rows.length,80);
 assert.equal(selectLanguage(d,rows,{scope:'module',module:v.unit.id}).newCount,20);
 assert.equal(selectLanguage(d,rows,{scope:'all'}).rows.length,rows.length);
 const html=roadmapPage({activeTrack:'unlocking',profile:'adult',entries:evidence,now});
 assert.match(html,/What should I be able to say\?/);assert.match(html,/I prepared the meal/);assert.match(html,/J’ai préparé le repas/);
 assert.match(html,/Written recall not measured/);assert.match(html,/Not measured/);
 assert.ok(!html.includes('French around the sailing club'));
 const all=roadmapPage({activeTrack:'unlocking',profile:'adult',settings:{scope:'all'},now});
 assert.ok(all.includes(String(rows.length)));assert.match(all,/Sailing Days/);
});
test('inventory does not promote assisted writing, incomplete future models or another track to coverage',()=>{
 const d=roadmapData('unlocking',[],now),u=d.units[0],s=u.steps.find(s=>s.kind==='write'&&s.stage==='independent');
 const exposure=u.steps.find(x=>x.fr===s.fr&&x.kind==='model');
 const row=(ref,support,correct,at)=>({id:ref,at,source:{ref},phase:'practice',support,score:{total:1,correct}});
 const e=[row(guidedRefs(s.id).first,'small-prompt',1,now-2000),row(guidedRefs(exposure.id).complete,'worked-example',0,now-1000)];
 const rows=languageInventory(d,e,now);
 assert.equal(rows.find(x=>x.fr===s.fr).written,null);
 assert.equal(rows.find(x=>x.fr===s.fr).covered,true);
 const independent=[row(guidedRefs(s.id).first,'none',1,now-2000),e[1]];
 assert.equal(languageInventory(d,independent,now).find(x=>x.fr===s.fr).written.correct,true);
 const future=[{...e[1],at:now+1}];
 assert.ok(languageInventory(d,future,now).every(x=>!x.covered));
 assert.ok(languageInventory(roadmapData('sai',e,now),e,now).every(x=>!x.covered));
});
test('all language filters hide French and audio when independent checks are due',()=>{
 const d=roadmapData('unlocking',[],now),unit=d.units[0].unit.id;
 for(const scope of LANGUAGE_SCOPES){
  const html=roadmapPage({activeTrack:'unlocking',profile:'adult',settings:{scope,module:unit},protectedUnits:new Set([unit]),now});
  assert.ok(!html.includes('data-roadmap-audio'));
  assert.ok(!html.includes('J’ai préparé'));
  assert.match(html,/English checklist is available/);
 }
 const safe=roadmapPage({activeTrack:'unlocking',profile:'adult',settings:{scope:'through',module:unit,languageQuery:'meal'},now});
 assert.match(safe,/I prepared the meal/);
 assert.ok(!safe.includes('>I booked a table</strong>')); // a longer sentence about the meal may contain these words
});
