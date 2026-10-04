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
