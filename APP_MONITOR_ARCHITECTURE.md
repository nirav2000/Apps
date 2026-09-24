# App Monitor — Architecture, Integration and Backend Portability

_Last updated: 24 September 2026_

This document explains what App Monitor is, where it lives, what each file does, how applications integrate with it, why monitoring was rolled out beyond the original review scope, and how the backend can be migrated away from Cloudflare/R2 without changing monitored applications.

---

## 1. What is House-preview?

Repository: **nirav2000/House-preview**

Live app: **https://nirav2000.github.io/House-preview/**

The page title is **House Preview — Staircase Colours**.

It is a small interactive home-design utility for previewing staircase colour combinations. It lets the user change the banister colour, change the handrail colour, inspect the image masks used to recolour those parts, reset to the original staircase, and export the result as a PNG.

It is unrelated to Snag. It was included in the broader App Monitor rollout because it is one of the existing GitHub Pages applications in the Apps catalogue.

---

# 2. Is App Monitor now independent of Snag?

**Yes. Runtime App Monitor is now independent of Snag.**

Current architecture:

~~~text
Monitored apps
    |
    v
Apps/app-monitor.js
    |
    v
apps-monitor-api
Dedicated Cloudflare Worker
    |
    v
apps-monitor-data
Dedicated R2 bucket
~~~

Snag is now simply another monitored application:

~~~text
Snag --------------+
OpenDay ----------- |
LearnLatin -------- |
Beyond100 --------- |
MemoryMastery ----- |
etc. --------------+
         |
         v
   App Monitor
~~~

### Confirmed separation

The dedicated Worker source is **Apps/app-monitor-worker.js**.

Cloudflare service: **apps-monitor-api**

Dedicated storage: **apps-monitor-data**

The current App Monitor Worker configuration contains only:

    APP_MONITOR_DATA -> apps-monitor-data

It no longer contains a binding to **snag-media**.

The current Snag Worker contains no App Monitor routes or App Monitor WebAuthn code.

