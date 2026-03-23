/**
 * Agent-specific API routes for Among Claws.
 *
 * ERC-8004 Agent Identity endpoints:
 * - POST /api/agents/register - Register agent with on-chain ERC-8004 identity
 * - GET /api/agents/:id - Get agent profile + reputation + validation data
 * - POST /api/agents/:id/feedback - Submit reputation feedback after a game
 * - GET /api/agents/:id/reputation - Get reputation summary
 *
 * Autonomous game endpoints:
 * - POST /api/autonomous-game: Launch a game with LLM-powered agents
 * - GET /api/agent-logs: Get agent decision logs for process documentation
 * - GET /api/agent-logs/:name: Get logs for a specific agent
 */

import { Router, type Request, type Response } from "express";
import { gameManager } from "../game/GameManager.js";
import { wireGameEvents } from "../ws/server.js";
import { wireMoltbookEvents } from "../moltbook/MoltbookBroadcaster.js";
import { wireTwitterEvents } from "../services/TwitterBroadcaster.js";
import { AutonomousAgent, type AgentActionLog } from "../agents/AutonomousAgent.js";
import { logger } from "../utils/logger.js";
import {
  registerAgentIdentity,
  getAgentProfile,
  getAgentReputationSummary,
  getAgentClients,
  submitAgentFeedback,
  getAgentIdentityOwner,
  getAgentIdentityURI,
  isErc8004Configured,
  CANONICAL_ADDRESSES,
  type AgentIdentityProfile,
} from "../chain/erc8004.js";
import { getOrCreateAgentWallet } from "../chain/agentkit-wallet.js";
import { config } from "../config.js";

const log = logger.child("AgentRoutes");
export const agentRouter = Router();

// Track running autonomous agents for log retrieval
const runningAgents = new Map<string, AutonomousAgent[]>();

// ──────────────────────────────────────────
// POST /api/autonomous-game - Launch a game with AI agents
// ──────────────────────────────────────────
agentRouter.post("/api/autonomous-game", async (req: Request, res: Response) => {
  try {
    const {
      agentCount = 6,
      maxRounds = 3,
      anthropicApiKey,
    } = req.body;

    const count = Math.min(Math.max(parseInt(agentCount, 10) || 6, 5), 8);

    // Create an off-chain game for speed
    const room = await gameManager.createGame({
      minPlayers: count,
      maxPlayers: count,
      impostorCount: 1,
      maxRounds: maxRounds ? parseInt(maxRounds, 10) : 3,
      onChainEnabled: false,
    });

    wireGameEvents(room);
    wireMoltbookEvents(room);
    wireTwitterEvents(room);

    log.info(`Autonomous game ${room.gameId}: creating ${count} AI agents`);

    // Create agents
    const agents: AutonomousAgent[] = [];
    const NAMES = [
      "Claw_Alpha", "Claw_Beta", "Claw_Gamma", "Claw_Delta",
      "Claw_Epsilon", "Claw_Zeta", "Claw_Eta", "Claw_Theta",
    ];

    for (let i = 0; i < count; i++) {
      const agent = new AutonomousAgent({
        name: NAMES[i] || `Claw_Agent_${i}`,
        serverUrl: `http://localhost:${process.env.PORT || 3001}`,
        anthropicApiKey: anthropicApiKey || process.env.ANTHROPIC_API_KEY,
      });
      agents.push(agent);
    }

    // Store for log retrieval
    runningAgents.set(room.gameId, agents);

    // Initialize wallets, join game, then start
    const initAndRun = async () => {
      try {
        // Initialize all agents (wallets + ERC-8004)
        await Promise.all(agents.map((a) => a.initialize()));

        // Join all agents to the game directly via GameManager
        for (const agent of agents) {
          const joined = await gameManager.joinGame(
            room.gameId,
            agent.wallet.address,
            agent.name
          );
          if (joined) {
            log.info(`${agent.name} joined game ${room.gameId}`);
          }
        }

        // Start the game
        if (room.canStart()) {
          await room.start();
          log.info(`Game ${room.gameId} started with ${count} AI agents`);
        }

        // Run all agents in parallel (they poll the game state and act)
        await Promise.all(
          agents.map(async (agent) => {
            try {
              await agent.runInGame(room.gameId);
            } catch (err) {
              log.error(`${agent.name} crashed`, err);
            }
          })
        );

        log.info(`Autonomous game ${room.gameId} completed`);
      } catch (err) {
        log.error(`Autonomous game ${room.gameId} failed`, err);
      }
    };

    // Run in background (don't block the API response)
    initAndRun();

    // Wait briefly for initialization
    await new Promise((r) => setTimeout(r, 2000));

    res.status(201).json({
      gameId: room.gameId,
      agents: agents.map((a) => ({
        name: a.name,
        address: a.wallet?.address || "initializing",
      })),
      message: `Autonomous game started with ${count} LLM-powered agents. Watch at /api/games/${room.gameId}`,
      logsUrl: `/api/agent-logs/${room.gameId}`,
    });
  } catch (err) {
    log.error("Failed to launch autonomous game", err);
    res.status(500).json({ error: "Failed to launch autonomous game" });
  }
});

