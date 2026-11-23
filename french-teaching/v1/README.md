# French Teaching v1 — integrated into Next, compatible with InClass

**Status:** Additive pilot. The live learner-facing route is https://nirav2000.github.io/Next/french.html (after both repositories deploy). Do not create a new login, change App Monitor's passkey Worker, overwrite Next's older lessons, or enable new features in InClass without a dedicated regression release.

## Purpose and method

A focused French course inspired by Barry Smith, Fadila Bettahar and Michaela's published work, not an official Michaela/Barry Smith course.

- **Knowledge organisers:** a coherent bilingual grid of 14 full sentences, natural and literal translations, grammar/phonics notes, and high-frequency words/structures that can be recycled.
- **CUDDLES:** count letters, underline vowel combinations, double underline double letters, dot silent letters, liaison, exaggerate accents, stories. Explanations are initially textual cues; interactive per-letter annotation remains an enhancement, **not a completed capability**.
- **PROFS:** Past, Reasons, Opinions, Future, Subjunctive. This pilot introduces authentic examples and practices selected forms; it is not a complete five-strand syllabus.
- **Alphabet:** 26 French letter names with device TTS, example words and a listening/letter identification check. Accented vowels and word phonics are introduced as separate from letter names. French TTS is an approximation, and a parent/teacher must verify unclear model sounds.
- **High-utility sentence manipulation:** mais, parce que, donc, si, et, aussi, d'abord, puis, quand, cependant, à mon avis, je voudrais, il faut, plus model sentences for past and future.
- **Sentence workshop:** five connecting structures with four compatible first clauses and four compatible second clauses each: 80 grammatical combinations. Listening, covering French and typed reconstruction are guided practice, not falsely labelled novel transfer.
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

**Evidence guardrail:** typing after an immediately visible French model is recorded with worked-example support (not independent), even when the answer matches. Covering the model before attempting permits an independent-practice observation, but still never counts as novel transfer or delayed retention.


## Authentication (Google + legacy session reuse, 23 November 2026)

Next/French uses the **existing** kk-syllabus Firebase parent UID, not a separate French account. The Next entry point checks both the legacy named Firebase instance (next-learning) and the default Firebase instance used by other family learning apps; it chooses only a session whose UID matches the protected existing parent UID. It never migrates data or changes Firestore rules. If there is no existing owner session, the sign-in page offers Google sign-in plus a collapsed Firebase email/password fallback.

Google sign-in **works only if the Google account is linked to that same existing Firebase UID**. A parent who signs in with their current Firebase password can select "Link Google to this account", which uses Firebase linkWithPopup and refuses UID changes. Google's provider must be enabled on the kk-syllabus Firebase Authentication project and the hosting domain allowed. An unlinked Google login is explicitly rejected and signed out, rather than being treated as an authorised learner account. Google/Firebase popup flows need an on-device Safari test and may fail if popup blocking or provider configuration is wrong.

App Monitor passkey **does not yet** issue an app Firebase owner session for French; the existing passkey Worker supports other scoped workflows such as private InClass notes, and granting broad Firebase owner access by reusing an App Monitor token without a verified server bridge is prohibited. The shared Auth v1 migration guide recommends leaving legacy authority intact until a dedicated, thoroughly tested broker produces app-UID-preserving scoped credentials. The French course does not change the App Monitor Worker or passkey library.

Automated browser test tests/french-auth-browser.mjs exercises Google sign-in handoff, linking to the existing UID and wrong-identity denial via a safe mock transport. Real Firebase provider permissions, Google pop-up and cross-device session sharing are separate manual acceptance checks.


## French sound and grammar expansion — November 2026

New additive modules under french-teaching/v1:
- phonics.js: 26 letter-name IPA cues, four letter-name groupings, 21 grouped written/sound correspondences, examples heard in words and full sentences, contrasts, and 12 listening-recognition prompts. Sounds is a separate, voluntary step after letter names or during knowledge-grid work. A letter NAME is not necessarily its sound IN A WORD; the course explicitly separates them.
- lexicon.js: curated accessible word notes and 25 common verbs (regular -er, stem/spelling changes and irregulars), subject labels, present-tense conjugations, forms including veux -> vouloir, voudrais as conditional, soit as subjunctive and the impersonal il faut. Multiword connectives and French elisions remain tappable. Non-curated words are rendered as ordinary text, **never sent to an unreliable morphology-guessing service**.
- index.js: tap an alphabet letter to show its card **and play its French name in the same interaction**. Group alphabet names, explore Sounds, hear contrasting words, take listening checks, inspect an underlined word in a modal without navigating away from the lesson; clickable words appear in the knowledge grid, sentence workshop and selected practise models. Expanded conjugation is *optional*, not required for a beginner to continue.

CUDDLES now includes visual, curated marks for five actual French words (double-letter, vowel group, silent letter, accent, liaison). We deliberately do not infer all phonetics from spelling. Corrected former misinformation: *appartement* has pp, not mm. The new work keeps the existing 14-sentence organiser and original evidence IDs/paths unchanged. Sound recognition attempts record independent accuracy under fresh french:phonics:* concepts and existing adult/Sai scoped Firebase events; **no acoustic pronunciation scoring**.

