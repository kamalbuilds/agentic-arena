#!/usr/bin/env bash
# ───────────────────────────────────────────────────────────────
# Among Claws - Deploy Game Engine to AWS EC2
#
# Usage:
#   ./deploy-engine.sh [--create-instance] [--use-ecr]
#
# Prerequisites:
#   - AWS CLI v2 configured with appropriate credentials
#   - Docker installed locally
#   - SSH key pair created in AWS (default: among-claws-key)
# ───────────────────────────────────────────────────────────────

set -euo pipefail

# ── Configuration ──────────────────────────────────────────────
AWS_REGION="${AWS_REGION:-us-east-1}"
AWS_ACCOUNT_ID="${AWS_ACCOUNT_ID:-$(aws sts get-caller-identity --query Account --output text 2>/dev/null || echo '')}"
ECR_REPO_NAME="among-claws/engine"
IMAGE_TAG="latest"
LOCAL_IMAGE="among-claws-engine:${IMAGE_TAG}"

EC2_KEY_NAME="${EC2_KEY_NAME:-among-claws-key}"
EC2_INSTANCE_TYPE="${EC2_INSTANCE_TYPE:-t3.medium}"
EC2_SECURITY_GROUP="${EC2_SECURITY_GROUP:-among-claws-sg}"
EC2_INSTANCE_ID="${EC2_INSTANCE_ID:-}"
EC2_HOST="${EC2_HOST:-}"

SSH_USER="ec2-user"
SSH_KEY_PATH="${SSH_KEY_PATH:-~/.ssh/${EC2_KEY_NAME}.pem}"

PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"

USE_ECR=false
CREATE_INSTANCE=false

# ── Parse arguments ────────────────────────────────────────────
for arg in "$@"; do
  case $arg in
    --create-instance) CREATE_INSTANCE=true ;;
    --use-ecr) USE_ECR=true ;;
    --help)
      echo "Usage: $0 [--create-instance] [--use-ecr]"
      echo "  --create-instance  Create a new EC2 instance"
      echo "  --use-ecr          Push image to ECR (otherwise uses docker save/load)"
      exit 0
      ;;
  esac
done

log() { echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*"; }
err() { echo "[ERROR] $*" >&2; exit 1; }

# ── Validate prerequisites ────────────────────────────────────
command -v aws >/dev/null 2>&1 || err "AWS CLI not found. Install from https://aws.amazon.com/cli/"
command -v docker >/dev/null 2>&1 || err "Docker not found."

if [ -z "$AWS_ACCOUNT_ID" ]; then
  err "Cannot determine AWS account ID. Run 'aws configure' first."
fi

log "AWS Account: $AWS_ACCOUNT_ID"
log "AWS Region:  $AWS_REGION"

# ── Step 1: Build Docker image ─────────────────────────────────
log "Building Docker image..."
docker build -t "$LOCAL_IMAGE" "${PROJECT_ROOT}/engine"
log "Docker image built: $LOCAL_IMAGE"

# ── Step 2: Push to ECR (optional) ─────────────────────────────
if [ "$USE_ECR" = true ]; then
  ECR_URI="${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com/${ECR_REPO_NAME}"

  log "Logging in to ECR..."
  aws ecr get-login-password --region "$AWS_REGION" | \
    docker login --username AWS --password-stdin "${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com"

  # Create repo if it doesn't exist
  aws ecr describe-repositories --repository-names "$ECR_REPO_NAME" --region "$AWS_REGION" 2>/dev/null || \
    aws ecr create-repository --repository-name "$ECR_REPO_NAME" --region "$AWS_REGION"

  log "Pushing image to ECR..."
  docker tag "$LOCAL_IMAGE" "${ECR_URI}:${IMAGE_TAG}"
  docker push "${ECR_URI}:${IMAGE_TAG}"
  log "Image pushed to: ${ECR_URI}:${IMAGE_TAG}"

  REMOTE_IMAGE="${ECR_URI}:${IMAGE_TAG}"
else
  log "Saving Docker image to tarball for transfer..."
  docker save "$LOCAL_IMAGE" | gzip > /tmp/among-claws-engine.tar.gz
  log "Image saved to /tmp/among-claws-engine.tar.gz"
  REMOTE_IMAGE="$LOCAL_IMAGE"
fi

# ── Step 3: Create EC2 instance (optional) ──────────────────────
if [ "$CREATE_INSTANCE" = true ]; then
  log "Creating security group..."
  SG_ID=$(aws ec2 create-security-group \
    --group-name "$EC2_SECURITY_GROUP" \
    --description "Among Claws game engine" \
    --region "$AWS_REGION" \
    --query 'GroupId' --output text 2>/dev/null || \
    aws ec2 describe-security-groups \
      --group-names "$EC2_SECURITY_GROUP" \
      --region "$AWS_REGION" \
      --query 'SecurityGroups[0].GroupId' --output text)

  log "Security group: $SG_ID"

  # Open required ports
  for port in 22 80 443 3001 3002; do
    aws ec2 authorize-security-group-ingress \
      --group-id "$SG_ID" \
      --protocol tcp \
      --port "$port" \
      --cidr 0.0.0.0/0 \
      --region "$AWS_REGION" 2>/dev/null || true
  done

  # Get latest Amazon Linux 2023 AMI
  AMI_ID=$(aws ec2 describe-images \
    --owners amazon \
    --filters "Name=name,Values=al2023-ami-2023*-x86_64" "Name=state,Values=available" \
    --query 'Images | sort_by(@, &CreationDate) | [-1].ImageId' \
    --output text \
    --region "$AWS_REGION")

  log "AMI: $AMI_ID"

  # Create instance with Docker pre-installed via user data
  USER_DATA=$(cat <<'USERDATA'
#!/bin/bash
dnf update -y
dnf install -y docker nginx certbot python3-certbot-nginx
systemctl enable docker
systemctl start docker
usermod -aG docker ec2-user

# Install docker-compose
curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
chmod +x /usr/local/bin/docker-compose
USERDATA
)

  EC2_INSTANCE_ID=$(aws ec2 run-instances \
    --image-id "$AMI_ID" \
    --instance-type "$EC2_INSTANCE_TYPE" \
    --key-name "$EC2_KEY_NAME" \
    --security-group-ids "$SG_ID" \
    --user-data "$USER_DATA" \
    --tag-specifications "ResourceType=instance,Tags=[{Key=Name,Value=among-claws-engine}]" \
    --region "$AWS_REGION" \
    --query 'Instances[0].InstanceId' \
    --output text)

  log "EC2 instance created: $EC2_INSTANCE_ID"

  log "Waiting for instance to be running..."
  aws ec2 wait instance-running --instance-ids "$EC2_INSTANCE_ID" --region "$AWS_REGION"

  EC2_HOST=$(aws ec2 describe-instances \
    --instance-ids "$EC2_INSTANCE_ID" \
    --region "$AWS_REGION" \
    --query 'Reservations[0].Instances[0].PublicIpAddress' \
    --output text)

  log "EC2 public IP: $EC2_HOST"
  log "Waiting 60s for user-data to complete..."
  sleep 60
fi

# ── Step 4: Deploy to EC2 ──────────────────────────────────────
if [ -z "$EC2_HOST" ]; then
  if [ -n "$EC2_INSTANCE_ID" ]; then
    EC2_HOST=$(aws ec2 describe-instances \
      --instance-ids "$EC2_INSTANCE_ID" \
      --region "$AWS_REGION" \
      --query 'Reservations[0].Instances[0].PublicIpAddress' \
      --output text)
  else
    err "EC2_HOST not set. Either set EC2_HOST or EC2_INSTANCE_ID environment variable, or use --create-instance."
  fi
fi

log "Deploying to $EC2_HOST..."

SSH_OPTS="-o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null -i $SSH_KEY_PATH"

# Transfer image if not using ECR
if [ "$USE_ECR" = false ]; then
  log "Transferring Docker image to EC2..."
  scp $SSH_OPTS /tmp/among-claws-engine.tar.gz "${SSH_USER}@${EC2_HOST}:/tmp/"

  ssh $SSH_OPTS "${SSH_USER}@${EC2_HOST}" "docker load < /tmp/among-claws-engine.tar.gz && rm /tmp/among-claws-engine.tar.gz"
else
  # Login to ECR on the remote instance
  ssh $SSH_OPTS "${SSH_USER}@${EC2_HOST}" \
    "aws ecr get-login-password --region ${AWS_REGION} | docker login --username AWS --password-stdin ${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com && docker pull ${REMOTE_IMAGE}"
fi

# Transfer .env file
if [ -f "${PROJECT_ROOT}/.env" ]; then
  log "Transferring .env file..."
  scp $SSH_OPTS "${PROJECT_ROOT}/.env" "${SSH_USER}@${EC2_HOST}:/home/${SSH_USER}/.env"
fi

# Transfer nginx config
log "Transferring nginx config..."
scp $SSH_OPTS "${PROJECT_ROOT}/aws/nginx.conf" "${SSH_USER}@${EC2_HOST}:/tmp/among-claws-nginx.conf"

# Deploy on remote
ssh $SSH_OPTS "${SSH_USER}@${EC2_HOST}" bash <<REMOTE
set -euo pipefail

# Stop existing container if running
docker stop among-claws-engine 2>/dev/null || true
docker rm among-claws-engine 2>/dev/null || true

# Run the container
docker run -d \
  --name among-claws-engine \
  --restart unless-stopped \
  --env-file /home/${SSH_USER}/.env \
  -p 3001:3001 \
  -p 3002:3002 \
  ${REMOTE_IMAGE}

# Set up nginx
sudo cp /tmp/among-claws-nginx.conf /etc/nginx/conf.d/among-claws.conf
sudo nginx -t && sudo systemctl restart nginx

echo "Deployment complete!"
docker ps --filter name=among-claws-engine
REMOTE

log ""
log "=========================================="
log "  Deployment Complete!"
log "=========================================="
log "  HTTP API:    http://${EC2_HOST}:3001"
log "  WebSocket:   ws://${EC2_HOST}:3002"
log "  Health:      http://${EC2_HOST}:3001/api/health"
log "=========================================="
log ""
log "To set up HTTPS, SSH into the instance and run:"
log "  sudo certbot --nginx -d your-domain.com"
