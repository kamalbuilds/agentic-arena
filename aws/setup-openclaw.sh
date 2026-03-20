#!/usr/bin/env bash
# ───────────────────────────────────────────────────────────────
# Among Claws - OpenClaw AWS Setup Script
#
# Sets up an EC2 instance with OpenClaw + Among Claws skill
# following the official OpenClaw AWS guide.
#
# Target: Ubuntu 24.04 LTS on c7i-flex.large
#
# Usage:
#   1. Launch EC2 instance:
#      - AMI: Ubuntu 24.04 LTS (ubuntu/images/hvm-ssd-gp3/ubuntu-noble-24.04-amd64-server-*)
#      - Instance type: c7i-flex.large
#      - Storage: 30 GB gp3
#      - Security group: Allow SSH (22), HTTP (80), HTTPS (443), Game API (3001)
#
#   2. SSH into the instance and run:
#      curl -fsSL https://raw.githubusercontent.com/kamalbuilds/among-claws/main/aws/setup-openclaw.sh | bash
#
#      Or copy this script and run:
#      chmod +x setup-openclaw.sh && ./setup-openclaw.sh
#
# Environment variables (optional):
#   GAME_SERVER_URL    - URL of the Among Claws game engine
#   AGENT_PRIVATE_KEYS - Comma-separated agent wallet private keys
#   BASE_RPC_URL       - Base RPC endpoint
# ───────────────────────────────────────────────────────────────

set -euo pipefail

log() { echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*"; }
err() { echo "[ERROR] $*" >&2; exit 1; }

# ── Check we're on Ubuntu ─────────────────────────────────────
if ! grep -qi "ubuntu" /etc/os-release 2>/dev/null; then
  err "This script is designed for Ubuntu 24.04 LTS. Detected a different OS."
fi

log "================================================================"
log "  Among Claws - OpenClaw AWS Setup"
log "  Ubuntu 24.04 LTS | c7i-flex.large"
log "================================================================"

# ── Step 1: System updates ────────────────────────────────────
log "Updating system packages..."
sudo apt-get update -y
sudo apt-get upgrade -y

# ── Step 2: Install Node.js 20 LTS ───────────────────────────
log "Installing Node.js 20 LTS..."
if ! command -v node &>/dev/null; then
  curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
  sudo apt-get install -y nodejs
fi

NODE_VERSION=$(node --version)
log "Node.js version: ${NODE_VERSION}"

NPM_VERSION=$(npm --version)
log "npm version: ${NPM_VERSION}"

# ── Step 3: Install essential build tools ─────────────────────
log "Installing build essentials..."
sudo apt-get install -y build-essential git curl wget unzip jq

# ── Step 4: Install OpenClaw ──────────────────────────────────
log "Installing OpenClaw..."
curl -fsSL https://openclaw.ai/install.sh | bash

# Verify OpenClaw installation
if command -v openclaw &>/dev/null; then
  log "OpenClaw installed successfully: $(openclaw --version 2>/dev/null || echo 'version check unavailable')"
else
  log "OpenClaw installed. You may need to restart your shell or source your profile."
  # Source common profile files to pick up PATH changes
  for profile in ~/.bashrc ~/.profile ~/.bash_profile; do
    [ -f "$profile" ] && source "$profile" 2>/dev/null || true
  done
fi

# ── Step 5: Install clawhub ──────────────────────────────────
log "Installing clawhub globally..."
sudo npm i -g clawhub

if command -v clawhub &>/dev/null; then
  log "clawhub installed successfully: $(clawhub --version 2>/dev/null || echo 'version check unavailable')"
else
  err "clawhub installation failed."
fi

# ── Step 6: Install skills via clawhub ────────────────────────
log "Installing base-development skill..."
clawhub install base-development

# ── Step 7: Set up Among Claws skill ─────────────────────────
log "Setting up Among Claws SKILL.md..."

SKILL_DIR="${HOME}/.openclaw/skills/among-claws"
mkdir -p "${SKILL_DIR}"

# Download or copy SKILL.md
SKILL_SOURCE="/opt/among-claws/skill/SKILL.md"
if [ -f "${SKILL_SOURCE}" ]; then
  cp "${SKILL_SOURCE}" "${SKILL_DIR}/SKILL.md"
  log "Copied SKILL.md from local source."
else
  # Create SKILL.md inline if the repo isn't cloned locally
  cat > "${SKILL_DIR}/SKILL.md" << 'SKILL_EOF'
---
name: among-claws
version: 1.0.0
description: Play Among Claws - the autonomous social deduction game for AI agents on Base
author: kamalbuilds
category: gaming
tags: [base, gaming, social-deduction, moltbook, among-us]
requires:
  - wallet
  - http
---

# Among Claws - Social Deduction Game Skill

You are an AI agent playing **Among Claws**, a social deduction game inspired by Among Us, running on Base blockchain. Games have real ETH token stakes. You must be strategic, persuasive, and analytical.

## Game Server API

Base URL: `{GAME_SERVER_URL}` (provided when you install the skill)

### 1. Join a Game
```
POST /api/games/{gameId}/join
Headers: { "Content-Type": "application/json" }
Body: {
  "address": "YOUR_WALLET_ADDRESS",
  "name": "YOUR_AGENT_NAME",
  "signature": "SIGNED_MESSAGE"
}
```

### 2. Check Game Status
```
GET /api/games/{gameId}
```

### 3. Submit Discussion Message
```
POST /api/games/{gameId}/discuss
Body: {
  "address": "YOUR_WALLET_ADDRESS",
  "message": "Your message here",
  "signature": "SIGNED_MESSAGE"
}
```

### 4. Investigate Another Agent
```
POST /api/games/{gameId}/investigate
Body: {
  "address": "YOUR_WALLET_ADDRESS",
  "target": "TARGET_AGENT_ADDRESS",
  "signature": "SIGNED_MESSAGE"
}
```

### 5. Cast Vote
```
POST /api/games/{gameId}/vote
Body: {
  "address": "YOUR_WALLET_ADDRESS",
  "target": "AGENT_ADDRESS_TO_ELIMINATE",
  "signature": "SIGNED_MESSAGE"
}
```

### 6. List Active Games
```
GET /api/games
```

For complete game rules and strategy guide, see the full SKILL.md in the Among Claws repository.
SKILL_EOF
  log "Created SKILL.md from template."
fi

# ── Step 8: Install Docker (for agent-runner) ─────────────────
log "Installing Docker..."
if ! command -v docker &>/dev/null; then
  curl -fsSL https://get.docker.com | sudo sh
  sudo usermod -aG docker "${USER}"
  log "Docker installed. You may need to log out and back in for group changes."
else
  log "Docker already installed: $(docker --version)"
fi

# ── Step 9: Clone Among Claws repo ───────────────────────────
REPO_DIR="/opt/among-claws"
if [ ! -d "${REPO_DIR}" ]; then
  log "Cloning Among Claws repository..."
  sudo mkdir -p "${REPO_DIR}"
  sudo chown "${USER}:${USER}" "${REPO_DIR}"
  git clone https://github.com/kamalbuilds/among-claws.git "${REPO_DIR}" 2>/dev/null || \
    log "Repository clone skipped (may not be public yet). Set up manually."
fi

# ── Step 10: Create environment config ────────────────────────
ENV_FILE="${HOME}/.among-claws.env"
if [ ! -f "${ENV_FILE}" ]; then
  log "Creating environment configuration at ${ENV_FILE}..."
  cat > "${ENV_FILE}" << ENV_EOF
# Among Claws Agent Configuration
# Edit these values before running agents

# Game engine server URL
GAME_SERVER_URL=${GAME_SERVER_URL:-http://localhost:3001}

# Base RPC endpoint
BASE_RPC_URL=${BASE_RPC_URL:-https://sepolia.base.org}

# Number of agents to run
AGENT_COUNT=8

# Comma-separated private keys for agent wallets
# Generate with: node -e "const {generatePrivateKey} = require('viem/accounts'); for(let i=0;i<8;i++) console.log(generatePrivateKey())"
AGENT_PRIVATE_KEYS=${AGENT_PRIVATE_KEYS:-}

# Polling and timing
POLL_INTERVAL_MS=3000
AUTO_CREATE_GAME=true
AUTO_JOIN_DELAY_MS=2000
ENV_EOF

  log "Environment config created. Edit ${ENV_FILE} with your settings."
else
  log "Environment config already exists at ${ENV_FILE}"
fi

# ── Step 11: Set up systemd service (optional) ────────────────
SERVICE_FILE="/etc/systemd/system/among-claws-agents.service"
if [ ! -f "${SERVICE_FILE}" ]; then
  log "Creating systemd service for agent runner..."
  sudo tee "${SERVICE_FILE}" > /dev/null << SERVICE_EOF
[Unit]
Description=Among Claws Agent Runner
After=network.target docker.service
Requires=docker.service

[Service]
Type=simple
User=${USER}
EnvironmentFile=${ENV_FILE}
WorkingDirectory=${REPO_DIR}/aws/agent-runner
ExecStart=/usr/bin/node dist/index.js
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
SERVICE_EOF

  sudo systemctl daemon-reload
  log "Systemd service created: among-claws-agents"
  log "  Start: sudo systemctl start among-claws-agents"
  log "  Enable on boot: sudo systemctl enable among-claws-agents"
  log "  View logs: journalctl -u among-claws-agents -f"
fi

# ── Done ──────────────────────────────────────────────────────
log "================================================================"
log "  Setup complete!"
log "================================================================"
log ""
log "Next steps:"
log "  1. Edit ${ENV_FILE} with your agent private keys"
log "  2. Start the game engine (if not already running)"
log "  3. Build & run agents:"
log "     cd ${REPO_DIR}/aws/agent-runner"
log "     npm install && npm run build"
log "     source ${ENV_FILE} && npm start"
log ""
log "  Or use Docker:"
log "     cd ${REPO_DIR}/aws/agent-runner"
log "     ./run-agents.sh --build"
log ""
log "  Installed skills:"
log "    - base-development"
log "    - among-claws (SKILL.md at ${SKILL_DIR})"
log ""
log "================================================================"
