#!/usr/bin/env python3
from __future__ import annotations
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent
MANIFEST = ROOT / "preview_manifest_ml_style.json"
OUT_DIR = ROOT / "previews"
OUT_DIR.mkdir(parents=True, exist_ok=True)


def escape(value: str) -> str:
    return (
        value.replace("&", "&amp;")
        .replace("<", "&lt;")
        .replace(">", "&gt;")
        .replace('"', "&quot;")
        .replace("'", "&#39;")
    )


def dashboard_art() -> str:
    return '''
    <g opacity="0.95">
      <rect x="84" y="154" width="1032" height="88" rx="18" fill="#0e2441" stroke="#3c5f8d"/>
      <rect x="108" y="176" width="240" height="44" rx="12" fill="#0b1f3a" stroke="#456b9a"/>
      <rect x="368" y="176" width="240" height="44" rx="12" fill="#0b1f3a" stroke="#456b9a"/>
      <rect x="628" y="176" width="176" height="44" rx="12" fill="#0b1f3a" stroke="#456b9a"/>
      <rect id="loadBtn" x="824" y="176" width="268" height="44" rx="12" fill="#4f95ff">
        <animate attributeName="fill" values="#4f95ff;#6db0ff;#4f95ff" dur="2.6s" repeatCount="indefinite"/>
      </rect>
      <text x="906" y="204" fill="#ffffff" font-family="Inter, Segoe UI, Arial" font-size="20" font-weight="700">Load Apps</text>

      <g id="cardsGroup">
        <rect x="84" y="268" width="330" height="384" rx="22" fill="#132847" stroke="#3f6494"/>
        <rect x="434" y="268" width="330" height="384" rx="22" fill="#132847" stroke="#3f6494"/>
        <rect x="784" y="268" width="330" height="384" rx="22" fill="#132847" stroke="#3f6494"/>

        <rect x="84" y="268" width="330" height="176" rx="22" fill="#10305a"/>
        <rect x="434" y="268" width="330" height="176" rx="22" fill="#10305a"/>
        <rect x="784" y="268" width="330" height="176" rx="22" fill="#10305a"/>

        <rect x="112" y="590" width="126" height="38" rx="12" fill="#7bb1ff"/>
        <rect x="252" y="590" width="126" height="38" rx="12" fill="none" stroke="#5c83b5"/>
        <rect x="462" y="590" width="126" height="38" rx="12" fill="#7bb1ff"/>
        <rect x="602" y="590" width="126" height="38" rx="12" fill="none" stroke="#5c83b5"/>
        <rect x="812" y="590" width="126" height="38" rx="12" fill="#7bb1ff"/>
        <rect x="952" y="590" width="126" height="38" rx="12" fill="none" stroke="#5c83b5"/>
        <animateTransform attributeName="transform" type="translate" values="0 0; 0 -26; 0 0" dur="7s" repeatCount="indefinite"/>
      </g>

      <path d="M970 306 L986 334 L998 328 L982 300 Z" fill="#e9f1ff" stroke="#1f3558" stroke-width="2">
        <animateTransform attributeName="transform" type="translate" values="-70 -58; 0 0; 0 0" dur="7s" repeatCount="indefinite"/>
      </path>
      <circle cx="998" cy="328" r="0" fill="#7bb1ff" opacity="0.6">
        <animate attributeName="r" values="0;18;0" begin="2.1s" dur="0.8s" repeatCount="indefinite"/>
      </circle>
    </g>
    '''


