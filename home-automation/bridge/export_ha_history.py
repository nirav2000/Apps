#!/usr/bin/env python3
"""Private, one-shot Home Assistant -> Heating Intelligence JSON history exporter.

Standard-library only. Read HA_TOKEN from the environment; never put it in a
public repository or in the output. This script does NOT control thermostats.
It uses observed state-change history only, and treats missing signals as unknown.

Example:
    HA_TOKEN=... python3 export_ha_history.py --config config.local.json --out heating-private.json
"""
from __future__ import annotations

import argparse
from datetime import datetime, timedelta, timezone
import ipaddress
import json
import os
from pathlib import Path
import re
import sys
import tempfile
from urllib.parse import quote, urlencode, urlsplit
from urllib.request import Request, urlopen

ENTITY_RE = re.compile(r"^[a-z][a-z0-9_]*\.[a-z0-9_]+$")
ID_RE = re.compile(r"^[A-Za-z0-9_-]{1,72}$")


def iso(t: datetime) -> str:
    return t.astimezone(timezone.utc).isoformat().replace("+00:00", "Z")


def parse_date(value: str) -> datetime:
    t = datetime.fromisoformat(str(value).replace("Z", "+00:00"))
    if t.tzinfo is None:
        raise ValueError("Timestamp has no timezone")
    return t.astimezone(timezone.utc)


def safe_url(raw: str) -> str:
    u = urlsplit(str(raw).strip())
    if u.scheme not in ("https", "http") or not u.hostname or u.username or u.password or u.path not in ("", "/"):
        raise ValueError("Invalid Home Assistant base URL; use scheme://host:port without credentials or path")
    if u.scheme == "http":
        host = u.hostname
        local = host in ("localhost", "127.0.0.1", "::1") or host.endswith(".local")
        if not local:
            try:
                addr = ipaddress.ip_address(host)
                local = addr.is_private or addr.is_loopback or addr in ipaddress.ip_network("100.64.0.0/10")
            except ValueError:
                pass
        if not local:
            raise ValueError("Refusing to send an HA token over HTTP to a non-private host")
    return raw.rstrip("/")


def entity_id(value):
    if not value:
        return None
    if not isinstance(value, str) or not ENTITY_RE.fullmatch(value):
        raise ValueError("Invalid Home Assistant entity ID")
    return value


def to_state(value, item: dict) -> str:
    if value is None:
        return "unknown"
    v = str(value).lower().strip()
    on = {str(x).lower().strip() for x in item.get("on_values", ["on"])}
    off = {str(x).lower().strip() for x in item.get("off_values", ["off"])}
    if on & off:
        raise ValueError("ON and OFF value mappings must not overlap")
    if v in on:
        return "on"
    if v in off:
        return "off"
    return "unknown"


def states_to_intervals(zone_id: str, records: list, start: datetime, end: datetime, item: dict):
    """Emit contiguous, non-overlapping known or unknown intervals."""
    valid = []
    for record in records or []:
        if not isinstance(record, dict):
            continue
        when = (record.get("last_updated") or record.get("last_changed")) if item.get("signal_attribute") else (record.get("last_changed") or record.get("last_updated"))
        if not when:
            continue
        try:
            at = parse_date(when)
        except (ValueError, TypeError):
            continue
        field = item.get("signal_attribute")
        value = record.get("attributes", {}).get(field) if field else record.get("state")
        state = to_state(value, item)
        valid.append((at, state))
    valid.sort(key=lambda x: x[0])
    segments = []
    cursor = start
    state = "unknown"

    def append(a: datetime, b: datetime, value: str):
        if b <= a:
            return
        if segments and segments[-1]["state"] == value and segments[-1]["end"] == iso(a):
            segments[-1]["end"] = iso(b)
        else:
            segments.append({
                "zoneId": zone_id, "start": iso(a), "end": iso(b),
                "state": value, "evidence": str(item.get("evidence", "Home Assistant state history"))[:120]
            })

    for at, new_state in valid:
        if at < start:
            state = new_state
            continue
        if at > end:
            break
        append(cursor, at, state)
        cursor = at
        state = new_state
    append(cursor, end, state)
    return segments


