# ETL data model

Pipeline and app data use dedicated Postgres schemas. Application tables (`users`, `decks`) live in `app`.

Business-object write-ups and Mermaid ERDs: [Domain model](../domain.md). This page is the compact schema/table list.

## Schemas

| Schema    | Purpose                                                                      |
| --------- | ---------------------------------------------------------------------------- |
| `raw`     | Provider payloads (optional; toggle with `--no-store-raw` / `ETL_STORE_RAW`) |
| `catalog` | Canonical card/set/printing model (Scryfall-owned identity)                  |
| `ops`     | Sync/job runs, errors, reconciliation                                        |
| `market`  | Reserved for future pricing observations                                     |
| `app`     | App-owned domain tables (`users`, `decks`, …)                                |

## Ops (runs)

### `ops.etl_sync`

One row per sync.

| Column                                          | Notes                                                                         |
| ----------------------------------------------- | ----------------------------------------------------------------------------- |
| `status`                                        | `running` \| `success` \| `partial_success` \| `failed` (rolled up from jobs) |
| `include_catalog` / `include_enrichment`        | Stages selected                                                               |
| `enrichment_jobs`                               | e.g. `{identifiers}`                                                          |
| `started_at` / `completed_at` / `error_message` | Lifecycle                                                                     |

### `ops.etl_job_run`

One row per job inside a sync.

| Column                          | Notes                                                            |
| ------------------------------- | ---------------------------------------------------------------- |
| `sync_id`                       | FK → `etl_sync` (CASCADE)                                        |
| `stage` / `job`                 | e.g. `catalog`/`catalog`, `enrichment`/`identifiers`             |
| metrics                         | `records_*`, `progress_percent`, `download_bytes`, `duration_ms` |
| `source_version` / `source_url` | Provider bulk metadata                                           |

### `ops.etl_sync_log`

Notable messages for the admin log panel (`job.log`, job start/complete, sync complete). Not progress ticks.

| Column                         | Notes                                  |
| ------------------------------ | -------------------------------------- |
| `sync_id`                      | FK → `etl_sync` (CASCADE)              |
| `job_run_id`                   | Optional FK → `etl_job_run` (SET NULL) |
| `level` / `message` / `fields` | Same shape as a `job.log` event        |

### `ops.ingestion_error`

Per-record failures (validate/transform/reconcile). `run_id` points at the **job run**. Column `stage` here is the processing step, not the sync stage.

### `ops.ingestion_reconciliation` / `ops.ingestion_unmatched`

Identifiers-job summary and sampled unmatched MTGJSON rows (keyed by job-run id).

## App

| Table           | Role                                                                                                                      |
| --------------- | ------------------------------------------------------------------------------------------------------------------------- |
| `app.users`     | Local identity + Clerk profile cache (`clerk_user_id`)                                                                    |
| `app.decks`     | User decks (`user_id` → `app.users`; optional `description`; `format`: `standard` \| `commander` \| `modern`)             |
| `app.deck_card` | Deck lines (`printing_id` → `catalog.printing`, `foil`, `sideboard`, quantity; unique per deck + printing + foil + board) |

Keeping identity in `app` (not a separate `users` schema) matches the other domain boundaries: one schema per product surface, not per table.

## Catalog (canonical)

| Table                         | Role                                                                                         |
| ----------------------------- | -------------------------------------------------------------------------------------------- |
| `catalog.card`                | Conceptual / oracle card (`oracle_id` from Scryfall). Excludes type lines with a `Card` face |
| `catalog.set`                 | Set metadata                                                                                 |
| `catalog.printing`            | One physical (or digital) printing                                                           |
| `catalog.card_face`           | Faces for multi-face layouts                                                                 |
| `catalog.printing_identifier` | External IDs per printing (`provider` + `external_id`)                                       |

Internal PKs are UUIDs. Third-party IDs are unique constraints / identifier rows, not primary keys.

## Raw

| Table               | Role                                                                    |
| ------------------- | ----------------------------------------------------------------------- |
| `raw.scryfall_card` | Scryfall bulk card JSON (+ hash)                                        |
| `raw.mtgjson_card`  | MTGJSON AllIdentifiers JSON (+ hash). `Card`-face extras are not stored |

Raw can dominate disk (~¾ of local DB size with both providers stored). Catalog-only is much smaller.

## Migrations

Schemas and tables are owned by Drizzle under `apps/api/drizzle/`. Apply with:

```bash
task db:migrate
```

Source of truth for columns: `apps/api/src/db/schema/`.
