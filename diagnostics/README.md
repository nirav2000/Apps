# Shared Diagnostics 1.0.0

Free, opt-in, local-first app diagnostics, installed in Dol first. Browser geometry is measured, never misrepresented as a pixel recording. No third-party recording vendor or new API credentials.

## Use

In Dol, open Settings > Help improve Dol > Open diagnostics. Start capture with explicit consent; use Report and Save locally; review measurements in Apps Diagnostics. GitHub issues use existing Apps passkey sign-in and server-side Notes integration, after owner approval. The issue is created in Apps with the affected Dol repository in its body. No raw replay, screenshots or secrets are automatically uploaded.

The browser may not support real screen recording; iOS Safari does not allow a webpage to silently record the entire device. Use Apple's screen recorder when needed. Reports stay in IndexedDB (12 maximum) and can be exported as JSON.

Consumer apps pin diagnostics/releases/1.0.0/index.mjs; v1 is the development copy. Other apps are not automatically installed.

Run `node --test diagnostics/tests/core.test.mjs` and `node diagnostics/tests/browser.mjs` in the Actions workflow. Verify the live Pages deployment separately.
