# respark API (NestJS)

## Local dev (Docker Compose)

Postgres + API + client + admin in watch mode via [`docker-compose.yml`](../../docker-compose.yml).

All env lives in one gitignored file at the repo root. Copy [`.env.example`](../../.env.example) → `.env.local` and set the Clerk keys (`VITE_CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY`, optionally `CLERK_WEBHOOK_SIGNING_SECRET`). Admin users need `publicMetadata.role === "admin"`.

```bash
# from repo root
task docker:up     # build + start (Task passes --env-file .env.local)
task docker:logs   # follow API + client + admin logs
task docker:ps     # service status
task docker:down   # stop, keep the Postgres volume
task db:reset      # also delete the Postgres volume
```

- Client: http://localhost:5173
- Admin: http://localhost:4000
- API: http://localhost:3000

The API service reads `.env.local`, but Compose overrides `DATABASE_URL` to the `db` service and sets `RUN_MIGRATIONS=true`, so a fresh volume gets schema on first boot. The client and admin containers only receive `VITE_CLERK_PUBLISHABLE_KEY` (no secret keys) and `VITE_API_URL=http://localhost:3000`. API inspector is on **9229** (`start:debug`).

Source folders are bind-mounted, so `nest --watch` and Vite reload on save. Re-run `task docker:up` after changing dependencies, `.env.local`, Dockerfiles, or the compiled shared packages the API loads (`schemas`, `scryfall-query`, `etl`).

## Local dev (Node on the host)

Same root `.env.local` as above. Run only Postgres in Compose, API with Nest on the host:

```bash
task db:up && task db:migrate
task api:dev
# or
npm run start:dev -w api
```

The server binds **`0.0.0.0:$PORT`** so it works from Docker and LAN.

Logs are **JSON** in production (`NODE_ENV=production`). Local dev uses pretty-printed structured logs. Set **`LOG_LEVEL`** (default: `debug` locally, `info` in production). HTTP access logs include **`userId`** when Clerk auth ran; **`/healthz`** is excluded to reduce noise. Authorization headers are redacted. **`GET /info`** returns `{ "version": "<root package.json>" }` for the platform version shown in the client and admin footers.

## Database (Postgres + Drizzle)

Local Postgres is the Compose `db` service (the `pgvector` image, so embeddings are possible later without swapping images), reachable from the host on `localhost:5432`. The API connects via **`DATABASE_URL`**.

```bash
task db:up        # start Postgres only
task db:migrate   # apply pending migrations (host → localhost:5432)
task db:studio    # browse data in Drizzle Studio
task db:reset     # remove the local stack and its data volume
```

Schema lives in `src/db/schema/` (one file per domain) and generated SQL in `drizzle/`. After changing the schema:

```bash
task db:generate  # writes a new migration to drizzle/
task db:migrate   # or `task docker:up` (the Compose API migrates on boot)
```

Current tables:

- **`app.users`** / **`app.decks`** / **`app.deck_card`** / **`app.chat_conversation`** / **`app.chat_message`** — app-owned identity, decks (`description`, `format`: standard/commander/modern), deck lines keyed by **printing** (add-by-card picks a default printing), and chat threads (optional sticky `deck_id` / `card_id`).
- **`GET /cards`** — authenticated catalog search. **Primary match:** optional `scryfall` (local Scryfall-syntax via `packages/scryfall-query` → SQL). Supported sections: colors/identity, types, oracle/keywords, mana/mv/devotion/produces, rarity, sets/blocks/group/`in`/`st`/`cn`, format (`f:` / `format:`), plus `is:`/`has:`/`new:` flags. Unknown or out-of-scope keywords → **400**. **Ordering / paging:** `sort` (`name` \| `edhrecRank` \| `manaValue`), `dir`, `page`, `limit`. **Still accepted (legacy / internal):** `q`, `legalIn`, `colorIdentity`, `includeColorless`, `typeContains`, `rarity`, `maxManaValue` (prefer equivalent `scryfall` clauses; UIs no longer send these). **Keep for tooling:** `commanderEligible`, `excludeCardIds` (chat inject / pickers). Filters combine with AND.
- **`GET /cards/suggestions`** — name-only autocomplete (`id` + `name`) for deck building (`q` plus optional `legalIn` / `colorIdentity` / `commanderEligible`).
- **`GET /cards/type-suggestions`** — legacy type-token autocomplete (unused by current catalog UI).
- **`GET /cards/:id`** — card detail plus printings (set, collector number, images).
- **`GET/POST /decks`**, **`GET/PATCH/DELETE /decks/:id`**, **`POST /decks/:id/import`**, **`POST/PATCH/DELETE /decks/:id/cards…`** — deck CRUD + Moxfield-style list import (incl. `SIDEBOARD:` / `SB:`; `COMMANDER:` and copies of the current commander are ignored) + card lines (`POST` accepts `cardId`; deck `PATCH` applies any provided fields — `name`, `description`, `format`; card `PATCH` accepts `quantity`, `printingId`, `foil`, and/or `sideboard`; `foil: true` is rejected when the printing’s `finishes` are known and lack `foil`/`etched`; etched and foil-only printings are always foil; `hasFoil` means the foil flag can be toggled; lines are unique per printing + foil + board).
- **Chat** — player WebSocket `/chat/ws` (Clerk `?token=`) plus `GET /chat/conversations` (list), `/latest`, and `/:id` for thread reload. Sticky `deckId` is optional context (omit / set / clear). Tools call decks/cards services; the model is Bedrock. The local API authenticates as IAM user `respark-local-api` (`task api:local-aws:write`). Deployed envs use the ECS task role. See [`docs/ai-chat.md`](../../docs/ai-chat.md).
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

