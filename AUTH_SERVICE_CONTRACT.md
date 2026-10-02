# Shared Auth Service Contract

The browser SDK is intentionally usable before this service is provisioned. Methods requiring server trust fail closed until `serviceBaseUrl` is configured.

## Hosting

Preferred first implementation: **Firebase/Google Cloud Functions in a dedicated `apps-identity` project** using Firebase Admin SDK.

Reasons:
- Firebase ID-token verification and custom-token minting stay next to Google IAM.
- no Google service-account private key needs to be copied into GitHub Pages or a Cloudflare Worker;
- Firestore identity metadata can be server-only;
- Firebase Auth handles refresh tokens and normal browser persistence.

Cloudflare may proxy/rate-limit later, but it should not become the holder of a long-lived Google service-account JSON key.

## Browser authentication

The client sends a central Firebase ID token:

`Authorization: Bearer <firebase-id-token>`

Also:
- `X-Apps-App: <appId>`
- `X-Apps-Device: <canonical-device-id>`

The server validates both strings against allowlists/format rules. Never trust a requested role, globalUserId or appUserId supplied by the browser.

## Endpoints

### GET /v1/me
Returns the minimum identity projection:

```json
{
  "user": {
    "globalUserId": "usr_...",
    "displayName": "…",
    "email": "…",
    "isAnonymous": false
  },
  "membership": {
    "appId": "learnlatin",
    "appUserId": "legacy-firebase-uid",
    "roles": ["parent"],
    "status": "active"
  },
  "permissions": {
    "globalRoles": [],
    "appRoles": ["parent"]
  },
  "session": {
    "id": "ses_...",
    "deviceId": "d-...",
    "createdAt": "...",
    "lastSeenAt": "...",
    "expiresAt": "..."
  }
}
```

On first valid central Firebase login, atomically resolve/create:
`authSubject -> globalUserId`, then resolve app membership.

The membership projection must carry the mapped legacy/per-app `appUserId` where one exists. The browser SDK uses that mapping only to detect whether a simultaneously restored legacy Firebase session is the expected one; the browser cannot choose or overwrite the mapping itself.

### GET /v1/sessions
Lists sessions belonging to the current global user. Global admins may query another user only through an explicitly audited admin endpoint.

### DELETE /v1/sessions/{sessionId}
Revokes the shared auth session. Server checks ownership or global-admin authority.

### POST /v1/account/disable
Self-disable flow where supported. Administrative disable is a separate privileged endpoint.

### GET /v1/audit
Returns the current user's relevant authentication/security history. Admin audit access is separately permissioned.

## Passkey ceremony

The final service should expose four concrete WebAuthn endpoints, even if the SDK later wraps them into higher-level calls:

- `POST /v1/passkeys/register/options`
- `POST /v1/passkeys/register/verify`
- `POST /v1/passkeys/authenticate/options`
- `POST /v1/passkeys/authenticate/verify`

Registration requires an already authenticated account (or a tightly controlled first-owner bootstrap). Authentication verification resolves the passkey credential to `globalUserId`, then mints a Firebase custom token for that user's central auth subject. The browser signs into Firebase with that custom token and resumes normal Firebase persistence/refresh.

Store:
- credential ID;
- public key;
- sign counter;
- transports;
- backed-up/device metadata;
- label;
- created/last-used/revoked timestamps.

Never store passkey private key material.

Challenges:
- cryptographically random;
- single use;
- short expiry (around five minutes);
- bound to purpose and, for registration, authenticated user/session.

## Legacy identity linking

For apps that already have Firebase users/data keyed by an existing UID, add:

`POST /v1/apps/{appId}/link-legacy`

The request is authenticated twice:

1. the normal central Firebase bearer token identifies `globalUserId`;
2. the body contains a **fresh app-project Firebase ID token** from the currently signed-in legacy app session.

The server must verify the app token against the expected Firebase project for `appId`, then atomically create the mapping:

```
apps/{appId}/members/{globalUserId}
  appUserId: <verified legacy uid>
  linkedAt
  linkMethod: "verified-app-token"
```

Rules:

- never accept an `appUserId` string supplied by the browser without verifying the app-project ID token;
- refuse linking if that app UID is already mapped to a different global user;
- refuse replacing an existing mapping without an explicit audited recovery/admin process;
- require recent central authentication for sensitive link/relink operations;
- audit success and failure.

This handshake is the key migration mechanism for UID-coupled apps such as Snag and the current learning apps. It lets the central account adopt the **existing** per-app UID without moving business documents.

## Stale legacy session handling

During shadow migration, an app may restore both a central account and an old app Firebase session.

- mapped app UID == restored legacy UID: `linked`; normal operation can continue;
- mapped app UID != restored legacy UID: `mismatch`; block cloud writes and privileged operations until resolved;
- both identities exist but no mapping yet: `dual-unverified`; legacy may remain authoritative only during the explicit shadow phase;
- central-only or legacy-only are valid transitional states.

The client should not silently sign out or overwrite either account on a mismatch. Present the mismatch and let the user switch/sign out the stale app session or complete the verified legacy-link flow.

## App token broker

For a legacy/dedicated Firebase app that must keep its current app UID:

`POST /v1/apps/{appId}/token`

Server:
1. verifies central identity;
2. verifies membership/role;
3. resolves the stored `appUserId`;
4. mints a **custom token for that app's Firebase project** using a backend identity permitted to mint for that project;
5. audits the exchange.

This is introduced only for apps that need it. It is not required for Comprehension shadow mode.

The central user ID and app Firebase UID remain separate.

## Admin endpoints

All require `owner` or `global-admin`, recent authentication for sensitive actions, and an audit record.

- search users;
- inspect memberships;
- set/revoke app roles;
- disable/enable account;
- list/revoke sessions;
- list credential/passkey status;
- initiate recovery;
- inspect audit events;
- create short-lived read-only view context.

## View as user

`POST /v1/admin/view-contexts`

Input: target globalUserId, appId, reason.

Output: signed short-lived token with:
- actor globalUserId;
- target globalUserId;
- appId;
- `mode: "read-only"`;
- issued/expiry;
- unique audit/context ID.

The target user's credentials are never exposed and the administrator is never signed in as the target. Writes presented with a view-context token must be rejected server-side/rules-side.

## Recovery

Recovery tokens must be high entropy and shown only at creation/rotation. Store a slow-KDF verifier/hash, never plaintext. A recovery event should revoke or rotate affected sessions/credentials and emit a high-priority audit event.

Email recovery can use Firebase Auth's standard email mechanisms for email-owned accounts. Recovery of an anonymous-only account requires an already linked credential, recovery token, or owner-mediated audited process.

## Rate limits

At minimum rate-limit:
- password/email-link requests;
- WebAuthn option/verify endpoints;
- recovery;
- admin search and mutation;
- token broker exchanges.

Use IP only as one abuse signal, not identity.

## Session writes

Do not heartbeat Firestore on every page view. Touch `lastSeenAt` only when:
- signing in/exchanging a token;
- returning to foreground after a substantial gap;
- doing a privileged action;
- a 15-minute throttle window has elapsed.

App Monitor remains responsible for higher-frequency foreground/background telemetry.
