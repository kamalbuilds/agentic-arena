import {
  privateKeyToAccount,
  type PrivateKeyAccount,
} from "viem/accounts";
import { type AgentConfig, type AgentIdentity } from "./agent-config.js";
import {
  type Personality,
  getRandomPhrase,
} from "./personalities.js";

// ────────────────────────────────────────────────────────────────
// Types matching the game engine API responses
// ────────────────────────────────────────────────────────────────

interface PlayerState {
  address: string;
  name: string;
  alive: boolean;
  role?: string; // only visible if dead, self, or game ended
}

interface GameMessage {
  id: string;
  sender: string;
  senderName: string;
  content: string;
  timestamp: number;
  round: number;
}

interface Elimination {
  address: string;
  name: string;
  role: string;
  round: number;
}

interface GameState {
  gameId: string;
  chainGameId: string | null;
  phase: number; // 0=Lobby, 1=Discussion, 2=Voting, 3=Resolution, 4=End
  phaseName: string;
  roundNumber: number;
  maxRounds: number;
  players: PlayerState[];
  messages: GameMessage[];
  remainingTime: number;
  result: number; // 0=Ongoing, 1=CrewmatesWin, 2=ImpostorWins
  eliminations: Elimination[];
  spectatorCount: number;
}

interface GameListItem {
  gameId: string;
  chainGameId: string | null;
  phase: number;
  playerCount: number;
  aliveCount: number;
  roundNumber: number;
  spectatorCount: number;
}

interface InvestigationMemory {
  target: string;
  targetName: string;
  result: "suspicious" | "clear";
  round: number;
}

// ────────────────────────────────────────────────────────────────
// Logging
// ────────────────────────────────────────────────────────────────

function ts(): string {
  return new Date().toISOString();
}

// ────────────────────────────────────────────────────────────────
// Agent class
// ────────────────────────────────────────────────────────────────

export class Agent {
  public readonly identity: AgentIdentity;
  public readonly config: AgentConfig;
  public readonly account: PrivateKeyAccount;
  public readonly address: `0x${string}`;
  public readonly personality: Personality;

  // Per-game state
  private currentGameId: string | null = null;
  private myRole: string | null = null;
  private lastKnownPhase: string | null = null;
  private lastRound: number = 0;
  private investigations: InvestigationMemory[] = [];
  private hasInvestigatedThisRound: boolean = false;
  private hasVotedThisRound: boolean = false;
  private messagesSentThisRound: number = 0;
  private running: boolean = false;
  private seenMessageIds: Set<string> = new Set();
  private suspicionScores: Map<string, number> = new Map();

  constructor(identity: AgentIdentity, config: AgentConfig) {
    this.identity = identity;
    this.config = config;
    this.personality = identity.personality;
    this.account = privateKeyToAccount(identity.privateKey);
    this.address = this.account.address;

    this.log(`Initialized with personality "${this.personality.name}" | Address: ${this.address}`);
  }

  // ──────────────────────────────────────────────────────────────
  // Main lifecycle
  // ──────────────────────────────────────────────────────────────

  async start(): Promise<void> {
    this.running = true;
    this.log("Agent started. Entering main loop...");

    while (this.running) {
      try {
        if (this.currentGameId) {
          await this.playGame();
        } else {
          await this.findOrCreateGame();
        }
      } catch (err) {
        this.logError("Main loop error", err);
      }

      await this.sleep(this.config.pollIntervalMs);
    }
  }

  stop(): void {
    this.running = false;
    this.log("Agent stopped.");
  }

  // ──────────────────────────────────────────────────────────────
  // Game discovery and joining
  // ──────────────────────────────────────────────────────────────

