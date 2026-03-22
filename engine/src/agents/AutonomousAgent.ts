/**
 * AutonomousAgent - A fully autonomous AI agent for Among Claws
 *
 * Combines:
 * - AgentWallet: individual on-chain identity + transaction signing
 * - AgentBrain: LLM-powered strategic decisions
 * - Game loop: polls game server, acts autonomously each phase
 *
 * This is the core deliverable for the Synthesis hackathon:
 * agents that think, act, and transact on their own.
 */

import { getOrCreateAgentWallet, type AgentWallet } from "../chain/agentkit-wallet.js";
import { AgentBrain, type DiscussionDecision } from "./AgentBrain.js";
import { TradingStrategy } from "./TradingStrategy.js";
import { registerAgentIdentity, isErc8004Configured } from "../chain/erc8004.js";
import { getAgentMemory, type AgentMemory } from "./AgentMemory.js";
import { autoRegisterServices } from "./AgentServiceMarket.js";
import { privateKeyToAccount } from "viem/accounts";
import { config } from "../config.js";
import { logger } from "../utils/logger.js";

const agentLogger = logger.child("AutonomousAgent");

interface AgentConfig {
  name: string;
  privateKey?: `0x${string}`;
  serverUrl: string;
  personality?: string;
  anthropicApiKey?: string;
  pollIntervalMs?: number;
}

interface GameState {
  gameId: string;
  phase: number;
  phaseName: string;
  roundNumber: number;
  maxRounds: number;
  players: Array<{
    address: string;
    name: string;
    alive: boolean;
    role?: string;
  }>;
  messages: Array<{
    id: string;
    sender: string;
    senderName: string;
    content: string;
    timestamp: number;
    round: number;
  }>;
  remainingTime: number;
  result: number; // 0=ongoing, 1=crewmates, 2=impostor
  eliminations: Array<{
    address: string;
    name: string;
    role: string;
    round: number;
  }>;
  voteHistory: Array<{
    round: number;
    votes: Record<string, string>;
    eliminated: string | null;
  }>;
}

export interface AgentActionLog {
  timestamp: number;
  action: string;
  detail: string;
  txHash?: string;
}

const PERSONALITIES = [
  "calculated and methodical, always asking for evidence",
  "bold and confrontational, directly accusing suspects",
  "quiet and observant, revealing findings at key moments",
  "diplomatic and consensus-building, seeking group agreement",
  "paranoid and suspicious, trusting no one easily",
  "charismatic and persuasive, swaying votes through rhetoric",
  "data-driven analyst, tracking voting patterns and contradictions",
  "social engineer, building alliances and testing loyalty",
];

export class AutonomousAgent {
  public readonly name: string;
  public wallet!: AgentWallet;
  public readonly brain: AgentBrain;
  public readonly trader: TradingStrategy;
  public readonly actionLog: AgentActionLog[] = [];
  public erc8004AgentId: bigint | null = null;
  public readonly memory!: AgentMemory;

  private serverUrl: string;
  private pollInterval: number;
  private gameId: string | null = null;
  private role: string | null = null;
  private currentRound = 0;
  private hasActedThisPhase = false;
  private hasVotedThisRound = false;
  private hasInvestigatedThisRound = false;
  private lastPhase: string | null = null;
  private running = false;
  private personality: string;
  private anthropicApiKey?: string;
  private investigations: Array<{
    target: string;
    result: "suspicious" | "clear";
  }> = [];

  constructor(cfg: AgentConfig) {
    this.name = cfg.name;
    this.serverUrl = cfg.serverUrl;
    this.pollInterval = cfg.pollIntervalMs || 3000;
    this.anthropicApiKey = cfg.anthropicApiKey;

    // Assign random personality if not provided
    this.personality =
      cfg.personality ||
      PERSONALITIES[Math.floor(Math.random() * PERSONALITIES.length)];

    this.memory = getAgentMemory(this.name);

    this.brain = new AgentBrain({
      apiKey: cfg.anthropicApiKey,
      personality: this.personality,
      provider: config.ai.provider,
    });

    this.trader = new TradingStrategy({
      apiKey: cfg.anthropicApiKey,
    });
  }

