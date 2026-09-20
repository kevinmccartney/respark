output "api_user_name" {
  description = "IAM user the local Compose API should authenticate as."
  value       = aws_iam_user.api.name
}

output "api_user_arn" {
  description = "ARN of the local Compose API IAM user."
  value       = aws_iam_user.api.arn
}

output "bedrock_invoke_policy_arn" {
  description = "Managed policy attached to the local API user for Bedrock chat."
  value       = module.bedrock_invoke.policy_arn
}