  private async findOrCreateGame(): Promise<void> {
    // List active games
    const games = await this.listGames();
    if (!games) return;

    // Find a game in Lobby phase that we can join
    const lobbyGames = games.filter(
      (g) => g.phase === 0 && g.playerCount < 8
    );

    if (lobbyGames.length > 0) {
      // Pick the game with the most players (likely to start sooner)
      const bestGame = lobbyGames.sort(
        (a, b) => b.playerCount - a.playerCount
      )[0];

      // Stagger join to be more natural
      await this.sleep(
        this.config.autoJoinDelay + Math.random() * 2000
      );

      const joined = await this.joinGame(bestGame.gameId);
      if (joined) {
        this.currentGameId = bestGame.gameId;
        this.resetGameState();
      }
      return;
    }

    // No lobby games available -- create one if enabled
    if (this.config.autoCreateGame && this.identity.index === 0) {
      // Only agent #0 creates games to avoid duplicates
      this.log("No lobby games found. Creating a new game...");
      const newGameId = await this.createGame();
      if (newGameId) {
        const joined = await this.joinGame(newGameId);
        if (joined) {
          this.currentGameId = newGameId;
          this.resetGameState();
        }
      }
    }
  }

  // ──────────────────────────────────────────────────────────────
  // Game play loop
  // ──────────────────────────────────────────────────────────────

  private async playGame(): Promise<void> {
    if (!this.currentGameId) return;

    const state = await this.getGameState(this.currentGameId);
    if (!state) {
      this.log("Could not fetch game state. Leaving game.");
      this.leaveCurrentGame();
      return;
    }

    // Detect role from game state (the API returns our role when we query with our address)
    this.detectRole(state);

    // Detect phase changes
    const currentPhaseName = state.phaseName;
    if (currentPhaseName !== this.lastKnownPhase) {
      this.log(
        `Phase changed: ${this.lastKnownPhase || "?"} -> ${currentPhaseName} (round ${state.roundNumber})`
      );

      // Reset round-specific state on new round
      if (state.roundNumber !== this.lastRound) {
        this.hasInvestigatedThisRound = false;
        this.hasVotedThisRound = false;
        this.messagesSentThisRound = 0;
        this.lastRound = state.roundNumber;
      }

      // Reset vote flag on new voting phase
      if (currentPhaseName === "Voting") {
        this.hasVotedThisRound = false;
      }

      this.lastKnownPhase = currentPhaseName;
    }

    // Check if we are alive
    const me = state.players.find(
      (p) => p.address.toLowerCase() === this.address.toLowerCase()
    );
    if (!me) {
      this.log("We are not in this game. Leaving.");
      this.leaveCurrentGame();
      return;
    }
    if (!me.alive) {
      this.log("We have been eliminated. Spectating until game ends.");
      if (state.phaseName === "End") {
        this.logGameResult(state);
        this.leaveCurrentGame();
      }
      return;
    }

    // Process new messages from other players to build suspicion model
    this.processNewMessages(state);

    // Act based on phase
    switch (state.phaseName) {
      case "Lobby":
        // Waiting for game to start
        break;

      case "Discussion":
        await this.actDiscussion(state);
        break;

      case "Voting":
        await this.actVoting(state);
        break;

      case "Resolution":
        // Wait for resolution to complete
        break;

      case "End":
        this.logGameResult(state);
        this.leaveCurrentGame();
        break;
    }
  }

  // ──────────────────────────────────────────────────────────────
  // Discussion phase actions
  // ──────────────────────────────────────────────────────────────

  private async actDiscussion(state: GameState): Promise<void> {
    const maxMessages = Math.ceil(this.personality.verbosity * 4); // 0-4 messages per round
    if (this.messagesSentThisRound >= maxMessages) return;

    // Only act if there is enough remaining time (at least 10 seconds)
    if (state.remainingTime < 10) return;

    const alivePlayers = state.players.filter(
      (p) => p.alive && p.address.toLowerCase() !== this.address.toLowerCase()
    );

    // First, investigate if we haven't yet this round
    if (!this.hasInvestigatedThisRound && alivePlayers.length > 0) {
      const target = this.pickInvestigationTarget(alivePlayers);
      if (target) {
        await this.sleep(1000 + Math.random() * 3000);
        const result = await this.investigate(
          this.currentGameId!,
          target.address
        );
        if (result) {
          this.hasInvestigatedThisRound = true;
          this.investigations.push({
            target: target.address,
            targetName: target.name,
            result: result.result,
            round: state.roundNumber,
          });

          // Update suspicion scores
          if (result.result === "suspicious") {
            const current = this.suspicionScores.get(target.address.toLowerCase()) || 0;
            this.suspicionScores.set(target.address.toLowerCase(), current + 3);
          } else {
            const current = this.suspicionScores.get(target.address.toLowerCase()) || 0;
            this.suspicionScores.set(
              target.address.toLowerCase(),
              Math.max(0, current - 2)
            );
          }
        }
      }
    }

    // Then send discussion messages
    await this.sleep(2000 + Math.random() * 5000);
    const message = this.generateMessage(state);
    if (message) {
      await this.sendMessage(this.currentGameId!, message);
      this.messagesSentThisRound++;
    }
  }

