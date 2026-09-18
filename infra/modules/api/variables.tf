variable "aws_region" {
  description = "AWS region for EC2, ECR, and regional resources."
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
  description = "Public API hostname served by CloudFront."
  type        = string
}

variable "hosted_zone_name" {
  description = "Route53 hosted zone name (for example kevinmccartney.is)."
  type        = string
}

variable "instance_type" {
  description = "EC2 instance type for the API (ARM Graviton recommended)."
  type        = string
  default     = "t4g.micro"
}

variable "container_image_tag" {
  description = "ECR image tag the instance pulls on boot and redeploy."
  type        = string
  default     = "latest"
}

variable "cloudfront_price_class" {
  description = "CloudFront price class for the API distribution."
  type        = string
  default     = "PriceClass_100"
}

variable "api_port" {
  description = "Port the NestJS process listens on inside the container."
  type        = number
  default     = 3000
}

variable "log_retention_in_days" {
  description = "CloudWatch Logs retention for API container stdout."
  type        = number
  default     = 30
}

# Passed as a plain path rather than read from the db module, so the two modules
# stay acyclic: the db module needs this module's security group id.
variable "parameter_prefix" {
  description = "SSM Parameter Store prefix holding API secrets (database-url, clerk-secret-key)."
  type        = string
}
