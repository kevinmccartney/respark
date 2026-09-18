# MTG Data Pipeline — Implementation Plan

## Objective

Build a local-first ETL pipeline that ingests Magic: The Gathering data from external sources into PostgreSQL.

Initial sources:

1. Scryfall
   - Primary source for cards, printings, sets, oracle data, images, legality, and related metadata.
   - Prefer Scryfall bulk data rather than per-card API calls.

2. MTGJSON
   - Supplemental source.
   - Primarily used for cross-provider identifiers and data not conveniently available from Scryfall.

3. JustTCG
   - Market/pricing source.
   - Implement after the catalog pipeline is stable.
   - Store historical price observations separately from card metadata.

The pipeline must run identically:

- locally against Dockerized PostgreSQL
- later as a scheduled worker in AWS

Environment/configuration should be the only difference between local and deployed execution.

Do NOT introduce Kafka, Airflow, Spark, or other distributed data infrastructure.

A normal application process/container and PostgreSQL are sufficient.

---

# 1. Architecture

Target architecture:

```text
External Sources
    |
    +-- Scryfall
    +-- MTGJSON
    +-- JustTCG
    |
    v
ETL Worker
    |
    +-- download
    +-- stage raw payloads
    +-- normalize
    +-- reconcile identities
    +-- upsert canonical records
    +-- collect metrics
    |
    v
PostgreSQL
    |
    +-- raw
    +-- catalog
    +-- market
    +-- ops
    +-- app
```

The application should eventually read canonical data from PostgreSQL.

The application should NOT rely on calling Scryfall, MTGJSON, or JustTCG during normal request handling.

External providers are data sources, not the application's domain model.

---

# 2. Technology

Prefer the existing project's language/runtime if practical.

If there is no existing backend preference, use:

- Node.js
- TypeScript
- PostgreSQL
- Docker Compose
- a lightweight PostgreSQL client such as `pg`
- Zod or equivalent for runtime validation
- native `fetch`
- streaming JSON parsing when appropriate

Avoid tying the ETL architecture too closely to an ORM.

SQL migrations should be explicit and inspectable.

The ETL worker should be executable through CLI commands.

Examples:

```bash
npm run etl:scryfall
npm run etl:mtgjson
npm run etl:prices
npm run etl:all
npm run etl:report
```

---

# 3. Local Development Environment

Create a Docker Compose configuration containing at minimum:

```text
postgres
```

Optionally include the ETL worker as a container, but the worker must also be runnable directly from the host during development.

Example local configuration:

```text
POSTGRES_HOST=localhost
POSTGRES_PORT=5432
POSTGRES_DB=mtg
POSTGRES_USER=mtg
POSTGRES_PASSWORD=mtg
```

Provide commands such as:

```bash
docker compose up -d postgres

npm run db:migrate

npm run etl:scryfall

npm run etl:report
```

The local database must persist using a Docker volume so that imported data survives container restarts.

Provide a reset command:

```bash
npm run db:reset
```

This should explicitly destroy/recreate only the local development database.

---

# 4. PostgreSQL Schemas

Create these PostgreSQL schemas:

```sql
CREATE SCHEMA raw;
CREATE SCHEMA catalog;
CREATE SCHEMA market;
CREATE SCHEMA ops;
CREATE SCHEMA app;
```

Responsibilities:

## raw

Provider-specific source data.

Used for:

- debugging
- replaying transformations
- preserving fields not yet represented in the canonical schema
- tracking exactly what a provider supplied

## catalog

Canonical Magic domain model.

Contains cards, printings, sets, card faces, external identifiers, etc.

## market

Pricing and market observations.

Must remain logically separate from catalog metadata.

## ops

ETL operational state, runs, metrics, errors, and source metadata.

## app

Application-specific/user-owned data.

Examples:

- user collections
- decks
- wishlists
- acquisition prices
- tags

ETL jobs must never overwrite `app` data.

---

# 5. Canonical Identity Model

The schema must distinguish between:

1. a conceptual Magic card
2. a particular printing of that card

Example:

```text
Lightning Bolt
    |
    +-- Alpha
    +-- Beta
    +-- Unlimited
    +-- Revised
    +-- Magic 2010
    +-- Double Masters
    +-- Secret Lair
```

Use internal UUID primary keys.

Do not use a third-party identifier as the database primary key.

---

# 6. `catalog.card`

Represents the conceptual/oracle card.

Initial fields:

```text
id UUID PK

oracle_id UUID UNIQUE NOT NULL

name TEXT NOT NULL

mana_cost TEXT
mana_value NUMERIC

type_line TEXT
oracle_text TEXT

colors TEXT[]
color_identity TEXT[]

keywords TEXT[]

layout TEXT

reserved BOOLEAN

created_at TIMESTAMPTZ
updated_at TIMESTAMPTZ
```

The canonical external identity for a conceptual card is Scryfall `oracle_id`.

Internal code should use `catalog.card.id`.

---

# 7. `catalog.set`

Suggested initial fields:

```text
id UUID PK

scryfall_id UUID UNIQUE

code TEXT UNIQUE NOT NULL
name TEXT NOT NULL

set_type TEXT

released_at DATE

card_count INTEGER

digital BOOLEAN

parent_set_code TEXT

icon_svg_uri TEXT

created_at TIMESTAMPTZ
updated_at TIMESTAMPTZ
```

---

# 8. `catalog.printing`

Represents a specific printed version.

Suggested fields:

```text
id UUID PK

card_id UUID FK -> catalog.card.id

set_id UUID FK -> catalog.set.id

scryfall_id UUID UNIQUE NOT NULL

collector_number TEXT NOT NULL

language TEXT

rarity TEXT

artist TEXT

released_at DATE

border_color TEXT
frame TEXT

full_art BOOLEAN
textless BOOLEAN
oversized BOOLEAN
promo BOOLEAN
reprint BOOLEAN

image_small TEXT
image_normal TEXT
image_large TEXT
image_png TEXT

created_at TIMESTAMPTZ
updated_at TIMESTAMPTZ
```

Do not model every Scryfall property initially.

Keep the complete source payload in `raw`.

Add normalized fields as application requirements emerge.

---

# 9. Card Faces

Cards may have multiple faces.

Create:

```text
catalog.card_face
```

Suggested fields:

```text
id UUID PK
printing_id UUID FK

face_index INTEGER

name TEXT
mana_cost TEXT
type_line TEXT
oracle_text TEXT

colors TEXT[]

power TEXT
toughness TEXT
loyalty TEXT
defense TEXT

image_normal TEXT
image_large TEXT
```

Use:

```text
UNIQUE(printing_id, face_index)
```

Do not assume every Magic card has exactly one face.

---

# 10. External Identifiers

Do not add dozens of nullable provider-ID columns to `printing`.

Create:

```text
catalog.printing_identifier
```

Schema:

```text
printing_id UUID FK

provider TEXT
external_id TEXT

created_at TIMESTAMPTZ
updated_at TIMESTAMPTZ
```

Constraints:

```text
PRIMARY KEY (printing_id, provider, external_id)

UNIQUE(provider, external_id)
```

Example rows:

```text
printing ABC
scryfall
728bf...

printing ABC
tcgplayer
234567

printing ABC
cardmarket
123456

printing ABC
mtgjson
abcdef...
```

Provider values should be normalized constants.

Examples:

```text
scryfall
mtgjson
tcgplayer
cardmarket
cardkingdom
cardsphere
mtgo
arena
```

---

# 11. Raw Scryfall Storage

Create:

```text
raw.scryfall_card
```

Recommended schema:

```text
scryfall_id UUID PRIMARY KEY

oracle_id UUID

payload JSONB NOT NULL

source_updated_at TIMESTAMPTZ

payload_hash TEXT

ingested_at TIMESTAMPTZ NOT NULL
```

The full Scryfall record must be preserved in `payload`.

Calculate a deterministic hash of the normalized JSON payload.

Use the hash to avoid unnecessary downstream updates when the source record has not changed.

---

# 12. Raw MTGJSON Storage

Create:

```text
raw.mtgjson_card
```

Suggested fields:

```text
mtgjson_uuid TEXT PRIMARY KEY

payload JSONB NOT NULL

payload_hash TEXT

ingested_at TIMESTAMPTZ NOT NULL
```

MTGJSON should primarily enrich existing canonical records rather than overwrite them.

---

# 13. Source Authority Rules

Explicitly define which source owns which canonical fields.

Initial ownership:

```text
Oracle identity:
Scryfall

Card name:
Scryfall

Oracle text:
Scryfall

Mana cost:
Scryfall

Color identity:
Scryfall

Set metadata:
Scryfall

Printing metadata:
Scryfall

Card images:
Scryfall

Legality:
Scryfall

Cross-provider IDs:
MTGJSON + Scryfall

Historical market prices:
JustTCG
```

Never allow arbitrary "latest importer wins" behavior.

Transformers must respect these ownership rules.

---

# 14. Scryfall ETL

Implement Scryfall first.

Pipeline:

```text
Fetch Scryfall bulk metadata
        |
        v
Identify appropriate bulk dataset
        |
        v
Download dataset
        |
        v
Stream records
        |
        +--> validate minimum expected fields
        |
        +--> insert/update raw.scryfall_card
        |
        +--> upsert catalog.card
        |
        +--> upsert catalog.set
        |
        +--> upsert catalog.printing
        |
        +--> upsert card faces
        |
        +--> upsert known external IDs
        |
        v
Record run metrics
```

Avoid loading the complete Scryfall dataset into application memory if practical.

Prefer streaming or processing records in batches.

Suggested batch size:

```text
500-2000 records
```

Make this configurable.

---

# 15. Idempotency

Every ETL job must be safe to rerun.

Example:

```sql
INSERT INTO catalog.card (...)
VALUES (...)
ON CONFLICT (oracle_id)
DO UPDATE SET ...
```

Running:

```bash
npm run etl:scryfall
```

multiple times against unchanged source data should leave the canonical database unchanged.

Track:

```text
inserted
updated
unchanged
failed
```

Do not delete/recreate the entire catalog on every import.

---

# 16. Transactions

Do not wrap the entire source import in one enormous transaction.

Process data in batches.

For example:

```text
begin

process 1000 records

commit
```

If one malformed record fails, log it and continue unless the problem indicates systemic corruption.

---

# 17. Error Handling

Create:

```text
ops.ingestion_error
```

Suggested schema:

```text
id BIGSERIAL PK

run_id UUID

source TEXT

external_id TEXT

stage TEXT

error_message TEXT

payload JSONB

created_at TIMESTAMPTZ
```

An individual bad card should generally not abort the entire source import.

System-level errors such as:

```text
database unavailable
bulk download invalid
provider returned unexpected document type
migration missing
```

should fail the entire run.

---

# 18. ETL Run Tracking

Create:

```text
ops.ingestion_run
```

Suggested fields:

```text
id UUID PK

source TEXT

status TEXT

started_at TIMESTAMPTZ
completed_at TIMESTAMPTZ

source_version TEXT
source_url TEXT

records_seen BIGINT

records_inserted BIGINT
records_updated BIGINT
records_unchanged BIGINT
records_failed BIGINT

download_bytes BIGINT

duration_ms BIGINT

error_message TEXT
```

Allowed statuses:

```text
running
success
partial_success
failed
```

Every execution of an ETL source must create a run.

---

# 19. Local Data-Volume Measurement

This is a critical requirement.

After a successful import, generate a database-sizing report.

Create:

```bash
npm run etl:report
```

The report should contain:

```text
Source files downloaded
Total downloaded bytes

Database total size

Size by PostgreSQL schema

Size by table

Row counts by table

Index size by table

Data size vs index size

Largest 20 tables

ETL runtime

Rows processed per second
```

Use PostgreSQL functions such as:

```sql
pg_database_size(...)
pg_total_relation_size(...)
pg_relation_size(...)
pg_indexes_size(...)
pg_size_pretty(...)
```

Store historical reports if convenient, but console/JSON output is sufficient initially.

---

# 20. Produce a Machine-Readable Size Report

In addition to console output, write:

