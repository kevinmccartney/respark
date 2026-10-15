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

output "deploy_command" {
  description = "Sync client Vite build output to the bucket (run from repository root)."
  value       = module.ui.deploy_command
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

output "admin_deploy_command" {
  description = "Sync admin Vite build output to the bucket (run from repository root)."
  value       = module.admin.deploy_command
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
  description = "Postgres endpoint (reachable only from the API task security groups)."
  value       = module.db.endpoint
}

output "db_database_url_parameter" {
  description = "SSM parameter holding the API connection string (master user)."
  value       = module.db.database_url_parameter_name
}

output "db_security_group_id" {
  description = "RDS security group; develop adds an ingress rule for its API task."
  value       = module.db.security_group_id
}

output "api_runtime_role_arn" {
  description = "IAM role the production API task uses for Bedrock and other AWS APIs."
  value       = module.api_service.role_arn
}

output "api_runtime_role_name" {
  description = "Name of the production API task role."
  value       = module.api_service.role_name
}

output "api_parameter_prefix" {
  description = "SSM prefix holding API secrets (database-url, clerk-secret-key, …)."
  value       = local.api_parameter_prefix
}
