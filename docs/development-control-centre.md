# Development Control Centre

The Development Control Centre is the friendly front end for development work across the Apps ecosystem. GitHub Issues are the durable task store, but routine use should happen through this dashboard and ChatGPT rather than requiring GitHub navigation.

## Capture convention

From any ChatGPT conversation, `#dev` means: capture this as development work and infer the structure from the surrounding conversation.

ChatGPT should infer where possible:
- app and repository
- type: bug, feature, verify, explore, infrastructure, decision/follow-up
- status
- priority and target date
- relevant URLs
- shared component/library
- branch/version/commit
- rationale and surrounding context
- acceptance/verification notes
- dependencies/related work
- source conversation context and source URL when the platform exposes one

Before creating a new item, check for materially equivalent existing work and enrich it instead of creating duplicates.

## Required card context

Every card must be understandable after the original conversation has been forgotten.

A card should answer, at a glance:

1. **What is this?** A plain-English description of the work or problem.
2. **Why do I care?** Why the item matters and whether it blocks anything.
3. **What happens next?** The specific next action, not vague wording such as "retry later".
4. **Who needs to act?** User, ChatGPT/development, or an external party.

Cards should also show when available:
- App/repository
- Status
- Due date
- Relevant Open/Test URL
- Source/context
- One-tap **Open source chat** link when a stable source conversation URL is available
- What completion unblocks

If a source-chat URL is unavailable, retain a human-readable source description (topic/chat/date) rather than inventing a link.

## Needs me

`Needs me` is a first-class view for items where progress depends on the user's action rather than ChatGPT/development work.

Typical triggers include:
- test something on iPhone, iPad or Mac
- visit or inspect a URL
- verify a deployment or UI change
- choose between options
- approve/reject a proposed change
- provide a secret, token, credential or missing configuration
- supply information or an asset
- compare a live result against expectations
- complete an external/manual step

Each Needs me card should state the required action as an imperative, for example:
- "Test passkey login on iPhone Safari"
- "Visit the staging URL and confirm the hero images"
- "Choose A or B for the VersionLab layout"

The view should show a prominent count, due/overdue ordering, app context, direct Open/Test links, why the action is required, and what it unblocks.

ChatGPT should infer Needs me automatically; the user should not need to tag it manually.

## Dashboard views

- Needs me
- Today / overdue
- Next
- In progress
- Verify
- Waiting
- Explore
- Recently completed

Filters should include app, shared component, type and priority, plus full-text search.

## Quick capture

The dashboard should provide a low-friction capture box for notes entered outside ChatGPT. The dashboard must not require the user to understand GitHub Issues syntax.

Until authenticated write-through capture is implemented, Quick Capture may create a ready-to-send `#dev` instruction that preserves the note and context rather than exposing GitHub complexity.

## Source of truth

GitHub Issues contain live work. Markdown contains architecture, conventions and durable decisions. Do not maintain a second independent to-do list in Markdown.


## Working with older chat history

The Control Centre, not ChatGPT memory, is the durable record of development work.

Backfill is progressive:
- When work resumes on an app, ChatGPT should first review the app's existing Control Centre items and relevant available prior conversation/project context.
- Clearly unresolved, still-relevant work may then be added or merged into existing tracker items.
- Do not bulk-create speculative or stale historical tasks merely because they were once discussed.
- New `#dev` instructions should be captured immediately.
- If prior-chat context is unavailable, do not pretend it was remembered; use the tracker/repository state and ask only when an essential decision cannot be recovered.

This means the user does not need to perform a manual historical backfill. The tracker becomes progressively more complete as each app is revisited.

## Low-friction card actions

Cards provide:
- **Done** — prepares a `#dev` command identifying the exact issue to close/complete.
- **Verified** — prepares a command recording successful verification.
- **Snooze** — asks for a natural-language date/time and prepares an update command.
- **Continue in ChatGPT** — prepares a command containing the exact tracked item reference so ChatGPT can pick the work up with the tracker as context.
- **Open source chat** — shown when a stable source conversation URL has been captured.

These actions intentionally avoid requiring the user to navigate GitHub. Until secure authenticated write-through is added, actions copy an exact command for ChatGPT rather than exposing a GitHub credential in the browser.
