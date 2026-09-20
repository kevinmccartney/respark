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
  value       = module.api.api_url
}

output "api_ecr_repository_url" {
  description = "ECR URL for API images."
  value       = module.api.ecr_repository_url
}

output "api_instance_id" {
  description = "EC2 instance ID for API redeploy via SSM."
  value       = module.api.instance_id
}

output "api_cloudwatch_log_group" {
  description = "CloudWatch Logs group for API container stdout."
  value       = module.api.cloudwatch_log_group_name
}

output "api_cloudfront_distribution_id" {
  description = "CloudFront distribution ID for the API."
  value       = module.api.cloudfront_distribution_id
}

output "db_endpoint" {
  description = "Postgres endpoint (reachable only from the API security group)."
  value       = module.db.endpoint
}

output "db_database_url_parameter" {
  description = "SSM parameter holding the API connection string."
  value       = module.db.database_url_parameter_name
}
