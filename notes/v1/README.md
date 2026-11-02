# Shared Notes & Annotations v1.2.2

Canonical shared notes, feedback and annotation capability for the Apps portfolio.

Derived from the strongest parts of the existing bespoke implementations:
- Beyond100: anchors, element annotation, pins, review queue and status lifecycle.
- Snag: review-feed and implementation-status return pattern.
- LearnLatin: draft preservation, note types and visible implemented-version history.
- Next: thin app integration.
- Openday: small generic API.

## Shared ownership

The library owns one note schema; developer/feedback/annotation types; local-first persistence; drafts; element annotations; stable anchors; pins; history; filters; edit/archive/reopen; review packs; optional review-feed transport; and implementation-status sync.

It deliberately does not know about Firebase, GitHub or app-specific business entities. A consuming app can supply a thin authenticated transport.

## Preferred install

```js
const Notes = await AppsPlatformV1.loadCapability('notes');
await Notes.init({ appId: 'touchtype', appVersion: '0.1.0' });
```

Direct import is also supported from `/Apps/notes/v1/index.js`.

Important app regions can opt into stable anchors:

```html
<section data-note-anchor="practice:prompt" data-note-label="Typing prompt">...</section>
```

## Transport contract

Default persistence is localStorage. A production app may supply `list`, `save`, `remove`, draft methods, plus optional `publishReviewFeed(pack,{force})` and `pullStatuses({appId,notes})`.

Cloud writes must be authenticated/authorised by the consuming app. Never place provider credentials in this shared browser package.

## Lifecycle

Preferred lifecycle: `open -> review -> implemented -> visible release history`.

Archiving is separate from implementation. Implemented notes retain implementation version/message/commit metadata.

## Complete cloud integration

See [FULL_WORKFLOW.md](./FULL_WORKFLOW.md) for the authenticated central Firestore transport, Development Control Centre integration, GitHub issue publishing, dependency rules and mandatory live validation. Cloud access is administrator-only until an app-scoped user-auth backend is implemented. Cloud write errors are surfaced; there is no silent local fallback.

## First consumer

App Monitor is the first integrated cloud consumer (live deployment and cross-device verification pending). TouchType remains a candidate for subsequent deliberate installation. Existing bespoke implementations should be migrated deliberately after that integration is proven.
## ChatGPT-assisted text edit handoff (v1.2.2)

A consuming app can opt into `ui:{chatGPTHandoff:true,pageScope:true,defaultReviewRequired:false}`. The shared editor then offers user-approved clipboard export and explicit JSON import. The import validates the `apps-shared-notes-edits-v1` schema, the exact app/lesson, an existing open note ID, unique IDs and text length. It updates only note text and preserves review flags, issue links and implementation history. Invalid payloads are rejected rather than used as commands. Edits already applied before a later transport error are not rolled back: the UI reports the failure, and retrying with the same text is idempotent.

This is not an autonomous ChatGPT connection. The user must copy content into ChatGPT, review its proposed text changes and paste the result back. Do not enable it for private learner records without appropriate disclosure and consent. Local storage is not real role-based access control or cross-device sync.
