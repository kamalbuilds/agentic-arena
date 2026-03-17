import { EventEmitter } from "events";
import { gameManager } from "./GameManager.js";
import { GameResult } from "./GameRoom.js";
import { logger } from "../utils/logger.js";
import {
  createTournamentOnChain,
  startTournamentOnChain,
  reportMatchResultOnChain,
  cancelTournamentOnChain,
} from "../chain/colosseum-contract.js";
import { walletClient } from "../chain/client.js";
import { saveTournament, loadTournaments } from "../persistence/colosseumStore.js";

const tournamentLogger = logger.child("TournamentManager");

export enum TournamentStatus {
  Registration = "Registration",
  Active = "Active",
  Completed = "Completed",
  Cancelled = "Cancelled",
}

export interface TournamentMatch {
  round: number;
  matchIndex: number;
  player1: string;
  player2: string;
  winner: string | null;
  gameId: string | null;
  completed: boolean;
}

export interface TournamentConfig {
  name: string;
  entryFee: bigint;
  maxParticipants: number; // must be power of 2
  registrationDurationMs: number;
  arenaType: number;
}

export interface TournamentData {
  id: string;
  onChainId: bigint | null; // Corresponding ClawTournament contract ID
  name: string;
  entryFee: bigint;
  prizePool: bigint;
  maxParticipants: number;
  currentRound: number;
  totalRounds: number;
  status: TournamentStatus;
  registrationDeadline: number;
  arenaType: number;
  participants: string[];
  brackets: Map<string, TournamentMatch>; // "round-matchIndex" => match
  placements: Map<number, string>; // 1st, 2nd, 3rd, 4th
  createdAt: number;
}

class TournamentManager extends EventEmitter {
  private tournaments = new Map<string, TournamentData>();
  private nextId = 1;

  /** Load active tournaments from Postgres on startup */
  async loadFromDb(): Promise<void> {
    const saved = await loadTournaments();
    for (const t of saved) {
      this.tournaments.set(t.id, t);
      const idNum = parseInt(t.id.replace("tournament-", ""), 10);
      if (!isNaN(idNum) && idNum >= this.nextId) this.nextId = idNum + 1;
    }
    if (saved.length > 0) {
      tournamentLogger.info(`Restored ${saved.length} tournaments from DB`);
    }
  }

  /** Persist tournament state (non-blocking) */
  private persist(t: TournamentData): void {
    saveTournament(t).catch((err) =>
      tournamentLogger.error(`Failed to persist tournament ${t.id}`, err)
    );
  }

  createTournament(config: TournamentConfig): TournamentData {
    const { name, entryFee, maxParticipants, registrationDurationMs, arenaType } = config;

    if (!this.isPowerOfTwo(maxParticipants) || maxParticipants < 4 || maxParticipants > 32) {
      throw new Error("maxParticipants must be a power of 2 between 4 and 32");
    }

    const id = `tournament-${this.nextId++}`;
    const totalRounds = Math.log2(maxParticipants);

    const tournament: TournamentData = {
      id,
      onChainId: null,
      name,
      entryFee,
      prizePool: 0n,
      maxParticipants,
      currentRound: 0,
      totalRounds,
      status: TournamentStatus.Registration,
      registrationDeadline: Date.now() + registrationDurationMs,
      arenaType,
      participants: [],
      brackets: new Map(),
      placements: new Map(),
      createdAt: Date.now(),
    };

    this.tournaments.set(id, tournament);
    this.persist(tournament);
    this.emit("tournamentCreated", tournament);
    tournamentLogger.info(`Tournament created: ${id} - ${name} (${maxParticipants} players)`);

    // Fire on-chain transaction (non-blocking)
    if (walletClient) {
      const regDurationSec = BigInt(Math.floor(registrationDurationMs / 1000));
      createTournamentOnChain(name, entryFee, maxParticipants, regDurationSec, BigInt(arenaType))
        .then((hash) => {
          if (hash) tournamentLogger.info(`Tournament ${id} on-chain tx: ${hash}`);
        })
        .catch((err) => tournamentLogger.error(`Tournament ${id} on-chain create failed`, err));
    }

    return tournament;
  }

  registerPlayer(tournamentId: string, playerAddress: string): boolean {
    const t = this.tournaments.get(tournamentId);
    if (!t) return false;
    if (t.status !== TournamentStatus.Registration) return false;
    if (Date.now() > t.registrationDeadline) return false;
    if (t.participants.includes(playerAddress)) return false;
    if (t.participants.length >= t.maxParticipants) return false;

    t.participants.push(playerAddress);
    t.prizePool += t.entryFee;
    this.persist(t);
    this.emit("playerRegistered", tournamentId, playerAddress);

    tournamentLogger.info(`Player ${playerAddress} registered for ${tournamentId} (${t.participants.length}/${t.maxParticipants})`);
    return true;
  }