  // ──────────────────────────────────────────────────────────────
  // Voting phase actions
  // ──────────────────────────────────────────────────────────────

  private async actVoting(state: GameState): Promise<void> {
    if (this.hasVotedThisRound) return;

    // Wait a bit before voting (think time)
    await this.sleep(2000 + Math.random() * 5000);

    const target = this.pickVoteTarget(state);
    if (!target) {
      this.log("No valid vote target found.");
      return;
    }

    const voted = await this.vote(this.currentGameId!, target.address);
    if (voted) {
      this.hasVotedThisRound = true;
      this.log(`Voted to eliminate ${target.name} (${target.address})`);
    }
  }

  // ──────────────────────────────────────────────────────────────
  // Message generation (personality-driven)
  // ──────────────────────────────────────────────────────────────

  private generateMessage(state: GameState): string | null {
    const isImpostor = this.myRole === "Impostor";
    const alivePlayers = state.players.filter(
      (p) => p.alive && p.address.toLowerCase() !== this.address.toLowerCase()
    );

    // Decide what type of message to send
    if (this.messagesSentThisRound === 0) {
      // First message of the round -- opening
      if (isImpostor) {
        return this.fillTemplate(
          getRandomPhrase(this.personality, "impostorBlend"),
          alivePlayers
        );
      }
      return this.fillTemplate(
        getRandomPhrase(this.personality, "opening"),
        alivePlayers
      );
    }

    // Share investigation results
    const latestInvestigation = this.investigations.find(
      (inv) => inv.round === state.roundNumber
    );
    if (
      latestInvestigation &&
      this.messagesSentThisRound === 1 &&
      Math.random() < this.personality.trustLevel
    ) {
      // As impostor, we might lie about results
      if (isImpostor && Math.random() < this.personality.bluffSkill) {
        // Fabricate a result -- accuse a random alive player
        const victim = alivePlayers[
          Math.floor(Math.random() * alivePlayers.length)
        ];
        if (victim) {
          const phrase = getRandomPhrase(this.personality, "impostorAccuse");
          return this.fillTemplateWithTarget(phrase, victim, "suspicious");
        }
      }

      const phrase = getRandomPhrase(this.personality, "shareResult");
      return this.fillTemplateWithTarget(
        phrase,
        {
          address: latestInvestigation.target,
          name: latestInvestigation.targetName,
          alive: true,
        },
        latestInvestigation.result
      );
    }

    // Make an accusation or express suspicion
    const mostSuspicious = this.getMostSuspiciousPlayer(alivePlayers);
    if (mostSuspicious && Math.random() < this.personality.aggressiveness) {
      if (isImpostor) {
        const phrase = getRandomPhrase(this.personality, "impostorAccuse");
        return this.fillTemplateWithTarget(phrase, mostSuspicious, "suspicious");
      }
      const phrase = getRandomPhrase(this.personality, "accusation");
      return this.fillTemplateWithTarget(phrase, mostSuspicious, "suspicious");
    }

    // Express suspicion about someone
    if (mostSuspicious && Math.random() < 0.5) {
      if (isImpostor) {
        const phrase = getRandomPhrase(this.personality, "impostorDeflect");
        return this.fillTemplate(phrase, alivePlayers);
      }
      const phrase = getRandomPhrase(this.personality, "suspicion");
      return this.fillTemplateWithTarget(phrase, mostSuspicious, "suspicious");
    }

    // Agree with general sentiment
    if (Math.random() < 0.3) {
      return getRandomPhrase(this.personality, "agreement");
    }

    return null;
  }