Deployed containers run with **`RUN_MIGRATIONS=true`** and apply pending migrations on boot (the `drizzle/` folder ships in the image; `drizzle-orm` includes the migrator, so `drizzle-kit` is not installed at runtime). This is safe for the current single instance — revisit if the API ever scales out. The local cluster API sets the same flag; host-side `task api:dev` leaves it unset so `task db:migrate` stays the explicit step.

## Server costs

**`GET /costs`** (any signed-in user) returns monthly AWS costs for the last six months, grouped by service, for the client's "Server cost" page.

- **Scope:** only costs tagged `Project=respark`. `ce:GetCostAndUsage` can't be limited to resources, so the task role can read the whole account; the filter is fixed in `CostsService` and the endpoint takes no parameters. Keep it that way.
- **Caching:** each Cost Explorer request costs $0.01 and AWS refreshes data a few times a day, so results are cached in memory for 12 hours (per task, and refetched after a restart).
- **Tag activation:** Cost Explorer only filters on `Project` after it is activated as a cost allocation tag (Billing console → Cost allocation tags). Untagged costs (Route53 zone, tax) and non-AWS services are not included.
- **Local:** outside production, a failed Cost Explorer call returns fixture data so the page works without AWS access.

## VS Code debug

**Cluster API:** set breakpoints and use **API: attach (port 9229)** — the local release already runs `start:debug` and publishes 9229 on localhost.

**Host API:** **Run and Debug → API: debug (launch)**, or `task api:debug` then attach.

## Deployed (ECS Fargate)

See [`docs/current-architecture.md`](../../docs/current-architecture.md). `task api:deploy` builds the arm64 image, pushes it to ECR, and rolls the ECS service; Caddy in the task terminates TLS.

Secrets live in **SSM Parameter Store** and ECS injects them at task start, so nothing sensitive passes through your laptop:

- **`/respark/<env>/api/database-url`** — written by Terraform, which generates the password
- **`/respark/<env>/api/clerk-secret-key`** — pushed with `task api:secrets:push ENV=<env>` from the repo-root `.env.<env>`, so it stays out of Terraform state
- **`/respark/<env>/api/clerk-webhook-signing-secret`** — same push. ECS requires the parameter to exist to start the task.

`BEDROCK_MODEL_ID` is a plain environment variable in the task definition (see [`docs/ai-chat.md`](../../docs/ai-chat.md)).

Run `task api:secrets:push` once (and again whenever a Clerk key rotates), then `task api:deploy`.

RDS enforces TLS, so the image bundles the Amazon RDS root CA and connects with certificate verification on (`DATABASE_CA_PATH`). Locally that variable is unset and the connection is plaintext to the Docker container.

```bash
terraform -chdir=infra/envs/develop output -raw db_endpoint
terraform -chdir=infra/envs/develop output -raw db_database_url_parameter
```

Postgres is **not publicly accessible** — one RDS instance serves both envs (databases `respark` and `respark_develop`), and its security group only accepts 5432 from each env's API task. For a local client, use **`task db:tunnel`** (SSM port-forward to `localhost:15432` through the running task via ECS Exec; needs the Session Manager plugin and `ssm:StartSession`). User and password are inside the SSM `database-url` parameter (`task db:url`). See the root README Task section for the full flow.

Container **stdout/stderr** (Pino JSON) goes to CloudWatch Logs via the ECS **`awslogs`** driver (stream prefixes `api`, `caddy`, `dns-updater`).

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
