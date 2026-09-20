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

output "cloudwatch_log_group_name" {
  description = "CloudWatch log group for API container stdout (JSON from Pino)."
  value       = aws_cloudwatch_log_group.api.name
}

output "cloudwatch_log_group_arn" {
  description = "CloudWatch log group ARN (for metric filters / alarms)."
  value       = aws_cloudwatch_log_group.api.arn
}

output "security_group_id" {
  description = "Security group attached to the API instance (source for database access)."
  value       = aws_security_group.api.id
}

output "runtime_role_arn" {
  description = "IAM role the API EC2 instance (and container) assumes for AWS APIs including Bedrock."
  value       = aws_iam_role.ec2.arn
}

output "runtime_role_name" {
  description = "Name of the API EC2 instance role."
  value       = aws_iam_role.ec2.name
}
