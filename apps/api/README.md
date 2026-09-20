# respark API (NestJS)

## Local dev (Docker Compose)

Preferred path: Postgres + API + web + admin in Compose.

1. Copy `apps/api/.env.example` → `apps/api/.env` and set `CLERK_SECRET_KEY` (and optionally `CLERK_WEBHOOK_SIGNING_SECRET`).
2. Copy `apps/web/.env.example` → `apps/web/.env.local` and set `VITE_CLERK_PUBLISHABLE_KEY`.
3. Copy `apps/admin/.env.example` → `apps/admin/.env.local` and use the same publishable key (admin users need `publicMetadata.role === "admin"`).

```bash
# from repo root
task docker:up      # builds Dockerfiles, starts db + api + web + admin, migrates on boot
task docker:logs    # follow API + web + admin logs
```

- Web: http://localhost:5173
- Admin: http://localhost:4000
- API: http://localhost:3000

Compose overrides the API `DATABASE_URL` to `postgres://respark:respark@db:5432/respark` so the container reaches Postgres on the Compose network (your `.env` can keep `localhost` for host-side tools like Drizzle Studio). The web and admin containers get `VITE_API_URL=http://localhost:3000` because the browser runs on your machine, not inside the Compose network.

`RUN_MIGRATIONS=true` is set on the API service, so a fresh DB volume gets schema on first boot. `apps/api/src`, `apps/web/src`, and `apps/admin/src` are bind-mounted; Nest/Vite reload on save. API inspector is on **9229** (`start:debug`).

```bash
task docker:down    # stop stack, keep DB volume
task db:reset       # wipe volume too
```

## Local dev (Node on the host)

Same env files as above. Run only Postgres in Compose, API with Nest on the host:

```bash
task db:up && task db:migrate
task api:dev
# or
npm run start:dev -w api
```

The server binds **`0.0.0.0:$PORT`** so it works from Docker and LAN.

Logs are **JSON** in production (`NODE_ENV=production`). Local dev uses pretty-printed structured logs. Set **`LOG_LEVEL`** (default: `debug` locally, `info` in production). HTTP access logs include **`userId`** when Clerk auth ran; **`/healthz`** is excluded to reduce noise. Authorization headers are redacted.

## Database (Postgres + Drizzle)

Local Postgres is the `db` service in `docker-compose.yml` (the `pgvector` image, so embeddings are possible later without swapping images). The API connects via **`DATABASE_URL`**.

```bash
task db:up        # start Postgres only
task db:migrate   # apply pending migrations (host → localhost:5432)
task db:studio    # browse data in Drizzle Studio
task db:reset     # destroy the Compose stack and its data volume
```

Schema lives in `src/db/schema/` (one file per domain) and generated SQL in `drizzle/`. After changing the schema:

```bash
task db:generate  # writes a new migration to drizzle/
task db:migrate   # or restart the Compose API (migrate-on-boot)
```

Current tables:

- **`app.users`** / **`app.decks`** / **`app.deck_card`** — app-owned identity, decks (`description`, `format`: standard/commander/modern), and deck lines keyed by **printing** (add-by-card picks a default printing).
- **`GET /cards`** — authenticated keyword search over unique `catalog.card` rows (trigram indexes; `page` + `limit` pagination).
- **`GET /cards/suggestions`** — name-only autocomplete (`id` + `name`) for deck building.
- **`GET /cards/:id`** — card detail plus printings (set, collector number, images).
- **`GET/POST /decks`**, **`GET/PATCH/DELETE /decks/:id`**, **`POST /decks/:id/import`**, **`POST/PATCH/DELETE /decks/:id/cards…`** — deck CRUD + Moxfield-style list import (incl. `SIDEBOARD:` / `SB:`) + card lines (`POST` accepts `cardId`; deck `PATCH` applies any provided fields — `name`, `description`, `format`; card `PATCH` accepts `quantity`, `printingId`, `foil`, and/or `sideboard`; `foil: true` is rejected when the printing’s `finishes` are known and lack `foil`; lines are unique per printing + foil + board).
- **Pipeline schemas** — `raw`, `catalog`, `market`, `ops`, plus `ops.etl_sync` / `ops.etl_job_run` for ETL sync tracking. Admin starts syncs in-process via the `etl` lib and streams events on `/admin/etl-syncs/ws`. See [`apps/etl/README.md`](../etl/README.md) and `task etl -- --help`.

## Clerk webhooks

