# Caddy's data dir lives here so certificates survive task restarts; reissuing on every
# deploy would hit Let's Encrypt's duplicate-certificate limit.
resource "aws_efs_file_system" "caddy" {
  encrypted = true

  tags = merge(local.common_tags, {
    Name = "${local.name_prefix}-caddy"
  })
}

resource "aws_efs_mount_target" "caddy" {
  for_each = toset(data.aws_subnets.default.ids)

  file_system_id  = aws_efs_file_system.caddy.id
  subnet_id       = each.value
  security_groups = [aws_security_group.efs.id]
}

resource "aws_efs_access_point" "caddy" {
  file_system_id = aws_efs_file_system.caddy.id

  # The official Caddy image runs as root.
  posix_user {
    uid = 0
    gid = 0
  }

  root_directory {
    path = "/caddy"
    creation_info {
      owner_uid   = 0
      owner_gid   = 0
      permissions = "0700"
    }
  }

  tags = local.common_tags
}
