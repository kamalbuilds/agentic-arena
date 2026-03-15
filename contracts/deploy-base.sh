#!/usr/bin/env bash
# Deploy Among Claws contracts to Base Sepolia (testnet)
#
# Usage:
#   PRIVATE_KEY=0x... ./deploy-base.sh
#
# Requires:
#   - Foundry (forge)
#   - PRIVATE_KEY env var with funded Base wallet

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

if [ -z "${PRIVATE_KEY:-}" ]; then
  # Try loading from engine .env
  if [ -f "../engine/.env" ]; then
    PRIVATE_KEY=$(grep OPERATOR_PRIVATE_KEY ../engine/.env | cut -d'=' -f2)
  fi
fi

if [ -z "${PRIVATE_KEY:-}" ] || [ "$PRIVATE_KEY" = "0x_your_private_key_here" ]; then
  echo "ERROR: Set PRIVATE_KEY env var or OPERATOR_PRIVATE_KEY in engine/.env"
  exit 1
fi

echo ""
echo "  Deploying Among Claws to Base Sepolia (Chain 84532)"
echo "  RPC: https://sepolia.base.org"
echo ""

# Build first
forge build

# Step 1: Deploy base game contracts (Game, Betting, Leaderboard)
echo "  Step 1/2: Deploying base game contracts..."
forge script script/Deploy.s.sol \
  --rpc-url https://sepolia.base.org \
  --private-key "$PRIVATE_KEY" \
  --broadcast \
  --legacy \
  -vvv

echo ""

# Step 2: Deploy Colosseum expansion (Tournament, Season, AgentNFT, ArenaRegistry)
echo "  Step 2/2: Deploying Colosseum expansion contracts..."
forge script script/DeployColosseum.s.sol \
  --rpc-url https://sepolia.base.org \
  --private-key "$PRIVATE_KEY" \
  --broadcast \
  --legacy \
  -vvv

echo ""
echo "  All contracts deployed to Base Sepolia!"
echo ""
echo "  Copy these addresses into engine/.env:"
echo "    GAME_CONTRACT_ADDRESS=<from Deploy.s.sol output>"
echo "    BETTING_CONTRACT_ADDRESS=<from Deploy.s.sol output>"
echo "    LEADERBOARD_CONTRACT_ADDRESS=<from Deploy.s.sol output>"
echo "    TOURNAMENT_CONTRACT_ADDRESS=<from DeployColosseum.s.sol output>"
echo "    SEASON_CONTRACT_ADDRESS=<from DeployColosseum.s.sol output>"
echo "    AGENT_NFT_CONTRACT_ADDRESS=<from DeployColosseum.s.sol output>"
echo "    ARENA_REGISTRY_CONTRACT_ADDRESS=<from DeployColosseum.s.sol output>"
echo ""
echo "  Verify on BaseScan: https://sepolia.basescan.org/verifyContract"
echo ""
