# Apps Notifications v1

A shared, app-independent notification capability for the Apps portfolio.

## What belongs in the shared module

The module owns:
- notification event schema;
- delivery-method catalogue;
- policy evaluation;
- role and user overrides;
- recipient preferences;
- mandatory events;
- cost-bearer metadata;
- reusable notification settings UI;
- reusable policy/member controls;
- browser-push registration;
- provider adapters;
- transport contracts;
- audit/delivery concepts.

A consuming app supplies:
- its own event names;
- its own users and arbitrary role strings;
- the policy controller / cost bearer;
- authentication;
- persistence or a transport adapter;
- small event-emission hooks.

The shared module does **not** know app-specific concepts such as homeowner, builder, teacher, pupil, customer, contractor or snag.

## Clear UI terminology

Use:
- **Delivery methods** — where a notification is sent, e.g. in-app, email, push, SMS.
- **Notification events** — which changes trigger a notification.
- **Notification permissions** — the maximum delivery methods/events allowed by policy.
- **Receive** — the recipient's current preference inside that permission ceiling.

Avoid ambiguous labels such as "How to tell me" or "What to tell me about".

## Generic policy model

The policy controller defines defaults and may override them by role or individual user.

Precedence:
1. individual user override;
2. role override;
3. scope default.

The policy controller is not constrained by the recipient ceiling for their own preferences.

A recipient can save preferences only for delivery methods/events that policy permits. Metered channels can therefore be blocked unless explicitly authorised.

## Scope

A `scopeId` is an app-defined notification boundary. It can represent an account, workspace, project, household, class, team or simply `default`.

The module does not prescribe what a scope means.

## Lab

Open:

`/Apps/notifications/v1/lab.html`

The Notifications Lab is the first consumer of this module. It uses:
- generic roles: owner, admin, member, external;
- generic events: record created/updated, comment, deadline and sign-in;
- a local memory transport;
- simulated external delivery;
- the real shared policy and UI modules.

No production app should be modified merely to test Notifications v1.

## Installation guide

Before installing Notifications into a production app, read:

`notifications/v1/INSTALLATION.md`

This is the canonical adoption guide for both human developers and ChatGPT/AI-assisted integrations. It defines the required app mapping, transport contract, security rules, minimal-diff rule, validation steps, rollback procedure and definition of done.

## Installation shape

A consuming app should need only a thin adapter:

```js
import { createNotifications } from 'https://nirav2000.github.io/Apps/notifications/v1/index.js';

const notifications=createNotifications({
  app:'example-app',
  transport:myAuthenticatedTransport,
  eventTypes:['record.created','record.updated']
});

await notifications.emit('record.created',{
  scopeId:'workspace-123',
  recipients:['user-2'],
  title:'New record',
  body:'A record was created.'
});
```

The app should not copy provider, policy or preference logic into its own codebase.

## Third-party providers

Firebase Cloud Messaging (FCM) is the approved/default browser-push provider.

External providers require explicit user approval before activation. OneSignal is not active and has been removed from the default runtime. Resend email and FCM browser push are approved providers. SMS/messaging adapters may exist in shared code but remain approval-gated until the user explicitly approves the provider.

See `THIRD_PARTY_SERVICES.md` and `notifications/v1/INSTALLATION.md`.

## Delivery methods

The shared catalogue currently includes:
- in-app
- browser push
- email
- Telegram
- WhatsApp
- Signal bridge
- Slack
- Discord
- SMS
- native mobile push

ChatGPT polling/checking is intentionally excluded.

## Production transports

The client is transport-agnostic. A consuming app may use:
- its own authenticated backend adapter;
- a future shared Notifications service;
- another approved transport implementation.

The included `memory-transport.js` exists for the Lab/testing only.

Provider credentials must remain server-side.

## Consumer UI safety rule

**Recipient-facing notification UI must never expose provider setup, credentials, Firebase/Google console links, Worker configuration, secrets, or other developer controls.** New installations default to the consumer experience: explain the benefit, offer an app-level **Enable notifications** action, request the OS/browser permission only after the user taps it, register the device with the trusted backend, and offer normal event/delivery preferences. On iPhone/iPad, explain the Home Screen requirement when applicable.

Provider setup is an administrator/developer surface only. `mountRecipientPreferences()` therefore hides provider setup actions by default. A deliberately developer-only tool may opt in with `developerSetup: true`; production consumer apps must not set it.

A notification installation is **not complete** merely because the shared UI, FCM configuration or sender backend exists. Before marking browser push installed/ready, verify the full chain: consumer opt-in → OS permission → FCM/device registration → authenticated server storage of the recipient device → server event routing → FCM delivery → notification received while the app is backgrounded/closed → deep link opens correctly.


## Shared consumer browser-push registry (v1.3)

For consumer-facing apps that send public/non-sensitive alerts, use `registerConsumerWebPush()`. It performs the OS/FCM registration and then registers the returned Firebase Installation ID with the trusted shared Worker. The consumer never sees Firebase/provider setup and does not need a Google account.

The shared Worker exposes public device register/unregister endpoints only for an explicit allow-list of consumer apps. Those endpoints **cannot send notifications**. Sending remains protected by `X-Apps-Notification-Key` through `POST /notifications/consumer/deliver`. Registrations are stored in R2 by app and hashed FID key; the FID is retained only as the FCM delivery destination.

Use this public registry only for non-sensitive subscription alerts. Apps with private/user-specific notification content must use an authenticated recipient registration transport instead.

