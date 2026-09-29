# @our-apps/auth v1

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
