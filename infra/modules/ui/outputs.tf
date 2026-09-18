output "bucket_name" {
  description = "Name of the S3 bucket hosting static assets."
  value       = aws_s3_bucket.site.id
}

output "bucket_arn" {
  description = "ARN of the S3 bucket."
  value       = aws_s3_bucket.site.arn
}

output "cloudfront_distribution_id" {
  description = "CloudFront distribution ID (use for cache invalidations)."
  value       = aws_cloudfront_distribution.site.id
}

output "cloudfront_domain_name" {
  description = "CloudFront distribution domain name (*.cloudfront.net)."
  value       = aws_cloudfront_distribution.site.domain_name
}

output "site_url" {
  description = "HTTPS URL for the UI."
  value       = "https://${var.domain_name}"
}

output "domain_name" {
  description = "Custom domain name for the UI."
  value       = var.domain_name
}

output "deploy_command" {
  description = "Example command to sync the Vite build output to the bucket (run from repository root)."
  value       = "aws s3 sync apps/${var.component}/dist s3://${aws_s3_bucket.site.id} --delete"
}
