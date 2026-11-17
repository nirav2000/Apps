# Shared Learning Evidence v1.0.0

**Purpose:** answer the question: **Can Sai now learn something carefully taught, remember it a week later, and use it independently in a new situation?**

This is an additive evidence layer on top of Shared Learning SDK `learning/v1` and optional Learning Sync `learning-sync/v1`. Do **not** replace old progress data or auto-merge accounts.

## Four measures (independent, not a composite)
- **Accuracy:** scored correct questions / attempted questions, including helped questions, with sample size.
- **Independence:** independently correct questions / scored questions with a known help level. A prompt, hint, worked example or unknown support does not count as independent; unknown-support assessments are excluded from that percentage, with their number reported separately.
- **Retention:** independently correct retrieval questions / questions in valid retrieval checks **at least seven days after** a recorded teaching date, with known help level. Practising again on day seven without a new test is not evidence.
- **Transfer:** independently correct questions / questions marked **genuinely novel** in a `transfer` check with a known help level (e.g. changed context or representation). Familiar practice is not transfer.
- Missing data shows **Not measured**, never a zero percentage or 'mastered'.
- 80% is a suggested **configurable** planning threshold, not a psychometric diagnostic cut-off and not automatically enforced.

## Store and UI

```js
import {createEvidenceStore} from 'https://nirav2000.github.io/Apps/learning-evidence/v1/index.js';
import {mountEvidencePanel} from 'https://nirav2000.github.io/Apps/learning-evidence/v1/panel.js';
const evidence = createEvidenceStore({appId:'beyond100',learnerId:'sai',accountId:'guest'});
evidence.record({
  id:'deterministic-source-id',concept:'maths:compensation',phase:'transfer',
  correctCount:3,total:5,support:'none',novel:true,
  taughtAt:'2026-11-17',source:{kind:'assessment',ref:'maths-lab-001'}
});
mountEvidencePanel({target:'#evidence-root',appId:'beyond100',learnerId:'sai',accountId:'guest'});
```

Every record includes `appId/accountId/learnerId/concept`, a stable ID, source reference, phase, score, help level and optional date of teaching. No response text, video, audio, location, third-party identifiers, or personal profile is required. Device storage is partitioned by app/account/learner. `ingest()` is idempotent with a stable ID.

**Review scheduling**: day 1, day 7, day 28 from the latest recorded teaching day. A scheduled review is not an observed result. A missed day-1 check does not hide the more important day-7 check.

**Support**: `none | small-prompt | substantial-hint | worked-example | unknown`.
**Phases**: `diagnostic | practice | retrieval | transfer`.
**Score**: `{correct,total}`; a teaching marker has `0/0`.

## Integration and safety
1. Mount into an existing parent/progress page, not the learner's main play area.
2. Use `store.ingest()` for deterministic mapping of already recorded, authenticated/scoped app events; do not double-persist the same answer from multiple listeners.
3. Keep existing app progress and Firebase rules unchanged by default. Never silently import legacy or guest records into a signed-in account.
4. For cloud sharing use an **explicit, authenticated adapter** supplied by each app, matching Firebase Auth UID, learner identity and owner-scoped Firestore rules. The initial module is **local-first with JSON export**, not a claim of secure cloud deployment.
5. Any parent/teacher evaluation must separately confirm that the task is genuinely novel. No auto-inferred mastery from single successes or immediate practice.
6. `toLearningEvent` can bridge *one deliberately selected evidence record* to the current shared SDK, but must not be applied to an event already captured there; that would double count. Never treat a summary estimate as a diagnosis.

## QA
`node --test tests/learning-evidence.test.mjs`
`node --check learning-evidence/v1/index.js`
`node --check learning-evidence/v1/panel.js`

Pilot: Beyond100 Maths Thinking Lab and assessment evidence, Dol progress panel, Comprehension parent view. Compare observed outcomes after real practice before considering 80% thresholds or auto-adaptation.
