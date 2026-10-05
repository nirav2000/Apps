# Notifications v1 — Adoption & Installation Guide

## Consumer UI safety rule

**Recipient-facing notification UI must never expose provider setup, credentials, Firebase/Google console links, Worker configuration, secrets, or other developer controls.** New installations default to the consumer experience: explain the benefit, offer an app-level **Enable notifications** action, request the OS/browser permission only after the user taps it, register the device with the trusted backend, and offer normal event/delivery preferences. On iPhone/iPad, explain the Home Screen requirement when applicable.

Provider setup is an administrator/developer surface only. `mountRecipientPreferences()` therefore hides provider setup actions by default. A deliberately developer-only tool may opt in with `developerSetup: true`; production consumer apps must not set it.

A notification installation is **not complete** merely because the shared UI, FCM configuration or sender backend exists. Before marking browser push installed/ready, verify the full chain: consumer opt-in → OS permission → FCM/device registration → authenticated server storage of the recipient device → server event routing → FCM delivery → notification received while the app is backgrounded/closed → deep link opens correctly.


This is the canonical guide for installing the shared Notifications capability into a consuming app.

It is written for both human developers and AI-assisted development (including ChatGPT). Follow it before changing a production app.

---

## 1. First principle

**Do not copy notification infrastructure into the consuming app.**

The consuming app should provide only:
- app identity;
- scope mapping;
- user identity;
- role mapping;
- event names;
- a thin authenticated transport adapter;
- small event-emission hooks;
- optional mount points for shared notification UI.

The shared Notifications package owns:
- policy evaluation;
- role and user overrides;
- recipient preferences;
- mandatory events;
- cost governance;
- notification UI;
- browser-push registration;
- provider adapters;
- event schema;
- audit/delivery concepts.

If integration starts requiring large amounts of app-specific notification code, stop and reassess the architecture.

---

## 2. Before touching the consuming app

ChatGPT / the developer must first inspect:

1. **Authentication**
   - How is the current user authenticated?
   - What stable user ID is available?
   - Is there already a server-side authenticated backend?

2. **Roles / membership**
   - What role string(s) does the app already use?
   - Do not invent notification-specific roles if existing app roles are sufficient.

3. **Scope**
   - Decide what `scopeId` means in this app.
   - Examples: account, workspace, project, household, class, team, or `default`.

4. **Policy controller**
   - Identify the app user who controls notification permissions.
   - Map that user to `policyOwnerId`.

5. **Cost bearer**
   - Identify who should be treated as paying for metered notifications.
   - Map that user/account to `costBearerId`.

6. **Notification events**
   - List the app-specific events that should be emitted.
   - Use stable dot-separated names, e.g. `record.created`, `record.updated`, `comment.added`.
   - Event names belong to the consuming app, not the shared module.

7. **Existing UI**
   - Identify where a notification bell, inbox, recipient preferences, and controller permissions could mount.
   - Prefer shared UI components rather than custom reimplementations.

8. **Persistence / backend**
   - Decide where policy, preferences, inbox and delivery records will live.
   - Prefer the app's existing authenticated backend unless a future central Notifications service has been explicitly adopted.

Do not modify the production app until these mappings are understood.

---

## 3. Prove the required behaviour in Notifications Lab first

Open:

`https://nirav2000.github.io/Apps/notifications/v1/lab.html`

Before integrating a new production app, reproduce the required permission model in the Lab using generic roles and events.

Verify at minimum:
- scope default permissions;
- role override;
- individual-user override;
- recipient preference;
- mandatory event;
- a blocked metered channel;
- policy-controller self-preference;
- delivery audit / cost bearer;
- event routed to one or more recipients.

If the shared module cannot model the required behaviour in the Lab, improve the shared module **first**. Do not solve the gap inside the consuming app.

---

## 4. Preferred loading method

Prefer Apps Platform where it is already available:

```html
<script src="https://nirav2000.github.io/Apps/platform/v1/index.js"></script>
```

Then:

```js
const notificationsModule = await AppsPlatformV1.loadCapability('notifications');
```