  // ──────────────────────────────────────────────────────────────
  // Target selection
  // ──────────────────────────────────────────────────────────────

  private pickInvestigationTarget(
    alivePlayers: PlayerState[]
  ): PlayerState | null {
    if (alivePlayers.length === 0) return null;

    // Prefer players we haven't investigated yet
    const uninvestigated = alivePlayers.filter(
      (p) =>
        !this.investigations.some(
          (inv) => inv.target.toLowerCase() === p.address.toLowerCase()
        )
    );

    const pool = uninvestigated.length > 0 ? uninvestigated : alivePlayers;

    // Higher analytical depth -> pick highest suspicion target;
    // Lower -> pick randomly
    if (Math.random() < this.personality.analyticalDepth) {
      // Pick the one we're most suspicious of
      return pool.sort((a, b) => {
        const sa = this.suspicionScores.get(a.address.toLowerCase()) || 0;
        const sb = this.suspicionScores.get(b.address.toLowerCase()) || 0;
        return sb - sa;
      })[0];
    }

    return pool[Math.floor(Math.random() * pool.length)];
  }

  private pickVoteTarget(state: GameState): PlayerState | null {
    const alivePlayers = state.players.filter(
      (p) => p.alive && p.address.toLowerCase() !== this.address.toLowerCase()
    );

    if (alivePlayers.length === 0) return null;

    const isImpostor = this.myRole === "Impostor";

    if (isImpostor) {
      // As impostor, vote for a crewmate (ideally one already getting accused)
      // We don't actually know who is crewmate/impostor beyond our own role,
      // so just pick whoever seems popular to vote for or a random player
      const messageCounts = new Map<string, number>();
      for (const msg of state.messages) {
        for (const player of alivePlayers) {
          if (
            msg.content.toLowerCase().includes(player.name.toLowerCase()) &&
            msg.sender.toLowerCase() !== this.address.toLowerCase()
          ) {
            const count = messageCounts.get(player.address.toLowerCase()) || 0;
            messageCounts.set(player.address.toLowerCase(), count + 1);
          }
        }
      }

      // Vote for whoever is being discussed the most (pile on)
      if (messageCounts.size > 0) {
        const sorted = [...messageCounts.entries()].sort(
          (a, b) => b[1] - a[1]
        );
        const topTarget = alivePlayers.find(
          (p) => p.address.toLowerCase() === sorted[0][0]
        );
        if (topTarget) return topTarget;
      }

      // Otherwise random
      return alivePlayers[Math.floor(Math.random() * alivePlayers.length)];
    }

    // As crewmate, vote based on suspicion scores
    const sorted = [...alivePlayers].sort((a, b) => {
      const sa = this.suspicionScores.get(a.address.toLowerCase()) || 0;
      const sb = this.suspicionScores.get(b.address.toLowerCase()) || 0;
      return sb - sa;
    });

    // Highest suspicion player
    if (
      sorted.length > 0 &&
      (this.suspicionScores.get(sorted[0].address.toLowerCase()) || 0) > 0
    ) {
      return sorted[0];
    }

    // If no one is suspicious, pick randomly
    return alivePlayers[Math.floor(Math.random() * alivePlayers.length)];
  }

  private getMostSuspiciousPlayer(
    alivePlayers: PlayerState[]
  ): PlayerState | null {
    if (alivePlayers.length === 0) return null;

    const sorted = [...alivePlayers].sort((a, b) => {
      const sa = this.suspicionScores.get(a.address.toLowerCase()) || 0;
      const sb = this.suspicionScores.get(b.address.toLowerCase()) || 0;
      return sb - sa;
    });

    if (
      (this.suspicionScores.get(sorted[0].address.toLowerCase()) || 0) > 0
    ) {
      return sorted[0];
    }

    return null;
  }

  // ──────────────────────────────────────────────────────────────
  // Message processing and suspicion modeling
  // ──────────────────────────────────────────────────────────────