The original **_app-monitor/** objects were copied to the dedicated bucket, migration checks confirmed passkey and recovery state, and the migrated App Monitor objects were then deleted from **snag-media**.

### Remaining relationship with Snag

The only intended relationship is:

**Snag loads the shared App Monitor client because Snag is one of the applications being monitored.**

There is no longer a backend/storage ownership relationship.

---

# 3. Is monitoring now standard across Apps?

The intended platform rule is now:

> Every maintained web application should load the shared Apps identity layer and App Monitor unless the application has explicitly opted out.

The original architecture review started with the applications from **Kk-syllabus onward**, because those were the applications under active review.

When App Monitor became a platform capability rather than a one-off feature, monitoring was also added/refreshed in several older applications such as:

- MemoryMastery
- Grammar-Tree-Coach
- House-preview
- 3dviewer
- Claudetrials

That expansion was intentional: if App Monitor is meant to be the central activity monitor, restricting it to applications created after Kk-syllabus would create an arbitrary blind spot.

The distinction should therefore be:

### Architecture review scope

The detailed storage/Firebase/authentication review originally covered the newer apps beginning with Kk-syllabus.

### App Monitor rollout scope

App Monitor should cover **all maintained Apps**, regardless of age.

That broader rollout should be explicit rather than accidental.

---

# 4. Current App Monitor files

There are **six operational App Monitor-specific files** in the Apps repository.

## 4.1 app-monitor.html

The private administrator dashboard.

Responsibilities include:

- passkey sign-in
- recovery-token setup
- admin session management
- passkey rename/revoke
- People summaries
- People & devices
- app summaries
- session views
- grouping and filtering
- aliases/person labels
- CSV export
- querying the App Monitor backend

This is the page opened by the **App Monitor** button.

## 4.2 app-monitor.js

The client-side tracker loaded by monitored applications.

Responsibilities include:

- identify the application
- obtain the canonical browser/device ID
- create a browser-tab session ID
- collect app/page information
- collect browser/device metadata
- receive identity information from AppsAuth
- accumulate visible active time
- distinguish foreground activity from background tabs
- send startup/page/identity/visibility/session snapshots
- send foreground heartbeat updates
- send data to the dedicated App Monitor API

The monitored application does not need to know about R2.

It only loads this central script.

Current backend target:

    https://apps-monitor-api.nirav2000-github.workers.dev/app-monitor

## 4.3 app-monitor-worker.js

The dedicated backend/API.

Responsibilities include:

- receive application session snapshots
- obtain IP/network metadata at the server edge
- store session records
- retrieve day/session data for the dashboard
- aliases/person assignments
- passkey registration and authentication
- recovery-token hashes
- admin session creation/revocation
- WebAuthn challenge handling
- App Monitor health endpoints

It operates independently from Snag.

## 4.4 wrangler-app-monitor.jsonc

Cloudflare deployment configuration.

It defines:

- Worker name: apps-monitor-api
- Worker entrypoint: app-monitor-worker.js
- compatibility date
- R2 binding
- allowed browser origin

Current R2 binding:

    APP_MONITOR_DATA -> apps-monitor-data

## 4.5 .github/workflows/deploy-app-monitor-worker.yml

Deployment automation for the dedicated Worker.

It:

- installs dependencies
- checks Cloudflare credentials
- deploys the dedicated Worker
- smoke-tests the Worker
- checks the App Monitor security-status endpoint

The deployment definition is now in the Apps repository rather than Snag.

## 4.6 package.json

Runtime/build dependencies needed by the App Monitor Worker.

Most importantly it supplies **@simplewebauthn/server** for passkey/WebAuthn verification, and Wrangler for Cloudflare deployment.

---

# 5. Related shared platform files

These are important to App Monitor but are not exclusively App Monitor files.

## apps-auth.js

Shared Apps identity layer.

It provides:

- canonical device identity
- application identity publication
- cross-app identity events

App Monitor consumes this information when available.

## apps-passkey-auth.js

Reusable passkey/authentication client framework.

It exists so another private/admin application can reuse the same authentication architecture.

The current App Monitor dashboard still contains its own integrated authentication UI/logic, so this file is a reusable platform framework rather than a required App Monitor runtime import.

---

# 6. What does an application need to do to use App Monitor?

For a normal web app, the integration is deliberately small.

Recommended pattern:

~~~html
<script src="https://nirav2000.github.io/Apps/apps-auth.js?v=1"></script>

<script>
window.APP_MONITOR_APP = "MyApp";
</script>

<script src="https://nirav2000.github.io/Apps/app-monitor.js?v=4"></script>
~~~

That is sufficient for anonymous/device-level monitoring.

## Why each line exists

### apps-auth.js

Provides the canonical cross-app device identity and, where available, authenticated-user identity.

### APP_MONITOR_APP

Provides a stable explicit application name.

Without it, the tracker can derive an app name from the GitHub Pages path, but an explicit stable name avoids accidental naming changes.

### app-monitor.js

Does the actual session/activity reporting.

---

# 7. What if the app has authentication?

The application should publish its authenticated identity into AppsAuth.

For example, after an application's authentication state changes it can call the shared identity API with:

- app UID
- username/display name where appropriate
- provider
- anonymous/authenticated status
- app name

App Monitor listens for the shared identity event and updates the session.

This is why authentication integration exists:

**the monitoring transport is generic, while the app remains responsible for knowing who its own signed-in user is.**

The app does not send passwords, Firebase tokens or passkeys to App Monitor.

---

# 8. What changes have been made to monitored apps?

The main maintained apps currently use the shared monitoring client, including:

- Kk-syllabus
- Openday
- LearnLatin
- Comprehension
- beyond100
- Snag
- MemoryMastery
- Grammar-Tree-Coach
- House-preview
- 3dviewer
- Claudetrials

Their integration is intentionally lightweight:

1. load apps-auth.js
2. set a stable APP_MONITOR_APP name
3. load the shared app-monitor.js

Apps with their own authentication additionally publish auth-state changes through AppsAuth.

Because the actual tracker is hosted centrally in the Apps repository, future tracker fixes normally require **one change to Apps/app-monitor.js**, rather than rewriting monitoring logic inside every application.

A query-string version is used to force browsers/service workers to pick up major tracker revisions.

---

# 9. Foreground versus background monitoring

The tracker now distinguishes:

- **Active** — recently active in the visible/foreground page
- **Background/open** — page exists but is hidden
- **Inactive** — no recent foreground activity

Hidden tabs do not continue ordinary five-minute heartbeat reporting.

This fixes the earlier problem where an application such as Snag could appear active simply because a browser tab remained open.

---

# 10. Can the backend be moved away from Cloudflare/R2?

**Yes.**

The monitored applications do not fundamentally depend on R2.

They depend on the **App Monitor HTTP API contract**.

Cloudflare/R2 is currently one implementation of that contract.

Possible replacement backends include:

- Google Cloud Run + Firestore
- Google Cloud Run + Cloud Storage
- Google Cloud Functions
- Firebase Functions
- AWS Lambda + DynamoDB/S3
- another conventional HTTPS API/database

---

# 11. What currently prevents a completely transparent backend switch?

There are currently two central places containing the backend URL:

- Apps/app-monitor.js
- Apps/app-monitor.html

That is already much better than having the endpoint hard-coded separately inside every application.

A backend change therefore does **not** require editing every monitored app.

Updating the central shared client is sufficient for applications when they next load the latest shared script.

However, an even cleaner abstraction is recommended.

## Recommended next improvement: stable service endpoint

Give the monitoring service one stable logical URL or use a small Apps service-config manifest.

Then the logical endpoint stays constant while its implementation can move:

~~~text
Apps
   |
   v
stable monitor endpoint
   |
   +-- Cloudflare Worker + R2
   +-- Google Cloud Run + Firestore
   +-- future backend
~~~

With that arrangement, backend migrations can be invisible to both:

- monitored applications
- the App Monitor dashboard

---

# 12. API contract that a replacement backend must preserve

A replacement backend should implement the same logical routes/behaviour.

Main telemetry endpoints include:

- session snapshot ingestion
- day/session retrieval
- aliases

Admin/security endpoints include:

- security status
- passkey authentication options
- passkey verification
- passkey registration
- recovery authentication
- admin session validation/logout
- security information
- recovery rotation
- passkey rename/revoke
- session revoke/revoke-all

The storage engine behind those routes is an implementation detail.

---

# 13. How a future Cloudflare to Google Cloud migration would work

A safe migration should be performed as a controlled cutover.

## Phase 1 — implement the same API

Create the replacement Google Cloud backend with the same externally visible API contract.

For example:

~~~text
Cloud Run
    |
    +-- telemetry API
    +-- passkey API
    +-- aliases API
    +-- admin-session API

Firestore / Cloud Storage
    |
    +-- App Monitor records
~~~

## Phase 2 — copy historical state

Copy:

- session history
- aliases
- passkey public-key records
- recovery-token hash
- admin/security configuration

The private passkey itself is never copied because the server never possesses it.

Only the public credential record is migrated.

## Phase 3 — validate

Compare:

- record counts
- aliases
- recent sessions
- passkey count
- recovery configured state
- representative historical dates

Perform a real passkey login against the replacement backend.

## Phase 4 — short overlap

For a higher-safety migration, temporarily:

- dual-write incoming telemetry to both backends; or
- copy the original data, then perform a final incremental sync immediately before cutover

## Phase 5 — switch service endpoint

Change the central App Monitor service endpoint.

If a stable proxy/service domain has already been introduced, only routing changes.

Otherwise update:

- app-monitor.js
- app-monitor.html

Individual applications do not require business-code changes because they load the shared tracker.

## Phase 6 — observe

Keep the previous backend read-only for a rollback window.

Verify:

- new sessions arrive
- aliases resolve
- passkey sign-in works
- recovery configuration is present
- grouping/history are correct

## Phase 7 — retire old backend

Only after validation:

- disable writes to the old backend
- retain/export a backup if wanted
- remove the old storage
- remove old infrastructure credentials

---

# 14. Would users have to do anything during a backend migration?

Normally **no**.

If the migration copies all authentication state correctly and the browser-facing WebAuthn RP/origin remains the same, users should not need to:

- recreate a passkey
- generate a new recovery token
- change monitored apps
- reinstall anything

The passkey RP is currently tied to **nirav2000.github.io**, not to the Cloudflare Worker hostname.

Therefore the server implementation can move while the same passkey remains usable, provided the WebAuthn records and API behaviour are migrated correctly.

Existing temporary admin sessions can also be migrated if desired, although forcing a fresh passkey sign-in at infrastructure cutover is also a reasonable security choice.

---

# 15. Recommended portability improvement

The next architectural improvement should be a tiny backend adapter/config layer.

Instead of components knowing the provider-specific Worker URL, they should ask the Apps platform for something like:

    AppsServices.appMonitor.endpoint

or use a stable proxy URL.

Then the dependency becomes:

~~~text
Application
  -> shared App Monitor client
  -> stable App Monitor API
  -> interchangeable backend implementation
~~~

This gives genuine infrastructure portability.

---

# 16. Design rule going forward

For every new maintained web application:

1. load the Apps identity module
2. set a stable app ID/name
3. load App Monitor
4. publish authenticated identity when applicable
5. do not implement a private copy of the tracker
6. do not connect directly to the App Monitor database
7. treat the App Monitor API as the boundary
8. allow explicit opt-out only when monitoring is deliberately inappropriate

The monitoring implementation, storage provider and analytics dashboard should remain independently replaceable without changing application business logic.


---

# 17. App Monitor versus Google Analytics

App Monitor and a product-analytics service such as Google Analytics solve different problems.

## App Monitor is best for

- cross-app operational visibility;
- exact Apps-platform device IDs;
- explicit person/device aliases;
- app authentication identity where deliberately supplied;
- raw session records;
- IP/network context available at the App Monitor server;
- distinguishing first-party synthetic previews and other automation;
- investigating unexpected access;
- custom security/admin session views;
- full control over the schema and retention.

## Google Analytics is best for

- standard acquisition/referrer reporting;
- page/event engagement analytics;
- funnels and journeys;
- aggregate user/session/device reports;
- campaign attribution;
- standard analytics reporting and external benchmarking conventions.

Google Analytics should not replace App Monitor for the current operational/security use case. GA4 automatically excludes known bot/spider traffic, which is useful for product analytics but conflicts with the App Monitor goal of retaining and classifying automated traffic. It also does not provide raw IP addresses as an analytics dimension.

## Recommended architecture

Use App Monitor as the **canonical operational/identity/automation ledger**.

Optionally add a product-analytics provider later for richer behavioural analytics.

If Google Analytics is added, extract aggregate reports through its Data API into the central dashboard rather than trying to make GA4 the source of truth for App Monitor identities.

A combined dashboard could therefore show:

~~~text
App Monitor
  -> operational sessions
  -> aliases / people / devices
  -> automation classification
  -> network context

Google Analytics (optional)
  -> acquisition
  -> engagement
  -> events / funnels
  -> aggregate product analytics

Central Apps dashboard
  -> presents both views without conflating them
~~~

The two datasets should remain labelled as different measurement systems rather than attempting to force session counts to match exactly.
