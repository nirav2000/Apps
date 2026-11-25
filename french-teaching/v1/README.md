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


## Cloud-synced passkey sign-in for development (23 November 2026)

The **existing** App Monitor passkey can establish the existing kk-syllabus Firebase parent account in Next/French without typing its email/password:
1. If a live browser-local Firebase Auth owner session exists, the course reuses it.
2. Otherwise the Next entrypoint restores the revocable App Monitor admin session from localStorage (same origin and storage key as App Monitor), verifies it against the App Monitor Worker, and requests a short-lived Firebase custom token from POST /app-monitor/owner/french/firebase-token.
3. The Worker requires EXACT allowed Origin, an R2-verified unexpired App Monitor session created by an administrator *passkey* (not a recovery token), a POST request, and a dedicated kk-syllabus Firebase signing service account. It signs a one-hour RS256 Firebase custom token with only the existing parent UID and without elevated Firestore claims. No web app can supply another UID or project ID.
4. The Next entrypoint signs into the same kk-syllabus Firebase project using signInWithCustomToken. The existing Firestore rules, evidence prefixes, normal learner switching, and automatic sync remain unchanged. Firebase Auth browserLocalPersistence remembers that identity across app reloads. On other devices, authenticate with the same App Monitor passkey once and Firebase restores the shared cloud records.
5. If no passkey session exists, the app offers "Continue with App Monitor passkey". Existing Google (Safari) and email/password fallbacks remain available.

**Safety & limitations:** An arbitrary public visitor cannot use the development mode as an owner, and the App Monitor session is NEVER treated as Firebase auth by the browser alone. A private Worker route checks the secret token against R2 before minting a short-lived Firebase identity token. No service-account private key is included in static assets. The Worker requires a *kk-syllabus* signing account; if the existing Cloudflare FIREBASE_ADMIN_SERVICE_ACCOUNT_JSON belongs to another project, the bridge fails closed with a clear configuration message rather than issuing a token, and configuring the correct service account requires a separate restricted Cloudflare secret change. App Monitor recovery-only sessions cannot use the bridge. The current user owns the parent account; the client cannot authorise new Firebase accounts.

The server-side Firebase custom-token bridge is isolated in firebase-passkey-bridge.js and covered by tests/french-firebase-passkey.test.mjs (credential scope, origin/method checks, RSA signature/claims) plus tests/french-passkey-browser.mjs (mock passkey login, real evidence adapter, separation of adult/Sai records). It is deployed only through the Apps repository's staged-and-rolled-back App Monitor Worker workflow and must pass existing App Monitor passkey service checks. Do not use bare wrangler deploy.

### Cloudflare deployment recovery — resolved 23 November 2026

**Production status: deployed and verified.** App Monitor Worker build `2026.11.23.french-passkey-firebase-v1` is live, with the existing R2 passkey store, the `kk-syllabus` Firebase credential, and the existing Biz catalogue binding preserved. Live unauthenticated tests verified WebAuthn challenge/replay, the owner/notes/NVR/privacy/Biz routes, Origin checking, and the French Firebase token route's fail-closed responses. A real iOS passkey sign-in and an authenticated two-device Firebase evidence sync still require on-device acceptance testing.

Recovery source: encrypted GitHub Actions secret `FIREBASE_SERVICE_ACCOUNT_KK_SYLLABUS` in `nirav2000/Kk-syllabus`, first used by the earlier Firestore rules deployment and successfully used in the November 2–3 credential-restoration workflow. No new private key was created or stored in repository files.

Recovery steps and immutable Worker versions:
- Original production version: `0bb46ca0-65bc-4b45-b8e8-1ab55f31352d` (retained as rollback target).
- Initial undeployed candidate: `a80d0195-93d6-48f4-9145-c2def4f7a86f`, created by `wrangler versions upload --secrets-file` with Firebase credential from GitHub Actions. It lacked the Biz catalogue binding, so promotion was blocked. Action: https://github.com/nirav2000/Kk-syllabus/actions/runs/45281831695
- Repaired undeployed candidate: `c3dfde93...`, assembled through Cloudflare Worker Versions API with explicit immutable binding inheritance: Firebase from the undeployed candidate, Biz (a legacy `plain_text` binding) from the original production version. All binding names, Worker build, R2 passkeys and protected endpoints passed preview tests. Action: https://github.com/nirav2000/Kk-syllabus/actions/runs/45283024497
- **Live promotion with automatic rollback:** https://github.com/nirav2000/Kk-syllabus/actions/runs/45283355026 — passed. Original Worker remained available for rollback, no secret values were inspected or printed.

