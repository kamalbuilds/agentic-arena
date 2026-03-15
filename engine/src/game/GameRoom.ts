import { EventEmitter } from "node:events";
import crypto from "node:crypto";
import { v4 as uuidv4 } from "uuid";
import {
  assignRoles,
  generateCommitments,
  getSalt,
  getStoredRole,
  cleanupGame as cleanupRoles,
  Role,
  type RoleCommitment,
} from "./RoleAssigner.js";
import {
  recordVote,
  resolveVotes,
  getVoteTally,
  getVoteRecords,
  resetVotes,
  cleanupVotes,
  archiveRoundVotes,
  getVoteHistory,
  type RoundVoteHistory,
} from "./VoteResolver.js";
import {
  phaseManager,
  GamePhase,
  PHASE_NAMES,
} from "./PhaseManager.js";
import {
  commitRolesOnChain,
  advancePhaseOnChain,
  resolveVoteOnChain,
  revealRoleOnChain,
  endGameOnChain,
  startGameOnChain,
  settleBetsOnChain,
  updateStatsOnChain,
} from "../chain/contract.js";
import { config } from "../config.js";
import { logger } from "../utils/logger.js";

const roomLogger = logger.child("GameRoom");

export enum GameResult {
  Ongoing = 0,
  CrewmatesWin = 1,
  ImpostorWins = 2,
}

export interface PlayerInfo {
  address: `0x${string}`;
  name: string;
  role: Role;
  alive: boolean;
  joinedAt: number;
}

export interface GameMessage {
  id: string;
  sender: `0x${string}`;
  senderName: string;
  content: string;
  timestamp: number;
  round: number;
}

export interface InvestigationResult {
  scanner: `0x${string}`;
  target: `0x${string}`;
  result: "suspicious" | "clear";
  accurate: boolean;
  round: number;
}

export interface GameState {
  gameId: string;
  chainGameId: string | null;
  phase: GamePhase;
  phaseName: string;
  roundNumber: number;
  maxRounds: number;
  maxPlayers: number;
  totalStake: string;
  stakePerPlayer: string;
  players: Array<{
    address: `0x${string}`;
    name: string;
    alive: boolean;
    role?: string;
  }>;
  messages: GameMessage[];
  remainingTime: number;
  result: GameResult;
  eliminations: Array<{
    address: `0x${string}`;
    name: string;
    role: string;
    round: number;
  }>;
  voteHistory: RoundVoteHistory[];
  spectatorCount: number;
}

export class GameRoom extends EventEmitter {
  public readonly gameId: string;
  public chainGameId: bigint | null = null;
  public players = new Map<string, PlayerInfo>();
  public phase: GamePhase = GamePhase.Lobby;
  public roundNumber: number = 0;
  public maxRounds: number;
  public messages: GameMessage[] = [];
  public spectators = new Set<string>();
  public result: GameResult = GameResult.Ongoing;
  public eliminations: Array<{
    address: `0x${string}`;
    name: string;
    role: string;
    round: number;
  }> = [];
  public investigations: InvestigationResult[] = [];

  private stake: bigint;
  private minPlayers: number;
  private maxPlayers: number;
  private impostorCount: number;
  private onChainEnabled: boolean;

  constructor(options: {
    gameId?: string;
    stake?: bigint;
    minPlayers?: number;
    maxPlayers?: number;
    impostorCount?: number;
    maxRounds?: number;
    chainGameId?: bigint;
    onChainEnabled?: boolean;
  }) {
    super();
    this.gameId = options.gameId || uuidv4();
    this.stake = options.stake || config.game.defaultStake;
    this.minPlayers = options.minPlayers || config.game.minPlayers;
    this.maxPlayers = options.maxPlayers || config.game.maxPlayers;
    this.impostorCount = options.impostorCount || config.game.impostorCount;
    this.maxRounds = options.maxRounds || config.game.maxRounds;
    this.chainGameId = options.chainGameId || null;
    this.onChainEnabled = options.onChainEnabled !== false;

    // Listen for phase end events
    phaseManager.onPhaseEnd((gId, endedPhase) => {
      if (gId !== this.gameId) return;
      this.handlePhaseEnd(endedPhase);
    });

    roomLogger.info(`GameRoom created: ${this.gameId}`);
  }

