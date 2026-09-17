output "bucket_name" {
  description = "Name of the S3 bucket hosting the static site."
  value       = aws_s3_bucket.site.id
}

output "bucket_arn" {
  description = "ARN of the S3 bucket."
  value       = aws_s3_bucket.site.arn
}

output "website_endpoint" {
  description = "S3 website endpoint URL (HTTP). Upload built assets, then open this URL."
  value       = aws_s3_bucket_website_configuration.site.website_endpoint
}

output "website_domain" {
  description = "S3 website endpoint hostname."
  value       = aws_s3_bucket_website_configuration.site.website_domain
}

output "deploy_command" {
  description = "Example command to sync the Vite build output to the bucket."
  value       = "aws s3 sync apps/web/dist s3://${aws_s3_bucket.site.id} --delete"
}
