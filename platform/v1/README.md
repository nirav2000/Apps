# Apps Platform v1

Stable, versioned integration contract for shared Apps capabilities.

## Preferred bootstrap

An app keeps a small manifest, for example `apps-manifest.json`:

```json
{
  "appId": "learnlatin",
  "platformVersion": "1",
  "capabilities": {
    "auth": {
      "mode": "shadow",
      "migration": {"phase": "shadow", "authority": "legacy"}
    },
    "monitor": true
  },
  "ui": {"mode": "headless"},
  "versionLab": {
    "enabled": true,
    "managed": true,
    "developerOnly": true
  }
}
```

Then it loads:

```html
<script
  src="https://nirav2000.github.io/Apps/platform/v1/loader.js"
  data-app-manifest="./apps-manifest.json">
</script>
```

The loader retrieves the manifest, loads only requested capabilities and emits `apps-platform:ready`.

## UI modes

- **headless** — shared service/API only; no shared UI is inserted.
- **explicit** — the app provides slots such as `<div data-apps-component="account"></div>`.
- **auto** — a capability may create its documented shared UI mount if no explicit slot exists.

Capabilities must not invent app-specific layouts.

## Version Lab exception

Version Lab registration may appear in the manifest, but Version Lab UI is never mounted in a release app. `developerOnly: true` is mandatory. The central Version Lab owns its UI and release process.

## Compatibility

`index.js` is the v1 capability core. `loader.js` is the preferred manifest-aware entry point. Existing root-level modules remain supported while migration is deliberate.


## Authentication capability

`auth` is now the canonical shared authentication capability. It loads `auth/v1/index.js` and automatically receives the manifest `appId`.

The older `identity` and `account` capabilities remain available as compatibility adapters while existing apps migrate. New app business code should depend on `services.auth`, not directly on `AppsAuth`, `AppsAccount` or Firebase Auth.

Example:

```js
const platform = await AppsPlatformLoaderV1.boot({
  manifest: {
    appId: "comprehension",
    capabilities: {
      auth: {
        mode: "shadow",
        migration: {phase: "shadow", authority: "legacy"}
      }
    }
  }
});

const Auth = platform.services.auth;
```

## Learning Sync v1.0 (App Platform v1.7.0)

`learningSync` is an **opt-in** capability. It does not automatically install into existing apps or start Firebase writes.

```json
{"appId":"dol","platformVersion":"1.7.0","capabilities":{"learningSync":true}}
```

```js
const platform = await AppsPlatformLoaderV1.boot({manifestUrl:'./apps-manifest.json'});
const sync = platform.services.learningSync.create({
  appId:'dol', learnerId:'learner-1', accountId:'guest',
  onSnapshot(snapshot,accountId){ /* reload the selected learner store */ }
});
sync.capture(learningStore.getState()); // capture completed-round learning evidence
// After Firebase login, create a transport using the SAME Firebase project for Auth and Firestore.
// A transport must verify the actual signed-in UID; accountId is never proof of identity.
// Explicit user consent is required before importing a device's guest history.
```

For production use, configure secure Firestore rules from `learning-sync/v1/firestore.rules`, install the authenticated transport, test account switching and offline replay, and enable the capability only in the target app. Apps Auth (`identity`) is legacy and remains available solely for backwards compatibility; new apps use `auth`.
