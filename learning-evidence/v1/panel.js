// Optional parent-friendly panel. No cloud writes or raw child answers.
import {createEvidenceStore, LEARNING_EVIDENCE_VERSION} from './index.js';
const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'}[c]));
const pct = v => v == null ? 'Not measured' : v + '%';
const css = [
 '.learning-evidence-panel{margin:24px 0;padding:18px;border:1px solid #8292a055;border-radius:16px;background:var(--le-bg,#111c2d);color:var(--le-fg,#f8fafc);font:inherit;line-height:1.5}',
 '.learning-evidence-panel *{box-sizing:border-box}.learning-evidence-panel h2,.learning-evidence-panel h3{color:inherit;margin:0 0 10px}.learning-evidence-panel h3{margin-top:18px;font-size:1.06rem}',
 '.learning-evidence-panel p,.learning-evidence-panel small{color:var(--le-muted,#b3bfd1)}.learning-evidence-panel .le-metrics{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px;margin:14px 0}',
 '.learning-evidence-panel .le-metric{border:1px solid #8192a055;border-radius:9px;padding:10px;min-width:0}.learning-evidence-panel .le-metric strong{display:block;font-size:1.3rem;overflow-wrap:anywhere;color:inherit}',
 '.learning-evidence-panel .le-metric span{font-size:.78rem;color:var(--le-muted,#b3bfd1)}.learning-evidence-panel .le-form{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}',
 '.learning-evidence-panel label{display:grid;gap:4px;font-size:.85rem;color:inherit}.learning-evidence-panel input,.learning-evidence-panel select{min-width:0;width:100%;padding:9px;border:1px solid #8292a099;border-radius:8px;background:var(--le-input,#233044);color:var(--le-fg,#f8fafc);font:inherit}',
 '.learning-evidence-panel button{border:1px solid #8292a099;border-radius:8px;padding:8px 12px;background:var(--le-button,#34465f);color:var(--le-fg,#f8fafc);cursor:pointer;font:inherit}',
 '.learning-evidence-panel button:disabled{opacity:.45;cursor:default}.learning-evidence-panel button:focus-visible,.learning-evidence-panel input:focus-visible,.learning-evidence-panel select:focus-visible{outline:3px solid #38bdf8;outline-offset:2px}',
 '.learning-evidence-panel button[type=submit]{background:#0f766e;color:#fff;border-color:#0f766e}.learning-evidence-panel .le-actions{display:flex;gap:8px;flex-wrap:wrap;grid-column:1/-1}',
 '.learning-evidence-panel .le-due{display:flex;align-items:center;justify-content:space-between;gap:10px;margin:7px 0;padding:10px;border:1px solid #8192a055;border-radius:8px}',
 '.learning-evidence-panel .le-note{font-size:.83rem}.learning-evidence-panel .le-status{min-height:1.4em}@media(max-width:650px){.learning-evidence-panel{padding:12px}.learning-evidence-panel .le-metrics{grid-template-columns:repeat(2,minmax(0,1fr))}.learning-evidence-panel .le-form{grid-template-columns:1fr}}'
].join('\n');
function styles() {
  if (document.getElementById('learning-evidence-v1-styles')) return;
  const style = document.createElement('style');
  style.id = 'learning-evidence-v1-styles';
  style.textContent = css;
  document.head.appendChild(style);
}
function exportFile(content,name) {
  const url = URL.createObjectURL(new Blob([content],{type:'application/json'}));
  const a = document.createElement('a');
  a.href = url; a.download = name; a.click();
  setTimeout(()=>URL.revokeObjectURL(url),2000);
}
export function mountEvidencePanel({target,appId,learnerId='local',accountId='guest',
  title='Learning evidence',storage,onRecord} = {}) {
  const root = typeof target === 'string' ? document.querySelector(target) : target;
  if (!root) throw Error('Missing learning evidence panel target');
  styles();
  const store = createEvidenceStore({appId,learnerId,accountId,storage});
  const host = document.createElement('section');
  host.className = 'learning-evidence-panel';
  host.setAttribute('aria-label',title);
  root.append(host);
  host.innerHTML =
   '<h2>'+esc(title)+' <small>v'+esc(LEARNING_EVIDENCE_VERSION)+'</small></h2>'+
   '<p>Can a skill be learnt, remembered a week later and used independently in a new situation?</p>'+
   '<div class="le-metrics" aria-live="polite"></div>'+
   '<p class="le-note">Accuracy and independence are separate. Seven-day retention and new-situation transfer stay <b>Not measured</b> until a suitable check happens. Help and scores must not be confused.</p>'+
   '<h3>Due reviews</h3><div data-due></div><h3>Record a short assessment</h3>'+
   '<form class="le-form">'+
   '<label>Skill or concept<input name="concept" required maxlength="160" placeholder="e.g. Compensation"></label>'+
   '<label>Type<select name="phase"><option value="diagnostic">Before teaching</option><option value="practice" selected>Immediately after teaching / practice</option><option value="retrieval">Delayed recall</option><option value="transfer">Apply in a new problem</option></select></label>'+
   '<label>Correct questions<input name="correctCount" type="number" min="0" step="1" value="0" required></label>'+
   '<label>Questions attempted<input name="total" type="number" min="1" step="1" value="1" required></label>'+
   '<label>How much help?<select name="support"><option value="unknown">Not recorded</option><option value="none">No help</option><option value="small-prompt">Small prompt</option><option value="substantial-hint">Substantial hint</option><option value="worked-example">Worked example</option></select></label>'+
   '<label>When was it taught?<input name="taughtDate" type="date"></label>'+
   '<label style="grid-column:1/-1"><span><input name="novel" type="checkbox" style="width:auto"> Confirm it is a genuinely new-looking question</span></label>'+
   '<div class="le-actions"><button type="submit">Save check</button><button type="button" data-teach>Mark taught today</button><button type="button" data-export>Export JSON</button></div>'+
   '</form><p class="le-note">Mark a skill as taught to schedule day 1, day 7 and day 28 checks. Merely scheduling a review is not evidence of retention. All records stay on this device unless the app explicitly enables a secure sync.</p>'+
   '<p class="le-status" role="status" aria-live="polite"></p>';
  const form = host.querySelector('form'), status = host.querySelector('.le-status');
  function render() {
    const summary = store.summary();
    const metrics = [
      ['Accuracy', summary.accuracy],
      ['Independence', summary.independence],
      ['7-day retention', summary.retention],
      ['New-situation transfer', summary.transfer]
    ];
    host.querySelector('.le-metrics').innerHTML = metrics.map(pair =>
      '<div class="le-metric"><strong>'+esc(pct(pair[1].percent))+'</strong><span>'+esc(pair[0])+' · '+pair[1].total+' questions</span></div>'
    ).join('');
    const due = store.due();
    const html = due.slice(0,8).map((x,i) => {
      const date = new Intl.DateTimeFormat('en-GB',{day:'numeric',month:'short'}).format(x.dueAt);
      return '<div class="le-due"><div><strong>'+esc(x.concept)+'</strong><small style="display:block">Day '+x.days+' · '+(x.overdue?'Due now':'Due '+date)+'</small></div>'+
        '<button type="button" data-review="'+i+'" '+(x.overdue?'':'disabled')+'>Record review</button></div>';
    }).join('');
    host.querySelector('[data-due]').innerHTML = html || '<p>No scheduled checks yet. Record when a skill was taught.</p>';
  }
  host.addEventListener('click',event=>{
    const b=event.target.closest('button'); if(!b)return;
    if(b.hasAttribute('data-export')) exportFile(store.exportJSON(),'learning-evidence-'+appId+'.json');
    if(b.hasAttribute('data-teach')){
      const concept=form.elements.concept.value.trim();
      if(!concept){status.textContent='Enter a skill first.';return;}
      try{
        const now=Date.now();
        store.record({concept,phase:'practice',at:now,taughtAt:now,source:{kind:'teaching-marker'}});
        form.elements.taughtDate.value=new Date(now).toISOString().slice(0,10);
        status.textContent='Teaching date recorded. Review checks scheduled for day 1, day 7 and day 28.';
      }catch(e){status.textContent='Could not save: '+e.message;}
    }
    if(b.hasAttribute('data-review')){
      const due=store.due()[Number(b.dataset.review)];
      if(!due||!due.overdue)return;
      form.elements.concept.value=due.concept;
      form.elements.phase.value='retrieval';
      const original=store.getEntries().filter(x=>x.concept===due.concept&&x.taughtAt).sort((a,b)=>b.taughtAt-a.taughtAt)[0];
      if(original)form.elements.taughtDate.value=new Date(original.taughtAt).toISOString().slice(0,10);
      form.elements.total.value='1';form.elements.correctCount.value='0';
      form.elements.support.value='unknown';form.elements.novel.checked=false;
      form.scrollIntoView({behavior:'smooth',block:'nearest'});
      status.textContent='Now record the result of an actual new, unprompted review question.';
    }
  });
  form.addEventListener('submit',event=>{
    event.preventDefault();
    const f=form.elements,c=Number(f.correctCount.value),t=Number(f.total.value);
    if(!Number.isInteger(c)||!Number.isInteger(t)||t<1||c<0||c>t){status.textContent='Correct answers must be between 0 and the number attempted.';return;}
    try{
      const row=store.record({concept:f.concept.value,phase:f.phase.value,correctCount:c,total:t,
        support:f.support.value,taughtAt:f.taughtDate.value||null,
        novel:f.phase.value==='transfer'&&f.novel.checked,source:{kind:'parent-check'}});
      status.textContent='Saved '+row.score.correct+'/'+row.score.total+
        (row.phase==='retrieval'&&row.taughtAt&&row.at-row.taughtAt>=7*86400000?' · Valid seven-day check.':' · Retention only measured after a delayed review.');
      if(typeof onRecord==='function')onRecord(row);
    }catch(e){status.textContent='Could not save: '+e.message;}
  });
  const unsub=store.subscribe(render);
  render();
  return {store,element:host,refresh:render,destroy(){unsub();host.remove();}};
}
