# respark API (NestJS)

## Local dev (Node)

1. Copy `.env.example` → `.env` or `.env.local` in this directory.
2. Set `CLERK_SECRET_KEY` and optionally `PORT` (default **3000**). `DATABASE_URL` already points at the local Postgres container.

```bash
# from repo root
task db:up && task db:migrate
task api:dev
# or
npm run start:dev -w api
```

The server binds **`0.0.0.0:$PORT`** so it works from Docker and LAN.

Logs are **JSON** in production (`NODE_ENV=production`). Local dev uses pretty-printed structured logs. Set **`LOG_LEVEL`** (default: `debug` locally, `info` in production). HTTP access logs include **`userId`** when Clerk auth ran; **`/healthz`** is excluded to reduce noise. Authorization headers are redacted.

## Database (Postgres + Drizzle)

Local Postgres runs in the `db` service of `docker-compose.api.yml` (the `pgvector` image, so embeddings are possible later without swapping images). The API connects via **`DATABASE_URL`**.

```bash
task db:up        # start Postgres
task db:migrate   # apply pending migrations
task db:studio    # browse data in Drizzle Studio
task db:reset     # destroy the container and its data volume
```

Schema lives in `src/db/schema/` (one file per domain) and generated SQL in `drizzle/`. After changing the schema:

```bash
task db:generate  # writes a new migration to drizzle/
task db:migrate
```

Current tables:

- **`users`** — local identity owning every other foreign key. Clerk stays the auth provider; `clerk_user_id` is just an external reference, and a row is created on first authenticated request.
- **`decks`** — `name` plus owner, cascading on user delete. Deck contents arrive once cards are modeled.

### Migrations in deployed environments

Deployed containers run with **`RUN_MIGRATIONS=true`** and apply pending migrations on boot (the `drizzle/` folder ships in the image; `drizzle-orm` includes the migrator, so `drizzle-kit` is not installed at runtime). This is safe for the current single instance — revisit if the API ever scales out. Locally the flag is unset, so `task db:migrate` stays the explicit step.

## VS Code debug

1. Open **Run and Debug**.
2. Choose **API: debug (launch)** — starts watch mode with inspector on **9229** and opens the integrated terminal.

Or run `task api:debug` / `npm run start:debug -w api`, set breakpoints, and use **API: attach (port 9229)**.

## Docker (optional)

```bash
docker compose -f docker-compose.api.yml up --build
```

See comments in `docker-compose.api.yml` for exposing **9229** and running with `--inspect` when you want attach debugging in a container.

## Deployed (EC2)

See repo root Taskfile: `task api:deploy` (requires `apps/api/.env` with `CLERK_SECRET_KEY` for the redeploy script).

Secrets live in **SSM Parameter Store** and are read by the instance role at deploy time, so nothing sensitive passes through your laptop:

- **`/respark/develop/api/database-url`** — written by Terraform, which generates the password
- **`/respark/develop/api/clerk-secret-key`** — pushed with `task api:secrets:push` from `apps/api/.env`, so it stays out of Terraform state

Run `task api:secrets:push` once (and again whenever the Clerk key rotates), then `task api:deploy`.

RDS enforces TLS, so the image bundles the Amazon RDS root CA and connects with certificate verification on (`DATABASE_CA_PATH`). Locally that variable is unset and the connection is plaintext to the Docker container.

```bash
terraform -chdir=infra/envs/develop output -raw db_endpoint
terraform -chdir=infra/envs/develop output -raw db_database_url_parameter
```

Postgres is **not publicly accessible** — its security group only accepts 5432 from the API instance security group. For psql access, port-forward through the EC2 box with SSM (needs `ssm:StartSession` on your IAM user).

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
