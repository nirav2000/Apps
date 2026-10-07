const VERSION = '1.0.0';
const DEFAULT_TYPES = ['developer','feedback','annotation'];
const now = () => new Date().toISOString();
const uid = () => globalThis.crypto?.randomUUID?.() || `note-${Date.now()}-${Math.random().toString(36).slice(2)}`;
const clone = value => value == null ? value : JSON.parse(JSON.stringify(value));

function normaliseType(type){
  const value=String(type||'developer').toLowerCase();
  return DEFAULT_TYPES.includes(value)?value:'developer';
}
function normaliseStatus(status){
  const value=String(status||'open').toLowerCase();
  if(value==='actioned') return 'implemented';
  return ['open','implemented','archived','wont-fix'].includes(value)?value:'open';
}
function normaliseNote(note={}, context={}){
  const createdAt=note.createdAt||now();
  const status=normaliseStatus(note.status||note.implementationStatus);
  return {
    id: note.id||uid(),
    type: normaliseType(note.type),
    text: String(note.text||'').trim(),
    appId: String(note.appId||context.appId||''),
    appVersion: String(note.appVersion||context.appVersion||''),
    page: String(note.page||context.page||''),
    anchorId: String(note.anchorId||'page:general'),
    anchorLabel: String(note.anchorLabel||'General page note'),
    selector: String(note.selector||''),
    selectedText: String(note.selectedText||''),
    elementText: String(note.elementText||''),
    section: String(note.section||''),
    tags: Array.isArray(note.tags)?[...new Set(note.tags.map(String))]:[],
    reviewRequired: note.reviewRequired!==false,
    status,
    implementationStatus: status==='implemented'?'implemented':String(note.implementationStatus||''),
    implementationVersion: String(note.implementationVersion||''),
    implementationMessage: String(note.implementationMessage||''),
    implementationCommit: String(note.implementationCommit||''),
    implementedAt: note.implementedAt||'',
    createdAt,
    updatedAt: note.updatedAt||createdAt,
    metadata: note.metadata&&typeof note.metadata==='object'?clone(note.metadata):{}
  };
}
function byUpdated(a,b){ return Date.parse(b.updatedAt||b.createdAt||0)-Date.parse(a.updatedAt||a.createdAt||0); }

export function createLocalStorageTransport({storageKey='apps.notes.v1', draftKey=`${storageKey}.draft`}={}){
  const readJSON=(key,fallback)=>{try{return JSON.parse(localStorage.getItem(key)||'null')??fallback}catch{return fallback}};
  return {
    async list(){ return readJSON(storageKey,[]); },
    async save(note){
      const notes=readJSON(storageKey,[]),i=notes.findIndex(x=>x.id===note.id);
      if(i<0)notes.push(note);else notes[i]=note;
      localStorage.setItem(storageKey,JSON.stringify(notes));
      return note;
    },
    async remove(id){
      localStorage.setItem(storageKey,JSON.stringify(readJSON(storageKey,[]).filter(x=>x.id!==id)));
    },
    async getDraft(){ return readJSON(draftKey,null); },
    async saveDraft(draft){ draft?localStorage.setItem(draftKey,JSON.stringify(draft)):localStorage.removeItem(draftKey); },
    async clearDraft(){ localStorage.removeItem(draftKey); }
  };
}

