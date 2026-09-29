# Shared Auth Integration Guide

## New app

Use the stable API and keep Firebase Auth calls out of app business code.

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
