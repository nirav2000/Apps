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
- `apps-pronunciation.js` — reusable microphone waveform, generated or teacher-recorded acoustic reference, speech comparison, rhythm/intonation analysis and pluggable pronunciation-scoring UI. `pronunciation-worker.js` securely generates default reference audio. Standalone test: `pronunciation-demo.html`.
- `version-lab/` — developer-only full shared Version Lab subsystem: central UI, release capture, immutable snapshots, source/history metadata, compatibility contracts and reusable GitHub workflow. Beyond100 is the reference implementation for its target richness.
- `apps-version-lab.js` — **legacy/thin v1 browser module** retained for existing Openday compatibility while the full shared Version Lab is validated. Do not use for new integrations.
- `platform/v1/` — versioned Apps Platform integration contract and lazy capability loader for new integrations.\n- `validation/` — recursive JS/JSON/Python and local-asset validation plus Playwright browser smoke tests, exposed through a reusable GitHub Actions workflow.
- `apps-platform.js` — legacy convenience loader retained while apps migrate deliberately.
- `app-monitor.js` and `firebase-usage-monitor.js` now support opt-in privacy gates, enabled per public-facing app.

App repositories should keep authorization rules, domain data and provider-specific backend logic local, while importing these common modules instead of cloning account/privacy/billing/pronunciation code.


## Developer-only Version Lab

The full Version Lab is intentionally separate from product applications. Normal release builds must not expose a Version Lab button or route. Developer access is through `version-lab/`, protected by the App Monitor administrator session. See `version-lab/README.md`, `version-lab/INTEGRATION.md` and `version-lab/AI_AGENT_CONTRACT.md`.


## Shared release validation

Reusable release-safety tooling lives in `validation/` and the reusable workflows under `.github/workflows/`.

It provides:

- recursive syntax/data/asset validation;
- Playwright smoke tests;
- app-specific regression scenarios using a shared runner;
- sync/state **quiescence** testing;
- request/payload and Firebase-operation budgets;
- machine-readable release-gate CI reports;
- bounded local/staging load testing with production protection.

Consuming apps should keep only their own `validation.config.json` and domain-specific scenario fixtures. OpenDay is the reference consumer.

See `validation/README.md` and `shared-libraries.html`.
