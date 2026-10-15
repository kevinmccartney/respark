# respark admin

Local ops dashboard for ETL syncs. Uses the same Clerk application as `apps/client`; API routes under `/admin` require `publicMetadata.role === "admin"`.

## Setup

1. Env comes from the repo-root `.env.local` (copy [`.env.example`](../../.env.example)). Set `VITE_CLERK_PUBLISHABLE_KEY`; the client and API use the same Clerk instance.

2. Deploys read the publishable key from `.env.develop` / `.env.production` (or the GitHub Environment variable in CI).

3. In the [Clerk Dashboard](https://dashboard.clerk.com/), open your user → **Public metadata** and set:

```json
{ "role": "admin" }
```

4. Ensure the API is running with `CLERK_SECRET_KEY` and `DATABASE_URL` configured (`task api:dev` or `task docker:up`).

## Run

Via Docker Compose (with the rest of the stack):

```bash
task docker:up
```

Or on the host only:

```bash
task admin:dev
# or: npm run dev -w @respark/admin
```

Open http://localhost:4000.

## Deploy (develop)

Infra reuses the `ui` Terraform module for a separate admin hostname (default `dev.admin.respark.kevinmccartney.is`):

```bash
task infra:apply    # once, creates admin bucket + CloudFront + DNS
task admin:deploy   # build with VITE_API_URL from Terraform, sync + invalidate
```

Add the admin origin to Clerk allowed origins / redirect URLs (same Clerk app as the client). See [`infra/envs/develop/README.md`](../../infra/envs/develop/README.md).

## Screens

Signed-in chrome is a left nav (header only when signed out):

- **Home** — `/` dashboard: catalog/user totals, latest ETL sync, recent syncs
- **Catalog** — `/catalog/cards` (+ `/:id?printing=`), `/catalog/sets` (+ `/:id`), `/catalog/goodstuff` — browse + goodstuff policy; see [`docs/admin-catalog.md`](../../docs/admin-catalog.md)
- **ETL Syncs** — `/etl-syncs` list + **Start sync** (catalog / enrichment → `POST /admin/etl-syncs`); live via WebSocket. `/operations/etl-syncs/:id` is sync detail (stages/jobs, live log, reconciliation, failed rows);
- **Users** — `/users/management` (list + detail via Clerk)

WebSocket: `ws://<api>/admin/etl-syncs/ws?token=<clerk_jwt>` (admin role required). Subscribe with `{ "event": "subscribe", "data": { "channel": "list" } }` or `{ "channel": "sync", "syncId": "…" }`.