  private processNewMessages(state: GameState): void {
    for (const msg of state.messages) {
      if (this.seenMessageIds.has(msg.id)) continue;
      this.seenMessageIds.add(msg.id);

      // Skip our own messages
      if (msg.sender.toLowerCase() === this.address.toLowerCase()) continue;

      // Look for accusations in messages (mentions of other player names)
      const alivePlayers = state.players.filter(
        (p) =>
          p.alive && p.address.toLowerCase() !== msg.sender.toLowerCase()
      );

      for (const player of alivePlayers) {
        if (msg.content.toLowerCase().includes(player.name.toLowerCase())) {
          // If the message sounds accusatory, increase suspicion
          const accusatoryWords = [
            "suspicious",
            "sus",
            "impostor",
            "vote",
            "eliminate",
            "accuse",
            "lying",
            "liar",
            "fake",
          ];
          const isAccusatory = accusatoryWords.some((word) =>
            msg.content.toLowerCase().includes(word)
          );

          if (isAccusatory) {
            const current =
              this.suspicionScores.get(player.address.toLowerCase()) || 0;
            this.suspicionScores.set(
              player.address.toLowerCase(),
              current + 1
            );
          }
        }
      }
    }
  }

  // ──────────────────────────────────────────────────────────────
  // Template helpers
  // ──────────────────────────────────────────────────────────────

  private fillTemplate(template: string, alivePlayers: PlayerState[]): string {
    let result = template;

    // Replace {target} with a random alive player name if present
    if (result.includes("{target}") && alivePlayers.length > 0) {
      const target =
        alivePlayers[Math.floor(Math.random() * alivePlayers.length)];
      result = result.replace(/\{target\}/g, target.name);
    }

    // Replace {reason} with a generic reason
    result = result.replace(
      /\{reason\}/g,
      "their behavior has been inconsistent"
    );

    // Replace {result}
    result = result.replace(
      /\{result\}/g,
      Math.random() > 0.5 ? "suspicious" : "clear"
    );

    return result;
  }

  private fillTemplateWithTarget(
    template: string,
    target: PlayerState,
    investigationResult: string
  ): string {
    return template
      .replace(/\{target\}/g, target.name)
      .replace(/\{result\}/g, investigationResult)
      .replace(/\{reason\}/g, "their behavior has been inconsistent");
  }

  // ──────────────────────────────────────────────────────────────
  // Role detection
  // ──────────────────────────────────────────────────────────────

  private detectRole(state: GameState): void {
    if (this.myRole) return; // Already known

    const me = state.players.find(
      (p) => p.address.toLowerCase() === this.address.toLowerCase()
    );

    if (me?.role) {
      this.myRole = me.role;
      this.log(`*** Role assigned: ${this.myRole} ***`);
    }
  }

  // ──────────────────────────────────────────────────────────────
  // HTTP API calls (real calls, no mocks)
  // ──────────────────────────────────────────────────────────────

  private async signMessage(message: string): Promise<`0x${string}`> {
    return this.account.signMessage({ message });
  }

  /**
   * Build the signature message matching the engine's auth middleware:
   * `ClawWars:{METHOD}:{path}:{JSON of body minus signature, keys sorted}`
   */
  private buildSignaturePayload(
    method: string,
    path: string,
    body: Record<string, unknown>
  ): string {
    const filtered = { ...body };
    delete filtered.signature;
    const sortedKeys = Object.keys(filtered).sort();
    const payload = JSON.stringify(filtered, sortedKeys);
    return `ClawWars:${method}:${path}:${payload}`;
  }

  private async apiRequest<T>(
    method: string,
    path: string,
    body?: Record<string, unknown>,
    signed: boolean = false
  ): Promise<T | null> {
    const url = `${this.config.gameServerUrl}${path}`;

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };

    let finalBody = body;

    if (signed && body) {
      // Add address and signature
      const bodyWithAddress = {
        ...body,
        address: this.address,
      };

      const sigMessage = this.buildSignaturePayload(method, path, bodyWithAddress);
      const signature = await this.signMessage(sigMessage);

      finalBody = {
        ...bodyWithAddress,
        signature,
      };
    }