class HomeAssistant:
    def __init__(self, base: str, token: str):
        self.base = safe_url(base)
        if not token or not token.strip():
            raise ValueError("Set HA_TOKEN as an environment variable on the private controller")
        self.token = token

    def get(self, path: str):
        request = Request(self.base + path, headers={
            "Authorization": "Bearer " + self.token,
            "Accept": "application/json"
        })
        with urlopen(request, timeout=25) as response:
            return json.load(response)

    def current(self, name: str) -> dict:
        return self.get("/api/states/" + quote(entity_id(name), safe=""))

    def history(self, name: str, start: datetime, end: datetime) -> list:
        # Query full objects (not minimal_response): climate signal attributes may be required.
        query = urlencode({"filter_entity_id": entity_id(name), "end_time": iso(end), "significant_changes_only": "0"})
        groups = self.get("/api/history/period/" + quote(iso(start), safe="") + "?" + query)
        if not isinstance(groups, list):
            raise ValueError("Unexpected history response from Home Assistant")
        return [x for group in groups if isinstance(group, list) for x in group if isinstance(x, dict)]


def safe_temperature(raw):
    try:
        value = float(raw)
    except (ValueError, TypeError):
        return None
    return round(value, 2) if -20 <= value <= 65 else None


def export(config: dict, ha: HomeAssistant, end: datetime, days: int) -> dict:
    if not 1 <= days <= 31:
        raise ValueError("days must be 1..31")
    zones = config.get("zones", [])
    if not isinstance(zones, list) or not 1 <= len(zones) <= 50:
        raise ValueError("Define 1..50 zones")
    start = end - timedelta(days=days)
    output, intervals, seen = [], [], set()
    state_cache = {}

    def current(name: str):
        if name not in state_cache:
            state_cache[name] = ha.current(name)
        return state_cache[name]

    for item in zones:
        zone_id = item.get("id")
        if not isinstance(zone_id, str) or not ID_RE.fullmatch(zone_id) or zone_id in seen:
            raise ValueError("Zone IDs must be unique letters, numbers, hyphens or underscores")
        seen.add(zone_id)
        provider = item.get("provider")
        energy = item.get("energyType")
        if provider not in ("wiser", "warmup") or energy not in ("gas", "electric"):
            raise ValueError("Each zone must declare a supported provider and gas/electric type")

        def temperature(slot: str, attr_slot: str):
            name = entity_id(item.get(slot))
            if not name:
                return None
            result = current(name)
            value = result.get("attributes", {}).get(item.get(attr_slot)) if item.get(attr_slot) else result.get("state")
            return safe_temperature(value)

        power = item.get("powerW")
        if power is not None and (not isinstance(power, (float, int)) or power <= 0 or power > 50000):
            raise ValueError("powerW must be a valid electrical rating")
        output.append({
            "id": zone_id, "name": str(item.get("name") or zone_id)[:80],
            "provider": provider, "energyType": energy,
            "kind": "hot_water" if item.get("kind") == "hot_water" else "heating",
            "current": temperature("current_entity", "current_attribute"),
            "target": temperature("target_entity", "target_attribute"),
            "powerW": power,
            "description": str(item.get("evidence") or "Home Assistant mapped entity history")[:140]
        })
        signal = entity_id(item.get("signal_entity"))
        history = ha.history(signal, start, end) if signal else []
        intervals.extend(states_to_intervals(zone_id, history, start, end, item))
    return {
        "schemaVersion": 1,
        "source": "private-home-assistant-history-exporter",
        "generatedAt": iso(end),
        "zones": output,
        "intervals": intervals
    }


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--config", required=True, help="Local JSON mapping config. No credentials inside.")
    parser.add_argument("--out", required=True, help="Private output file path, not a public website folder.")
    parser.add_argument("--days", type=int, default=8, help="History window in days (1..31; default 8)")
    args = parser.parse_args()

    config = json.loads(Path(args.config).read_text(encoding="utf-8"))
    controller = HomeAssistant(config["home_assistant_url"], os.environ.get("HA_TOKEN", ""))
    document = export(config, controller, datetime.now(timezone.utc), args.days)
    target = Path(args.out).expanduser().resolve()
    target.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.NamedTemporaryFile(mode="w", encoding="utf-8", dir=target.parent, prefix=".heating-", suffix=".tmp", delete=False) as handle:
        json.dump(document, handle, indent=2)
        handle.write("\n")
        temp_path = Path(handle.name)
    os.chmod(temp_path, 0o600)
    os.replace(temp_path, target)
    print("Wrote", len(document["zones"]), "zones and", len(document["intervals"]), "intervals to private file:", target)


if __name__ == "__main__":
    try:
        main()
    except (OSError, ValueError, KeyError, TypeError) as exc:
        print("Heating export failed:", str(exc), file=sys.stderr)
        sys.exit(1)
