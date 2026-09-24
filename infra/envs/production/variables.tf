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
  description = "Optional fixed S3 bucket name for the player client (globally unique)."
  type        = string
  default     = null
}

variable "domain_name" {
  description = "Public hostname for the production player client."
  type        = string
  default     = "respark.kevinmccartney.is"
}

variable "admin_bucket_name" {
  description = "Optional fixed S3 bucket name for the admin UI (globally unique)."
  type        = string
  default     = null
}

variable "admin_domain_name" {
  description = "Public hostname for the production admin UI."
  type        = string
  default     = "admin.respark.kevinmccartney.is"
}

variable "hosted_zone_name" {
  description = "Route53 hosted zone for DNS and ACM validation."
  type        = string
  default     = "kevinmccartney.is"
}

variable "api_domain_name" {
  description = "Public hostname for the production API."
  type        = string
  default     = "api.respark.kevinmccartney.is"
}

variable "db_instance_class" {
  description = "RDS instance class for the production database."
  type        = string
  default     = "db.t4g.micro"
}

variable "db_allocated_storage" {
  description = "Allocated storage in GiB for the production database."
  type        = number
  default     = 20
}
