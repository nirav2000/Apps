const ALLOWED_ORIGINS=new Set([
  "https://nirav2000.github.io",
  "http://localhost:8000",
  "http://localhost:8080",
  "http://127.0.0.1:8000",
  "http://127.0.0.1:8080"
]);

function cors(origin){
  return {
    "Access-Control-Allow-Origin":ALLOWED_ORIGINS.has(origin)?origin:"https://nirav2000.github.io",
    "Access-Control-Allow-Methods":"POST,OPTIONS,GET",
    "Access-Control-Allow-Headers":"Content-Type",
    "Access-Control-Max-Age":"86400",
    "Vary":"Origin"
  };
}
function json(data,status,origin){
  return new Response(JSON.stringify(data),{status,headers:{"Content-Type":"application/json",...cors(origin)}});
}
function languageInstructions(lang){
  const base="Speak as a careful, natural language teacher giving a canonical learner reference. Use natural connected speech, clear articulation, moderate pace, no exaggerated syllable separation, no added words, no translation, and no commentary.";
  if((lang||"").toLowerCase().startsWith("fr"))return base+" Use standard contemporary French pronunciation as taught to learners in the UK. Preserve liaison and elision naturally where appropriate.";
  if((lang||"").toLowerCase().startsWith("en-gb"))return base+" Use contemporary standard British English pronunciation.";
  return base+" Use a neutral standard pronunciation for the requested language.";
}
function cacheKey(text,lang,voice){
  return new Request("https://pronunciation-cache.invalid/reference?"+new URLSearchParams({text,lang,voice}).toString(),{method:"GET"});
}

export default {
  async fetch(request,env,ctx){
    const origin=request.headers.get("Origin")||"";
    if(request.method==="OPTIONS")return new Response(null,{status:204,headers:cors(origin)});
    const url=new URL(request.url);

    if(url.pathname==="/health"){
      return json({ok:true,service:"apps-pronunciation-api",workersAIConfigured:!!env.AI,openaiConfigured:!!env.OPENAI_API_KEY},200,origin);
    }
    if(url.pathname!=="/reference"||request.method!=="POST")return json({error:"Not found"},404,origin);
    if(origin&&!ALLOWED_ORIGINS.has(origin))return json({error:"Origin not allowed"},403,origin);
    if(!env.OPENAI_API_KEY&&!env.AI)return json({error:"Reference generator is not configured"},503,origin);

    let body;
    try{body=await request.json();}catch(e){return json({error:"Invalid JSON"},400,origin);}
    const text=String(body.targetText||"").trim();
    const lang=String(body.lang||"fr-FR").trim();
    if(!text||text.length>500)return json({error:"targetText must be 1-500 characters"},400,origin);

    const voice=String(body.voice||env.DEFAULT_TTS_VOICE||"cedar");
    const provider=env.OPENAI_API_KEY?"openai":"cloudflare";
    const key=cacheKey(text,lang,provider+":"+voice);
    const cached=await caches.default.match(key);
    if(cached){
      const h=new Headers(cached.headers);Object.entries(cors(origin)).forEach(([k,v])=>h.set(k,v));h.set("X-Pronunciation-Cache","HIT");
      return new Response(cached.body,{status:cached.status,headers:h});
    }

    let bytes,contentType,modelLabel,voiceLabel;
    if(env.OPENAI_API_KEY){
      const payload={
        model:env.TTS_MODEL||"gpt-4o-mini-tts",
        voice,
        input:text,
        instructions:languageInstructions(lang),
        response_format:"wav",
        speed:1
      };
      const upstream=await fetch("https://api.openai.com/v1/audio/speech",{
        method:"POST",
        headers:{"Authorization":"Bearer "+env.OPENAI_API_KEY,"Content-Type":"application/json"},
        body:JSON.stringify(payload)
      });
      if(!upstream.ok){
        let detail="Speech generation failed";
        try{const err=await upstream.json();detail=err&&err.error&&err.error.message||detail;}catch(e){}
        return json({error:detail},502,origin);
      }
      bytes=await upstream.arrayBuffer();
      contentType="audio/wav";modelLabel=payload.model;voiceLabel=voice;
    }else{
      try{
        const language=(lang||"fr-FR").split("-")[0].toLowerCase();
        const generated=await env.AI.run("@cf/myshell-ai/melotts",{prompt:text,lang:language});
        if(!generated||!generated.audio)throw new Error("No audio returned");
        const binary=atob(generated.audio),out=new Uint8Array(binary.length);
        for(let i=0;i<binary.length;i++)out[i]=binary.charCodeAt(i);
        bytes=out.buffer;contentType="audio/mpeg";modelLabel="@cf/myshell-ai/melotts";voiceLabel="Cloudflare multilingual model";
      }catch(e){
        return json({error:"Cloudflare pronunciation generation failed"},502,origin);
      }
    }

    const headers=new Headers({
      "Content-Type":contentType,
      "Cache-Control":"public, max-age=2592000, immutable",
      "X-Pronunciation-Model":modelLabel,
      "X-Pronunciation-Voice":voiceLabel,
      "X-AI-Generated-Voice":"true",
      "Access-Control-Expose-Headers":"X-Pronunciation-Model,X-Pronunciation-Voice,X-AI-Generated-Voice",
      ...cors(origin)
    });
    const response=new Response(bytes,{status:200,headers});
    ctx.waitUntil(caches.default.put(key,new Response(bytes,{status:200,headers:{"Content-Type":contentType,"Cache-Control":"public, max-age=2592000, immutable","X-Pronunciation-Model":modelLabel,"X-Pronunciation-Voice":voiceLabel,"X-AI-Generated-Voice":"true"}})));
    return response;
  }
};