    try {
      const response = await fetch(url, {
        method,
        headers,
        body: finalBody ? JSON.stringify(finalBody) : undefined,
      });

      if (!response.ok) {
        const errorText = await response.text();
        this.logError(
          `API ${method} ${path} failed (${response.status}): ${errorText}`
        );
        return null;
      }

      return (await response.json()) as T;
    } catch (err) {
      this.logError(`API ${method} ${path} network error`, err);
      return null;
    }
  }

  async listGames(): Promise<GameListItem[] | null> {
    const resp = await this.apiRequest<{ games: GameListItem[]; count: number }>(
      "GET",
      "/api/games"
    );
    return resp?.games ?? null;
  }

  async createGame(): Promise<string | null> {
    const resp = await this.apiRequest<{ gameId: string }>("POST", "/api/games", {
      minPlayers: 5,
      maxPlayers: 8,
    });
    if (resp) {
      this.log(`Created game: ${resp.gameId}`);
      return resp.gameId;
    }
    return null;
  }

  async joinGame(gameId: string): Promise<boolean> {
    const path = `/api/games/${gameId}/join`;
    const resp = await this.apiRequest<{ success: boolean }>(
      "POST",
      path,
      { name: this.identity.name },
      true // signed
    );

    if (resp?.success) {
      this.log(`Joined game ${gameId} as "${this.identity.name}"`);
      return true;
    }
    return false;
  }

  async getGameState(gameId: string): Promise<GameState | null> {
    return this.apiRequest<GameState>(
      "GET",
      `/api/games/${gameId}?agent=${this.address}`
    );
  }

  async sendMessage(gameId: string, message: string): Promise<boolean> {
    const path = `/api/games/${gameId}/discuss`;
    const resp = await this.apiRequest<{ success: boolean }>(
      "POST",
      path,
      { message },
      true
    );

    if (resp?.success) {
      this.log(`Sent message: "${message.substring(0, 80)}..."`);
      return true;
    }
    return false;
  }

  async investigate(
    gameId: string,
    targetAddress: string
  ): Promise<{ result: "suspicious" | "clear" } | null> {
    const path = `/api/games/${gameId}/investigate`;
    const resp = await this.apiRequest<{
      success: boolean;
      result: "suspicious" | "clear";
    }>(
      "POST",
      path,
      { target: targetAddress },
      true
    );

    if (resp?.success) {
      this.log(`Investigated ${targetAddress}: ${resp.result}`);
      return { result: resp.result };
    }
    return null;
  }

  async vote(gameId: string, targetAddress: string): Promise<boolean> {
    const path = `/api/games/${gameId}/vote`;
    const resp = await this.apiRequest<{ success: boolean }>(
      "POST",
      path,
      { target: targetAddress },
      true
    );
    return resp?.success ?? false;
  }

  // ──────────────────────────────────────────────────────────────
  // State management
  // ──────────────────────────────────────────────────────────────

  private resetGameState(): void {
    this.myRole = null;
    this.lastKnownPhase = null;
    this.lastRound = 0;
    this.investigations = [];
    this.hasInvestigatedThisRound = false;
    this.hasVotedThisRound = false;
    this.messagesSentThisRound = 0;
    this.seenMessageIds.clear();
    this.suspicionScores.clear();
  }

  private leaveCurrentGame(): void {
    this.log(`Leaving game ${this.currentGameId}`);
    this.currentGameId = null;
    this.resetGameState();
  }

  private logGameResult(state: GameState): void {
    const resultMap: Record<number, string> = {
      0: "Ongoing",
      1: "Crewmates Win",
      2: "Impostor Wins",
    };
    this.log(
      `Game ${state.gameId} ended: ${resultMap[state.result] || "Unknown"} | My role: ${this.myRole || "Unknown"}`
    );
  }

  // ──────────────────────────────────────────────────────────────
  // Utilities
  // ──────────────────────────────────────────────────────────────

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  private log(msg: string): void {
    console.log(`[${ts()}] [${this.identity.name}#${this.identity.index}] ${msg}`);
  }

  private logError(msg: string, err?: unknown): void {
    const errMsg = err instanceof Error ? err.message : String(err ?? "");
    console.error(
      `[${ts()}] [${this.identity.name}#${this.identity.index}] ERROR: ${msg}${errMsg ? ` - ${errMsg}` : ""}`
    );
  }
}
