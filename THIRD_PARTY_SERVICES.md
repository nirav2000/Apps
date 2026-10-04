# Third-party services policy and register

This file is the canonical rule for external/third-party services used by Apps and consuming applications.

## Approval rule

Before adding, enabling, configuring, recommending, or creating an account for a new third-party service, ChatGPT / the developer must explicitly tell the user:

- provider name;
- why the service is needed;
- what data will leave the user's own infrastructure;
- whether a free tier exists;
- what can trigger charges;
- what credentials/accounts are required;
- whether an existing first-party/current-infrastructure alternative exists;
- material vendor-lock-in or migration implications.

**The user must explicitly approve the provider before it becomes active.**

A dormant optional adapter may exist, but it must:
- be clearly marked optional/unapproved;
- not load third-party runtime code by default;
- remain disabled even if credentials are accidentally present;
- require an explicit approval-state change before use.

Never store secret values in this register.

## Current notification-provider status

### Firebase Cloud Messaging (FCM)
- Status: **Approved**
- Approval date: 2026-10-04
- Purpose: default browser push for shared Notifications
- Reason: already within the user's Firebase ecosystem; FCM itself is a no-cost Firebase product
- Data leaving infrastructure: notification payload and Firebase Installation ID are sent through Firebase/Google push infrastructure
- Backend: Cloudflare Worker calls FCM HTTP v1
- Browser: Firebase Web Messaging SDK + shared service worker
- Charges: FCM itself is no-cost; other Firebase/Google services used alongside it may have separate quotas/pricing
- Lock-in: delivery target is Firebase-specific; shared Notifications remains provider-neutral so another provider can replace it later

### OneSignal
- Status: **Not approved / not active**
- Purpose previously considered: browser/native push
- Runtime status: removed from the default Notifications runtime
- Credentials: none configured
- Reintroduction: requires explicit approval after comparing cost, data flow, benefits and alternatives

### Resend
- Status: **Not approved / not active**
- Potential purpose: email delivery
- Credentials: none configured
- Activation requires explicit approval

### Twilio
- Status: **Not approved / not active**
- Potential purpose: SMS / WhatsApp delivery
- Credentials: none configured
- Activation requires explicit approval

### Telegram Bot API
- Status: **Not approved / not active**
- Potential purpose: Telegram notifications
- Credentials: none configured
- Activation requires explicit approval

### Slack
- Status: **Not approved / not active**
- Potential purpose: Slack notifications
- Credentials: none configured
- Activation requires explicit approval

### Discord
- Status: **Not approved / not active**
- Potential purpose: Discord notifications
- Credentials: none configured
- Activation requires explicit approval

### Signal bridge
- Status: **Not approved / not active**
- Potential purpose: Signal notifications through a trusted bridge
- Credentials: none configured
- Activation requires explicit approval

## Existing infrastructure providers

Existing services already used in the portfolio should still be recorded in the shared infrastructure register with source ownership, credential ownership and app usage. Extending an existing provider into a materially new data flow or paid use case should still be surfaced to the user before activation.