The Notifications capability exposes the shared client, policy helpers, UI helpers, and browser-push helpers.

Direct ES-module import is also supported:

```js
import {
  createNotifications,
  mountRecipientPreferences,
  mountPolicyDefaults,
  mountRoleNotificationPolicy,
  mountMemberNotificationSettings,
  createNotificationBell,
  registerWebPush
} from 'https://nirav2000.github.io/Apps/notifications/v1/index.js';
```

Do not copy these files into the consuming app.

---

## 5. Required transport contract

The browser client is transport-agnostic.

A production transport should provide:

```js
const transport = {
  emit(event) {},
  policy(scopeId) {},
  savePolicy(scopeId, policy) {},
  preferences(scopeId, userId) {},
  savePreferences(scopeId, userId, preferences) {},
  inbox(scopeId, userId, options) {},
  deliveryLog(scopeId, options) {} // optional but recommended
};
```

Requirements:
- all mutating operations must be authenticated server-side;
- policy writes must be authorised to the policy controller;
- recipient preference writes must enforce the policy ceiling server-side;
- paid/restricted delivery methods must be checked server-side before delivery;
- the browser must never hold provider secrets.

Do **not** use `memory-transport.js` in production. It exists only for the Lab.

---

## 6. Create the client

Example:

```js
const notifications = createNotifications({
  app: 'example-app',
  transport,
  eventTypes: [
    'record.created',
    'record.updated',
    'comment.added'
  ]
});
```

The app-specific event catalogue stays in the consuming app.

---

## 7. Map app concepts to the generic model

Example mapping:

```js
const notificationContext = {
  scopeId: currentWorkspace.id,
  userId: currentUser.id,
  role: currentMembership.role,
  policyOwnerId: workspace.ownerId,
  costBearerId: workspace.billingOwnerId
};
```

The shared module must not be changed to understand application-specific nouns.

For example, if an app has roles such as:
- teacher;
- pupil;
- homeowner;
- builder;
- customer;
- agent;

pass those strings as role values. Do not add those concepts to `notifications/v1`.

---

## 8. Reuse shared UI

Recipient preferences:

```js
await mountRecipientPreferences(root, {
  client: notifications,
  scopeId,
  userId,
  role,
  eventTypes
});
```

Policy defaults:

```js
await mountPolicyDefaults(root, {
  client: notifications,
  scopeId,
  eventTypes
});
```

Role overrides:

```js
await mountRoleNotificationPolicy(root, {
  client: notifications,
  scopeId,
  role,
  eventTypes
});
```

Individual member access:

```js
await mountMemberNotificationSettings(root, {
  client: notifications,
  scopeId,
  member: {
    userId: member.id,
    role: member.role
  },
  eventTypes
});
```

Use the shared UI terminology:
- **Delivery methods**
- **Notification events**
- **Notification permissions**
- **Receive**

Do not replace these with ambiguous labels such as "How to tell me" or "What to tell me about".

---

## 9. Emit app events with tiny hooks

Event hooks should be small and should not contain notification business logic.

Example:

```js
await notifications.emit('record.created', {
  scopeId,
  actorId: currentUser.id,
  recipients: recipientIds,
  title: 'New record',
  body: 'A new record was created.',
  url: recordUrl
});
```

The app should not decide provider routing in the event hook.

Avoid:
- calling email APIs directly;
- calling Twilio directly;
- duplicating policy checks in the page;
- embedding recipient permission rules in individual event handlers.

---

## 10. Recipient calculation

The consuming app is responsible for identifying candidate recipients because membership/business relationships are app-specific.

The notification system then decides whether each candidate may actually receive the event and by which delivery methods.

Pattern:

```
App business rules
  -> candidate recipient IDs
  -> Notifications policy
  -> recipient preference
  -> allowed delivery methods
  -> delivery
```

Do not put app membership/business rules into the shared Notifications module.

---

## PWA dependency and user activation

PWA and Notifications are companion capabilities, but **they are never implicitly co-installed**.

