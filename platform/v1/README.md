# Apps Platform v1

Stable, versioned integration contract for shared Apps capabilities.

## Preferred bootstrap

An app keeps a small manifest, for example `apps-manifest.json`:

```json
{
  "appId": "learnlatin",
  "platformVersion": "1",
  "capabilities": {
    "identity": true,
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
