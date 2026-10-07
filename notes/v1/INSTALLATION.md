# Shared Notes & Annotations v1 — Installation

Before editing a consuming app, inspect its app ID/version, existing feedback feature, useful stable annotation regions, persistence needs and whether a developer/ChatGPT review feed is required.

## Thin installation

```js
const Notes = await AppsPlatformV1.loadCapability('notes');
await Notes.init({appId:'touchtype',appVersion:APP_VERSION});
```

Add `data-note-anchor` and `data-note-label` only to important stable regions. Do not copy the shared schema, UI, pins or review logic into the app.

Device-local storage is the default and requires no backend. Cloud/shared storage requires a thin authenticated transport supplied by the app.

If a generic requirement is missing, prove and add it in the shared Lab/library first rather than patching the consumer.

## Validate

Create a general note; annotate an element; reload and verify persistence; verify draft recovery; edit; archive/reopen; copy a review pack; and confirm the app still works with Notes disabled. If a transport is configured, also test review-feed publishing and implemented-status return.

Do not delete or migrate an app's existing notes automatically. Plan migration separately.