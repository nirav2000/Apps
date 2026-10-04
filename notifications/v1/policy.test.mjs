import fs from 'node:fs';
import assert from 'node:assert/strict';

const source=fs.readFileSync(new URL('./policy.js',import.meta.url),'utf8');
const policy=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));

const base=policy.normaliseOwnerPolicy({
  ownerId:'homeowner',
  allowedChannels:{in_app:true,email:false,sms:false},
  allowedEvents:{'snag.created':true,'snag.updated':true}
});

assert.equal(policy.channelAllowed(base,{userId:'homeowner',role:'owner',channel:'sms'}),true,'owner must be able to opt into a paid channel for themselves');
assert.equal(policy.eventAllowed(base,{userId:'homeowner',role:'owner',eventType:'snag.created'}),true,'owner must not be constrained by the recipient ceiling');

assert.equal(policy.channelAllowed(base,{userId:'builder-a',role:'contractor',channel:'sms'}),false,'project default must block SMS');
assert.equal(
  policy.effectivePreferences({policy:base,preferences:{channels:{sms:true}},userId:'builder-a',role:'contractor',eventTypes:[]}).channels.sms.enabled,
  false,
  'recipient preference must not bypass owner policy'
);

const userOverride=policy.normaliseOwnerPolicy({
  ...base,
  userChannels:{'builder-a':{email:true,sms:true}}
});
assert.equal(policy.channelAllowed(userOverride,{userId:'builder-a',role:'contractor',channel:'email'}),true,'owner must be able to grant email to one member');
assert.equal(policy.channelAllowed(userOverride,{userId:'builder-b',role:'contractor',channel:'email'}),false,'grant must not leak to another member');

const roleOverride=policy.normaliseOwnerPolicy({
  ...base,
  roleChannels:{contractor:{email:true}},
  userChannels:{'builder-a':{email:false}}
});
assert.equal(policy.channelAllowed(roleOverride,{userId:'builder-b',role:'contractor',channel:'email'}),true,'role grant should apply');
assert.equal(policy.channelAllowed(roleOverride,{userId:'builder-a',role:'contractor',channel:'email'}),false,'specific user denial must beat role grant');

const mandatory=policy.normaliseOwnerPolicy({
  ...base,
  mandatoryEvents:{'snag.updated':true}
});
const effective=policy.effectivePreferences({
  policy:mandatory,
  preferences:{events:{'snag.updated':false}},
  userId:'builder-a',
  role:'contractor',
  eventTypes:['snag.updated']
});
assert.equal(effective.events['snag.updated'].enabled,true,'mandatory owner event must remain enabled');

console.log('Notifications owner-policy tests passed');
