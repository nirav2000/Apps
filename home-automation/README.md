# Home Automation Studio

**Status:** v0.2.0 interactive design prototype, created 24 October 2026. Hosted within [App Monitor's Apps repository](https://github.com/nirav2000/Apps/tree/main/home-automation); public page route: \`/Apps/home-automation/\`.

**IMPORTANT:** This is an intentionally **offline-from-hardware demonstration**. Temperatures, room layout, scenes, electricity usage, costs, switches, thermostat setpoints, device "states" and the example floor plan are **synthetic**. No home appliances, backend, cloud accounts or local servers have been connected or scanned. Public GitHub Pages is **not** a safe place to store heating credentials, Home Assistant access tokens, LAN IPs or API keys.

## Eight interactive control styles — compare on one page

The **Control Playground** appears above the four dashboard concepts and presents eight live, side-by-side ways to adjust the *same sample room target*: (1) horizontal slider with separate ± stepper buttons, (2) Nest-inspired **rotary dial** with real touch/pointer dragging and keyboard support, (3) draggable/tappable temperature ruler, (4) vertical slider/fader, (5) one-tap comfort presets, (6) precise numeric input with range validation, (7) oversized accessibility-oriented ± buttons and (8) native temperature picker. You can change the example room in one selector and watch all eight controls, the main home overview and the Room by Room inspector synchronise. No home hardware is contacted.

The **Room by Room** inspector now provides the working rotary ring, a slider and ± buttons together. The control lab also includes separate simulations for a light dimmer, ventilation mode and a timed hot-water boost. Each temperature control uses 10–28°C in 0.5°C steps; these are *design exploration bounds*, not operating limits confirmed for Wiser or Warmup.

The eight controls have independent **Shortlist** buttons. Shortlisted controls are saved only in this browser alongside your favourite dashboard and commentary. **Copy design brief** includes the control shortlist so you can choose a hybrid final product without committing prematurely to one interface.

## Four distinct interactive concepts

| Concept | Design direction | Working prototype interactions | Best for |
|---|---|---|---|
| 01 — At a glance | Warm editorial white/sage, welcoming house illustration, large comfort headline | Sample home/away/night/boost scenes, proposed heating-zone +/- setpoints | Day-to-day family interaction and quick scenes |
| 02 — Room by room | Deep-navy spatial blueprint with tap-to-select rooms, thermostat dial and light toggle | Select five **example** rooms, see room panel and change local-only simulated values | Familiar place-based navigation; iPad wall display |
| 03 — Energy & flows | Dark green control-room console, demand chart, consumption mix and power-flow artwork | Synthetic 24h/7d chart with inspected bars, EV charging schedule simulation | Energy, tariffs, heating efficiency and later EV optimisation |
| 04 — Systems & plans | Precision lavender-white engineering workspace | Search and filter 17 projects, expand integration guidance, tick 10 milestones | Equipment inventory, engineering design, installation progress |

All four are responsive, keyboard-navigable panels with explicit simulation disclosures. Current design favourite, per-design comments and manually checked planning milestones are stored **only in this browser** using \`localStorage\`; **Copy design brief** exports those choices via clipboard for review in ChatGPT. Scene, temperature and other demo controls intentionally do **not** persist and cannot issue physical commands.

The App Monitor and main Apps dashboard link directly to this section.

## Consolidated equipment and ideas register

This register consolidates earlier discussions. *Reported* means it was described by the homeowner; it does not mean discovered on the network, authenticated or verified. The canonical, machine-readable and more detailed register (including dependency, stage, reference and Pi suitability) is in [data.js](./data.js), rendered on the **Systems & plans** tab.

| Workstream | Previously discussed aim | Pi Zero 2 W role | Status |
|---|---|---|---|
| Drayton Wiser HubR second generation | LAN-based heating-zone and hot-water control; reduced Wiser cloud dependence | Lightweight bridge possible | Hardware reported, integration untested |
| Warmup Element thermostat | Bathroom electric UFH; Google Home control without IFTTT | Cloud API bridge possible | Thermostat reported, binding untested |
| Google Home original smart speaker | Heating by voice | Indirect bridge possible | Speaker reported; Google cloud dependence |
| Raspberry Pi Zero 2 W | Host small services, sensor collector, remote VPN exit node | Core lightweight edge hardware | Exact model not confirmed |
| Raspberry Pi 4 | Main Home Assistant OS / local control centre | Different hardware | Possibly available; find and check RAM |
| Virgin Media Hub 5 | LAN-only Wiser operation, network isolation and VPN access | Network companion | Router reported; feature availability unverified |
| Lighting and Heritage Brass switchgear | Voice, scenes, presence-based lights | Rules/bridge possible | Models and smart protocols unverified |
| Bathroom/laundry ventilation | Humidity-triggered extraction, safe hysteresis and timeout | Excellent | Controller and sensors to choose |
| Room temperature / occupancy | Room schedules, window-open and presence automations | Excellent | Sensors proposed |
| Smart meter and electricity costs | Electricity telemetry, trends, baseline, tariffs | Lightweight ingestion | Meter access and supplier details require verification |
| Water usage and leaks | Flow monitor, leak detection, optional approved stop valve | Excellent | Hardware proposed |
| EV charging and Tesla | Schedule off-peak charging, costs and remote locking | Scheduling/telemetry | Tesla reported; Ohme/zappi comparison only |
| Tailscale exit node | Secure remote connection / potential EE-site exit node | Excellent, preferably dedicated | Previously discussed; installation unverified |
| Pi-hole/AdGuard | DNS filtering, network monitoring | Excellent, separate reliability considerations | Proposed |
| Unified home dashboard | Phone/tablet/desktop interface, scenes, charts, device controls | Demo works, full backend too resource-heavy | Four design prototypes now implemented |
| Long-term analytics | Energy, heating, comfort, reliability and history | Limited / external storage | Proposed |
| Notifications and safety | Alerts for leak, abnormal energy or offline devices | Excellent rule engine | Proposed |

## Architecture proposed for the live system

\`\`\`text
iPhone / iPad / wall tablet / authenticated browser
                  |
           secured gateway/API
        authentication + authorization
     HTTPS/TLS + audit + rate limiting
                  |
             VPN/private LAN
                  |
       Pi 4 (>=2 GB) running
         Home Assistant (HA)
                  |
      +-----------+-------------+
      |           |             |
 local Wiser   supported     compatible
 adapter      sensor hub      chargers
      |
 cloud-only adapters where unavoidable:
 Warmup Element my.warmup.com; Google voice
                  |
 Pi Zero 2 W: separate small network agent,
 sensors, Tailscale or DNS services
\`\`\`

A future deployment must define whether its browser-facing API is *private VPN only* (default preference) or hosted via an authenticated, locked-down access gateway. Do not place the Home Assistant long-lived access token in JavaScript, \`localStorage\`, query strings, Apps Page source, or an unauthenticated public Cloudflare Worker. Never let an origin wildcard or an unauthenticated HTTP GET change a device. Use existing shared App Monitor authentication only if its session tokens can be safely verified server-side; a passkey-protected screen in browser CSS is **not** an authorization boundary.

### Adapter contracts (proposed; **not implemented yet**)

Use a stable device model independent of vendor:

- \`deviceId\`, \`areaId\`, \`kind\`, \`integration\`, \`capabilities\`, \`cloudDependency\`, \`onlineStatus\` and \`lastSeenAt\`.
- \`state\`: timestamped, source-labelled readings with unit, freshness and error indication. A stale/null value is **unknown**, never zero or online.
- \`GET /v1/areas\`, \`GET /v1/devices\`, \`GET /v1/devices/{id}/state\`, \`GET /v1/events?since=...\`, \`GET /v1/energy?start=...&end=...\`; all require authenticated authorization to actual household data.
- \`POST /v1/devices/{id}/commands\` for a bounded, server-validated action with idempotency key, permission check, audit record, short expiry and response status (\`accepted\`, \`acknowledged\`, \`failed\`, \`timedOut\`). An acknowledgement is **not** proof of a changed measured state.
- \`PUT /v1/automations/{id}\` only for privileged users, with version/precondition to prevent racing edits and support rollback.
- \`GET /v1/health\` restricted to authorized household users and free of secrets, credentials or raw LAN addressing.

Prefer read-only integration first; enable actual writes per device only after test fixtures, fail-safe design, permissions and a hardware proof-of-operation. Appliance-native/manual heating and water controls must continue to work when the Pi or internet fails.

### Suggested model-driven product features

1. **Areas**: real floor-plan editor, floors, rooms, pinned devices, explicit unassigned-device bucket.
2. **Scenes**: Home/Away/Night/Boost with detailed per-device preview, dry-run, scheduled expiry and undo where supported.
3. **Climate**: heat-zone + UFH + hot water states, scheduled target vs current, last acknowledgment and optional TRVs; guard unsafe setpoint ranges.
4. **Live device quality**: online/offline/unknown, cloud/local distinction, age of last measurement, serial/model/firmware (private inventory only), integration health, room assignment.
5. **Rule builder**: trigger → conditions → action → exception → testing; templates for humidity fans, open windows, freeze protection and tariff-aware EV charging.
6. **Energy**: compare daily/weekly/monthly usage, tariff-aware cost, per-system inferred loads with confidence notes, detection of unusual baseload, EV separation, solar/battery if later added.
7. **Safety**: leak alarms, extreme heating alerts, frozen pipes, critical outages; offline/local alert plan and manual overrides. High-stakes actions must never rely solely on a cloud API or a demo web page.
8. **Maintenance**: batteries, radio signal, integration update advisory, sensor calibration, last backup, SD health, storage wear, Pi uptime and outages.
9. **History / observability**: commands, triggers, results, measurements, alerts, trends; timelines must distinguish action requested vs actually observed.
10. **Family use**: room-focussed tablet view, simple presets for non-admin family members, granular permissions, optional child-safe read-only mode.
11. **Privacy / cost**: all raw smart-home data private by default; public design studio never loads private telemetry; retention and backups configurable; optional cloud calls shown explicitly.
12. **Portfolio integration**: link read-only health/version/diagnostics into App Monitor once securely integrated; do not couple device operation to App Monitor availability.

### Sequence and hardware

1. Confirm **which Pis are physically available**. Zero 2 W is believed owned, Pi 4 possibly owned. Check the Pi 4's RAM before choosing a permanent installation.
2. Prototype **Warmup Element read** against a supported binding or documented API; cloud access is expected.
3. Prototype **Wiser local read** followed by safe heating-zone/hot-water controls using an existing supported integration.
4. Confirm **Google Assistant** voice route and its connectivity constraints, without requiring a paid IFTTT plan.
5. Define **authenticated live gateway** before exposing anything from home; start with private read-only state.
6. Choose dashboard interactions based on favourite/notes collected in the studio. Connect one integration at a time.
7. Inventory exact **lighting, extractor, thermostat, smart meter and sensor models** and associated protocols.
8. Add **energy data and historical storage**; identify tariffs and actual measurement sources instead of inventing figures.
9. Add humidity fans, occupancy, water leak sensors and tested notifications with manual control still available.
10. Integrate selected EV charger after installing and validating its vendor-supported control path. Leave PEN and load balancing to the certified EVSE hardware.

## Testing and release gate

- \`validation.config.json\` enables the shared App static check, browser smoke tests and interactive release-gate scenario.
- \`tests/release-scenario.mjs\` tests four views, demo-only scene/temperature/light operations, charts, device filters/detail, local planning and saved feedback, keyboard tab switching and responsive layouts. It also verifies **zero external network requests**.
- \`.github/workflows/home-automation-validation.yml\` performs JavaScript/JSON static checks, Chromium smoke and interaction gating, and uploads screenshots/release-gate evidence.
- Production proof needs separate GitHub Pages checks and actual URL loading; committing source alone does not prove a browser was served the latest version.
- This project uses \`main\` only. No secrets, binaries or nonessential dependencies.

## References

- [Wiser community Home Assistant integration](https://github.com/asantaga/wiserHomeAssistantPlatform)
- [openHAB Warmup binding](https://www.openhab.org/addons/bindings/warmup/)
- [Home Assistant Google Assistant integration](https://www.home-assistant.io/integrations/google_assistant/)
- [Home Assistant Raspberry Pi guide](https://www.home-assistant.io/installation/raspberrypi)
- [Tailscale exit nodes](https://tailscale.com/kb/1103/exit-nodes)
- [Home Assistant energy dashboard guidance](https://www.home-assistant.io/docs/energy/)

All product APIs and hardware compatibility must be re-verified when moving from this design prototype to a live installation.
