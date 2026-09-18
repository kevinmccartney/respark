# develop environment

Terraform root for the **develop** AWS environment (0.x): S3 origin, CloudFront, ACM (HTTPS), and Route53 for `dev.respark.kevinmccartney.is`. Production (`respark.kevinmccartney.is` or similar) will get a separate env later.

## Prerequisites

- Route53 hosted zone for `kevinmccartney.is` in this AWS account
- AWS credentials with permission to manage S3, CloudFront, ACM, Route53, EC2, ECR, **RDS**, and **SSM Parameter Store**

## Modules

- **`ui`** — S3 + CloudFront + ACM + Route53 for the web app
- **`api`** — ECR, EC2, CloudFront, ACM, DNS, CloudWatch Logs
- **`db`** — RDS Postgres, private to the API security group, with the connection string in SSM Parameter Store

The `db` module takes the API security group as input, so the `api` module receives the SSM parameter **path** as a plain string (`local.database_url_parameter_name`) rather than referencing `module.db`. That keeps the two modules acyclic.

## Apply

```bash
task infra:plan
task infra:apply
```

First apply may take several minutes while ACM DNS validation completes. Creating the RDS instance takes roughly 5-10 minutes.

Optional: copy `terraform.tfvars.example` to `terraform.tfvars` to override `domain_name`, `hosted_zone_name`, or `bucket_name`.

## Deploy the API

```bash
task api:secrets:push   # once, and after any Clerk key rotation
task api:deploy
```

Terraform generates the database password and writes **`DATABASE_URL`** to SSM Parameter Store as a `SecureString`; `api:secrets:push` adds **`clerk-secret-key`** from `apps/api/.env` so it never lands in Terraform state. The instance role reads both during redeploy, so no secret passes through an operator's machine, and the container applies pending migrations on boot via `RUN_MIGRATIONS=true`.

`infra:apply` replaces the EC2 instance whenever `user_data` changes. The redeploy script waits for cloud-init to finish installing `/usr/local/bin/respark-deploy-api.sh`, so running `task api:deploy` immediately afterwards is safe.

`task api:deploy` needs **`ssm:SendCommand`** on the instance, and Postgres is only reachable from the API security group — use SSM port forwarding through the EC2 box for psql access.

## Deploy the web app

Upload assets to the private S3 bucket (CloudFront serves them):

```bash
task web:deploy
```

Open the site at:

```bash
terraform -chdir=infra/envs/develop output -raw site_url
```

After deploy, you may need a CloudFront invalidation if you only changed cached assets; for many static deploys, syncing S3 and waiting for TTL is enough. Use `terraform output cloudfront_distribution_id` with `aws cloudfront create-invalidation` if needed.
