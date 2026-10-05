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


## Shared-library adoption controls

The Control Centre / Shared Libraries experience should support a checkbox-driven adoption planner rather than requiring the user to remember which shared capabilities each app already has.

For each app, show each shared capability with its current state:
- **Available** — capability exists; no app change is authorised.
- **Tested / compatible** — compatibility was verified without installing it.
- **Installed** — app repository actually consumes it.
- **Local / legacy** — equivalent app-local functionality exists.

A separate **User activation available** indicator records whether an installed capability can actually be enabled/controlled by the end user.

### Checkbox installation workflow

1. The user selects one or more apps and shared capabilities.
2. The UI shows the exact proposed transitions, dependencies and conflicts before any repository is changed.
3. Dependency requirements are informational by default. A dependency is never silently selected/installed.
4. The user explicitly confirms the installation batch.
5. Development installs only the checked/confirmed app-capability pairs.
6. Each installation runs the capability's canonical installation guide, app release gate and an App Audit.
7. The register is updated to Installed only after successful validation.
8. Failed integrations remain at their prior state and are reported individually rather than causing unrelated apps to be modified.

The checkbox is an authorisation control, not merely a status display.

## App Audit

Use an App Audit after substantial, cross-cutting or unexpected changes, and periodically for actively developed apps.

An audit should cover:

1. **Baseline and version**
   - identify current app version/commit and last known-good baseline;
   - identify all changes since the baseline and whether they were authorised.

2. **Core functional journeys**
   - exercise the app's real primary workflows, create/read/update/delete paths where applicable, persistence, authentication, sharing/roles and error/empty states;
   - verify failure of an optional/shared service cannot break the primary app action unless deliberately designed that way.

3. **Shared-library conformance**
   - compare every installed shared capability with the central register and canonical installation guide;
   - verify app identity, scope, auth/roles, service-worker ownership, transport/backend mappings and user activation surfaces;
   - detect duplicated, stale or app-specific forks of shared logic.

4. **Rendered visual QA**
   - inspect the actual rendered app rather than relying only on source/static checks;
   - test representative iPhone, iPad/tablet and desktop widths;
   - check clipping, overlap, modals/drawers, safe areas, keyboard/focus, touch targets, typography, loading/empty/error states and installed-PWA presentation;
   - capture screenshots for material UI regressions.

5. **PWA and offline/update behaviour**
   - manifest, icons, standalone launch, service-worker scope/conflicts, first load/repeat load, update propagation, offline/reconnection and stale-cache behaviour.

6. **Notifications when installed**
   - in-app inbox/preferences, owner/policy boundaries, event routing, user-facing Enable notifications/push action, OS permission request, device registration, delivery and deep-link behaviour;
   - PWA/browser-push dependency is verified but never silently installed.

7. **Data, media and performance**
   - measure important network requests and rendering latency;
   - check image/media dimensions, formats, thumbnails/previews, cache headers, repeat-view caching and backend/storage latency;
   - flag avoidable full-resolution downloads and serial request waterfalls.

8. **Security/privacy/cost**
   - auth and role boundaries, private-media access, secrets, third-party providers, telemetry/privacy controls and metered-provider policy;
   - confirm third-party approval status against the central register.

9. **Automated validation**
   - syntax/static checks, app-specific release gate, shared-capability gates and browser smoke tests;
   - distinguish pre-existing failures from regressions introduced by the audited change.

10. **Report**
    - PASS / PASS WITH FINDINGS / FAIL;
    - version/commit audited;
    - findings ranked critical/high/medium/low;
    - exact user verification still needed;
    - recommended fixes, each requiring normal authorisation;
    - update the register only for facts verified by the audit.

A useful request is: **“Run an App Audit on <app> since <version/change>.”** For a major unexpected change, use: **“Run a full App Audit on <app> against the last known-good version.”**
