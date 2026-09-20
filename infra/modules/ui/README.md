# UI module (S3 + CloudFront + ACM + Route53)

Hosts a Vite SPA on a custom domain with HTTPS:

- Private **S3** bucket (origin for CloudFront OAC)
- **ACM** certificate (DNS validation, `us-east-1` provider)
- **CloudFront** distribution (HTTPS, SPA error handling)
- **Route53** alias records for the app hostname

Reusable for the player client and admin via `component`. The develop player SPA still uses `component = "web"` so the existing S3 bucket name does not change; pass `app_dir = "client"` so `deploy_command` points at `apps/client/dist`.

## Usage

Instantiate from an environment root (for example `infra/envs/develop`). Pass the default AWS provider and an `aws.us_east_1` alias for ACM:

```hcl
module "ui" {
  source = "../../modules/ui"

  providers = {
    aws           = aws
    aws.us_east_1 = aws.us_east_1
  }

  component        = "web"
  app_dir          = "client"
  domain_name      = "dev.respark.kevinmccartney.is"
  hosted_zone_name = "kevinmccartney.is"
}

module "admin" {
  source = "../../modules/ui"

  providers = {
    aws           = aws
    aws.us_east_1 = aws.us_east_1
  }

  component        = "admin"
  domain_name      = "dev.admin.respark.kevinmccartney.is"
  hosted_zone_name = "kevinmccartney.is"
}
```

Do not run `terraform apply` from this directory.
