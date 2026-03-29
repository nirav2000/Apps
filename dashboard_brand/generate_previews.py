#!/usr/bin/env python3
"""Generate branded animated SVG previews from preview_manifest.json."""

from __future__ import annotations

import json
import tempfile
from dataclasses import dataclass
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parent
MANIFEST_PATH = ROOT / "preview_manifest.json"
OUTPUT_DIR = ROOT / "previews"

DEFAULT_PALETTE = {
    "bg_start": "#0e1730",
    "bg_end": "#132a57",
    "glow": "#59a8ff",
    "text": "#e9f1ff",
    "muted": "#93a7d1",
    "accent": "#7bdfff",
}

ALLOWED_MOTIFS = {"grid", "bars", "nodes", "traces"}


@dataclass
class Entry:
    id: str
    title: str
    subtitle: str
    output_file: str
    palette: dict[str, str]
    motif: str


def load_manifest(path: Path) -> list[Entry]:
    if not path.exists():
        raise SystemExit(f"Manifest not found: {path}")

    raw = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(raw, dict) or "entries" not in raw:
        raise SystemExit("Manifest must be an object with an 'entries' array.")

    entries_raw = raw["entries"]
    if not isinstance(entries_raw, list) or not entries_raw:
        raise SystemExit("Manifest 'entries' must be a non-empty array.")

    ids: set[str] = set()
    files: set[str] = set()
    out: list[Entry] = []

    for idx, item in enumerate(entries_raw, start=1):
        if not isinstance(item, dict):
            raise SystemExit(f"Entry #{idx} must be an object.")

        for field in ("id", "title", "subtitle", "output_file"):
            if field not in item or not isinstance(item[field], str) or not item[field].strip():
                raise SystemExit(f"Entry #{idx} missing required string field '{field}'.")

        entry_id = item["id"].strip()
        output_file = item["output_file"].strip()
        motif = (item.get("motif") or "grid").strip()

        if entry_id in ids:
            raise SystemExit(f"Duplicate entry id: {entry_id}")
        if output_file in files:
            raise SystemExit(f"Duplicate output_file: {output_file}")
        if not output_file.endswith(".svg"):
            raise SystemExit(f"Entry {entry_id}: output_file must end with .svg")
        if motif not in ALLOWED_MOTIFS:
            raise SystemExit(f"Entry {entry_id}: motif must be one of {sorted(ALLOWED_MOTIFS)}")

        palette = dict(DEFAULT_PALETTE)
        if "palette" in item:
            if not isinstance(item["palette"], dict):
                raise SystemExit(f"Entry {entry_id}: palette must be an object")
            for key, value in item["palette"].items():
                if key not in DEFAULT_PALETTE:
                    raise SystemExit(f"Entry {entry_id}: unknown palette key '{key}'")
                if not isinstance(value, str) or not value.strip():
                    raise SystemExit(f"Entry {entry_id}: palette value for '{key}' must be a non-empty string")
                palette[key] = value.strip()

        ids.add(entry_id)
        files.add(output_file)
        out.append(
            Entry(
                id=entry_id,
                title=item["title"].strip(),
                subtitle=item["subtitle"].strip(),
                output_file=output_file,
                palette=palette,
                motif=motif,
            )
        )

    return out


def esc(text: str) -> str:
    return (
        text.replace("&", "&amp;")
        .replace("<", "&lt;")
        .replace(">", "&gt;")
        .replace('"', "&quot;")
        .replace("'", "&#39;")
    )


def motif_markup(kind: str, color: str) -> str:
    if kind == "bars":
        return f"""
  <g opacity="0.55">
    <rect x="70" y="250" width="36" height="80" fill="{color}"><animate attributeName="height" values="80;130;80" dur="2.4s" repeatCount="indefinite"/></rect>
    <rect x="120" y="220" width="36" height="110" fill="{color}"><animate attributeName="height" values="110;70;110" dur="2.1s" repeatCount="indefinite"/></rect>
    <rect x="170" y="200" width="36" height="130" fill="{color}"><animate attributeName="height" values="130;150;130" dur="2.7s" repeatCount="indefinite"/></rect>
  </g>"""
    if kind == "nodes":
        return f"""
  <g stroke="{color}" stroke-width="2" fill="none" opacity="0.7">
    <path d="M70 290 L150 220 L240 260 L320 190" />
    <circle cx="70" cy="290" r="7" fill="{color}"><animate attributeName="r" values="7;10;7" dur="1.8s" repeatCount="indefinite"/></circle>
    <circle cx="150" cy="220" r="7" fill="{color}"><animate attributeName="r" values="7;10;7" begin="0.4s" dur="1.8s" repeatCount="indefinite"/></circle>
    <circle cx="240" cy="260" r="7" fill="{color}"><animate attributeName="r" values="7;10;7" begin="0.8s" dur="1.8s" repeatCount="indefinite"/></circle>
    <circle cx="320" cy="190" r="7" fill="{color}"><animate attributeName="r" values="7;10;7" begin="1.2s" dur="1.8s" repeatCount="indefinite"/></circle>
  </g>"""
    if kind == "traces":
        return f"""
  <g fill="none" stroke="{color}" stroke-width="2" opacity="0.75">
    <path d="M56 250 C120 200 200 310 270 240 C340 180 430 290 500 240">
      <animate attributeName="stroke-dasharray" values="0 800;120 680;0 800" dur="3s" repeatCount="indefinite"/>
    </path>
    <path d="M56 300 C110 260 190 350 280 290 C350 250 430 320 520 280" opacity="0.6">
      <animate attributeName="stroke-dasharray" values="0 900;140 760;0 900" dur="3.6s" repeatCount="indefinite"/>
    </path>
  </g>"""
    return f"""
  <g stroke="{color}" stroke-opacity="0.45">
    <path d="M0 60 H800 M0 120 H800 M0 180 H800 M0 240 H800 M0 300 H800" />
    <path d="M80 0 V420 M160 0 V420 M240 0 V420 M320 0 V420 M400 0 V420" />
  </g>"""


