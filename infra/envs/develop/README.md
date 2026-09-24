# develop environment

Terraform root for the **develop** AWS environment (0.x): S3 origin, CloudFront, ACM (HTTPS), and Route53 for `dev.respark.kevinmccartney.is`. Production lives alongside in [`../production`](../production/) (same account, separate state key and tags).

## Prerequisites

- Route53 hosted zone for `kevinmccartney.is` in this AWS account
- AWS credentials with permission to manage S3, CloudFront, ACM, Route53, EC2, ECR, **RDS**, and **SSM Parameter Store**

## Modules

- **`ui`** — S3 + CloudFront + ACM + Route53 for the player client (`component = "web"` so the existing bucket name stays)
- **`admin`** — same `ui` module for the admin dashboard (`component = "admin"`)
- **`api`** — ECR, EC2, CloudFront, ACM, DNS, CloudWatch Logs. Runtime identity is the EC2 instance role (Bedrock chat).
- **`db`** — RDS Postgres, private to the API security group, with the connection string in SSM Parameter Store

The `db` module takes the API security group as input, so the `api` module receives the SSM parameter **path** as a plain string (`local.database_url_parameter_name`) rather than referencing `module.db`. That keeps the two modules acyclic.

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

First apply may take several minutes while ACM DNS validation completes. Creating the RDS instance takes roughly 5-10 minutes.

Optional: copy `terraform.tfvars.example` to `terraform.tfvars` to override `domain_name`, `admin_domain_name`, `hosted_zone_name`, or bucket names.

## Deploy the API

```bash
task api:secrets:push   # once, and after any Clerk key rotation
task api:deploy
```

Terraform generates the database password and writes **`DATABASE_URL`** to SSM Parameter Store as a `SecureString`; `api:secrets:push` adds **`clerk-secret-key`** from `apps/api/.env` so it never lands in Terraform state. Terraform also writes **`bedrock-model-id`** (plain String). The instance role reads parameters during redeploy, so no secret passes through an operator's machine, and the container applies pending migrations on boot via `RUN_MIGRATIONS=true`. Deck chat uses the instance profile for Bedrock (`InvokeModel` / `InvokeModelWithResponseStream`); the container reaches IMDSv2 because the hop limit is 2. That EC2 role is the **develop** API principal (`api_runtime_role_arn`). Laptop Compose uses a separate IAM user from [`local/README.md`](../local/README.md).

`infra:apply` replaces the EC2 instance whenever `user_data` changes. The redeploy script waits for cloud-init to finish installing `/usr/local/bin/respark-deploy-api.sh`, so running `task api:deploy` immediately afterwards is safe.

`task api:deploy` needs **`ssm:SendCommand`** on the instance, and Postgres is only reachable from the API security group — use SSM port forwarding through the EC2 box for psql access.

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