  addPlayer(address: `0x${string}`, name: string): boolean {
    const normalized = address.toLowerCase() as `0x${string}`;

    if (this.phase !== GamePhase.Lobby) {
      roomLogger.warn(`Cannot add player to game ${this.gameId}: not in lobby`);
      return false;
    }

    if (this.players.size >= this.maxPlayers) {
      roomLogger.warn(`Cannot add player to game ${this.gameId}: game full`);
      return false;
    }

    if (this.players.has(normalized)) {
      roomLogger.warn(
        `Player ${address} already in game ${this.gameId}`
      );
      return false;
    }

    this.players.set(normalized, {
      address,
      name,
      role: Role.Crewmate, // placeholder until game starts
      alive: true,
      joinedAt: Date.now(),
    });

    roomLogger.info(
      `Player ${name} (${address}) joined game ${this.gameId} (${this.players.size}/${this.maxPlayers})`
    );

    this.emit("playerJoined", this.gameId, address, name);
    return true;
  }

  removePlayer(address: `0x${string}`): boolean {
    const normalized = address.toLowerCase() as `0x${string}`;

    if (this.phase !== GamePhase.Lobby) {
      return false;
    }

    const removed = this.players.delete(normalized);
    if (removed) {
      this.emit("playerLeft", this.gameId, address);
    }
    return removed;
  }

  canStart(): boolean {
    return (
      this.phase === GamePhase.Lobby &&
      this.players.size >= this.minPlayers
    );
  }

  async start(): Promise<void> {
    if (!this.canStart()) {
      throw new Error(
        `Cannot start game ${this.gameId}: need at least ${this.minPlayers} players, have ${this.players.size}`
      );
    }

    roomLogger.info(
      `Starting game ${this.gameId} with ${this.players.size} players`
    );

    // Get player addresses
    const addresses = Array.from(this.players.values()).map(
      (p) => p.address
    );

    // Assign roles
    const roleAssignments = assignRoles(
      addresses as `0x${string}`[],
      this.impostorCount
    );

    // Update player roles
    for (const [address, role] of roleAssignments) {
      const normalized = address.toLowerCase() as `0x${string}`;
      const player = this.players.get(normalized);
      if (player) {
        player.role = role;
      }
    }

    // Generate commitments
    const commitments = generateCommitments(this.gameId, roleAssignments);

    // On-chain: start game and commit roles (non-blocking)
    if (this.onChainEnabled && this.chainGameId !== null) {
      const chainId = this.chainGameId;
      (async () => {
        try {
          await startGameOnChain(chainId);
          const agentAddresses = commitments.map((c) => c.address);
          const commitmentHashes = commitments.map((c) => c.commitment);
          await commitRolesOnChain(chainId, agentAddresses, commitmentHashes);
        } catch (err) {
          roomLogger.warn("On-chain start/commit failed (non-blocking)", err instanceof Error ? err.message : "");
        }
      })();
    }

    this.roundNumber = 1;
    this.emit("gameStarted", this.gameId, this.getPlayerList());

    // Start discussion phase
    await this.startDiscussionPhase();
  }

  private async startDiscussionPhase(): Promise<void> {
    this.phase = GamePhase.Discussion;
    const duration = config.game.discussionDuration;

    phaseManager.startPhase(this.gameId, GamePhase.Discussion, duration);

    if (this.onChainEnabled && this.chainGameId !== null) {
      advancePhaseOnChain(this.chainGameId, GamePhase.Discussion, BigInt(duration)).catch((err) => {
        roomLogger.warn("On-chain discussion phase advance failed (non-blocking)");
      });
    }

    this.emit("phaseChange", this.gameId, "Discussion", duration, this.roundNumber);
  }

  private async startVotingPhase(): Promise<void> {
    this.phase = GamePhase.Voting;
    const duration = config.game.votingDuration;

    resetVotes(this.gameId);
    phaseManager.startPhase(this.gameId, GamePhase.Voting, duration);

    if (this.onChainEnabled && this.chainGameId !== null) {
      advancePhaseOnChain(this.chainGameId, GamePhase.Voting, BigInt(duration)).catch((err) => {
        roomLogger.warn("On-chain voting phase advance failed (non-blocking)");
      });
    }

    this.emit("phaseChange", this.gameId, "Voting", duration, this.roundNumber);
  }

