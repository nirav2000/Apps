import fs from 'node:fs';
import assert from 'node:assert/strict';

const source=fs.readFileSync(new URL('./policy.js',import.meta.url),'utf8');
const policy=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));

const base=policy.normalisePolicy({
  policyOwnerId:'owner-1',
  costBearerId:'owner-1',
  allowedChannels:{in_app:true,email:false,sms:false},
  allowedEvents:{'record.created':true,'record.updated':true}
});

assert.equal(policy.channelAllowed(base,{userId:'owner-1',role:'owner',channel:'sms'}),true,'policy owner must be able to choose their own delivery method');
assert.equal(policy.channelAllowed(base,{userId:'member-a',role:'member',channel:'sms'}),false,'scope default must block SMS for ordinary members');

assert.equal(
  policy.effectivePreferences({
    policy:base,
    preferences:{channels:{sms:true}},
    userId:'member-a',
    role:'member',
    eventTypes:[]
  }).channels.sms.enabled,
  false,
  'recipient preference must not bypass notification policy'
);

const userOverride=policy.normalisePolicy({
  ...base,
  userChannels:{'member-a':{email:true,sms:true}}
});
assert.equal(policy.channelAllowed(userOverride,{userId:'member-a',role:'member',channel:'email'}),true,'individual grant must override scope default');
assert.equal(policy.channelAllowed(userOverride,{userId:'member-b',role:'member',channel:'email'}),false,'individual grant must not leak to another user');

const roleOverride=policy.normalisePolicy({
  ...base,
  roleChannels:{admin:{email:true}},
  userChannels:{'admin-a':{email:false}}
});
assert.equal(policy.channelAllowed(roleOverride,{userId:'admin-b',role:'admin',channel:'email'}),true,'role grant should apply');
assert.equal(policy.channelAllowed(roleOverride,{userId:'admin-a',role:'admin',channel:'email'}),false,'individual denial must beat role grant');

const mandatory=policy.normalisePolicy({
  ...base,
  mandatoryEvents:{'record.updated':true}
});
const effective=policy.effectivePreferences({
  policy:mandatory,
  preferences:{events:{'record.updated':false}},
  userId:'member-a',
  role:'member',
  eventTypes:['record.updated']
});
assert.equal(effective.events['record.updated'].enabled,true,'mandatory event must remain enabled');

assert.equal(policy.channelAllowed(
  policy.normalisePolicy({...base,roleChannels:{external:{web_push:true}}}),
  {userId:'external-a',role:'external',channel:'web_push'}
),true,'role names must be arbitrary and app-defined');

console.log('Notifications generic policy tests passed');
