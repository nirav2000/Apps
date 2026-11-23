# French Teaching v1 — integrated into Next, compatible with InClass

**Status:** Additive pilot. The live learner-facing route is https://nirav2000.github.io/Next/french.html (after both repositories deploy). Do not create a new login, change App Monitor's passkey Worker, overwrite Next's older lessons, or enable new features in InClass without a dedicated regression release.

## Purpose and method

A focused French course inspired by Barry Smith, Fadila Bettahar and Michaela's published work, not an official Michaela/Barry Smith course.

- **Knowledge organisers:** a coherent bilingual grid of 14 full sentences, natural and literal translations, grammar/phonics notes, and high-frequency words/structures that can be recycled.
- **CUDDLES:** count letters, underline vowel combinations, double underline double letters, dot silent letters, liaison, exaggerate accents, stories. Explanations are initially textual cues; interactive per-letter annotation remains an enhancement, **not a completed capability**.
- **PROFS:** Past, Reasons, Opinions, Future, Subjunctive. This pilot introduces authentic examples and practices selected forms; it is not a complete five-strand syllabus.
- **Alphabet:** 26 French letter names with device TTS, example words and a listening/letter identification check. Accented vowels and word phonics are introduced as separate from letter names. French TTS is an approximation, and a parent/teacher must verify unclear model sounds.
- **High-utility sentence manipulation:** mais, parce que, donc, si, et, aussi, d'abord, puis, quand, cependant, à mon avis, je voudrais, il faut, plus model sentences for past and future.
- **Guided progression:** find the French, translate to/from English, request hints, check exact model, attempt unseen recombinations, later retrieve. The **first presentation** of a new transfer prompt is counted as novel; repeats become practice.
- **Pronunciation:** uses shared Apps pronunciation module and existing reference Worker; optional microphone and browser speech recognition. Prototype acoustic feedback must never become a phoneme exam or mastery marker.
- **Original and independently authored learner text:** do not copy proprietary Michaela resources.

Primary method sources:
- https://jlmfl.wordpress.com/2017/01/15/aides-memoire-1-cuddles/
- https://jlmfl.wordpress.com/2017/04/23/michaela-french-how-we-use-knowledge-organisers/
- https://hackingattheroots.wordpress.com/

## Files

- data.js: versioned lesson, alphabet, CUDDLES, graded prompts and exact answer comparison (preserves accent distinctions)
- index.js: UI and student lesson controls, independently scoped local evidence store, Firebase connection adapter and optional shared pronunciation lab
- style.css: responsive scoped UI, independent of Next's original layout and InClass
- ../../learning-evidence/v1/firestore-cloud.js: **shared, optional Firebase transport**, no changes to the canonical v1 evidence engine or existing consumers
- ../../tests/french-course.test.mjs: pedagogical/sync regression, including two simultaneous devices, learner identity separation and immutable conflicting IDs

## Firebase persistence contract

Existing kk-syllabus project, existing parent Firebase Auth identity, **existing deployed Firestore rules**:

families/{OWNER_UID}/learners/{learnerId}/progress/evidence-next-french-v1-{eventId}

learnerId is either adult or sai, always explicit. OWNER_UID must equal the authenticated Firebase Auth UID. The path is currently restricted to the configured owner by Kk-syllabus/firestore.rules. Each document contains a single immutable evidence row, learner and account scope, version and created-at timestamp; it contains **no answers, recordings, video or transcripts**. A server fetch and create-only Firestore transaction protect concurrent writes: duplicate IDs with different contents fail closed, records do not overwrite each other, and local pending records remain for retry. Cloud success is indicated only after server operations resolve. The local evidence log remains partitioned by app, owner UID and learner. Guest and Sai's legacy Next progress are never auto-migrated. Missing Firebase session means **tracked practice is not enabled**, rather than silently saving unsynced anonymous rows under another person's account.

**Do not infer mastery from speech-to-text.** The Shared Learning Evidence indicators remain distinct:
1. accuracy including assisted practice;
2. independence with support levels;
3. retention only after a **valid >=7-day retrieval attempt**;
4. transfer only from genuinely unseen prompts without help.

The shared evidence engine's built-in due planner uses 1, 7 and 28 days; the French course additionally offers 1/3/7/28-day in-course review prompts. A scheduled review is not evidence of retention.

## Release, scope and known gaps

- **Release order:** first commit/deploy Apps additions; verify shared JS/CSS HTTP 200; then publish Next French page/link and service worker cache bump.
- Next remains the containing app; old Next authenticated data and notes are untouched. InClass remains homework-first, unchanged.
- Firebase on a physical iPhone/iPad with real parent sign-in must be verified separately from automated tests. Browser mic, device TTS and iOS PWA/offline behaviour need on-device QA.
- The first version uses typed translation with optional browser dictation, rather than a fully automated rapid-fire oral teacher; the latter is future work and should not be claimed as complete.
- The knowledge grid is 14 lines; future releases can expand without modifying older learner evidence.
- **No change to public GitHub credential policy:** Firebase web config is public, privileged credentials stay server-side.
- Built-in progress data is additive and scoped; never clear Safari local site data as a troubleshooting shortcut.

Run: node --test tests/french-course.test.mjs tests/learning-evidence.test.mjs and the existing shared tests. Deploy to main as per docs/GITHUB-WRITE-RUNBOOK.md. Cloud and auth behaviour still requires a signed-in browser acceptance test.
