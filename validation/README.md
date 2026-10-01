# Shared Static App Validator

Reusable preflight validation for the Apps portfolio.

## What it checks

1. Recursively discovers JavaScript, JSON and Python files; no hand-maintained file list is required.
2. Parses every JavaScript file with `node --check`, every JSON file with `JSON.parse`, and compiles Python with `py_compile`.
3. Checks relative `src` and `href` references from HTML files exist.
4. Checks `version.json` SemVer and, by default, matching `vX.Y.Z` / `?v=X.Y.Z` in `index.html`.
5. Supports lightweight dataset shape rules in each app's `validation.config.json`.
6. Uses Playwright Chromium to open configured critical pages, fail on page-level JavaScript exceptions or failed local requests, and assert key UI/data selectors exist.
7. Runs an optional app-specific **release gate** in an isolated browser. The shared runner supplies assertions, request/load metrics and a `waitForQuiescence()` primitive; the consuming app supplies only its own invariants and fixtures.
8. Enforces optional budgets for local requests/payload, attempted external requests and instrumented Firebase reads/writes/deletes/listeners.
9. Writes `artifacts/release-gate-report.json` and uploads it from CI for trend/debug review.
10. Provides a bounded shared load-test harness that refuses non-local/non-staging targets unless production load testing is explicitly opted into.

## Recommended release flow

`edit -> validation/preflight branch -> recursive validation -> browser smoke test -> fast-forward the exact passed commit to main -> CI validates again -> deploy`

The preflight branch is intentional: a failing candidate never becomes `main`. The exact tested commit SHA is promoted, rather than rebuilding or recreating the release after testing.

## App configuration

Example:

```json
{
  "ignore": ["vendor", "archive"],
  "jsonSchemas": [
    {"file":"data/schools.json","path":["schools"],"type":"array","minItems":1}
  ],
  "pages": [
    {"path":"/","readySelector":".card","minCount":1},
    {"path":"/performance.html","readySelector":".school-row","minCount":1}
  ]
}
```

Apps call the reusable GitHub workflow at `nirav2000/Apps/.github/workflows/static-app-validation.yml@main`.


## Release-gate configuration

The release gate is generic. App-specific business rules live in the consuming repository.

Example:

```json
{
  "releaseGate": {
    "enabled": true,
    "scenarioModule": "validation/my-app-release-gate.mjs",
    "path": "/",
    "readySelector": "#app",
    "allowExternalNetwork": false,
    "quietMs": 500,
    "timeoutMs": 5000,
    "maxStateTransitions": 2,
    "maxExternalRequests": 10,
    "maxLocalRequests": 80,
    "maxLocalBytes": 5000000,
    "maxFirebaseReads": 0,
    "maxFirebaseWrites": 0,
    "maxFirebaseDeletes": 0,
    "maxFirebaseListeners": 0
  }
}
```

The scenario exports `async function run(ctx)`. Useful shared helpers include:

- `ctx.assert` / `assert.equal` / `assert.deepEqual`
- `ctx.waitForQuiescence(probe, options)`
- `ctx.metrics.scenario` for app-specific counters
- Playwright `page` and `context`

A quiescence test must verify not only that the final data is correct, but that the system **stops changing/writing** after convergence. For replicated state, a typical invariant is:

```text
one deliberate change
  -> at most one required cloud write
  -> cloud/local converge
  -> repeated identical snapshots produce zero further changes/writes
```

Release tests must not use live user data. External network is blocked by default and Firebase operation budgets can be set to zero. If an app needs a staging backend, explicitly configure that staging endpoint rather than pointing fixtures at production.

## Cross-app paths in local smoke tests

An app can legitimately reference another GitHub Pages app with a same-origin absolute path, such as `/Kk-syllabus/...`. The local smoke server does not contain sibling repositories. Declare only those known prefixes:

```json
{
  "ignoreLocalRequestFailures": ["/Kk-syllabus/"]
}
```

Other local 404s still fail validation.

## Load testing

`validation/load-test.mjs` and `.github/workflows/safe-load-test.yml` provide a bounded HTTP load test with request count, concurrency, error-rate and p95 thresholds.

Production protection is deliberate: the harness rejects non-local/non-staging targets unless `ALLOW_PRODUCTION_LOAD_TEST=true` / `allow_production: true` is explicitly supplied.

Prefer:

```text
preview/staging -> load test -> inspect backend usage/cost -> production
```

Do not use production Firestore user data as a load-test fixture.
