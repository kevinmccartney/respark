locals {
  environment = "develop"

  # Fixed path so the api module can grant access to it without depending on the
  # db module, which in turn needs the api security group.
  api_parameter_prefix        = "/${var.project}/${local.environment}/api"
  database_url_parameter_name = "${local.api_parameter_prefix}/database-url"
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
  component        = "web" # keep: part of the existing S3 bucket name
  app_dir          = "client"
  bucket_name      = var.bucket_name
  hosted_zone_name = var.hosted_zone_name
  domain_name      = var.domain_name
}

module "admin" {
  source = "../../modules/ui"

  providers = {
    aws           = aws
    aws.us_east_1 = aws.us_east_1
  }

  aws_region       = var.aws_region
  project          = var.project
  environment      = local.environment
  component        = "admin"
  bucket_name      = var.admin_bucket_name
  hosted_zone_name = var.hosted_zone_name
  domain_name      = var.admin_domain_name
}

module "api" {
  source = "../../modules/api"

  providers = {
    aws           = aws
    aws.us_east_1 = aws.us_east_1
  }

  aws_region       = var.aws_region
  project          = var.project
  environment      = local.environment
  hosted_zone_name = var.hosted_zone_name
  domain_name      = var.api_domain_name

  parameter_prefix = local.api_parameter_prefix
}

module "db" {
  source = "../../modules/db"

  project     = var.project
  environment = local.environment

  api_security_group_id       = module.api.security_group_id
  database_url_parameter_name = local.database_url_parameter_name
  instance_class              = var.db_instance_class
  allocated_storage           = var.db_allocated_storage
}
