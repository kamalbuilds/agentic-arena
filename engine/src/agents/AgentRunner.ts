/**
 * AgentRunner - Spawns and manages multiple autonomous agents
 *
 * Creates a squad of AI agents, each with unique personality,
 * wallet, and LLM-powered brain. They join the same game and
 * play against each other autonomously.
 *
 * Usage:
 *   npx tsx src/agents/AgentRunner.ts [--count 6] [--server http://localhost:3001]
 */

import { AutonomousAgent } from "./AutonomousAgent.js";
import { logger } from "../utils/logger.js";

const runnerLogger = logger.child("AgentRunner");

const AGENT_NAMES = [
  "Claw_Alpha",
  "Claw_Beta",
  "Claw_Gamma",
  "Claw_Delta",
  "Claw_Epsilon",
  "Claw_Zeta",
  "Claw_Eta",
  "Claw_Theta",
];

interface RunnerOptions {
  count: number;
  serverUrl: string;
  anthropicApiKey?: string;
  staggerDelayMs?: number;
}

export async function runAgentSquad(options: RunnerOptions): Promise<void> {
  const {
    count,
    serverUrl,
    anthropicApiKey,
    staggerDelayMs = 1000,
  } = options;

  runnerLogger.info(`Spawning ${count} autonomous agents targeting ${serverUrl}`);

  const agents: AutonomousAgent[] = [];

  for (let i = 0; i < count; i++) {
    const agent = new AutonomousAgent({
      name: AGENT_NAMES[i] || `Claw_Agent_${i}`,
      serverUrl,
      anthropicApiKey,
    });

    agents.push(agent);
    runnerLogger.info(`Created ${agent.name}`);
  }

  // Start all agents with staggered timing so they join one by one
  const promises = agents.map((agent, i) =>
    new Promise<void>((resolve) => {
      setTimeout(async () => {
        try {
          await agent.run();
        } catch (err) {
          runnerLogger.error(`${agent.name} crashed`, err);
        }
        resolve();
      }, i * staggerDelayMs);
    })
  );

  await Promise.all(promises);

  // Print action logs for all agents (for hackathon documentation)
  runnerLogger.info("\n=== AGENT ACTION LOGS ===\n");
  for (const agent of agents) {
    const log = agent.getActionLog();
    runnerLogger.info(`--- ${agent.name} (${agent.wallet.address}) ---`);
    for (const entry of log) {
      const time = new Date(entry.timestamp).toISOString();
      runnerLogger.info(`  [${time}] ${entry.action}: ${entry.detail}`);
    }
    runnerLogger.info("");
  }
}

// CLI entry point
if (process.argv[1]?.includes("AgentRunner")) {
  const count = parseInt(
    getArg("--count") || process.env.AGENT_COUNT || "6",
    10
  );
  const serverUrl =
    getArg("--server") ||
    process.env.GAME_SERVER_URL ||
    "http://localhost:3001";
  const anthropicApiKey =
    getArg("--api-key") || process.env.ANTHROPIC_API_KEY;

  function getArg(flag: string): string | undefined {
    const idx = process.argv.indexOf(flag);
    return idx !== -1 && idx + 1 < process.argv.length
      ? process.argv[idx + 1]
      : undefined;
  }

  runAgentSquad({ count, serverUrl, anthropicApiKey }).catch((err) => {
    console.error("Agent runner failed:", err);
    process.exit(1);
  });
}
