# production environment

Terraform root for the **production** AWS environment (same account as develop; separated by `Environment` tags and `respark-production-*` names). Hosts:

| App    | Hostname                          |
| ------ | --------------------------------- |
| Client | `respark.kevinmccartney.is`       |
| Admin  | `admin.respark.kevinmccartney.is` |
| API    | `api.respark.kevinmccartney.is`   |

State key: `envs/production/terraform.tfstate` in the shared `respark-tfstate` bucket. SSM parameters live under `/respark/production/api`.

## Prerequisites

- Route53 hosted zone for `kevinmccartney.is` in this AWS account
- AWS credentials with permission to manage S3, CloudFront, ACM, Route53, EC2, ECR, **RDS**, and **SSM Parameter Store**
- GitHub Environment **`production`** with `AWS_ROLE_ARN`, `VITE_CLERK_PUBLISHABLE_KEY` (prod Clerk instance), and `COMPILE_CHECK_API_URL=https://api.respark.kevinmccartney.is`
- Separate Clerk **production** application (not the develop publishable key)

## Modules

Same wiring as develop: `ui` (client), `admin`, `api`, `db`. Production enables RDS `deletion_protection` and takes a final snapshot on destroy (`skip_final_snapshot = false`).

## First bring-up

```bash
# Once per AWS account if not already done:
bash scripts/bootstrap-tf-backend.sh

task infra:init ENV=production
task infra:plan ENV=production
task infra:apply ENV=production

# Prod Clerk secret → SSM (never Terraform state). Prefer a prod-only env file:
task api:secrets:push ENV=production
```

Then deploy apps locally or via **Actions → CI / CD → Run workflow → `production`** (force all). Push to `main` always deploys **develop** only; production is intentional.

```bash
task api:deploy ENV=production
task client:deploy ENV=production
task admin:deploy ENV=production
# or: task deploy ENV=production
```

Open:

```bash
terraform -chdir=infra/envs/production output -raw site_url
terraform -chdir=infra/envs/production output -raw admin_site_url
terraform -chdir=infra/envs/production output -raw api_url
```

In the [Clerk Dashboard](https://dashboard.clerk.com/) for the **production** instance, allow the client and admin origins (and API webhook URL when ready).

Catalog data: prod DB starts empty — run ETL/sync as a follow-on after the stack is up.

See [`docs/ci-cd.md`](../../docs/ci-cd.md) for OIDC trust and GitHub Environment variables.
