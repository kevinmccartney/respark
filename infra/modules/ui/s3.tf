resource "random_id" "bucket_suffix" {
  count = var.bucket_name == null ? 1 : 0

  byte_length = 4
}

data "aws_route53_zone" "site" {
  name = var.hosted_zone_name
}

locals {
  bucket_name = coalesce(
    var.bucket_name,
    "${var.project}-${var.environment}-${var.component}-${random_id.bucket_suffix[0].hex}"
  )

  common_tags = {
    Project     = var.project
    Environment = var.environment
    Component   = var.component
    ManagedBy   = "terraform"
  }
}

resource "aws_s3_bucket" "site" {
  bucket = local.bucket_name

  tags = local.common_tags
}

resource "aws_s3_bucket_versioning" "site" {
  bucket = aws_s3_bucket.site.id

  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "site" {
  bucket = aws_s3_bucket.site.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

resource "aws_s3_bucket_public_access_block" "site" {
  bucket = aws_s3_bucket.site.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}
