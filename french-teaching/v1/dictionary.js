// Optional dictionary enrichment for Next French.
// Community Wiktionary text via the free Wiktapi JSON service (English glosses).
// No keys, no learning records, no private sentence data and no HTML from the API.
export const DICTIONARY_VERSION='1.0.0';
export const DICTIONARY_PROVIDER='Wiktionary (via Wiktapi)';
const HOST='https://api.wiktapi.dev/v1/en/word/';
const CACHE_PREFIX='next-french:wiktionary:v1:';
const CACHE_AGE_MS=3*86400000;
const SOFT_LIMIT=12_000;
const inFlight=new Map();
const memory=new Map();
export function dictionaryWord(raw){
  // Only individual words or short pre-existing lexical expressions should be sent out.
  const word=String(raw??'').trim().normalize('NFC').replace(/[’‘]/g,"'");
  if(!/^[\p{L}\p{M}]+(?:[ '-][\p{L}\p{M}]+){0,2}$/u.test(word)||word.length>70)
    throw Error('Only a short French word or expression can be looked up.');
  return word;
}
export function dictionaryURL(raw){
  return 'https://en.wiktionary.org/wiki/'+encodeURIComponent(dictionaryWord(raw))+'#French';
}
export function frenchWiktionaryURL(raw){
  return 'https://fr.wiktionary.org/wiki/'+encodeURIComponent(dictionaryWord(raw));
}
export function lookupURL(raw){
  return HOST+encodeURIComponent(dictionaryWord(raw))+'?lang=fr';
}
const asText=value=>typeof value==='string'?value.trim():null;
const firstStrings=(values,max)=>Array.isArray(values)?values.filter(x=>typeof x==='string'&&x.trim()).slice(0,max).map(x=>x.trim().slice(0,220)):[];

export function parseDictionary(raw,requested){
  // Never infer French from an English homograph or trust provider HTML.
  if(!raw||!Array.isArray(raw.entries))throw Error('Dictionary response unavailable.');
  const entries=raw.entries.filter(e=>e&&typeof e==='object'&&(e.lang_code==='fr'||e.lang==='French'));
  const senses=[],ipa=[],forms=[],parts=[];
  for(const entry of entries.slice(0,7)){
    const pos=asText(entry.pos);
    if(pos&&!parts.includes(pos))parts.push(pos.slice(0,40));
    for(const item of (Array.isArray(entry.senses)?entry.senses:[]).slice(0,12)){
      if(!item||typeof item!=='object')continue;
      for(const gloss of firstStrings(item.glosses,3)){
        if(!senses.includes(gloss))senses.push(gloss);
        if(senses.length>=6)break;
      }
      if(senses.length>=6)break;
    }
    for(const item of (Array.isArray(entry.sounds)?entry.sounds:[]).slice(0,10)){
      const ph=asText(item?.ipa);
      if(ph&&!ipa.includes(ph))ipa.push(ph.slice(0,65));
      if(ipa.length>=3)break;
    }
    for(const item of (Array.isArray(entry.forms)?entry.forms:[]).slice(0,24)){
      const form=asText(item?.form)||asText(item?.word);
      const tags=firstStrings(item?.tags,2);
      if(form&&!forms.some(x=>x.word===form))
        forms.push({word:form.slice(0,65),label:tags.join(', ').slice(0,90)});
      if(forms.length>=8)break;
    }
    if(senses.length>=6&&ipa.length>=3&&forms.length>=8)break;
  }
  return {word:dictionaryWord(requested),parts:parts.slice(0,3),senses:senses.slice(0,6),
    ipa:ipa.slice(0,3),forms:forms.slice(0,8),
    source:dictionaryURL(requested),sourceFrench:frenchWiktionaryURL(requested),
    // We don't imply a meaning when a valid API reply has no French senses.
    found:entries.length>0&&(senses.length>0||ipa.length>0||forms.length>0)};
}
function cacheRead(key,store){
  const cached=memory.get(key);
  if(cached&&cached.exp>Date.now())return cached.value;
  try{
    const item=JSON.parse(store?.getItem(CACHE_PREFIX+key)||'null');
    if(item&&item.exp>Date.now()&&item.value&&typeof item.value==='object'){
      memory.set(key,item);return item.value;
    }
  }catch{}
  return null;
}
function cacheWrite(key,value,store){
  const item={exp:Date.now()+CACHE_AGE_MS,value};
  memory.set(key,item);
  try{
    const json=JSON.stringify(item);
    if(json.length<SOFT_LIMIT)store?.setItem(CACHE_PREFIX+key,json);
  }catch{}
}
export async function fetchDictionary(raw,{
  fetcher=globalThis.fetch,storage=globalThis.localStorage,
  timeoutMs=7000
}={}){
  const word=dictionaryWord(raw);
  const key=word.toLocaleLowerCase('fr');
  const cached=cacheRead(key,storage);
  if(cached)return cached;
  if(inFlight.has(key))return inFlight.get(key);
  if(typeof fetcher!=='function')throw Error('This browser cannot load the dictionary.');
  const task=(async()=>{
    const controller=new AbortController();
    const timer=setTimeout(()=>controller.abort(),timeoutMs);
    try{
      const response=await fetcher(lookupURL(word),{
        method:'GET',signal:controller.signal,credentials:'omit',
        headers:{Accept:'application/json'}
      });
      if(!response?.ok)throw Error('The free dictionary is unavailable right now.');
      const type=response.headers?.get?.('content-type');
      if(type&&!/json/i.test(type))throw Error('The dictionary returned an unexpected format.');
      const parsed=parseDictionary(await response.json(),word);
      cacheWrite(key,parsed,storage);
      return parsed;
    }catch(error){
      if(error?.name==='AbortError')throw Error('Dictionary request timed out. Use the source link instead.');
      throw error;
    }finally{clearTimeout(timer);}
  })();
  inFlight.set(key,task);
  try{return await task;}
  finally{inFlight.delete(key);}
}
