const STYLE_ID='apps-shared-notes-style-v1';
const cssUrl=new URL('./styles.css',import.meta.url).href;
function ensureStyles(){if(document.getElementById(STYLE_ID))return;const l=document.createElement('link');l.id=STYLE_ID;l.rel='stylesheet';l.href=cssUrl;document.head.appendChild(l)}
const q=(root,s)=>root.querySelector(s),qa=(root,s)=>[...root.querySelectorAll(s)];
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function labelFor(el){
 const explicit=el?.dataset?.noteLabel||el?.getAttribute?.('aria-label')||el?.getAttribute?.('title');
 if(explicit)return String(explicit).trim().slice(0,90);
 const heading=el?.querySelector?.('h1,h2,h3')?.textContent?.trim();
 if(heading)return heading.slice(0,90);
 const text=el?.innerText||el?.textContent||'';
 return String(text).replace(/\s+/g,' ').trim().slice(0,90)||'App element';
}
function pathFor(el){
  if(!el||el===document.body)return 'page:general';if(el.dataset.noteAnchor)return el.dataset.noteAnchor;if(el.id)return `id:${el.id}`;
  const section=el.closest('[data-note-anchor],[id],main,section,article,nav,header,footer');if(section&&section!==el&&section.dataset.noteAnchor)return section.dataset.noteAnchor;
  const parts=[];let node=el;while(node&&node!==document.body&&parts.length<12){if(node.dataset?.noteAnchor){parts.unshift('[data-note-anchor="'+CSS.escape(node.dataset.noteAnchor)+'"]');break}if(node.id){parts.unshift('#'+CSS.escape(node.id));break}const tag=node.tagName.toLowerCase(),siblings=[...(node.parentElement?.children||[])].filter(x=>x.tagName===node.tagName);parts.unshift(tag+':nth-of-type('+(siblings.indexOf(node)+1)+')');node=node.parentElement}return 'css:'+parts.join(' > ');
}
function selectedText(){return String(globalThis.getSelection?.()?.toString?.()||'').trim().slice(0,1000)}
export async function mountNotesUI(notes,options={}){
  ensureStyles();
  const cfg={launcher:true,launcherLabel:'＋ Note',annotation:true,showTypes:true,pageScope:false,defaultReviewRequired:true,chatGPTHandoff:false,...options};
  const currentPage=()=>typeof notes.config.page==='function'?notes.config.page():String(notes.config.page||'');
  const inScope=n=>cfg.pageScope!==true||n.page===currentPage();
  let annotating=false,editingId=null,context=null,filter='open';
  const launcher=document.createElement('button');launcher.type='button';launcher.className='apps-notes-launcher';launcher.textContent=cfg.launcherLabel;launcher.setAttribute('aria-label','Open notes and annotations');if(cfg.launcher!==false)document.body.appendChild(launcher);
  const banner=document.createElement('div');banner.className='apps-notes-annotation-banner';banner.hidden=true;banner.innerHTML='<span>Tap a highlighted area to attach a note.</span><button type="button">Done</button>';document.body.appendChild(banner);
  const dialog=document.createElement('dialog');dialog.className='apps-notes-dialog';dialog.innerHTML=`<div class="apps-notes-shell"><header><div><p class="eyebrow">NOTES & ANNOTATIONS</p><h2>${esc(cfg.title||'Notes for review')}</h2></div><button class="icon-close" data-close aria-label="Close">×</button></header><div class="toolbar"><button class="primary" data-new>＋ General note</button>${cfg.annotation!==false?'<button data-select>⌖ Select an element</button>':''}<button data-copy hidden>Copy for ChatGPT</button><button data-import hidden>Apply ChatGPT edits</button><button data-publish hidden>Retry issue sync</button></div><section class="chatgpt-import composer" hidden><strong>Apply revised note text</strong><p>Paste the JSON returned by ChatGPT. Only existing open notes in this lesson can be changed. Status, development links and other notes are protected.</p><textarea data-import-json rows="7" placeholder="Paste the apps-shared-notes-edits-v1 JSON here"></textarea><p data-import-message role="status" aria-live="polite"></p><div data-import-preview hidden><strong data-import-heading></strong><div data-import-changes></div><p data-import-warning></p></div><div class="composer-actions"><button type="button" data-import-cancel>Cancel</button><button type="button" class="primary" data-import-apply>Review changes</button><button type="button" class="primary" data-import-confirm hidden>Save reviewed changes</button></div></section><section class="composer note-composer" hidden><div class="context"><strong data-context-label>General note</strong><span data-context-id>page:general</span></div><blockquote data-quote hidden></blockquote><textarea rows="5" maxlength="6000" placeholder="What should change, what was confusing, or what should be remembered?"></textarea><div class="composer-options">${cfg.showTypes!==false?'<label>Type <select data-type><option value="developer">Developer note</option><option value="feedback">Feedback</option><option value="annotation">Annotation</option></select></label>':''}<label><input type="checkbox" data-review checked> ${esc(cfg.reviewLabel||'Create development task')}</label></div><div class="composer-actions"><button data-cancel>Cancel</button><button class="primary" data-save>Save note</button></div></section><details open><summary>Notes history</summary><div class="filters"><button data-filter="open" class="active">Open</button><button data-filter="review">For review</button><button data-filter="implemented">Implemented</button><button data-filter="all">All</button></div><div class="list"></div></details><footer><span data-status></span>${cfg.notice?`<p class="apps-notes-notice">${esc(cfg.notice)}</p>`:''}</footer></div>`;document.body.appendChild(dialog);
  if(typeof notes.config.transport.publishReviewFeed==='function')q(dialog,'[data-publish]').hidden=false;
  if(cfg.chatGPTHandoff===true){q(dialog,'[data-copy]').hidden=false;q(dialog,'[data-import]').hidden=false;}
  function ctxFrom(el){const anchorId=pathFor(el);return{anchorId,anchorLabel:labelFor(el),selector:el?.id?`#${CSS.escape(el.id)}`:anchorId.startsWith('css:')?anchorId.slice(4):'',selectedText:selectedText(),elementText:el?.textContent?.trim()?.replace(/\s+/g,' ').slice(0,1000)||''}}
  function openComposer(ctx={anchorId:'page:general',anchorLabel:'General page note'},note=null){context=ctx;editingId=note?.id||null;q(dialog,'.note-composer').hidden=false;q(dialog,'[data-context-label]').textContent=ctx.anchorLabel||'General note';q(dialog,'[data-context-id]').textContent=ctx.anchorId||'page:general';const quote=q(dialog,'[data-quote]');quote.hidden=!ctx.selectedText;quote.textContent=ctx.selectedText?`“${ctx.selectedText}”`:'';q(dialog,'.note-composer textarea').value=note?.text||'';q(dialog,'[data-review]').checked=note?note.reviewRequired!==false:cfg.defaultReviewRequired!==false;const type=q(dialog,'[data-type]');if(type)type.value=note?.type||notes.config.defaultType||'developer';q(dialog,'[data-save]').textContent=note?'Save changes':'Save note';notes.saveDraft({noteId:editingId,text:q(dialog,'textarea').value,context,type:type?.value||notes.config.defaultType}).catch(()=>{});setTimeout(()=>q(dialog,'textarea').focus(),10)}
  function closeComposer(){editingId=null;context=null;q(dialog,'.note-composer').hidden=true;q(dialog,'textarea').value='';notes.clearDraft().catch(()=>{})}
  function listForFilter(){if(filter==='open')return notes.list({open:true}).filter(inScope);if(filter==='review')return notes.list({review:true}).filter(inScope);if(filter==='implemented')return notes.list({status:'implemented'}).filter(inScope);return notes.list().filter(inScope)}
  function render(){const host=q(dialog,'.list'),list=listForFilter();host.innerHTML=list.length?list.map(n=>`<article data-id="${esc(n.id)}" class="${n.status==='implemented'?'implemented':''}"><div class="note-head"><strong>${esc(n.anchorLabel||'General note')}</strong><span class="type">${esc(n.type)}</span></div><p>${esc(n.text)}</p>${n.selectedText?`<blockquote>“${esc(n.selectedText)}”</blockquote>`:''}<small>${esc(n.appVersion||'')} · ${new Date(n.updatedAt).toLocaleString('en-GB')} · ${esc(n.status)}</small>${n.metadata?.developmentIssue?.url?`<p class="issue-link"><a href="${esc(n.metadata.developmentIssue.url)}" target="_blank" rel="noopener">Development issue #${esc(n.metadata.developmentIssue.number)}</a></p>`:''}${n.status==='implemented'&&n.implementationVersion?`<p class="implemented-note">✓ Implemented in ${esc(n.implementationVersion)}${n.implementationMessage?' — '+esc(n.implementationMessage):''}</p>`:''}<div class="actions"><button data-action="goto">Go to</button><button data-action="edit">Edit</button>${n.status==='open'&&n.metadata?.developmentIssue?.number&&typeof notes.config.transport.verify==='function'?'<button data-action="verify">Verify fix</button>':''}${n.status==='implemented'?'<button data-action="restore">Reopen</button>':`<button data-action="review">${n.reviewRequired?'Exclude from development':'Send to development'}</button><button data-action="archive">Archive</button>`}</div></article>`).join(''):'<div class="empty">No notes in this view yet.</div>';renderPins()}
  function renderPins(){document.querySelectorAll('.apps-note-pin').forEach(x=>x.remove());document.querySelectorAll('.apps-has-notes').forEach(x=>x.classList.remove('apps-has-notes'));const counts=new Map();notes.list({open:true}).filter(inScope).forEach(n=>counts.set(n.anchorId,(counts.get(n.anchorId)||0)+1));document.querySelectorAll('[data-note-anchor],[id]').forEach(el=>{const id=pathFor(el),count=counts.get(id)||0;if(!count||['BUTTON','INPUT','SELECT','TEXTAREA','DIALOG'].includes(el.tagName)||el.closest('.apps-notes-dialog'))return;el.classList.add('apps-has-notes');const pin=document.createElement('button');pin.type='button';pin.className='apps-note-pin';pin.textContent=count;pin.title=`${count} open note${count===1?'':'s'}`;pin.onclick=e=>{e.preventDefault();e.stopPropagation();open();filter='all';updateFilters();render()};el.appendChild(pin)})}
  function updateFilters(){qa(dialog,'[data-filter]').forEach(b=>b.classList.toggle('active',b.dataset.filter===filter))}
  function open(){render();if(!dialog.open)dialog.showModal()}
  function toggleAnnotation(value){annotating=typeof value==='boolean'?value:!annotating;document.body.classList.toggle('apps-annotating',annotating);banner.hidden=!annotating}
  launcher.onclick=open;q(dialog,'[data-close]').onclick=()=>dialog.close();q(dialog,'[data-new]').onclick=()=>openComposer();q(dialog,'[data-select]')?.addEventListener('click',()=>{dialog.close();toggleAnnotation(true)});q(dialog,'[data-cancel]').onclick=closeComposer;banner.querySelector('button').onclick=()=>toggleAnnotation(false);
  q(dialog,'textarea').oninput=()=>{const type=q(dialog,'[data-type]');notes.saveDraft({noteId:editingId,text:q(dialog,'textarea').value,context,type:type?.value||notes.config.defaultType}).catch(()=>{})};
  q(dialog,'[data-save]').onclick=async()=>{const text=q(dialog,'textarea').value.trim();if(!text)return q(dialog,'textarea').focus();const existing=editingId?notes.list().find(n=>n.id===editingId):null;try{const result=await notes.upsert({...existing,id:editingId||undefined,text,...(context||{}),type:q(dialog,'[data-type]')?.value||notes.config.defaultType,reviewRequired:q(dialog,'[data-review]').checked});closeComposer();render();const review=result.reviewResult;q(dialog,'[data-status]').textContent=review?.status==='created'?'Saved · development issue #'+review.number+' linked.':review?.status==='failed'?'Saved to cloud · issue creation failed; retry issue sync.':review?.status==='pending-configuration'?'Saved to cloud · issue publishing not configured.':'Note saved.'}catch(error){q(dialog,'[data-status]').textContent='Save failed: '+String(error?.message||error)}};
  q(dialog,'[data-copy]').onclick=async()=>{
    const selected=notes.list({open:true}).filter(inScope);
    if(!selected.length){q(dialog,'[data-status]').textContent='No open notes in this lesson to copy.';return;}
    if(!confirm('Copy '+selected.length+' note(s) to the clipboard for ChatGPT? Notes may contain private learner information. Nothing is sent automatically.'))return;
    const pack={schema:'apps-shared-notes-edit-request-v1',appId:notes.config.appId,page:currentPage(),notes:selected.map(n=>({id:n.id,text:n.text,anchorLabel:n.anchorLabel,type:n.type})),instructions:'Return only JSON using schema apps-shared-notes-edits-v1 with the same appId and page and updates containing existing note IDs and revised text. Never change note IDs or claim work is implemented.'};
    try{await navigator.clipboard.writeText(JSON.stringify(pack,null,2));q(dialog,'[data-status]').textContent='Copied '+selected.length+' note(s). Paste into ChatGPT; nothing has been uploaded by this app.';}
    catch(error){q(dialog,'[data-status]').textContent='Clipboard failed: '+String(error.message||error);}
  };
  const importPanel=q(dialog,'.chatgpt-import');
  const importInput=q(dialog,'[data-import-json]');
  const importMessage=q(dialog,'[data-import-message]');
  const importPreview=q(dialog,'[data-import-preview]');
  const importReviewButton=q(dialog,'[data-import-apply]');
  const importConfirmButton=q(dialog,'[data-import-confirm]');
  let pendingImport=null;
  function importFeedback(message,isError=false){
    importMessage.textContent=message;
    importMessage.setAttribute('data-error',String(isError));
    q(dialog,'[data-status]').textContent=message;
  }
  function clearImportReview(){
    pendingImport=null;
    importPreview.hidden=true;importConfirmButton.hidden=true;importReviewButton.hidden=false;
  }
  q(dialog,'[data-import]').onclick=()=>{
    importPanel.hidden=false;
    clearImportReview();
    importFeedback('Paste ChatGPT’s revised JSON, then review the changes.');
    importInput.focus();
  };
  q(dialog,'[data-import-cancel]').onclick=()=>{
    clearImportReview();importPanel.hidden=true;
  };
  importInput.addEventListener('input',()=>{
    clearImportReview();importFeedback('');
  });
  importReviewButton.onclick=()=>{
    clearImportReview();
    try{
      const review=notes.reviewTextEdits(importInput.value,currentPage());
      if(review.changes.length===0){
        importFeedback('No text changes found. All '+review.total+' note(s) already match.',false);
        return;
      }
      pendingImport={raw:importInput.value,page:currentPage(),review};
      q(dialog,'[data-import-heading]').textContent=review.changes.length+' note(s) will change; '+review.unchanged.length+' unchanged.';
      const changes=q(dialog,'[data-import-changes]');
      changes.replaceChildren();
      for(const change of review.changes){
        const item=document.createElement('div');item.className='import-change';
        const heading=document.createElement('strong');heading.textContent=change.label;
        const before=document.createElement('p');before.textContent='Before: '+change.before;
        const after=document.createElement('p');after.textContent='After: '+change.after;
        item.append(heading,before,after);changes.append(item);
      }
      q(dialog,'[data-import-warning]').textContent='Only the displayed note text will be updated. Private notes will not be sent to GitHub.';
      importPreview.hidden=false;importReviewButton.hidden=true;importConfirmButton.hidden=false;
      importFeedback('Review each change below, then select Save reviewed changes.');
      importPreview.scrollIntoView({block:'nearest'});
    }catch(error){
      importFeedback('Cannot review changes: '+String(error.message||error),true);
    }
  };
  importConfirmButton.onclick=async()=>{
    if(!pendingImport)return importFeedback('Review the changes before saving.',true);
    const {raw,page,review}=pendingImport;
    try{
      if(page!==currentPage()||!notes.reviewTextEdits||!review.changes.length)
        throw Error('The lesson changed. Review the edits again.');
      const fresh=notes.reviewTextEdits(raw,page);
      const identical=JSON.stringify(fresh)===JSON.stringify(review);
      if(!identical)throw Error('A note changed since review. Review again before saving.');
      importConfirmButton.disabled=true;
      importFeedback('Saving '+review.changes.length+' note(s)…');
      const outcome=await notes.applyTextEdits(raw,page);
      importInput.value='';clearImportReview();importPanel.hidden=true;
      render();importFeedback(outcome.updated+' note(s) updated, '+outcome.unchanged+' unchanged.');
    }catch(error){
      importFeedback('Save failed: '+String(error.message||error),true);
      clearImportReview();
    }finally{importConfirmButton.disabled=false;}
  };
  q(dialog,'[data-publish]').onclick=async()=>{try{const r=await notes.publishReviewFeed(true);await notes.load();q(dialog,'[data-status]').textContent=r?.status==='processed'?'Issue sync complete.':r?.status==='partial'?'Some issues failed to sync.':'Issue sync: '+(r?.status||'unavailable')}catch(error){q(dialog,'[data-status]').textContent='Issue sync failed: '+String(error?.message||error)}};
  q(dialog,'.filters').onclick=e=>{const b=e.target.closest('[data-filter]');if(!b)return;filter=b.dataset.filter;updateFilters();render()};
  q(dialog,'.list').onclick=async e=>{const b=e.target.closest('[data-action]'),card=e.target.closest('[data-id]');if(!b||!card)return;const n=notes.list().find(x=>x.id===card.dataset.id);if(!n)return;if(b.dataset.action==='edit')openComposer(n,n);if(b.dataset.action==='archive'){await notes.archive(n.id);render()}if(b.dataset.action==='restore'){await notes.restore(n.id);render()}if(b.dataset.action==='review'){await notes.upsert({...n,reviewRequired:!n.reviewRequired});render()}if(b.dataset.action==='verify'){
    const version=prompt('Deployed app version (required):');
    if(!version)return;
    const commit=prompt('Verified deployed Git commit SHA (7–40 hexadecimal characters):');
    if(!commit)return;
    const message=prompt('What was tested and how was the fix verified?');
    if(!message)return;
    if(!confirm('Confirm the GitHub issue is closed, tests passed, and this commit is deployed to production. Mark this annotation implemented?'))return;
    try{await notes.config.transport.verify(n.id,{version,commit,message,testsVerified:true,deploymentVerified:true});await notes.load();q(dialog,'[data-status]').textContent='Implementation verified and saved to Firebase.'}
    catch(error){q(dialog,'[data-status]').textContent='Verification failed: '+String(error.message||error)}
  }
  if(b.dataset.action==='goto'){dialog.close();let el=null;try{el=n.selector?document.querySelector(n.selector):n.anchorId.startsWith('css:')?document.querySelector(n.anchorId.slice(4)):[...document.querySelectorAll('[data-note-anchor],[id]')].find(x=>pathFor(x)===n.anchorId)}catch{}if(!el){q(dialog,'[data-status]').textContent='Original element not found on this page.';open();return}el.scrollIntoView({behavior:'smooth',block:'center'});el?.classList.add('apps-note-flash');setTimeout(()=>el?.classList.remove('apps-note-flash'),1500)}};
  dialog.addEventListener('cancel',e=>{e.preventDefault();dialog.close()});
  const onDocumentClick=e=>{if(!annotating||e.target.closest('.apps-notes-dialog,.apps-notes-annotation-banner,.apps-notes-launcher'))return;const el=e.target.closest('button,a,input,select,textarea,label,svg,canvas,img,td,th,p,span,strong,div,section,article,main,nav,header,footer')||e.target;if(!el||el===document.body)return;e.preventDefault();e.stopPropagation();toggleAnnotation(false);open();openComposer(ctxFrom(el))};
  document.addEventListener('click',onDocumentClick,true);
  const unsub=notes.subscribe(()=>render());
  const draft=await notes.getDraft().catch(()=>null);if(draft?.text){open();openComposer(draft.context||undefined,draft.noteId?notes.list().find(n=>n.id===draft.noteId):null);q(dialog,'textarea').value=draft.text}
  renderPins();
  return {open,close(){toggleAnnotation(false);dialog.close()},toggleAnnotation,render,destroy(){unsub();document.removeEventListener('click',onDocumentClick,true);launcher.remove();banner.remove();dialog.remove();document.body.classList.remove('apps-annotating');document.querySelectorAll('.apps-note-pin').forEach(x=>x.remove());document.querySelectorAll('.apps-has-notes').forEach(x=>x.classList.remove('apps-has-notes'))}};
}
