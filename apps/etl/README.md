# respark ETL (MTG data pipeline)

Phase 4: full Scryfall bulk → `raw.scryfall_card` + `catalog.*`, then size report.

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

# Full import (raw + catalog) — no --limit
task etl -- scryfall

# Re-run should mostly count unchanged printings
task etl -- scryfall

# Sample / dry-run helpers
task etl -- scryfall --limit 1000
task etl -- scryfall --limit 100 --dry-run
task etl -- scryfall --limit 100 --no-store-raw   # catalog only

# DB size + latest ingestion metrics → reports/etl-size-report.json
task etl -- report
```

Sources still stubbed: `mtgjson`, `justtcg`. Utility stubbed: `all`, `forecast`.

## Layout

```text
apps/etl/src/
  cli.ts
  commands/           # report (size metrics)
  core/
  sources/scryfall/   # client, stream, schema, transformer, importer
  repositories/       # raw + catalog + ingestion_run (pg)
```

DDL lives in API Drizzle migrations (`task db:migrate`).
