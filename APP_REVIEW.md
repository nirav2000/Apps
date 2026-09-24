# Apps Architecture & Review Register

_Last updated: 24 September 2026_

This is the living architecture, configuration and implementation register for the recent Apps portfolio, starting with **Kk-syllabus**. Update this file whenever an app changes its data store, Firebase project/database, authentication, monitoring, logging or shared platform integration.

## Scope

Current review scope, in repository order:

1. `Kk-syllabus`
2. `Openday`
3. `LearnLatin`
4. `Comprehension`
5. `beyond100`
6. `snag`

The `Apps` repository provides the shared dashboard/platform components used by these apps.

## Executive summary

| App | Primary persistence | Firebase project / DB | App authentication | Firebase usage log | App Monitor | Shared identity |
| --- | --- | --- | --- | --- | --- | --- |
| Kk-syllabus | Local + Firestore | `kk-syllabus` / `(default)` | Firebase email/password; configured parent UID | **High client coverage; partial end-to-end** | Yes | App Firebase UID + canonical device ID |
| Openday | Local + Firestore token state | `kk-syllabus` / `(default)` | Owner Firebase session or memorable-token capability | **High for inspected sync operations** | Yes | Owner Firebase UID when present + canonical device ID; token-only sessions remain pseudonymous |
| LearnLatin | Local + Firestore | `kk-syllabus` / `(default)` | Firebase email/password; configured parent UID | **High client coverage** after 24 Sep instrumentation | Yes | App Firebase UID + canonical device ID |
| Comprehension | Local storage only | None | None | N/A — no Firebase operations | Yes | Canonical device ID only |
| beyond100 | Local + Firestore | `kk-syllabus` / `(default)` | Firebase email/password; configured parent UID | **High browser-side coverage** after 24 Sep instrumentation | Yes | App Firebase UID + canonical device ID |
| snag | Local + Firestore + Cloudflare R2 media | `snag-509418` / `(default)`; legacy `kk-syllabus` retained for migration | Firebase anonymous by default; optional email/password protection | **High / near-complete browser-side coverage** through Firestore wrapper | Yes | Firebase UID + stable Snag user ID + canonical device ID |

### Key conclusions

- Four learning/utility apps currently share the **`kk-syllabus` Firebase project**: Kk-syllabus, Openday, LearnLatin and beyond100.
- Snag has been moved to its own **`snag-509418`** Firebase project. Its old `kk-syllabus` configuration is retained only for migration/rollback paths.
- Comprehension is currently **local-only** and has no Firebase reads/writes to log.
- All six apps load **App Monitor**.
- All six now also load the shared **`Apps/apps-auth.js` identity module**.
- App Monitor and Firebase Usage Monitor now use the **same canonical browser/device ID**, rather than maintaining unrelated IDs.
- Authenticated apps now publish their Firebase user identity into the shared identity layer. Comprehension remains correctly device-only.
- The app monitor already had a central alias store for assigning a person to a device, auth ID or session. The UI now additionally exposes a consolidated **People & devices** table.
- IP address is recorded as network context, but **IP is not used as the primary device/person key**. Multiple phones/tablets can share the same public IP.

---

# Shared platform

## 1. Canonical device identity

Shared module:

`https://nirav2000.github.io/Apps/apps-auth.js?v=1`

Canonical browser-storage key:

`apps-platform.v1.device`

The module migrates/reuses the old App Monitor and Firebase Usage device identifiers and aligns them to one value. Because the apps are all served beneath the same `nirav2000.github.io` origin, normal browser local storage can be shared across the different app paths.

### What this solves

Opening Kk-syllabus, Openday, LearnLatin, Comprehension, beyond100 and Snag in the same browser now produces the same persistent device ID. App Monitor can therefore consolidate those app sessions as one device even if:

- the user is anonymous;
- different apps use different Firebase projects;
- the device is on the same public IP as other phones/tablets;
- an app has no Firebase at all.

