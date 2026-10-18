# AI Atlas evidence and publication
Public-facing independent research dashboard: `/ai-atlas/`, linked from App Monitor. Static hosting, no credentials or Firebase required.
## Editorial principles
- Store original source and reporting period for every number.
- Keep historical evidence append-only; revisions must be explicit.
- Never present monthly company spending when only quarterly reports exist.
- Microsoft fiscal years end in June; Alphabet, Amazon and Meta use calendar years.
- Annual capex is company-wide, not an AI-only number; definitions and finance leases differ.
- Model benchmark versions and variants must be held constant before comparing scores.
- An open-weight model may not meet the Open Source Initiative definition.
- Prices shown are nominal and may exclude caching, long context, batching and reasoning costs.
## Data files
- `data/history.json`: curated 2020–2026 history with dated release events, annual/quarterly investment, token pricing and provenance.
- `data/2026-10-18.json`: frozen original October 2026 research baseline.
- `data/provider-snapshots/YYYY-MM-DD.json`: immutable daily public OpenRouter API snapshots after successful scheduled collection. Router prices are *not* provider-direct rates. They are raw evidence for later quality-controlled analysis, not automatically mixed into editorial comparisons.
## Validation
Run `node ai-atlas/scripts/validate.mjs`. The daily workflow validates JS syntax, source integrity and record shape before collecting the public catalog. A network error fails the run rather than fabricating data. The workflow commits only a new dated snapshot to main.
## Outstanding research work
Backfill complete direct-provider pricing changes for all relevant vendors, SEC filing based quarterly series for all four hyperscalers, benchmark scores with frozen suite/version, AI-specific customer revenue and demand where disclosed, electricity and GPU deployment, and local-model total-cost-of-ownership calculator. Historical datasets are partial, not comprehensive.