- Installing PWA does not authorise installing Notifications.
- Installing Notifications does not authorise installing PWA.
- Browser push on iPhone/iPad requires compatible PWA/Home Screen support.
- If Notifications is requested and PWA is absent, stop and report the dependency instead of modifying the app unless PWA installation was also explicitly authorised.
- A Notifications installation that exposes browser push is incomplete until the consuming app has a clear user-facing action such as **Enable browser push** / **Enable notifications**. That action must be user initiated and is the point at which browser/OS permission is requested.
- If the notification choice has never been presented to a user/device, the consuming app must present a first-use notification choice on the next eligible app open. The app should remember that the choice was presented so it does not nag on every launch; notification settings remain available later.
- Policy permission and browser permission are separate: an owner/controller can allow push, but cannot grant device notification permission for another user.

The shared-library register tracks both **adoption state** and **user activation available** so a technically installed capability is not mistaken for a usable one.

---

## 11. Browser push

The default browser-push provider is **Firebase Cloud Messaging (FCM)**.

Browser push requires:
1. an explicitly approved Firebase project with Cloud Messaging enabled;
2. a registered Firebase web app and its public web configuration;
3. a Web Push VAPID public key;
4. the shared `/Apps/firebase-messaging-sw.js` service worker;
5. trusted backend credentials capable of sending through the FCM HTTP v1 API;
6. recipient opt-in on each browser/device.

Use `registerWebPush()` from the shared SDK. The shared client uses Firebase's current FID-based registration flow and stores the Firebase Installation ID as the delivery target.

A policy controller may permit push for another user, but cannot silently grant browser notification permission on that user's device.

Only public Firebase web configuration and the public VAPID key may reach browser code. Service-account private keys must remain server-side.

OneSignal is **not** part of the default runtime stack. It may only be reconsidered as an optional provider after explicit third-party approval.

---

## 12. Provider credentials

Provider credentials stay server-side.

See:
- `/NOTIFICATIONS_SETUP.md`
- `notifications/v1/providers.js`

Supported adapters currently include:
- email;
- browser push;
- Telegram;
- WhatsApp;
- Signal bridge;
- Slack;
- Discord;
- SMS;
- native mobile push.

A provider being configured does **not** mean every app/user is allowed to use it. Policy still controls access.

---

## 12A. Third-party service approval

Before adding, enabling, configuring or recommending any new external/third-party provider, ChatGPT / the developer must explicitly tell the user:

- provider name;
- why it is needed;
- what data leaves the user's own infrastructure;
- whether a free tier exists;
- what can cause charges;
- credentials/accounts required;
- whether an existing first-party/current-infrastructure alternative exists;
- material vendor-lock-in or migration implications.

**Explicit user approval is required before the provider becomes active.**

Code may contain a dormant optional adapter, but:
- it must be clearly marked optional/unapproved;
- it must not load third-party runtime code by default;
- provider status must remain `approval-required`;
- adding credentials alone must not activate it.

Approved providers and the approval basis should be recorded in the shared provider registry/documentation.

See the project-wide `THIRD_PARTY_SERVICES.md`.

## 13. Cost governance

For potentially paid delivery methods:
- the policy controller decides whether the method is available;
- role or individual overrides can further restrict or permit it;
- recipients can only select it if allowed;
- delivery audit should retain `costBearerId`.

Never let a non-controller self-enable a metered delivery method outside policy.

---

## 14. Security requirements

A production integration must satisfy all of the following:

- provider secrets are server-side only;
- client preferences cannot bypass server-side policy;
- policy writes are controller-authorised;
- arbitrary user-supplied Slack/Discord/Signal webhooks are not accepted for shared provider credentials;
- recipients cannot read another user's inbox unless the app explicitly authorises that operation;
- event payloads do not expose data the recipient is not already permitted to view;
- notification URLs respect existing app access control.

---

## 15. Minimal-diff rule for consuming apps

A correct integration should mainly consist of:
- one transport adapter;
- one app configuration/event catalogue;
- small UI mount calls;
- small event-emission hooks.

If implementation starts adding hundreds of lines of notification policy/provider/UI logic to the consuming app, stop.

