# Shared Authentication Architecture

_Last updated: 2 October 2026_

## Decision

Use a **frontend SDK + central identity service + per-app authorization adapters**.

The frontend SDK is versioned and served from this repository. It exposes a stable public API and deliberately hides Firebase details from consuming apps. A future npm package can export the same source, but GitHub Pages apps can use the ES module directly today.

The central identity service should run in a dedicated Firebase/Google Cloud project such as `apps-identity`. Firebase Authentication provides the durable browser sign-in/session primitive. A server component owns global identity mapping, passkeys, session inventory/revocation, audit history and app membership. Cloudflare remains suitable for monitoring and edge APIs, but the authentication broker should avoid long-lived Google service-account private keys in a Worker.

## Identity model

Never assume these identifiers are the same:

- `globalUserId`: stable person/account identity owned by the shared auth platform.
- `authSubjectId`: UID in the central authentication provider.
- `appUserId`: UID used by a specific app's Firebase project or legacy datastore.
- `studentId` / `learnerId`: domain identity in the learning platform.
- `deviceId`: browser-installation identifier, not proof of a person.
- `sessionId`: one authenticated browser/session record.

The mapping lets us change authentication providers or Firebase projects without renaming business records.

## Recommended central data

Server-owned identity project:

```
users/{globalUserId}
  status
  displayName
  createdAt
  updatedAt
  globalRoles[]            # e.g. owner/global-admin
  primaryAuthSubjectId

authSubjects/{providerHash}
  globalUserId
  provider                 # firebase, passkey, google, apple...
  subjectId
  createdAt

apps/{appId}
  name
  status
  authPolicy

apps/{appId}/members/{globalUserId}
  roles[]
  status
  appUserId                # optional legacy/local Firebase UID mapping
  permissionVersion
  createdAt
  updatedAt

sessions/{sessionId}
  globalUserId
  deviceId
  createdAt
  lastSeenAt
  expiresAt
  revokedAt
  authMethod
  userAgentSummary
  appIdsSeen[]

credentials/{credentialId}
  globalUserId
  type                     # passkey/recovery/etc.
  public metadata only     # no raw private key or plaintext recovery secret
  status
  createdAt
  lastUsedAt

audit/{eventId}
  actorGlobalUserId
  targetGlobalUserId
  appId
  sessionId
  action
  outcome
  createdAt
  metadata
```

Sensitive collections should be server-only. Apps should receive only the minimum session/user/membership view they need.

## Per-app data

App business data stays in the app's own project/store. The central identity service should not become a shared business database.

For a migrated Firebase app, the broker maps `globalUserId -> appUserId`. Existing UIDs can be preserved. New apps may use generated app-specific UIDs so one app cannot infer another app's data key.

Authorization is app-local. A central global admin role does not automatically grant a browser direct read access to every app database.

## Authentication methods

The SDK treats methods as providers/adapters.

1. Firebase anonymous sign-in for low-friction starts.
2. Anonymous -> email/password account linking without losing the central auth subject.
3. Email link/passwordless.
4. Google and Apple as optional providers.
5. Passkeys verified by the server using WebAuthn.
6. Recovery credentials stored only as hashes/derived values server-side.

Methods can be enabled per app without changing the SDK contract.

## Passkeys

Passkeys require a server because WebAuthn challenges, credential public keys, counters and origin/RP checks must be verified outside the browser.

After successful verification, the server should mint a central Firebase custom token for the mapped auth subject. The browser then uses normal Firebase token refresh. Passkey private keys never leave the authenticator.

## Sessions

Firebase login state and app activity are different concepts.

- Firebase token/session: proves authentication.
- Shared auth session record: lets the owner list/revoke devices and records security context.
- App Monitor session/activity: observes app/browser use, foreground/background state and automated traffic.

Presence must not write continuously to Firestore. Update auth session `lastSeenAt` on meaningful events (sign-in, token exchange, foreground after a long gap, privileged action) with throttling, e.g. no more than every 15 minutes. App Monitor can keep its separate low-cost activity telemetry.

Revocation should block new broker exchanges immediately; already-issued Firebase app tokens may remain valid until their short expiry. Sensitive apps can require a fresh broker check before privileged operations.

## Authorization

Global roles belong to identity administration only: `owner`, `global-admin`, potentially `support`.

App roles are namespaced by app and defined by that app: `teacher`, `parent`, `student`, `contractor`, `viewer`, etc. The core library treats them as strings and never embeds app-specific business meaning.

Use `Auth.hasRole('teacher')` only after `Auth.init({appId})` resolves the current app membership.