  /** Initialize wallet and ERC-8004 identity (async, must be called before run) */
  async initialize(): Promise<void> {
    // Use the existing agentkit-wallet system for deterministic wallets
    this.wallet = await getOrCreateAgentWallet(this.name);
    this.log("init", `Agent ${this.name} at ${this.wallet.address} (${this.personality})`);

    // Register ERC-8004 identity if configured
    if (isErc8004Configured()) {
      try {
        const { txHash, agentURI } = await registerAgentIdentity(
          this.name,
          `Autonomous AI agent for Among Claws social deduction game`,
          this.wallet.address,
          this.serverUrl
        );
        if (txHash) {
          this.log("erc8004", `Registered on-chain identity: ${txHash}`);
        }
      } catch (err) {
        this.log("erc8004", `Registration failed (non-blocking): ${err}`);
      }
    }

    // Register agent services in the marketplace
    const services = autoRegisterServices(
      this.name,
      this.wallet.address,
      this.erc8004AgentId?.toString()
    );
    this.log("services", `Registered ${services.length} services in marketplace`);

    // Log memory stats
    const stats = this.memory.getStats();
    if (stats.totalGames > 0) {
      this.log(
        "memory",
        `Loaded cross-game memory: ${stats.totalGames} games, ${Math.round(stats.winRate * 100)}% win rate`
      );
    }
  }

  /** Start the autonomous game loop */
  async run(): Promise<void> {
    this.running = true;
    agentLogger.info(`${this.name} starting autonomous loop`);

    try {
      // Step 0: Initialize wallet and identity
      await this.initialize();

      // Step 1: Find and join a game
      await this.findAndJoinGame();
      if (!this.gameId) {
        agentLogger.error(`${this.name} failed to join any game`);
        return;
      }

      // Step 2: Wait for game start
      const started = await this.waitForStart();
      if (!started) {
        agentLogger.error(`${this.name} timed out waiting for game start`);
        return;
      }

      // Step 3: Main game loop
      await this.gameLoop();

      agentLogger.info(`${this.name} finished game`);
    } catch (err) {
      agentLogger.error(`${this.name} error in run loop`, err);
    } finally {
      this.running = false;
    }
  }

  /** Start the game loop for a game the agent has already joined */
  async runInGame(gameId: string): Promise<void> {
    this.running = true;
    this.gameId = gameId;
    agentLogger.info(`${this.name} starting game loop for ${gameId}`);

    try {
      // Wait for the game to start (roles assigned)
      const started = await this.waitForStart();
      if (!started) {
        agentLogger.error(`${this.name} timed out waiting for game start`);
        return;
      }
      await this.gameLoop();
      agentLogger.info(`${this.name} finished game`);
    } catch (err) {
      agentLogger.error(`${this.name} error in game loop`, err);
    } finally {
      this.running = false;
    }
  }

  /** Stop the agent */
  stop(): void {
    this.running = false;
    this.log("stop", "Agent stopped");
  }

  /** Get the full action log for conversation/process documentation */
  getActionLog(): AgentActionLog[] {
    return [...this.actionLog];
  }

  private async findAndJoinGame(): Promise<void> {
    this.log("search", "Looking for a game to join...");

    const res = await this.api<{
      games: Array<{
        gameId: string;
        phase: string;
        playerCount: number;
        maxPlayers: number;
      }>;
    }>("GET", "/api/games");

    if (!res.ok || !res.data.games) {
      this.log("search", "No games found");
      return;
    }

    // Find a joinable lobby
    const joinable = res.data.games.find(
      (g) =>
        (g.phase === "lobby" || g.phase === "Lobby") &&
        g.playerCount < g.maxPlayers
    );

    if (!joinable) {
      this.log("search", "No joinable games available");
      return;
    }

    this.gameId = joinable.gameId;
    this.log("join", `Joining game ${this.gameId}`);

    const joinRes = await this.api("POST", `/api/games/${this.gameId}/join`, {
      address: this.wallet.address,
      name: this.name,
    });

    if (joinRes.ok) {
      this.log("join", `Joined game ${this.gameId} successfully`);
    } else {
      this.log("join", `Failed to join: ${JSON.stringify(joinRes.data)}`);
      this.gameId = null;
    }
  }

  private async waitForStart(): Promise<boolean> {
    const timeout = Date.now() + 300_000; // 5 min

    while (this.running && Date.now() < timeout) {
      const state = await this.getGameState();
      if (!state) {
        await this.sleep(this.pollInterval);
        continue;
      }

      if (state.phaseName !== "Lobby") {
        this.role = this.findMyRole(state);
        this.currentRound = state.roundNumber;
        this.log(
          "start",
          `Game started! Role: ${this.role || "unknown"}, Round: ${this.currentRound}`
        );
        return true;
      }

      await this.sleep(this.pollInterval);
    }

    return false;
  }

