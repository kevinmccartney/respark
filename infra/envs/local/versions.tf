terraform {
  required_version = ">= 1.5.0"

  backend "s3" {
    bucket         = "respark-tfstate"
    key            = "envs/local/terraform.tfstate"
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