**Important for future releases:** `nirav2000/Apps/.github/workflows/deploy-app-monitor-worker.yml` still uses standard `wrangler versions upload`; it may fail to inherit bindings and should not be assumed safe for new Worker revisions. It already refuses to promote candidates lacking required bindings. Before another Worker release, carry the tested explicit binding-inheritance and the multi-route smoke/rollback safeguards into the standard pipeline. Do not use `wrangler deploy`, blindly remove `secrets.required`, or print/copy the Biz variable's value.

The live bridge checks that a passkey session is verified before issuing a short-lived Firebase custom token for the pre-existing parent UID. GitHub Pages never receives a service-account private key; no Firestore rules or original learner evidence paths were changed.


## French Guided v2: original Magic 10 + intensive repeated practice (November 2026)

Goal: reproduce the publicly described teaching principles of Barry Smith / Jessica Lund's Michaela MFL work, not proprietary worksheets, lesson recordings or a canonical list of ten fixed items. Jessica Lund's 2022 blog documents a "Magic 10" style of memorising immediately usable verb phrases before formal rule explanation; see https://jlmfl.wordpress.com/2022/11/27/teaching-grammar-rote-vs-rules/. The new magic10.js contains an **original ten-frame set** (infinitive, like, want, present, negation, can, must, near future, completed past and polite wish) applied to eight *manually reviewed* verb+complement phrases. These are not all grammatical "tenses" and are not official Michaela materials. Irregular vouloir, aller, avoir, être and faire have individually vetted optional timeline examples; no unknown verb gets automatically guessed conjugation or past auxiliary.

Lesson design: guided-lessons.js supplies four units of approximately 63 short turns each. Units deliberately reuse a small number of original complete sentences in increasingly challenging ways: oral recall/models (10), brief modeled presentation (nine), guided French recognition (eight), comprehension dictation (eight), transcription dictation (eight), scaffolded English-to-French reconstruction (eight), independent English-to-French writing (eight) and four genuinely fresh connective-based sentence transformations. The vocabulary recurs many times. Learners hear and repeat phrases through user-triggered device speech, say them before revealing the French, receive immediate corrections, and may opt into a hint or show the model. Word-level grammar, detailed present conjugations and Wiktionary remain optional, not prerequisites. This draws only on *general learn-by-repeating and build-from-chunks principles* associated with Paul Noble's course descriptions: it contains no copied Paul Noble course scripts, sequences or licensed audio.

Evidence and safety: the teaching sequence reuses Apps' canonical next-french Learning Evidence store, adult/Sai learner profile scope, existing parent UID and immutable Firebase records; no changes to Firestore rules, passwords, passkeys, InClass or historical lessons. Every step gets a source-versioned completion marker (not a scored success). A written/listening item's first attempt is recorded exactly once; late corrections can complete the step but do not alter the first attempt. Models are unscored. Showing a full answer is worked-example support and is not independent learning. Novel transfer is credited only for an unassisted first view of new sentence combinations. Independent 7-day retrieval uses the original teaching date, not the time of practice. Reviews are due on day 1, 3 and 7 by individual unit, and due reviews are prioritised. Start/Continue on the overview opens the next step; the evidence record allows multi-device resumption. The lesson is repeat-heavy by design; it can be stopped at any time.

Checks and limitations: tests/french-guided.test.mjs verifies exact vetted verb morphology, absence of hypothetical auto-conjugation, ten patterns, stage volumes, corrected-error repairs, delayed review schedules and phase validity. tests/french-guided-browser.mjs checks Magic 10 audio, optional conjugation, repeat model steps, browser-local/Firebase cloud events, restarts and adult/Sai separation. Original reference lessons/tabs are retained. Device speech quality varies. Text matching still expects a curated model; alternatives outside that model need human feedback. Strong claims of actual language learning require repeated real-user accuracy, independent seven-day retention and novel transfer beyond automated tests. Follow the cross-device passkey acceptance checklist in this README before declaring those capabilities field-verified.


## Audio-first interaction and inline feedback — 24 November 2026