def evolution_art() -> str:
    return '''
    <g opacity="0.92">
      <rect x="84" y="154" width="1032" height="510" rx="24" fill="#0f203b" stroke="#3d5c8b"/>
      <rect x="84" y="154" width="1032" height="62" rx="24" fill="#122a4d"/>
      <text x="116" y="194" fill="#eaf2ff" font-family="Inter, Segoe UI, Arial" font-size="26" font-weight="700">Pong Evolution</text>
      <text x="930" y="194" fill="#ffc76b" font-family="Inter, Segoe UI, Arial" font-size="22">Generation 128</text>

      <rect x="126" y="250" width="860" height="330" rx="14" fill="#0a1528" stroke="#2d4770"/>
      <line x1="556" y1="262" x2="556" y2="568" stroke="#2f4d78" stroke-dasharray="8 10"/>
      <rect x="150" y="360" width="16" height="92" rx="6" fill="#7bb1ff">
        <animate attributeName="y" values="360;300;392;330;360" dur="3.8s" repeatCount="indefinite"/>
      </rect>
      <rect x="946" y="352" width="16" height="92" rx="6" fill="#ffc76b">
        <animate attributeName="y" values="352;392;300;360;352" dur="3.8s" repeatCount="indefinite"/>
      </rect>
      <circle cx="556" cy="414" r="9" fill="#f5f8ff">
        <animate attributeName="cx" values="556;860;270;780;556" dur="3.8s" repeatCount="indefinite"/>
        <animate attributeName="cy" values="414;320;470;280;414" dur="3.8s" repeatCount="indefinite"/>
      </circle>

      <polyline points="140,624 250,604 360,592 470,560 580,548 690,510 800,498 910,462"
                fill="none" stroke="#5fe2c2" stroke-width="4" opacity="0.85">
        <animate attributeName="points"
                 values="140,624 250,604 360,592 470,560 580,548 690,510 800,498 910,462;
                         140,628 250,612 360,578 470,566 580,536 690,520 800,488 910,470;
                         140,624 250,604 360,592 470,560 580,548 690,510 800,498 910,462"
                 dur="5.2s" repeatCount="indefinite"/>
      </polyline>
      <text x="124" y="640" fill="#a6b5cf" font-family="Inter, Segoe UI, Arial" font-size="18">Fitness trend</text>
    </g>
    '''


def build_svg(entry: dict) -> str:
    title = escape(entry.get("title", "App Preview"))
    subtitle = escape(entry.get("subtitle", "Interactive app preview"))
    tag = escape(entry.get("tag", "Preview"))
    variant = entry.get("variant", "dashboard")

    art = evolution_art() if variant == "evolution" else dashboard_art()

    return f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 760" role="img" aria-label="{title} preview">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#0a1426"/>
      <stop offset="100%" stop-color="#07111f"/>
    </linearGradient>
    <radialGradient id="glowA" cx="0.12" cy="0.08" r="0.8">
      <stop offset="0%" stop-color="#78a6ff" stop-opacity="0.32"/>
      <stop offset="100%" stop-color="#78a6ff" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="glowB" cx="0.88" cy="0.12" r="0.7">
      <stop offset="0%" stop-color="#5fe2c2" stop-opacity="0.24"/>
      <stop offset="100%" stop-color="#5fe2c2" stop-opacity="0"/>
    </radialGradient>
  </defs>

  <rect width="1200" height="760" rx="44" fill="url(#bg)"/>
  <rect width="1200" height="760" rx="44" fill="url(#glowA)">
    <animate attributeName="opacity" values="0.72;1;0.72" dur="8s" repeatCount="indefinite"/>
  </rect>
  <rect width="1200" height="760" rx="44" fill="url(#glowB)">
    <animate attributeName="opacity" values="1;0.75;1" dur="6.6s" repeatCount="indefinite"/>
  </rect>

  <rect x="60" y="44" width="1080" height="94" rx="22" fill="#10213b" stroke="#2f4d78"/>
  <text x="90" y="88" fill="#f3f7ff" font-family="Inter, Segoe UI, Arial" font-size="42" font-weight="700">{title}</text>
  <text x="90" y="120" fill="#a6b5cf" font-family="Inter, Segoe UI, Arial" font-size="24">{subtitle}</text>
  <rect x="986" y="66" width="128" height="44" rx="22" fill="rgba(120,166,255,0.18)" stroke="#78a6ff"/>
  <text x="1024" y="95" fill="#cfe0ff" font-family="Inter, Segoe UI, Arial" font-size="20">{tag}</text>

  {art}
</svg>'''


def main() -> None:
    payload = json.loads(MANIFEST.read_text(encoding="utf-8"))
    for entry in payload.get("previews", []):
        slug = entry["slug"]
        out = OUT_DIR / f"{slug}.svg"
        out.write_text(build_svg(entry), encoding="utf-8")
        print(f"wrote {out.name}")


if __name__ == "__main__":
    main()
