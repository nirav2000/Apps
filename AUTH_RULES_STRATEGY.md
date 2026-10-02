# Shared Authentication and Firebase Rules Strategy

_Last updated: 2 October 2026_

## Principle

Authentication identity, application authorization and business data are separate layers.

The shared Auth library answers **who is signed in** and maps that person to the identity an app already uses. It does not make the central identity database readable by every app, and it does not require existing Firestore documents to be re-keyed.

## Layer 1 — central identity project

The dedicated identity project stores:

- global users;
- authentication subject mappings;
- per-app memberships and mapped app UIDs;
- shared auth sessions;
- passkey/recovery credential metadata;
- audit events;
- read-only view contexts.

Browser Firestore access is default-deny. These collections are read/written by the trusted auth service using the Admin SDK. The browser receives a deliberately small projection from the service.

Reference rules: `auth/FIRESTORE_RULES.rules`.

## Layer 2 — app Firebase project

Each app continues to enforce its own authorization in its own Firebase project.

During migration, `request.auth.uid` remains the **existing app Firebase UID**. Central Auth maps:

```
globalUserId
  -> app membership
      -> appUserId
          -> Firebase custom token for that app project
              -> request.auth.uid == existing appUserId
```

This means the first auth migration does not require changes to existing data keys or Firestore rules.

## Current rule families

### kk-syllabus / learning apps

The current rules are strongly owner-oriented and use the existing parent Firebase UID in both document paths and authorization checks.

Do not replace that UID during the first Auth migration.

Migration path:

1. central account runs in shadow;
2. verify/link the existing parent Firebase session;
3. store the current parent UID as the app membership `appUserId`;
4. central broker later mints an app-project custom token using that same UID;
5. only then remove the duplicated legacy sign-in UI;
6. redesign learning authorization separately when the shared learning backend is ready.

The future learning model should authorize relationships such as parent -> learner and teacher -> learner. A `studentId` remains separate from any auth UID.

### Snag

Snag rules use the Firebase UID throughout project ownership, members, participants, updates and private notes.

Do not rewrite owner/member UIDs as part of shared-auth adoption.

Link the current Snag Firebase UID to the central global identity and later broker a token with the same UID. Project-specific roles remain in Snag's project/member documents because they are resource-specific and can differ per project.

### Capability-based access

Openday memorable tokens and Beyond100 controller/review capabilities are authorization capabilities, not human identity.

During migration they may coexist with central auth. Central auth can eventually become the preferred recovery/administration mechanism, but an existing capability is not silently converted into a user role.

## Roles

Use three levels:

1. **global roles** — owner/global-admin; central service only;
2. **app roles** — parent/teacher/viewer etc.; central app membership or coarse token claims;
3. **resource roles** — project member/contractor/class relationship etc.; app data and app rules.

Do not put a large set of resource permissions into Firebase custom claims. Claims are best for small coarse-grained flags and can remain stale until token refresh. Resource-specific permissions belong in the app's own data model/rules.

## Custom claims

Custom claims may be used in an app-project token for small, coarse roles where useful, but they are not the source of truth for mutable resource permissions.

When role changes must take effect immediately, either:

- force token refresh/re-authentication; or
- enforce the mutable membership/resource state in app rules/server logic.

## Shared Data library

The proposed shared Data/Firebase adapter should sit **below app business code and above Firebase**, and receive credentials/session state from Auth.

It should not own user identity.

Conceptually:

```
app UI/business logic
       |
       +--> Auth v1
       |      -> global identity
       |      -> app token/session
       |
       +--> Data SDK
              -> Firestore reads/writes
              -> instrumentation
              -> retries/cache
              -> Firebase Usage Monitor
```

This keeps future Firebase replacement possible without changing the Auth API.

## Rules migration safety

Never combine these in one release:

- change login system;
- change Firebase UID;
- move Firestore paths;
- rewrite roles;
- change Firestore rules.

Make each step additive and testable. A rollback should restore code without requiring reverse data migration.