  submitMessage(address: `0x${string}`, content: string): GameMessage | null {
    const normalized = address.toLowerCase() as `0x${string}`;
    const player = this.players.get(normalized);

    if (!player) {
      roomLogger.warn(`Unknown player ${address} tried to send message`);
      return null;
    }

    if (!player.alive) {
      roomLogger.warn(`Dead player ${address} tried to send message`);
      return null;
    }

    if (this.phase !== GamePhase.Discussion) {
      roomLogger.warn(
        `Player ${address} tried to send message outside discussion phase`
      );
      return null;
    }

    const message: GameMessage = {
      id: uuidv4(),
      sender: player.address,
      senderName: player.name,
      content,
      timestamp: Date.now(),
      round: this.roundNumber,
    };

    this.messages.push(message);

    roomLogger.info(
      `[Game ${this.gameId}] ${player.name}: ${content.substring(0, 100)}`
    );

    this.emit("message", this.gameId, message);
    return message;
  }

  investigate(
    scanner: `0x${string}`,
    target: `0x${string}`
  ): InvestigationResult | null {
    const normalizedScanner = scanner.toLowerCase() as `0x${string}`;
    const normalizedTarget = target.toLowerCase() as `0x${string}`;

    const scannerPlayer = this.players.get(normalizedScanner);
    const targetPlayer = this.players.get(normalizedTarget);

    if (!scannerPlayer || !targetPlayer) {
      roomLogger.warn("Investigation failed: unknown player");
      return null;
    }

    if (!scannerPlayer.alive || !targetPlayer.alive) {
      roomLogger.warn("Investigation failed: dead player");
      return null;
    }

    if (this.phase !== GamePhase.Discussion) {
      roomLogger.warn("Investigation failed: wrong phase");
      return null;
    }

    if (normalizedScanner === normalizedTarget) {
      roomLogger.warn("Investigation failed: cannot scan self");
      return null;
    }

    // 80% accuracy
    const random = crypto.randomBytes(1)[0];
    const accurate = random < 204; // ~80% of 255

    const actualRole = targetPlayer.role;
    let reportedResult: "suspicious" | "clear";

    if (accurate) {
      reportedResult =
        actualRole === Role.Impostor ? "suspicious" : "clear";
    } else {
      reportedResult =
        actualRole === Role.Impostor ? "clear" : "suspicious";
    }

    const investigation: InvestigationResult = {
      scanner: scannerPlayer.address,
      target: targetPlayer.address,
      result: reportedResult,
      accurate,
      round: this.roundNumber,
    };

    this.investigations.push(investigation);

    roomLogger.info(
      `${scannerPlayer.name} investigated ${targetPlayer.name}: ${reportedResult} (accurate: ${accurate})`
    );

    this.emit("investigation", this.gameId, {
      scanner: scannerPlayer.address,
      scannerName: scannerPlayer.name,
      target: targetPlayer.address,
      targetName: targetPlayer.name,
      result: reportedResult,
    });

    return investigation;
  }

  submitVote(address: `0x${string}`, target: `0x${string}`): boolean {
    const normalized = address.toLowerCase() as `0x${string}`;
    const normalizedTarget = target.toLowerCase() as `0x${string}`;

    const voter = this.players.get(normalized);
    const targetPlayer = this.players.get(normalizedTarget);

    if (!voter || !targetPlayer) {
      roomLogger.warn("Vote failed: unknown player");
      return false;
    }

    if (!voter.alive) {
      roomLogger.warn(`Dead player ${address} tried to vote`);
      return false;
    }

    if (!targetPlayer.alive) {
      roomLogger.warn(`Vote for dead player ${target}`);
      return false;
    }

    if (this.phase !== GamePhase.Voting) {
      roomLogger.warn("Vote failed: wrong phase");
      return false;
    }

    recordVote(this.gameId, voter.address, targetPlayer.address);
    this.emit("voteCast", this.gameId, voter.address, voter.name, targetPlayer.address, targetPlayer.name);
    return true;
  }

