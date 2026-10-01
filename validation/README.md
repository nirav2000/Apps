# Shared Static App Validator

Reusable preflight validation for the Apps portfolio.

## What it checks

1. Recursively discovers JavaScript, JSON and Python files; no hand-maintained file list is required.
2. Parses every JavaScript file with `node --check`, every JSON file with `JSON.parse`, and compiles Python with `py_compile`.
3. Checks relative `src` and `href` references from HTML files exist.
4. Checks `version.json` SemVer and, by default, matching `vX.Y.Z` / `?v=X.Y.Z` in `index.html`.
5. Supports lightweight dataset shape rules in each app's `validation.config.json`.
6. Uses Playwright Chromium to open configured critical pages, fail on page-level JavaScript exceptions or failed local requests, and assert key UI/data selectors exist.

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
