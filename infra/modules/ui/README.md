# S3 static website (`ui`)

Reusable module for hosting the respark web app on **S3 website hosting** (HTTP website endpoint).

## Inputs / outputs

See `variables.tf` and `outputs.tf`.

## Usage

Instantiate from an environment root, for example `infra/envs/develop`:

```hcl
module "ui" {
  source = "../../modules/ui"

  aws_region  = var.aws_region
  project     = var.project
  environment = "develop"
}
```

Do not run `terraform apply` from this directory; apply from an environment root under `infra/envs/`.
