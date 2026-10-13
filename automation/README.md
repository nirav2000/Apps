# Controlled diagnostic fixes v1.0.0

Apps and Dol run on main only. New structured diagnostic issues are investigated on issue events and by scheduled sweeps. Apps triages its own reports immediately; the Dol worker polls Apps and Dol every ten minutes. GitHub schedules can be delayed. Run workflow manually for an immediate sweep.

Only owner-created reports with a recognised, independently reproduced signature enter the automatic queue. The initial recipe matches Apps #25's exact tablet/Classic/timed/231/1210×675 geometry. All other diagnostic reports require review. Issue prose is never executed or passed to a coding agent.

A worker first reproduces a geometry assertion failure; network/setup failures do not qualify. It applies one fixed tablet CSS recipe, increments product version/footer/cache references, and checks the diff against a four-file allow-list. Unit tests, existing browser regressions, diagnostics UI, and the dedicated 12-case Chromium/WebKit phone/tablet matrix must all pass before a direct main commit. Concurrent main changes reject the commit; no force pushes or branches.

The worker deploys that exact tested tree with GitHub Pages Actions, waits for its version, reruns the browser matrix on the public interface, then commits a small deployment receipt. Apps independently checks the successful workflow, baseline/source comparison, live version and deployed browser matrix before closing the originating issue. Receipts and Actions artifacts retain evidence. Failed verification leaves the issue open. Version Lab capture follows successful verification.

Set repository variable `DIAGNOSTIC_AUTOFIX_PAUSED` to `true` in either repository to stop that worker. Issue label `diagnostic:paused` stops an individual report. `diagnostic:needs-review` excludes it from automatic handling. Two failed attempts require review. Disable a workflow in Actions for an immediate global stop. No auth, billing, learning/data, dependencies, workflow or unfamiliar changes are eligible for automatic repair. A reviewed new recipe must be installed deliberately.

No cross-repository secret is needed: each token writes only to its own repository. Apps reads Dol's public evidence; Dol reads Apps' public issues. No raw media, account data or recorded typed text is published.