### Limitations

A browser device ID is not a hardware serial number. A new ID may legitimately appear if:

- site data/local storage is cleared;
- private browsing is used;
- a different browser is used on the same physical device;
- browser storage is isolated or reset.

For those cases, App Monitor's persistent aliases should be used to label/link the observed identity to a person or named device. We should not attempt invasive hardware fingerprinting.

## 2. People / aliases

The Cloudflare App Monitor backend already supports centrally stored aliases for:

- `device`
- `auth`
- `session`

Aliases are stored in Cloudflare R2 and protected by the App Monitor admin key.

Resolution order in the monitor is:

1. session alias;
2. authenticated-user alias;
3. device alias;
4. username exposed by the app;
5. unassigned.

The App Monitor UI now has a **People & devices** table so a device can be named, for example:

- Nirav
- Sai
- Family iPad
- Kitchen iPad

That label then applies across the apps observed with the same device ID.

## 3. Shared authentication / identity module

`apps-auth.js` is deliberately independent from any individual app.

Current responsibilities:

- maintain canonical device identity;
- accept an app-specific authenticated user via `AppsAuth.setAppIdentity(...)`;
- expose a single effective identity to App Monitor;
- optionally initialise a separate central Firebase Authentication project;
- support email/password, anonymous sign-in, anonymous-account protection, password reset and sign-out for that central identity project;
- emit `apps-auth:change` events for loosely coupled integrations.

### Important separation: identity versus authorization

A central Apps login can identify the same human across siloed apps, but a Firebase ID token from one Firebase project does **not** automatically grant access to Firestore in another project.

Therefore the architecture should remain:

**Central Apps Identity**
: Answers “who is this person/device across my apps?”

**Per-app authorization**
: Answers “what is this person allowed to access in this app's own Firebase project?”

This keeps apps siloed.

### Future true SSO

If one login is eventually expected to grant access to multiple separate Firebase projects, add a secure token broker/custom-token service. Do not make apps share databases merely to obtain SSO.

Status: **module implemented; dedicated central identity Firebase project/config not yet provisioned.**

Recommended future project: a small dedicated Firebase project such as `apps-identity`, used only for Authentication/identity metadata, not app data.

---

## 4. Passkey admin-auth framework

Reference documentation:

`PASSKEY_AUTH_FRAMEWORK.md`

Shared browser module:

`https://nirav2000.github.io/Apps/apps-passkey-auth.js?v=1`

App Monitor is the first implementation. The framework separates cross-app user identity (`apps-auth.js`) from privileged administrator authentication.

Key properties:

- passkey-first WebAuthn with required user verification;
- owner-approved first-use bootstrap through authenticated GitHub Actions rather than "first visitor wins";
- one active bootstrap request, expiring after 30 minutes;
- private server-side recovery hash;
- 12-hour revocable admin sessions;
- multiple independently revocable passkeys;
- five-failure clearing of only the affected app's cached admin/session state;
- reusable client API for future private/admin surfaces.

Use this framework for new privileged interfaces instead of adding new permanent bearer-token schemes.

---

# Firebase project isolation review

The apps are conceptually siloed, but four still share the `kk-syllabus` Firebase project. This is a historical implementation choice, not a requirement of the new shared identity layer.

| App | Current isolation | Direction |
| --- | --- | --- |
| Kk-syllabus | Own logical data inside `kk-syllabus` | Keep as the original project |
| Openday | Shares `kk-syllabus` | Candidate for dedicated project or a lighter non-Firestore store; low-volume state makes migration straightforward once identity is settled |
| LearnLatin | Shares `kk-syllabus` | Strong candidate for dedicated Firebase project because learning history is a distinct app dataset |
| Comprehension | Local only | If cloud sync is added, start directly in a dedicated project rather than adding it to `kk-syllabus` |
| beyond100 | Shares `kk-syllabus` | Strong candidate for dedicated Firebase project because it now has several Firestore subsystems and its own rules/operational profile |
| Snag | Dedicated `snag-509418` | Already isolated; keep this model |