Audio uses the existing fr-FR SpeechSynthesis device API. It can vary by operating system/voice and should not be presented as a phonetic gold standard. A credible accent test still requires a human teacher or specialist calibrated audio. Some distinctions (e.g. /œ̃/ vs /ɛ̃/) vary by regional French accent. IPA labels are support for curious learners, not mandatory lesson content.

Testing: tests/french-extensions.test.mjs covers sounds, spellings, curated words/verbs, elisions, preserving original text and correct conjugation. tests/french-extensions-browser.mjs covers mobile tap-to-speak, grouping, sound quiz Firebase evidence, optional 'veux' morphology dialog and preserved mobile width. Existing auth and Firebase tests continue to run. InClass and App Monitor Worker remain untouched; no credential, rules or existing learner-progress migration is needed.

Sources for the approach:
- Barry Smith / Michaela CUDDLES: https://jlmfl.wordpress.com/2017/01/15/aides-memoire-1-cuddles/
- Knowledge organisers: https://jlmfl.wordpress.com/2017/04/23/michaela-french-how-we-use-knowledge-organisers/

Future curriculum additions should distinguish formal syllable phonics instruction from optional exploration and review content; do not represent a fixed phonics dataset as a comprehensive Michaela curriculum or as official school material.


## Word Explorer dictionary enrichment — 23 November 2026

The French course's optional word explorer now supports **any ordinary single French word** appearing in a knowledge grid or workshop, not only the curated vocabulary. The original curated notes/conjugation tables remain the first and fastest layer for learners. A separately expandable "More from the free dictionary" panel retrieves English meanings, IPA and a short list of inflected forms from the English-edition Wiktionary via the public Wiktapi JSON endpoint, filtered to French (GET /v1/en/word/{word}?lang=fr). For curated verbs, the optional lookup prefers the infinitive (veux looks up vouloir).

Source, licence and attribution: displayed extracts come from community-written Wiktionary entries, accessed through the Wiktapi service. Link to the exact **English Wiktionary French-language entry**, and the corresponding French Wiktionary page. Data is provided under relevant Wiktionary CC BY-SA and/or GFDL licence terms; preserve source links. See https://wiktapi.dev/quickstart, https://en.wiktionary.org/wiki/Wiktionary:Copyrights, and source entries. This is not a paid/proprietary dictionary API and is not official Barry Smith material.

Privacy/security: this client-only GET sends **only the clicked French word or infinitive** to the dictionary provider. Never transmit learning evidence, user identity, private sentences, recordings or Firebase credentials. Fetch requests omit cookies, enforce 7-second timeout and plain-JSON parsing, and render all returned text with HTML escaping. Data is read-only; none of it affects mastery scores. A small expiring local (3-day) cache avoids repeat requests. No new Firebase collections, Cloudflare Workers or secrets are needed. If the service is unavailable, slow, blocked by CORS or missing an entry, learners retain the curated explanation and two direct Wiktionary links. The API may not support every entry, and CORS/uptime remain outside our control; the live provider must be checked on a real Safari/iOS device.

Tests: tests/french-dictionary.test.mjs verifies input validation, language filtering, limits, injection-safe content and cache/error handling; tests/french-dictionary-browser.mjs mocks the external API in Chromium to verify an uncurated word lookup, online enrichment of vouloir, text escaping, cache behaviour and no learning-evidence changes. Both run alongside the existing language, auth and PWA regression checks.


## iPhone installed PWA OAuth freeze safeguard (23 Nov 2026)

The user-provided 26-second iPhone recording shows the Google Accounts sign-in web window becoming unresponsive when selecting iOS's saved Google passkey/password suggestion. This is consistent with a system OAuth popup/webview interaction; the recording does not prove the underlying Apple/Firebase root cause. Existing Next/french.html uses Firebase popup sign-in and popup linking; preserve parent UID checks and never bypass provider identity.

**Mitigation:** auth-context.js identifies iOS Home Screen standalone mode using navigator.standalone or display-mode: standalone plus Apple mobile user-agent/platform (including iPad desktop UA). In that context, French sign-in **does not offer Google popup**, and Next's HTML entry independently guards both popup methods as defence in depth. Instead, the existing Firebase email/password form is expanded, with sendPasswordResetEmail available if necessary and a Copy link for Safari control. Safari browsing continues to offer the linked-account Google button. Safari and installed-PWA storage are not guaranteed to share a Firebase session; do not claim signing in Safari automatically signs in the Home Screen app. These are mitigations, not an Apple authentication bug fix.

No Firebase credentials are copied into external pages, no custom tokens are minted, no App Monitor Worker changes occur, and no Firestore rules/evidence paths are changed. Google account linking within the installed iPhone PWA is deliberately hidden; users should link from Safari or use the already linked Firebase account. A fully seamless passkey login requires a separate server-side identity broker; do not imitate one client-side.

tests/french-auth-context.test.mjs covers iOS/iPad PWA context detection; tests/french-ios-auth-browser.mjs checks that the Google popup is unavailable in a simulated iPhone standalone PWA, that password reset and email/password work, and that ordinary Safari still offers Google. Actual iOS PWA Google/Apple UI cannot be simulated by Chromium; the user should check the new fallback on their device.
