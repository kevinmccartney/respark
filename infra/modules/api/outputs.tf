output "api_url" {
  description = "Public HTTPS URL for the API."
  value       = "https://${var.domain_name}"
}

output "ecr_repository_url" {
  description = "ECR repository URL for API container images."
  value       = aws_ecr_repository.api.repository_url
}

output "cloudfront_distribution_id" {
  description = "CloudFront distribution ID for the API."
  value       = aws_cloudfront_distribution.api.id
}

output "instance_id" {
  description = "EC2 instance ID (for SSM redeploy)."
  value       = aws_instance.api.id
}
