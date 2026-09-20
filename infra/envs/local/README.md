# local environment

IAM-only Terraform root for the **laptop Compose API**. It does not create EC2, RDS, or CloudFront.

The runtime identity is IAM user `respark-local-api`, allowed to `bedrock:InvokeModel` / `InvokeModelWithResponseStream` on US inference profiles and their destination-Region foundation models, plus Marketplace subscribe for Haiku 4.5. Access keys are **not** in Terraform state — write them with Task after apply. IAM is evaluated in AWS; recreating Compose does not refresh it.

Develop's API uses the EC2 instance role instead (`infra/envs/develop`). Production will get its own env later.

## Apply

Same remote state bucket as develop (`respark-tfstate`), distinct key `envs/local/terraform.tfstate`.

```bash
task infra:init ENV=local
task infra:plan ENV=local
task infra:apply ENV=local
task api:local-aws:write
```

`api:local-aws:write` creates an access key for `respark-local-api` and upserts `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` in gitignored `apps/api/.env.local`. Pass `--rotate` to replace an existing key.

Then recreate the API container so Compose picks up the env file:

```bash
docker compose up -d api --force-recreate
```

Chat turns should log the Bedrock model id, not `mock`, and not the `terraform` IAM user.