**`POST /webhooks/clerk`** syncs the profile cache. It is deliberately public — Clerk authenticates with a Svix signature, not a bearer token, so `ClerkAuthGuard` is not applied. Verification uses `verifyWebhook` from `@clerk/backend/webhooks` and needs **`CLERK_WEBHOOK_SIGNING_SECRET`**; the app boots with `rawBody: true` because the signature covers the exact request bytes.

Handled events: `user.created` and `user.updated` upsert the profile, `user.deleted` sets `deleted_at`. Anything else is logged and acknowledged.

Two things keep redelivery safe, since Svix retries and does not guarantee ordering:

- Writes are upserts keyed on `clerk_user_id`, so replays are idempotent.
- A sync is skipped when the event's `updated_at` is older than the stored `clerk_updated_at`, so a delayed event cannot clobber newer data.

Deletes are **soft** — decks survive, and a mistaken or replayed `user.deleted` is recoverable via a deliberate restore (out of band). While `deleted_at` is set, authenticated API requests that resolve the local user return **403**. Purging is a separate operation.

Webhooks are eventually consistent, so nothing in the request path waits on them: `UsersService.resolveLocalId` still creates the row on first authenticated request, and the webhook fills in the profile when it lands.

Responses: `200` on any verified event, `400` on a bad signature, `503` when the signing secret is unset (so Svix retries once it is configured instead of dropping the event).

Test locally with the Clerk CLI tunnel, then add the printed relay URL as an endpoint in the Clerk dashboard:

```bash
clerk webhooks listen --token "$(clerk webhooks token)" --forward-to http://localhost:3000/webhooks/clerk
```

### Migrations in deployed environments

Deployed containers run with **`RUN_MIGRATIONS=true`** and apply pending migrations on boot (the `drizzle/` folder ships in the image; `drizzle-orm` includes the migrator, so `drizzle-kit` is not installed at runtime). This is safe for the current single instance — revisit if the API ever scales out. Local Compose sets the same flag; host-side `task api:dev` leaves it unset so `task db:migrate` stays the explicit step.

## VS Code debug

**Compose API:** set breakpoints and use **API: attach (port 9229)** — Compose already runs `start:debug`.

**Host API:** **Run and Debug → API: debug (launch)**, or `task api:debug` then attach.

## Deployed (EC2)

See repo root Taskfile: `task api:deploy` (requires `apps/api/.env` with `CLERK_SECRET_KEY` for the redeploy script).

Secrets live in **SSM Parameter Store** and are read by the instance role at deploy time, so nothing sensitive passes through your laptop:

- **`/respark/develop/api/database-url`** — written by Terraform, which generates the password
- **`/respark/develop/api/clerk-secret-key`** — pushed with `task api:secrets:push` from `apps/api/.env`, so it stays out of Terraform state
- **`/respark/develop/api/clerk-webhook-signing-secret`** — same push, but optional: it only exists after you create the webhook endpoint in the Clerk dashboard. Until then `/webhooks/clerk` returns 503 and the rest of the API is unaffected.

Run `task api:secrets:push` once (and again whenever a Clerk key rotates), then `task api:deploy`.

RDS enforces TLS, so the image bundles the Amazon RDS root CA and connects with certificate verification on (`DATABASE_CA_PATH`). Locally that variable is unset and the connection is plaintext to the Docker container.

```bash
terraform -chdir=infra/envs/develop output -raw db_endpoint
terraform -chdir=infra/envs/develop output -raw db_database_url_parameter
```

Postgres is **not publicly accessible** — its security group only accepts 5432 from the API instance security group. For a local client, use **`task db:tunnel`** (SSM port-forward to `localhost:15432`; needs the Session Manager plugin and `ssm:StartSession`). User/database are both `respark`; the password is the Terraform-generated value inside the SSM `database-url` parameter. See the root README Task section for the full flow.

Container **stdout/stderr** (Pino JSON) goes to CloudWatch Logs via Docker’s **`awslogs`** driver.

```bash
# log group name (after terraform apply)
terraform -chdir=infra/envs/develop output -raw api_cloudwatch_log_group

# tail live
aws logs tail "$(terraform -chdir=infra/envs/develop output -raw api_cloudwatch_log_group)" --follow

# Logs Insights — failed auth (example)
# fields @timestamp, msg, userId
# | filter msg like /auth/
# | sort @timestamp desc
# | limit 50
```

Later you can add **metric filters** on the log group (e.g. count `level=50` or `msg="auth.failed"`) and **CloudWatch alarms** → SNS.
