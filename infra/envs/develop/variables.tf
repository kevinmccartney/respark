variable "aws_region" {
  description = "AWS region for this environment."
  type        = string
  default     = "us-east-1"
}

variable "project" {
  description = "Project name passed through to modules."
  type        = string
  default     = "respark"
}

variable "bucket_name" {
  description = "Optional fixed S3 bucket name for the UI (globally unique)."
  type        = string
  default     = null
}
