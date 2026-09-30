# Installing the full shared Version Lab

Installation is intentionally separate from normal app business code.

## One-time files in the consuming repository

1. Copy `version-lab/templates/.version-lab.json` to the repository root and fill in app facts.
2. Copy `version-lab/templates/version-lab.yml` to `.github/workflows/version-lab.yml`.
3. Register the app in `Apps/version-lab/apps.json` with `managed: true` and its release manifest URL:
   `<liveUrl>/version-lab-data/releases.json`.
4. Copy `version-lab/templates/versionlabs/index.html` to `versionlabs/index.html`, replacing `__APP_ID__` with the registered app ID.
5. Do **not** add a Version Lab button or Version Lab JavaScript to the application's normal production UI.

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

The developer can either open the central Version Lab directly or manually visit `<app>/versionlabs/`. The latter uses the shared App Monitor administrator passkey/session and redirects into the central Version Lab scoped to that app.

## Snapshot safety modes

### visual-only — default

Historical frontend is archived but live network connections are blocked in its entry HTML. This prevents old JavaScript from writing to today's Firebase/Worker APIs. It is suitable for layout, content and client interaction that does not require network data.

### interactive-safe

The archived app may make normal network requests. Use only when the app is genuinely safe to replay against its configured services.

### read-only-adapter

Preferred for data-backed apps. At checkpoint capture, Version Lab freezes and injects the shared read-only network adapter before historical app scripts. The adapter permits configured read origins/query transports while blocking known writes, unrecognised mutation requests, forms, beacons and WebSockets.

This protects current production data from historical code, but does not itself create a historical database copy. See `READ_ONLY_ADAPTER.md`.

### source-only

No runnable snapshot is exposed; Git source remains available.

## Developer-only access

The shared UI is centrally hosted at `/Apps/version-lab/` and validates the same administrator session used by App Monitor. A consuming app may expose the deliberately unlinked manual route `/versionlabs/`; this is only a developer passkey gateway/redirect and contains no Version Lab implementation or historical data. No Version Lab control appears in normal application navigation.

## AI coding agents

Add a reference to `AI_AGENT_CONTRACT.md` in the app's agent/development instructions. An AI coder should request a checkpoint by triggering the app's Version Lab workflow after a meaningful feature is complete; it must not manufacture local snapshots/version pages.


## AI-assisted installation

For a new app chat/coding agent, point it at:

`https://nirav2000.github.io/Apps/version-lab/INSTALL_FOR_AI.md`

That document is the installation contract. The coding agent should follow it rather than designing its own versioning system.