## Education mapping

Do not make `studentId === Firebase UID` or `studentId === globalUserId`.

A child/person in the learning platform is a domain entity. A parent can be linked to several children; a teacher to many learners; a learner may later receive their own login. Recommended relationship:

```
globalUserId
  -> learning memberships / relationships
      -> studentId
          -> courses, progress, attempts, evidence
```

This keeps authentication independent from the learning backend and supports guardian/teacher relationships cleanly.

## Read-only view-as-user

Implement impersonation as an explicit **view context**, not by logging in as the target user.

A global admin requests a short-lived signed view token containing actor, target, app, purpose and expiry. App APIs/rules treat it as read-only and every access is audited. Never mint a normal mutable target-user session for an administrator.

## Security

- No service-account keys or recovery secrets in GitHub Pages code.
- Firebase web config is public configuration, not a secret; authorization remains in rules/server checks.
- Use strict Firestore rules and default-deny collections.
- Validate appId/role changes server-side.
- Keep WebAuthn challenges single-use and short-lived.
- Hash recovery tokens with a slow password KDF where appropriate; never store plaintext.
- Rate-limit sign-in, passkey, recovery and admin endpoints.
- CSP, output escaping and dependency pinning are essential because XSS can steal bearer tokens from a browser app.
- Prefer Authorization headers to cross-site cookies for GitHub Pages to avoid third-party-cookie assumptions. If cookies are later used, add SameSite/Secure and CSRF protection.
- Session/device metadata should be coarse; do not fingerprint hardware.
- Audit all admin changes, recovery, role changes, view-as-user, credential/session revocation and failed privileged attempts.

## Public API

```js
import { Auth } from "https://nirav2000.github.io/Apps/auth/v1/index.js";

await Auth.init({ appId: "learnlatin" });

const user = Auth.getCurrentUser();
const required = Auth.requireUser();

if (Auth.hasRole("teacher")) {
  // app-specific behaviour
}

Auth.onSignedIn(({ user }) => {});
Auth.onSignedOut(() => {});
Auth.onUserChanged(() => {});
Auth.onPermissionChanged(() => {});

await Auth.logout();
await Auth.listSessions();
await Auth.revokeSession(sessionId);
```

Apps may use an import map so the conceptual import becomes `@our-apps/auth` without a build step.

## Versioning

- Semantic versioning.
- Stable URLs: `/auth/v1/index.js`; later incompatible versions use `/auth/v2/`.
- Patch/minor releases in v1 must preserve the v1 public contract.
- Apps may pin an exact immutable release path when introduced, or pin major v1 for staged rollout.
- Existing `apps-auth.js?v=1` remains a compatibility surface until every consumer has migrated.
- Never silently replace a major API for all apps.


## October 2026 consolidation

The portfolio now has several overlapping historical modules:

- `apps-auth.js` — canonical device identity and old app-user bridge;
- `apps-account.js` — Firebase account operations bound to an app Firebase instance;
- `apps-passkey-auth.js` — App Monitor's existing administrator WebAuthn client;
- `auth/v1/index.js` — the canonical shared authentication API.

The target is **not** to delete the first three immediately. They are compatibility/migration adapters until each consumer reaches Auth v1.

New application business code should depend on Auth v1 (directly or through Apps Platform's `auth` capability), never on Firebase Auth or these legacy globals.

## Provider and service adapters

Auth v1.1 separates two replaceable pieces:

**Identity provider**
: proves/authenticates the central user. Firebase Authentication is the default production provider.

**Auth service**
: maps global identity to app membership, verifies legacy links, manages shared sessions/passkeys/audit and brokers app-project Firebase tokens.

The standalone Auth Lab uses in-browser mock adapters through these same interfaces. That means its UI/API tests are representative without writing to a production backend.

## Migration authority

An app migration explicitly declares which identity is authoritative:

- `shadow / legacy` — existing app auth controls data access while central identity is observed/linked;
- `linked / central` — shared auth controls the login experience after the app UID mapping is verified.

A central/legacy UID mismatch is a blocking condition for writes/privileged actions.

See `AUTH_MIGRATION.md` and `AUTH_RULES_STRATEGY.md`.

## Shared platform

Apps Platform v1.1 exposes `auth` as the canonical capability. The older `identity` and `account` capabilities remain available only for compatibility during migration.

## Proving ground

`auth/lab.html` is the first proving ground.

Comprehension is deliberately **not** an Auth v1 consumer at this point. It retains only the older canonical-device identity bridge until the Auth Lab is accepted and a dedicated central identity backend is provisioned/tested.
