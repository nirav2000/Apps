# Version Lab contract for AI coding agents

This document is normative for ChatGPT, Codex and other coding agents working on a Version Lab-enabled application.

## Do not implement versioning locally

Do **not** create a local Version Lab page, local comparison/snapshot/version-history logic, manually maintain generated release manifests, manually copy snapshots, invent a second versioning system when the shared workflow fails, modify shared Version Lab code from the consuming repository, or expose Version Lab controls to normal app users.

## Development flow

1. Implement and test the requested application change.
2. Commit application work normally.
3. Decide whether the completed work is a meaningful human-reviewable checkpoint.
4. If it is, invoke the shared Version Lab release workflow.
5. Supply only the checkpoint title, concise summary and separable change areas.
6. Version Lab owns checkpoint identifiers, Git SHA capture, immutable snapshot generation, source references, release registry updates, configured platform/dependency/data metadata and validation.

If Version Lab capture fails, fix or report the shared integration. **Do not substitute a local versioning implementation.**

## When to create a checkpoint

Create one when a coherent user-facing feature, visual redesign or material data-model change is complete; when a build is ready for developer comparison; before a risky redesign; or when the developer explicitly requests a checkpoint.

Do not create a Version Lab checkpoint for every Git commit.

## Release UI rule

A checkpoint/release must not make Version Lab visible inside the normal application. Developer access is exclusively through the central authenticated Version Lab.
