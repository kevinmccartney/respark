# develop environment

Terraform root for the **develop** AWS environment (0.x). Production lives alongside in [`../production`](../production/) (same account, separate state key and tags). Architecture overview: [`docs/current-architecture.md`](../../docs/current-architecture.md).

## Prerequisites

- Route53 hosted zone for `kevinmccartney.is` in this AWS account
- The production root applied first: develop's database lives on production's RDS instance
- AWS credentials with permission to manage S3, CloudFront, ACM, Route53, ECS, ECR, EFS, EC2 security groups, IAM, and **SSM Parameter Store**

## What it manages

- **`ui`** — S3 + CloudFront + ACM + Route53 for the player client (`component = "web"`)
- **`admin`** — same `ui` module for the admin dashboard (`component = "admin"`)
- **`api_service`** — ECR, ECS Fargate service (api + Caddy TLS + DNS updater), EFS for certificates, CloudWatch Logs, and the `dev.api` A record. Runtime identity is the task role (Bedrock chat).
- **Database access** — an ingress rule on the shared RDS security group, and the `respark_develop` connection string in SSM (`database-url`, password generated here). Create the role and database once with `task db:create-env` (below).

## Apply

```bash
# Once per AWS account: remote state bucket + lock table, then migrate local state
bash scripts/bootstrap-tf-backend.sh
terraform -chdir=infra/envs/develop init -migrate-state

task infra:plan
task infra:apply
```

CI/CD (GitHub Actions) plans on every PR and applies + deploys from `main`. See [`docs/ci-cd.md`](../../docs/ci-cd.md).

Or apply infra and deploy API + client + admin in one shot locally:

```bash
task deploy
```

First apply may take several minutes while ACM DNS validation completes.

Optional: copy `terraform.tfvars.example` to `terraform.tfvars` to override hostnames.

## Create the database (once)

```bash
task db:tunnel ENV=production      # leave running
task db:create-env ENV=develop     # role + database respark_develop on the shared RDS
```

## Deploy the API

```bash
task api:secrets:push   # once, and after any Clerk key rotation
task api:deploy
```

Terraform writes **`database-url`** to SSM; `api:secrets:push` adds **`clerk-secret-key`** and **`clerk-webhook-signing-secret`** from the repo-root `.env.develop` so they never land in Terraform state. ECS injects them at task start, and the api container applies pending migrations on boot (`RUN_MIGRATIONS=true`). The task role is the **develop** API principal for Bedrock (`api_runtime_role_arn`). The laptop API uses a separate IAM user from [`local/README.md`](../local/README.md).

`task api:deploy` pushes `:<tag>` and `:latest`, forces a new ECS deployment, and waits for it to be stable. The new task points `dev.api` at its own public IP once healthy; clients may reach the old IP for up to a minute.

For psql access: `task db:tunnel` (SSM port-forward through the running task via ECS Exec), then `task db:url`.

## Deploy the client

Upload assets to the private S3 bucket (CloudFront serves them):

```bash
task client:deploy
```

Open the site at:

```bash
terraform -chdir=infra/envs/develop output -raw site_url
```

## Deploy the admin app

Same pattern as the client; builds with `VITE_API_URL` from Terraform and syncs to the admin bucket:

```bash
task admin:deploy
```

Open:

```bash
terraform -chdir=infra/envs/develop output -raw admin_site_url
```

Default hostname: `https://dev.admin.respark.kevinmccartney.is`.

In the [Clerk Dashboard](https://dashboard.clerk.com/), add that origin to **Allowed origins** / redirect URLs for the shared Clerk application (same publishable key as the client).

After deploy, you may need a CloudFront invalidation if you only changed cached assets; for many static deploys, syncing S3 and waiting for TTL is enough. `task client:deploy` / `task admin:deploy` already create an invalidation.
