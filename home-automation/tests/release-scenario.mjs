import fs from "node:fs";
import path from "node:path";

export async function run({page,assert,root,waitForQuiescence,metrics}) {
  const output=path.join(root,"artifacts");
  fs.mkdirSync(output,{recursive:true});
  await page.setViewportSize({width:1440,height:900});

  // The first response must be complete and explicitly non-live.
  assert.equal(await page.locator(".concept-tab").count(),4,"Four distinct concept tabs exist");
  assert(await page.locator(".demo-warning").innerText().then(s=>s.includes("nothing is connected")),"No actual device connectivity claimed");
  assert.equal(await page.locator("#overviewStats .stat-card").count(),4,"Overview statistics render");
  assert.equal(await page.locator("#sceneChoices button").count(),4,"All example scenes render");
  await page.screenshot({path:path.join(output,"01-overview-desktop.png"),fullPage:true});

  // All eight thermostat styles coexist on one page and share a live mock target.
  assert.equal(await page.locator("[data-control-card]").count(),8,"Eight distinct comparative thermostat controls on one page");
  assert.equal(await page.locator(".lab-util").count(),3,"Lighting, ventilation and hot water controls present");
  await page.locator("#labRoomPicker").selectOption("bathroom");
  assert((await page.locator("#labRoomCurrent").innerText()).includes("21.8"),"Choosing sample room updates comparison context");
  await page.locator("#labHybridRange").evaluate(el=>{el.value="22.5";el.dispatchEvent(new Event("input",{bubbles:true}));});
  assert.equal(await page.locator("#labLiveTarget").innerText(),"22.5°","Slider adjusts shared temperature");
  assert.equal(await page.locator("#labVerticalRange").inputValue(),"22.5","Vertical fader follows horizontal slider");
  assert.equal(await page.locator("#labNativePicker").inputValue(),"22.5","Native picker follows slider");
  await page.locator('[data-control-card="rotary"] [data-rotary]').focus();
  await page.keyboard.press("ArrowRight");
  assert.equal(await page.locator("#labLiveTarget").innerText(),"23.0°","Rotary responds to keyboard control");
  await page.locator('[data-preset="19"]').click();
  assert.equal(await page.locator("#labLiveTarget").innerText(),"19.0°","One tap preset changes all controls");
  await page.locator("#labNumberInput").fill("24.5");
  await page.locator("[data-number-apply]").click();
  assert.equal(await page.locator("#labLiveTarget").innerText(),"24.5°","Direct numeric entry works");
  await page.locator('[data-control-card="stepper"] [data-temp-step="-0.5"]').click();
  assert.equal(await page.locator("#labLiveTarget").innerText(),"24.0°","Large stepper works");
  await page.locator("#labNativePicker").selectOption("20");
  assert.equal(await page.locator("#labLiveTarget").innerText(),"20.0°","Native picker works");
  const rotary=page.locator('[data-control-card="rotary"] [data-rotary]');
  await rotary.scrollIntoViewIfNeeded();
  const b=await rotary.boundingBox();
  const radial=deg=>{const rad=(deg-90)*Math.PI/180;return {x:b.x+b.width/2+Math.cos(rad)*b.width*.43,y:b.y+b.height/2+Math.sin(rad)*b.height*.43};};
  await page.mouse.move(radial(230).x,radial(230).y);
  await page.mouse.down();
  await page.mouse.move(radial(330).x,radial(330).y,{steps:8});
  await page.mouse.up();
  assert((await page.locator("#labLiveTarget").innerText())!=="20.0°","Rotary pointer gesture actually changes shared setpoint");
  await page.locator('[data-pick-control="rotary"]').click();
  assert((await page.locator("#labShortlist").innerText()).includes("Rotary dial"),"Control shortlist records selection");
  await page.locator("#labDimmer").evaluate(el=>{el.value="35";el.dispatchEvent(new Event("input",{bubbles:true}));});
  assert.equal((await page.locator("#labDimmerLabel").innerText()).trim(),"35%","Light dimming simulated");
  await page.locator('[data-fan-mode="on"]').click();
  assert((await page.locator("#labFanStatus").innerText()).includes("manual override"),"Ventilation mode works");
  await page.locator('[data-boost="30"]').click();
  assert((await page.locator("#labBoostStatus").innerText()).includes("30-minute"),"Hot-water boost example works");
  await page.screenshot({path:path.join(output,"00-control-playground-desktop.png"),fullPage:true});
  await page.locator("#labRoomPicker").selectOption("living");
  await page.locator("#resetDemo").click();

  // Scene buttons are interactive but never change hardware.
  await page.locator('[data-scene="away"]').click();
  assert.equal((await page.locator("#heroMood").innerText()).trim(),"taken care of.","Away scene changes illustration copy");
  assert.equal((await page.locator('#zoneList [data-temperature="living"][data-step="0.5"]').count()),1,"Heating demo control remains available");
  await page.locator('#zoneList [data-temperature="living"][data-step="0.5"]').click();
  assert((await page.locator("#zoneList").innerText()).includes("18.5°"),"Heating setpoint changes in example only");
  await page.locator("#resetDemo").click();
  assert((await page.locator("#zoneList").innerText()).includes("21.0°"),"Reset restores the default example setpoint");
  assert.equal(await page.locator('#zoneList input[data-zone-range]').count(),3,"Every overview heating zone has a slider and +/- buttons");
  await page.locator('#zoneList [data-zone-range="living"]').evaluate(el=>{el.value="21.5";el.dispatchEvent(new Event("input",{bubbles:true}));});
  assert.equal(await page.locator("#labLiveTarget").innerText(),"21.5°","Overview slider synchronises with Control Playground");
  await page.locator('#zoneList [data-temperature="living"][data-step="-0.5"]').click();
  assert.equal(await page.locator("#labLiveTarget").innerText(),"21.0°","Overview precision button synchronises with Control Playground");

  // Room map is navigable and the detail panel is linked to chosen room.
  await page.locator("#tab-rooms").click();
  assert(await page.locator("#panel-rooms").isVisible(),"Spatial design is visible");
  assert.equal(await page.locator("#floorplan .floor-room").count(),5,"Five example spaces are present");
  await page.locator('[data-room="bathroom"]').click();
  assert.equal((await page.locator(".inspector-name").innerText()).trim(),"Bathroom","Selected room has its own inspector");
  await page.locator('#roomInspector [data-temperature="bathroom"][data-step="0.5"]').click();
  assert((await page.locator("#roomInspector .dial-centre").innerText()).includes("23.5°"),"Spatial thermostat buttons adjust mock setpoint");
  assert.equal(await page.locator("#roomInspector [data-rotary]").count(),1,"Room thermostat ring is genuinely interactive");
  assert.equal(await page.locator("#roomInspector input[data-temp-range]").count(),1,"Room inspector also provides a slider");
  await page.locator("#inspectorRoomRange").evaluate(el=>{el.value="22.5";el.dispatchEvent(new Event("input",{bubbles:true}));});
  assert.equal(await page.locator("#labLiveTarget").innerText(),"22.5°","Inspector slider synchronises with Control Playground");
  await page.locator('#roomInspector [data-light="bathroom"]').click();
  assert((await page.locator("#roomInspector .light-toggle").innerText()).includes("Off"),"Room light toggle operates simulation");
  await page.screenshot({path:path.join(output,"02-rooms-desktop.png"),fullPage:true});

  // Energy charts are synthetic, with no meter, tariff or charger call.
  await page.locator("#tab-energy").click();
  assert(await page.locator("#panel-energy").isVisible(),"Energy design is visible");
  assert.equal(await page.locator("#energyChart .chart-bar").count(),24,"24 illustrative hourly bars render");
  await page.locator('#periodControl [data-period="week"]').click();
  assert.equal(await page.locator("#energyChart .chart-bar").count(),7,"Seven illustrative daily bars render");
  await page.locator("#energyChart .chart-bar").first().click();
  assert((await page.locator("#chartSelection").innerText()).includes("sample only"),"Readings are labelled synthetic");
  await page.locator("#evToggle").check();
  assert((await page.locator("#evState").innerText()).includes("No real charger"),"EV toggle explicitly reports demo-only behaviour");
  await page.screenshot({path:path.join(output,"03-energy-desktop.png"),fullPage:true});

  // Operations view includes the complete consolidated register.
  await page.locator("#tab-systems").click();
  assert(await page.locator("#panel-systems").isVisible(),"Systems design is visible");
  assert.equal(await page.locator("#inventoryRows tr:not(.inventory-detail)").count(),17,"All 17 home automation workstreams render");
  assert.equal(await page.locator("#milestoneList input[type=checkbox]").count(),10,"Ten milestones render");
  await page.locator("#systemSearch").fill("HubR");
  assert.equal(await page.locator("#inventoryRows tr:not(.inventory-detail)").count(),1,"Live inventory filtering works");
  await page.locator('#inventoryRows [data-detail="wiser"]').click();
  assert(await page.locator("#detail-wiser").isVisible(),"Equipment integration details expand");
  await page.locator("#systemSearch").fill("not-a-real-system-189492");
  assert(await page.locator("#emptyInventory").isVisible(),"Empty-result state is visible");
  await page.locator("#systemSearch").fill("");
  await page.locator("#systemFilter").selectOption("reported");
  assert((await page.locator("#inventoryRows tr:not(.inventory-detail)").count())>=3,"Reported hardware filtering works");
  await page.locator("#systemFilter").selectOption("all");
  await page.locator('#milestoneList input[data-task="hardware"]').check();
  assert.equal((await page.locator("#taskPercentage").innerText()).trim(),"10%","Milestones update progress");
  await page.locator("#designNotes").fill("Use the room UI and energy trends together.");
  await page.locator("#favouriteBtn").click();
  assert((await page.locator("#reviewFavouriteStatus").innerText()).includes("Systems & plans"),"Favourite selection works");
  await page.screenshot({path:path.join(output,"04-systems-desktop.png"),fullPage:true});

  // Persistence is constrained to planning preferences, not sample device commands.
  await page.reload({waitUntil:"networkidle"});
  assert.equal((await page.locator("#taskPercentage").innerText()).trim(),"10%","Planning checkmark survives reload");
  assert.equal(await page.locator("#designNotes").inputValue(),"Use the room UI and energy trends together.","Design notes survive reload");
  assert((await page.locator("#reviewFavouriteStatus").innerText()).includes("Systems & plans"),"Favourite survives reload");
  await page.locator("#resetTasks").click();
  assert.equal((await page.locator("#taskPercentage").innerText()).trim(),"0%","Planner checkmarks can be cleared");

  // Keyboard navigation and mobile/tablet width regression checks.
  await page.locator("#tab-systems").focus();
  await page.keyboard.press("ArrowRight");
  assert(await page.locator("#panel-overview").isVisible(),"Keyboard arrow navigates tab controls");
  for(const viewport of [{width:390,height:844,name:"phone"},{width:820,height:1180,name:"tablet"}]){
    await page.setViewportSize(viewport);
    assert.equal(await page.locator("[data-control-card]").count(),8,viewport.name+" retains all controls");
    for(const name of ["overview","rooms","energy","systems"]){
      await page.locator("#tab-"+name).click();
      assert(await page.locator("#panel-"+name).isVisible(),viewport.name+" / "+name+" remains navigable");
      const widths=await page.evaluate(()=>({content:document.documentElement.scrollWidth,viewport:window.innerWidth}));
      assert(widths.content<=widths.viewport+2,viewport.name+" / "+name+" has no page-level horizontal overflow: "+JSON.stringify(widths));
    }
    await page.screenshot({path:path.join(output,"04-systems-"+viewport.name+".png"),fullPage:true});
  }

  // Shared validator checks request volume and Firebase write/listener budgets.
  await waitForQuiescence(()=>page.evaluate(()=>({
    tab:document.body.dataset.view,
    rows:document.querySelectorAll("#inventoryRows tr:not(.inventory-detail)").length,
    milestones:document.querySelectorAll("#milestoneList input:checked").length
  })),{quietMs:450,maxChanges:0});
  metrics.scenario={
    concepts:4,inventory:17,planningMilestones:10,viewports:["desktop","phone","tablet"],
    verified:"prototype controls, source-labelled examples, filtering, persistence, keyboard navigation and responsiveness"
  };
}
