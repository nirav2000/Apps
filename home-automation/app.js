/* Home Automation Studio v0.2.0
   Demo-only UI: no fetch, socket, provider API, secrets, or control gateway.
   Prototype readings and room layouts are entirely synthetic.
   Never interpret UI changes as success of a physical automation. */
(() => {
  "use strict";

  const DATA = window.HOME_STUDIO_DATA;
  if (!DATA || !Array.isArray(DATA.systems)) {
    document.body.insertAdjacentHTML("afterbegin", '<p role="alert">Home Studio could not load its project register. Please reload.</p>');
    return;
  }
  const $ = id => document.getElementById(id);
  const labelByTab = {overview:"At a glance",rooms:"Room by room",energy:"Energy & flows",systems:"Systems & plans"};
  const tabKeys = Object.keys(labelByTab);
  const storageKey = "apps.home-studio.v0.1";
  const esc = value => String(value).replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  const clamp = (n,min,max) => Math.min(max,Math.max(min,n));
  const fmt = n => Number(n).toFixed(1);
  const safeRead = () => {try {const raw = JSON.parse(localStorage.getItem(storageKey)||"{}"); return raw && typeof raw==="object" ? raw : {};}catch{return {};}};
  const saved = safeRead();
  const savedTasks = Array.isArray(saved.tasks) ? saved.tasks.filter(id=>DATA.milestones.some(x=>x.id===id)) : [];
  const state = {
    tab: tabKeys.includes(location.hash.slice(1)) ? location.hash.slice(1) : "overview",
    scene:"home",selectedRoom:"living",period:"day",selectedBar:null,
    rooms:DATA.rooms.map(r=>({...r})),
    tasks:new Set(savedTasks), notes:typeof saved.notes==="object"&& saved.notes && !Array.isArray(saved.notes)?saved.notes:{},
    favourite:tabKeys.includes(saved.favourite)?saved.favourite:null,
    shortlisted:new Set(Array.isArray(saved.shortlisted)?saved.shortlisted.filter(id=>window.HomeControlLab?.options.some(x=>x.id===id)):[]),
    expanded:new Set(), ev:false, filter:"all", query:""
  };
  const refs = Object.fromEntries(state.rooms.map(r=>[r.id,r]));
  let toastTimer;

  function persist() {
    try {
      localStorage.setItem(storageKey,JSON.stringify({tasks:[...state.tasks],notes:state.notes,favourite:state.favourite,shortlisted:[...state.shortlisted]}));
      return true;
    }catch {return false;}
  }
  function toast(text) {
    const node=$("toast");if(!node)return;
    node.textContent=text;node.classList.add("visible");
    clearTimeout(toastTimer);toastTimer=setTimeout(()=>node.classList.remove("visible"),2800);
  }
  function setTab(next,{updateHash=true,focus=false}={}) {
    if(!tabKeys.includes(next))return;
    state.tab=next;
    for(const name of tabKeys) {
      const selected=name===next;
      const tab=$("tab-"+name),panel=$("panel-"+name);
      tab.classList.toggle("selected",selected);
      tab.setAttribute("aria-selected",String(selected));
      tab.tabIndex=selected?0:-1;
      panel.hidden=!selected;
      if(focus && selected)tab.focus();
    }
    document.body.dataset.view=next;
    if(updateHash && location.hash!=="#"+next)history.replaceState(null,"","#"+next);
    updateFeedback();
  }

  function applyScene(id) {
    const scene=DATA.scenes.find(x=>x.id===id);
    if(!scene)return;
    state.scene=id;
    const zoneDefaults={living:21,kitchen:20,bedroom:19,bathroom:23,utility:18};
    state.rooms.forEach(r=>{
      const base=zoneDefaults[r.id];
      r.target=clamp(base + (id==="away"?-3:id==="night"?-2:id==="boost"?1:0),10,28);
      r.lights=id==="away"||id==="night"?false:["living","kitchen","bathroom"].includes(r.id);
    });
    renderOverview();renderRooms();window.HomeControlLab?.refresh();
    toast("Simulated scene: "+scene.name+" — no physical devices changed");
  }
  // All inputs use the same validated demo setpoint. During a drag we only
  // update labels; replacing a rotary node would discard pointer capture.
  function setRoomTarget(roomId,value,{continuous=false}={}) {
    const room=refs[roomId];
    const proposed=Number(value);
    if(!room||!Number.isFinite(proposed))return;
    const next=clamp(Math.round(proposed*2)/2,10,28);
    if(room.target===next){window.HomeControlLab?.refresh();return;}
    room.target=next;
    if(continuous){
      if(roomId==="living"){
        const overviewReading=$("overviewStats")?.querySelector(".stat-card strong");
        if(overviewReading)overviewReading.textContent=fmt(room.target)+"°";
      }
      for(const el of document.querySelectorAll('[data-zone-target="'+roomId+'"]'))
        el.textContent=fmt(room.target)+"°";
      for(const slider of document.querySelectorAll('[data-zone-range="'+roomId+'"]')){
        slider.value=String(room.target);
        slider.style.setProperty("--fill",((room.target-10)/18*100)+"%");
      }
      window.HomeControlLab?.refresh();
    } else {
      renderOverview();
      renderRooms();
      window.HomeControlLab?.refresh();
      toast(room.name+" sample setpoint: "+fmt(room.target)+"°C (demo only)");
    }
  }
  function changeTemperature(roomId,delta) {
    const room=refs[roomId];
    if(room)setRoomTarget(roomId,room.target+delta);
  }
  function toggleLight(roomId) {
    const room=refs[roomId];if(!room)return;
    room.lights=!room.lights;renderRooms();window.HomeControlLab?.refresh();
    toast(room.name+" sample lights "+(room.lights?"on":"off")+" — simulation");
  }
  function renderScenes() {
    $("sceneChoices").innerHTML=DATA.scenes.map(scene=>'<button type="button" class="scene-button '+(state.scene===scene.id?"active":"")+'" data-scene="'+esc(scene.id)+'" aria-pressed="'+(state.scene===scene.id)+'"><span aria-hidden="true">'+esc(scene.icon)+'</span>'+esc(scene.name)+'</button>').join("");
    const selected=DATA.scenes.find(x=>x.id===state.scene);
    $("heroMood").textContent=selected.mood;
    $("comfortIndex").textContent=selected.comfort;
    $("roomSceneLabel").textContent=selected.name+" · demo";
  }
  function renderOverview() {
    renderScenes();
    const avg=state.rooms.reduce((n,r)=>n+r.current,0)/state.rooms.length;
    const bedroom=refs.bedroom; const bath=refs.bathroom;
    const items=[
      {icon:"♨",value:fmt(refs.living.target)+"°",label:"Sample main-zone setpoint"},
      {icon:"◷",value:"3",label:"Potential comfort zones"},
      {icon:"⌁",value:fmt(avg)+"°",label:"Sample room average"},
      {icon:"◉",value:String(bath.humidity)+"%",label:"Sample bathroom humidity"}
    ];
    $("overviewStats").innerHTML=items.map(x=>'<div class="stat-card"><span class="stat-icon" aria-hidden="true">'+x.icon+'</span><strong>'+x.value+'</strong><span>'+x.label+'</span></div>').join("");
    const zones=[
      {id:"living",title:"Main heating",caption:"Wiser · proposed local integration",icon:"♨"},
      {id:"bedroom",title:"Bedrooms",caption:"Example room setpoint · simulated",icon:"☾"},
      {id:"bathroom",title:"Bathroom floor",caption:"Warmup Element · cloud API candidate",icon:"◉"}
    ];
    $("zoneList").innerHTML=zones.map(z=>{
      const room=refs[z.id];
      return '<div class="zone-row"><span class="zone-icon" aria-hidden="true">'+z.icon+'</span><div class="zone-details"><strong>'+esc(z.title)+'</strong><span>'+esc(z.caption)+'</span></div><div class="temp-control"><button type="button" data-temperature="'+esc(z.id)+'" data-step="-0.5" aria-label="Decrease demo '+esc(z.title)+' temperature">−</button><strong data-zone-target="'+esc(z.id)+'">'+fmt(room.target)+'°</strong><button type="button" data-temperature="'+esc(z.id)+'" data-step="0.5" aria-label="Increase demo '+esc(z.title)+' temperature">+</button></div><label class="zone-slider-row"><span class="sr-only">Slide '+esc(z.title)+' target</span><span aria-hidden="true">10°</span><input type="range" min="10" max="28" step="0.5" value="'+room.target+'" data-zone-range="'+esc(z.id)+'" aria-label="Slide '+esc(z.title)+' simulated temperature"><span aria-hidden="true">28°</span></label></div>';
    }).join("");
    $("routineList").innerHTML=DATA.routines.map(r=>'<div class="routine-item"><span class="routine-icon" aria-hidden="true">'+esc(r.icon)+'</span><span><strong>'+esc(r.name)+'</strong><small>'+esc(r.detail)+'</small></span><span class="routine-state">Idea</span></div>').join("");
    void bedroom;
  }
  function renderRooms() {
    $("floorplan").innerHTML=state.rooms.map(room=>'<button type="button" class="floor-room '+(state.selectedRoom===room.id?"selected":"")+'" data-room="'+esc(room.id)+'" aria-pressed="'+(state.selectedRoom===room.id)+'"><span class="room-symbol" aria-hidden="true">'+esc(room.icon)+'</span><span class="room-name">'+esc(room.name)+'</span><span class="room-heat">'+fmt(room.current)+'°C · '+(room.lights?"light on":"light off")+'</span></button>').join("");
    const r=refs[state.selectedRoom];
    $("roomInspector").innerHTML=
      '<div class="inspector-top"><span class="overline">ROOM CONTROL · DEMO</span><span aria-hidden="true">'+esc(r.icon)+'</span></div>'+
      '<h3 class="inspector-name">'+esc(r.name)+'</h3><p class="inspector-subtitle">'+esc(r.detail)+'</p>'+
      window.HomeControlLab.rotaryMarkup({inspector:true})+
      '<label class="inspector-range-label" for="inspectorRoomRange">Slide or rotate to set a temperature</label>'+
      '<div class="inspector-range-wrap"><small>10°</small><input id="inspectorRoomRange" type="range" min="10" max="28" step="0.5" data-temp-range aria-label="Set '+esc(r.name)+' simulated temperature using slider"><small>28°</small></div>'+
      '<div class="inspector-buttons"><button type="button" data-temperature="'+esc(r.id)+'" data-step="-0.5" aria-label="Decrease '+esc(r.name)+' sample setpoint">−</button><button type="button" data-temperature="'+esc(r.id)+'" data-step="0.5" aria-label="Increase '+esc(r.name)+' sample setpoint">+</button></div>'+
      '<hr class="inspector-divider"><div class="inspector-row"><span>Humidity</span><strong>'+r.humidity+'% · synthetic</strong></div>'+
      '<div class="inspector-row"><span>Heating control</span><strong>'+(r.heating?"Proposed":"Not specified")+'</strong></div>'+
      '<div class="inspector-row"><span>Lighting · simulation</span><button type="button" class="light-toggle '+(r.lights?"is-on":"")+'" data-light="'+esc(r.id)+'" aria-pressed="'+r.lights+'">'+(r.lights?"● On":"○ Off")+'</button></div>'+
      '<div class="inspector-row"><span>Connection</span><strong>No live connection</strong></div>';
  }
  function renderEnergy() {
    const isWeek=state.period==="week";
    const bars=isWeek?DATA.sampleEnergy.week:DATA.sampleEnergy.day;
    const total=bars.reduce((a,b)=>a+b,0);
    const max=Math.max(...bars);
    const captions=isWeek?["MON","TUE","WED","THU","FRI","SAT","SUN"]:Array.from({length:24},(_,i)=>String(i).padStart(2,"0")+":00");
    const metrics=[
      {name:"SAMPLE DEMAND",value:isWeek?fmt(total)+" kWh":fmt(total)+" kWh",sub:isWeek?"Illustrative seven days":"Illustrative 24 hours"},
      {name:"EXAMPLE PEAK",value:fmt(max)+" kW",sub:isWeek?"Daily kWh peak in sample":"Highest hourly demand in sample"},
      {name:"ASSUMED UNIT RATE",value:"24p",sub:"Arbitrary example, not your tariff"},
      {name:"SAMPLE COST",value:"£"+fmt(total*.24*10/10),sub:"Calculated from illustrative demand"}
    ];
    if(isWeek)metrics[1]={name:"HIGHEST SAMPLE DAY",value:fmt(max)+" kWh",sub:"Weekly chart uses daily energy"};
    $("energyKpis").innerHTML=metrics.map(m=>'<div class="energy-kpi"><span class="overline">'+esc(m.name)+'</span><strong>'+esc(m.value)+'</strong><span class="kpi-caption">'+esc(m.sub)+'</span></div>').join("");
    $("periodControl").querySelectorAll("button").forEach(btn=>btn.setAttribute("aria-pressed",String(btn.dataset.period===state.period)));
    $("energyChart").innerHTML=bars.map((n,i)=>{
      const caption=captions[i];
      const shown=isWeek || i%4===0;
      const height=Math.max(7,Math.round(n/max*95));
      const selected=state.selectedBar===i?"active":"";
      const unit=isWeek?"kWh":"kW";
      return '<button type="button" class="chart-bar '+selected+'" style="height:'+height+'%" data-bar="'+i+'" aria-label="'+esc(caption)+': '+fmt(n)+' '+unit+' (illustrative)" title="'+esc(caption)+': '+fmt(n)+' '+unit+' (sample)">'+(shown?"<span>"+esc(caption)+"</span>":"")+'</button>';
    }).join("");
    if(state.selectedBar!==null && state.selectedBar<bars.length)
      $("chartSelection").textContent=captions[state.selectedBar]+" · "+fmt(bars[state.selectedBar])+" "+(isWeek?"kWh":"kW")+" · sample only";
    else $("chartSelection").textContent="Select a bar to inspect a synthetic reading.";
    $("energyLegend").innerHTML=DATA.sampleEnergy.mix.map(x=>'<div class="legend-item"><span><i style="background:'+esc(x.colour)+'"></i>'+esc(x.name)+'</span><strong>'+x.value+'%</strong></div>').join("");
    $("gridPower").textContent=state.ev?"5.8 kW":"2.4 kW";
    $("evToggle").checked=state.ev;
    $("evState").textContent=state.ev?"Sample charging schedule enabled. No real charger, tariff or schedule was changed.":"Schedule off in this example. No charging hardware is connected.";
  }

  function badge(stage) {
    const label={reported:"Reported hardware",verify:"Needs verification",idea:"Planned idea"};
    return '<span class="status-pill status-'+esc(stage)+'">'+label[stage]+'</span>';
  }
  function filteredSystems() {
    return DATA.systems.filter(x=>{
      const stageMatches=state.filter==="all"||x.stage===state.filter;
      const q=state.query.trim().toLowerCase();
      const text=[x.name,x.category,x.goal,x.detail,x.zero,x.status].join(" ").toLowerCase();
      return stageMatches&&(!q||text.includes(q));
    }).sort((a,b)=>a.priority-b.priority||a.name.localeCompare(b.name));
  }
  function renderRegister() {
    const filtered=filteredSystems();
    $("emptyInventory").hidden=filtered.length!==0;
    $("inventoryRows").innerHTML=filtered.map(sys=>{
      const expanded=state.expanded.has(sys.id), detailId="detail-"+sys.id;
      const text='<tr><td><strong class="inventory-name">'+esc(sys.name)+'</strong><small class="inventory-category">'+esc(sys.category)+'</small></td><td>'+esc(sys.goal)+'</td><td>'+badge(sys.stage)+'</td><td>'+esc(sys.zero)+'</td><td><button type="button" class="detail-button" data-detail="'+esc(sys.id)+'" aria-expanded="'+expanded+'" aria-controls="'+detailId+'">'+(expanded?"Less −":"Details +")+'</button></td></tr>';
      const details='<tr id="'+detailId+'" class="inventory-detail" '+(expanded?"":"hidden")+'><td colspan="5"><strong>Current evidence: </strong>'+esc(sys.status)+'.<br><strong>Implementation notes: </strong>'+esc(sys.detail)+'<br><strong>Dependencies: </strong>'+esc(sys.requires)+(sys.docs?'<br><a href="'+esc(sys.docs)+'" target="_blank" rel="noopener noreferrer">Official / community reference ↗</a>':"")+'</td></tr>';
      return text+details;
    }).join("");
  }
  function renderMilestones() {
    const done=state.tasks.size,all=DATA.milestones.length;
    $("taskPercentage").textContent=Math.round(done/all*100)+"%";
    $("taskCount").textContent=done+" / "+all+" planning milestones";
    $("progressFill").style.width=(done/all*100)+"%";
    $("milestoneList").innerHTML=DATA.milestones.map((x,i)=>{
      const checked=state.tasks.has(x.id);
      return '<label class="milestone-item '+(checked?"completed":"")+'"><input type="checkbox" data-task="'+esc(x.id)+'" '+(checked?"checked":"")+'><span><strong>'+String(i+1).padStart(2,"0")+'. '+esc(x.title)+'</strong><small>'+esc(x.detail)+'</small></span></label>';
    }).join("");
  }
  function renderSystems() {
    const counts={reported:0,idea:0,verify:0};
    DATA.systems.forEach(s=>counts[s.stage]++);
    const totals=[
      {value:DATA.systems.length,label:"Workstreams tracked"},
      {value:counts.reported,label:"Reported hardware / systems"},
      {value:counts.verify,label:"Need identification"},
      {value:counts.idea,label:"Proposed integrations"}
    ];
    $("systemsCounters").innerHTML=totals.map(x=>'<div class="systems-counter"><strong>'+x.value+'</strong><span>'+esc(x.label)+'</span></div>').join("");
    $("systemSearch").value=state.query;
    $("systemFilter").value=state.filter;
    renderRegister();renderMilestones();
  }

  function updateFeedback() {
    const tab=state.tab,label=labelByTab[tab];
    $("notesLabel").textContent="Notes on “"+label+"”";
    $("designNotes").value=typeof state.notes[tab]==="string"?state.notes[tab]:"";
    const isFavourite=state.favourite===tab;
    $("favouriteBtn").textContent=isFavourite?"★ Favourite design":"☆ Mark as favourite";
    $("favouriteBtn").setAttribute("aria-pressed",String(isFavourite));
    $("reviewFavouriteStatus").textContent=state.favourite?"Favourite: "+labelByTab[state.favourite]:"No favourite selected yet";
  }
  function copyFeedback() {
    const notes=tabKeys.map(k=>labelByTab[k]+": "+(state.notes[k]||"No notes")).join("\n\n");
    const finished=DATA.milestones.filter(x=>state.tasks.has(x.id)).map(x=>x.title).join("; ")||"None marked";
    const preferredControls=window.HomeControlLab?.options.filter(x=>state.shortlisted.has(x.id)).map(x=>x.name).join(", ")||"No individual control shortlisted";
    const message="Home Automation Studio — design brief\nVersion: 0.2.0\nFavourite: "+(state.favourite?labelByTab[state.favourite]:"Not chosen")+"\nPreferred interactions: "+preferredControls+"\n\n"+notes+"\n\nPlanning checkmarks (self-reported, not verified): "+finished+"\n\nPrototype: https://nirav2000.github.io/Apps/home-automation/\n";
    const btn=$("copyFeedback");
    if(navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(message).then(()=>toast("Design brief copied")).catch(()=>fallbackCopy(message,btn));
    } else fallbackCopy(message,btn);
  }
  function fallbackCopy(text,btn) {
    const ta=document.createElement("textarea");ta.value=text;ta.style.position="fixed";ta.style.left="-9999px";document.body.append(ta);ta.select();
    let ok=false;try {ok=document.execCommand("copy");} catch {ok=false;}
    ta.remove();
    if(ok)toast("Design brief copied");
    else { $("designNotes").focus();toast("Copy not permitted. Select your notes manually."); }
    void btn;
  }
  function resetDemo() {
    state.scene="home";state.selectedRoom="living";state.period="day";state.selectedBar=null;state.ev=false;
    state.rooms=DATA.rooms.map(r=>({...r}));
    Object.keys(refs).forEach(id=>{refs[id]=state.rooms.find(r=>r.id===id);});
    renderOverview();renderRooms();renderEnergy();window.HomeControlLab?.reset();
    toast("Demonstration reset · saved design notes unchanged");
  }

  document.addEventListener("click",e=>{
    const button=e.target.closest("button");if(!button)return;
    if(button.dataset.tab){setTab(button.dataset.tab,{focus:true});return;}
    if(button.dataset.go){setTab(button.dataset.go);$("conceptNav").scrollIntoView({behavior:"smooth",block:"start"});return;}
    if(button.dataset.scene){applyScene(button.dataset.scene);return;}
    if(button.dataset.temperature){changeTemperature(button.dataset.temperature,Number(button.dataset.step));return;}
    if(button.dataset.room){state.selectedRoom=button.dataset.room;renderRooms();window.HomeControlLab?.refresh();return;}
    if(button.dataset.light){toggleLight(button.dataset.light);return;}
    if(button.dataset.period){
      state.period=button.dataset.period;state.selectedBar=null;renderEnergy();return;
    }
    if(button.dataset.bar!==undefined) {
      state.selectedBar=Number(button.dataset.bar);renderEnergy();return;
    }
    if(button.dataset.detail){
      const id=button.dataset.detail;
      if(state.expanded.has(id))state.expanded.delete(id);else state.expanded.add(id);
      renderRegister();return;
    }
  });
  $("conceptNav").addEventListener("keydown",e=>{
    const key=e.key;if(!["ArrowLeft","ArrowRight","Home","End"].includes(key))return;
    e.preventDefault();const n=tabKeys.indexOf(state.tab);
    const index=key==="Home"?0:key==="End"?tabKeys.length-1:(n+(key==="ArrowRight"?1:-1)+tabKeys.length)%tabKeys.length;
    setTab(tabKeys[index],{focus:true});
  });
  document.addEventListener("input",e=>{
    const input=e.target.closest("[data-zone-range]");
    if(input)setRoomTarget(input.dataset.zoneRange,Number(input.value),{continuous:true});
  });
  $("systemSearch").addEventListener("input",e=>{state.query=e.target.value;renderRegister();});
  $("systemFilter").addEventListener("change",e=>{state.filter=e.target.value;renderRegister();});
  $("evToggle").addEventListener("change",e=>{state.ev=e.target.checked;renderEnergy();toast("Charging simulation updated, no real charger changed");});
  $("milestoneList").addEventListener("change",e=>{
    if(!e.target.matches('input[data-task]'))return;
    const id=e.target.dataset.task;
    if(e.target.checked)state.tasks.add(id);else state.tasks.delete(id);
    renderMilestones();
    $("reviewSaveStatus").textContent=persist()?"Planning notes saved locally.":"Could not save locally; browser may block storage.";
  });
  $("resetTasks").addEventListener("click",()=>{state.tasks.clear();renderMilestones();persist();toast("Planning checkmarks cleared");});
  $("designNotes").addEventListener("input",e=>{
    state.notes[state.tab]=e.target.value;
    $("reviewSaveStatus").textContent=persist()?"Saved in this browser only.":"Storage unavailable. Copy your notes to retain them.";
  });
  $("favouriteBtn").addEventListener("click",()=>{state.favourite=state.favourite===state.tab?null:state.tab;persist();updateFeedback();toast(state.favourite?"Favourite selected":"Favourite removed");});
  $("copyFeedback").addEventListener("click",copyFeedback);
  $("resetDemo").addEventListener("click",resetDemo);
  $("jumpPlan").addEventListener("click",()=>{setTab("systems");$("conceptNav").scrollIntoView({behavior:"smooth",block:"start"});});
  window.addEventListener("hashchange",()=>{const hash=location.hash.slice(1);if(tabKeys.includes(hash))setTab(hash,{updateHash:false});});

  renderOverview();renderRooms();renderEnergy();renderSystems();
  setTab(state.tab,{updateHash:false});
  window.HomeControlLab.mount({
    getTemp:()=>refs[state.selectedRoom].target,
    setTemp:(value,options)=>setRoomTarget(state.selectedRoom,value,options),
    currentRoom:()=>state.selectedRoom,
    changeRoom:(id)=>{if(refs[id]){state.selectedRoom=id;renderRooms();window.HomeControlLab.refresh();}},
    allRooms:DATA.rooms,
    selections:()=>[...state.shortlisted],
    onPick:(id)=>{
      if(state.shortlisted.has(id))state.shortlisted.delete(id);
      else state.shortlisted.add(id);
      $("reviewSaveStatus").textContent=persist()?"Control preferences saved in this browser.":"Storage unavailable. Copy your design brief to keep your choices.";
    }
  });
})();
