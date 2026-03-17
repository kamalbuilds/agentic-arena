/**
 * DemoSimulation - Compressed game simulation for video demos
 *
 * Runs a fast-forward autonomous game showing the full agent lifecycle:
 * 1. Agent initialization (wallets + ERC-8004 identity)
 * 2. Service registration in marketplace
 * 3. Game creation and joining
 * 4. Discussion, investigation, voting (compressed phases)
 * 5. Post-game trading via Uniswap
 * 6. Memory recording and reputation feedback
 * 7. Service market interactions between agents
 *
 * Designed for the 3-minute demo video. Each phase emits events
 * that the frontend can render in real-time via WebSocket.
 */

import { AutonomousAgent } from "./AutonomousAgent.js";
import { getAgentMemory } from "./AgentMemory.js";
import { autoRegisterServices, listServices, getMarketStats } from "./AgentServiceMarket.js";
import { recordSystemEvent } from "../api/conversationLogRoutes.js";
import { logger } from "../utils/logger.js";

const demoLog = logger.child("DemoSimulation");

export interface DemoEvent {
  timestamp: number;
  phase: string;
  event: string;
  detail: string;
  agentName?: string;
  txHash?: string;
}

export interface DemoState {
  running: boolean;
  phase: string;
  events: DemoEvent[];
  agents: Array<{
    name: string;
    address: string;
    personality: string;
    role: string | null;
    alive: boolean;
    actions: number;
    memory: { totalGames: number; winRate: number };
    services: number;
  }>;
  gameId: string | null;
  winner: string | null;
  startTime: number;
  elapsed: number;
}

const DEMO_AGENTS = [
  { name: "Karkinos", personality: "calculated and methodical, demands evidence" },
  { name: "Callinectes", personality: "bold and confrontational, challenges suspects" },
  { name: "Portunus", personality: "quiet and observant, reveals findings at key moments" },
  { name: "Scylla", personality: "diplomatic and consensus-building, forges alliances" },
];

let demoState: DemoState | null = null;
let demoRunning = false;

function emit(phase: string, event: string, detail: string, agentName?: string, txHash?: string): void {
  if (!demoState) return;
  const entry: DemoEvent = {
    timestamp: Date.now(),
    phase,
    event,
    detail,
    agentName,
    txHash,
  };
  demoState.events.push(entry);
  demoState.phase = phase;
  demoLog.info(`[${phase}] ${event}: ${detail}`);
  recordSystemEvent(`demo_${event}`, detail);
}