def render_svg(entry: Entry) -> str:
    p = entry.palette
    return f"""<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"800\" height=\"420\" viewBox=\"0 0 800 420\" role=\"img\" aria-label=\"{esc(entry.title)} preview\">
  <defs>
    <linearGradient id=\"bg\" x1=\"0\" y1=\"0\" x2=\"1\" y2=\"1\">
      <stop offset=\"0%\" stop-color=\"{p['bg_start']}\"/>
      <stop offset=\"100%\" stop-color=\"{p['bg_end']}\"/>
    </linearGradient>
    <radialGradient id=\"halo\" cx=\"0.78\" cy=\"0.15\" r=\"0.8\">
      <stop offset=\"0%\" stop-color=\"{p['glow']}\" stop-opacity=\"0.32\"/>
      <stop offset=\"100%\" stop-color=\"{p['glow']}\" stop-opacity=\"0\"/>
    </radialGradient>
  </defs>
  <style>
    .scan {{ opacity: 0.24; }}
  </style>
  <rect width=\"800\" height=\"420\" rx=\"24\" fill=\"url(#bg)\"/>
  <rect width=\"800\" height=\"420\" rx=\"24\" fill=\"url(#halo)\"/>
  {motif_markup(entry.motif, p['accent'])}
  <rect class=\"scan\" x=\"0\" y=\"40\" width=\"800\" height=\"10\" fill=\"{p['accent']}\">
    <animate attributeName=\"y\" values=\"40;360;40\" dur=\"4.6s\" repeatCount=\"indefinite\"/>
  </rect>
  <rect x=\"34\" y=\"30\" width=\"732\" height=\"360\" rx=\"18\" fill=\"none\" stroke=\"{p['accent']}\" stroke-opacity=\"0.32\"/>
  <text x=\"58\" y=\"86\" fill=\"{p['muted']}\" font-family=\"Inter, Segoe UI, Arial\" font-size=\"20\">dashboard brand preview</text>
  <text x=\"58\" y=\"152\" fill=\"{p['text']}\" font-family=\"Inter, Segoe UI, Arial\" font-size=\"50\" font-weight=\"700\">{esc(entry.title)}</text>
  <text x=\"58\" y=\"196\" fill=\"{p['muted']}\" font-family=\"Inter, Segoe UI, Arial\" font-size=\"28\">{esc(entry.subtitle)}</text>
  <g transform=\"translate(58 258)\">
    <rect width=\"170\" height=\"44\" rx=\"11\" fill=\"{p['glow']}\" opacity=\"0.25\"/>
    <text x=\"22\" y=\"30\" fill=\"{p['text']}\" font-family=\"Inter, Segoe UI, Arial\" font-size=\"22\" font-weight=\"600\">Live App</text>
  </g>
  <g transform=\"translate(244 258)\">
    <rect width=\"170\" height=\"44\" rx=\"11\" fill=\"none\" stroke=\"{p['accent']}\" opacity=\"0.7\"/>
    <text x=\"25\" y=\"30\" fill=\"{p['text']}\" font-family=\"Inter, Segoe UI, Arial\" font-size=\"22\">Repository</text>
  </g>
</svg>
"""


def write_atomic(path: Path, content: str) -> str:
    path.parent.mkdir(parents=True, exist_ok=True)
    old = path.read_text(encoding="utf-8") if path.exists() else None
    if old == content:
        return "unchanged"

    with tempfile.NamedTemporaryFile("w", encoding="utf-8", delete=False, dir=path.parent) as tf:
        tf.write(content)
        tmp = Path(tf.name)
    tmp.replace(path)
    return "updated" if old is not None else "created"


def main() -> None:
    entries = load_manifest(MANIFEST_PATH)
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    counts = {"created": 0, "updated": 0, "unchanged": 0}
    for entry in entries:
        result = write_atomic(OUTPUT_DIR / entry.output_file, render_svg(entry))
        counts[result] += 1

    print(
        f"Generated {len(entries)} previews: "
        f"{counts['created']} created, {counts['updated']} updated, {counts['unchanged']} unchanged."
    )


if __name__ == "__main__":
    main()