  async resolveRound(): Promise<{
    eliminated: `0x${string}` | null;
    result: GameResult;
  }> {
    this.phase = GamePhase.Resolution;
    phaseManager.startPhase(this.gameId, GamePhase.Resolution, 0);

    const voteRecords = getVoteRecords(this.gameId);
    if (voteRecords.length === 0) {
      roomLogger.warn(
        `⚠ ZERO votes cast in game ${this.gameId} round ${this.roundNumber} — agents may not be voting`
      );
    } else {
      roomLogger.info(
        `${voteRecords.length} votes cast in game ${this.gameId} round ${this.roundNumber}`
      );
    }

    const eliminated = resolveVotes(this.gameId);

    if (eliminated) {
      const normalizedEliminated = eliminated.toLowerCase() as `0x${string}`;
      const player = this.players.get(normalizedEliminated);

      if (player) {
        player.alive = false;
        const roleName = player.role === Role.Impostor ? "Impostor" : "Crewmate";

        this.eliminations.push({
          address: player.address,
          name: player.name,
          role: roleName,
          round: this.roundNumber,
        });

        roomLogger.info(
          `${player.name} was eliminated (${roleName}) in round ${this.roundNumber}`
        );

        // Reveal role on-chain (non-blocking)
        if (this.onChainEnabled && this.chainGameId !== null) {
          const chainId = this.chainGameId;
          const addr = player.address;
          const role = player.role;
          (async () => {
            try {
              await resolveVoteOnChain(chainId, addr);
              const salt = getSalt(this.gameId, addr);
              if (salt) {
                await revealRoleOnChain(chainId, addr, role, salt);
              }
            } catch {
              roomLogger.warn("On-chain vote resolution failed (non-blocking)");
            }
          })();
        }

        this.emit(
          "elimination",
          this.gameId,
          player.address,
          player.name,
          roleName,
          this.roundNumber
        );
      }
    } else {
      roomLogger.info(
        `No elimination in round ${this.roundNumber} (tie or no votes)`
      );
      this.emit("noElimination", this.gameId, this.roundNumber);
    }

    // Archive this round's votes before moving on
    archiveRoundVotes(this.gameId, this.roundNumber, eliminated);

    // Check win condition
    const winResult = this.checkWinCondition();

    if (winResult !== null) {
      this.result = winResult;
      this.phase = GamePhase.End;
      phaseManager.startPhase(this.gameId, GamePhase.End, 0);

      // End on-chain (non-blocking)
      if (this.onChainEnabled && this.chainGameId !== null) {
        endGameOnChain(this.chainGameId, winResult).catch(() => {
          roomLogger.warn("On-chain game end failed (non-blocking)");
        });
      }

      const winners = this.getWinners();
      this.emit("gameEnd", this.gameId, winResult, winners);
      this.settleAndUpdateStats(winResult);
      this.cleanup();

      return { eliminated, result: winResult };
    }

    // Check if max rounds reached
    if (this.roundNumber >= this.maxRounds) {
      // Crewmates win if max rounds reached without impostor winning
      this.result = GameResult.CrewmatesWin;
      this.phase = GamePhase.End;
      phaseManager.startPhase(this.gameId, GamePhase.End, 0);

      if (this.onChainEnabled && this.chainGameId !== null) {
        endGameOnChain(this.chainGameId, GameResult.CrewmatesWin).catch(() => {
          roomLogger.warn("On-chain game end (max rounds) failed (non-blocking)");
        });
      }

      const winners = this.getWinners();
      this.emit("gameEnd", this.gameId, GameResult.CrewmatesWin, winners);
      this.settleAndUpdateStats(GameResult.CrewmatesWin);
      this.cleanup();

      return { eliminated, result: GameResult.CrewmatesWin };
    }

    // Next round
    this.roundNumber++;
    resetVotes(this.gameId);
    await this.startDiscussionPhase();

    return { eliminated, result: GameResult.Ongoing };
  }

  checkWinCondition(): GameResult | null {
    const alivePlayers = Array.from(this.players.values()).filter(
      (p) => p.alive
    );
    const aliveImpostors = alivePlayers.filter(
      (p) => p.role === Role.Impostor
    );
    const aliveCrewmates = alivePlayers.filter(
      (p) => p.role === Role.Crewmate
    );

    // All impostors eliminated -> crewmates win
    if (aliveImpostors.length === 0) {
      roomLogger.info(`Game ${this.gameId}: All impostors eliminated, crewmates win`);
      return GameResult.CrewmatesWin;
    }

    // Impostors equal or outnumber crewmates -> impostor wins
    if (aliveImpostors.length >= aliveCrewmates.length) {
      roomLogger.info(
        `Game ${this.gameId}: Impostors (${aliveImpostors.length}) >= Crewmates (${aliveCrewmates.length}), impostor wins`
      );
      return GameResult.ImpostorWins;
    }

    return null;
  }

  getWinners(): `0x${string}`[] {
    if (this.result === GameResult.CrewmatesWin) {
      return Array.from(this.players.values())
        .filter((p) => p.role === Role.Crewmate)
        .map((p) => p.address);
    }
    if (this.result === GameResult.ImpostorWins) {
      return Array.from(this.players.values())
        .filter((p) => p.role === Role.Impostor)
        .map((p) => p.address);
    }
    return [];
  }

