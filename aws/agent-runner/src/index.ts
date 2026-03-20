import { loadConfig, loadAgentIdentities } from "./agent-config.js";
import { Agent } from "./agent.js";

// ────────────────────────────────────────────────────────────────
// Claw Wars Agent Runner - Entry Point
//
// Launches a fleet of autonomous AI agents that join and play
// Claw Wars games via the game engine REST API.
// ────────────────────────────────────────────────────────────────

function ts(): string {
  return new Date().toISOString();
}

function log(msg: string): void {
  console.log(`[${ts()}] [Runner] ${msg}`);
}

async function main(): Promise<void> {
  log("================================================================");
  log("  Claw Wars Agent Runner");
  log("  Autonomous AI agents for social deduction games on Base");
  log("================================================================");

  // Load configuration
  const config = loadConfig();
  log(`Game server URL: ${config.gameServerUrl}`);
  log(`Agent count: ${config.agentCount}`);
  log(`Poll interval: ${config.pollIntervalMs}ms`);
  log(`Auto-create games: ${config.autoCreateGame}`);

  // Wait for the game server to be available
  log("Waiting for game server to be reachable...");
  await waitForServer(config.gameServerUrl);

  // Load agent identities (private keys + personality assignments)
  let identities;
  try {
    identities = loadAgentIdentities(config);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    log(`FATAL: Failed to load agent identities: ${msg}`);
    process.exit(1);
  }

  log(`Loaded ${identities.length} agent identities:`);
  for (const id of identities) {
    log(`  Agent #${id.index}: ${id.name} (${id.personality.name})`);
  }

  // Create and start agents
  const agents: Agent[] = [];
  for (const identity of identities) {
    const agent = new Agent(identity, config);
    agents.push(agent);
  }

  log(`Starting ${agents.length} agents...`);

  // Stagger agent starts to avoid thundering herd
  const startPromises: Promise<void>[] = [];
  for (let i = 0; i < agents.length; i++) {
    const delay = i * config.autoJoinDelay;
    const agent = agents[i];
    startPromises.push(
      (async () => {
        await sleep(delay);
        log(`Launching agent #${i} (${agent.identity.name})...`);
        await agent.start();
      })()
    );
  }

  // Handle graceful shutdown
  const shutdown = () => {
    log("Shutdown signal received. Stopping all agents...");
    for (const agent of agents) {
      agent.stop();
    }
    // Give agents time to finish current operations
    setTimeout(() => {
      log("All agents stopped. Exiting.");
      process.exit(0);
    }, 5000);
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);

  // Wait for all agents (they run indefinitely until stopped)
  await Promise.allSettled(startPromises);
}

async function waitForServer(
  url: string,
  maxRetries: number = 30,
  retryInterval: number = 5000
): Promise<void> {
  for (let i = 0; i < maxRetries; i++) {
    try {
      const resp = await fetch(`${url}/api/health`);
      if (resp.ok) {
        log("Game server is reachable.");
        return;
      }
    } catch {
      // Server not ready yet
    }

    if (i < maxRetries - 1) {
      log(
        `Game server not ready (attempt ${i + 1}/${maxRetries}). Retrying in ${retryInterval / 1000}s...`
      );
      await sleep(retryInterval);
    }
  }

  log(
    "WARNING: Could not reach game server. Proceeding anyway (agents will retry on their own)..."
  );
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Run
main().catch((err) => {
  console.error(`[${ts()}] [Runner] FATAL: ${err}`);
  process.exit(1);
});
