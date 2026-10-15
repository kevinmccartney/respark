variable "aws_region" {
  description = "AWS region for ECS, ECR, and regional resources."
  type        = string
}

variable "project" {
  description = "Project name used in tags and resource naming."
  type        = string
  default     = "respark"
}

variable "environment" {
  description = "Environment name (for example develop)."
  type        = string
}

variable "domain_name" {
  description = "Public API hostname; Caddy gets a Let's Encrypt certificate for it and the task points its A record here."
  type        = string
}

variable "hosted_zone_name" {
  description = "Route53 hosted zone name (for example kevinmccartney.is)."
  type        = string
}

variable "parameter_prefix" {
  description = "SSM prefix holding database-url, clerk-secret-key, and clerk-webhook-signing-secret."
  type        = string
}

variable "cpu" {
  description = "Fargate task CPU units (shared by api, caddy, and dns-updater)."
  type        = number
  default     = 512
}

variable "memory" {
  description = "Fargate task memory in MiB."
  type        = number
  default     = 1024
}

variable "api_port" {
  description = "Port the NestJS process listens on inside the task."
  type        = number
  default     = 3000
}

variable "caddy_image" {
  description = "Caddy image that terminates TLS in the task."
  type        = string
  default     = "caddy:2.11-alpine"
}

variable "aws_cli_image" {
  description = "AWS CLI image for the one-shot DNS updater container."
  type        = string
  default     = "public.ecr.aws/aws-cli/aws-cli:2.37.6"
}

variable "bedrock_model_id" {
  description = "Bedrock Converse inference profile id (BEDROCK_MODEL_ID). Haiku 4.5 requires the us. profile."
  type        = string
  default     = "us.anthropic.claude-haiku-4-5-20251001-v1:0"
}

variable "log_retention_in_days" {
  description = "CloudWatch Logs retention for the task's containers."
  type        = number
  default     = 30
}
