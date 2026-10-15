# local environment

IAM-only Terraform root for the **laptop API** (Docker Compose or host `task api:dev`). It does not create EC2, RDS, or CloudFront.

The runtime identity is IAM user `respark-local-api`, allowed to `bedrock:InvokeModel` / `InvokeModelWithResponseStream` on US inference profiles and their destination-Region foundation models, plus Marketplace subscribe for Haiku 4.5. Access keys are **not** in Terraform state — write them with Task after apply. IAM is evaluated in AWS; redeploying the local API does not refresh it.

Develop's API uses the ECS task role instead (`infra/envs/develop`). Production uses the same pattern under [`../production`](../production/).

## Apply

Same remote state bucket as develop (`respark-tfstate`), distinct key `envs/local/terraform.tfstate`.

```bash
task infra:init ENV=local
task infra:plan ENV=local
task infra:apply ENV=local
task api:local-aws:write
```

`api:local-aws:write` creates an access key for `respark-local-api` and upserts `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` in the gitignored repo-root `.env.local`. Pass `--rotate` to replace an existing key.

Then recreate the Compose API so it picks up the env file:

```bash
task docker:up
```

Host `task api:dev` reads `.env.local` directly; just restart it.

Chat turns should log the Bedrock model id, not `mock`, and not the `terraform` IAM user.
