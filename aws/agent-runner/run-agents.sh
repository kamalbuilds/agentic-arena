#!/usr/bin/env bash
# ───────────────────────────────────────────────────────────────
# Among Claws - Run Agent Fleet on AWS
#
# Spins up N autonomous AI agents that play Among Claws.
# Can run locally via Docker or deploy to AWS ECS.
#
# Usage:
#   ./run-agents.sh [--count N] [--ecs] [--build]
#
# Environment:
#   GAME_SERVER_URL    - Game engine endpoint
#   AGENT_PRIVATE_KEYS - Comma-separated private keys
#   BASE_RPC_URL       - Base RPC endpoint
#   AWS_REGION         - AWS region (default: us-east-1)
# ───────────────────────────────────────────────────────────────

set -euo pipefail

AGENT_COUNT="${AGENT_COUNT:-8}"
AWS_REGION="${AWS_REGION:-us-east-1}"
AWS_ACCOUNT_ID="${AWS_ACCOUNT_ID:-$(aws sts get-caller-identity --query Account --output text 2>/dev/null || echo '')}"
ECR_REPO_NAME="among-claws/agent-runner"
IMAGE_TAG="latest"
LOCAL_IMAGE="among-claws-agent-runner:${IMAGE_TAG}"
DEPLOY_ECS=false
DO_BUILD=false

PROJECT_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
AGENT_RUNNER_DIR="$(cd "$(dirname "$0")" && pwd)"

for arg in "$@"; do
  case $arg in
    --count=*) AGENT_COUNT="${arg#*=}" ;;
    --count) shift; AGENT_COUNT="${2:-8}" ;;
    --ecs) DEPLOY_ECS=true ;;
    --build) DO_BUILD=true ;;
    --help)
      echo "Usage: $0 [--count N] [--ecs] [--build]"
      echo "  --count N   Number of agents (default: 8)"
      echo "  --ecs       Deploy to AWS ECS"
      echo "  --build     Build Docker image first"
      exit 0
      ;;
  esac
done

log() { echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*"; }
err() { echo "[ERROR] $*" >&2; exit 1; }

# ── Generate wallets if no keys provided ───────────────────────
generate_wallets() {
  log "Generating $AGENT_COUNT agent wallets..."
  # Use node to generate wallets using viem
  KEYS=$(node -e "
    const { generatePrivateKey } = require('viem/accounts');
    const keys = [];
    for (let i = 0; i < ${AGENT_COUNT}; i++) {
      keys.push(generatePrivateKey());
    }
    console.log(keys.join(','));
  " 2>/dev/null || echo "")

  if [ -z "$KEYS" ]; then
    log "Could not auto-generate wallets. Provide AGENT_PRIVATE_KEYS manually."
    return 1
  fi
  echo "$KEYS"
}

# ── Build ──────────────────────────────────────────────────────
if [ "$DO_BUILD" = true ]; then
  log "Building agent-runner Docker image..."
  docker build -t "$LOCAL_IMAGE" "$AGENT_RUNNER_DIR"
  log "Image built: $LOCAL_IMAGE"
fi

# ── Local Docker run ───────────────────────────────────────────
if [ "$DEPLOY_ECS" = false ]; then
  if [ -z "${AGENT_PRIVATE_KEYS:-}" ]; then
    log "AGENT_PRIVATE_KEYS not set."
    AGENT_PRIVATE_KEYS=$(generate_wallets) || err "Failed to generate wallets."
    export AGENT_PRIVATE_KEYS
  fi

  log "Starting agent-runner locally with $AGENT_COUNT agents..."

  docker stop among-claws-agents 2>/dev/null || true
  docker rm among-claws-agents 2>/dev/null || true

  docker run -d \
    --name among-claws-agents \
    --restart unless-stopped \
    -e GAME_SERVER_URL="${GAME_SERVER_URL:-http://host.docker.internal:3001}" \
    -e AGENT_COUNT="$AGENT_COUNT" \
    -e AGENT_PRIVATE_KEYS="$AGENT_PRIVATE_KEYS" \
    -e BASE_RPC_URL="${BASE_RPC_URL:-https://sepolia.base.org}" \
    "$LOCAL_IMAGE"

  log "Agent runner started. Logs:"
  docker logs -f among-claws-agents &
  LOGS_PID=$!
  sleep 10
  kill $LOGS_PID 2>/dev/null || true

  log "Agents are running in the background."
  log "  View logs: docker logs -f among-claws-agents"
  log "  Stop:      docker stop among-claws-agents"
  exit 0
fi

# ── Deploy to ECS ──────────────────────────────────────────────
if [ -z "$AWS_ACCOUNT_ID" ]; then
  err "AWS account ID required for ECS deployment. Run 'aws configure'."
fi

ECR_URI="${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com/${ECR_REPO_NAME}"

log "Pushing image to ECR..."
aws ecr get-login-password --region "$AWS_REGION" | \
  docker login --username AWS --password-stdin "${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com"

aws ecr describe-repositories --repository-names "$ECR_REPO_NAME" --region "$AWS_REGION" 2>/dev/null || \
  aws ecr create-repository --repository-name "$ECR_REPO_NAME" --region "$AWS_REGION"

docker tag "$LOCAL_IMAGE" "${ECR_URI}:${IMAGE_TAG}"
docker push "${ECR_URI}:${IMAGE_TAG}"

log "Creating ECS task definition..."

# Create CloudWatch log group
aws logs create-log-group \
  --log-group-name "/ecs/among-claws-agents" \
  --region "$AWS_REGION" 2>/dev/null || true

TASK_DEF=$(cat <<EOF
{
  "family": "among-claws-agent-runner",
  "networkMode": "awsvpc",
  "requiresCompatibilities": ["FARGATE"],
  "cpu": "512",
  "memory": "1024",
  "executionRoleArn": "arn:aws:iam::${AWS_ACCOUNT_ID}:role/ecsTaskExecutionRole",
  "containerDefinitions": [
    {
      "name": "agent-runner",
      "image": "${ECR_URI}:${IMAGE_TAG}",
      "essential": true,
      "environment": [
        { "name": "GAME_SERVER_URL", "value": "${GAME_SERVER_URL:-http://localhost:3001}" },
        { "name": "AGENT_COUNT", "value": "${AGENT_COUNT}" },
        { "name": "BASE_RPC_URL", "value": "${BASE_RPC_URL:-https://sepolia.base.org}" }
      ],
      "secrets": [
        {
          "name": "AGENT_PRIVATE_KEYS",
          "valueFrom": "arn:aws:ssm:${AWS_REGION}:${AWS_ACCOUNT_ID}:parameter/among-claws/agent-private-keys"
        }
      ],
      "logConfiguration": {
        "logDriver": "awslogs",
        "options": {
          "awslogs-group": "/ecs/among-claws-agents",
          "awslogs-region": "${AWS_REGION}",
          "awslogs-stream-prefix": "agent"
        }
      }
    }
  ]
}
EOF
)

echo "$TASK_DEF" > /tmp/agent-task-def.json
aws ecs register-task-definition --cli-input-json file:///tmp/agent-task-def.json --region "$AWS_REGION"

log "Task definition registered. To run the task:"
log "  aws ecs run-task --cluster among-claws --task-definition among-claws-agent-runner --launch-type FARGATE --network-configuration 'awsvpcConfiguration={subnets=[subnet-xxx],securityGroups=[sg-xxx],assignPublicIp=ENABLED}'"

log ""
log "View logs in CloudWatch: /ecs/among-claws-agents"
