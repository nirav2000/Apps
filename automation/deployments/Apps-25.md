# Apps issue #25 deployment handoff

Dol's controlled workflow completed successfully:
https://github.com/nirav2000/Dol/actions/runs/38411930902

Deployed product: Dol v2.6.4.
Source commit: e1e8f489fdecef85d160b28adf90646b0c64d1a2.
Evidence: https://github.com/nirav2000/Dol/blob/main/docs/diagnostics/Apps-25.json

The worker reproduced the historical tablet CSS failure, passed all unit and browser regressions before the release commit, deployed the tested tree, verified twelve Chromium/WebKit Classic and Pair Board cases on phone and portrait/landscape tablet, and captured a verified shared Version Lab checkpoint.

Issue #25 remains open pending Apps' independent deployed verification. This handoff triggers the central verifier immediately; it may close the issue only after checking the successful source workflow, allowed diff, deployed version, and its own twelve-case browser matrix.
