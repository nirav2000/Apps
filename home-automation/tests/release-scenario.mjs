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

  // Scene buttons are interactive but never change hardware.
  await page.locator('[data-scene="away"]').click();
  assert.equal((await page.locator("#heroMood").innerText()).trim(),"taken care of.","Away scene changes illustration copy");
  assert.equal((await page.locator('#zoneList [data-temperature="living"][data-step="0.5"]').count()),1,"Heating demo control remains available");
  await page.locator('#zoneList [data-temperature="living"][data-step="0.5"]').click();
  assert((await page.locator("#zoneList").innerText()).includes("18.5°"),"Heating setpoint changes in example only");
  await page.locator("#resetDemo").click();
  assert((await page.locator("#zoneList").innerText()).includes("21.0°"),"Reset restores the default example setpoint");

  // Room map is navigable and the detail panel is linked to chosen room.
  await page.locator("#tab-rooms").click();
  assert(await page.locator("#panel-rooms").isVisible(),"Spatial design is visible");
  assert.equal(await page.locator("#floorplan .floor-room").count(),5,"Five example spaces are present");
  await page.locator('[data-room="bathroom"]').click();
  assert.equal((await page.locator(".inspector-name").innerText()).trim(),"Bathroom","Selected room has its own inspector");
  await page.locator('#roomInspector [data-temperature="bathroom"][data-step="0.5"]').click();
  assert((await page.locator("#roomInspector .dial-centre").innerText()).includes("23.5°"),"Spatial thermostat buttons adjust mock setpoint");
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
