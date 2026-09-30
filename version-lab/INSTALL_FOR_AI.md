# Install the shared Apps Version Lab

This is the canonical one-shot installation contract for ChatGPT, Codex and other coding agents.

A user should be able to instruct:

> Install Version Lab from https://nirav2000.github.io/Apps/version-lab/INSTALL_FOR_AI.md

and the coding agent should take responsibility for the complete installation below.

## Outcome

After installation:

- Version Lab logic remains entirely in the shared Apps repository;
- the consuming app contains only configuration, workflows, generated history and an unlinked developer gateway;
- normal users see no Version Lab control;
- the developer can manually visit `/versionlabs/` and authenticate with the shared App Monitor passkey;
- existing Git history has been backfilled into meaningful historical Version Lab checkpoints;
- historical source and snapshots are generated where possible;
- the current app state is recorded as the **Version Lab adoption baseline**;
- all future meaningful checkpoints use the shared Version Lab workflow.

## Step 1 — inspect the app before changing it

Determine:

- repository and live GitHub Pages URL;
- existing version files/tags/changelog/release branches;
- frontend entry point;
- static assets and files needed for a runnable snapshot;
- Firebase/Firestore project/database and known collection/path structure;
- Cloudflare Workers/R2 or other backend dependencies;
- whether historical replay should be `read-only-adapter`, `visual-only`, `interactive-safe` or `source-only`.

Default data-backed apps to `read-only-adapter` unless there is a reason not to.

Do not delete or replace any existing version/history implementation during initial installation. First prove the shared system works.

## Step 2 — install the integration files

### `.version-lab.json`

Start from:

`https://nirav2000.github.io/Apps/version-lab/templates/.version-lab.json`

Populate app facts, snapshot settings, data/schema metadata and narrow read-only origins.

### Future checkpoint workflow

Copy:

`https://nirav2000.github.io/Apps/version-lab/templates/version-lab.yml`

to:

`.github/workflows/version-lab.yml`

### One-time install/backfill workflow

Copy:

`https://nirav2000.github.io/Apps/version-lab/templates/version-lab-install.yml`

to:

`.github/workflows/version-lab-install.yml`

### Developer gateway

Copy:

`https://nirav2000.github.io/Apps/version-lab/templates/versionlabs/index.html`

to:

`versionlabs/index.html`

Replace `__APP_ID__` with the app ID.

Do not link this route from normal app navigation.

### AI/development instructions

Add:

> This app uses the shared Apps Version Lab. Read and obey https://nirav2000.github.io/Apps/version-lab/AI_AGENT_CONTRACT.md. Do not implement or maintain local versioning, snapshots or Version Lab UI.

to `AGENTS.md` or equivalent development instructions.

## Step 3 — perform historical import/backfill

Run the shared **Install Version Lab** workflow.

The shared installer will:

1. inspect complete Git history;
2. detect tags/version/release/migration/UI/data-model milestones;
3. add evenly spaced historical commits when history would otherwise be too sparse;
4. create `version-lab-backfill-plan.json`;
5. reconstruct each selected checkpoint from the exact historical Git SHA;
6. generate an immutable snapshot where possible;
7. freeze the appropriate historical read-only adapter into each reconstructed snapshot;
8. retain exact Git source links;
9. record configured data/schema and compatibility metadata;
10. create a **Version Lab adoption baseline** for the current state;
11. validate the generated release history;
12. commit generated Version Lab history into the consuming repository.

The historical importer intentionally does **not** create a checkpoint for every Git commit.

## Step 4 — review the backfill plan

Inspect `version-lab-backfill-plan.json`.

The automated plan is a starting point, not an assertion that every selected commit is equally important.

Check that major known milestones are represented. If an important release is missing, add its SHA to the plan and rerun the backfill before treating installation as complete.

Prefer preserving an extra meaningful milestone to discarding useful history.

Existing tags, explicit version commits and release milestones should take priority.

## Step 5 — understand reconstruction quality

For every historical checkpoint, distinguish:

- exact original Git source;
- runnable archived frontend;
- historical configuration reconstructed from Git;
- recorded data/schema metadata;
- backend compatibility;
- historical data availability.

Never imply historical data exists when only source/schema history exists.

A checkpoint may therefore be labelled:

- `read-only-adapter`
- `visual-only`
- `interactive-safe`
- `source-only`

The shared central UI should make these limitations visible.

## Step 6 — register the app centrally

Update `nirav2000/Apps/version-lab/apps.json` with:

- `appId`;
- app name;
- repository;
- live URL;
- `managed: true`;
- `status: "managed"`;
- `releaseManifest: "<liveUrl>/version-lab-data/releases.json"`;
- `gatewayUrl: "<liveUrl>/versionlabs/"`.

If the coding agent cannot update the Apps repository, report central registration as the only incomplete step. Do not build a local substitute.

## Step 7 — verify developer access

Verify that manually visiting:

`<liveUrl>/versionlabs/`

does not expose historical information before authentication.

It should:

1. reuse a valid App Monitor administrator session if present;
2. otherwise offer **Unlock with passkey** using the shared App Monitor passkey;
3. redirect to the central Version Lab scoped to this app after successful authentication.

The app itself must not display a Version Lab button or menu entry.

## Step 8 — verify the reconstructed history

Open at least two historical checkpoints in the central Version Lab.

Verify:

- exact source links work;
- snapshots load where expected;
- read-only snapshots cannot mutate production data;
- compatibility status is accurate;
- meaningful historical UI differences are visible.

Only after this verification should the app be treated as fully managed.

## Step 9 — future development

Normal Git commits are technical history and do not automatically become Version Lab checkpoints.

After a coherent feature, material design change or data-model change is complete, invoke the app's **Version Lab checkpoint** workflow.

For bug fixes, verification is part of completion. Reproduce the reported failure where practical, verify the fix in the intended runtime/deployment, and check the immediately related behaviour. A verified user-facing fix that restores previously working behaviour, resolves a regression, or has meaningful comparison value **must create a Version Lab checkpoint**.

Only genuinely trivial fixes may skip a checkpoint: for example spelling-only copy changes, comments/documentation-only edits, or similarly inconsequential internal changes with no user-visible behavioural effect. The size of the code diff is not the test: a one-character or one-line change that restores broken behaviour is significant.

If a fix cannot yet be verified, report that limitation and create the checkpoint after verification rather than silently treating the work as a completed checkpoint-worthy fix.

The coding agent supplies only:

- title;
- concise summary;
- separable change areas.

The shared Version Lab owns checkpoint IDs, Git SHA capture, snapshots, source references, compatibility metadata, data/schema metadata, validation and generated history.

## Existing Version Lab implementations

If the app already has bespoke or legacy versioning, **do not remove it during first installation**.

Install and backfill the new shared system alongside it, compare behaviour, and only remove the old implementation after the developer confirms the shared Version Lab is at least equivalent.

This is particularly important for Beyond100 and Openday.

## Failure rule

If installation, historical reconstruction or checkpoint generation fails, diagnose/fix the shared integration or report the limitation.

Never respond by implementing another local Version Lab or manually maintained snapshot system.
