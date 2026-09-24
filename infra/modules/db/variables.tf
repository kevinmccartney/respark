variable "project" {
  description = "Project name used in tags and resource naming."
  type        = string
  default     = "respark"
}

variable "environment" {
  description = "Environment name (for example develop)."
  type        = string
}

variable "api_security_group_id" {
  description = "Security group of the API instances allowed to reach Postgres."
  type        = string
}

variable "database_url_parameter_name" {
  description = "SSM Parameter Store path holding the API connection string."
  type        = string
}

variable "instance_class" {
  description = "RDS instance class (ARM Graviton recommended)."
  type        = string
  default     = "db.t4g.micro"
}

variable "engine_version" {
  description = "Postgres major version. Minor upgrades are applied automatically."
  type        = string
  default     = "17"
}

variable "allocated_storage" {
  description = "Allocated storage in GiB (gp3 minimum is 20)."
  type        = number
  default     = 20
}

variable "database_name" {
  description = "Initial database name."
  type        = string
  default     = "respark"
}

variable "master_username" {
  description = "Master username for the instance."
  type        = string
  default     = "respark"
}

variable "backup_retention_period" {
  description = "Days of automated backups to retain."
  type        = number
  default     = 7
}

variable "deletion_protection" {
  description = "Block accidental deletion. Left off for pre-prod environments."
  type        = bool
  default     = false
}

variable "skip_final_snapshot" {
  description = "Skip a final snapshot when destroying the instance. Leave true for pre-prod; false for production."
  type        = bool
  default     = true
}
