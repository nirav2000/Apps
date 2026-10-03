# @our-apps/auth v1

Current compatible line: **1.2.x**  
Immutable release: `auth/releases/1.2.0/`

## Test first

Use `auth/lab.html` before installing Auth into a real app. The lab defaults to mock adapters using the real Auth API/UI and makes no Firebase writes.

## GitHub Pages integration

No build step is required:

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
</script>
```

`shadow` mode observes/normalises identity without gating the app. Use this first for migrations.

## Central identity configuration

When the dedicated identity project exists:

```js
await Auth.init({
  appId: "learnlatin",
  identity: {
    firebaseConfig: {
      apiKey: "...",
      authDomain: "apps-identity.firebaseapp.com",
      projectId: "apps-identity",
      appId: "..."
    },
    serviceBaseUrl: "https://<auth-service>"
  }
});
```

Firebase web configuration is public configuration. Never place service-account credentials, private keys or recovery secrets here.

## Legacy adapter

Existing apps can keep their present Firebase UID/session during migration:

```js
await Auth.init({
  appId: "learnlatin",
  appAdapter: {
    async init({ setAppIdentity }) {
      // initialise the existing app Firebase auth
      // setAppIdentity(existingAuth.currentUser, { roles: ["parent"] })
      return { user: existingAuth.currentUser, roles: ["parent"] };
    },
    onChange(handler) {
      // existing onAuthStateChanged(user => handler(user, ["parent"]))
    },
    async logout() {
      // existing Firebase signOut
    }
  }
});
```

That lets UI code depend on Auth while storage/rules remain unchanged.

## API

- `Auth.init({ appId, mode, identity, serviceBaseUrl, appAdapter })`
- `Auth.getCurrentUser()`
- `Auth.requireAuth()` / `Auth.requireUser()`
- `Auth.hasRole(role)`
- `Auth.getRoles()`
- `Auth.signInAnonymous()`
- `Auth.signInEmail(email, password)`
- `Auth.upgradeAnonymousWithEmailPassword(email, password)`
- `Auth.sendEmailLink(email, settings)`
- `Auth.completeEmailLink(url, email)`
- `Auth.signInGoogle()`
- `Auth.signInApple()`
- `Auth.logout()`
- `Auth.listSessions()`
- `Auth.revokeSession(id)`
- `Auth.registerPasskey(label)`
- `Auth.signInWithPasskey(payload)`
- `Auth.getAuditHistory()`
- event subscriptions: `onSignedIn`, `onSignedOut`, `onUserChanged`, `onPermissionChanged`, `onChange`

Passkeys/session/audit methods require the central auth service. They intentionally fail closed when it is not configured.

## Roles

The SDK treats roles as opaque strings. App-specific meanings stay in the app. Do not add `teacher`, `contractor` or other business logic to this package.

## Future npm package

If package publishing becomes useful, publish this same API as `@our-apps/auth` and keep the GitHub-hosted module as the zero-build distribution. Consuming apps should not import Firebase directly for new auth code.


## Migration state

`Auth.snapshot().migration` reports:

- `legacy-only`
- `central-only`
- `linked`
- `dual-unverified`
- `mismatch`

`mismatch` blocks `requireAuth()` and should block app writes/privileged operations.

Use `Auth.linkLegacyIdentity()` to verify and store the mapping from a central account to the app's existing Firebase UID. A production legacy adapter must provide `getIdToken()`; the browser never supplies an unverified UID as the mapping source.

## Replaceable adapters

`Auth.init()` may receive:

- `identityProvider` — central sign-in provider; production defaults to Firebase Authentication.
- `serviceAdapter` — shared identity/session/passkey/audit service; production defaults to HTTP `serviceBaseUrl`.
- `appAdapter` — temporary existing-app authentication adapter during migration.

These seams allow safe testing and future backend changes without changing application business code.


## UI variants

The reusable `<apps-auth-panel>` supports experience variants without changing authentication logic:

- `balanced`
- `passkey-first`
- `magic-link`
- `guest-first`
- `compact`

Example:

```html
<apps-auth-panel
  variant="passkey-first"
  methods="anonymous,passkey,emailLink,emailPassword,google,apple">
</apps-auth-panel>
```

Use the Auth Lab carousel to compare the variants in isolation, as a modal, and inside a simulated real app before selecting one for a consumer app.
