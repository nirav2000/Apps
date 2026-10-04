# Notification provider setup

Shared Notifications v1 works in two layers:

1. **In-app notifications** use the existing app/Worker storage and need no external notification provider.
2. **External delivery** uses the provider adapters in `notifications/v1/providers.js`.

No provider secret belongs in browser JavaScript, a GitHub Pages file, or a committed Wrangler config.

## Shared Worker-to-Worker key

Set the same random secret in:

- Apps Worker: `NOTIFICATION_INGEST_KEY`
- Snag Worker: `APPS_NOTIFICATION_INGEST_KEY`

This authorises trusted application Workers to call the shared delivery endpoint. A missing key leaves external delivery unavailable while in-app notifications continue to work.

## Provider secrets

The Apps Worker recognises these optional secrets/settings:

### Email
- `RESEND_API_KEY`
- `NOTIFICATION_FROM_EMAIL`

### Telegram
- `TELEGRAM_BOT_TOKEN`
- optional default `TELEGRAM_CHAT_ID`

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

### Browser / iOS push
- `ONESIGNAL_APP_ID`
- `ONESIGNAL_API_KEY`

The push provider is only the delivery side. Each user/device must also register a push subscription/external ID before a push channel can actually be used.

## Cost rule

Provider configuration does not grant users permission to use a channel. The application owner policy still controls whether that channel is available globally, by role, or for an individual. Metered channels remain off unless the owner enables them.

## Snag

Snag's non-secret shared delivery endpoint is configured in `wrangler.jsonc` as `APPS_NOTIFICATION_ENDPOINT`.

The homeowner/project owner controls the policy ceiling. Builders and contractors can change only their own preferences within that ceiling. The homeowner can also configure a recipient's preferences and destination on their behalf.

## Deployment check

After secrets are configured:

1. deploy the Apps Worker;
2. confirm App Monitor reports the provider as configured;
3. deploy the Snag Worker with the matching bridge secret;
4. send a test event to an owner-approved recipient;
5. verify the in-app record and external delivery result are both recorded.

Do not treat a configured provider as proof that a recipient is reachable. Destination/subscription registration is a separate requirement.


## Browser/PWA push registration

Browser/PWA registration is implemented in `notifications/v1/push.js` using OneSignal Web SDK v16.

Current consumers:
- App Monitor uses external ID `apps-admin` and the scoped worker at `/Apps/onesignal/OneSignalSDKWorker.js`.
- Snag uses external ID `snag:<firebase uid>` and the scoped worker at `/snag/onesignal/OneSignalSDKWorker.js`.

Registration happens only after the user presses the enable-push control and grants permission. On iPhone/iPad, the UI explains that the web app must be added to the Home Screen before web push can be enabled.

This means the remaining push setup is environmental/user consent, not missing application code:
1. create/configure the OneSignal app;
2. set `ONESIGNAL_APP_ID` and `ONESIGNAL_API_KEY` on the Apps Worker;
3. deploy the Apps Worker;
4. on each device, press the enable-push button once and grant permission.

Native App Store iOS/iPadOS push is intentionally kept separate from browser/PWA push.
