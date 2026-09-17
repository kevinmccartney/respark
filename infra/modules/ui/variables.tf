variable "aws_region" {
  description = "AWS region for the S3 bucket and website endpoint."
  type        = string
  default     = "us-east-1"
}

variable "project" {
  description = "Project name used in resource tags and default bucket naming."
  type        = string
  default     = "respark"
}

variable "environment" {
  description = "Environment name (for example dev, staging, prod)."
  type        = string
  default     = "dev"
}

variable "bucket_name" {
  description = "Globally unique S3 bucket name. Leave empty to generate one from project and environment."
  type        = string
  default     = null
}

variable "index_document" {
  description = "Default object served for directory requests."
  type        = string
  default     = "index.html"
}

variable "error_document" {
  description = "Object served for 404 responses. Use index.html for client-side routed SPAs."
  type        = string
  default     = "index.html"
}
