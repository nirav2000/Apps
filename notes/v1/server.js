// Shared Notes central Firestore backend. Access is restricted by the calling
// App Monitor Worker to a verified administrator session.
const APP_RE=/^[a-zA-Z0-9_.-]{1,80}$/;
const ID_RE=/^[a-zA-Z0-9_.-]{1,120}$/;
const root=(env,app)=>'https://firestore.googleapis.com/v1/projects/'+encodeURIComponent(env.NOTES_FIREBASE_PROJECT_ID||'kk-syllabus')+'/databases/(default)/documents/sharedDevelopmentAnnotations/'+encodeURIComponent(app)+'/notes';
const err=(message,status,headers)=>Response.json({ok:false,error:message},{status,headers});
const text=(v,max=6000)=>String(v??'').slice(0,max);
const validApp=v=>APP_RE.test(String(v||''))?String(v):'';
const validId=v=>ID_RE.test(String(v||''))?String(v):'';
const docId=(app,id)=>id;
const parseDoc=d=>{try{return JSON.parse(d?.fields?.payload?.stringValue||'null')}catch{return null}};
async function call(env,token,app,path,method='GET',body){
  const r=await fetch(root(env,app)+path,{method,headers:{Authorization:'Bearer '+token,...(body?{'Content-Type':'application/json'}:{})},body:body?JSON.stringify(body):undefined,cache:'no-store'});
  if(!r.ok){const e=new Error('Firestore '+r.status);e.status=r.status;e.operation=method;throw e}
  return method==='DELETE'?{}:r.json();
}
async function list(env,token,app){
  let pageToken='',notes=[],pages=0;
  do{
    const query='?pageSize=200'+(pageToken?'&pageToken='+encodeURIComponent(pageToken):'');
    const url=root(env,app)+query;
    const r=await fetch(url,{headers:{Authorization:'Bearer '+token},cache:'no-store'});
    if(r.status===404)return [];
    if(!r.ok){const e=new Error('Firestore '+r.status);e.status=r.status;throw e}
    const data=await r.json();
    for(const doc of data.documents||[]){const note=parseDoc(doc);if(note&&note.appId===app)notes.push(note)}
    pageToken=data.nextPageToken||'';pages++;
  }while(pageToken&&pages<20);
  if(pageToken)throw new Error('Annotation collection exceeds safe pagination limit');
  return notes;
}
async function save(env,token,note){
  const id=docId(note.appId,note.id);
  await call(env,token,note.appId,'/'+encodeURIComponent(id),'PATCH',{fields:{payload:{stringValue:JSON.stringify(note)}}});
  return note;
}
async function createIssue(env,note){
  if(!env.NOTES_GITHUB_ISSUES_TOKEN)return {status:'pending-configuration'};
  const marker='<!-- shared-annotation:'+note.appId+':'+note.id+' -->';
  const headers={Authorization:'Bearer '+env.NOTES_GITHUB_ISSUES_TOKEN,Accept:'application/vnd.github+json','Content-Type':'application/json','User-Agent':'apps-shared-notes'};
  // Retry-safe lookup: recover issues created before a previous Firestore link update failed.
  const search=await fetch('https://api.github.com/search/issues?q='+encodeURIComponent('repo:nirav2000/Apps is:issue in:body "shared-annotation:'+note.appId+':'+note.id+'"'),{headers:{Authorization:headers.Authorization,Accept:headers.Accept,'User-Agent':headers['User-Agent']}});
  if(!search.ok)return {status:'failed',code:search.status};
  const matches=(await search.json()).items||[];
  const existing=matches.find(issue=>issue.body?.includes(marker));
  if(existing)return {status:'created',number:existing.number,url:existing.html_url,reused:true};
  const body=[marker,'## Annotation','App: '+note.appId,'Page: '+note.page,'Element: '+note.anchorLabel+' ('+note.anchorId+')','Version: '+note.appVersion,'Note ID: '+note.id,'','## Requested change',note.text,'','## Verification','Implement, test and deploy before marking this annotation verified.'].join('\n');
  const response=await fetch('https://api.github.com/repos/nirav2000/Apps/issues',{method:'POST',headers,body:JSON.stringify({title:'['+note.appId+'] '+note.text.slice(0,95),body})});
  if(!response.ok)return {status:'failed',code:response.status};
  const issue=await response.json();return {status:'created',number:issue.number,url:issue.html_url};
}
async function publishPending(env,token,app,limit=20){
  const existing=await list(env,token,app);
  const pending=existing.filter(n=>n.reviewRequired&&n.status==='open'&&!n.metadata?.developmentIssue?.number);
  const results=[];
  for(const note of pending.slice(0,limit)){
    const issue=await createIssue(env,note);
    if(issue.status==='created'){
      const updated={...note,metadata:{...note.metadata,developmentIssue:issue},updatedAt:new Date().toISOString()};
      await save(env,token,updated);
    }
    results.push({id:note.id,...issue});
  }
  return {status:!env.NOTES_GITHUB_ISSUES_TOKEN?'pending-configuration':results.some(x=>x.status==='failed')?'partial':'processed',results,remaining:Math.max(0,pending.length-limit)};
}

