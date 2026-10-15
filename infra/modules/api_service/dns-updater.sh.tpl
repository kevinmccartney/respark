set -eu
TASK_ARN="$(curl -fsS "$ECS_CONTAINER_METADATA_URI_V4/task" | grep -o '"TaskARN": *"[^"]*"' | cut -d'"' -f4)"
ENI="$(aws ecs describe-tasks --cluster "${cluster}" --tasks "$TASK_ARN" \
  --query "tasks[0].attachments[0].details[?name=='networkInterfaceId'].value | [0]" --output text)"
IP="$(aws ec2 describe-network-interfaces --network-interface-ids "$ENI" \
  --query 'NetworkInterfaces[0].Association.PublicIp' --output text)"
echo "Pointing ${domain_name} at $IP"
aws route53 change-resource-record-sets --hosted-zone-id "${zone_id}" --change-batch \
  "{\"Changes\":[{\"Action\":\"UPSERT\",\"ResourceRecordSet\":{\"Name\":\"${domain_name}\",\"Type\":\"A\",\"TTL\":60,\"ResourceRecords\":[{\"Value\":\"$IP\"}]}}]}"
