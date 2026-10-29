# App Monitor: Repository Privacy Register

Introduced: 29 October 2026.
NO existing repository visibility, Pages publication or shared runtime has been modified by this feature.

## Policy

- New application repositories are PRIVATE at creation time. Never publish their development history and then switch privacy later.
- The destination Pages repository contains only approved public build outputs. It never receives credentials, git history, source maps, internal docs, tests, datasets or private business logic.
- Existing visibility changes require explicit approval and tested migration. The register is advisory: saving a review cannot change GitHub visibility.
- Publish only a precisely tested revision, and abort publishing on failed validation.
- Do not privatise the Apps shared infrastructure before its public scripts and reusable workflows have working replacements.

## Using the register

Open the existing App Monitor dashboard, authenticate with a passkey, and open Repository privacy register.

The UI presents repository visibility, exposure review, Pages enablement, Pages routes, shared-library role and dependency details, secrets-audit status, migration readiness, suggested next step and exportable CSV. You can search, filter and edit individual reviews.

The dedicated Cloudflare Worker serves GET and POST /app-monitor/repository-privacy and stores manual annotations in its private App Monitor R2 bucket at _app-monitor/v2/security/repository-privacy/register-v1.json. Only a passkey-issued administrator session is accepted, not recovery-only login. Data is retrieved from the Worker AFTER login. No private repo names or annotations are baked into public static assets. Exported CSV is unencrypted, so handle it securely.

Sources and evidence:
- Visibility: live GitHub metadata.
- Pages enabled: GitHub has_pages; false means NOT DETECTED, not proof no other public hosting exists.
- Exposure risk and secrets-audit status: manual review, NOT automatic scan results.
- Pages dependencies: manually list Pages publishing source, live URLs, URL paths, service workers, workers, redirects and runtime files.
- Shared-library role and details: manually inspect workflow reuse, dynamic script links, Shared Auth, App Monitor, Learning SDK, notifications, Version Labs and validation.
- Migration readiness: manually reviewed readiness, with automated suggested next action.
- Missing audit evidence must remain Not started or In progress. Never label Passed based on an absence of detected incidents.

## Include private GitHub repositories

Without a server-side token the Worker fetches PUBLIC repositories only and clearly labels the coverage incomplete.

For all private repositories (including future private apps) create a GitHub fine-grained personal access token scoped to the nirav2000 owner, with access to ALL repositories and Metadata: Read-only, no write permissions.

Set it as a Cloudflare Worker SECRET named REPOSITORY_PRIVACY_GITHUB_TOKEN for apps-monitor-api. From a trusted local Apps checkout, run:

    npx wrangler secret put REPOSITORY_PRIVACY_GITHUB_TOKEN -c wrangler-app-monitor.jsonc

Wrangler prompts for the token. Never commit it to the repository, config, logs or web frontend. Refresh the register, verify all private repositories are included, and re-check token access when new repositories are created. Token-scoped coverage alone cannot prove every repo was granted access.

The token is ONLY for reading GitHub metadata. It is not a deployment token.

## Security audit checklist

Before approving migration, check git history, forks, Actions logs and artifacts, Pages assets, service-worker caches, Firebase rules and exposure, Cloudflare secrets and R2 access, authentication, source maps, uploaded data and publicly accessible paths. Revoke/rotate any exposed credentials: changing visibility does not remove earlier copies.

## Migration sequence (not an instruction to execute yet)

1. Populate and assess the privacy register.
2. Keep existing App Monitor, Firebase monitor, Version Labs, shared runtime and workflows accessible.
3. Trial private-source publishing on a low-risk standalone app.
4. Validate end-to-end authentication, Pages routing, service workers, Version Labs, notification registration, backend access and rollback.
5. Migrate approved individual apps gradually.
6. Reassess the central Apps shared provider and monitoring infrastructure last, after its dependencies are isolated.

## New private app release pipeline

    private nirav2000/NewApp (main)
      -> GitHub Actions tests + shared release gate + browser checks
      -> allowlisted dist/ public assets
      -> Pages publishing token (write only to publisher repo)
      -> public nirav2000/nirav2000.github.io/NewApp/
      -> live public site

The regular GITHUB_TOKEN is normally limited to its own source repository, so cross-repo publishing needs a GitHub App installation token restricted to the public publishing repository, or an equivalently restricted fine-grained token stored in the source repository Actions secrets as PAGES_PUBLISH_TOKEN. It must not be the read-only monitoring token.

See docs/templates/private-app-publish.yml. This is a template, not an active workflow. Test route coexistence with existing GitHub Pages project sites before moving any live domain or URL. On GitHub Free, private branches cannot rely on enforced branch protection, so the publish job must depend on successful tests.

To create a new repo privately using the GitHub CLI:

    gh repo create nirav2000/MyNewApp --private

Keep app code and internal documentation private from the first commit.
