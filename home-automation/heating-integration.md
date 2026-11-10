# Heating Intelligence: Wiser + Warmup integration plan

**Status (10 November 2026):** The [Heating Intelligence page](./heating.html) is a responsive browser prototype with a working history viewer, energy calculation and local JSON importer. It is **not connected to the physical heating systems** and its example readings are fictional. No passwords, tokens, thermostat IDs, home addresses or private IP addresses belong in this public repository.

## What the interface should show

A combined Wiser and Warmup view for phone, iPad and desktop, including live temperatures and targets, an event-by-event ON/OFF history, total running time, approximate electricity used and cost, and later secure setpoint controls. Accurate evidence matters: a timetable does not prove a heater switched on, a thermostat request does not prove the boiler burned fuel, and electricity consumption cannot be inferred from temperature alone.

## Device integration and evidence

| Source | Information expected | Limitations |
| --- | --- | --- |
| Wiser HubR v2 through community Home Assistant integration | Locally retrieved temperatures, setpoints, heating and hot-water circuit states, room percentage demand | Room/circuit heat demand is not equal to boiler burner runtime or per-room gas energy |
| Warmup Element via openHAB Warmup binding and MyWarmup cloud API | Current and target temperature, floor/air probes, programmed mode, energyToday | The documented channel list does **not** include definitive ON/OFF relay status. Scheduled mode is not heating-active |
| Optional electrical circuit energy monitor | Actual electrical kW and kWh for electric UFH | Requires correctly rated equipment and qualified installation |
| Whole-home gas meter or suitable boiler telemetry | Total household gas use | Cannot allocate gas by room merely by adding heating-request durations |

**Confirmed public references, November 2026:**
- [Wiser Home Assistant integration](https://github.com/asantaga/wiserHomeAssistantPlatform): works locally, supports V2 hubs, and current release details describe heating/hot-water circuit state sensors and room percentage demand. Version 4 circuit ON/OFF states are lowercase.
- [openHAB Warmup binding](https://www.openhab.org/addons/bindings/warmup/): lists Warmup Element as supported, exposes an energyToday channel and air/floor temperatures, but no explicit heating relay ON/OFF channel. Altering the target by the binding triggers a **temporary override**, 60 minutes by default.
- [Home Assistant REST history API](https://contributors.home-assistant.io/core/internals/rest-api/): permits recorded state history retrieval with an authenticated GET request to /api/history/period followed by a timestamp and entity filters. The API must only be called from a secured local gateway; never embed its bearer token in publicly hosted frontend code.

## Recommended architecture

    Wiser HubR (local LAN)
         |
    Home Assistant on Pi 4 (private home network)
         |
    Entity history + trusted local exporter
         |
    Authenticated HTTPS/VPN read-only gateway
         |
    Heating Intelligence dashboard (phone/iPad)
         ^
    Warmup Element via openHAB Warmup cloud integration
    OR a verified private API adapter
    + optional professionally installed circuit energy monitor

The Raspberry Pi Zero 2 W (512 MB RAM) is a reasonable lightweight logger/exporter, but is not recommended for running the complete controller and long-term database. A Pi 4 or another always-on host is preferable.

**Security:** Keep device credentials server-side, remote access restricted, use HTTPS/VPN, and verify authorisation before enabling controls. Do not publish heating metadata or daily event histories on GitHub Pages just to make them accessible. The browser page currently has no network or actual command capability.

## JSON history format (version 1)

A local JSON history file can be imported into the prototype. The following is a fabricated illustration, not a real home observation:

    {
      "schemaVersion": 1,
      "source": "local-heating-bridge",
      "generatedAt": "2026-11-10T07:00:00Z",
      "zones": [
        {
          "id": "wiser-living", "name": "Living room",
          "provider": "wiser", "energyType": "gas", "kind": "heating",
          "current": 20.3, "target": 21.0,
          "description": "Heating circuit state"
        },
        {
          "id": "warmup-bathroom", "name": "Bathroom UFH",
          "provider": "warmup", "energyType": "electric", "kind": "heating",
          "current": 22.2, "target": 23.0, "powerW": 750,
          "description": "Independent electrical load threshold"
        }
      ],
      "intervals": [
        {
          "zoneId": "wiser-living",
          "start": "2026-11-10T06:30:00Z",
          "end": "2026-11-10T07:00:00Z",
          "state": "on", "evidence": "Heating circuit demand"
        },
        {
          "zoneId": "warmup-bathroom",
          "start": "2026-11-10T06:35:00Z",
          "end": "2026-11-10T06:57:00Z",
          "state": "on", "evidence": "Metered electrical load"
        }
      ]
    }

The example does not provide known OFF intervals. All missing periods remain unknown rather than incorrectly counted as off. A real collector should emit non-overlapping on, off and unknown intervals per zone with ISO 8601 timestamps and explicit timezone. Import rejects overlapping intervals within a zone. No imported file is uploaded or stored by the application; it remains in the browser session.

## Calculations and limits

1. **Zone activity:** elapsed ON duration, merged over any contiguous/overlapping intervals. Unknown time is not OFF.
2. **Wiser combined demand:** the *union* of heating zone requests; two rooms calling simultaneously do not mean twice as much elapsed boiler demand. The hot-water zone remains separately visible.
3. **Electricity estimate:** installed electrical power in kW multiplied by verified ON hours. An illustrative 750 W heater and a 23.10p/kWh electricity tariff are **fictional defaults** to demonstrate calculations; change to actual equipment and tariff.
4. **Gas:** cost and kWh are unavailable until real gas usage measurements or suitable boiler telemetry exist.
5. **Provider-reported energyToday:** can be logged separately as a manufacturer-derived daily energy figure, but it does not reveal exact switching times. Do not claim it is independent measured electricity unless verified.

## Installation steps

1. Confirm the actual Wiser HubR v2 zone list and which Warmup Element circuits are **electric**. Record their installed heater ratings.
2. Locate the Pi 4, or choose a small always-on host. Install Home Assistant and the Wiser integration. Verify available Heating/Hot Water circuit state entities and percentage demand on your actual hub.
3. For Warmup, install the documented openHAB binding or a separately assessed adapter. Record temperatures and energyToday; do not substitute mode=schedule for an active relay signal. If exact heater ON time matters, plan a properly installed circuit power monitor.
4. Set up a **private** exporter that converts recorded verified state changes into the JSON schema above. Initially import one day, compare against Wiser/Warmup originals and check gaps.
5. Add ongoing local history storage and a secured gateway for live readings. Only after testing, introduce secure commands for schedule/target and ensure Warmup overrides use the intended duration.
6. Optionally add a measured gas signal and variable electricity tariffs for meaningful cost tracking.

**Next implementation dependency:** direct testing needs the real device entity list and access to a local home controller. No genuine switching times or consumption for the user's home have been retrieved.
