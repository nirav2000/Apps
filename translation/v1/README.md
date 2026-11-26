# Translation gateway v1

A dedicated owner-only Cloudflare Worker for Translation Lab. The private application source remains in Biz under ideas/translation-lab. This shared implementation does not access learning data or change App Monitor.

## Deployment authority

The successful isolated deployment route is **nirav2000/snag**, workflow .github/workflows/deploy-translation-lab.yml, which checks out a pinned Apps commit. Kk-syllabus's Cloudflare token is restricted and rejected new Worker creation; do not broaden it or retry that route. The Worker is named translation-lab and serves https://translation-lab.nirav2000-github.workers.dev/ . No existing Worker is changed. Use the existing Firebase signing account only within Kk-syllabus CI for live verification; do not copy it to the Worker.

## Security and cost

Firebase ID tokens use Google's public RS256 signing keys and exact owner/project/issuer/expiry claims. CORS permits the Pages origin; signed authentication, not CORS, protects the endpoint. No user-supplied provider URL receives a Firebase token. The quota Durable Object enforces per-UTC-day limits: Google 12,000 source characters, DeepL 12,000 source characters, Workers AI 10 requests. Provider limits and billing are separate; there is no guarantee of zero cost from these guards alone.

Google Cloud Translation API requires billing and API enablement. On 26 November 2026 CI found the kk-syllabus Cloud Translation API DISABLED and the billing inspection denied (HTTP 403); neither Kk-syllabus nor Snag had the recognized optional translation secrets. Do not enable billing or reuse a Firebase web key for billable translations. The free manual Google Translate and Apple Translate workflows remain available. DeepL is optional. Google Apps Script LanguageApp is a possible free-quota alternative, but its deployment API needs user OAuth, not the existing service account; it has not been connected.

Run node --test worker.test.mjs. For live authorised requests, use Kk-syllabus .github/workflows/translation-lab-cloud-check.yml. That verifies an isolated synthetic Firestore record, deletes it using the existing authorised service account, and checks the gateway with a genuine Firebase ID token; no real learning data is read or changed.
