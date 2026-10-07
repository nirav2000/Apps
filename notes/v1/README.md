# Shared Notes & Annotations v1

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

## First consumer

TouchType is intended to be the first clean consumer. Existing bespoke implementations should be migrated deliberately after that integration is proven.