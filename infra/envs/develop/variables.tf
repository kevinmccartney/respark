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

variable "domain_name" {
  description = "Public hostname for the develop player client (0.x pre-prod)."
  type        = string
  default     = "dev.respark.kevinmccartney.is"
}

variable "admin_domain_name" {
  description = "Public hostname for the develop admin UI."
  type        = string
  default     = "dev.admin.respark.kevinmccartney.is"
}

variable "hosted_zone_name" {
  description = "Route53 hosted zone for DNS and ACM validation."
  type        = string
  default     = "kevinmccartney.is"
}

variable "api_domain_name" {
  description = "Public hostname for the develop API."
  type        = string
  default     = "dev.api.respark.kevinmccartney.is"
}