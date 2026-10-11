# Shared Learning SDK v0.1.0

Domain-neutral local-first learning records. No framework, account, cloud provider or maths dependency.

Import `createLearningStore`, `conceptPriority`, `getLearningSummary` from `learning/v1/index.js`. The app supplies concept IDs, correct/incorrect outcomes, hint count and optional elapsed time. `store.record({concept:'fact:7x8',correct:true,hints:0,mode:'practice'})` saves a timestamped event and a heuristic mastery estimate. `store.session(...)` stores completed session summaries. `store.export()` and `store.import(json)` support portable data.

Mastery is an exponentially weighted estimate (78% prior, 22% current outcome), with assisted correct responses weighted 0.55. Spaced review intervals are 1, 3, 7, 14 and 30 days. These are **initial design heuristics**, not evidence of a validated psychometric measurement. No child-specific prediction should be treated as a diagnostic score.

Privacy: localStorage is device-local, can be cleared by the browser, and is not suitable for secret information. No cloud sync or identity is enabled. Optional cloud adapters belong to consuming apps. Apps must request consent for optional telemetry. SDK is a shared capability; changes must not automatically modify other apps.

Node tests: `node --test tests/learning.test.mjs`.
