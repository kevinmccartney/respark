locals {
  environment = "local"
  name_prefix = "${var.project}-${local.environment}-api"

  common_tags = {
    Project     = var.project
    Environment = local.environment
    ManagedBy   = "terraform"
    Component   = "web-api"
  }
}

# Laptop Compose API identity. Access keys are created outside Terraform
# (`task api:local-aws:write`) so secrets never land in state.
resource "aws_iam_user" "api" {
  name = local.name_prefix
  path = "/respark/"

  tags = local.common_tags
}

module "bedrock_invoke" {
  source = "../../modules/bedrock_invoke"

  name_prefix = local.name_prefix
  tags        = local.common_tags
}

resource "aws_iam_user_policy_attachment" "bedrock_invoke" {
  user       = aws_iam_user.api.name
  policy_arn = module.bedrock_invoke.policy_arn
}
