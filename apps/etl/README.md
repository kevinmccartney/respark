# respark ETL (MTG data pipeline)

Phase 3: Scryfall bulk → `raw.scryfall_card` **and** `catalog.*` (card / set / printing / faces / identifiers).

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

# Sample import (raw + catalog)
task etl -- scryfall --limit 1000

# Re-run should mostly count unchanged printings
task etl -- scryfall --limit 1000

task etl -- scryfall --limit 100 --dry-run
task etl -- scryfall --limit 100 --no-store-raw   # catalog only
```

Sources still stubbed: `mtgjson`, `justtcg`. Utilities stubbed: `all`, `report`, `forecast`.

## Layout

```text
apps/etl/src/
  cli.ts
  core/
  sources/scryfall/   # client, stream, schema, transformer, importer
  repositories/       # raw + catalog + ingestion_run (pg)
```

DDL lives in API Drizzle migrations (`task db:migrate`).
