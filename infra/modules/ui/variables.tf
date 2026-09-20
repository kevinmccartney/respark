variable "aws_region" {
  description = "AWS region for the S3 bucket."
  type        = string
  default     = "us-east-1"
}

variable "project" {
  description = "Project name used in resource tags and default bucket naming."
  type        = string
  default     = "respark"
}

variable "environment" {
  description = "Environment name (for example develop, staging, prod)."
  type        = string
  default     = "dev"
}

variable "component" {
  description = "Short name for this static site (`web` for the player client, `admin`). Used in default bucket naming and tags. Do not change existing env values — they are part of bucket names."
  type        = string
  default     = "web"
}

variable "app_dir" {
  description = "Monorepo app directory under apps/ for the Vite dist path. Defaults to component. The player SPA lives in apps/client even though component stays \"web\"."
  type        = string
  default     = null
}

variable "bucket_name" {
  description = "Globally unique S3 bucket name. Leave empty to generate one from project and environment."
  type        = string
  default     = null
}

variable "domain_name" {
  description = "Public hostname for the UI (CloudFront alternate domain name)."
  type        = string
}

variable "hosted_zone_name" {
  description = "Route53 hosted zone name (with trailing dot implied by AWS API). Example: kevinmccartney.is"
  type        = string
}

variable "index_document" {
  description = "Default object served for directory requests."
  type        = string
  default     = "index.html"
}

variable "error_document" {
  description = "Object served for SPA fallback via CloudFront custom error responses."
  type        = string
  default     = "index.html"
}

variable "cloudfront_price_class" {
  description = "CloudFront price class for the distribution."
  type        = string
  default     = "PriceClass_100"
}
