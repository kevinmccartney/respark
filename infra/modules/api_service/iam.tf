data "aws_iam_policy_document" "ecs_tasks_assume" {
  statement {
    actions = ["sts:AssumeRole"]
    principals {
      type        = "Service"
      identifiers = ["ecs-tasks.amazonaws.com"]
    }
  }
}

# Used by ECS itself: pull the image, write logs, and resolve SSM secrets at task start.
resource "aws_iam_role" "execution" {
  name               = "${local.name_prefix}-execution"
  assume_role_policy = data.aws_iam_policy_document.ecs_tasks_assume.json

  tags = local.common_tags
}

resource "aws_iam_role_policy_attachment" "execution" {
  role       = aws_iam_role.execution.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy"
}

resource "aws_iam_role_policy" "execution_secrets" {
  name = "${local.name_prefix}-secrets"
  role = aws_iam_role.execution.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid      = "ReadApiParameters"
        Effect   = "Allow"
        Action   = ["ssm:GetParameters"]
        Resource = "${local.parameter_arn_prefix}/*"
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

# Assumed by the containers: Bedrock for deck chat, ECS Exec for db:tunnel, the
# dns-updater's self-registration, and Cost Explorer for the server cost page.
resource "aws_iam_role" "task" {
  name               = "${local.name_prefix}-task"
  assume_role_policy = data.aws_iam_policy_document.ecs_tasks_assume.json

  tags = local.common_tags
}

module "bedrock_invoke" {
  source = "../bedrock_invoke"

  name_prefix = local.name_prefix
  tags        = local.common_tags
}

resource "aws_iam_role_policy_attachment" "task_bedrock" {
  role       = aws_iam_role.task.name
  policy_arn = module.bedrock_invoke.policy_arn
}

resource "aws_iam_role_policy" "task" {
  name = "${local.name_prefix}-task"
  role = aws_iam_role.task.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "EcsExec"
        Effect = "Allow"
        Action = [
          "ssmmessages:CreateControlChannel",
          "ssmmessages:CreateDataChannel",
          "ssmmessages:OpenControlChannel",
          "ssmmessages:OpenDataChannel",
        ]
        Resource = "*"
      },
      {
        Sid      = "FindOwnTask"
        Effect   = "Allow"
        Action   = ["ecs:DescribeTasks"]
        Resource = "arn:aws:ecs:${var.aws_region}:${data.aws_caller_identity.current.account_id}:task/${local.name_prefix}/*"
      },
      {
        Sid      = "FindOwnPublicIp"
        Effect   = "Allow"
        Action   = ["ec2:DescribeNetworkInterfaces"]
        Resource = "*"
      },
      {
        Sid      = "UpdateOwnRecord"
        Effect   = "Allow"
        Action   = ["route53:ChangeResourceRecordSets"]
        Resource = data.aws_route53_zone.site.arn
        Condition = {
          "ForAllValues:StringEquals" = {
            "route53:ChangeResourceRecordSetsNormalizedRecordNames" = [lower(var.domain_name)]
            "route53:ChangeResourceRecordSetsRecordTypes"           = ["A"]
            "route53:ChangeResourceRecordSetsActions"               = ["UPSERT"]
          }
        }
      },
      {
        # Cost Explorer has no resource-level permissions, so this reads the whole account;
        # the API filters to Project=respark itself (apps/api/src/costs).
        Sid      = "ReadProjectCosts"
        Effect   = "Allow"
        Action   = ["ce:GetCostAndUsage"]
        Resource = "*"
      },
    ]
  })
}
