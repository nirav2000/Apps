# Account Entry v1.0.0

Status: **Available**. First consumer: Dol v2.6.13. Other apps are **not installed** automatically.

Reusable placement and modal controller for Apps Auth. Import the Auth SDK and UI component separately and initialise Auth first.

```js
import {Auth} from 'https://nirav2000.github.io/Apps/auth/v1/index.js';
import 'https://nirav2000.github.io/Apps/auth/v1/ui.js';
import {mountAccountEntry} from 'https://nirav2000.github.io/Apps/platform/account-entry/v1/index.js';
await Auth.init({appId:'my-app',identity:{firebaseConfig}});
const entry=mountAccountEntry({
  Auth,appId:'my-app',
  slot:document.querySelector('[data-account-slot]'),
  settingsTrigger:document.querySelector('[data-account-settings]'),
  variant:'balanced',theme:'midnight',methods:'emailPassword,google'
});
// entry.open(), entry.close(), entry.destroy()
```

## Placement contract

Apps supply a header slot; Account Entry owns the button, identity badge, modal, close/backdrop/Escape and responsive phone sheet. An explicit slot avoids floating controls obstructing app content. Defaults: top-right header, 44px tap target, dark-theme friendly. Apps may override the slot, theme, panel and enabled methods. Do not render a second login form in Settings.

## Acceptance checks

- Guest can practise without login and open/close modal from header, Settings and Progress.
- Signed-in identity shown on header and inside Auth panel.
- Google popup launches on a user tap; Firebase authorised domains still required.
- Escape, close button, backdrop and keyboard focus work.
- Narrow phone and tablet layouts do not overlap existing controls.
- Guest import requires approval; account switch reloads app to isolate learner state.
- Offline and sync error are distinguished from successful cloud sync.
- Shared capability release does not auto-install in other apps.

Auth Lab remains the canonical design lab for `apps-auth-panel`. Consumer integrations should test actual Firebase sign-in separately. No automatic cloud-data deletion is provided.
