# Shared Auth changelog

## 1.0.0 - 2026-09-29

- Introduced the stable ES-module public API under `/auth/v1/index.js`.
- Added a canonical device identifier compatible with App Monitor and Firebase Usage Monitor.
- Added provider-independent identity state, app identity bridging, roles, events and session APIs.
- Added Firebase central-identity adapter methods for anonymous, email/password, email-link, Google and Apple sign-in.
- Added service-facing hooks for sessions, audit history, passkeys and account disable/recovery administration.
- Kept the existing `apps-auth.js?v=1` and `apps-passkey-auth.js` untouched for backwards compatibility.
