# Dashboard Brand + SVG Preview Generator

This folder contains reusable brand styles and a deterministic SVG preview generator for dashboard cards.

## Manifest format

File: `preview_manifest.json`

```json
{
  "entries": [
    {
      "id": "unique-id",
      "title": "Card title",
      "subtitle": "Short descriptor",
      "output_file": "preview.svg",
      "motif": "grid|bars|nodes|traces",
      "palette": {
        "bg_start": "#0e1730",
        "bg_end": "#132a57",
        "glow": "#59a8ff",
        "text": "#e9f1ff",
        "muted": "#93a7d1",
        "accent": "#7bdfff"
      }
    }
  ]
}
```

Required fields per entry:
- `id`
- `title`
- `subtitle`
- `output_file` (must end in `.svg`)

Optional fields:
- `motif`
- `palette` (partial override of the default palette)

## Generation command

```bash
python dashboard_brand/generate_previews.py
```

This validates the manifest, then writes generated SVGs to `dashboard_brand/previews/`.

## Add a new repo preview

1. Add a new entry in `preview_manifest.json` with a unique `id` and `output_file`.
2. Run `python dashboard_brand/generate_previews.py`.
3. Point the dashboard card image to `dashboard_brand/previews/<output_file>`.
4. Commit both manifest + generated SVG.

## Troubleshooting

- **No file generated:** confirm `output_file` ends with `.svg` and fields are non-empty.
- **Manifest validation fails:** check duplicate `id`/`output_file` and unknown `palette` keys.
- **Animation not visible:** ensure SVG is rendered inline/by browser image support; SMIL support can vary by environment.