/** Start a demo simulation */
export async function startDemo(serverUrl: string): Promise<DemoState> {
  if (demoRunning) {
    return demoState!;
  }

  demoRunning = true;
  demoState = {
    running: true,
    phase: "initializing",
    events: [],
    agents: [],
    gameId: null,
    winner: null,
    startTime: Date.now(),
    elapsed: 0,
  };

  emit("init", "demo_start", "Demo simulation starting with 4 agents");

  // Phase 1: Initialize agents
  const agents: AutonomousAgent[] = [];
  for (const cfg of DEMO_AGENTS) {
    const agent = new AutonomousAgent({
      name: cfg.name,
      serverUrl,
      personality: cfg.personality,
    });

    try {
      await agent.initialize();
      emit("init", "agent_ready", `${cfg.name} initialized at ${agent.wallet.address}`, cfg.name);

      // Register services
      const services = autoRegisterServices(cfg.name, agent.wallet.address);
      emit("services", "services_registered", `${cfg.name} registered ${services.length} services in marketplace`, cfg.name);

      agents.push(agent);
      demoState.agents.push({
        name: cfg.name,
        address: agent.wallet.address,
        personality: cfg.personality,
        role: null,
        alive: true,
        actions: 0,
        memory: { totalGames: getAgentMemory(cfg.name).getStats().totalGames, winRate: 0 },
        services: services.length,
      });
    } catch (err) {
      emit("init", "agent_error", `${cfg.name} failed to initialize: ${err}`, cfg.name);
    }
  }

  emit("init", "all_agents_ready", `${agents.length} agents initialized with wallets, ERC-8004 identity, and marketplace services`);

  // Phase 2: Show market stats
  const marketStats = getMarketStats();
  emit("market", "market_stats", `Service market: ${marketStats.totalServices} services from ${marketStats.topProviders.length} providers`);

  // Phase 3: Create game
  emit("game", "creating_game", "Creating autonomous social deduction game...");

  try {
    const createRes = await fetch(`${serverUrl}/api/games`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        minPlayers: agents.length,
        maxPlayers: agents.length,
        impostorCount: 1,
        maxRounds: 3,
      }),
    });

    if (createRes.ok) {
      const createData = await createRes.json() as { gameId: string };
      demoState.gameId = createData.gameId;
      emit("game", "game_created", `Game ${createData.gameId} created`, undefined);

      // Phase 4: Agents join
      for (const agent of agents) {
        try {
          const joinPath = `/api/games/${createData.gameId}/join`;
          const body = { address: agent.wallet.address, name: agent.name };
          const res = await fetch(`${serverUrl}${joinPath}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
          });

          if (res.ok) {
            emit("game", "agent_joined", `${agent.name} joined the game`, agent.name);
          }
        } catch {
          emit("game", "join_error", `${agent.name} failed to join`, agent.name);
        }
      }

      // Phase 5: Start game
      emit("game", "starting_game", "All agents joined. Starting game...");
      const startRes = await fetch(`${serverUrl}/api/games/${createData.gameId}/start`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      if (startRes.ok) {
        emit("gameplay", "game_started", "Game is live! Agents playing autonomously.");

        // Phase 6: Let agents play
        const agentPromises = agents.map((agent) =>
          agent.runInGame(createData.gameId).catch((err) => {
            demoLog.error(`${agent.name} error`, err);
          })
        );

        // Wait for game to finish (max 3 min for demo)
        await Promise.race([
          Promise.all(agentPromises),
          new Promise((r) => setTimeout(r, 180_000)),
        ]);

        // Phase 7: Capture results
        const finalRes = await fetch(`${serverUrl}/api/games/${createData.gameId}`);
        if (finalRes.ok) {
          const finalData = await finalRes.json() as { result: number; roundNumber: number };
          demoState.winner = finalData.result === 1 ? "Crewmates" : finalData.result === 2 ? "Impostor" : "Unknown";
          emit("results", "game_over", `Game complete: ${demoState.winner} win in ${finalData.roundNumber} rounds`);
        }

        // Phase 8: Show memory updates
        for (const agent of agents) {
          const stats = agent.memory.getStats();
          const agentState = demoState.agents.find((a) => a.name === agent.name);
          if (agentState) {
            agentState.actions = agent.actionLog.length;
            agentState.memory = { totalGames: stats.totalGames, winRate: stats.winRate };
          }
          emit("memory", "memory_updated", `${agent.name}: ${stats.totalGames} games, ${Math.round(stats.winRate * 100)}% win rate`, agent.name);
        }

        // Phase 9: Show service market activity
        const finalMarket = getMarketStats();
        emit("summary", "market_final", `Market activity: ${finalMarket.totalServices} services, ${finalMarket.totalFulfilled} fulfilled`);
      }
    }
  } catch (err) {
    emit("error", "game_error", `Game creation failed: ${err}`);
  }

  // Final summary
  demoState.elapsed = Math.round((Date.now() - demoState.startTime) / 1000);
  emit("complete", "demo_complete", `Demo finished in ${demoState.elapsed}s. ${agents.length} agents, ${demoState.events.length} events.`);

  demoState.running = false;
  demoRunning = false;

  return demoState;
}

/** Get current demo state */
export function getDemoState(): DemoState | null {
  if (demoState) {
    demoState.elapsed = Math.round((Date.now() - demoState.startTime) / 1000);
  }
  return demoState;
}

/** Stop demo */
export function stopDemo(): void {
  demoRunning = false;
  if (demoState) {
    demoState.running = false;
    emit("stop", "demo_stopped", "Demo simulation stopped by user");
  }
}
