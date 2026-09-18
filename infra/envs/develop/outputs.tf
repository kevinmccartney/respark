output "bucket_name" {
  description = "S3 bucket for static assets."
  value       = module.ui.bucket_name
}

output "site_url" {
  description = "HTTPS URL for the UI."
  value       = module.ui.site_url
}

output "cloudfront_distribution_id" {
  description = "CloudFront distribution ID for the UI."
  value       = module.ui.cloudfront_distribution_id
}

output "deploy_command" {
  description = "Sync Vite build output to the bucket (run from repository root)."
  value       = module.ui.deploy_command
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

output "api_cloudfront_distribution_id" {
  description = "CloudFront distribution ID for the API."
  value       = module.api.cloudfront_distribution_id
}
