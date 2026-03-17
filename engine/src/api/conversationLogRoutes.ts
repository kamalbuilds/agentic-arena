/**
 * Conversation Log Export API
 *
 * Required for Synthesis hackathon submission.
 * Exports the full human-agent collaboration record including:
 * - Agent action logs (every decision, vote, investigation, trade)
 * - Cross-game memory state (opponent profiles, trust scores)
 * - Service market activity
 * - ERC-8004 reputation updates
 * - System events and configuration
 *
 * GET /api/conversation-log          - Full conversation log export
 * GET /api/conversation-log/summary  - Compact summary for quick review
 * GET /api/conversation-log/agents   - Per-agent detailed logs
 */

import { Router, type Request, type Response } from "express";
import {
  getOrchestrator,
} from "../agents/GameOrchestrator.js";
import { getAllAgentMemories } from "../agents/AgentMemory.js";
import { getMarketStats } from "../agents/AgentServiceMarket.js";
import { config } from "../config.js";
import { logger } from "../utils/logger.js";

const log = logger.child("ConversationLog");
export const conversationLogRouter = Router();

// System event log
const systemEvents: Array<{ timestamp: number; event: string; detail: string }> = [];

/** Record a system event */
export function recordSystemEvent(event: string, detail: string): void {
  systemEvents.push({ timestamp: Date.now(), event, detail });
  // Keep last 500 events
  if (systemEvents.length > 500) {
    systemEvents.splice(0, systemEvents.length - 500);
  }
}

// GET /api/conversation-log - Full export
conversationLogRouter.get("/api/conversation-log", (_req: Request, res: Response) => {
  const orchestrator = getOrchestrator();
  const agentLogs = orchestrator?.getFullLogs() || {};
  const orchestratorStatus = orchestrator?.getStatus() || null;
  const memories = getAllAgentMemories();
  const marketStats = getMarketStats();

  const conversationLog = {
    metadata: {
      project: "Among Claws (Claws Wars)",
      hackathon: "The Synthesis",
      exportedAt: new Date().toISOString(),
      version: "1.0.0",
      chain: "Base Sepolia",
      chainId: config.base.chainId,
      agentHarness: "claude-code",
      agentFramework: "other",
      model: "claude-opus-4-6",
    },

    summary: {
      description:
        "Among Claws is an autonomous AI agent social deduction arena on Base. " +
        "AI agents with unique personalities play games of deception and deduction, " +
        "executing real on-chain transactions (bets, trades, reputation updates). " +
        "Each agent has its own wallet, ERC-8004 identity, cross-game memory, and " +
        "trading strategy powered by Uniswap.",
      themes: ["Agents that Pay", "Agents that Trust", "Agents that Cooperate", "Agents that Keep Secrets"],
      integrations: [
        "ERC-8004 (agent identity + reputation)",
        "Uniswap Trading API (autonomous swaps)",
        "Locus USDC payments (agent wallets)",
        "x402 payment protocol (agent services)",
        "Coinbase AgentKit (wallet infrastructure)",
      ],
    },

    orchestrator: orchestratorStatus
      ? {
          running: orchestratorStatus.running,
          gamesPlayed: orchestratorStatus.gamesPlayed,
          gamesPlanned: orchestratorStatus.gamesPlanned,
          uptimeSeconds: orchestratorStatus.uptimeSeconds,
          agentCount: orchestratorStatus.agents.length,
        }
      : null,

    agents: Object.entries(agentLogs).map(([name, logs]) => ({
      name,
      actionCount: logs.length,
      actions: logs.map((entry) => ({
        time: new Date(entry.timestamp).toISOString(),
        action: entry.action,
        detail: entry.detail,
        ...(entry.txHash ? { txHash: entry.txHash } : {}),
      })),
    })),

    memory: memories,

    serviceMarket: marketStats,

    systemEvents: systemEvents.map((e) => ({
      time: new Date(e.timestamp).toISOString(),
      event: e.event,
      detail: e.detail,
    })),

    contracts: {
      game: config.contracts.game || null,
      betting: config.contracts.betting || null,
      leaderboard: config.contracts.leaderboard || null,
      tournament: config.contracts.tournament || null,
      season: config.contracts.season || null,
      agentNFT: config.contracts.agentNFT || null,
      arenaRegistry: config.contracts.arenaRegistry || null,
    },
  };

  res.json(conversationLog);
});

// GET /api/conversation-log/summary - Compact summary
conversationLogRouter.get("/api/conversation-log/summary", (_req: Request, res: Response) => {
  const orchestrator = getOrchestrator();
  const status = orchestrator?.getStatus();
  const memories = getAllAgentMemories();
  const marketStats = getMarketStats();

  const totalActions = status?.agents.reduce((s, a) => s + a.actionCount, 0) || 0;

  res.json({
    project: "Among Claws",
    exportedAt: new Date().toISOString(),
    gamesPlayed: status?.gamesPlayed || 0,
    activeAgents: status?.agents.length || 0,
    totalActions,
    agentMemories: Object.keys(memories).length,
    servicesRegistered: marketStats.totalServices,
    servicesFulfilled: marketStats.totalFulfilled,
    systemEvents: systemEvents.length,
    gameResults: status?.gameResults || [],
  });
});

// GET /api/conversation-log/agents - Per-agent detailed logs
conversationLogRouter.get("/api/conversation-log/agents", (_req: Request, res: Response) => {
  const orchestrator = getOrchestrator();
  const agentLogs = orchestrator?.getFullLogs() || {};
  const memories = getAllAgentMemories();

  const agents = Object.entries(agentLogs).map(([name, logs]) => {
    const memory = memories[name] as any;
    return {
      name,
      stats: memory?.stats || null,
      recentActions: logs.slice(-20).map((entry) => ({
        time: new Date(entry.timestamp).toISOString(),
        action: entry.action,
        detail: entry.detail,
      })),
      opponentProfiles: memory?.opponents
        ? Object.keys(memory.opponents).length
        : 0,
      insights: memory?.insights || [],
    };
  });

  res.json({ agents });
});
