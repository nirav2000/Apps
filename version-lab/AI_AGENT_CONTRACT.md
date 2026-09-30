# Version Lab contract for AI coding agents

This document is normative for ChatGPT, Codex and other coding agents working on a Version Lab-enabled application.

## Do not implement versioning locally

Do **not** create a local Version Lab page, local comparison/snapshot/version-history logic, manually maintain generated release manifests, manually copy snapshots, invent a second versioning system when the shared workflow fails, modify shared Version Lab code from the consuming repository, or expose Version Lab controls to normal app users.

## Development flow

1. Implement the requested application change.
2. Verify the completed change before calling it fixed or complete. For a bug fix, reproduce the reported failure where practical, confirm the failure no longer occurs in the intended runtime/deployment, and check the immediately related behaviour for regressions. Verification may be automated, developer-performed or explicitly user-confirmed, but it must be real evidence rather than code inspection alone when the behaviour can reasonably be exercised.
3. Commit application work normally.
4. Decide whether the completed work is a meaningful human-reviewable checkpoint.
5. If it is, invoke the shared Version Lab release workflow.
6. Supply only the checkpoint title, concise summary and separable change areas.
7. Version Lab owns checkpoint identifiers, Git SHA capture, immutable snapshot generation, source references, release registry updates, configured platform/dependency/data metadata and validation.

A fix that has not been verified must not be represented as a verified Version Lab checkpoint. If runtime verification is temporarily impossible, report that limitation and complete the checkpoint after verification rather than silently skipping the checkpoint.

If Version Lab capture fails, fix or report the shared integration. **Do not substitute a local versioning implementation.**

## When to create a checkpoint

Create one when a coherent user-facing feature, visual redesign or material data-model change is complete; when a build is ready for developer comparison; before a risky redesign; or when the developer explicitly requests a checkpoint.

### Bug-fix rule

A verified user-facing bug fix **must create a Version Lab checkpoint** when it restores previously working behaviour, resolves a regression, or would be useful to compare against a broken or earlier state.

The only exception is a genuinely trivial fix with no meaningful comparison value, such as a spelling-only text correction, comment/documentation-only edit, or similarly inconsequential internal change that does not alter application behaviour.

Do not classify a fix as trivial merely because the code change is small. A one-character or one-line change that restores broken user behaviour is significant and requires a checkpoint.

For a bug-fix checkpoint, the title and summary should state the behaviour restored, not merely the implementation detail. Where known, include the affected area and the regression context.

Do not create a Version Lab checkpoint for every Git commit.

## Release UI rule

A checkpoint/release must not make Version Lab visible inside the normal application. Developer access is exclusively through the central authenticated Version Lab.
