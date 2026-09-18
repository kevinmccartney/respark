# UI module (S3 + CloudFront + ACM + Route53)

Hosts the respark web app on a custom domain with HTTPS:

- Private **S3** bucket (origin for CloudFront OAC)
- **ACM** certificate (DNS validation, `us-east-1` provider)
- **CloudFront** distribution (HTTPS, SPA error handling)
- **Route53** alias records for the app hostname

## Usage

Instantiate from an environment root (for example `infra/envs/develop`). Pass the default AWS provider and an `aws.us_east_1` alias for ACM:

```hcl
module "ui" {
  source = "../../modules/ui"

  providers = {
    aws           = aws
    aws.us_east_1 = aws.us_east_1
  }

  domain_name      = "dev.respark.kevinmccartney.is"
  hosted_zone_name = "kevinmccartney.is"
}
```

Do not run `terraform apply` from this directory.
