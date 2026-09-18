# respark ETL (MTG data pipeline)

Phase 1 skeleton: CLI + DB connectivity. Scryfall import comes in Phase 2.

## Commands

All entry points go through [Task](https://taskfile.dev/) from the repo root (not `npm run etl`):

```bash
task db:up
task db:migrate

task etl -- --help
task etl -- ping                 # SELECT 1 against DATABASE_URL
task etl -- scryfall --limit 1000   # stub until Phase 2
task etl -- justtcg                 # JustTCG prices (later phase)
```

`DATABASE_URL` comes from `apps/etl/.env` only (this package does not load `apps/api` env files — they deploy separately). Same local Postgres host/credentials as the API is fine; duplicate the URL into `apps/etl/.env`.

## Layout

```text
apps/etl/src/
  cli.ts           # commander entry
  core/db.ts       # env + pg pool
  core/logger.ts
  core/types.ts
```

Pipeline DDL (`raw` / `catalog` / `market` / `ops` / `app` schemas and `ops.ingestion_run`) lives in the shared API Drizzle migrations — run `task db:migrate`.
