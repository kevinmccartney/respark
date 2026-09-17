output "bucket_name" {
  description = "S3 bucket hosting the static site."
  value       = module.ui.bucket_name
}

output "website_endpoint" {
  description = "S3 website endpoint URL (HTTP)."
  value       = module.ui.website_endpoint
}

output "deploy_command" {
  description = "Sync Vite build output to the bucket (run from repository root)."
  value       = module.ui.deploy_command
}
