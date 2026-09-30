# Shared Version Lab

Version Lab is a developer-only, centrally hosted release-review system for the Apps portfolio. **Beyond100 is the reference implementation for the target experience and richness.**

## Hard architectural rules

- Consuming apps do not contain Version Lab UI or Version Lab business logic.
- Normal release builds do **not** display a Version Lab button, badge link or user-accessible route.
- Version Lab is opened centrally by an authenticated developer.
- Version Lab owns checkpoint IDs, historical snapshot generation, release metadata, comparison behaviour and validation.
- Git remains the canonical archive of original source files.
- Consuming apps provide only one-time configuration and any necessary compatibility/data adapter declaration.
- Improvements to Version Lab must not require routine edits to consuming app code.

## Checkpoints

A named checkpoint records the exact Git commit, optional product version, date/time, title, summary, separable change areas, runnable snapshot when safe, canonical source link, platform/dependency metadata, configured data/schema metadata and a compatibility status.

Git commits are technical history. Version Lab checkpoints are human-reviewable milestones.

## Generated data

The shared release workflow owns:

```
version-lab-data/
  releases.json
  snapshots/
    <checkpoint-id>/
      ...immutable snapshot...
      version-lab-release.json
```

Apps and coding agents must not hand-edit these generated artifacts.

## Developer access

The shared developer UI lives at:

```
https://nirav2000.github.io/Apps/version-lab/
```

It validates the existing App Monitor administrator session. Consumer apps expose no Version Lab control.

## Snapshot safety

Historical apps that once talked to Firebase, Cloudflare Workers or other live services must not silently mutate current production data. Each app declares one of:

- `interactive-safe`
- `read-only-adapter`
- `visual-only`
- `source-only`

The default is `visual-only`, with live network connections blocked in the generated historical entry page.

## Data history

Git versions source code, not Firestore data. Version Lab records an explicit data contract: provider, project/database identifiers, known path patterns, schema/data version and migration metadata. Full historical database backups are a separate capability and are not assumed.

## Migration target

Beyond100 should eventually be able to remove its bespoke Version Lab implementation and use this shared system without losing working comparisons, synchronized scrolling, review notes, change-area decisions, source access and development briefs.
