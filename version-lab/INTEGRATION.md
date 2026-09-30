# Installing the full shared Version Lab

Installation is intentionally separate from normal app business code.

## One-time files in the consuming repository

1. Copy `version-lab/templates/.version-lab.json` to the repository root and fill in app facts.
2. Copy `version-lab/templates/version-lab.yml` to `.github/workflows/version-lab.yml`.
3. Register the app in `Apps/version-lab/apps.json` with `managed: true` and its release manifest URL:
   `<liveUrl>/version-lab-data/releases.json`.
4. Do **not** add a Version Lab button or Version Lab JavaScript to the application's production UI.

These files are platform integration/configuration, not application Version Lab implementation.

## First trial

Use an app that has never had a Version Lab. Run the **Version Lab checkpoint** workflow with a title, summary and change areas.

The reusable workflow will:

- check out the app;
- invoke the shared capture engine from Apps/main;
- record the exact commit;
- generate an immutable static snapshot from tracked files;
- inject a restrictive CSP for non-interactive snapshots;
- record source and configured data/schema metadata;
- update `version-lab-data/releases.json`;
- validate the generated checkpoint;
- commit the generated Version Lab artifacts back to the app.

The developer then opens the central Version Lab to inspect the checkpoint.

## Snapshot safety modes

### visual-only — default

Historical frontend is archived but live network connections are blocked in its entry HTML. This prevents old JavaScript from writing to today's Firebase/Worker APIs. It is suitable for layout, content and client interaction that does not require network data.

### interactive-safe

The archived app may make normal network requests. Use only when the app is genuinely safe to replay against its configured services.

### read-only-adapter

Reserved for apps with a Version Lab adapter that redirects historical data access to a safe read-only compatibility source. The first release engine records the mode; adapter plumbing is the next compatibility layer.

### source-only

No runnable snapshot is exposed; Git source remains available.

## Developer-only access

The shared UI is centrally hosted at `/Apps/version-lab/` and validates the same administrator session used by App Monitor. Production apps expose no Version Lab route or button.

## AI coding agents

Add a reference to `AI_AGENT_CONTRACT.md` in the app's agent/development instructions. An AI coder should request a checkpoint by triggering the app's Version Lab workflow after a meaningful feature is complete; it must not manufacture local snapshots/version pages.
