variable "aws_region" {
  description = "AWS region for Bedrock and the local API IAM user."
  type        = string
  default     = "us-east-1"
}

variable "project" {
  description = "Project name used in tags and IAM names."
  type        = string
  default     = "respark"
}
