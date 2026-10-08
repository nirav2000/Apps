import test from 'node:test';
import assert from 'node:assert/strict';
import { ownerProjectIds, ownerDocumentPath, ownerPageToken, ownerDocSummary, ownerUserSummary } from './app-monitor-owner-data.js';

test('projects are unique and strictly validated', () => {
 assert.deepEqual(ownerProjectIds('kk-syllabus,snag-509418,kk-syllabus,../../bad'), ['kk-syllabus','snag-509418']);
});
test('Firestore collection and document paths enforce alternating segments', () => {
 assert.equal(ownerDocumentPath('snag_projects',true),'snag_projects');
 assert.equal(ownerDocumentPath('snag_projects/abc',false),'snag_projects/abc');
 assert.equal(ownerDocumentPath('snag_projects/abc/members',true),'snag_projects/abc/members');
 assert.equal(ownerDocumentPath('snag_projects/abc',true),null);
 assert.equal(ownerDocumentPath('snag_projects',false),null);
 assert.equal(ownerDocumentPath('snag_projects/../members',true),null);
 assert.equal(ownerDocumentPath('snag_projects/%2F',false),null);
});
test('pagination and user summary are bounded and do not expose sensitive fields', () => {
 assert.equal(ownerPageToken('x'.repeat(3000)),'');
 assert.deepEqual(ownerUserSummary({localId:'uid',email:'a@example.com',passwordHash:'secret',providerUserInfo:[{providerId:'google.com'}]}),{uid:'uid',email:'a@example.com',displayName:'',disabled:false,createdAt:null,lastLoginAt:null,providers:['google.com']});
});
test('document summary excludes raw fields', () => {
 assert.deepEqual(ownerDocSummary({name:'projects/x/databases/(default)/documents/snags/one',fields:{token:{stringValue:'secret'}}}),{id:'one',path:'snags/one',createdAt:null,updatedAt:null});
});
