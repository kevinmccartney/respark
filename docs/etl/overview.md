# ETL overview

Respark ingests Magic: The Gathering card data into PostgreSQL so the app never depends on live provider APIs for catalog identity.

## Nomenclature

| Term      | Meaning                               | Storage                   |
| --------- | ------------------------------------- | ------------------------- |
| **Sync**  | One user-triggered pipeline execution | `ops.etl_sync`            |
| **Stage** | Ordered phase inside a sync           | `catalog` \| `enrichment` |
| **Job**   | Concrete work unit inside a stage     | see below                 |

```text
ETL Sync
├── Stage: catalog
│   └── Job: catalog          → Scryfall catalog (source of truth)
└── Stage: enrichment
    └── Job: identifiers      → Printing identifiers + commander flag (MTGJSON)
    └── (future) pricing, rulings, …
```

A sync may run catalog only, enrichment only, or both. Enrichment-only is allowed but assumes an existing catalog; the admin UI warns when Catalog is unchecked.

## Sources of truth

| Concern                                                                                               | Owner                         |
| ----------------------------------------------------------------------------------------------------- | ----------------------------- |
| Oracle identity, printings, sets, images, legality fields                                             | **Scryfall** (catalog job)    |
| Cross-provider IDs on existing printings (`mtgjson`, `tcgplayer`, `cardmarket`, `mtgo`, `multiverse`) | **MTGJSON** (identifiers job) |
| Commander eligibility (`catalog.card.leadership_skills` from MTGJSON `leadershipSkills`)              | **MTGJSON** (identifiers job) |
| Global EDHREC rank + game-changer (`catalog.card.edhrec_rank`, `is_game_changer`)                     | **Scryfall** (catalog job)    |
| EDHREC salt (`catalog.card.edhrec_saltiness`); `is_game_changer` only if Scryfall left it null        | **MTGJSON** (identifiers job) |

Enrichment **never creates** `catalog.printing` rows. Unmatched MTGJSON cards are recorded for review; they do not become catalog entities.

The catalog job skips Scryfall extras: `layout` art_series / token / double_faced_token / emblem / front_card / planar / scheme / vanguard, `set_type` token / memorabilia / minigame, digital-only cards (`digital: true`, `set_type` alchemy, or Alchemy `A-` name prefix — including rebalances nested in paper sets), and a bare `Card` face on the type line. They are not written to `catalog` or `raw`. Do not use empty or all-`not_legal` legalities for this (Un-sets and banned cards look the same). The identifiers job skips the same extras via MTGJSON `layout` and `type` so they do not show up as unmatched. Scryfall `/sets` enrich also skips digital-only sets so they are not inserted as empty catalog rows.

## Architecture

![ETL architecture](diagrams/architecture.svg)

| Surface                    | Role                                                               |
| -------------------------- | ------------------------------------------------------------------ |
| **etl lib** (`runEtlSync`) | Business logic + typed progress events                             |
| **API**                    | Calls the lib in-process; fans events out over WebSocket           |
| **CLI**                    | TTY / report adapter for break-glass maintenance (`task etl -- …`) |

Postgres `NOTIFY` on `ops.etl_sync` also refreshes the admin list when syncs are started from the CLI.

## Package layout

```text
apps/etl/src/
  index.ts                 # public exports
  cli.ts                   # commander TTY entrypoint
  lib/run-sync.ts          # orchestration
  core/stream-events.ts    # SyncEvent types
  sources/scryfall/        # catalog job
  sources/mtgjson/         # identifiers job
  repositories/            # SQL helpers
  commands/report.ts       # size report
```

The admin API imports this package from `apps/etl/dist` (see [operations](operations.md)). `task etl --` uses `tsx` on `src/` directly.

DDL and Drizzle schemas live in `apps/api` (`task db:migrate`).

## Related docs

- [Domain model (objects + ERDs)](../domain.md)
- [Data model](data-model.md)
- [Operations](operations.md)
- [Streaming](streaming.md)
