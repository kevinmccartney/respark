# respark ETL (MTG data pipeline)

Phase 2: Scryfall bulk → `raw.scryfall_card` (no catalog normalization yet).

## Setup

```bash
cp apps/etl/.env.example apps/etl/.env   # DATABASE_URL for this package only
task db:up
task db:migrate
```

## Commands

```bash
task etl -- --help
task etl -- ping

# Sample import (acceptance: 1000 rows in raw.scryfall_card + ops.ingestion_run)
task etl -- scryfall --limit 1000

# Re-run should mostly count unchanged
task etl -- scryfall --limit 1000

task etl -- scryfall --limit 100 --dry-run
task etl -- scryfall --limit 100 --no-store-raw
```

Sources still stubbed: `mtgjson`, `justtcg`. Utilities stubbed: `all`, `report`, `forecast`.

## Layout

```text
apps/etl/src/
  cli.ts
  core/           # db, logger, hashing, types
  sources/scryfall/
  repositories/   # raw + ingestion_run SQL (pg, not Drizzle)
```

DDL for `raw.*` / `ops.*` lives in API Drizzle migrations (`task db:migrate`).