// ──────────────────────────────────────────
// GET /api/agent-logs/:gameId - Get agent logs for a specific game
// ──────────────────────────────────────────
agentRouter.get("/api/agent-logs/:gameId", (req: Request, res: Response) => {
  const gameId = String(req.params.gameId);
  const agents = runningAgents.get(gameId);

  if (!agents) {
    res.status(404).json({ error: "No agents found for this game" });
    return;
  }

  const logs = agents.map((agent) => ({
    name: agent.name,
    address: agent.wallet?.address || "unknown",
    personality: (agent.brain as any).personality || "unknown",
    actionLog: agent.getActionLog(),
    tradeLog: agent.trader.getTradeLog(),
  }));

  res.json({
    gameId,
    agentCount: agents.length,
    agents: logs,
  });
});

// ──────────────────────────────────────────
// GET /api/agent-logs - List all games with agent logs
// ──────────────────────────────────────────
agentRouter.get("/api/agent-logs", (_req: Request, res: Response) => {
  const games = Array.from(runningAgents.entries()).map(([gameId, agents]) => ({
    gameId,
    agentCount: agents.length,
    totalActions: agents.reduce((sum, a) => sum + a.getActionLog().length, 0),
    agents: agents.map((a) => ({
      name: a.name,
      address: a.wallet?.address || "unknown",
      actions: a.getActionLog().length,
    })),
  }));

  res.json({ games, count: games.length });
});

// ══════════════════════════════════════════════════════════════════════════════
// ERC-8004 Agent Identity Endpoints
// ══════════════════════════════════════════════════════════════════════════════

/**
 * Helper to serialize BigInt values in JSON responses.
 * JSON.stringify cannot handle BigInt natively, so we convert to strings.
 */
function serializeProfile(profile: AgentIdentityProfile) {
  return {
    agentId: profile.agentId.toString(),
    owner: profile.owner,
    agentWallet: profile.agentWallet,
    uri: profile.uri,
    game: profile.game,
    role: profile.role,
    reputation: profile.reputation
      ? {
          count: Number(profile.reputation.count),
          value: Number(profile.reputation.value),
          decimals: profile.reputation.decimals,
          // Compute human-readable score from scaled value
          score:
            profile.reputation.decimals > 0
              ? Number(profile.reputation.value) /
                Math.pow(10, profile.reputation.decimals)
              : Number(profile.reputation.value),
        }
      : null,
    validationSummary: profile.validationSummary
      ? {
          count: Number(profile.validationSummary.count),
          averageResponse: profile.validationSummary.averageResponse,
        }
      : null,
  };
}

// In-memory registry of agents registered via POST /api/agents/register
const registeredAgents: Array<{ name: string; address: string; registeredAt: number; txHash?: string }> = [];

// ──────────────────────────────────────────
// GET /api/agents - List all registered agents
// ──────────────────────────────────────────
agentRouter.get("/api/agents", (_req: Request, res: Response) => {
  res.json({
    count: registeredAgents.length,
    agents: registeredAgents,
  });
});

