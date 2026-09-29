# Apps

A no-framework HTML/CSS/JS dashboard that aggregates GitHub Pages apps into one place.

## Features

- Curated app blurbs for `nirav2000` repositories with GitHub Pages enabled.
- Reusable dashboard brand system in `dashboard_brand/` with generated animated SVG previews.
- Static generated SVG artifacts committed under `dashboard_brand/previews/`.
- Live fallback screenshot-style previews (with GitHub OpenGraph fallback if images fail).
- Improved aligned controls with live filtering by app/repository name.
- Sorting by name or latest update.
- Direct links to each deployed app and source repository.
- Fallback mode for other usernames/orgs using live GitHub API discovery.

## Architecture and monitoring review

See [APP_REVIEW.md](APP_REVIEW.md) for the living register covering app persistence, Firebase projects/databases, authentication, Firebase usage instrumentation, App Monitor identity/device linkage, and the implementation backlog.

## Run locally

Open `index.html` in a browser.

## Regenerate branded previews

```bash
python dashboard_brand/generate_previews.py
```
# Automatic discovery

On every dashboard load, the curated catalogue is merged with all public repositories that GitHub reports as having Pages enabled. Existing titles, descriptions and previews are preserved; new apps use the repository name and description. No token or scheduled job is required. A last-successful local cache keeps discovered apps visible during API outages or rate limits. Private repositories and apps hosted elsewhere are not automatically discovered.


## Shared plug-and-play modules

The Apps repository is the single-source library for cross-app capabilities:

- `apps-auth.js` — canonical device identity and app/central identity bridge.
- `apps-account.js` — reusable Firebase account lifecycle: anonymous protection, email/password sign-in, verification, reset, sign-out and deletion hooks.
- `apps-privacy.js` — shared privacy preference storage/events for optional analytics and personalised monitoring.
- `apps-billing.js` — provider-neutral billing client; each app supplies its authenticated billing endpoint and entitlement adapter.
- `apps-pronunciation.js` — reusable microphone waveform, speech comparison, rhythm/intonation analysis and pluggable pronunciation-scoring UI.
- `apps-platform.js` — convenience loader for the shared platform modules.
- `app-monitor.js` and `firebase-usage-monitor.js` now support opt-in privacy gates, enabled per public-facing app.

App repositories should keep authorization rules, domain data and provider-specific backend logic local, while importing these common modules instead of cloning account/privacy/billing/pronunciation code.