### Migration order

Do **not** split the remaining apps merely by changing Firebase config. Their current authorization depends on the `kk-syllabus` Firebase Authentication user/UID and some learning apps share learner catalogue conventions.

Recommended order:

1. finish/provision central Apps identity;
2. decide whether per-app Firebase Authentication remains separate or is fed by a custom-token broker;
3. create destination projects;
4. copy rules/indexes/config;
5. migrate data with reconciliation checks;
6. switch one app at a time;
7. retain the old project read-only for a defined rollback window;
8. update this register and Firebase Usage targets.

The shared Apps identity module is intentionally compatible with this direction: it can continue identifying the same person even when the app's data project changes.

---

# Monitoring architecture

## App Monitor

Client:

`Apps/app-monitor.js`

Backend:

Cloudflare Worker in `snag/cloudflare-worker.js`

Storage:

Cloudflare R2 under `_app-monitor/`

Captured when available:

- app
- canonical device ID
- session ID
- authenticated UID / username / provider
- central/app UID fields when supplied
- device/browser/OS class
- screen/viewport information
- active visible time
- page/path
- IP address and IP hash
- approximate Cloudflare network geography
- first/last seen timestamps

The monitor sends an early snapshot, periodic heartbeats, and best-effort hidden/page-exit snapshots. It creates **no Firestore reads or writes**.

### Privacy action

**Review required:** define retention for raw IP and approximate location. For long-term analytics, hash-only or short-retention raw IP may be sufficient. Do not treat IP or approximate location as proof of identity.

## Firebase Usage Monitor

Client:

`Apps/firebase-usage-monitor.js`

Backend/storage:

Cloudflare Worker + R2 daily snapshots, not Firestore.

The monitor records explicitly instrumented logical Firestore operations by:

- app
- Firebase project
- database
- operation type
- operation label
- hour / five-minute bucket
- canonical device

It does not magically intercept all Firebase operations unless an app wraps the Firestore module (as Snag does). Coverage therefore has to be reviewed per app.

### Counting caveat

The dashboard is an application-side call ledger, not Google's authoritative billing meter. Transaction retries, listener deliveries, server/Admin SDK calls, cache behavior and Firebase billing rules can make Google Cloud's authoritative usage differ. The dashboard is intended for attribution and early-warning diagnostics.

---

# Per-app review

## Kk-syllabus

### Purpose / persistence

Learning/curriculum app with local-first state and optional cross-device Firestore sync.

### Firebase

Project:

`kk-syllabus`

Database:

`(default)`

Configuration:

`src/firebase-config.js`

Configured owner UID:

`2AJSfYdtg5URWHv7HCzpNMmKIlg2`

Main Firestore layout:

- `families/{ownerUid}/learners`
- `families/{ownerUid}/learners/{profileId}/events`
- `families/{ownerUid}/learners/{profileId}/progress/state`

Authentication:

Firebase email/password. Cloud sync only proceeds when the signed-in UID matches the configured owner UID.

### Firebase usage logging

Client sync is instrumented for:

- learner catalogue query;
- profile descriptor writes;
- event queries, counted by documents returned (minimum one read for an empty query);
- event batch writes;
- progress metadata transaction reads and writes, including callback retries.

Coverage status:

**High for the main browser sync path; partial end-to-end.** The logger now declares `kk-syllabus/(default)` explicitly so these operations are not attributed to an `unknown` project.

Known uncounted Firebase work:

- Cloud Functions/Admin SDK calls such as the `explanation_limits` transaction in `functions/index.js`.

Action:

- Keep browser ledger as-is.
- Add separate server-side/Cloud Monitoring attribution if authoritative per-function Firestore usage becomes necessary.

