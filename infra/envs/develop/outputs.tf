output "bucket_name" {
  description = "S3 bucket for static assets."
  value       = module.ui.bucket_name
}

output "site_url" {
  description = "HTTPS URL for the UI."
  value       = module.ui.site_url
}

output "cloudfront_distribution_id" {
  description = "CloudFront distribution ID."
  value       = module.ui.cloudfront_distribution_id
}

output "deploy_command" {
  description = "Sync Vite build output to the bucket (run from repository root)."
  value       = module.ui.deploy_command
}
