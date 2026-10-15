locals {
  environment                 = "production"
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
  component        = "web"
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

module "api_service" {
  source = "../../modules/api_service"

  aws_region       = var.aws_region
  project          = var.project
  environment      = local.environment
  hosted_zone_name = var.hosted_zone_name
  domain_name      = var.api_domain_name
  parameter_prefix = local.api_parameter_prefix
}

# Also hosts the develop database (respark_develop); develop's root adds its own ingress rule.
module "db" {
  source = "../../modules/db"

  project     = var.project
  environment = local.environment

  database_url_parameter_name = local.database_url_parameter_name
  instance_class              = var.db_instance_class
  allocated_storage           = var.db_allocated_storage
  deletion_protection         = true
  skip_final_snapshot         = false
}

data "aws_route53_zone" "main" {
  name         = var.hosted_zone_name
  private_zone = false
}

# Clerk production instance (domain kevinmccartney.is): Frontend API, Account Portal, and email.
# Targets come from Clerk Dashboard -> Domains.
resource "aws_route53_record" "clerk" {
  for_each = {
    "clerk"           = "frontend-api.clerk.services"
    "accounts"        = "accounts.clerk.services"
    "clkmail"         = "mail.8uc8bw9xyapo.clerk.services"
    "clk._domainkey"  = "dkim1.8uc8bw9xyapo.clerk.services"
    "clk2._domainkey" = "dkim2.8uc8bw9xyapo.clerk.services"
  }

  zone_id = data.aws_route53_zone.main.zone_id
  name    = "${each.key}.${var.hosted_zone_name}"
  type    = "CNAME"
  ttl     = 300
  records = [each.value]
}

resource "aws_vpc_security_group_ingress_rule" "db_from_api" {
  security_group_id            = module.db.security_group_id
  description                  = "Postgres from the production API task"
  ip_protocol                  = "tcp"
  from_port                    = 5432
  to_port                      = 5432
  referenced_security_group_id = module.api_service.security_group_id
}

moved {
  from = module.api.aws_ecr_repository.api
  to   = module.api_service.aws_ecr_repository.api
}

moved {
  from = module.api.aws_ecr_lifecycle_policy.api
  to   = module.api_service.aws_ecr_lifecycle_policy.api
}

moved {
  from = module.api.aws_cloudwatch_log_group.api
  to   = module.api_service.aws_cloudwatch_log_group.api
}

moved {
  from = module.api.module.bedrock_invoke.aws_iam_policy.invoke
  to   = module.api_service.module.bedrock_invoke.aws_iam_policy.invoke
}
