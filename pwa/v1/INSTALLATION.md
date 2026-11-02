# PWA v1 — Adoption & Installation Guide

This is the canonical installation contract for shared PWA support.

## First principle

Do not independently build PWA installation prompts, standalone detection, update handling or service-worker policy inside consuming apps. Use the shared PWA package and keep the app adapter minimal.

## Before changing an app

Identify:
1. hosting origin and base path;
2. start URL;
3. application name and short name;
4. icon assets;
5. existing service workers;
6. whether Notifications/browser push already uses a service worker;
7. release/deployment gate.

A second service worker must never be registered over a scope already owned by an existing worker. Compose shared behavior into the existing worker instead.

## Prove behavior in the PWA Lab first

Use `/Apps/pwa/v1/lab.html` and verify:
- a linked manifest;
- service-worker support and registration;
- standalone detection;
- iOS install-required guidance;
- installed/standalone state;
- valid manifest/icon URLs.

## Minimal integration

Apps hosted under the central `/Apps/` origin can use the shared root worker. Apps in another GitHub Pages repository/origin need a tiny same-origin worker entry point that imports the shared worker logic.

The app should link its manifest and initialize:

```js
import { initPWA } from 'https://nirav2000.github.io/Apps/pwa/v1/index.js';
await initPWA();
```


## One-command onboarding and icon assets

The supported shared tooling is now:

- [Icon design lab](./icon-gallery.html) — six SVG concepts, designed for app identity. Select a concept without changing a running app.
- `icon-factory.mjs` — editable vector master artwork with maskable-safe variant.
- `onboard.mjs` — generates a consistent web manifest, SVG master/favicon, Apple PNG 180, PNG 192/512, and Android maskable PNG 512.
- [Portfolio readiness](./portfolio.html) — checks **publicly served** manifests and referenced icons; never confuses registry membership with device install status.

Each consuming repo keeps a small `pwa.config.json` describing its unique identity:

```json
{
  "name": "Example · Learning",
  "short_name": "Example",
  "id": "/Example/",
  "start_url": "./",
  "scope": "./",
  "background_color": "#f5f7fa",
  "theme_color": "#102a43",
  "concept": "insight-book",
  "icon_background": "#102a43",
  "icon_accent": "#1a6674",
  "assets_dir": "icons"
}
```

Install the raster renderer in the shared generator's directory:

```sh
npm install --no-save @resvg/resvg-js@2.6.2
node Apps/pwa/v1/onboard.mjs --app-root Example --config pwa.config.json --apply
node Apps/pwa/v1/onboard.mjs --app-root Example --config pwa.config.json --check
```

Run from a checkout where `Apps/` and `Example/` are sibling directories (or pass absolute paths). The generator must **never overwrite an existing non-shared service worker**. It refuses to edit and asks for a manual composition audit instead; this preserves existing push handlers. For shared workers, it retains the existing precache contents and adds missing icons, bumping the cache name when necessary.

For automated deployment, **do not copy and maintain the generator commands in every app.** Use the centrally maintained reusable workflow at `nirav2000/Apps/.github/workflows/reusable-pwa-assets.yml@main`. A consuming repo only needs this small workflow:

```yaml
name: Build PWA assets
on:
  push:
    branches: [main]
    paths: [pwa.config.json, index.html, icon.svg, sw.js, manifest.webmanifest]
  workflow_dispatch:
permissions:
  contents: write
jobs:
  build-pwa:
    uses: nirav2000/Apps/.github/workflows/reusable-pwa-assets.yml@main
    with:
      app-config: pwa.config.json
      verification: |
        node tests/pwa-assets.test.mjs
```

InClass is the first consumer of this reusable workflow. The shared action pins the raster package version, validates every generated icon and manifest, optionally runs the app's own tests, and commits **only** the app's PWA source/assets and metadata to the consuming repository's main branch without force-pushing. GitHub requires `contents: write` for the commit. Generated PNGs are committed to the consumer repo, so installation does not need an image generation service at runtime.

**App-specific design approval:** The generator defaults to the concept in `pwa.config.json`. Changing the concept is a deliberate version-controlled change. InClass initially uses `insight-book`; preview alternatives in the icon design lab before changing it.

## Verification tiers

1. **Build verification**: valid file signatures and 180/192/512 dimensions, correct manifest and iOS touch icon, shared bootstrap/worker, preserved data.
2. **Public HTTP verification**: live manifest and icons reachable at the deployed URL (PWA portfolio checks this).
3. **Device verification**: on an actual iPhone/iPad, add to Home Screen, launch standalone, test offline and check release updates. Browser-based diagnostics cannot claim to have performed this physical-device test.

A registry entry or passing static build is not itself proof of a successful Home Screen installation.

## Notifications dependency

On iPhone/iPad, browser push requires the web app to be installed to the Home Screen and launched in standalone mode. Notifications UI should use PWA readiness and must not imply push is enabled when this prerequisite is missing.

PWA and Notifications are companion capabilities, not a bundle. Installing this PWA library does **not** authorise installation of Notifications in the consuming app. Likewise, a Notifications request must not silently install PWA; if PWA is missing, report the dependency and wait for explicit authorisation.

## Release gate

An app recorded as PWA-installed must have:
- a valid manifest;
- `display: standalone`;
- a valid start URL and scope;
- 192px and 512px icons;
- a compatible service-worker registration;
- no conflicting service worker over the same scope.

## Rollback

PWA integration must not alter core app behavior when installation/offline functionality is unused. If a shared-worker change breaks the app, restore the consuming app and fix the generic behavior in the PWA Lab first.

## Instructions specifically for ChatGPT / AI

When asked to add PWA support:
1. read this guide and README first;
2. inspect the app's existing service workers before editing;
3. register the app in the shared PWA registry;
4. keep app-local code/config minimal;
5. use the Lab to prove generic behavior;
6. add release-gate checks;
7. record adoption in `shared-libraries.json`;
8. do not introduce a second overlapping service worker;
9. test browser mode and installed standalone mode;
10. if browser push is used, verify PWA readiness before notification permission/registration.

## Definition of done

PWA adoption is complete when the manifest and icons are valid, the shared worker strategy is conflict-free, the app installs to standalone mode, release checks pass, and the Shared Libraries register records the consumer.