### App Monitor

Loaded: **Yes**

Identity:

Firebase user is now published to `AppsAuth` when Firebase auth initialises.

Device:

Canonical shared device ID.

---

## Openday

### Purpose / persistence

Open-day catalogue with device-local state plus private sync/recovery state.

### Firebase

Project:

`kk-syllabus`

Database:

`(default)`

Firebase configuration is imported from:

`/Kk-syllabus/src/firebase-config.js`

Main Firestore locations:

- `app_private_state/openday`
- `openday_sync/{tokenHash}`

Authentication/access modes:

- configured-owner Firebase session; or
- memorable-token capability.

The raw memorable token is stored on the client when remembered. Firestore stores/uses a derived hash/capability record rather than the raw memorable token.

### Firebase usage logging

The inspected token-sync operations are explicitly instrumented, including:

- token-state reads/writes;
- owner-state reads/writes;
- token creation;
- token rotation;
- token reset/recovery reads;
- owner/token capability updates.

Coverage status:

**High for the current Firestore sync module.**

Action:

- If new Firestore calls are added outside `plugins/firebase-token-sync.js`, they must use the shared instrumentation convention or a wrapper.

### App Monitor

Loaded: **Yes**

Identity:

- Owner Firebase sessions now publish their auth UID through `AppsAuth`.
- Token-only sessions do not expose the memorable token as a user identifier. They remain device/pseudonymous unless manually assigned in App Monitor.

Device:

Canonical shared device ID.

---

## LearnLatin

### Purpose / persistence

Latin learning app with local practice state and cloud synchronization.

### Firebase

Project:

`kk-syllabus`

Database:

`(default)`

Authentication:

Firebase email/password restricted in application logic to the configured owner UID.

Main Firestore base:

`families/{ownerUid}/learners/sai-latin/progress`

Includes:

- metadata document `latin`;
- separate session records;
- separate note records.

### Firebase usage logging

Before this review:

**Not included.** LearnLatin made Firestore calls but did not load `firebase-usage-monitor.js`.

Implemented 24 September 2026:

- added Firebase Usage Monitor;
- metadata reads counted;
- record-query reads counted;
- transaction reads/writes counted;
- transaction retries are logged when the transaction callback reruns.

Coverage status:

**High for the current browser-side Firestore sync path.**

### App Monitor

Loaded: **Yes**

Identity:

Firebase user now published through `AppsAuth`.

Device:

Canonical shared device ID.

---

## Comprehension

### Purpose / persistence

English comprehension practice/personalisation app.

### Persistence

Current reviewed storage:

- `comprehensionProgress` in localStorage;
- `saiComprehensionErrorProfileV1` in localStorage.

No Firebase/Firestore configuration was found in the current app.

### Firebase usage logging

Status:

**N/A.** The app currently makes no Firebase operations.

Do not add Firebase Usage Monitor merely to make the dashboard look complete; add it only if Firebase is introduced.

### Authentication

None currently.

### App Monitor

Loaded: **Yes**

Identity:

Device-only unless/until a central Apps identity account is configured. This is expected.

Device:

Canonical shared device ID.

---

## beyond100

### Purpose / persistence

Topic-first learning/mastery app with local state, private learner context, notes, review feed and learning-evidence sync.

### Firebase

Project:

`kk-syllabus`

Database:

`(default)`

Configuration:

`cloud-config.js`

Configured owner UID:

`2AJSfYdtg5URWHv7HCzpNMmKIlg2`

Current/legacy learner base includes:

`families/{ownerUid}/learners/sai-beyond100/progress`

The learner-profile module can resolve/migrate against the shared learner catalogue.

### Firebase usage logging

Already instrumented before review:

- note saves;
- note sync query (now counted by documents returned rather than as a single query read);
- changed-note writes;
- review-config read;
- review-feed writes;
- review status writes;
- learning-evidence read/write.

