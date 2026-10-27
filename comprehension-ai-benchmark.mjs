const token=process.env.CLOUDFLARE_API_TOKEN,account=process.env.CLOUDFLARE_ACCOUNT_ID;
if(!token||!account){console.log('Missing credentials; benchmark skipped');process.exit(0)}
const modelNames=['@cf/qwen/qwen3-30b-a3b-fp8','@cf/openai/gpt-oss-20b'];
const task={question:'Explain how the writer makes the man seem threatening.',quote:'His voice sounded like a hammer striking an anvil.',answer:'The writer uses a simile and makes the man scary.'};
const system='You are a friendly UK 11+ tutor for a 9-year-old. Assess this exact answer. In JSON, return achieved array, nextStep string, question string, hint string, rationale string, suggestedTechnique string, techniqueReason string, rubric object containing booleans actionTarget,evidence,explanation,effect, and confidence string. Focus on ONE small next step. Do not give a full model answer or invent evidence. Reply with JSON only.';
for(const model of modelNames){
  try{
    const response=await fetch('https://api.cloudflare.com/client/v4/accounts/'+account+'/ai/run/'+model,{
      method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify({messages:[{role:'system',content:system},{role:'user',content:JSON.stringify(task)}],max_tokens:550,temperature:0.2})
    });
    const body=await response.json();
    if(!response.ok||!body.success){console.log(model,'inference unavailable:',response.status,body.errors?.map(x=>x.code).join(','));continue}
    const raw=body.result?.response||JSON.stringify(body.result);
    console.log('MODEL',model,'RESULT',String(raw).slice(0,1600));
    const match=String(raw).match(/\{[\s\S]*\}/);
    if(!match){console.log('Structured output not found');continue}
    try{const data=JSON.parse(match[0]);console.log('PARSED',!!data.nextStep,!!data.question,Array.isArray(data.achieved))}catch{console.log('JSON not parseable')}
  }catch(e){console.log(model,'error',String(e.message).slice(0,150))}
}