  startTournament(tournamentId: string): boolean {
    const t = this.tournaments.get(tournamentId);
    if (!t) return false;
    if (t.status !== TournamentStatus.Registration) return false;
    if (t.participants.length < t.maxParticipants) return false;

    t.status = TournamentStatus.Active;
    t.currentRound = 1;

    // Shuffle participants for seeding (Fisher-Yates)
    const seeded = [...t.participants];
    for (let i = seeded.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [seeded[i], seeded[j]] = [seeded[j], seeded[i]];
    }

    // Create round 1 matches
    const matchCount = seeded.length / 2;
    for (let i = 0; i < matchCount; i++) {
      const match: TournamentMatch = {
        round: 1,
        matchIndex: i,
        player1: seeded[i * 2],
        player2: seeded[i * 2 + 1],
        winner: null,
        gameId: null,
        completed: false,
      };
      t.brackets.set(`1-${i}`, match);
    }

    this.persist(t);
    this.emit("tournamentStarted", tournamentId);
    tournamentLogger.info(`Tournament ${tournamentId} started with ${matchCount} round-1 matches`);

    // Fire on-chain startTournament (non-blocking)
    if (walletClient && t.onChainId !== null) {
      const seededAddresses = seeded.filter((s): s is `0x${string}` => s.startsWith("0x")) as `0x${string}`[];
      if (seededAddresses.length === seeded.length) {
        startTournamentOnChain(t.onChainId, seededAddresses)
          .then((hash) => {
            if (hash) tournamentLogger.info(`Tournament ${tournamentId} on-chain start tx: ${hash}`);
          })
          .catch((err) => tournamentLogger.error(`Tournament ${tournamentId} on-chain start failed`, err));
      }
    }

    return true;
  }

  async createMatchGame(tournamentId: string, round: number, matchIndex: number): Promise<string | null> {
    const t = this.tournaments.get(tournamentId);
    if (!t) return null;

    const match = t.brackets.get(`${round}-${matchIndex}`);
    if (!match || match.completed) return null;

    // Create a game for this match
    const room = await gameManager.createGame({
      minPlayers: 2,
      maxPlayers: 8,
      impostorCount: 1,
      maxRounds: 3,
      onChainEnabled: true,
    });

    match.gameId = room.gameId;

    // Listen for game end to auto-report match result
    room.on("gameEnd", (gameId: string, result: GameResult) => {
      this.reportMatchResult(tournamentId, round, matchIndex, gameId, result);
    });

    this.emit("matchGameCreated", tournamentId, round, matchIndex, room.gameId);
    return room.gameId;
  }

  reportMatchResult(
    tournamentId: string,
    round: number,
    matchIndex: number,
    gameId: string,
    result: GameResult
  ): boolean {
    const t = this.tournaments.get(tournamentId);
    if (!t) return false;
    if (t.status !== TournamentStatus.Active) return false;

    const match = t.brackets.get(`${round}-${matchIndex}`);
    if (!match || match.completed) return false;

    // Determine winner based on game result
    // In a tournament, player1 plays as "crewmates" side, player2 as challenger
    // Winner is determined by game outcome — operator reports
    match.completed = true;
    match.gameId = gameId;

    this.emit("matchCompleted", tournamentId, round, matchIndex, match.winner);
    tournamentLogger.info(`Match ${round}-${matchIndex} in ${tournamentId} completed. Winner: ${match.winner}`);

    // Check if round is complete
    if (this.isRoundComplete(t, round)) {
      if (round === t.totalRounds) {
        this.finalizeTournament(t, round);
      } else {
        this.advanceRound(t, round);
      }
    }

    return true;
  }

  setMatchWinner(tournamentId: string, round: number, matchIndex: number, winner: string, gameId?: string): boolean {
    const t = this.tournaments.get(tournamentId);
    if (!t) return false;

    const match = t.brackets.get(`${round}-${matchIndex}`);
    if (!match) return false;
    if (winner !== match.player1 && winner !== match.player2) return false;

    match.winner = winner;
    match.completed = true;
    this.persist(t);

    this.emit("matchCompleted", tournamentId, round, matchIndex, winner);
    tournamentLogger.info(`Match ${round}-${matchIndex} in ${tournamentId} - winner set to ${winner}`);

    // Report match result on-chain (non-blocking)
    if (walletClient && t.onChainId !== null && winner.startsWith("0x")) {
      const chainGameId = gameId ? BigInt(gameId.replace(/\D/g, "") || "0") : 0n;
      reportMatchResultOnChain(t.onChainId, round, matchIndex, winner as `0x${string}`, chainGameId)
        .then((hash) => {
          if (hash) tournamentLogger.info(`Match ${round}-${matchIndex} on-chain report tx: ${hash}`);
        })
        .catch((err) => tournamentLogger.error(`Match ${round}-${matchIndex} on-chain report failed`, err));
    }

    if (this.isRoundComplete(t, round)) {
      if (round === t.totalRounds) {
        this.finalizeTournament(t, round);
      } else {
        this.advanceRound(t, round);
      }
    }

    return true;
  }

