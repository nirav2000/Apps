# Apps Notifications v1

Shared notification platform for the Apps portfolio.

## Audiences
- Admin/platform notifications: new human user, unknown device, admin login, new automation source, operational/security events.
- App-user notifications: events such as `snag.created`, `snag.updated`, `comment.added`, task due, assignment changed.

## Channels
- in-app notification centre
- browser/web push
- email
- Telegram
- WhatsApp
- Signal bridge
- Slack
- Discord
- SMS
- native iOS/iPadOS push

ChatGPT monitoring is intentionally excluded.

## Design
Apps emit semantic events. Delivery routing and preferences are central. Provider credentials remain server-side.

Example event names:
- `security.new_human`
- `security.new_device`
- `snag.created`
- `snag.updated`
- `snag.comment_added`

Admin controls live in App Monitor. End-user apps can reuse a notification bell, centre, and preferences panel.
