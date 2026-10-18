/* AI Atlas: one bounded loader, independent evidence datasets, one render pass. */
(function () {
  'use strict';
  const VERSION = '1.0.1';
  const views = [['overview','Overview'],['money','Infrastructure'],['models','Model race'],['pricing','Token prices'],['customers','Customers & returns'],['world','Geography'],['local','Run locally'],['history','Historical atlas'],['method','Sources & method']];
  const $ = id => document.getElementById(id);
  const esc = value => String(value == null ? '' : value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const usd = n => Number.isFinite(n) ? '$' + n.toFixed(2) : 'Not captured';
  const arr = value => Array.isArray(value) ? value : [];
  let base = {}, history = {}, active = 'overview', busy = false;
  const state = window.AIAtlas = {version:VERSION,status:'loading',renders:0};
  function source(key, historical) {
    const s = historical ? history.sources && history.sources[key] : base.sources && base.sources[key];
    const item = s || (history.sources && history.sources[key]) || {};
    return /^https:\/\//.test(item.url || '') ? `<a href="${esc(item.url)}" target="_blank" rel="noopener noreferrer">${esc(item.label || key)} &nearr;</a>` : 'Source not recorded';
  }
  const row = cells => '<tr>' + cells.map(c=>'<td>'+c+'</td>').join('') + '</tr>';
  const table = (head, rows) => '<div class="table-scroll"><table><thead><tr>'+head.map(h=>'<th>'+h+'</th>').join('')+'</tr></thead><tbody>'+rows.join('')+'</tbody></table></div>';
  const panel = (title, content, note='') => `<section class="panel"><h2>${title}</h2>${note?'<p>'+note+'</p>':''}${content}</section>`;
  const options = values => values.map(v=>`<option value="${esc(v)}">${esc(v)}</option>`).join('');
  const choose = (id, label, values, all=false) => `<label>${label}<select id="${id}">${all?'<option value="">All</option>':''}${options(values)}</select></label>`;
  const unique = values => Array.from(new Set(values)).filter(Boolean);
  function selectView(id, update=true) {
    active = views.some(v=>v[0]===id) ? id : 'overview';
    document.querySelectorAll('[data-view]').forEach(el=>{el.hidden=el.dataset.view!==active;});
    document.querySelectorAll('[data-tab]').forEach(el=>{el.setAttribute('aria-selected',String(el.dataset.tab===active));el.tabIndex=el.dataset.tab===active?0:-1;});
    if(update) window.history.replaceState(null,'','#'+active);
  }
  function bars(id, entries) {
    const target=$(id); if(!target) return;
    if(!entries.length){target.innerHTML='<p class="empty">No records for these filters.</p>';return;}
    const max=Math.max(1,...entries.map(x=>x.bn));
    target.innerHTML='<div class="chart-wrap"><div class="chart">'+entries.map((x,i)=>`<button class="barcol" data-bar="${i}" aria-label="${esc(x.label)}: ${usd(x.bn)} billion. Show evidence."><b>${usd(x.bn)}</b><span class="bar" style="height:${Math.max(2,x.bn/max*160)}px"></span><span>${esc(x.label)}</span></button>`).join('')+'</div></div><div class="bar-detail" aria-live="polite">Tap a bar for its reporting basis and source.</div>';
    target.onclick=e=>{const b=e.target.closest('[data-bar]');if(!b)return;const x=entries[+b.dataset.bar];target.querySelector('.bar-detail').innerHTML=`<strong>${esc(x.label)}: ${usd(x.bn)}bn.</strong> ${esc(x.definition||x.basis||'Company-wide spending.')} ${source(x.source,x.historical)}`;};
  }
  function annualRows(){return arr(history.annual).filter(x=>x.company===$('histCompany').value&&x.year>=+$('histFrom').value&&x.year<=+$('histTo').value).sort((a,b)=>a.year-b.year);}
  function renderAnnual(){
    const data=annualRows();
    bars('histChart',data.map(x=>({...x,label:String(x.year),historical:true})));
    $('histTable').innerHTML=table(['Year / basis','Company','Spending ($bn)','Year-on-year','Source'],data.map(x=>{const prev=arr(history.annual).find(y=>y.company===x.company&&y.year===x.year-1);return row([`${x.year}${x.fiscalYear?' (June FY)':''}`,esc(x.company),x.bn.toFixed(3),prev?((x.bn/prev.bn-1)*100).toFixed(1)+'%':'Not captured',source(x.source,true)]);}));
  }
  function renderCapex(){
    const data=[...arr(history.quarterly).map(x=>({...x,historical:true})),...arr(base.capex)].filter(x=>x.company===$('capCompany').value).sort((a,b)=>a.period.localeCompare(b.period));
    bars('capChart',data.map(x=>({...x,label:x.period})));
    $('capTable').innerHTML=table(['Quarter','Reported $bn','Definition','Source'],data.map(x=>row([esc(x.period),x.bn.toFixed(3),esc(x.definition),source(x.source,x.historical)])));
  }
  function renderModels(){
    const region=$('modelRegion').value, weights=$('modelOpen').value, tier=$('modelTier').value, q=$('modelSearch').value.toLowerCase();
    const data=arr(base.models).filter(x=>(!region||x.country===region)&&(!weights||(weights==='Open')===x.open)&&(!tier||tier===x.tier)&&(x.name+' '+x.provider).toLowerCase().includes(q));
    $('modelTable').innerHTML=`<p class="small">${data.length} models match. Stored research snapshot, not a live ranking.</p>`+table(['Model','Provider / origin','Weights','Recorded index*','Input $/M','Output $/M','Evidence'],data.map(x=>row([`<strong>${esc(x.name)}</strong><small>${esc(x.note)}</small>`,`${esc(x.provider)}<small>${esc(x.country)}</small>`,x.open?'Open weights':'Proprietary',x.score==null?'Not captured':esc(x.score),usd(x.input),usd(x.output),`${source(x.pricingSource)}<small>${source(x.scoreSource)}</small>`])));
  }
  function calculate(){
    const m=arr(base.models).find(x=>x.name===$('priceModel').value), input=+$('inputTokens').value, output=+$('outputTokens').value;
    if(!m){$('priceResult').textContent='No priced models available.';return;}
    if(!Number.isFinite(input)||!Number.isFinite(output)||input<0||output<0){$('priceResult').textContent='Enter finite, non-negative token counts.';return;}
    const cost=(input*m.input+output*m.output)/1e6;
    $('priceResult').innerHTML=`<span>Estimated standard API charge</span><strong>$${cost.toFixed(4)}</strong><small>${esc(m.name)} &middot; ${source(m.pricingSource)}<br>${esc(m.note||'Check context, caching, reasoning and batch rates before using this estimate.')}</small>`;
  }
  function renderEvents(){
    const area=$('eventArea').value, country=$('eventCountry').value, q=$('eventSearch').value.toLowerCase();
    const data=arr(history.events).filter(x=>(!area||x.area===area)&&(!country||x.country===country)&&(x.title+' '+x.provider+' '+x.detail).toLowerCase().includes(q)).sort((a,b)=>b.date.localeCompare(a.date));
    $('eventResults').innerHTML=data.map(x=>`<article class="timeline-item"><time>${esc(x.date)}</time><div><strong>${esc(x.title)}</strong> <span class="tag">${esc(x.area)}</span><p>${esc(x.detail)}</p><span class="small">${esc(x.provider)} &middot; ${esc(x.country)} &middot; ${source(x.source,true)}</span></div></article>`).join('')||'<p class="empty">No matching events.</p>';
  }
  function csvExport(){
    const cell=v=>'"'+String(v).replace(/^[=+@-]/,"'").replace(/"/g,'""')+'"';
    const csv=[['company','year','period_end','usd_billions','source_url'],...annualRows().map(x=>[x.company,x.year,x.periodEnd,x.bn,(history.sources[x.source]||{}).url||''])].map(r=>r.map(cell).join(',')).join('\r\n');
    const url=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'})), link=document.createElement('a');
    link.href=url;link.download='ai-atlas-capex-history.csv';document.body.appendChild(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
  }
  function render(){
    $('tabs').innerHTML=views.map(([id,title])=>`<button type="button" id="tab-${id}" role="tab" aria-controls="view-${id}" data-tab="${id}" aria-selected="false">${title}</button>`).join('');
    $('tabs').setAttribute('role','tablist');
    $('content').innerHTML=views.map(([id,title])=>`<div id="view-${id}" data-view="${id}" role="tabpanel" aria-labelledby="tab-${id}" hidden></div>`).join('');
    const out=(id,html)=>{$('view-'+id).innerHTML=html;};
    const models=arr(base.models), annual=arr(history.annual), prices=[...arr(history.priceHistory).map(x=>({...x,historical:true})),...arr(base.priceHistory)].sort((a,b)=>a.date.localeCompare(b.date));
    const questions=arr(base.observations).map(x=>`<details class="question"><summary>${esc(x.question)} <span class="tag">${esc(x.state)}</span></summary><p>${esc(x.answer)}</p><span class="small">${source(x.source)}</span></details>`).join('');
    const tiles=[['Models in the snapshot',models.length,'Not a complete market census'],['Annual spending records',annual.length,'Company-wide, not AI-only'],['Historical token offers',prices.length,'Not a same-model price index'],['Dated milestones',arr(history.events).length,'Open each source for context']];
    out('overview','<div class="grid">'+tiles.map(x=>`<div class="tile"><span>${x[0]}</span><strong>${x[1]}</strong><small>${x[2]}</small></div>`).join('')+'</div>'+panel('The questions that matter',questions||'<p>The baseline dataset is unavailable. Use Historical atlas to explore the available history.</p>','Expand a question to see the stored evidence and its limitations.')+panel('A story across time','<div id="overviewChart"></div>','Alphabet annual company-wide capital spending ($bn). Tap a bar for evidence.'));
    bars('overviewChart',annual.filter(x=>x.company==='Alphabet').map(x=>({...x,label:String(x.year),historical:true})));
    out('money',panel('Infrastructure investment','<div class="controls">'+choose('capCompany','Company',unique([...arr(base.capex),...arr(history.quarterly)].map(x=>x.company)))+'</div><div id="capChart"></div><div id="capTable"></div>','Quarterly actuals. Different companies use different reporting definitions. No invented monthly expenditure.')+panel('Annual reporting and guidance',table(['Company','Period','Figure','Basis','Evidence'],[...arr(base.annualCapex).map(x=>row([esc(x.company),esc(x.year),usd(x.bn)+'bn',esc(x.definition),source(x.source)])),...arr(base.capexGuidance).map(x=>row([esc(x.company),esc(x.year),usd(x.lowBn)+' - '+usd(x.highBn)+'bn <span class="tag">forecast</span>',esc(x.definition),source(x.source)]))]),'Use Historical atlas for the longer annual series. Forecasts are not realised spending.'));
    $('capCompany').onchange=renderCapex;renderCapex();
    out('models',panel('Compare the model landscape','<div class="controls">'+choose('modelRegion','Origin',unique(models.map(x=>x.country)),true)+choose('modelOpen','Weights',['Open','Closed'],true)+choose('modelTier','Tier',unique(models.map(x=>x.tier)),true)+'<label>Find a model<input id="modelSearch" type="search" placeholder="Model or provider"></label></div><div id="modelTable"></div><p class="small">* Benchmarks are comparable only within the same suite, exact model variant and reasoning configuration. The recorded index is not a universal ranking. Open weights do not automatically mean open source.</p>'));
    ['modelRegion','modelOpen','modelTier'].forEach(id=>$(id).onchange=renderModels);$('modelSearch').oninput=renderModels;renderModels();
    out('pricing',panel('The price history',table(['Date / snapshot','Model','Input / million','Output / million','Source / basis'],prices.map(x=>row([esc(x.date),esc(x.model),usd(x.input),usd(x.output),source(x.source,x.historical)+`<small>${esc(x.type||x.note)}</small>`]))),'Nominal USD. Different models and launch offers must not be treated as a constant-quality price index.')+panel('Your token bill calculator','<div class="controls">'+choose('priceModel','Published model offer',models.filter(x=>Number.isFinite(x.input)&&Number.isFinite(x.output)).map(x=>x.name))+'<label>Input tokens<input id="inputTokens" type="number" min="0" value="1000000"></label><label>Output tokens<input id="outputTokens" type="number" min="0" value="200000"></label></div><div id="priceResult" class="tile"></div>','Excludes cache discounts, batch discounts, tools, taxes and context-dependent premiums.'));
    ['priceModel','inputTokens','outputTokens'].forEach(id=>$(id).oninput=calculate);calculate();
    out('customers',panel('Are investments paying off?',table(['Company / segment','Period','Indicator','Reported value','Evidence'],arr(base.demand).map(x=>row([esc(x.company),esc(x.period),esc(x.metric)+' <span class="tag">not AI-only</span>',(x.lowerBound?'Over ':'')+usd(x.bn)+'bn',source(x.source)]))),'Cloud revenue, contract backlog and cash flow are different measures. They cannot be added together as AI revenue.')+panel('Follow the return on investment','<p>Investment &rarr; usable capacity &rarr; utilisation &rarr; billed work &rarr; realised revenue &rarr; margin &rarr; cash flow.</p><p>Ask which steps have disclosed numbers. Revenue growth alone does not establish the return on AI infrastructure capital.</p>'));
    const countries=arr(history.countries);
    out('world',panel('A global AI economy',countries.map(x=>`<details class="question"><summary>${esc(x.country)}</summary><p>${esc(x.focus)}</p><p><strong>Players:</strong> ${arr(x.players).map(esc).join(', ')}</p><p><strong>Questions to investigate:</strong> ${arr(x.risks).map(esc).join('; ')}</p></details>`).join(''),'Provider origin, chip manufacturing and compute location are not interchangeable measures.')+panel('Providers in this model sample',table(['Provider','Origin','Recorded models'],unique(models.map(x=>x.provider)).map(p=>{const m=models.filter(x=>x.provider===p);return row([esc(p),esc(m[0].country),m.map(x=>esc(x.name)).join(', ')]);}))));
    out('local',panel('Run AI without provider token fees','<p>Open weights can be downloaded, but hardware and electricity still have costs. A model that is free to download is not necessarily practical on your computer.</p><div class="cols"><div><h3>On your own computer</h3><p>Start with a small quantised model supported by your hardware. Check available memory, context length, licence and expected speed.</p><p>'+source('lm')+' &middot; '+source('ollama')+'</p></div><div><h3>Hosted experiments</h3><p>Public demos can provide limited access. Free quotas, waiting queues and temporary offers are not unlimited hosting.</p><p>'+source('hf')+'</p></div></div>')+panel('Compare the full cost','<p>Model weights + working memory + context cache + power + hardware cost + your time. Compare the cost of a successful task, not just the price of one token.</p>'));
    const years=unique(annual.map(x=>String(x.year))).sort();
    out('history',panel('Seven years of infrastructure','<div class="controls">'+choose('histCompany','Company',unique(annual.map(x=>x.company)))+choose('histFrom','From',years)+choose('histTo','To',years)+'<button class="action" id="histExport">Export filtered CSV</button></div><div id="histChart"></div><div id="histTable"></div>','Nominal company-wide cash spending. Microsoft uses June fiscal years; the other companies use December years.')+panel('What happened when?','<div class="controls">'+choose('eventArea','Area',unique(arr(history.events).map(x=>x.area)),true)+choose('eventCountry','Country',unique(arr(history.events).map(x=>x.country)),true)+'<label>Search events<input id="eventSearch" type="search" placeholder="Model, lab or event"></label></div><div id="eventResults"></div>')+panel('The questions behind the numbers',arr(history.topics).map(x=>`<details class="question"><summary>${esc(x.title)}</summary><p>${esc(x.thesis)}</p><p><strong>Question:</strong> ${esc(x.question)}</p><p><strong>Evidence needed:</strong> ${esc(x.lookFor)}</p><p><strong>Alternative:</strong> ${esc(x.disagree)}</p></details>`).join('')));
    if(years.length)$('histTo').value=years[years.length-1];['histCompany','histFrom','histTo'].forEach(id=>$(id).onchange=renderAnnual);$('histExport').onclick=csvExport;renderAnnual();['eventArea','eventCountry'].forEach(id=>$(id).onchange=renderEvents);$('eventSearch').oninput=renderEvents;renderEvents();
    const sources=[...Object.entries(base.sources||{}).map(([k,s])=>({k,s,h:false})),...Object.entries(history.sources||{}).map(([k,s])=>({k,s,h:true}))];
    out('method',panel('How to read this atlas','<p>Every numerical record keeps its source and reporting period. Earlier snapshots are retained. A forecast is not an actual, missing does not mean zero, and company-wide spending is not AI-only spending.</p><p>Publication dates, price-observation dates and model launch dates are distinct. Benchmark changes break comparability; a newer model can be more expensive while a fixed task becomes cheaper.</p><p>Daily OpenRouter collection stores separate third-party router offers. Those are not silently substituted for direct-provider prices in these charts.</p>')+panel('Known gaps',arr(history.knownGaps).map(x=>'<p>'+esc(x)+'</p>').join(''))+panel('Source register',table(['Record','Source type','Publication / snapshot','Original'],sources.map(({k,s,h})=>row([esc(s.label||k),esc(s.kind||s.type||'Unspecified'),esc(s.published||'Not recorded'),source(k,h)])))));
    state.renders++;selectView(window.location.hash.slice(1)||active,false);$('content').setAttribute('aria-busy','false');
  }
  function validate(data,kind){
    if(!data||typeof data!=='object'||!data.sources||Array.isArray(data.sources))throw Error(kind+' has no source register');
    const fields=kind==='baseline'?['models','capex','priceHistory','demand','observations']:['annual','events','priceHistory','countries','topics','knownGaps'];
    fields.forEach(k=>{if(!Array.isArray(data[k]))throw Error(kind+' has invalid '+k);});return data;
  }
  async function getJSON(path,kind){
    const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),10000);
    try{const r=await fetch(path,{signal:controller.signal,cache:'no-cache'});if(!r.ok)throw Error(kind+' HTTP '+r.status);return validate(await r.json(),kind);}finally{clearTimeout(timer);}
  }
  async function load(){
    if(busy)return;busy=true;state.status='loading';$('retry').hidden=true;$('status').dataset.state='loading';$('statusText').textContent='Loading research datasets...';$('content').setAttribute('aria-busy','true');
    try{
      const results=await Promise.allSettled([getJSON('./release-data/2026-10-18.json','baseline'),getJSON('./release-data/history.json','history')]);
      base=results[0].status==='fulfilled'?results[0].value:{};history=results[1].status==='fulfilled'?results[1].value:{};
      const failed=results.filter(x=>x.status==='rejected');
      if(failed.length===2)throw Error(failed.map(x=>x.reason.message).join('; '));
      render();state.status=failed.length?'partial':'ready';$('status').dataset.state=state.status;
      $('statusText').textContent=failed.length?'Some evidence is unavailable: '+failed.map(x=>x.reason.message).join('; ')+'. Available sections remain usable.':`Research snapshot ${base.snapshotDate||history.curatedAt||'date not recorded'} - ${arr(base.models).length} models, ${arr(history.annual).length} annual records, ${arr(history.events).length} milestones.`;
      $('retry').hidden=!failed.length;
    }catch(e){state.status='error';$('status').dataset.state='error';$('statusText').textContent='Unable to load the atlas: '+e.message+'. Use Retry loading.';$('retry').hidden=false;$('content').setAttribute('aria-busy','false');}
    finally{busy=false;}
  }
  $('retry').onclick=load;
  $('tabs').onclick=e=>{const tab=e.target.closest('[data-tab]');if(tab)selectView(tab.dataset.tab);};
  $('tabs').onkeydown=e=>{if(!['ArrowLeft','ArrowRight','Home','End'].includes(e.key))return;e.preventDefault();let i=views.findIndex(v=>v[0]===active);i=e.key==='Home'?0:e.key==='End'?views.length-1:(i+(e.key==='ArrowRight'?1:-1)+views.length)%views.length;selectView(views[i][0]);$('tab-'+active).focus();};
  window.addEventListener('hashchange',()=>selectView(window.location.hash.slice(1),false));
  load();
})();
