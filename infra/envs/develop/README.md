# develop environment

Terraform root for the **develop** AWS environment. Run all Terraform commands from this directory.

## Apply

```bash
task infra:plan
task infra:apply
```

Or manually:

```bash
cd infra/envs/develop
terraform init
terraform plan
terraform apply
```

Optional: copy `terraform.tfvars.example` to `terraform.tfvars` to set `bucket_name` or `aws_region`.

## Deploy the web app

From the repository root:

```bash
task web:deploy
```

Or manually:

```bash
npm run build
aws s3 sync apps/web/dist s3://$(terraform -chdir=infra/envs/develop output -raw bucket_name) --delete
```

Site URL:

```bash
terraform -chdir=infra/envs/develop output website_endpoint
```
