# ETL operations

## Prerequisites

```bash
cp apps/etl/.env.example apps/etl/.env   # DATABASE_URL for CLI
task db:up
task db:migrate
```

API/admin syncs use the API’s `DATABASE_URL` (Compose or `apps/api/.env`).

## CLI (report / break-glass)

```bash
task etl -- --help
task etl -- ping

# Catalog only
task etl -- sync --catalog
task etl -- sync --catalog --limit 1000

# Enrichment only (Printing identifiers)
task etl -- sync --enrichment identifiers
task etl -- sync --enrichment identifiers --demo-mismatches

# Both stages
task etl -- sync --catalog --enrichment identifiers

# Skip persisting raw payloads
task etl -- sync --catalog --no-store-raw

# Database size → reports/etl-size-report.json
task etl -- report
```

Useful flags (global): `--limit`, `--dry-run`, `--verbose`, `--store-raw` / `--no-store-raw`.

## Admin UI

1. Open the admin app (`http://localhost:4000` via Compose).
2. Ensure Clerk `publicMetadata.role === "admin"`.
3. On **ETL syncs**, choose Catalog and/or Enrichment → **Start sync**.
4. List and detail pages update live over WebSocket (see [streaming](streaming.md)).

API:

| Method | Path                                                 | Notes                                |
| ------ | ---------------------------------------------------- | ------------------------------------ |
| `POST` | `/admin/etl-syncs`                                   | `{ catalog, enrichmentJobs? }` → 202 |
| `GET`  | `/admin/etl-syncs`                                   | List                                 |
| `GET`  | `/admin/etl-syncs/:id`                               | Sync + nested stages/jobs            |
| `GET`  | `/admin/etl-syncs/:id/jobs/:jobRunId/errors`         | Paginated                            |
| `GET`  | `/admin/etl-syncs/:id/jobs/:jobRunId/reconciliation` | Identifiers job                      |
| `GET`  | `/admin/etl-syncs/:id/jobs/:jobRunId/unmatched`      | Identifiers job                      |

Conflict rule: starting a sync fails while any sync is `running`.

## Size report

After imports:

```bash
task etl -- report
```

Writes `reports/etl-size-report.json` (schema/table sizes, row counts, recent job metrics). Use this when sizing RDS or deciding whether to keep raw payloads.

## Env knobs

| Variable         | Where     | Purpose                                   |
| ---------------- | --------- | ----------------------------------------- |
| `DATABASE_URL`   | etl / api | Postgres connection                       |
| `ETL_STORE_RAW`  | etl       | Default raw persistence (`false` to skip) |
| `ETL_BATCH_SIZE` | etl       | Upsert batch size (default 500)           |