// ──────────────────────────────────────────
// POST /api/agents/register
// Register a new agent with ERC-8004 on-chain identity
// ──────────────────────────────────────────
agentRouter.post("/api/agents/register", async (req: Request, res: Response) => {
  try {
    const { name, description, gameEndpoint } = req.body;

    if (!name || typeof name !== "string" || name.trim().length === 0) {
      res.status(400).json({ error: "Agent name is required" });
      return;
    }

    if (!isErc8004Configured()) {
      res.status(503).json({
        error: "ERC-8004 Identity Registry not configured",
        hint: "Set ERC8004_IDENTITY_REGISTRY or use Base Sepolia (chain ID 84532) for canonical defaults",
        canonicalAddresses: CANONICAL_ADDRESSES,
      });
      return;
    }

    // Get or create a wallet for this agent via AgentKit
    const wallet = await getOrCreateAgentWallet(name.trim());

    const agentDescription =
      description || `Among Claws AI agent: ${name.trim()}`;

    // Register on the ERC-8004 Identity Registry (mints an ERC-721 NFT)
    const result = await registerAgentIdentity(
      name.trim(),
      agentDescription,
      wallet.address,
      gameEndpoint
    );

    // Track in local registry for GET /api/agents
    registeredAgents.push({
      name: name.trim(),
      address: wallet.address,
      registeredAt: Date.now(),
      txHash: result.txHash,
    });

    log.info(
      `Agent "${name}" registered on ERC-8004. Wallet: ${wallet.address}, TX: ${result.txHash || "pending"}`
    );

    res.status(201).json({
      success: true,
      agent: {
        name: name.trim(),
        walletAddress: wallet.address,
        walletProvider: wallet.provider,
      },
      identity: {
        txHash: result.txHash,
        agentURI: result.agentURI,
        registryAddress:
          config.base.chainId === 84532
            ? CANONICAL_ADDRESSES.testnet.identityRegistry
            : CANONICAL_ADDRESSES.mainnet.identityRegistry,
      },
      chain: {
        id: config.base.chainId,
        name: config.base.chainId === 84532 ? "Base Sepolia" : "Base",
      },
    });
  } catch (err) {
    log.error("Failed to register agent identity", err);
    res.status(500).json({
      error: "Failed to register agent identity",
      details: err instanceof Error ? err.message : String(err),
    });
  }
});

// ──────────────────────────────────────────
// GET /api/agents/:id
// Get agent profile including identity, reputation, and validation data
// ──────────────────────────────────────────
agentRouter.get("/api/agents/:id", async (req: Request, res: Response) => {
  try {
    const agentIdStr = String(req.params.id);
    if (!agentIdStr || !/^\d+$/.test(agentIdStr)) {
      res.status(400).json({ error: "Agent ID must be a numeric token ID" });
      return;
    }

    if (!isErc8004Configured()) {
      res.status(503).json({
        error: "ERC-8004 Identity Registry not configured",
      });
      return;
    }

    const agentId = BigInt(agentIdStr);
    const profile = await getAgentProfile(agentId);

    if (!profile) {
      res.status(404).json({
        error: `Agent #${agentIdStr} not found on the Identity Registry`,
        hint: "This agent ID may not be registered yet. Use POST /api/agents/register to create one.",
      });
      return;
    }

    res.json({
      success: true,
      profile: serializeProfile(profile),
      registries: {
        identity:
          config.base.chainId === 84532
            ? CANONICAL_ADDRESSES.testnet.identityRegistry
            : CANONICAL_ADDRESSES.mainnet.identityRegistry,
        reputation:
          config.base.chainId === 84532
            ? CANONICAL_ADDRESSES.testnet.reputationRegistry
            : CANONICAL_ADDRESSES.mainnet.reputationRegistry,
      },
    });
  } catch (err) {
    log.error("Failed to fetch agent profile", err);
    res.status(500).json({
      error: "Failed to fetch agent profile",
      details: err instanceof Error ? err.message : String(err),
    });
  }
});

// ──────────────────────────────────────────
// POST /api/agents/:id/feedback
// Submit reputation feedback for an agent after a game
// ──────────────────────────────────────────
agentRouter.post(
  "/api/agents/:id/feedback",
  async (req: Request, res: Response) => {
    try {
      const agentIdStr = String(req.params.id);
      if (!agentIdStr || !/^\d+$/.test(agentIdStr)) {
        res.status(400).json({ error: "Agent ID must be a numeric token ID" });
        return;
      }

      const { score, tag1, tag2, feedbackURI } = req.body;

      if (score === undefined || score === null || typeof score !== "number") {
        res.status(400).json({
          error: "score is required and must be a number",
          hint: "Score represents agent performance (e.g., 0-100). Standard tags: tag1 = 'starred' | 'successRate' | 'deception' | 'detection', tag2 = 'among-claws'",
        });
        return;
      }

      if (!isErc8004Configured()) {
        res.status(503).json({
          error: "ERC-8004 Reputation Registry not configured",
        });
        return;
      }

      const agentId = BigInt(agentIdStr);

      // Verify the agent exists on the Identity Registry
      const owner = await getAgentIdentityOwner(agentId);
      if (!owner) {
        res.status(404).json({
          error: `Agent #${agentIdStr} not found on the Identity Registry`,
        });
        return;
      }

      // Submit feedback to the Reputation Registry
      // tag1: category of feedback (e.g., "starred", "successRate")
      // tag2: game identifier (defaults to "among-claws")
      const txHash = await submitAgentFeedback(
        agentId,
        score,
        tag1 || "starred",
        tag2 || "among-claws",
        feedbackURI
      );

      log.info(
        `Feedback submitted for agent #${agentIdStr}: score=${score}, tag1=${tag1 || "starred"}, tx=${txHash || "pending"}`
      );

      res.status(201).json({
        success: true,
        feedback: {
          agentId: agentIdStr,
          score,
          scaledValue: Math.round(score * 100),
          decimals: 2,
          tag1: tag1 || "starred",
          tag2: tag2 || "among-claws",
          txHash,
        },
        reputationRegistry:
          config.base.chainId === 84532
            ? CANONICAL_ADDRESSES.testnet.reputationRegistry
            : CANONICAL_ADDRESSES.mainnet.reputationRegistry,
      });
    } catch (err) {
      log.error("Failed to submit agent feedback", err);
      res.status(500).json({
        error: "Failed to submit agent feedback",
        details: err instanceof Error ? err.message : String(err),
      });
    }
  }
);