Added 24 September 2026:

- learner-catalogue query;
- legacy learner-progress query;
- migration batch writes;
- private learner-context read/write;
- previously uncounted review-config writes.

Coverage status:

**High for the reviewed browser-side Firestore code.**

Action:

- Future modules must use the same instrumentation convention.
- If Beyond100 Cloud Functions/Admin SDK paths are added, track them separately from the browser ledger.

### App Monitor

Loaded: **Yes**

Identity:

Firebase user now published through `AppsAuth`.

Device:

Canonical shared device ID.

---

## Snag

### Purpose / persistence

Shared snag/issue recorder with offline/local operation, real-time Firestore collaboration and R2 media storage.

### Firebase

Primary project:

`snag-509418`

Database:

`(default)`

Primary config:

`firebase-config.js`

Legacy Firebase config:

`kk-syllabus` retained for migration/rollback compatibility.

Main Firestore layout includes:

- `snag_projects/{projectId}`
- project members;
- invites;
- snags;
- snag updates;
- private notes;
- per-member seen state;
- `snag_users/{uid}` and project references.

### Authentication

Default:

Firebase anonymous authentication.

Optional protection:

Anonymous identity can be linked to email/password. Existing protected access can be signed in on another device.

Snag also maintains a stable `snagUserId` mapping so Firebase Auth UID is treated as a credential mapping rather than the only permanent business identity.

### Media

Cloudflare R2 through the Snag worker. Media is not stored in Firestore.

### Firebase usage logging

Snag wraps the Firestore module and counts:

- `getDoc`;
- `getDocs`;
- `setDoc`;
- `updateDoc`;
- `deleteDoc`;
- `onSnapshot` listener establishment;
- listener result/change reads.

Coverage status:

**High / near-complete for browser-side Firestore activity.**

This is the preferred instrumentation pattern for apps with significant Firestore use.

### App Monitor

Loaded: **Yes**

Snag already explicitly identified Firebase users to App Monitor before this review.

It now also publishes auth changes through `AppsAuth`, making it consistent with the other apps.

Backend:

The Snag Cloudflare Worker hosts both Firebase Usage and App Monitor endpoints. It now retains central/app UID fields supplied by the shared identity layer.

Device:

Canonical shared device ID.

---

# Implementation status

## Completed 24 September 2026

- [x] Review all repos from Kk-syllabus onward.
- [x] Establish this living review register.
- [x] Identify each app's primary persistence and Firebase project/database.
- [x] Confirm App Monitor coverage.
- [x] Audit Firebase Usage Monitor coverage.
- [x] Create independent shared identity/auth module in `Apps/apps-auth.js`.
- [x] Install shared identity module into all six reviewed apps.
- [x] Standardise App Monitor and Firebase Usage Monitor on one canonical device ID.
- [x] Feed app Firebase identities into the shared layer for Kk-syllabus, Openday, LearnLatin, beyond100 and Snag.
- [x] Keep Comprehension device-only because it currently has no auth.
- [x] Expose consolidated People & devices view in App Monitor.
- [x] Reuse central App Monitor aliases for device/auth/session-to-person assignment.
- [x] Add LearnLatin to Firebase Usage Monitor and instrument its current Firestore sync path.
- [x] Fill the reviewed Beyond100 Firebase-usage instrumentation gaps.
- [x] Correct Kk-syllabus collection-query counts and transaction-read attribution.
- [x] Correct Beyond100 note-query counts.
- [x] Ensure Kk-syllabus is explicitly attributed to `kk-syllabus/(default)` and allow the shared logger to derive Beyond100's project from `BEYOND100_CLOUD`.
- [x] Preserve central/app identity fields in the App Monitor Worker.

## Next platform work

### P0 — verify production

