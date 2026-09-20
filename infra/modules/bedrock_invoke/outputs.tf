output "policy_arn" {
  description = "ARN of the Bedrock invoke managed policy."
  value       = aws_iam_policy.invoke.arn
}

output "policy_name" {
  description = "Name of the Bedrock invoke managed policy."
  value       = aws_iam_policy.invoke.name
}
