# Shared Auth migration register

_Last updated: 29 September 2026_

## Preservation checkpoints

Permanent `pre-shared-auth` branches were created before shared-auth changes:

| Repository | Production commit preserved |
|---|---|
| Apps | `f19ca0ac1a5e33d67c724d10e3b707d23faf213e` |
| Comprehension | `6cdd9d5955a0fd1ed19bf80a51d0690ea3b6a836` |
| snag | `b599c7b273fad8693ee8320f5464b8971dc590bd` |
| LearnLatin | `3d586a0bbab97985290f0bb16707c4741bdc208f` |
| beyond100 | `b3930843ea04296dbe02c690aa2a435d2e19f360` |
| Next | `76f62776794f399e927c175a88c0babe4ab30323` |
| InClass | `30add77eff2e88fcd9aad88b7375eee9eb9967cb` |
| Openday | `5f8ae882ca126adc3ba7a225b5973d61bb24b856` |

The current GitHub connector does not expose a tag-creation mutation, so the branch + exact SHA is the operative rollback checkpoint. Create a matching immutable release tag before any UID/data migration. No destructive migration is authorised without it.

## Audit summary

### Comprehension
- Local storage only.
- No Firebase auth/data.
- Already loads legacy `apps-auth.js` for device identity.
- Risk: low.
- Plan: first proving ground; initialise v1 SDK in shadow/device-only mode, no login gate, no data move.

### InClass
- Local auth abstraction in `services/auth-service.js`.
- Session model already separates `userId`, `dataOwnerId`, role and children/classes.
- Firebase provider is a future adapter.
- Risk: low-medium.
- Plan: make `InClassAuth` an adapter behind shared Auth; keep preview roles local and clearly non-authoritative.

### LearnLatin
- Direct Firebase Auth against `kk-syllabus`.
- Hard-coded owner UID `2AJSfYdtg5URWHv7HCzpNMmKIlg2`.
- Firestore data lives under owner-UID learner paths.
- Risk: medium-high if UID changes.
- Plan: shared SDK wraps current Firebase session first; preserve owner UID/data path. Later map global parent identity to the legacy app UID and then to a separate learning student profile.

### Next
- Direct Firebase Auth against `kk-syllabus`.
- Hard-coded owner UID and data path.
- Risk: medium-high.
- Plan: same compatibility strategy as LearnLatin; no path rewrite during auth migration.

### beyond100
- Direct Firebase auth in learner-profile and cloud modules.
- Hard-coded owner UID; learner catalogue resolves Sai separately.
- Risk: medium-high.
- Plan: central identity -> parent membership -> existing app UID; retain learnerId as a separate learning-domain ID.

### Openday
- `kk-syllabus` Firebase owner session plus a memorable-token capability.
- Portable token is client-held; derived capability is stored remotely.
- Risk: medium. Replacing it abruptly could strand existing devices.
- Plan: introduce shared identity beside existing token access; later offer account-link migration. Keep token recovery until all active users/devices are migrated.

### Snag
- Dedicated `snag-509418` Firebase project.
- Anonymous auth by default; email/password linking supported.
- Firestore ownership/membership and R2 bearer access depend on the current Firebase UID.
- Has a separate stable Snag account/user ID in addition to Firebase UID.
- Risk: high.
- Plan: migrate last. Preserve existing app UID via mapping/broker. Do not rewrite project owners/memberships in place. First replace direct auth calls with an adapter while keeping the same Firebase user.

### App Monitor
- Mature separate passkey/recovery/session implementation backed by its Cloudflare Worker/R2.
- Security admin surface is deliberately isolated.
- Risk: high if merged too soon.
- Plan: keep operational auth independent until the shared identity service has equivalent passkey, recovery, session revocation and audit coverage. Then migrate through an adapter.

### Firebase Usage Monitor
- Monitoring surface in Apps; authentication/administration should eventually use the same owner/global-admin identity.
- Risk: low if introduced as additive admin auth; do not make telemetry writes depend on interactive login.

## Migration phases

1. **SDK shadow mode**: load shared Auth, publish canonical identity/device/session context, change no authorization.
2. **Legacy adapter mode**: app login UI calls Auth but adapter still uses the app's existing Firebase project and UID.
3. **Central identity link**: map authenticated legacy account to a `globalUserId`; no business-data move.
4. **App membership**: create central app role membership and audit role changes.
5. **Broker/token exchange** where the app needs SSO into a separate Firebase project; preserve legacy `appUserId`.
6. **Rules migration** only after dual-read/compatibility tests prove equivalent access.
7. **Retire legacy login** after a defined observation window; preserve rollback branch/tag.

## Rollback

For each app:
- switch production `main` back to the preserved commit if the new auth layer causes a regression;
- restore the prior script/import and Firebase auth path;
- never delete legacy identity mappings during the initial rollout;
- keep migrations additive and idempotent;
- retain old project data read-only before final retirement.

## Next order

1. Comprehension shadow integration.
2. InClass adapter integration.
3. LearnLatin / Next compatibility adapter.
4. beyond100 learning identity mapping.
5. Openday account-link migration.
6. Snag multi-user migration.
7. App Monitor admin migration only after feature parity.