export async function notesRoute(request,env,headers,url,getGoogleToken){
  if(!env.FIREBASE_ADMIN_SERVICE_ACCOUNT_JSON)return err('Firebase backend credentials not configured',503,headers);
  let token;try{token=await getGoogleToken(env)}catch{return err('Firebase authentication unavailable',503,headers)}
  const sync=url.pathname.endsWith('/sync'),statuses=url.pathname.endsWith('/statuses');
  const app=validApp(url.searchParams.get('appId'));
  try{
    if(request.method==='GET'){
      if(!app)return err('Valid appId required',400,headers);
      const notes=await list(env,token,app);
      if(statuses)return Response.json({ok:true,notes:notes.filter(n=>n.status==='implemented').map(n=>({id:n.id,status:n.status,updatedAt:n.updatedAt,implementationVersion:n.implementationVersion,commit:n.implementationCommit,message:n.implementationMessage}))},{headers});
      return Response.json({ok:true,notes},{headers});
    }
    if(request.method!=='POST')return err('Method not allowed',405,headers);
    if(Number(request.headers.get('Content-Length')||0)>32000)return err('Payload too large',413,headers);
    let data;try{data=await request.json()}catch{return err('Invalid JSON',400,headers)}
    if(sync){
      const target=validApp(data.appId);if(!target)return err('Valid appId required',400,headers);
      const result=await publishPending(env,token,target);
      return Response.json({ok:true,...result},{headers});
    }
    if(data.action==='save'){
      const raw=data.note||{},target=validApp(raw.appId),id=validId(raw.id);
      if(!target||!id||!text(raw.text).trim()||String(raw.text).length>6000)return err('Invalid annotation',400,headers);
      const note={...raw,id,appId:target,text:text(raw.text),page:text(raw.page,1000),anchorId:text(raw.anchorId,300),anchorLabel:text(raw.anchorLabel,300),appVersion:text(raw.appVersion,100),createdAt:text(raw.createdAt,60),updatedAt:new Date().toISOString()};
      if(!['open','archived','wont-fix'].includes(note.status)&&note.status!=='implemented')return err('Invalid status',400,headers);
      const existing=await call(env,token,target,'/'+encodeURIComponent(docId(target,id))).then(parseDoc).catch(e=>{if(e.status===404)return null;throw e});
      if(existing?.metadata?.developmentIssue)note.metadata={...note.metadata,developmentIssue:existing.metadata.developmentIssue};
      if(note.status==='implemented'&&existing?.status!=='implemented')return err('Use verified completion workflow to mark implemented',409,headers);
      if(existing?.status==='implemented'&&note.status==='implemented'){note.implementationVersion=existing.implementationVersion;note.implementationCommit=existing.implementationCommit;note.implementationMessage=existing.implementationMessage;note.implementedAt=existing.implementedAt;}
      await save(env,token,note);
      let review={status:'not-required'};
      if(note.status==='open'&&note.reviewRequired&&!note.metadata?.developmentIssue?.number){
        try{
          const issue=await createIssue(env,note);
          review=issue;
          if(issue.status==='created'){
            note.metadata={...note.metadata,developmentIssue:issue};
            await save(env,token,note);
          }
        }catch(error){console.error('Annotation issue publishing failed',{message:String(error.message||error).slice(0,160)});review={status:'failed'}}
      }
      return Response.json({ok:true,note,review},{headers});
    }
    if(data.action==='verify'){
      const target=validApp(data.appId),id=validId(data.id),version=text(data.version,100).trim(),commit=text(data.commit,100).trim();
      if(!target||!id||!version||!(/^[a-f0-9]{7,40}$/i.test(commit)))return err('App, annotation ID, deployed version and commit SHA are required',400,headers);
      const note=await call(env,token,target,'/'+encodeURIComponent(id)).then(parseDoc);
      if(!note||!note.metadata?.developmentIssue?.number)return err('Annotation must have a linked GitHub issue',409,headers);
      if(!env.NOTES_GITHUB_ISSUES_TOKEN)return err('GitHub verification integration not configured',503,headers);
      const issueNumber=Number(note.metadata.developmentIssue.number);
      const ghHeaders={Authorization:'Bearer '+env.NOTES_GITHUB_ISSUES_TOKEN,Accept:'application/vnd.github+json','User-Agent':'apps-shared-notes'};
      const [issueResponse,commitResponse]=await Promise.all([
        fetch('https://api.github.com/repos/nirav2000/Apps/issues/'+issueNumber,{headers:ghHeaders}),
        fetch('https://api.github.com/repos/nirav2000/Apps/commits/'+encodeURIComponent(commit),{headers:ghHeaders})
      ]);
      if(!issueResponse.ok||!commitResponse.ok)return err('Cannot verify linked GitHub issue or commit',409,headers);
      const issue=await issueResponse.json(),revision=await commitResponse.json();
      if(issue.state!=='closed'||!revision.sha?.startsWith(commit))return err('Close the GitHub issue and provide an existing commit before verification',409,headers);
      const message=text(data.message,1000).trim();
      if(!message||data.deploymentVerified!==true||data.testsVerified!==true)return err('Document tests, deployment and verification before marking implemented',400,headers);
      const updated={...note,status:'implemented',reviewRequired:false,implementationStatus:'implemented',implementationVersion:version,implementationCommit:revision.sha,implementationMessage:message,implementedAt:new Date().toISOString(),updatedAt:new Date().toISOString()};
      await save(env,token,updated);return Response.json({ok:true,note:updated},{headers});
    }
    if(data.action==='remove'){
      const target=validApp(data.appId),id=validId(data.id);
      if(!target||!id)return err('Invalid annotation ID',400,headers);
      try{await call(env,token,target,'/'+encodeURIComponent(docId(target,id)),'DELETE')}catch(e){if(e.status!==404)throw e}
      return Response.json({ok:true},{headers});
    }
    return err('Unknown action',400,headers);
  }catch(error){const upstream=Number(error.status)||0;console.error('Shared notes backend failure',{operation:error.operation||request.method,upstreamStatus:upstream,message:String(error.message||error).slice(0,180)});return err(upstream?'Firestore returned '+upstream+' while processing annotations':'Annotation backend request failed',upstream===403?403:502,headers)}
}
