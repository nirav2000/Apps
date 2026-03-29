# Apps

A no-framework HTML/CSS/JS dashboard that aggregates GitHub Pages apps into one place.

## Features

- Curated app blurbs for `nirav2000` repositories with GitHub Pages enabled.
- Reusable dashboard brand system in `dashboard_brand/` with generated animated SVG previews.
- Static generated SVG artifacts committed under `dashboard_brand/previews/`.
- Live fallback screenshot-style previews (with GitHub OpenGraph fallback if images fail).
- Improved aligned controls with live filtering by app/repository name.
- Sorting by name or latest update.
- Direct links to each deployed app and source repository.
- Fallback mode for other usernames/orgs using live GitHub API discovery.

## Run locally

Open `index.html` in a browser.

## Regenerate branded previews

```bash
python dashboard_brand/generate_previews.py
```