  getState(forAgent?: `0x${string}`): GameState {
    const normalizedAgent = forAgent?.toLowerCase() as
      | `0x${string}`
      | undefined;

    const playerList = Array.from(this.players.values()).map((p) => {
      const base: {
        address: `0x${string}`;
        name: string;
        alive: boolean;
        role?: string;
      } = {
        address: p.address,
        name: p.name,
        alive: p.alive,
      };

      // Only reveal roles if:
      // - Game is over
      // - Player is dead (eliminated)
      // - Requesting agent is this player
      if (
        this.phase === GamePhase.End ||
        !p.alive ||
        (normalizedAgent && p.address.toLowerCase() === normalizedAgent)
      ) {
        base.role = p.role === Role.Impostor ? "Impostor" : "Crewmate";
      }

      return base;
    });

    // Compute stake values as human-readable strings (not wei)
    const stakePerPlayer = Number(this.stake) / 1e18;
    const totalStake = stakePerPlayer * this.players.size;

    return {
      gameId: this.gameId,
      chainGameId: this.chainGameId !== null ? this.chainGameId.toString() : null,
      phase: this.phase,
      phaseName: PHASE_NAMES[this.phase],
      roundNumber: this.roundNumber,
      maxRounds: this.maxRounds,
      maxPlayers: this.maxPlayers,
      totalStake: totalStake.toFixed(4),
      stakePerPlayer: stakePerPlayer.toFixed(4),
      players: playerList,
      messages: this.messages, // All messages across all rounds (each has .round field)
      remainingTime: phaseManager.getRemainingTime(this.gameId),
      result: this.result,
      eliminations: this.eliminations,
      voteHistory: getVoteHistory(this.gameId),
      spectatorCount: this.spectators.size,
    };
  }

  getPlayerList(): Array<{ address: `0x${string}`; name: string }> {
    return Array.from(this.players.values()).map((p) => ({
      address: p.address,
      name: p.name,
    }));
  }

  getAlivePlayers(): PlayerInfo[] {
    return Array.from(this.players.values()).filter((p) => p.alive);
  }

  isPlayerAlive(address: `0x${string}`): boolean {
    const normalized = address.toLowerCase() as `0x${string}`;
    const player = this.players.get(normalized);
    return player ? player.alive : false;
  }

  getPlayerCount(): number {
    return this.players.size;
  }

  getAliveCount(): number {
    return Array.from(this.players.values()).filter((p) => p.alive).length;
  }

  addSpectator(id: string): void {
    this.spectators.add(id);
  }

  removeSpectator(id: string): void {
    this.spectators.delete(id);
  }

  private handlePhaseEnd(endedPhase: GamePhase): void {
    if (endedPhase === GamePhase.Discussion) {
      this.startVotingPhase().catch((err) => {
        roomLogger.error("Failed to start voting phase", err);
      });
    } else if (endedPhase === GamePhase.Voting) {
      this.resolveRound().catch((err) => {
        roomLogger.error("Failed to resolve round", err);
      });
    }
  }

  /** Settle bets and update leaderboard stats on-chain after game ends */
  private async settleAndUpdateStats(result: GameResult): Promise<void> {
    if (!this.onChainEnabled || this.chainGameId === null) return;

    const chainId = this.chainGameId;

    // Find impostor address for bet settlement
    const impostor = Array.from(this.players.values()).find(
      (p) => p.role === Role.Impostor
    );
    const impostorAddr = impostor?.address || ("0x0000000000000000000000000000000000000000" as `0x${string}`);

    // Settle bets (non-blocking)
    if (config.contracts.betting) {
      settleBetsOnChain(chainId, result, impostorAddr).catch((err) => {
        roomLogger.warn("On-chain bet settlement failed (non-blocking)", err instanceof Error ? err.message : "");
      });
    }

    // Update leaderboard stats for each player (non-blocking)
    if (config.contracts.leaderboard) {
      const winners = this.getWinners();
      const stake = this.stake;

      for (const player of this.players.values()) {
        const won = winners.includes(player.address);
        const wasImpostor = player.role === Role.Impostor;
        const earned = won ? stake : BigInt(0);

        updateStatsOnChain(player.address, won, wasImpostor, earned).catch((err) => {
          roomLogger.warn(`On-chain stats update failed for ${player.name} (non-blocking)`, err instanceof Error ? err.message : "");
        });
      }
    }
  }

  private cleanup(): void {
    phaseManager.cleanup(this.gameId);
    cleanupVotes(this.gameId);
    // Note: don't cleanup roles yet, they may be needed for reveals
  }
}
