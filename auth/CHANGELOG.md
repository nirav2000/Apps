# Shared Auth changelog

## 1.3.0 - 2026-10-03

- Added reusable visual themes independent of authentication flow variants: Airy, Glass, Warm, Midnight and Playful.
- Added a theme picker inside the existing Shared account UI card only; the rest of Authentication Lab remains unchanged.
- Theme choice now carries into the live component, modal preview and realistic in-app preview.
- Added themed miniature carousel cards so visual character is apparent before opening the full preview.
- Replaced placeholder Google/Apple/passkey marks with inline polished provider icons, including the preserved Classic variant.
- Hardened carousel controls and cache-busted Auth Lab CSS/JS so HTML, styles and interaction code update together.
- Published immutable `auth/releases/1.3.0/` SDK/UI files.

## 1.2.1 - 2026-10-03

- Restored the original Authentication Lab layout and all technical test sections after the experience-studio redesign changed too much of the page.
- Scoped design experimentation to the existing Shared account UI card only.
- Added a small swipeable design carousel inside that card, plus modal and realistic in-app previews.
- Preserved the original Shared account UI as the `classic` variant and restored it as the default for backwards compatibility.
- Retained Balanced, Passkey first, Magic link, Guest first and Compact as optional variants.
- Published immutable `auth/releases/1.2.1/` SDK/UI files.

## 1.2.0 - 2026-10-03

- Reworked Auth Lab into an experience-first design studio rather than a developer page with an embedded login form.
- Added a swipeable / arrow-navigable authentication carousel with five genuinely different concepts: Balanced, Passkey first, Magic link, Guest first and Compact.
- Added click-to-front concept selection, persistent preferred-design selection and responsive mobile/iPad carousel behaviour.
- Added live functional modal previews and a simulated real-app shell so each design can be judged in context rather than only as a component on a page.
- Extended the reusable `<apps-auth-panel>` itself with `variant` support so chosen designs can move into real apps without rebuilding authentication logic.
- Kept all variants on the same Auth API and mock/real backend adapters; this is presentation/flow variation, not duplicated authentication implementations.
- Moved SDK/migration/session/audit controls into a collapsible technical section so visual/product testing is the primary experience.
- Published immutable `auth/releases/1.2.0/` SDK/UI files.

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
