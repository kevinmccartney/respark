locals {
  environment = "develop"
}

module "ui" {
  source = "../../modules/ui"

  providers = {
    aws           = aws
    aws.us_east_1 = aws.us_east_1
  }

  aws_region       = var.aws_region
  project          = var.project
  environment      = local.environment
  bucket_name      = var.bucket_name
  domain_name      = var.domain_name
  hosted_zone_name = var.hosted_zone_name
}