// ──────────────────────────────────────────
// GET /api/agents/:id/reputation
// Get reputation summary for an agent
// ──────────────────────────────────────────
agentRouter.get(
  "/api/agents/:id/reputation",
  async (req: Request, res: Response) => {
    try {
      const agentIdStr = String(req.params.id);
      if (!agentIdStr || !/^\d+$/.test(agentIdStr)) {
        res.status(400).json({ error: "Agent ID must be a numeric token ID" });
        return;
      }

      if (!isErc8004Configured()) {
        res.status(503).json({
          error: "ERC-8004 Reputation Registry not configured",
        });
        return;
      }

      const agentId = BigInt(agentIdStr);

      // Optional query params for filtering
      const tag1 = (req.query.tag1 as string) || "";
      const tag2 = (req.query.tag2 as string) || "among-claws";

      // Verify the agent exists
      const owner = await getAgentIdentityOwner(agentId);
      if (!owner) {
        res.status(404).json({
          error: `Agent #${agentIdStr} not found on the Identity Registry`,
        });
        return;
      }

      // Get the URI for context
      const uri = await getAgentIdentityURI(agentId);

      // Fetch all clients who have given feedback
      const clients = await getAgentClients(agentId);

      // Get the aggregated reputation summary
      const summary = await getAgentReputationSummary(
        agentId,
        tag1,
        tag2,
        clients.length > 0 ? clients : undefined
      );

      const humanScore =
        summary && summary.decimals > 0
          ? Number(summary.value) / Math.pow(10, summary.decimals)
          : summary
            ? Number(summary.value)
            : 0;

      res.json({
        success: true,
        agentId: agentIdStr,
        owner,
        uri,
        reputation: {
          feedbackCount: summary ? Number(summary.count) : 0,
          aggregatedValue: summary ? Number(summary.value) : 0,
          decimals: summary ? summary.decimals : 0,
          humanReadableScore: humanScore,
          uniqueClients: clients.length,
          clients,
          filters: { tag1: tag1 || "(all)", tag2 },
        },
        reputationRegistry:
          config.base.chainId === 84532
            ? CANONICAL_ADDRESSES.testnet.reputationRegistry
            : CANONICAL_ADDRESSES.mainnet.reputationRegistry,
      });
    } catch (err) {
      log.error("Failed to fetch agent reputation", err);
      res.status(500).json({
        error: "Failed to fetch agent reputation",
        details: err instanceof Error ? err.message : String(err),
      });
    }
  }
);

// ──────────────────────────────────────────
// GET /api/agents/erc8004/status
// Get ERC-8004 configuration status and registry addresses
// ──────────────────────────────────────────
agentRouter.get("/api/agents/erc8004/status", (_req: Request, res: Response) => {
  const isTestnet = config.base.chainId === 84532;
  const addresses = isTestnet
    ? CANONICAL_ADDRESSES.testnet
    : CANONICAL_ADDRESSES.mainnet;

  res.json({
    configured: isErc8004Configured(),
    chain: {
      id: config.base.chainId,
      name: isTestnet ? "Base Sepolia" : "Base",
      network: isTestnet ? "testnet" : "mainnet",
    },
    registries: {
      identityRegistry: addresses.identityRegistry,
      reputationRegistry: addresses.reputationRegistry,
    },
    canonicalAddresses: CANONICAL_ADDRESSES,
    spec: "EIP-8004 v2.0",
    reference: "https://eips.ethereum.org/EIPS/eip-8004",
  });
});