export function createNotes(options={}){
  if(!options.appId) throw new Error('Shared Notes requires appId');
  const config={
    appId:String(options.appId), appVersion:String(options.appVersion||'0.0.0'),
    page:options.page||(()=>location.pathname+location.search+location.hash),
    types:Array.isArray(options.types)&&options.types.length?options.types:DEFAULT_TYPES,
    defaultType:normaliseType(options.defaultType||'developer'),
    transport:options.transport||createLocalStorageTransport({storageKey:`apps.notes.${options.appId}.v1`}),
    reviewFeed:options.reviewFeed!==false,
    ...options
  };
  let notes=[], ready=false;
  const listeners=new Set();
  const page=()=>typeof config.page==='function'?config.page():String(config.page||'');
  const emit=(event,detail={})=>{
    const payload={event,notes:listSync(),...detail};
    listeners.forEach(fn=>{try{fn(payload)}catch{}});
    globalThis.dispatchEvent?.(new CustomEvent('apps-notes:changed',{detail:{appId:config.appId,...payload}}));
  };
  const listSync=(filter={})=>notes.filter(n=>{
    if(filter.status&&n.status!==filter.status)return false;
    if(filter.type&&n.type!==filter.type)return false;
    if(filter.review===true&&(!n.reviewRequired||n.status!=='open'))return false;
    if(filter.open===true&&n.status!=='open')return false;
    return true;
  }).sort(byUpdated).map(clone);
  async function load(){
    const raw=await config.transport.list?.()||[];
    notes=raw.map(n=>normaliseNote(n,{appId:config.appId,appVersion:config.appVersion,page:page()}));ready=true;emit('loaded');return listSync();
  }
  async function ensure(){if(!ready)await load();}
  async function upsert(input={}){
    await ensure();
    const existing=input.id?notes.find(n=>n.id===input.id):null;
    const note=normaliseNote({...existing,...input,appId:config.appId,appVersion:input.appVersion||existing?.appVersion||config.appVersion,page:input.page||existing?.page||page(),createdAt:existing?.createdAt||input.createdAt||now(),updatedAt:now()},{appId:config.appId,appVersion:config.appVersion,page:page()});
    if(!note.text)throw new Error('Note text is required');
    const i=notes.findIndex(n=>n.id===note.id);if(i<0)notes.push(note);else notes[i]=note;
    await config.transport.save?.(clone(note));emit(existing?'updated':'created',{note:clone(note)});return clone(note);
  }
  async function setStatus(id,status,details={}){
    await ensure();const existing=notes.find(n=>n.id===id);if(!existing)throw new Error('Unknown note: '+id);
    const next=normaliseStatus(status), implemented=next==='implemented';
    return upsert({...existing,status:next,implementationStatus:implemented?'implemented':details.implementationStatus||existing.implementationStatus,implementationVersion:details.implementationVersion||existing.implementationVersion,implementationMessage:details.implementationMessage||existing.implementationMessage,implementationCommit:details.implementationCommit||existing.implementationCommit,implementedAt:implemented?(details.implementedAt||existing.implementedAt||now()):existing.implementedAt,reviewRequired:implemented?false:(details.reviewRequired??existing.reviewRequired)});
  }
  async function archive(id){return setStatus(id,'archived');}
  async function restore(id){return setStatus(id,'open',{reviewRequired:true});}
  async function remove(id){await ensure();notes=notes.filter(n=>n.id!==id);await config.transport.remove?.(id);emit('removed',{id});}
  async function saveDraft(draft){return config.transport.saveDraft?.(draft?{...draft,appId:config.appId,appVersion:config.appVersion,page:page(),updatedAt:now()}:null);}
  async function getDraft(){return config.transport.getDraft?.()||null;}
  async function clearDraft(){return config.transport.clearDraft?.();}
  function reviewPack(){
    const pending=listSync({review:true});
    return {schema:'apps-shared-notes-review-v1',appId:config.appId,appVersion:config.appVersion,generatedAt:now(),pendingCount:pending.length,notes:pending};
  }
  async function publishReviewFeed(force=false){
    if(!config.reviewFeed||typeof config.transport.publishReviewFeed!=='function')return {status:'unavailable',reason:'transport-not-configured'};
    await ensure();return config.transport.publishReviewFeed(reviewPack(),{force});
  }
  async function syncStatuses(){
    if(typeof config.transport.pullStatuses!=='function')return {status:'unavaile',changed:0};
    await ensure();const ledger=await config.transport.pullStatuses({appId:config.appId,notes:listSync()});let changed=0;
    for(const decision of ledger?.notes||[]){
      const note=notes.find(n=>n.id===decision.id);if(!note)continue;
      if(decision.updatedAt&&Date.parse(decision.updatedAt)<=Date.parse(note.updatedAt||0))continue;
      await setStatus(note.id,decision.status||note.status,{implementationVersion:decision.implementationVersion||decision.version,implementationMessage:decision.message,implementationCommit:decision.commit,implementedAt:decision.implementedAt||decision.updatedAt});changed++;
    }
    return {status:'ready',changed};
  }
  function subscribe(fn){listeners.add(fn);return()=>listeners.delete(fn);}
  const api={version:VERSION,config,load,list:(filter={})=>listSync(filter),upsert,setStatus,archive,restore,remove,reviewPack,publishReviewFeed,syncStatuses,saveDraft,getDraft,clearDraft,subscribe,get ready(){return ready}};
  return api;
}

let singleton=null;
export const Notes={
  version:VERSION,
  async init(options={}){
    const [{mountNotesUI}]=await Promise.all([import('./ui.js')]);
    singleton=createNotes(options);await singleton.load();
    if(options.ui!==false)singleton.ui=await mountNotesUI(singleton,options.ui&&typeof options.ui==='object'?options.ui:options);
    globalThis.SharedNotes=singleton;return singleton;
  },
  get current(){return singleton;},
  create:createNotes,
  createLocalStorageTransport
};
export default Notes;
