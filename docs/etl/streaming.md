# ETL streaming

Live admin updates use an **in-process event bus**.

## Lib contract

```ts
import { runEtlSync, type SyncEvent } from 'etl';

await runEtlSync(pool, logger, options, {
  onEvent: (event: SyncEvent) => {
    /* … */
  },
});
```

Important event types:

| `type`                                             | Meaning                         |
| -------------------------------------------------- | ------------------------------- |
| `sync.started` / `sync.updated` / `sync.completed` | Sync lifecycle                  |
| `job.started` / `job.completed`                    | Job lifecycle + metrics         |
| `job.progress`                                     | Throttled counters / percent    |
| `job.log`                                          | Notable messages                |
| `job.error`                                        | Per-record failure              |
| `job.unmatched`                                    | Sample unmatched identifier row |

The CLI does not require a stream protocol; it uses normal pino + stderr progress. The API always passes `onEvent` and publishes into `EtlSyncEventsService`.

Notable events (`job.log`, `job.started`, `job.completed`, `sync.completed`) are also written to `ops.etl_sync_log` so the admin detail page can show the log after the run. `job.progress` is not stored.

## WebSocket

- Path: `/admin/etl-syncs/ws?token=<Clerk JWT>`
- Auth: same admin role as HTTP (`publicMetadata.role === "admin"`)
- Client frames (Nest `ws` adapter): `{ "event": "subscribe", "data": { "channel": "list" } }` or `{ "channel": "sync", "syncId": "…" }`
- Server pushes: `{ "event": "etl", "data": <SyncEvent> }`

Admin pages:

- List subscribes to `list` (new rows, status, light progress).
- Detail loads `GET /admin/etl-syncs/:id/logs`, then subscribes to `sync` for that id (metrics, live log append, errors, unmatched).

## CLI break-glass

Syncs started with `task etl -- sync …` still write `ops.etl_sync` and `ops.etl_sync_log`. A Postgres `NOTIFY` trigger publishes list-oriented sync events so the admin table can refresh without the in-process lib path. Live WebSocket richness (progress / streamed unmatched) is API-started only; the persisted log is available for both paths.