```text
./reports/etl-size-report.json
```

Example:

```json
{
  "generatedAt": "...",
  "database": {
    "bytes": 1234567890,
    "pretty": "1.15 GB"
  },
  "schemas": {
    "raw": {
      "bytes": 800000000
    },
    "catalog": {
      "bytes": 300000000
    },
    "market": {
      "bytes": 0
    }
  },
  "tables": [
    {
      "schema": "raw",
      "table": "scryfall_card",
      "rows": 100000,
      "dataBytes": 500000000,
      "indexBytes": 50000000,
      "totalBytes": 550000000
    }
  ]
}
```

This report will later be used to estimate AWS storage requirements.

---

# 21. Raw Storage Toggle

Raw JSON may account for a significant portion of database storage.

Make raw persistence configurable:

```text
ETL_STORE_RAW=true
```

This allows comparison of:

```text
canonical DB only
```

versus:

```text
canonical DB + complete source JSON
```

Also consider:

```text
ETL_RAW_RETENTION_MODE=latest
```

Do not retain historical copies of every Scryfall payload by default.

Only retain the latest raw representation unless there is a future requirement for source-history auditing.

---

# 22. PostgreSQL Storage Experiment

Add scripts to compare storage strategies locally.

At minimum measure:

## Scenario A

```text
Scryfall canonical data only
```

## Scenario B

```text
Scryfall canonical + raw JSONB
```

## Scenario C

```text
Scryfall + MTGJSON canonical/enrichment + raw JSONB
```

## Scenario D

Eventually:

```text
catalog + one price snapshot
```

## Scenario E

Eventually:

```text
catalog + simulated one year of daily price history
```

Generate reports for each scenario.

This should help answer:

```text
How much storage is catalog metadata?

How much storage is raw data?

How much storage is indexes?

How much storage will pricing history consume?

How fast will storage grow?
```

---

# 23. MTGJSON Pipeline

Implement after Scryfall is stable.

Pipeline:

```text
download MTGJSON dataset
        |
        v
parse records
        |
        v
store raw record
        |
        v
find matching printing
        |
        +-- Scryfall ID if available
        |
        +-- other deterministic identifiers if necessary
        |
        v
upsert external identifiers
```

Do not create duplicate canonical printings if a Scryfall printing already exists.

When reconciliation fails:

```text
log unmatched record
```

Create an ops report showing:

```text
matched
unmatched
ambiguous
```

---

# 24. Reconciliation Reporting

Create:

```bash
npm run etl:reconciliation-report
```

Output:

```text
MTGJSON records processed

Matched to Scryfall printing

Unmatched records

Ambiguous matches

Provider identifiers added
```

For unmatched records, produce a machine-readable artifact:

```text
./reports/unmatched-mtgjson.json
```

---

# 25. JustTCG / Pricing Pipeline

Do not implement pricing until catalog identity reconciliation is working.

Create:

```text
market.price_observation
```

Schema:

```text
id BIGSERIAL PK

printing_id UUID FK

provider TEXT NOT NULL

finish TEXT

condition TEXT

currency TEXT NOT NULL

price NUMERIC(12,4)

observed_at TIMESTAMPTZ NOT NULL

external_variant_id TEXT

created_at TIMESTAMPTZ NOT NULL
```

Useful index:

```text
(printing_id, observed_at DESC)
```

Also likely:

```text
(provider, observed_at)
```

---

# 26. Price Snapshot vs Historical Data

Do not overwrite price values.

Price ingestion should append observations.

Example:

```text
Sep 1
Lightning Bolt
NM
foil
$12.40

Sep 2
Lightning Bolt
NM
foil
$12.85
```

This enables historical charts and collection valuation.

Avoid storing observations when nothing changed if doing so meaningfully reduces storage.

Possible future strategy:

```text
insert if price changed

OR

insert daily closing observation
```

Make the behavior configurable.

---

# 27. Price Storage Forecast Tool

Implement a simple command:

```bash
npm run etl:forecast
```

Inputs:

```text
number of tracked variants
observations per day
retention period
average row size
```

Output approximate:

```text
observations/day

observations/year

estimated table storage

estimated index storage

estimated total storage
```

Whenever possible, derive average row/index size from the actual local PostgreSQL database rather than hardcoding assumptions.

---

# 28. AWS Cost Preparation

Do NOT deploy to AWS yet.

First complete a full local import.

Collect:

```text
database size
raw storage size
catalog storage size
index size
ETL execution duration
peak process memory
download volume
price-history growth estimate
```

Create:

```text
./reports/aws-capacity-input.json
```

Example:

```json
{
  "databaseBytes": 0,
  "catalogBytes": 0,
  "rawBytes": 0,
  "indexBytes": 0,
  "estimatedMonthlyGrowthBytes": 0,
  "etl": {
    "scryfallDurationSeconds": 0,
    "mtgjsonDurationSeconds": 0,
    "peakMemoryMb": 0
  }
}
```

This artifact will be used later to choose:

```text
RDS instance size
RDS storage size
storage autoscaling threshold
ETL compute size
ETL schedule
```

Do not guess AWS sizing before this report exists.

---

# 29. Future AWS Deployment

The initial expected AWS architecture is:

```text
EventBridge Scheduler
        |
        v
ECS Fargate Task
        |
        v
RDS PostgreSQL
```

The same Docker image used locally should run as the Fargate task.

Possible schedules:

```text
Scryfall: daily

MTGJSON: daily

prices: hourly / 6-hourly / daily depending on cost requirements
```

Do not implement AWS infrastructure until the local pipeline and sizing reports work.

---

# 30. Project Structure

Suggested structure:

```text
src/
  etl/
    cli.ts

    core/
      types.ts
      logger.ts
      hashing.ts
      batching.ts
      metrics.ts

    sources/
      scryfall/
        client.ts
        types.ts
        schema.ts
        transformer.ts
        importer.ts

      mtgjson/
        client.ts
        types.ts
        schema.ts
        transformer.ts
        importer.ts

      justtcg/
        client.ts
        types.ts
        schema.ts
        transformer.ts
        importer.ts

    repositories/
      cards.ts
      sets.ts
      printings.ts
      identifiers.ts
      prices.ts
      raw.ts
      ingestionRuns.ts

    reports/
      databaseSize.ts
      reconciliation.ts
      forecast.ts

db/
  migrations/

reports/

docker-compose.yml

Dockerfile
```

Adapt the layout to the existing repository conventions if appropriate.

---

# 31. CLI

Create one CLI entry point.

Example:

```bash
npm run etl -- scryfall
npm run etl -- mtgjson
npm run etl -- prices
npm run etl -- all
npm run etl -- report
npm run etl -- forecast
```

Useful flags:

```text
--limit 1000
--batch-size 1000
--dry-run
--store-raw
--no-store-raw
--verbose
```

A `--limit` option is particularly important for development.

It should allow:

```bash
npm run etl -- scryfall --limit 1000
```

before attempting the full dataset.

---

# 32. Dry Run

Implement:

```text
--dry-run
```

Dry-run behavior:

```text
download/read source

parse

validate

normalize

collect statistics
```

but do not persist canonical data.

Report what would have happened:

```text
records read
records valid
records invalid
estimated insert count
estimated update count
```

---

# 33. Development Rollout

Implement incrementally.

## Phase 1 — Infrastructure

Implement:

```text
Docker PostgreSQL
migration runner
schemas
ops.ingestion_run
CLI skeleton
```

Acceptance:

```text
docker compose up

npm run db:migrate
```

works from a clean checkout.

---

## Phase 2 — Scryfall Sampling

Implement:

```text
bulk download metadata
bulk download
Scryfall validation
--limit
raw storage
```

Run:

```bash
npm run etl -- scryfall --limit 1000
```

Acceptance:

```text
1000 records parsed
raw payloads queryable
run metrics recorded
```

---

## Phase 3 — Canonical Scryfall Model

Implement:

```text
catalog.card
catalog.set
catalog.printing
catalog.card_face
catalog.printing_identifier
```

Acceptance:

```text
sample import produces normalized entities
multi-face cards work
repeat import is idempotent
```

---

