# respark admin

Local ops dashboard for ETL ingestion runs. Uses the same Clerk application as `apps/web`; API routes under `/admin` require `publicMetadata.role === "admin"`.

## Setup

1. Copy env:

```bash
cp apps/admin/.env.example apps/admin/.env.local
```

2. Set `VITE_CLERK_PUBLISHABLE_KEY` to the same value as `apps/web/.env.local` (or run `clerk env pull` against that Clerk app from `apps/admin`).

3. In the [Clerk Dashboard](https://dashboard.clerk.com/), open your user → **Public metadata** and set:

```json
{ "role": "admin" }
```

4. Ensure the API is running with `CLERK_SECRET_KEY` and `DATABASE_URL` configured (`task api:dev` or Compose).

## Run

Via Compose (with the rest of the stack):

```bash
task docker:up
```

Or on the host only:

```bash
task admin:dev
# or: npm run dev -w admin
```

Open http://localhost:4000.

## Deploy (develop)

Infra reuses the `ui` Terraform module for a separate admin hostname (default `dev.admin.respark.kevinmccartney.is`):

```bash
task infra:apply    # once, creates admin bucket + CloudFront + DNS
task admin:deploy   # build with VITE_API_URL from Terraform, sync + invalidate
```

Add the admin origin to Clerk allowed origins / redirect URLs (same Clerk app as web). See [`infra/envs/develop/README.md`](../../infra/envs/develop/README.md).

## Screens

- `/` — list of ingestion runs + **Run ETL** (source select → `POST /admin/etl-job`)
- `/runs/:id` — run detail + paginated failed import rows
