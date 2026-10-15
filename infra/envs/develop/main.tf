locals {
  environment          = "develop"
  api_parameter_prefix = "/${var.project}/${local.environment}/api"
  database_name        = "respark_develop"
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
  component        = "web" # keep: matches production's bucket naming
  app_dir          = "client"
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

# Develop's database lives on the production RDS instance (managed by infra/envs/production).
data "aws_db_instance" "shared" {
  db_instance_identifier = "${var.project}-db"
}

data "aws_security_group" "shared_db" {
  name = "${var.project}-production-db-sg"
}

resource "aws_vpc_security_group_ingress_rule" "db_from_api" {
  security_group_id            = data.aws_security_group.shared_db.id
  description                  = "Postgres from the develop API task"
  ip_protocol                  = "tcp"
  from_port                    = 5432
  to_port                      = 5432
  referenced_security_group_id = module.api_service.security_group_id
}

# Alphanumeric only: the password is embedded in a URL, so this avoids escaping.
# scripts/db-create-env.sh creates the matching role and database on the instance.
resource "random_password" "db" {
  length  = 32
  special = false
}

resource "aws_ssm_parameter" "database_url" {
  name        = "${local.api_parameter_prefix}/database-url"
  description = "Postgres connection string for the develop API (${local.database_name} on the shared RDS instance)."
  type        = "SecureString"
  value = format(
    "postgres://%s:%s@%s:%s/%s",
    local.database_name,
    random_password.db.result,
    data.aws_db_instance.shared.address,
    data.aws_db_instance.shared.port,
    local.database_name,
  )

  tags = {
    Project     = var.project
    Environment = local.environment
    ManagedBy   = "terraform"
    Component   = "database"
  }
}

moved {
  from = module.cluster.aws_ssm_parameter.database_url[0]
  to   = aws_ssm_parameter.database_url
}