## Phase 4 — Full Scryfall Import

Run entire Scryfall bulk dataset locally.

Generate:

```text
etl-size-report.json
```

Acceptance:

```text
full import succeeds

second import succeeds

second import results primarily in unchanged rows

DB/storage metrics captured
```

---

## Phase 5 — MTGJSON

Implement:

```text
MTGJSON ingestion
identifier reconciliation
unmatched reporting
```

Acceptance:

```text
MTGJSON enriches existing printings

does not duplicate matching Scryfall printings

reconciliation report generated
```

---

## Phase 6 — Storage Analysis

Run full:

```text
Scryfall
+
MTGJSON
```

Capture:

```text
catalog size
raw size
index size
total database size
runtime
memory
```

Compare raw-storage enabled and disabled.

Do not proceed to AWS until these results are available.

---

## Phase 7 — JustTCG

Implement:

```text
provider client
batch fetching
price normalization
historical observations
rate-limit handling
```

Start with a small subset.

Example:

```text
100 known printings
```

Then expand.

---

## Phase 8 — Capacity Forecast

Use actual PostgreSQL measurements to estimate:

```text
30-day growth

1-year growth

catalog-only AWS storage

catalog + raw AWS storage

catalog + daily prices

catalog + 6-hourly prices
```

Produce machine-readable report.

---

## Phase 9 — AWS Infrastructure

Only after local measurements are reviewed.

Implement:

```text
RDS PostgreSQL

ECS task definition

ECR repository

EventBridge schedules

Secrets Manager

CloudWatch logs

ETL failure alerting
```

Reuse the same ETL Docker image.

---

# 34. Testing Requirements

Unit test:

```text
Scryfall transformations

MTGJSON transformations

card-face handling

identifier reconciliation

price normalization

hash generation
```

Integration test:

```text
ETL against disposable PostgreSQL database
```

Test idempotency explicitly.

Example:

```text
import fixture

count rows

import same fixture again

verify counts unchanged
```

Also test:

```text
source record changed
```

and verify canonical row updates correctly.

---

# 35. Logging

Prefer structured logs.

Each log entry should include when applicable:

```text
runId
source
stage
externalId
batchNumber
```

Example:

```json
{
  "level": "info",
  "runId": "...",
  "source": "scryfall",
  "stage": "canonical-import",
  "recordsProcessed": 50000
}
```

Do not log entire source payloads unless handling an error.

---

# 36. Performance

Do not optimize prematurely.

Initially:

```text
stream source data

batch writes

use PostgreSQL UPSERT

use prepared/batched inserts

add indexes required for reconciliation
```

Collect metrics before making architectural changes.

Only introduce advanced infrastructure if measurements prove it necessary.

---

# 37. Definition of Done for Local ETL

Before any AWS deployment, the following must be possible from a clean checkout:

```bash
docker compose up -d

npm install

npm run db:migrate

npm run etl -- scryfall

npm run etl -- mtgjson

npm run etl -- report
```

The final report must answer:

```text
How many cards exist?

How many printings exist?

How many sets exist?

How many card faces exist?

How many external identifiers exist?

How much space does canonical catalog data consume?

How much space does raw Scryfall data consume?

How much space does raw MTGJSON data consume?

How much space do indexes consume?

How long does each ETL run take?

How much memory does the ETL process require?

How much data would initially need to live in RDS?

How quickly would price-history storage grow?
```

Only after these questions are answered should AWS resources be selected.

---

# 38. First Implementation Task

Do not attempt to implement the entire project at once.

Begin with:

1. inspect the existing repository and identify runtime/package conventions
2. add Dockerized local PostgreSQL
3. add migration tooling
4. create `raw`, `catalog`, `market`, `ops`, and `app` schemas
5. create `ops.ingestion_run`
6. create the ETL CLI skeleton
7. implement Scryfall bulk metadata discovery
8. implement a `--limit 1000` Scryfall raw import
9. create basic ETL metrics
10. stop and verify that the 1,000-record import works before implementing canonical normalization

Preserve existing project conventions wherever reasonable.

Do not add unnecessary infrastructure or dependencies.
Ok
