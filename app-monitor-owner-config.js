// Firebase Owner Console configuration and response shaping.
// The Worker must implement credential exchange server-side; never send credentials to browsers.
export const OWNER_PROJECT_IDS_DEFAULT=['kk-syllabus','snag-509418'];
export function ownerProjectIds(value){
 const ids=String(value||OWNER_PROJECT_IDS_DEFAULT.join(',')).split(',').map(s=>s.trim());
 return [...new Set(ids.filter(s=>/^[a-z][a-z0-9-]{4,40}$/.test(s)))].slice(0,25);
}
export function ownerConnectionSummary(projectId,firestore,authentication){
 return {projectId,firestore:{connected:firestore===true},authentication:{connected:authentication===true},status:firestore&&authentication?'connected':'attention-required'};
}
