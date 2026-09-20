data "aws_caller_identity" "current" {}

# Lets the instance read its own secrets at deploy time, so nothing sensitive is
# shipped from an operator's laptop through SSM Run Command.
resource "aws_iam_role_policy" "ec2_read_parameters" {
  name = "${local.name_prefix}-read-parameters"
  role = aws_iam_role.ec2.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid      = "ReadApiParameters"
        Effect   = "Allow"
        Action   = ["ssm:GetParameter"]
        Resource = "arn:aws:ssm:${var.aws_region}:${data.aws_caller_identity.current.account_id}:parameter${var.parameter_prefix}/*"
      },
      {
        Sid      = "DecryptSecureStringWithAwsManagedKey"
        Effect   = "Allow"
        Action   = ["kms:Decrypt"]
        Resource = "*"
        Condition = {
          StringEquals = {
            "kms:ViaService" = "ssm.${var.aws_region}.amazonaws.com"
          }
        }
      },
    ]
  })
}

resource "aws_ssm_parameter" "bedrock_model_id" {
  name        = "${var.parameter_prefix}/bedrock-model-id"
  description = "Bedrock Converse model id for player deck chat."
  type        = "String"
  value       = var.bedrock_model_id

  tags = local.common_tags
}
