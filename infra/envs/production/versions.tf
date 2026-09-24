terraform {
  required_version = ">= 1.5.0"

  # Remote state for local + CI. Create the bucket/table once:
  #   bash scripts/bootstrap-tf-backend.sh
  # then: terraform -chdir=infra/envs/production init
  backend "s3" {
    bucket         = "respark-tfstate"
    key            = "envs/production/terraform.tfstate"
    region         = "us-east-1"
    dynamodb_table = "respark-tfstate-lock"
    encrypt        = true
  }

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

provider "aws" {
  region = var.aws_region
}

provider "aws" {
  alias  = "us_east_1"
  region = "us-east-1"
}
