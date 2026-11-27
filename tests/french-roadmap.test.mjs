import test from 'node:test';
import assert from 'node:assert/strict';
import {roadmapData,roadmapPage,roadmapUnitMarkup,roadmapSettings,teachingDays,goalCoverage,WEEKEND_GOALS,ROADMAP_VIEWS} from '../french-teaching/v1/roadmap.js';
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
 assert.equal(roadmapSettings({minutes:-1,seconds:0,view:'bad'}).view,'journey');
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
 const html=roadmapPage({activeTrack:'unlocking',profile:'adult',now});
 assert.match(html,/French around the sailing club/);assert.match(html,/Proposed addition · reference only/);
 assert.match(html,/Example conversation · parent\/child/);
 assert.match(html,/Go and get changed/);assert.match(html,/Eat up/);
 assert.ok(!roadmapPage({activeTrack:'sai',profile:'sai',now}).includes('French around the sailing club'));
 assert.match(roadmapPage({activeTrack:'unlocking',profile:'adult',settings:{view:'analysis'},now}),/Not measured/);
});
