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
