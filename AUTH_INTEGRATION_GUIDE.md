# Shared Auth Integration Guide

## Mandatory pre-app test

Before installing Auth v1 into a real application, test the current v1 line in:

`https://nirav2000.github.io/Apps/auth/lab.html`

The Auth Lab defaults to disposable mock identity/service adapters and therefore writes no Firebase data. It exercises the same Auth API and shared account UI used by consumers.

Acceptance checks before Comprehension:

- guest/anonymous sign-in;
- anonymous -> protected account without changing identity;
- email/password create/sign-in/recovery;
- email-link request;
- Google/Apple provider UI;
- passkey register, sign-out and passkey sign-in in mock mode;
- session listing/revocation;
- audit history;
- legacy identity appearance/disappearance;
- legacy role clearing;
- linked UID state;
- stale/wrong legacy UID -> mismatch/blocking state;
- App Monitor identity transition.

After a dedicated test identity Firebase project/service exists, repeat the same lab against that backend before a real app migration.

# Shared Auth Integration Guide

## New app

Use the stable API and keep Firebase Auth calls out of app business code.

For new work, prefer Apps Platform `auth` or import Auth v1 directly. Do not use the older `apps-auth.js` / `apps-account.js` as the public application API.

```html
<script type="importmap">
{
  "imports": {
    "@our-apps/auth": "https://nirav2000.github.io/Apps/auth/v1/index.js"
  }
}
</script>
<script type="module">
  import { Auth } from "@our-apps/auth";

  await Auth.init({
    appId: "my-app",
    mode: "shadow"
  });

  Auth.onUserChanged(({ user }) => {
    console.log("identity changed", user);
  });
</script>
```

Start with `shadow`. When the central identity project/service is provisioned, add its public Firebase web configuration and service URL. Move authorization only after the app's membership/rules migration is tested.

## Existing Firebase app

First create and retain:
- `pre-shared-auth` branch;
- immutable production tag;
- exact production SHA in `AUTH_MIGRATION.md`.

Then wrap existing auth as an `appAdapter`. Do not migrate data paths or UIDs in the same release.

## Adding an auth method

Implement it behind the shared SDK/service. The app should only call a stable SDK method. Do not teach each app how WebAuthn/Firebase provider linking works.

Provider policy belongs in central app configuration, e.g.:

```json
{
  "anonymous": true,
  "emailPassword": false,
  "emailLink": true,
  "google": false,
  "apple": false,
  "passkey": true
}
```

## Adding an app role

No core SDK change is required. Create the role in the app's membership policy/admin UI and enforce it in that app's server/rules layer. The SDK simply exposes the returned role string through `hasRole`.

## Styling

Authentication UI should be a separate reusable web component in a later v1 minor release. Apps may supply CSS custom properties/theme tokens, but should not copy the login logic.

## Backend replacement

Consumers depend on Auth, not Firebase. To replace the backend:
1. implement the same service contract;
2. supply a new SDK adapter internally;
3. retain `globalUserId`;
4. preserve auth-subject mappings;
5. roll out as a v1 minor only if public behavior is compatible; otherwise release v2;
6. migrate one app at a time.

## Rollback

If a migration causes regression, restore the production commit recorded in `AUTH_MIGRATION.md`. Because early phases do not rename/delete legacy data or identities, rollback is code-only.


## Existing authentication that becomes stale

Do not simply leave two independent sessions running indefinitely.

During shadow migration:

1. keep the old app session as the data authority;
2. sign into/create the central shared account;
3. call `Auth.linkLegacyIdentity()` only after the legacy adapter can supply a fresh app-project ID token;
4. confirm Auth reports `migration.consistency === "linked"`;
5. only then change authority to central and introduce the app token broker;
6. when a restored legacy UID differs from the mapped UID, treat it as `mismatch` and block writes/privileged actions;
7. retire the old login UI only after regression tests and an observation window.

The mapping is retained even after the old login UI is retired because it is the stable bridge to existing data/rules.

## Rules

See `AUTH_RULES_STRATEGY.md`.

The first Auth migration should generally make **no Firestore rules change** in UID-coupled apps. The broker should reproduce the same app UID so existing `request.auth.uid` rules continue to work.