  private async gameLoop(): Promise<void> {
    while (this.running) {
      const state = await this.getGameState();
      if (!state) {
        await this.sleep(this.pollInterval);
        continue;
      }

      // Update role if we get it
      if (!this.role) {
        this.role = this.findMyRole(state);
        if (this.role) {
          this.log("role", `Discovered role: ${this.role}`);
        }
      }

      // Detect phase change
      if (state.phaseName !== this.lastPhase) {
        this.log(
          "phase",
          `Phase: ${this.lastPhase} -> ${state.phaseName} (Round ${state.roundNumber})`
        );

        if (state.phaseName === "Discussion" && state.roundNumber !== this.currentRound) {
          this.currentRound = state.roundNumber;
          this.hasVotedThisRound = false;
          this.hasInvestigatedThisRound = false;
          this.hasActedThisPhase = false;
        }
        this.lastPhase = state.phaseName;
        this.hasActedThisPhase = false;
      }

      // Game over
      if (state.result !== 0 || state.phaseName === "End") {
        const resultText =
          state.result === 1 ? "Crewmates Win" : "Impostor Wins";
        this.log("end", `Game over: ${resultText}`);

        // Record game in cross-game memory
        const myRole = this.role || "unknown";
        const won =
          (state.result === 1 && myRole === "Crewmate") ||
          (state.result === 2 && myRole === "Impostor");

        this.memory.recordGameResult({
          gameId: this.gameId!,
          myRole: myRole as "Impostor" | "Crewmate" | "unknown",
          won,
          rounds: state.roundNumber,
          players: state.players.map((p) => ({
            name: p.name,
            address: p.address,
            role: p.role || "unknown",
            alive: p.alive,
          })),
          messages: state.messages.map((m) => ({
            sender: m.senderName,
            content: m.content,
            round: m.round,
          })),
          investigations: this.investigations,
          voteHistory: state.voteHistory || [],
        });

        this.log(
          "memory",
          `Game recorded in memory. Stats: ${JSON.stringify(this.memory.getStats())}`
        );

        // Post-game autonomous trading
        try {
          const tradeResult = await this.trader.postGameTrade({
            agentName: this.name,
            walletAddress: this.wallet.address,
            gameResult: won ? "won" : "lost",
            personality: this.personality,
          });
          if (tradeResult) {
            this.log(
              "trade",
              `Post-game trade: ${tradeResult.decision.action} (${tradeResult.decision.reasoning})`
            );
            if (tradeResult.result) {
              this.log(
                "trade-exec",
                `Swap executed: ${tradeResult.result.txHash}`
              );
            }
          }
        } catch (err) {
          this.log("trade", `Post-game trading skipped: ${err}`);
        }
        break;
      }

      // Act based on phase
      switch (state.phaseName) {
        case "Discussion":
          await this.handleDiscussion(state);
          break;
        case "Voting":
          await this.handleVoting(state);
          break;
        case "Resolution":
          // Just wait
          break;
      }

      await this.sleep(this.pollInterval);
    }
  }

  private async handleDiscussion(state: GameState): Promise<void> {
    const myPlayer = this.findMyPlayer(state);
    if (!myPlayer?.alive) return;

    // Investigate once per round
    if (!this.hasInvestigatedThisRound) {
      await this.investigate(state);
    }

    // Discuss once per round (wait for ~20% of phase to pass so others can talk first)
    const waitThreshold = Math.min(state.remainingTime + 10, 140);
    if (!this.hasActedThisPhase && state.remainingTime < waitThreshold) {
      await this.discuss(state);
    }
  }

  private async investigate(state: GameState): Promise<void> {
    const context = this.buildGameContext(state);
    const decision = await this.brain.decideInvestigation(context);

    const res = await this.api(
      "POST",
      `/api/games/${this.gameId}/investigate`,
      {
        address: this.wallet.address,
        target: decision.target,
      }
    );

    if (res.ok && (res.data as any).result) {
      const result = (res.data as any).result as "suspicious" | "clear";
      const targetName =
        state.players.find(
          (p) => p.address.toLowerCase() === decision.target.toLowerCase()
        )?.name || decision.target;

      this.investigations.push({ target: targetName, result });
      this.hasInvestigatedThisRound = true;
      this.log(
        "investigate",
        `Investigated ${targetName}: ${result} (${decision.reasoning})`
      );
    }
  }

