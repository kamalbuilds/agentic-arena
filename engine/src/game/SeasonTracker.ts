import { EventEmitter } from "events";
import { logger } from "../utils/logger.js";
import {
  createSeasonOnChain,
  startSeasonOnChain,
  endSeasonOnChain,
  recordGameOnChain,
  recordTournamentWinOnChain,
  recordCorrectVoteOnChain,
  updateNFTGameStats,
} from "../chain/colosseum-contract.js";
import { walletClient } from "../chain/client.js";
import { saveSeason, loadSeasons } from "../persistence/colosseumStore.js";

const seasonLogger = logger.child("SeasonTracker");

export enum SeasonStatus {
  Upcoming = "Upcoming",
  Active = "Active",
  Ended = "Ended",
}

export interface SeasonPlayerStats {
  address: string;
  gamesPlayed: number;
  gamesWon: number;
  tournamentsWon: number;
  correctVotes: number;
  points: number;
}

export interface SeasonData {
  id: string;
  onChainId: bigint | null; // Corresponding ClawSeason contract ID
  name: string;
  startTime: number;
  endTime: number;
  status: SeasonStatus;
  topRewardSlots: number;
  players: Map<string, SeasonPlayerStats>;
  createdAt: number;
}

export interface SeasonConfig {
  name: string;
  startTime: number;
  endTime: number;
  topRewardSlots: number;
}

// Points per action
const POINTS_PER_GAME = 10;
const POINTS_PER_WIN = 25;
const POINTS_PER_TOURNAMENT_WIN = 100;
const POINTS_PER_CORRECT_VOTE = 5;

class SeasonTracker extends EventEmitter {
  private seasons = new Map<string, SeasonData>();
  private currentSeasonId: string | null = null;
  private nextId = 1;

  /** Load active seasons from Postgres on startup */
  async loadFromDb(): Promise<void> {
    const saved = await loadSeasons();
    for (const s of saved) {
      this.seasons.set(s.id, s);
      if (s.status === SeasonStatus.Active) this.currentSeasonId = s.id;
      const idNum = parseInt(s.id.replace("season-", ""), 10);
      if (!isNaN(idNum) && idNum >= this.nextId) this.nextId = idNum + 1;
    }
    if (saved.length > 0) {
      seasonLogger.info(`Restored ${saved.length} seasons from DB`);
    }
  }

  /** Persist season state (non-blocking) */
  private persist(s: SeasonData): void {
    saveSeason(s).catch((err) =>
      seasonLogger.error(`Failed to persist season ${s.id}`, err)
    );
  }

  createSeason(config: SeasonConfig): SeasonData {
    const id = `season-${this.nextId++}`;

    const season: SeasonData = {
      id,
      onChainId: null,
      name: config.name,
      startTime: config.startTime,
      endTime: config.endTime,
      status: SeasonStatus.Upcoming,
      topRewardSlots: config.topRewardSlots,
      players: new Map(),
      createdAt: Date.now(),
    };

    this.seasons.set(id, season);
    this.persist(season);
    this.emit("seasonCreated", season);
    seasonLogger.info(`Season created: ${id} - ${config.name}`);

    // Fire on-chain (non-blocking)
    if (walletClient) {
      const startTimeSec = BigInt(Math.floor(config.startTime / 1000));
      const endTimeSec = BigInt(Math.floor(config.endTime / 1000));
      createSeasonOnChain(config.name, startTimeSec, endTimeSec, config.topRewardSlots)
        .then((hash) => {
          if (hash) seasonLogger.info(`Season ${id} on-chain tx: ${hash}`);
        })
        .catch((err) => seasonLogger.error(`Season ${id} on-chain create failed`, err));
    }

    return season;
  }

  startSeason(seasonId: string): boolean {
    const s = this.seasons.get(seasonId);
    if (!s || s.status !== SeasonStatus.Upcoming) return false;

    s.status = SeasonStatus.Active;
    this.currentSeasonId = seasonId;
    this.persist(s);
    this.emit("seasonStarted", seasonId);
    seasonLogger.info(`Season started: ${seasonId}`);

    // Fire on-chain (non-blocking)
    if (walletClient && s.onChainId !== null) {
      startSeasonOnChain(s.onChainId)
        .then((hash) => {
          if (hash) seasonLogger.info(`Season ${seasonId} on-chain start tx: ${hash}`);
        })
        .catch((err) => seasonLogger.error(`Season ${seasonId} on-chain start failed`, err));
    }

    return true;
  }

  endSeason(seasonId: string): boolean {
    const s = this.seasons.get(seasonId);
    if (!s || s.status !== SeasonStatus.Active) return false;

    s.status = SeasonStatus.Ended;
    if (this.currentSeasonId === seasonId) this.currentSeasonId = null;
    this.persist(s);
    this.emit("seasonEnded", seasonId);
    seasonLogger.info(`Season ended: ${seasonId}`);

    // Fire on-chain (non-blocking)
    if (walletClient && s.onChainId !== null) {
      endSeasonOnChain(s.onChainId)
        .then((hash) => {
          if (hash) seasonLogger.info(`Season ${seasonId} on-chain end tx: ${hash}`);
        })
        .catch((err) => seasonLogger.error(`Season ${seasonId} on-chain end failed`, err));
    }

    return true;
  }