  private isRoundComplete(t: TournamentData, round: number): boolean {
    const matchesInRound = t.maxParticipants / (2 ** round);
    for (let i = 0; i < matchesInRound; i++) {
      const match = t.brackets.get(`${round}-${i}`);
      if (!match || !match.completed) return false;
    }
    return true;
  }

  private advanceRound(t: TournamentData, completedRound: number): void {
    const nextRound = completedRound + 1;
    t.currentRound = nextRound;

    const prevMatchCount = t.maxParticipants / (2 ** completedRound);
    const newMatchCount = prevMatchCount / 2;

    for (let i = 0; i < newMatchCount; i++) {
      const match1 = t.brackets.get(`${completedRound}-${i * 2}`)!;
      const match2 = t.brackets.get(`${completedRound}-${i * 2 + 1}`)!;

      const newMatch: TournamentMatch = {
        round: nextRound,
        matchIndex: i,
        player1: match1.winner!,
        player2: match2.winner!,
        winner: null,
        gameId: null,
        completed: false,
      };
      t.brackets.set(`${nextRound}-${i}`, newMatch);
    }

    this.persist(t);
    this.emit("roundAdvanced", t.id, nextRound);
    tournamentLogger.info(`Tournament ${t.id} advanced to round ${nextRound}`);
  }

  private finalizeTournament(t: TournamentData, finalRound: number): void {
    t.status = TournamentStatus.Completed;

    const finalMatch = t.brackets.get(`${finalRound}-0`)!;
    const champion = finalMatch.winner!;
    const runnerUp = finalMatch.winner === finalMatch.player1 ? finalMatch.player2 : finalMatch.player1;

    t.placements.set(1, champion);
    t.placements.set(2, runnerUp);

    // Semi-final losers = 3rd/4th
    if (finalRound > 1) {
      const semi1 = t.brackets.get(`${finalRound - 1}-0`)!;
      const semi2 = t.brackets.get(`${finalRound - 1}-1`)!;

      const loser1 = semi1.winner === semi1.player1 ? semi1.player2 : semi1.player1;
      const loser2 = semi2.winner === semi2.player1 ? semi2.player2 : semi2.player1;

      t.placements.set(3, loser1);
      t.placements.set(4, loser2);
    }

    this.persist(t);
    this.emit("tournamentCompleted", t.id, champion);
    tournamentLogger.info(`Tournament ${t.id} completed! Champion: ${champion}`);
  }

  cancelTournament(tournamentId: string): boolean {
    const t = this.tournaments.get(tournamentId);
    if (!t || t.status !== TournamentStatus.Registration) return false;

    t.status = TournamentStatus.Cancelled;
    this.emit("tournamentCancelled", tournamentId);

    // Cancel on-chain (non-blocking)
    if (walletClient && t.onChainId !== null) {
      cancelTournamentOnChain(t.onChainId)
        .then((hash) => {
          if (hash) tournamentLogger.info(`Tournament ${tournamentId} on-chain cancel tx: ${hash}`);
        })
        .catch((err) => tournamentLogger.error(`Tournament ${tournamentId} on-chain cancel failed`, err));
    }

    return true;
  }

  // -----------------------------------------------------------------------
  // Getters
  // -----------------------------------------------------------------------

  getTournament(id: string): TournamentData | undefined {
    return this.tournaments.get(id);
  }

  getAllTournaments(): TournamentData[] {
    return Array.from(this.tournaments.values());
  }

  getActiveTournaments(): TournamentData[] {
    return this.getAllTournaments().filter(
      (t) => t.status === TournamentStatus.Registration || t.status === TournamentStatus.Active
    );
  }

  getBracket(tournamentId: string): TournamentMatch[] {
    const t = this.tournaments.get(tournamentId);
    if (!t) return [];
    return Array.from(t.brackets.values()).sort((a, b) => a.round - b.round || a.matchIndex - b.matchIndex);
  }

  getState(tournamentId: string): object | null {
    const t = this.tournaments.get(tournamentId);
    if (!t) return null;

    return {
      id: t.id,
      onChainId: t.onChainId !== null ? t.onChainId.toString() : null,
      name: t.name,
      entryFee: t.entryFee.toString(),
      prizePool: t.prizePool.toString(),
      maxParticipants: t.maxParticipants,
      currentRound: t.currentRound,
      totalRounds: t.totalRounds,
      status: t.status,
      registrationDeadline: t.registrationDeadline,
      arenaType: t.arenaType,
      participantCount: t.participants.length,
      participants: t.participants,
      bracket: this.getBracket(tournamentId).map((m) => ({
        round: m.round,
        matchIndex: m.matchIndex,
        player1: m.player1,
        player2: m.player2,
        winner: m.winner,
        gameId: m.gameId,
        completed: m.completed,
      })),
      placements: Object.fromEntries(t.placements),
      createdAt: t.createdAt,
    };
  }

  private isPowerOfTwo(n: number): boolean {
    return n > 0 && (n & (n - 1)) === 0;
  }
}

export const tournamentManager = new TournamentManager();
