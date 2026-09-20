variable "name_prefix" {
  description = "Prefix for the managed policy name (for example respark-local-api)."
  type        = string
}

variable "tags" {
  description = "Tags applied to the managed policy."
  type        = map(string)
  default     = {}
}
