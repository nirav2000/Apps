# Read-only adapter mode

`read-only-adapter` is the preferred historical replay mode for apps that need live data to render meaningfully but must never mutate production state.

## Behaviour

At checkpoint creation Version Lab injects a frozen copy of the shared read-only runtime before historical application scripts.

The runtime allows normal GET/HEAD reads to the snapshot origin and explicitly allow-listed service origins; permits selected POST-based read protocols needed by Firestore/query transports; blocks known Firestore commit/batch-write/write-channel endpoints; blocks request bodies that look like writes; blocks unrecognised PUT/PATCH/DELETE and non-read POST requests; disables sendBeacon, WebSockets and HTML form submission by default; and emits `version-lab:blocked-write` events when old code attempts a mutation.

The runtime is copied into each checkpoint, so future changes to the shared adapter cannot silently change an old checkpoint.

## Configuration

```json
{
  "snapshotSafety": "read-only-adapter",
  "readOnlyAdapter": {
    "allowedOrigins": [
      "https://firestore.googleapis.com",
      "https://identitytoolkit.googleapis.com",
      "https://example-worker.workers.dev"
    ],
    "allowReadPostPatterns": [
      ":runQuery",
      ":batchGet",
      "/Listen/channel",
      "/api/read"
    ]
  }
}
```

Keep the allowlist narrow. Where practical, app-specific Workers should expose explicit read endpoints.

## Limit

This is a network mutation guard, not a historical database backup. A historical UI may still be reading today's data unless a checkpoint is paired with a frozen data fixture or dedicated read-only historical backend.

For sensitive data, prefer a dedicated historical fixture/read-only backend over browser interception alone.