Teaching models and deliberate listening/dictation prompts speak automatically on entry; revealing a model speaks it, and finishing an oral model reinforces it before any newly visible phrase. Occasional short French classroom instructions embed the model in connected French speech. Explicit replay remains available. Autoplay is initiated from the learner's navigation gesture, never from a Firebase refresh, and does not preview hidden independent/transfer/review answers. French multiple-choice options speak when tapped, retain accessible green tick/red cross feedback, and remain replayable after completion without re-scoring. Listening questions retain the French model and distinguish English option audio. Typed corrections and workshop models also play on reveal or successful completion. Evidence IDs, lesson content, accounts, scheduling and Firebase paths remain unchanged. Real iOS voice availability/autoplay and audio timing require device acceptance; mocked browser tests cannot certify physical audio or learning gains.

The same interaction pattern applies to the separate alphabet and phonics listening checks: entering and advancing plays the new listening target, and phonics options show accessible green/red feedback. The first answer is recorded before any option or correction audio plays; subsequent taps are replay only, so they cannot produce additional scored responses. The explanatory sound note is preserved.

### Audio sequencing, compact answers and useful hints — 24 November 2026
Next waits for actual speech completion before replacing a question; oral models replay while still on the same screen. Explicit tab, unit or learner changes cancel stale advances. Bilingual rows pair English and French, including the correct listening-choice row. Guided writing uses contextual and progressively concrete hints, retains the draft, and logs an unscored hint marker to avoid false independence after reload. Full models remain assisted. Legacy sentence hints retain the draft. Existing IDs and Firebase scope are unchanged.

### Marked written answers and keyboard flow — 24 November 2026
Every submitted guided written/dictation response displays the learner's exact text next to the correct model. Wrong submissions have a red comparison row and red feedback; correct ones are green. A voluntarily revealed draft is neutral and unscored as a success. Wrong guided responses are recorded before correction is exposed and completed as assisted on Next; missed main-deck steps enter the existing repair queue. Sentence practice/review also shows immediate comparison. Next receives focus after marking; Enter checks an input, then activates the focused Next button, which still waits for speech. New typed prompts receive input focus; held Enter cannot skip unseen questions. Alphabet retries preserve the entered letter. Evidence scope and existing IDs remain unchanged.

### Exact typed responses, word audio, voice selection and stable progress — 24 November 2026
Guided and free writing fields disable native autocorrection, predictive writing suggestions, spellcheck and autocomplete where the device supports those attributes. Marking snapshots the field's literal value; the comparison never merges answer/model text or inserts a French token. Keyboard-level substitutions cannot be proven from historical evidence and may still depend on the OS. Individual visible French words in guided models, comparisons and Magic 10 can be tapped to hear them; existing knowledge-grid/workshop explorer taps also speak before opening their optional explanation. Settings offers the browser's French voices, a preview and a device-local saved preference, falling back to a French voice if unavailable; the independent pronunciation coach retains its reference provider. Teaching progress always preserves core and correction counts after completion; review counts are separate. No evidence IDs or data are rewritten.

### Private answer history
French-only local-first audit records, separated from the shared score-only evidence log, sync under the existing owner-scoped progress collection with app ID next-french-answers. All submitted guided choices/writing, assessment and adaptive/repair writing, free sentence practice, alphabet and phonics responses, and model reveals/repetition markers capture their literal inputs, prompt, expected model, outcome, support and marker reason. No spoken recording is inferred. Completed independent assessments reveal corrections in history; unfinished check corrections stay hidden in the UI/export. Legacy score-only events show reconstructed question/model where known and explicitly no historical input. No scores are rewritten and no answer is sent to an external grading service. Exact-match grading can reject valid alternate translations; the audit exposes its normalized comparison and accepted forms. Device and cloud acceptance remain necessary.

### Unified word interaction
Tap a visible French word to hear it; press and hold for at least 500 ms, use right-click/Alt+Enter, or tap the compact Explore action after selecting a word to open Word Explorer. Selection changes only transient UI, never an answer or score. All guided models and corrections, Magic 10, knowledge-grid/workshop text, visible oral/repair models and phonics examples use the same handler. Before a multiple-choice answer is completed, the row still selects and pronounces the whole answer; after marking, individual French words become tappable/holdable and the row's speaker replays the whole phrase. Hidden independent assessments and controlled teaching experiments remain unchanged. Curated devoir and étudier notes include usable tense examples. Touch hold is tested with browser pointer events; physical iPad Safari gesture and voice behaviour still require device acceptance.
