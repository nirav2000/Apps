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
