# Shared Auth changelog

## 1.1.1 - 2026-10-02

- Corrected event semantics when linking a legacy identity so linking does not masquerade as a new sign-in.
- Avoided duplicate central-user processing when a service-adapter passkey flow has already updated its identity provider.
- Kept immutable 1.1.0 unchanged and published a separate 1.1.1 patch release.

## 1.1.0 - 2026-10-02

- Added standalone `auth/lab.html` proving-ground UI before any real app migration.
- Added pluggable identity-provider and service-adapter seams; Firebase remains the default production provider, while the lab uses a no-cloud mock provider through the same API.
- Added explicit migration authority and consistency states: legacy-only, central-only, linked, dual-unverified and mismatch.
- Added stale/wrong legacy-session blocking semantics for privileged operations.
- Separated central app roles from legacy app roles and fixed stale legacy-role retention after sign-out.
- Added `linkLegacyIdentity()` for verified global-user -> existing app-UID mapping.
- Added account creation, password recovery, provider linking and expanded shared account UI.
- Added App Monitor compatibility for Auth v1 identity/session/migration metadata and load-order-independent identity discovery.
- Added Apps Platform `auth` capability while retaining legacy `identity` and `account` compatibility modules.
- Added Firebase rules strategy documenting central default-deny identity storage and preservation of existing per-app UIDs/rules during migration.
- Returned Comprehension to its pre-Auth-v1 state so Auth Lab is the first proving ground.
- Published immutable `auth/releases/1.1.0/` SDK/UI files.

## 1.0.0 - 2026-09-29

- Introduced the stable ES-module public API under `/auth/v1/index.js`.
- Added a canonical device identifier compatible with App Monitor and Firebase Usage Monitor.
- Added provider-independent identity state, app identity bridging, roles, events and session APIs.
- Added Firebase central-identity adapter methods for anonymous, email/password, email-link, Google and Apple sign-in.
- Added service-facing hooks for sessions, audit history, passkeys and account disable/recovery administration.
- Kept the existing `apps-auth.js?v=1` and `apps-passkey-auth.js` untouched for backwards compatibility.