  getCurrentSeason(): SeasonData | null {
    if (!this.currentSeasonId) return null;
    return this.seasons.get(this.currentSeasonId) || null;
  }

  // -----------------------------------------------------------------------
  // Recording Results
  // -----------------------------------------------------------------------

  recordGame(address: string, won: boolean): void {
    const season = this.getCurrentSeason();
    if (!season) return;

    const stats = this.ensurePlayer(season, address);
    stats.gamesPlayed++;
    stats.points += POINTS_PER_GAME;

    if (won) {
      stats.gamesWon++;
      stats.points += POINTS_PER_WIN;
    }

    this.persist(season);
    this.emit("gameRecorded", season.id, address, won);

    // Record on-chain: season stats + NFT stats (non-blocking)
    if (walletClient && address.startsWith("0x")) {
      const agent = address as `0x${string}`;
      if (season.onChainId !== null) {
        recordGameOnChain(season.onChainId, agent, won).catch((err) =>
          seasonLogger.error(`On-chain recordGame failed for ${address}`, err)
        );
      }
      // Also update agent NFT stats (if they have one)
      updateNFTGameStats(agent, won).catch((err) =>
        seasonLogger.error(`On-chain NFT stats update failed for ${address}`, err)
      );
    }
  }

  recordTournamentWin(address: string): void {
    const season = this.getCurrentSeason();
    if (!season) return;

    const stats = this.ensurePlayer(season, address);
    stats.tournamentsWon++;
    stats.points += POINTS_PER_TOURNAMENT_WIN;

    this.persist(season);
    this.emit("tournamentWinRecorded", season.id, address);

    // Record on-chain (non-blocking)
    if (walletClient && address.startsWith("0x") && season.onChainId !== null) {
      recordTournamentWinOnChain(season.onChainId, address as `0x${string}`).catch((err) =>
        seasonLogger.error(`On-chain recordTournamentWin failed for ${address}`, err)
      );
    }
  }

  recordCorrectVote(address: string): void {
    const season = this.getCurrentSeason();
    if (!season) return;

    const stats = this.ensurePlayer(season, address);
    stats.correctVotes++;
    stats.points += POINTS_PER_CORRECT_VOTE;
    this.persist(season);

    // Record on-chain (non-blocking)
    if (walletClient && address.startsWith("0x") && season.onChainId !== null) {
      recordCorrectVoteOnChain(season.onChainId, address as `0x${string}`).catch((err) =>
        seasonLogger.error(`On-chain recordCorrectVote failed for ${address}`, err)
      );
    }
  }

  addBonusPoints(address: string, points: number, reason: string): void {
    const season = this.getCurrentSeason();
    if (!season) return;

    const stats = this.ensurePlayer(season, address);
    stats.points += points;
    this.persist(season);

    this.emit("bonusPoints", season.id, address, points, reason);
    seasonLogger.info(`Bonus points: ${address} +${points} (${reason})`);
  }

  // -----------------------------------------------------------------------
  // Rankings
  // -----------------------------------------------------------------------

  getLeaderboard(seasonId: string, count: number = 20): SeasonPlayerStats[] {
    const season = this.seasons.get(seasonId);
    if (!season) return [];

    return Array.from(season.players.values())
      .sort((a, b) => b.points - a.points)
      .slice(0, count);
  }

  getPlayerStats(seasonId: string, address: string): SeasonPlayerStats | null {
    const season = this.seasons.get(seasonId);
    if (!season) return null;
    return season.players.get(address.toLowerCase()) || null;
  }

  getPlayerRank(seasonId: string, address: string): number {
    const leaderboard = this.getLeaderboard(seasonId, 999);
    const idx = leaderboard.findIndex((p) => p.address === address.toLowerCase());
    return idx >= 0 ? idx + 1 : -1;
  }

  // -----------------------------------------------------------------------
  // Getters
  // -----------------------------------------------------------------------

  getSeason(id: string): SeasonData | undefined {
    return this.seasons.get(id);
  }

  getAllSeasons(): SeasonData[] {
    return Array.from(this.seasons.values());
  }

  getState(seasonId: string): object | null {
    const s = this.seasons.get(seasonId);
    if (!s) return null;

    return {
      id: s.id,
      onChainId: s.onChainId !== null ? s.onChainId.toString() : null,
      name: s.name,
      startTime: s.startTime,
      endTime: s.endTime,
      status: s.status,
      topRewardSlots: s.topRewardSlots,
      participantCount: s.players.size,
      leaderboard: this.getLeaderboard(seasonId, 20),
      createdAt: s.createdAt,
    };
  }

  // -----------------------------------------------------------------------
  // Internal
  // -----------------------------------------------------------------------

  private ensurePlayer(season: SeasonData, address: string): SeasonPlayerStats {
    const normalized = address.toLowerCase();
    if (!season.players.has(normalized)) {
      season.players.set(normalized, {
        address: normalized,
        gamesPlayed: 0,
        gamesWon: 0,
        tournamentsWon: 0,
        correctVotes: 0,
        points: 0,
      });
    }
    return season.players.get(normalized)!;
  }
}

export const seasonTracker = new SeasonTracker();
