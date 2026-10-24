/* Home Automation Studio — Control Playground v0.2.0.
 * Live, accessible demonstration interactions. Never contacts or controls hardware.
 * Shared sample room target is supplied by app.js, not by a provider connection.
 */
(() => {
  "use strict";
  const MIN = 10, MAX = 28, STEP = 0.5, SWEEP = 300, START = 210;
  const CONTROL_OPTIONS = [
    {id:"hybrid",name:"Slider + buttons",summary:"Best of both: quick sliding, precise half-degree steps.",tag:"ALL-ROUNDER"},
    {id:"rotary",name:"Rotary dial",summary:"Rotate the ring with your finger or mouse, just like a physical thermostat.",tag:"TACTILE"},
    {id:"scrub",name:"Temperature ruler",summary:"Drag along a scale; tap any point to jump to a temperature.",tag:"VISUAL"},
    {id:"fader",name:"Vertical fader",summary:"An audio-mixer style lever with instant visual feedback.",tag:"PLAYFUL"},
    {id:"presets",name:"One-tap presets",summary:"Choose the mood instead of calculating a number.",tag:"EFFORTLESS"},
    {id:"keypad",name:"Direct entry",summary:"Type an exact target and apply it — no repeated taps.",tag:"PRECISE"},
    {id:"stepper",name:"Oversized ±",summary:"Large, simple targets for everyday use.",tag:"ACCESSIBLE"},
    {id:"picker",name:"Native picker",summary:"Use the phone's built-in selection interface.",tag:"FAMILIAR"}
  ];
  const $ = id => document.getElementById(id);
  const clamp = n => Math.max(MIN,Math.min(MAX,n));
  const quantise = v => clamp(Math.round((Number(v)-MIN)/STEP)*STEP+MIN);
  const format = n => Number(n).toFixed(1);
  const esc = s => String(s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  const stepButtons = (id, label) =>
    '<button type="button" class="lab-step lab-step-minus" data-temp-step="-0.5" aria-label="Decrease '+esc(label)+' by 0.5°C">−</button>'+
    '<button type="button" class="lab-step lab-step-plus" data-temp-step="0.5" aria-label="Increase '+esc(label)+' by 0.5°C">+</button>';
  const labelValue = (extra="") => '<span class="lab-value '+extra+'" data-target-display>21.0°</span>';
  const valueOptions = Array.from({length:(MAX-MIN)/STEP+1},(_,i)=>{
    const n = MIN+i*STEP;
    return '<option value="'+n+'">'+format(n)+' °C</option>';
  }).join("");

  let getTemperature = () => 21;
  let setTemperature = () => {};
  let getRoomId = () => "living";
  let setRoomId = () => {};
  let getSelections = () => [];
  let toggleSelection = () => {};
  let rooms = [];
  let mounted = false;
  let activePointer = null;
  let demo = {dimmer:65, fan:"auto", boost:0};

  const variant = (n, body, descriptor) => {
    const opt = CONTROL_OPTIONS[n-1];
    return '<article class="lab-card lab-card-'+esc(opt.id)+'" data-control-card="'+esc(opt.id)+'">'+
      '<div class="lab-card-heading"><span class="lab-number">'+String(n).padStart(2,"0")+'</span><span class="lab-tag">'+esc(opt.tag)+'</span></div>'+
      '<h3>'+esc(opt.name)+'</h3><p class="lab-summary">'+esc(opt.summary)+'</p>'+
      '<div class="lab-experiment">'+body+'</div>'+
      '<div class="lab-card-bottom"><span>'+esc(descriptor)+'</span>'+
      '<button type="button" data-pick-control="'+esc(opt.id)+'" class="lab-shortlist" aria-pressed="false">☆ Shortlist</button></div></article>';
  };

  function rotaryMarkup({inspector=false}={}) {
    const className = inspector ? "thermostat-dial inspector-rotary" : "lab-rotary";
    const centre = inspector
      ? '<div class="dial-centre"><span>TARGET</span><strong data-inspector-value>21.0°</strong><small data-inspector-current>CURRENT 20.4°C</small></div>'
      : '<div class="lab-rotary-centre"><small>SET TEMPERATURE</small><strong data-target-display>21.0°</strong><span>°C · DEMO</span></div>';
    return '<div class="'+className+'" data-rotary tabindex="0" role="slider" aria-label="Rotate simulated thermostat setpoint" aria-valuemin="'+MIN+'" aria-valuemax="'+MAX+'" aria-valuenow="21" aria-valuetext="21 degrees Celsius; simulated" aria-orientation="horizontal" style="--sweep:183.33deg">'+
      '<span class="lab-rotary-pointer" aria-hidden="true"></span>'+centre+'</div>';
  }

  function build() {
    return '<div class="lab-section-heading"><div><span class="lab-kicker">08 DIFFERENT WAYS TO SET EXACTLY THE SAME TEMPERATURE</span><h3>One target. Eight interactions.</h3><p>Try every control; they are all synchronised to your selected sample room. Shortlist as many as you like.</p></div><div class="lab-sync"><span class="lab-sync-light"></span> ALL CONTROLS LINKED</div></div>'+
      '<div class="lab-card-grid">'+
      variant(1,
        '<div class="lab-hybrid-hero">'+labelValue()+'<small>Target temperature</small></div>'+
        '<div class="lab-hybrid-row">'+
          '<button type="button" class="lab-hybrid-step" data-temp-step="-0.5" aria-label="Decrease slider target by 0.5°C">−</button>'+
          '<label class="lab-slider-label"><span class="sr-only">Temperature slider, 10 to 28 degrees</span>'+
            '<input id="labHybridRange" type="range" min="10" max="28" step="0.5" value="21" data-temp-range aria-label="Set simulated temperature with slider"></label>'+
          '<button type="button" class="lab-hybrid-step" data-temp-step="0.5" aria-label="Increase slider target by 0.5°C">+</button>'+
        '</div><div class="lab-range-labels"><span>10°</span><span>19°</span><span>28°</span></div>',
        'Drag, tap or press ±')+
      variant(2,
        '<div class="lab-dial-space">'+rotaryMarkup()+'</div>'+
        '<div class="lab-ring-help">↻ Touch and rotate the ring · Arrow keys also work</div>',
        'Circular gesture · 0.5° steps')+
      variant(3,
        '<div class="lab-ruler-value">'+labelValue()+'<small>Drag along the track</small></div>'+
        '<div class="lab-ruler" data-scrub role="slider" tabindex="0" aria-label="Scrub simulated temperature ruler" aria-valuemin="10" aria-valuemax="28" aria-valuenow="21" aria-valuetext="21 degrees Celsius; simulated">'+
          '<div class="lab-ruler-fill"></div><span class="lab-ruler-handle" aria-hidden="true"></span>'+
        '</div><div class="lab-ruler-ticks"><span>10°</span><span>14°</span><span>19°</span><span>23°</span><span>28°</span></div>'+
        '<p class="lab-instruction">Click, touch or slide anywhere</p>',
        'Tactile horizontal scale')+
      variant(4,
        '<div class="lab-fader-layout"><div class="lab-fader-track"><label class="sr-only" for="labVerticalRange">Temperature vertical fader</label>'+
         '<input id="labVerticalRange" data-temp-range type="range" min="10" max="28" step="0.5" value="21" aria-label="Vertical temperature fader"></div>'+
         '<div class="lab-fader-content"><span class="lab-fader-hot">WARMER ↑</span>'+labelValue()+'<span class="lab-fader-cold">↓ COOLER</span></div></div>',
        'Vertical swipe or keyboard')+
      variant(5,
        '<div class="lab-preset-hero"><span>CHOOSE A FEELING</span>'+labelValue()+'</div>'+
        '<div class="lab-presets">'+
         '<button type="button" data-preset="16" aria-pressed="false"><span>☘</span><strong>Eco</strong><small>16°</small></button>'+
         '<button type="button" data-preset="19" aria-pressed="false"><span>☾</span><strong>Sleep</strong><small>19°</small></button>'+
         '<button type="button" data-preset="21" aria-pressed="false"><span>⌂</span><strong>Home</strong><small>21°</small></button>'+
         '<button type="button" data-preset="23" aria-pressed="false"><span>☀</span><strong>Cosy</strong><small>23°</small></button>'+
        '</div>',
        'Single tap · suggested values')+
      variant(6,
        '<div class="lab-number-pad"><label for="labNumberInput">EXACT TARGET · °C</label>'+
         '<div class="lab-input-row"><input type="number" id="labNumberInput" min="10" max="28" step="0.5" inputmode="decimal" value="21" aria-describedby="labNumberHint"><span>°C</span><button type="button" data-number-apply>Apply ↗</button></div>'+
         '<p id="labNumberHint">Enter 10–28 °C, in half-degree increments.</p><div id="labNumberError" role="status" aria-live="polite"></div></div>',
        'Exact, editable numeric input')+
      variant(7,
        '<div class="lab-big-stepper"><div class="lab-big-value">'+labelValue()+'<small>SIMULATED TARGET</small></div>'+
         '<div class="lab-big-actions"><button type="button" data-temp-step="-0.5" aria-label="Decrease large-stepper target by half a degree">−</button>'+
         '<button type="button" data-temp-step="0.5" aria-label="Increase large-stepper target by half a degree">+</button></div></div>',
        'Huge touch targets')+
      variant(8,
        '<div class="lab-picker-hero"><div class="lab-picker-display">'+labelValue()+'<small>Temperature selection</small></div>'+
         '<label for="labNativePicker">USE YOUR PHONE’S PICKER</label>'+
         '<select id="labNativePicker" data-temp-select aria-label="Choose a simulated temperature from a list">'+valueOptions+'</select></div>',
        'Native iPhone / Android selector')+
      '</div>'+
      '<div class="lab-section-heading lab-secondary-heading"><div><span class="lab-kicker">CONTROL CONCEPTS BEYOND THERMOSTATS</span><h3>Same idea, different device.</h3><p>Also experiment with lighting, ventilation and hot water. These are separate simulations.</p></div></div>'+
      '<div class="lab-utilities">'+
        '<article class="lab-util lab-util-light"><div><span class="lab-util-eyebrow">01 / LIGHTING</span><h3>Dimmer with mood feedback.</h3><p>Brightness affects the preview as you slide.</p></div><div class="lab-light-visual" id="labLightVisual"><span>✳</span></div><div class="lab-util-footer"><label for="labDimmer">Brightness <strong id="labDimmerLabel">65%</strong></label><input type="range" id="labDimmer" min="0" max="100" value="65" step="5" aria-label="Simulated light brightness"></div></article>'+
        '<article class="lab-util lab-util-fan"><div><span class="lab-util-eyebrow">02 / VENTILATION</span><h3>Three modes. One clear state.</h3><p>Fan behaviour should be immediately understandable.</p></div><div class="lab-fan-emblem" aria-hidden="true">✥</div><div class="lab-fan-modes" role="group" aria-label="Example extractor modes"><button type="button" data-fan-mode="off">Off</button><button type="button" data-fan-mode="auto">Auto</button><button type="button" data-fan-mode="on">On</button></div><p class="lab-fan-status" id="labFanStatus" aria-live="polite"></p></article>'+
        '<article class="lab-util lab-util-water"><div><span class="lab-util-eyebrow">03 / HOT WATER</span><h3>One-tap timed boost.</h3><p>See the duration and a clear finish state.</p></div><div class="lab-water-icon" aria-hidden="true">♨</div><div class="lab-boost-options" role="group" aria-label="Example hot water boost duration"><button type="button" data-boost="0">Off</button><button type="button" data-boost="15">15m</button><button type="button" data-boost="30">30m</button><button type="button" data-boost="60">1h</button></div><p class="lab-boost-status" id="labBoostStatus" aria-live="polite"></p></article>'+
      '</div>'+
      '<section class="lab-decision"><div><span class="lab-kicker">YOUR SHORTLIST</span><h3>Build a dashboard from the best parts.</h3><p>Shortlist your favourite controls independently of the overall dashboard design. Your choices are included when you copy the design brief.</p></div><div><div id="labShortlist" class="lab-shortlist-status" aria-live="polite">Nothing shortlisted yet</div><button type="button" class="lab-feedback-link" data-scroll-to-feedback>Add notes to your design brief ↗</button></div></section>';
  }

  function mount({getTemp, setTemp, currentRoom, changeRoom, allRooms, selections, onPick}) {
    if(mounted) return;
    if(!$("controlLabHost"))return;
    getTemperature=getTemp;
    setTemperature=setTemp;
    getRoomId=currentRoom;
    setRoomId=changeRoom;
    rooms=allRooms;
    getSelections=selections;
    toggleSelection=onPick;
    $("controlLabHost").innerHTML=build();
    const picker=$("labRoomPicker");
    picker.innerHTML=rooms.map(r=>'<option value="'+esc(r.id)+'">'+esc(r.name)+'</option>').join("");
    mounted=true;
    document.addEventListener("click",onClick);
    document.addEventListener("input",onInput);
    document.addEventListener("change",onChange);
    document.addEventListener("keydown",onKeydown);
    document.addEventListener("pointerdown",onPointerDown);
    document.addEventListener("pointermove",onPointerMove);
    document.addEventListener("pointerup",onPointerEnd);
    document.addEventListener("pointercancel",onPointerEnd);
    document.addEventListener("lostpointercapture",onPointerEnd,true);
    refresh();
    refreshUtilities();
  }

  function roomTarget() {
    return quantise(getTemperature());
  }
  function setTarget(value,{continuous=false}={}) {
    if(!Number.isFinite(Number(value)))return;
    const next=quantise(value);
    setTemperature(next,{continuous});
    refresh();
  }

  function refresh({inspectorOnly=false}={}) {
    if(!mounted)return;
    const value=roomTarget(),pct=(value-MIN)/(MAX-MIN)*100;
    const room=rooms.find(r=>r.id===getRoomId());
    const allRoots=[...document.querySelectorAll('#controlLabHost [data-target-display],#labLiveTarget')];
    if(!inspectorOnly)allRoots.forEach(el=>{el.textContent=format(value)+'°';});
    const inspectorValue=document.querySelector("#roomInspector [data-inspector-value]");
    if(inspectorValue)inspectorValue.textContent=format(value)+'°';
    const inspectorRoomSlider=document.querySelector("#roomInspector [data-temp-range]");
    if(inspectorRoomSlider){
      if(document.activeElement!==inspectorRoomSlider || !activePointer)inspectorRoomSlider.value=String(value);
      inspectorRoomSlider.style.setProperty("--fill",pct+"%");
    }
    for(const slider of document.querySelectorAll('#controlLabHost [data-temp-range]')){
      slider.value=String(value);
      slider.style.setProperty("--fill",pct+"%");
    }
    for(const picker of document.querySelectorAll('#controlLabHost [data-temp-select]'))picker.value=String(value);
    const numeric=$("labNumberInput");
    if(numeric && document.activeElement!==numeric)numeric.value=String(value);
    if(room){
      $("labRoomPicker").value=room.id;
      $("labRoomCurrent").textContent='Current example: '+format(room.current)+'°C';
      $("labRoomType").textContent=room.id==="bathroom"?"Warmup Element · hypothetical room":room.id==="living"?"Wiser example · hypothetical zone":"Sample room · no connected sensor";
      const inspectorCurrent=document.querySelector("#roomInspector [data-inspector-current]");
      if(inspectorCurrent)inspectorCurrent.textContent="CURRENT "+format(room.current)+"°C";
    }
    for(const ring of document.querySelectorAll("[data-rotary]")) {
      ring.style.setProperty("--sweep",(pct/100*SWEEP)+"deg");
      ring.setAttribute("aria-valuenow",String(value));
      ring.setAttribute("aria-valuetext",format(value)+" degrees Celsius; simulation");
    }
    for(const ruler of document.querySelectorAll("[data-scrub]")){
      ruler.style.setProperty("--fill",pct+"%");
      ruler.setAttribute("aria-valuenow",String(value));
      ruler.setAttribute("aria-valuetext",format(value)+" degrees Celsius; simulation");
    }
    for(const preset of document.querySelectorAll("[data-preset]")){
      const selected=Number(preset.dataset.preset)===value;
      preset.setAttribute("aria-pressed",String(selected));
      preset.classList.toggle("selected",selected);
    }
    for(const button of document.querySelectorAll("[data-pick-control]")){
      const selected=getSelections().includes(button.dataset.pickControl);
      button.classList.toggle("selected",selected);
      button.setAttribute("aria-pressed",String(selected));
      button.textContent=selected?"★ Shortlisted":"☆ Shortlist";
    }
    const picked=CONTROL_OPTIONS.filter(x=>getSelections().includes(x.id)).map(x=>x.name);
    const list=$("labShortlist");
    if(list)list.textContent=picked.length?picked.join(" · "):"Nothing shortlisted yet";
  }

  function refreshUtilities() {
    if(!mounted)return;
    const light=$("labLightVisual");
    light.style.setProperty("--brightness",demo.dimmer/100);
    light.classList.toggle("is-off",demo.dimmer===0);
    $("labDimmerLabel").textContent=demo.dimmer+"%";
    $("labDimmer").value=String(demo.dimmer);
    const fanText={off:"Off — fan stopped in this simulation.",auto:"Auto — would respond to humidity. Example reading: 67% RH.",on:"On — manual override active in this simulation."};
    $("labFanStatus").textContent=fanText[demo.fan];
    for(const button of document.querySelectorAll("[data-fan-mode]")){
      const selected=button.dataset.fanMode===demo.fan;
      button.classList.toggle("selected",selected);button.setAttribute("aria-pressed",String(selected));
    }
    const waterText=demo.boost?("Simulated "+demo.boost+"-minute boost selected. No hot-water circuit operated."):"Off — no simulated hot-water boost.";
    $("labBoostStatus").textContent=waterText;
    for(const button of document.querySelectorAll("[data-boost]")){
      const selected=Number(button.dataset.boost)===demo.boost;
      button.classList.toggle("selected",selected);button.setAttribute("aria-pressed",String(selected));
    }
  }

  function onClick(e) {
    const btn=e.target.closest("button");
    if(!btn)return;
    if(btn.dataset.tempStep!==undefined){
      setTarget(roomTarget()+Number(btn.dataset.tempStep));
    } else if(btn.dataset.preset!==undefined){
      setTarget(Number(btn.dataset.preset));
    } else if(btn.dataset.pickControl){
      toggleSelection(btn.dataset.pickControl);
      refresh();
    } else if(btn.hasAttribute("data-number-apply")){
      applyTypedValue();
    } else if(btn.dataset.fanMode){
      demo.fan=btn.dataset.fanMode;refreshUtilities();
    } else if(btn.dataset.boost!==undefined){
      demo.boost=Number(btn.dataset.boost);refreshUtilities();
    } else if(btn.hasAttribute("data-scroll-to-feedback")){
      $("feedbackTitle")?.scrollIntoView({behavior:"smooth",block:"start"});
      $("designNotes")?.focus({preventScroll:true});
    }
  }
  function onInput(e) {
    const el=e.target;
    if(el.matches("[data-temp-range]"))setTarget(Number(el.value),{continuous:true});
    else if(el.id==="labDimmer"){
      demo.dimmer=Number(el.value);refreshUtilities();
    }
  }
  function onChange(e) {
    if(e.target.id==="labRoomPicker"){setRoomId(e.target.value);refresh();}
    else if(e.target.matches("[data-temp-select]"))setTarget(Number(e.target.value));
    else if(e.target.matches("[data-temp-range]"))refresh();
  }
  function applyTypedValue(){
    const input=$("labNumberInput");
    const error=$("labNumberError");
    const raw=String(input.value).trim(),value=Number(raw);
    if(!raw||!Number.isFinite(value)||value<MIN||value>MAX||Math.abs((value-MIN)/STEP-Math.round((value-MIN)/STEP))>0.00001){
      error.textContent="Choose between 10 and 28°C in 0.5°C steps.";
      input.setAttribute("aria-invalid","true");
      input.focus();
      return;
    }
    error.textContent="";
    input.removeAttribute("aria-invalid");
    setTarget(value);
  }

  function onKeydown(e){
    if(e.target.id==="labNumberInput"&&e.key==="Enter"){e.preventDefault();applyTypedValue();return;}
    const el=e.target.closest("[data-rotary],[data-scrub]");
    if(!el)return;
    let value=roomTarget();
    if(e.key==="ArrowRight"||e.key==="ArrowUp")value+=STEP;
    else if(e.key==="ArrowLeft"||e.key==="ArrowDown")value-=STEP;
    else if(e.key==="PageUp")value+=2;
    else if(e.key==="PageDown")value-=2;
    else if(e.key==="Home")value=MIN;
    else if(e.key==="End")value=MAX;
    else return;
    e.preventDefault();
    setTarget(value);
  }

  function pointerValue(el,e){
    const rect=el.getBoundingClientRect();
    if(el.hasAttribute("data-scrub")){
      const x=rect.width ? (e.clientX-rect.left)/rect.width : 0;
      return quantise(MIN+Math.max(0,Math.min(1,x))*(MAX-MIN));
    }
    const x=e.clientX-(rect.left+rect.width/2);
    const y=e.clientY-(rect.top+rect.height/2);
    // Zero degrees is 12 o'clock; 90 is 3 o'clock. The active arc
    // starts at 7 o'clock (210°) and runs clockwise through the top
    // to 5 o'clock (150°), with a 60° dead zone at the bottom.
    const clockwiseFromTop=(Math.atan2(y,x)*180/Math.PI+90+360)%360;
    const progress=(clockwiseFromTop-START+360)%360;
    if(progress>SWEEP)return null; // No jump across the inactive bottom gap.
    return quantise(MIN+(progress/SWEEP)*(MAX-MIN));
  }
  function onPointerDown(e){
    const el=e.target.closest("[data-rotary],[data-scrub]");
    if(!el||!mounted||e.button!==0)return;
    if(el.offsetParent===null)return; // Hidden panel isn't interactive.
    e.preventDefault(); // prevents touch scrolling during intentional drag
    el.focus({preventScroll:true});
    activePointer={id:e.pointerId,element:el};
    try{el.setPointerCapture(e.pointerId);}catch{/* lost capture is handled */}
    const next=pointerValue(el,e);
    if(next!==null)setTarget(next,{continuous:true});
  }
  function onPointerMove(e){
    if(!activePointer||activePointer.id!==e.pointerId)return;
    const next=pointerValue(activePointer.element,e);
    if(next!==null)setTarget(next,{continuous:true});
  }
  function onPointerEnd(e){
    if(!activePointer||activePointer.id!==e.pointerId)return;
    const el=activePointer.element;
    activePointer=null;
    try{if(el.hasPointerCapture(e.pointerId))el.releasePointerCapture(e.pointerId);}catch{/* noop */}
    refresh();
  }

  function reset(){
    demo={dimmer:65,fan:"auto",boost:0};
    refreshUtilities();refresh();
  }
  window.HomeControlLab={
    mount, refresh, reset, rotaryMarkup,
    options:CONTROL_OPTIONS.map(x=>({...x})),
    range:{min:MIN,max:MAX,step:STEP},
    quantise,
    pointerToValue:(angle)=>{const progress=((angle-START+360)%360);return progress>SWEEP?null:quantise(MIN+(progress/SWEEP)*(MAX-MIN));}
  };
})();
