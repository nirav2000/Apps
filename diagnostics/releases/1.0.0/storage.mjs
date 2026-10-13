import {LIMITS,importReport} from './core.mjs';
const DB='apps-diagnostics-v1',STORE='reports';
async function database(){return new Promise((resolve,reject)=>{const q=indexedDB.open(DB,1);q.onupgradeneeded=()=>q.result.createObjectStore(STORE,{keyPath:'id'});q.onsuccess=()=>resolve(q.result);q.onerror=()=>reject(Error('Private/local report storage is unavailable. Export the report instead.'));});}
async function run(mode,action){const db=await database();try{return await new Promise((resolve,reject)=>{const tx=db.transaction(STORE,mode);let result;try{const q=action(tx.objectStore(STORE));q.onsuccess=()=>{result=q.result;};}catch(e){reject(e);return;}tx.oncomplete=()=>resolve(result);tx.onerror=()=>reject(Error('Report storage failed or its quota was reached. Export before leaving.'));tx.onabort=()=>reject(Error('Report storage was interrupted.'));});}finally{db.close();}}
export const listReports=async()=>((await run('readonly',s=>s.getAll()))||[]).sort((a,b)=>b.createdAt.localeCompare(a.createdAt));
export const getReport=id=>run('readonly',s=>s.get(id));
export const deleteReport=id=>run('readwrite',s=>s.delete(id));
export async function saveReport(report){
  const clean=importReport(JSON.stringify(report));
  // Only locally written issue links are retained. They never grant authority.
  if(report.publication?.url?.match(/^https:\/\/github\.com\/nirav2000\/Apps\/issues\/\d+$/))clean.publication={url:report.publication.url,number:Number(report.publication.number),status:'created'};
  await run('readwrite',s=>s.put(clean));
  const reports=await listReports();for(const old of reports.slice(LIMITS.reports))await deleteReport(old.id);
  return clean;
}
export function downloadBlob(blob,name){const u=URL.createObjectURL(blob);const a=document.createElement('a');a.href=u;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(u),15000);}
export const exportReport=r=>downloadBlob(new Blob([JSON.stringify(r,null,2)],{type:'application/json'}),r.id+'.json');
