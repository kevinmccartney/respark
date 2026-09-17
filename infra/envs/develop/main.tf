locals {
  environment = "develop"
}

module "ui" {
  source = "../../modules/ui"

  aws_region  = var.aws_region
  project     = var.project
  environment = local.environment
  bucket_name = var.bucket_name
}
