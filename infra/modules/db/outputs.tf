output "endpoint" {
  description = "Host:port for the Postgres instance (not publicly reachable)."
  value       = aws_db_instance.postgres.endpoint
}

output "address" {
  description = "Hostname of the Postgres instance."
  value       = aws_db_instance.postgres.address
}

output "port" {
  description = "Port the Postgres instance listens on."
  value       = aws_db_instance.postgres.port
}

output "database_name" {
  description = "Initial database name."
  value       = var.database_name
}

output "database_url_parameter_name" {
  description = "SSM Parameter Store path holding the connection string."
  value       = aws_ssm_parameter.database_url.name
}

output "security_group_id" {
  description = "Security group attached to the Postgres instance."
  value       = aws_security_group.postgres.id
}
