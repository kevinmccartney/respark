output "api_url" {
  description = "Public HTTPS URL for the API."
  value       = "https://${var.domain_name}"
}

output "ecr_repository_url" {
  description = "ECR repository URL for API images (the service runs :latest)."
  value       = aws_ecr_repository.api.repository_url
}

output "cluster_name" {
  description = "ECS cluster name."
  value       = aws_ecs_cluster.api.name
}

output "service_name" {
  description = "ECS service name."
  value       = aws_ecs_service.api.name
}

output "security_group_id" {
  description = "Security group of the API task (source for database access)."
  value       = aws_security_group.task.id
}

output "log_group_name" {
  description = "CloudWatch log group for the task's containers."
  value       = aws_cloudwatch_log_group.api.name
}

output "role_arn" {
  description = "IAM role the API containers assume (Bedrock and other AWS APIs)."
  value       = aws_iam_role.task.arn
}

output "role_name" {
  description = "Name of the API task role."
  value       = aws_iam_role.task.name
}
