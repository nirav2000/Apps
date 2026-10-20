# Shared Release Safeguards v2.0.0

Opt-in. Other apps are unaffected until they install and validate the same version.

## Adoption lifecycle
- Available: shared v2 exists in Apps, with a tested immutable commit SHA.
- Tested/compatible: consumer app runs code quality and real browser journeys successfully.
- Installed: consumer pins the exact shared commit in its release workflow.

## App configuration
Add `codeQuality.include` with explicit browser JS source files, and `interactionTests.scenarios` with real browser actions. The runner fails on unknown actions, missing selectors, browser exceptions, and local 404s.

## Deployment
A consumer release workflow MUST depend on the shared validation job and only then call `actions/deploy-pages`. Avoid independent deploy-from-branch Pages source: Settings → Pages → Build and deployment → Source = GitHub Actions. Verify this setting separately; a repository workflow cannot guarantee the setting itself.

## Verification
Save code-quality, interaction and release-gate reports as GitHub Actions artifacts. Run desktop and mobile journeys; after deploy, verify the actual production URL and version. No production writes or external requests are performed by the test runner.

## Rollout
Use a fixed shared commit SHA. Do not use `@main` for the installed version. Upgrade each consumer explicitly after its own tests pass. Keep app-specific test scenarios in each app.
