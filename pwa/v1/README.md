# Apps PWA v1

Shared Progressive Web App capability for the Apps portfolio.

## Shared responsibility

The shared package owns:
- installability/readiness diagnostics;
- service-worker registration conventions;
- install/update status UI;
- iOS/iPadOS standalone detection and Add to Home Screen guidance;
- shared caching/update worker logic;
- the app registry and PWA Lab;
- integration rules used by Notifications/browser push.

A consuming app supplies:
- app ID, name and short name;
- start URL and scope;
- theme/background colours;
- icons;
- a tiny app-local manifest or generated manifest;
- a same-origin service-worker entry point when the app is hosted on another origin.

## First consumer

App Monitor is the first production consumer. The PWA Lab is the first test consumer.

## Lab

Open `/Apps/pwa/v1/lab.html`.

## Installation

Read `INSTALLATION.md` before adding PWA support to another app.

## Shared onboarding (November 2026)

Create a small `pwa.config.json` in the consuming app, choose one of six original SVG concepts in [Icon design lab](./icon-gallery.html), then use the `onboard.mjs` shared generator. **Do not duplicate its logic.**

For CI and automatic deployment, call [reusable-pwa-assets.yml](../../.github/workflows/reusable-pwa-assets.yml) from the app's minimal workflow. InClass is the reference consumer. The shared workflow generates the Apple PNG, desktop/Android PNGs, maskable icon, favicon and manifest, validates the results, runs optional app-owned tests, and commits only the app's PWA files to main.

App Monitor and the [PWA portfolio readiness dashboard](./portfolio.html) audit actual published manifest and icon endpoints. This is deliberately distinct from testing Add to Home Screen, offline behaviour, push or updates on a physical iPhone/iPad. See [INSTALLATION.md](./INSTALLATION.md) for the full contract.
