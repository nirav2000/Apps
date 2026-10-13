# Verified deployment: Apps issue #25

Completed automatically on 13 October 2026 at 14:31 UTC. Issue #25 is closed with the `diagnostic:verified` label.

| Item | Verified result |
| --- | --- |
| Live app | Dol v2.6.4 — https://nirav2000.github.io/Dol/ |
| Fix/release source | `e1e8f489fdecef85d160b28adf90646b0c64d1a2` |
| Controlled worker | https://github.com/nirav2000/Dol/actions/runs/38411930902 — success |
| Independent verifier | https://github.com/nirav2000/Apps/actions/runs/38413848378 — success |
| Originating issue | https://github.com/nirav2000/Apps/issues/25 — verified, closed |
| Durable worker receipt | https://github.com/nirav2000/Dol/blob/main/docs/diagnostics/Apps-25.json |
| Version Lab | `vl-20261013T142238Z-e1e8f489` — shared checkpoint captured after live verification |
| Installed control | v1.0.2 in both repositories, including bounded safe GitHub retries |

The original tablet CSS failure was reproduced before the repair gate. Twenty-six unit tests and the existing browser regression suites passed. The deployed interface then passed twelve cases: Chromium and WebKit, phone 390×844, tablet portrait 834×1194, tablet landscape 1210×675, and both Classic and Pair Board. All four factors remained visible; the action key retained its position; review preserved learner evidence.

Apps reran the twelve-case matrix independently and closed the issue only after it passed. An earlier verifier run passed every browser case but hit a transient GitHub connection failure while recording status; it left the issue open. Control v1.0.2 fixes that failure with three bounded retries for safe reads/status replacement, while avoiding blind retries of creation requests.

Both workflows use main only. Only the familiar tested tablet recipe is eligible for automatic changes; unfamiliar or consequential reports receive `diagnostic:needs-review`. Scheduled sweeps, issue triggers, per-issue pause labels, a repository pause variable and the two-attempt fix limit are installed. Each repository writes only to itself; no cross-repository credential was added.
