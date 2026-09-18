#!/bin/bash
set -euo pipefail

dnf install -y amazon-ssm-agent docker aws-cli
systemctl enable --now amazon-ssm-agent docker

cat > /usr/local/bin/respark-deploy-api.sh << 'EOF'
${deploy_api_script}
EOF
chmod 755 /usr/local/bin/respark-deploy-api.sh

echo "Installed /usr/local/bin/respark-deploy-api.sh (CloudWatch log group: ${cloudwatch_log_group})"
