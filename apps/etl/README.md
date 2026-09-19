# respark ETL (MTG data pipeline)

Nomenclature:

| Term | Meaning |
| --- | --- |
| **Sync** | One user-triggered pipeline execution (`ops.etl_sync`) |
| **Stage** | Ordered phase: `catalog` \| `enrichment` |
| **Job** | Work unit inside a stage (`catalog`, `identifiers`, …) |

**Catalog stage** — job `catalog` (Scryfall catalog; source of truth).

**Enrichment stage** — job `identifiers` today (Printing identifiers via MTGJSON). Never creates printings.

## Library vs CLI

Business logic lives in the **etl lib** (`runEtlSync` from package `etl`). Callers supply an optional `onEvent` sink for live progress.

| Interface | Role |
| --- | --- |
| **API** | Imports the lib in-process; forwards events over WebSocket to admin |
| **CLI** | TTY / report adapter for break-glass DB maintenance |

```bash
# CLI report mode (human logs + progress bar)
task etl -- sync --catalog --limit 10
task etl -- sync --enrichment identifiers --limit 50
task etl -- sync --catalog --enrichment identifiers
```

Deprecated aliases: `scryfall` / `mtgjson` / `full`.

## Setup

```bash
cp apps/etl/.env.example apps/etl/.env   # DATABASE_URL for this package only
task db:up
task db:migrate
```

## Reconciliation

After the identifiers job completes, results are stored against that job run:

- `ops.ingestion_reconciliation`
- `ops.ingestion_unmatched`
- Ambiguous detail → `ops.ingestion_error` (`stage = reconcile`)

View in admin on `/syncs/:id` (live while a sync runs via WebSocket).

## Layout

```text
apps/etl/src/
  index.ts            # package exports (lib)
  cli.ts              # TTY interface
  lib/run-sync.ts     # orchestration
  core/stream-events.ts
  sources/scryfall/
  sources/mtgjson/
  repositories/
```

DDL lives in API Drizzle migrations (`task db:migrate`).
