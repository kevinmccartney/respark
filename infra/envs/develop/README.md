# develop environment

Terraform root for the **develop** AWS environment (0.x): S3 origin, CloudFront, ACM (HTTPS), and Route53 for `dev.respark.kevinmccartney.is`. Production (`respark.kevinmccartney.is` or similar) will get a separate env later.

## Prerequisites

- Route53 hosted zone for `kevinmccartney.is` in this AWS account
- AWS credentials with permission to manage S3, CloudFront, ACM, and Route53

## Apply

```bash
task infra:plan
task infra:apply
```

First apply may take several minutes while ACM DNS validation completes.

Optional: copy `terraform.tfvars.example` to `terraform.tfvars` to override `domain_name`, `hosted_zone_name`, or `bucket_name`.

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
