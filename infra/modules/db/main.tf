data "aws_vpc" "default" {
  default = true
}

data "aws_subnets" "default" {
  filter {
    name   = "vpc-id"
    values = [data.aws_vpc.default.id]
  }
}

locals {
  name_prefix = "${var.project}-${var.environment}-db"

  common_tags = {
    Project     = var.project
    Environment = var.environment
    ManagedBy   = "terraform"
    Component   = "database"
  }
}

resource "aws_db_subnet_group" "postgres" {
  name       = local.name_prefix
  subnet_ids = data.aws_subnets.default.ids

  tags = merge(local.common_tags, {
    Name = local.name_prefix
  })
}

resource "aws_security_group" "postgres" {
  name        = "${local.name_prefix}-sg"
  description = "Postgres reachable only from the API instances"
  vpc_id      = data.aws_vpc.default.id

  ingress {
    description     = "Postgres from the API security group"
    from_port       = 5432
    to_port         = 5432
    protocol        = "tcp"
    security_groups = [var.api_security_group_id]
  }

  tags = merge(local.common_tags, {
    Name = "${local.name_prefix}-sg"
  })
}

# Alphanumeric only: the password is embedded in a URL, so this avoids escaping.
resource "random_password" "master" {
  length  = 32
  special = false
}

resource "aws_db_instance" "postgres" {
  identifier     = local.name_prefix
  engine         = "postgres"
  engine_version = var.engine_version
  instance_class = var.instance_class

  db_name  = var.database_name
  username = var.master_username
  password = random_password.master.result

  allocated_storage     = var.allocated_storage
  max_allocated_storage = var.allocated_storage * 5
  storage_type          = "gp3"
  storage_encrypted     = true

  db_subnet_group_name   = aws_db_subnet_group.postgres.name
  vpc_security_group_ids = [aws_security_group.postgres.id]
  publicly_accessible    = false

  backup_retention_period    = var.backup_retention_period
  auto_minor_version_upgrade = true
  deletion_protection        = var.deletion_protection

  # Pre-prod: take changes now and allow a clean destroy.
  apply_immediately   = true
  skip_final_snapshot = true

  enabled_cloudwatch_logs_exports = ["postgresql"]

  tags = merge(local.common_tags, {
    Name = local.name_prefix
  })
}

resource "aws_ssm_parameter" "database_url" {
  name        = var.database_url_parameter_name
  description = "Postgres connection string for the ${var.environment} API."
  type        = "SecureString"
  value = format(
    "postgres://%s:%s@%s:%s/%s",
    var.master_username,
    random_password.master.result,
    aws_db_instance.postgres.address,
    aws_db_instance.postgres.port,
    var.database_name,
  )

  tags = local.common_tags
}
