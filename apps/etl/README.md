# respark ETL (MTG data pipeline)

Nomenclature:

| Term | Meaning |
| --- | --- |
| **Sync** | One user-triggered pipeline execution (`ops.etl_sync`) |
| **Stage** | Ordered phase: `catalog` \| `enrichment` |
| **Job** | Work unit inside a stage (`catalog`, `identifiers`, …) |

**Catalog stage** — job `catalog` (Scryfall catalog; source of truth).

**Enrichment stage** — job `identifiers` today (Printing identifiers via MTGJSON). Never creates printings.

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

# Catalog only
task etl -- sync --catalog
task etl -- sync --catalog --limit 1000

# Enrichment only (Printing identifiers) — requires existing catalog
task etl -- sync --enrichment identifiers
task etl -- sync --enrichment identifiers --limit 2000
task etl -- sync --enrichment identifiers --demo-mismatches

# Both stages
task etl -- sync --catalog --enrichment identifiers
task etl -- sync --catalog --enrichment identifiers --limit 500

# DB size → reports/etl-size-report.json
task etl -- report
```

Deprecated aliases (one release): `scryfall` → catalog; `mtgjson` → enrichment identifiers; `full` → both.

### Reconciliation

After the identifiers job completes, results are stored against that job run:

- `ops.ingestion_reconciliation`
- `ops.ingestion_unmatched`
- Ambiguous detail → `ops.ingestion_error` (`stage = reconcile`)

View in admin on `/syncs/:id`, or:

- `GET /admin/etl-syncs/:id/jobs/:jobRunId/reconciliation`
- `GET /admin/etl-syncs/:id/jobs/:jobRunId/unmatched`

Utility still stubbed: `forecast`.

## Layout

```text
apps/etl/src/
  cli.ts
  commands/           # sync, report
  core/
  sources/scryfall/   # catalog job
  sources/mtgjson/    # identifiers enrichment job
  repositories/
```

DDL lives in API Drizzle migrations (`task db:migrate`).