  private async discuss(state: GameState): Promise<void> {
    const context = this.buildGameContext(state);
    const decision = await this.brain.decideDiscussion(context);

    const res = await this.api(
      "POST",
      `/api/games/${this.gameId}/discuss`,
      {
        address: this.wallet.address,
        message: decision.message,
      }
    );

    if (res.ok) {
      this.hasActedThisPhase = true;
      this.log(
        "discuss",
        `Said: "${decision.message}" (${decision.reasoning})`
      );
    }
  }

  private async handleVoting(state: GameState): Promise<void> {
    const myPlayer = this.findMyPlayer(state);
    if (!myPlayer?.alive || this.hasVotedThisRound) return;

    const context = this.buildGameContext(state);
    const decision = await this.brain.decideVote(context);

    const targetName =
      state.players.find(
        (p) => p.address.toLowerCase() === decision.target.toLowerCase()
      )?.name || decision.target;

    const res = await this.api("POST", `/api/games/${this.gameId}/vote`, {
      address: this.wallet.address,
      target: decision.target,
    });

    if (res.ok) {
      this.hasVotedThisRound = true;
      this.log(
        "vote",
        `Voted to eliminate ${targetName} (${decision.reasoning})`
      );
    }
  }

  private buildGameContext(state: GameState) {
    const alivePlayers = state.players
      .filter((p) => p.alive)
      .map((p) => ({ name: p.name, address: p.address }));

    // Inject cross-game memory into context
    const opponentBriefing = this.memory.getOpponentBriefing(alivePlayers);
    const strategyBriefing = this.memory.getStrategyBriefing();

    return {
      agentName: this.name,
      agentRole: (this.role || "unknown") as "Impostor" | "Crewmate" | "unknown",
      roundNumber: state.roundNumber,
      alivePlayers,
      messages: state.messages.map((m) => ({
        sender: m.senderName,
        content: m.content,
        round: m.round,
      })),
      investigations: this.investigations,
      eliminations: state.eliminations,
      voteHistory: state.voteHistory || [],
      // Cross-game intelligence
      opponentBriefing,
      strategyBriefing,
    };
  }

  private findMyPlayer(state: GameState) {
    return state.players.find(
      (p) => p.address.toLowerCase() === this.wallet.address.toLowerCase()
    );
  }

  private findMyRole(state: GameState): string | null {
    const me = this.findMyPlayer(state);
    return me?.role || null;
  }

  private async getGameState(): Promise<GameState | null> {
    if (!this.gameId) return null;
    const res = await this.api<GameState>(
      "GET",
      `/api/games/${this.gameId}?agent=${this.wallet.address}`
    );
    return res.ok ? res.data : null;
  }

  /** Sign a request body for auth middleware */
  private async signRequest(
    method: string,
    path: string,
    body: Record<string, unknown>
  ): Promise<string> {
    const filtered = { ...body };
    delete filtered.signature;
    const payload = JSON.stringify(filtered, Object.keys(filtered).sort());
    const message = `ClawWars:${method}:${path}:${payload}`;
    const account = privateKeyToAccount(this.wallet.privateKey);
    return account.signMessage({ message });
  }

  private async api<T = unknown>(
    method: "GET" | "POST",
    path: string,
    body?: Record<string, unknown>
  ): Promise<{ ok: boolean; data: T }> {
    const url = `${this.serverUrl}${path}`;
    const opts: RequestInit = {
      method,
      headers: { "Content-Type": "application/json" },
    };

    if (body && method === "POST") {
      // Sign the request for auth middleware
      const signature = await this.signRequest(method, path, body);
      opts.body = JSON.stringify({ ...body, signature });
    } else if (body) {
      opts.body = JSON.stringify(body);
    }

    try {
      const res = await fetch(url, opts);
      const contentType = res.headers.get("content-type") || "";
      let data: T;
      if (contentType.includes("application/json")) {
        data = (await res.json()) as T;
      } else {
        data = (await res.text()) as unknown as T;
      }
      return { ok: res.ok, data };
    } catch (err) {
      return { ok: false, data: { error: String(err) } as unknown as T };
    }
  }

  private log(action: string, detail: string): void {
    const entry: AgentActionLog = {
      timestamp: Date.now(),
      action,
      detail,
    };
    this.actionLog.push(entry);
    agentLogger.info(`[${this.name}] [${action}] ${detail}`);
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
