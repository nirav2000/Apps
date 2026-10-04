# Apps Notifications v1

Shared notification platform for the Apps portfolio.

## Audiences

### Platform / admin
Examples: a new human user, unknown device, admin login, new automation source, or operational/security change.

### App users
Examples: a snag is created, updated, commented on or resolved; a task is due; an assignment changes.

## Permission model

Each app or project has a primary owner/controller. In Snag this is normally the homeowner.

The owner defines the **policy ceiling**:
- which event types are available;
- which delivery channels are available;
- which roles or specific users may use those channels;
- whether a notification is optional or mandatory;
- whether a metered/paid channel may be used.

Each recipient then defines their own preferences inside that ceiling.

Effective notification settings are therefore:

`effective preference = owner policy AND recipient preference`

A builder or contractor cannot self-enable a channel or event the homeowner has not allowed. This is especially important for metered channels such as SMS or other paid providers.

The owner may also configure notification settings on behalf of a recipient, for example enabling email for a contractor.

## Channels

The shared channel catalogue includes:
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

## Architecture

Apps emit semantic events. They do not contain provider credentials and they do not implement vendor-specific delivery logic.

```
App event
  -> shared notification service
  -> owner policy
  -> recipient preferences
  -> delivery routing
  -> in-app ledger + external channels
```

Example event names:
- `security.new_human`
- `security.new_device`
- `snag.created`
- `snag.updated`
- `snag.comment_added`
- `snag.status_changed`

## Interfaces

App Monitor provides the administrator view:
- notification history
- unread alerts
- routing rules
- channel health
- delivery results
- investigation links

Applications provide reusable user-facing UI:
- notification bell and unread badge
- notification centre
- personal preferences
- owner policy controls where the signed-in user is the app/project owner

Unavailable settings should remain visible but disabled with a clear explanation such as “Not enabled by the homeowner”.

## Cost governance

Channel definitions can declare whether they are free, externally billed, or metered. The owner policy controls paid-channel use globally, by role, or by individual. The delivery ledger records the policy used and the recipient/channel selected so costs can later be attributed and audited.

## Rollout order

1. Shared event, policy and preference model.
2. App Monitor in-app notification centre.
3. App Monitor `security.new_human` detection.
4. Browser/web push.
5. External delivery adapters.
6. Snag as the first app-user consumer.
7. Shared validation/release-gate coverage.
