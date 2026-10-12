# Shared Notes & Annotations v1.1 — complete cloud workflow

The shared library is reusable. Install it only in explicitly authorised apps; do not silently install dependencies in other apps.

## Cloud dependency contract

A complete installation needs:
1. Existing app authentication, with an administrator identity authorised to access notes.
2. A compatible central Firestore transport. For App Monitor, use `createCloudTransport` from `notes/v1/cloud.js`, backed by the authenticated App Monitor Worker. Do not initialise another Firebase SDK or Firestore listener.
3. Development Control Centre integration, with GitHub Issues as the durable task store.
4. A verified review/implementation workflow. Saving a note is **not** evidence of implementation.

The shared client has no secrets. The worker uses `FIREBASE_ADMIN_SERVICE_ACCOUNT_JSON` and `NOTES_FIREBASE_PROJECT_ID` (default `kk-syllabus`). Its service account must have access to the target Firestore database. The optional `NOTES_GITHUB_ISSUES_TOKEN` must be a server-side GitHub token permitted to create issues in `nirav2000/Apps`. Never put it in the browser.

### App installation

```js
import Notes from '/Apps/notes/v1/index.js';
import {createCloudTransport} from '/Apps/notes/v1/cloud.js';
const transport=createCloudTransport({
  apiBase:'https://apps-monitor-api.nirav2000-github.workers.dev/app-monitor/notes',
  appId:'my-app',
  getHeaders:()=>({'X-App-Monitor-Session':authenticatedAdminSession})
});
const notes=await Notes.init({appId:'my-app',appVersion:APP_VERSION,transport});
```

This central adapter currently requires an **App Monitor administrator session**, not an ordinary consumer-app user token. Consumer apps must not reuse or expose administrator credentials. Before deploying annotations to ordinary users, implement an authenticated, app-scoped user-token verification route and role rules.

### Review and development contract

- Annotation capture saves to Firestore, with app, page, element anchor, text and version.
- The Development Control Centre can read pending annotations using the administrator session.
- An authorised user can invoke `notes.publishReviewFeed(true)` to request GitHub issue creation.
- If the GitHub token is missing, the API returns `pending-configuration`; notes remain open and visible. Never report success without an issue.
- GitHub issue numbers/URLs are stored in annotation metadata, preventing duplicates on subsequent review-feed calls.
- Before starting authorised app development, ChatGPT should inspect both outstanding annotations and Development Control Centre issues. Fix only in-scope items.
- Do not mark annotations implemented until code has been committed, deployed and verified. Record version, commit and verification outcome. The status endpoint can return centrally recorded implemented notes.
- The backend does **not** automatically infer GitHub issue closure or verify deployments. Those require a separate trusted executor or explicit verified status update.

### Installation verification

Test on main after the Worker deployment succeeds:
1. Sign in to App Monitor with passkey; confirm annotation UI is only available while signed in.
2. Annotate an individual element and save. Confirm a successful Firestore write.
3. Reload, sign in on another device and confirm the note appears.
4. Open Development Control Centre and confirm the annotation appears in its central queue.
5. Request review-feed sync; confirm a GitHub issue is created or the missing-token warning appears. Retry and confirm no duplicate issue.
6. Confirm a failed cloud write does not misleadingly show a saved note.
7. Verify unauthenticated API access returns 401 and check Firestore service account permissions.
8. Test mobile layout and ensure the core App Monitor workflows still work with Notes disabled.

Do not mark the register `installed` until these live checks pass.
