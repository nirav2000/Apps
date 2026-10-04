# Notifications provider setup

Notifications v1 is app-independent. Provider configuration belongs behind a trusted server-side transport, never in a browser bundle.

## Shared provider adapters

`notifications/v1/providers.js` contains adapters for:
- email;
- Telegram;
- WhatsApp;
- Signal bridge;
- Slack;
- Discord;
- SMS;
- browser/native push.

Provider credentials are optional. A delivery method should be reported as unavailable until its provider is configured.

## Expected server-side secrets

Depending on the providers selected:

### Email
- `RESEND_API_KEY`
- `NOTIFICATION_FROM_EMAIL`

### Telegram
- `TELEGRAM_BOT_TOKEN`
- optional `TELEGRAM_CHAT_ID`

### SMS / WhatsApp
- `TWILIO_ACCOUNT_SID`
- `TWILIO_AUTH_TOKEN`
- `TWILIO_SMS_FROM`
- `TWILIO_WHATSAPP_FROM`

### Slack
- `SLACK_WEBHOOK_URL`

### Discord
- `DISCORD_WEBHOOK_URL`

### Signal bridge
- `SIGNAL_WEBHOOK_URL`

### Browser / native push
- `ONESIGNAL_APP_ID`
- `ONESIGNAL_API_KEY`

The browser-push client lives in `notifications/v1/push.js` and the scoped worker lives in `notifications/v1/onesignal/`.

## Security rules

- Never place provider secrets in GitHub Pages JavaScript.
- Never accept arbitrary user-supplied Slack/Discord/Signal webhook URLs for shared provider credentials.
- A consuming app must authenticate its own users.
- A server-side transport must enforce policy before sending a paid or restricted delivery method.
- User/device permission is still required for browser push even when policy permits push.

## Cost governance

The generic policy contains:
- `policyOwnerId` — who controls notification permissions;
- `costBearerId` — who should be attributed as bearing delivery cost.

These identities may be the same or different depending on the consuming app.

## Test before adoption

Use the Notifications Lab before integrating a production app. External sends in the Lab are simulated so policy and routing can be tested without incurring provider charges.


## App Monitor provider setup

App Monitor is the first production consumer of Notifications v1.1.

### Credential ownership

- Shared source: `nirav2000/Apps`
- Cloudflare deployment / provider credential host: `nirav2000/snag`
- Live Worker: `apps-monitor-api`
- Worker storage: R2 binding `APP_MONITOR_DATA`

Provider secret values are never committed to either repository.

### How to enable a delivery method

1. Open the provider's account/setup page from the **Setup** button in App Monitor.
2. Create/configure the provider resource (for example a Resend API key or OneSignal app).
3. Open **Snag → Settings → Secrets and variables → Actions**.
4. Add the exact secret names shown by the App Monitor setup panel.
5. The delegated `deploy-shared-app-monitor.yml` workflow synchronises any configured provider secrets into the `apps-monitor-api` Cloudflare Worker.
6. The workflow runs hourly and can also be run manually.
7. Refresh App Monitor. The delivery method changes from **Setup required** to **Ready** only when the Worker reports the provider configured.
8. Add any recipient-specific delivery detail required (for example email address, phone number, Telegram chat ID, or device push permission).
9. Run a notification test before relying on the channel.

### Provider secret names

#### Browser/native push — OneSignal
- `ONESIGNAL_APP_ID`
- `ONESIGNAL_API_KEY`

The recipient must also grant push permission on each browser/device.

#### Email — Resend
- `RESEND_API_KEY`
- `NOTIFICATION_FROM_EMAIL`

The sender/domain must be valid in Resend.

#### Telegram
- `TELEGRAM_BOT_TOKEN`
- optional default `TELEGRAM_CHAT_ID`

Individual recipients can instead store their own Telegram chat ID.

#### SMS — Twilio
- `TWILIO_ACCOUNT_SID`
- `TWILIO_AUTH_TOKEN`
- `TWILIO_SMS_FROM`

#### WhatsApp — Twilio
- `TWILIO_ACCOUNT_SID`
- `TWILIO_AUTH_TOKEN`
- `TWILIO_WHATSAPP_FROM`

#### Slack
- `SLACK_WEBHOOK_URL`

#### Discord
- `DISCORD_WEBHOOK_URL`

#### Signal bridge
- `SIGNAL_WEBHOOK_URL`

### Current status

If App Monitor says **Setup required**, the Worker is deliberately reporting that the provider credentials are absent or incomplete. A selectable preference must never be interpreted as proof that a provider is operational.

The App Monitor R2/in-app notification path does not require any external provider and should report **Ready** once the production Worker is deployed.
