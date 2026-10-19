# Shared Learning Sync v1.0.1

**Status:** Implemented shared capability, opt-in. **Not automatically installed into any consumer app.** Apps Auth (`apps-auth.js`) is **legacy**; use `Auth` (`auth/v1/index.js`) for all new sign-in integrations.

## Responsibilities
- Keep completed learning evidence locally and queue immutable chunks for later cloud upload.
- Partition every local ledger by `appId/accountId/learnerId`.
- Use stable device/chunk IDs so retrying uploads cannot duplicate rounds.
- Rebuild concept summaries from merged, timestamp-ordered evidence.
- Require explicit approval to copy guest learning into a signed-in account. Guest originals remain.
- Block Firebase cloud access unless Auth and Firestore use the same Firebase project and the current Firebase UID equals the requested account.
- Require Firestore security rules for owner-scoped reads/writes.

## Usage

```js
const {LearningSync}=await import('https://nirav2000.github.io/Apps/learning-sync/v1/index.js');
const sync=LearningSync.create({appId:'dol',learnerId:'learner-1',accountId:'guest',
  onSnapshot(state,accountId){ /* reload the active learner's learning store */ }
});
sync.capture(learningStore.getState()); // call after completed round
// After sign-in, only if the app has a matching authenticated Firestore project:
const transport=LearningSync.firestore({db,auth,sdk:firestoreModularSDK});
// Pass transport when creating the service; accountId MUST equal auth.currentUser.uid.
// sync.switchAccount(auth.currentUser.uid);
// await sync.sync();
// sync.importGuest({approved:true}); // only after an explicit confirmation
```

App Platform v1.7: set `capabilities.learningSync=true` in an app's manifest to make the service available. It does not automatically start syncing or modify an app's storage.

## Cloud storage and security
The Firestore transport uses `learningSyncApps/{appId}/users/{uid}/learners/{learnerId}/chunks/{chunkId}`. **Deploy** the rules in `firestore.rules` into the selected Firebase project's existing ruleset after merging with its other rules. Never replace an existing production ruleset wholesale. This library does not deploy Firebase projects, enable sign-in providers, or provide credentials.

## Integration gates before Dol production login
1. Choose the Firebase project and verify Auth and Firestore use the same project, including security rules.
2. Integrate canonical Auth and test sign-in/out, anonymous upgrade, and wrong-account handling.
3. Introduce explicit learner selection and per-account stores for all Dol data (learning, insights, strategy, number history, preferences where relevant).
4. Migrate existing `apps-learning-v1:dol:local` data by explicit consent and one-time backup; do not silently claim shared-browser progress.
5. Define a cloud deletion/reset tombstone before enabling remote sync, so resetting a learning record cannot resurrect deleted evidence.
6. Exercise two-device offline writes, retry, switching users, imports, child-data privacy, and mobile Safari/Chromium/WebKit layouts.
7. Test Firestore security rules with the emulator; never treat client-side UID checks as authorization.

## Known v1 constraints
- Immutable chunks are retrieved as a full collection; implement pagination/checkpoints before very large learner histories.
- SDK evidence is capped at 2,500 events/500 sessions; capture frequently (at least once per round), and reject an ambiguous replaced history instead of uploading duplicates.
- This is a reusable foundation, **not** a claim of production-ready account migration or remote deletion.
- Only explicit app integrations should activate this capability; shared-library releases must never auto-modify consumers.

Tests: `node --test tests/learning.test.mjs tests/learning-sync.test.mjs`.

## Collision-safe synchronisation (v1.0.1)
Cloud chunks are compared canonically, not using JavaScript property insertion order. Before uploading, sync reads remote immutable chunks, preserves remote entries, and deterministically re-IDs a genuinely conflicting local chunk without discarding either history. Uploads use Firestore transactions and never overwrite a different cloud chunk. Races are retried after another read; offline failures leave the local pending queue intact. Existing local data is not erased by this upgrade.
