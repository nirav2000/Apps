# Passkey Authentication Framework

_Last updated: 24 September 2026_

This is the reusable authentication pattern for private/admin areas across the Apps portfolio. App Monitor is the first reference implementation.

## Goals

- Passkey-first sign-in with user verification.
- No permanent plaintext admin secret in GitHub source.
- No "first visitor becomes administrator" bootstrap.
- Short-lived, server-side revocable sessions.
- Recovery credential stored only as a server-side hash.
- Multiple passkeys, individually revocable.
- Five consecutive failed authentication attempts clear only the app's cached admin/session data.
- Password-manager-friendly recovery forms.
- Shared client implementation through `apps-passkey-auth.js`.

## Components

### Browser client

Shared module:

`https://nirav2000.github.io/Apps/apps-passkey-auth.js?v=1`

Responsibilities:

- WebAuthn request/response encoding.
- passkey login;
- first-use setup request;
- approved first-passkey registration;
- session persistence/validation;
- recovery login;
- adding additional passkeys;
- recovery rotation;
- passkey/session revocation;
- failed-authentication counting.

Apps should configure a unique local-storage namespace even when using the same shared module.

### Authentication backend

The current reference backend is the Cloudflare Worker in:

`nirav2000/snag/cloudflare-worker.js`

For another app, either reuse the same Worker with an app-specific auth namespace or implement the same API contract in that app's backend.

Private state belongs in server-side storage (currently Cloudflare R2), not GitHub Pages.

## First-use / bootstrap flow

A public "register the first passkey" button is **not sufficient**. Whoever visits first could otherwise become the administrator.

The framework uses an out-of-band owner approval:

1. Browser asks the Worker to create one random, 30-minute setup request.
2. The Worker allows only one active setup request.
3. Browser shows the request ID.
4. Owner opens the authenticated GitHub Actions workflow.
5. Owner manually runs the workflow with that exact request ID.
6. GitHub Actions writes an approval record to private R2 using Cloudflare credentials held as GitHub secrets.
7. Browser asks the Worker to verify approval.
8. Only an approved, unexpired, current request may start WebAuthn registration.
9. WebAuthn requires user verification.
10. Worker stores the new passkey public key.
11. Bootstrap becomes unavailable as soon as a passkey exists.
12. The approval is consumed/deleted.
13. Any migrated/old recovery credential is invalidated.
14. Worker returns a normal short-lived admin session.

This means an attacker who merely discovers the public page cannot take ownership. They would also need control of the authenticated GitHub repository workflow or the Cloudflare account.

## Normal passkey sign-in

1. Browser requests a random authentication challenge.
2. Worker returns challenge + allowed credentials.
3. Browser invokes WebAuthn.
4. Authenticator requires user verification.
5. Authenticator signs the challenge with the private passkey.
6. Worker verifies the signature using the stored public key.
7. Worker issues a random 12-hour session token.
8. Browser stores the temporary session token.
9. Each protected request is checked against the server-side session record.
10. Revoking or expiring the server session invalidates the cached browser token.

The passkey private key is never sent to the Worker.

## Recovery

Recovery is a fallback, not the normal login method.

- Generate a long random recovery token in the browser.
- Present it in a normal password-manager-compatible form.
- The user saves the plaintext in Bitwarden or another password manager.
- Browser sends the token over HTTPS only when setting or using recovery.
- Worker stores only its SHA-256 hash in private server-side storage.
- Rotating recovery immediately invalidates the old token.
- Never put the plaintext token or its hash in source control.

A password-manager extension cannot safely be forced to open by arbitrary website JavaScript. Use correct `username`, `current-password`, and `new-password` fields and a genuine user submission so the password manager can offer its normal save/update UI.

## Sessions

Reference policy:

- Session lifetime: 12 hours.
- Session token: random high-entropy bearer token.
- Server stores a hashed/session record.
- Sessions are individually visible and revocable.
- Sign-out deletes the server session and browser copy.
- A revoked cached token is useless on the next request.

Apps with higher-risk administration can use a shorter lifetime.

## Failed authentication

Reference policy:

- Count consecutive server-rejected authentication attempts.
- Reset the count after successful authentication.
- At five failures, clear the app's cached admin credentials/session state.
- Do **not** clear unrelated application data, canonical device identity, or other apps' local storage.
- Cancelling a Face ID/Touch ID/passkey prompt is not automatically considered a malicious failed authentication unless the server actually rejects a credential.

Server-side rate limiting can be added separately if an endpoint becomes exposed to meaningful brute-force traffic.

## Passkey storage and compromise

A passkey consists of a private/public key pair.

The server holds the **public key**. Possession of that public key does not permit authentication.

The **private key** is held by an authenticator such as:

- Apple Passwords / iCloud Keychain;
- Bitwarden;
- Google Password Manager;
- Windows Hello;
- a FIDO2 hardware security key.

Google Authenticator is a TOTP application and is not required for passkey authentication.

For important admin accounts:

- register at least two independent passkeys;
- consider keeping one hardware security key as an offline backup;
- protect Bitwarden with a strong master password and MFA;
- keep phone/computer screen locks and biometrics enabled;
- retain a separate recovery token in the password manager;
- expose a server-side list of passkeys and sessions with revoke controls.

If a private passkey is genuinely compromised and the attacker can satisfy/unlock its authenticator, treat that passkey as compromised: revoke it server-side, revoke active sessions, inspect recent activity, and register a replacement.

## Recommended app integration

For a private/admin surface:

```html
<script src="https://nirav2000.github.io/Apps/apps-passkey-auth.js?v=1"></script>
<script>
const auth = AppsPasskeyAuth.create({
  baseUrl: "https://YOUR-WORKER.example.com/YOUR-AUTH-PREFIX",
  sessionStoreKey: "your-app.admin-session.v1",
  failureStoreKey: "your-app.auth-failures.v1",
  maxFailures: 5,
  onLockout() {
    // Clear only this app's admin/session caches.
  }
});
</script>
```

The backend should expose the same logical endpoints used by the reference implementation:

- `GET /security/status`
- `POST /bootstrap/request`
- `GET /bootstrap/status`
- `POST /bootstrap/register/options`
- `POST /bootstrap/register/verify`
- `POST /auth/passkey/options`
- `POST /auth/passkey/verify`
- `GET /auth/session`
- `POST /auth/logout`
- `POST /auth/recovery`
- `POST /passkeys/register/options`
- `POST /passkeys/register/verify`
- `GET /security/info`
- `POST /security/recovery`
- `POST /security/revoke-passkey`
- `POST /security/revoke-session`
- `POST /security/revoke-all-sessions`

The exact URL prefix can vary by app.

## UI requirements

Before authentication:

- do not fetch protected data;
- obscure the protected interface sufficiently that private structure/data is not readable;
- set protected controls inert/non-interactive;
- show passkey sign-in once at least one passkey exists;
- show the owner-approved bootstrap flow only when zero passkeys exist.

After authentication:

- reveal the interface;
- show current session expiry;
- provide sign-out;
- provide passkey management;
- provide session management, including revoke-all for incident response;
- provide recovery rotation.

## Reference implementation status

App Monitor currently implements:

- owner-approved first-use bootstrap;
- passkey sign-in;
- multiple passkeys;
- required user verification;
- private R2 recovery hash;
- 12-hour revocable sessions;
- passkey/session revoke controls;
- blurred/inert locked UI;
- five-failure local admin-cache clearing;
- Bitwarden-compatible recovery form.

The shared `apps-passkey-auth.js` module is the template for subsequent apps. When another app needs private administrator authentication, use this framework rather than creating a new token/password implementation.
