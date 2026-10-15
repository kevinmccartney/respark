output "bucket_name" {
  description = "S3 bucket for player client static assets."
  value       = module.ui.bucket_name
}

output "site_url" {
  description = "HTTPS URL for the player client."
  value       = module.ui.site_url
}

output "cloudfront_distribution_id" {
  description = "CloudFront distribution ID for the player client."
  value       = module.ui.cloudfront_distribution_id
}

output "admin_bucket_name" {
  description = "S3 bucket for admin static assets."
  value       = module.admin.bucket_name
}

output "admin_site_url" {
  description = "HTTPS URL for the admin UI."
  value       = module.admin.site_url
}

output "admin_cloudfront_distribution_id" {
  description = "CloudFront distribution ID for the admin UI."
  value       = module.admin.cloudfront_distribution_id
}

output "api_url" {
  description = "HTTPS URL for the API."
  value       = module.api_service.api_url
}

output "api_ecr_repository_url" {
  description = "ECR URL for API images."
  value       = module.api_service.ecr_repository_url
}

output "ecs_cluster_name" {
  description = "ECS cluster running the API service."
  value       = module.api_service.cluster_name
}

output "ecs_service_name" {
  description = "ECS service for the API (task db:tunnel goes through its task)."
  value       = module.api_service.service_name
}

output "api_cloudwatch_log_group" {
  description = "CloudWatch Logs group for the API task's containers."
  value       = module.api_service.log_group_name
}

output "db_endpoint" {
  description = "Shared RDS endpoint (reachable only from the API task security groups)."
  value       = "${data.aws_db_instance.shared.address}:${data.aws_db_instance.shared.port}"
}

output "db_database_url_parameter" {
  description = "SSM parameter holding the develop connection string."
  value       = aws_ssm_parameter.database_url.name
}

output "api_runtime_role_arn" {
  description = "IAM role the develop API task uses for Bedrock and other AWS APIs."
  value       = module.api_service.role_arn
}

output "api_runtime_role_name" {
  description = "Name of the develop API task role."
  value       = module.api_service.role_name
}

output "api_parameter_prefix" {
  description = "SSM prefix holding API secrets (database-url, clerk-secret-key, …)."
  value       = local.api_parameter_prefix
}