Do not:
- copy `policy.js`;
- copy `providers.js`;
- copy shared UI logic;
- copy push-registration logic;
- fork the shared module inside the app.

Fix missing shared behaviour in the Notifications package and Lab instead.

---

## 15A. Readiness must be observable

A consuming app must not present notification settings as working merely because a checkbox can be selected.

The production transport should implement:

```js
readiness(scopeId)
```

and report separate states for:
- shared/core notification engine;
- in-app delivery;
- production integration;
- each external provider.

The shared client exposes:

```js
await notifications.readiness(scopeId)
```

At minimum, the UI or diagnostics must be able to distinguish:
- `ready`;
- `not-installed`;
- `setup-required`;
- `unavailable`;
- `error`.

Before declaring an integration complete, run an end-to-end in-app test:
event -> policy -> recipient preference -> inbox -> visible notification UI.

External methods must remain labelled **Setup required** until the backend and provider credentials are genuinely configured and a test delivery succeeds.

## 16. Validation before merge/deploy

Before declaring an app integrated:

### Shared-module checks
- Notifications Lab still works.
- Shared Notifications validation is green.
- No app-specific business terms have entered `notifications/v1`.

### Consuming-app checks
- existing app release gate is green;
- authentication still works;
- existing app behaviour is unchanged when notifications are disabled;
- event emit failure cannot prevent the primary app action from succeeding unless explicitly designed otherwise;
- controller permissions work;
- role override works;
- individual override works;
- recipient preference works;
- mandatory event works;
- metered channel denial works;
- inbox isolation works;
- delivery audit records the expected cost bearer.

### Regression check
Test the app with Notifications disabled/unconfigured and confirm it behaves exactly as before.

---

## 17. Rollback requirement

Before integration, identify the exact pre-integration commit.

If adoption causes regressions or requires unexpectedly invasive app changes:
1. rollback the consuming app;
2. preserve the shared-module work;
3. reproduce the missing behaviour in Notifications Lab;
4. improve the shared module;
5. retry the thin integration later.

Do not keep patching a consuming app around weaknesses in the shared library.

---

## 18. Instructions specifically for ChatGPT / AI

When asked to "install Notifications", "add notifications", or similar in one of these apps:

1. Read this file and `notifications/v1/README.md` first.
2. Inspect the consuming app's existing auth, roles, membership, backend, release gate and UI.
3. State the proposed generic mapping:
   - app ID;
   - scope ID;
   - current-user ID;
   - role;
   - policy controller;
   - cost bearer;
   - event catalogue;
   - candidate-recipient logic;
   - persistence/transport.
4. Reproduce any unusual permission requirement in Notifications Lab before app changes.
5. Work on the app's normal branch convention. For this project that is generally `main`, unless explicitly told otherwise.
6. Keep the integration thin.
7. Do not modify the shared module merely to make one app easier unless the behaviour is genuinely generic and is first demonstrated in the Lab.
8. Do not add app-specific roles/events into the shared package.
9. Do not expose provider credentials.
10. Apply the **Third-party service approval** rule before introducing any external provider. Do not create accounts, add SDKs, add credentials, or activate a provider until the user has been explicitly informed and has approved it.
11. Add or extend release-gate checks for the adapter and event hooks, but do not duplicate shared-module tests in every app.
12. Verify existing app behaviour has not regressed.
13. Report exactly:
    - files changed in the consuming app;
    - approximate integration size;
    - event hooks added;
    - UI mount points added;
    - backend/transport changes;
    - provider configuration still required;
    - validation results.
14. If integration becomes large or invasive, stop and move the missing capability back into the shared module/Lab rather than continuing.

---

## 19. Definition of done

A consuming app is considered successfully integrated only when:

- the shared module remains the source of truth;
- the app contains no duplicated notification infrastructure;
- the policy model is enforced server-side;
- the app's event catalogue is documented;
- notification UI is using shared components where applicable;
- the app passes its normal release gate;
- Notifications shared validation remains green;
- disabling/unconfiguring notifications leaves the app's core behaviour intact;
- the integration is documented in `shared-libraries.json`.
