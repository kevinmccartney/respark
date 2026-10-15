resource "aws_ecs_cluster" "api" {
  name = local.name_prefix

  tags = local.common_tags
}

locals {
  log_options = {
    awslogs-group  = aws_cloudwatch_log_group.api.name
    awslogs-region = var.aws_region
  }

  containers = [
    {
      name      = "api"
      image     = "${aws_ecr_repository.api.repository_url}:latest"
      essential = true
      environment = [
        { name = "NODE_ENV", value = "production" },
        { name = "PORT", value = tostring(var.api_port) },
        { name = "RUN_MIGRATIONS", value = "true" },
        { name = "CHAT_PROVIDER", value = "bedrock" },
        { name = "BEDROCK_MODEL_ID", value = var.bedrock_model_id },
        { name = "AWS_REGION", value = var.aws_region },
        { name = "AWS_DEFAULT_REGION", value = var.aws_region },
      ]
      secrets = [
        { name = "DATABASE_URL", valueFrom = "${local.parameter_arn_prefix}/database-url" },
        { name = "CLERK_SECRET_KEY", valueFrom = "${local.parameter_arn_prefix}/clerk-secret-key" },
        { name = "CLERK_WEBHOOK_SIGNING_SECRET", valueFrom = "${local.parameter_arn_prefix}/clerk-webhook-signing-secret" },
      ]
      healthCheck = {
        command     = ["CMD-SHELL", "wget -qO- http://localhost:${var.api_port}/healthz >/dev/null || exit 1"]
        interval    = 15
        timeout     = 5
        retries     = 3
        startPeriod = 120
      }
      logConfiguration = {
        logDriver = "awslogs"
        options   = merge(local.log_options, { awslogs-stream-prefix = "api" })
      }
    },
    {
      name      = "caddy"
      image     = var.caddy_image
      essential = true
      command   = ["caddy", "reverse-proxy", "--from", var.domain_name, "--to", "localhost:${var.api_port}"]
      portMappings = [
        { containerPort = 80, protocol = "tcp" },
        { containerPort = 443, protocol = "tcp" },
      ]
      mountPoints = [
        { sourceVolume = "caddy-data", containerPath = "/data", readOnly = false },
      ]
      logConfiguration = {
        logDriver = "awslogs"
        options   = merge(local.log_options, { awslogs-stream-prefix = "caddy" })
      }
    },
    {
      name       = "dns-updater"
      image      = var.aws_cli_image
      essential  = false
      entryPoint = ["sh", "-c"]
      command = [templatefile("${path.module}/dns-updater.sh.tpl", {
        cluster     = aws_ecs_cluster.api.name
        domain_name = var.domain_name
        zone_id     = data.aws_route53_zone.site.zone_id
      })]
      dependsOn = [
        { containerName = "api", condition = "HEALTHY" },
      ]
      logConfiguration = {
        logDriver = "awslogs"
        options   = merge(local.log_options, { awslogs-stream-prefix = "dns-updater" })
      }
    },
  ]
}

resource "aws_ecs_task_definition" "api" {
  family                   = local.name_prefix
  requires_compatibilities = ["FARGATE"]
  network_mode             = "awsvpc"
  cpu                      = var.cpu
  memory                   = var.memory
  execution_role_arn       = aws_iam_role.execution.arn
  task_role_arn            = aws_iam_role.task.arn
  container_definitions    = jsonencode(local.containers)

  runtime_platform {
    operating_system_family = "LINUX"
    cpu_architecture        = "ARM64"
  }

  volume {
    name = "caddy-data"

    efs_volume_configuration {
      file_system_id     = aws_efs_file_system.caddy.id
      transit_encryption = "ENABLED"

      authorization_config {
        access_point_id = aws_efs_access_point.caddy.id
      }
    }
  }

  tags = local.common_tags
}

resource "aws_ecs_service" "api" {
  name                   = local.name_prefix
  cluster                = aws_ecs_cluster.api.id
  task_definition        = aws_ecs_task_definition.api.arn
  desired_count          = 1
  launch_type            = "FARGATE"
  enable_execute_command = true
  propagate_tags         = "SERVICE"

  deployment_minimum_healthy_percent = 100
  deployment_maximum_percent         = 200

  network_configuration {
    subnets          = data.aws_subnets.default.ids
    security_groups  = [aws_security_group.task.id]
    assign_public_ip = true
  }

  tags = local.common_tags

  depends_on = [aws_efs_mount_target.caddy]
}