- [ ] Verify GitHub Pages has published the latest shared `Apps` files.
- [ ] Verify the Snag Cloudflare Worker deployment workflow succeeds.
- [ ] Open each of the six live apps once from the same browser and confirm the same canonical device ID appears in App Monitor.
- [ ] Confirm authenticated apps show their Firebase UID after login.
- [ ] Confirm LearnLatin and Beyond100 operations appear in Firebase Usage with project `kk-syllabus`.
- [ ] Confirm Snag continues to appear under project `snag-509418`.

### P1 — central identity service

- [ ] Provision a dedicated minimal Firebase project for Apps identity, e.g. `apps-identity`.
- [ ] Enable desired Authentication providers.
- [ ] Publish only the public Firebase web config to the shared module.
- [ ] Add a small reusable sign-in/account UI component.
- [ ] Store central person/profile metadata separately from app business data.
- [ ] Decide whether central auth is optional identification only or mandatory for selected apps.

### P1 — monitoring quality

- [ ] **Fix App Monitor presence semantics:** distinguish `Active` (visible/foreground and recently reporting), `Background/open tab` (hidden but browser session still exists), and `Inactive` (no recent report). Hidden/page-exit snapshots must not make a session count as active merely by updating `lastSeenAt`. Keep `last seen` separate from activity state; consider distinguishing foreground time from actual engaged interaction time.
- [ ] Add a monitor “identity confidence/source” display: central auth, app auth, manual device alias, manual session alias or unassigned.
- [ ] Add a cross-day person/device history view.
- [ ] Add a “merge/link device” workflow for storage resets or a second browser on the same physical device.
- [ ] Define retention for raw IP, approximate geo and session data.
- [ ] Consider retaining raw IP only briefly and keeping hash/network metadata longer.
- [ ] Add health/coverage indicators showing when an app has loaded App Monitor but has not produced Firebase Usage instrumentation.

### P2 — Firebase accounting

- [ ] Add server-side attribution for Kk-syllabus Cloud Functions/Admin SDK Firestore calls if needed.
- [ ] Compare sampled application-ledger totals with authoritative Google Cloud/Firebase metrics.
- [ ] Document the expected difference between logical app calls and billed Firestore operations.

### P2 — reusable Firebase instrumentation

- [ ] Extract Snag's Firestore wrapper pattern into an optional shared helper for future apps.
- [ ] New Firestore apps should declare app/project/database once and obtain an instrumented Firestore interface rather than manually adding counters around each call.

---

## Suggestions / deferred app work

