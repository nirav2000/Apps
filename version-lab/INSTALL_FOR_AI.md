# Install the shared Apps Version Lab

This document is written for ChatGPT, Codex and other coding agents installing Version Lab into an application repository.

Canonical shared system:
`https://nirav2000.github.io/Apps/version-lab/`

## Goal

Install the shared developer-only Version Lab without implementing any Version Lab logic inside the application.

After installation:

- normal users see no Version Lab button or menu item;
- the developer may manually visit `/versionlabs/` on the app;
- that gateway authenticates with the shared App Monitor administrator passkey;
- successful authentication opens the central shared Version Lab scoped to this app;
- meaningful releases/checkpoints are generated only by the shared Version Lab workflow;
- historical snapshots and release manifests are generated, not hand-maintained.

## Required installation files

Create these files in the consuming repository.

### 1. `.version-lab.json`

Start from:

`https://nirav2000.github.io/Apps/version-lab/templates/.version-lab.json`

Fill in:

- `appId`
- `repository`
- `liveUrl`
- product version file if one exists
- snapshot safety mode
- data/provider metadata
- read-only origins if `read-only-adapter` is used

Prefer `read-only-adapter` for apps that require current backend reads to render historical screens but must not write to production.

### 2. `.github/workflows/version-lab.yml`

Copy the shared consuming-app workflow template:

`https://nirav2000.github.io/Apps/version-lab/templates/version-lab.yml`

Do not reimplement checkpoint generation locally.

### 3. `versionlabs/index.html`

Copy:

`https://nirav2000.github.io/Apps/version-lab/templates/versionlabs/index.html`

Replace `__APP_ID__` with this app's registered app ID.

This route is deliberately not linked from the normal application UI. It is a manually entered developer URL.

### 4. AI/development instructions

Add this sentence to the repository's `AGENTS.md`, development instructions or equivalent:

> This app uses the shared Apps Version Lab. Read and obey https://nirav2000.github.io/Apps/version-lab/AI_AGENT_CONTRACT.md. Do not implement or maintain local versioning, snapshots or Version Lab UI.

### 5. Register the app centrally

Update `nirav2000/Apps/version-lab/apps.json` with:

- app ID
- display name
- repository
- live URL
- `managed: true`
- `status: "managed"`
- release manifest URL: `<liveUrl>/version-lab-data/releases.json`
- gateway path: `<liveUrl>/versionlabs/`

If the coding agent cannot update the Apps repository, report that central registration is the only remaining installation step. Do not create a substitute local registry.

## Version checkpoint policy

Normal Git commits do not automatically become Version Lab checkpoints.

After a coherent feature or meaningful design/data-model change is complete, invoke the app's **Version Lab checkpoint** workflow and provide only:

- title;
- concise summary;
- separable change areas.

The shared workflow owns checkpoint ID, Git SHA capture, immutable snapshot generation, source references, compatibility metadata, schema/data metadata, validation and generated history.

## Security rule

Never expose Version Lab from a release app's menus or ordinary navigation.

The manually entered `/versionlabs/` route is only a passkey gate/redirector. It contains no historical data or Version Lab implementation.

## Failure rule

If shared Version Lab installation or checkpoint generation fails, repair/report the shared integration. Do not invent a local Version Lab or another versioning mechanism.
