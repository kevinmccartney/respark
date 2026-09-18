# respark API (NestJS)

## Local dev (Node)

1. Copy `.env.example` → `.env` or `.env.local` in this directory.
2. Set `CLERK_SECRET_KEY` and optionally `PORT` (default **3000**).

```bash
# from repo root
task api:dev
# or
npm run start:dev -w api
```

The server binds **`0.0.0.0:$PORT`** so it works from Docker and LAN.

Logs are **JSON** in production (`NODE_ENV=production`). Local dev uses pretty-printed structured logs. Set **`LOG_LEVEL`** (default: `debug` locally, `info` in production). HTTP access logs include **`userId`** when Clerk auth ran; **`/healthz`** is excluded to reduce noise. Authorization headers are redacted.

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