When an app improvement, fix or architectural suggestion is discussed but **not implemented**, record it as an unchecked TODO in this register (or the relevant app's linked TODO register) so it can be selected and implemented later. Mark it complete only when the implementation has actually been made and verified.

## Platform consolidation roadmap

### P1 — Apps Platform loader and manifest

- [ ] Replace separate shared script tags with one versioned Apps Platform loader.
- [ ] Give every app a small declarative platform manifest containing app ID, repository, current version, enabled capabilities and service configuration.
- [ ] Let the loader lazy-load only the capabilities each app requests, such as identity/auth, App Monitor, Firebase Usage, developer notes and version metadata.
- [ ] Keep app-specific business code outside the shared platform.
- [ ] Pin apps to a compatible platform major version rather than an unversioned mutable shared script.

### P1 — shared UI components

- [ ] Build shared Web Components for account/sign-in UI, developer/review notes, version/build badge and a small diagnostics/platform menu.
- [ ] Use Shadow DOM or otherwise isolated styling so platform UI cannot accidentally inherit or break app CSS.
- [ ] Allow apps to choose automatic placement, an explicit mount point, or no visible UI for each shared capability.

### P1 — developer/review notes

- [ ] Consolidate Openday developer notes, LearnLatin feedback, Beyond100 notes/review feed and Snag notes into one shared notes schema and service.
- [ ] Preserve app-specific labels/anchors, but standardise note fields, statuses, review-feed publishing and implementation-status syncing.
- [ ] Support local-first notes with optional authenticated cloud sync.
- [ ] Move the common notes UI into the shared platform; apps should only declare anchors/labels where useful.

### P1 — Version Lab / release metadata

- [ ] Define one release/version manifest schema for all apps.
- [ ] Generate release metadata from GitHub commits/tags/Actions where possible instead of hand-maintaining multiple version data formats.
- [ ] Move the heavy Version Lab comparison UI to a central Apps-hosted tool that can open any registered app/repository/version.
- [ ] Keep only a lightweight version badge/link inside each app unless an embedded Version Lab is explicitly needed.

### P1 — common Firebase/data adapter

- [ ] Extract Snag's Firestore wrapper pattern into a shared platform Firebase adapter.
- [ ] Apps should request an instrumented Firestore client rather than calling Firebase directly and manually logging usage.
- [ ] Standardise auth-state publication, error handling, retries, database/project identification and Firebase Usage attribution in that adapter.
- [ ] Keep Firestore security rules and app data models app-specific, even when the client adapter is shared.

### P2 — central identity and true cross-app SSO

- [ ] Provision the dedicated Apps identity project already proposed above.
- [ ] Use one shared account UI and identity model across all apps.
- [ ] If a central login must authorise access to separate Firebase projects, implement a secure custom-token/token-broker service rather than sharing app databases.
- [ ] Keep central identity, app authorisation and app business data as separate concerns.

### P2 — additional cross-cutting platform services

- [ ] Add shared client error/crash reporting and diagnostics.
- [ ] Add feature flags / remote platform configuration with safe defaults and per-app overrides.
- [ ] Add a common app-info/debug surface showing app version, platform version, auth state, device ID, Firebase target and monitor health.
- [ ] Standardise offline/update notifications while keeping each app's service worker as an app-local thin shim because service-worker scope cannot be shared across sibling GitHub Pages app paths.
- [ ] Standardise PWA manifest generation from a template while retaining per-app names, icons, colours and shortcuts.

### Platform design rule

Prefer a three-part shared platform:

1. **Client SDK/loader** for identity, telemetry, Firebase adapters and events.
2. **Reusable UI components** for login, notes, version/build information and diagnostics.
3. **Central services/tools** for aggregation, aliases, review feeds and Version Lab.

Do not force every cross-cutting feature into one monolithic imported JavaScript file.

---

# Architecture rules for new apps

1. **App data remains siloed.** Give an app its own Firebase project when isolation/quota/rules justify it.
2. **Identity is shared, authorization is app-specific.**
3. Load `apps-auth.js` before App Monitor.
4. Load App Monitor on every app unless intentionally excluded.
5. If an app uses Firestore, load Firebase Usage Monitor and set explicit app/project/database identifiers.
6. Prefer an instrumented Firestore wrapper over scattered manual counters.
7. Publish app auth state through `AppsAuth.setAppIdentity(user,{app:'AppName'})`.
8. Never use IP address alone to decide that two sessions are the same person/device.
9. Allow manual person/device aliases where deterministic identity is unavailable.
10. Record changes to this file whenever storage/auth/monitoring architecture changes.

---

# Change log

## 24 September 2026

Initial full review and platform alignment.

Apps repository changes include:

- `apps-auth.js`: shared identity/auth adapter.
- `app-monitor.js`: canonical device identity + shared identity bridge.
- `firebase-usage-monitor.js`: canonical device identity.
- `app-monitor.html`: consolidated People & devices view using existing alias backend.

Reviewed app changes include:

- shared identity loader added to all six apps;
- app Firebase-auth bridge added to Kk-syllabus, Openday, LearnLatin, beyond100 and Snag;
- LearnLatin Firebase usage logging added;
- Beyond100 missing usage instrumentation added and query counts corrected;
- Kk-syllabus query/transaction read counts and project attribution corrected;
- Snag App Monitor Worker extended to retain shared/app identity fields.

