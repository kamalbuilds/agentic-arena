import { getPool } from "./db.js";
import { logger } from "../utils/logger.js";
import type { TournamentData, TournamentMatch, TournamentStatus } from "../game/TournamentManager.js";
import type { SeasonData, SeasonStatus, SeasonPlayerStats } from "../game/SeasonTracker.js";
import type { ArenaType } from "../game/ArenaFramework.js";

const storeLogger = logger.child("ColosseumStore");

// ═══════════════════════════════════════════════════════════════════════════
// Tournament Persistence
// ═══════════════════════════════════════════════════════════════════════════

export async function saveTournament(t: TournamentData): Promise<void> {
  const pool = getPool();
  if (!pool) return;

  try {
    const bracketsObj: Record<string, TournamentMatch> = {};
    for (const [key, match] of t.brackets.entries()) {
      bracketsObj[key] = match;
    }

    const placementsObj: Record<string, string> = {};
    for (const [place, addr] of t.placements.entries()) {
      placementsObj[String(place)] = addr;
    }

    await pool.query(
      `INSERT INTO tournaments
         (id, on_chain_id, name, entry_fee, prize_pool, max_participants,
          current_round, total_rounds, status, registration_deadline,
          arena_type, participants, brackets, placements, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, now())
       ON CONFLICT (id) DO UPDATE SET
         on_chain_id = EXCLUDED.on_chain_id,
         prize_pool = EXCLUDED.prize_pool,
         current_round = EXCLUDED.current_round,
         status = EXCLUDED.status,
         participants = EXCLUDED.participants,
         brackets = EXCLUDED.brackets,
         placements = EXCLUDED.placements,
         updated_at = now()`,
      [
        t.id,
        t.onChainId !== null ? t.onChainId.toString() : null,
        t.name,
        t.entryFee.toString(),
        t.prizePool.toString(),
        t.maxParticipants,
        t.currentRound,
        t.totalRounds,
        t.status,
        t.registrationDeadline,
        t.arenaType,
        JSON.stringify(t.participants),
        JSON.stringify(bracketsObj),
        JSON.stringify(placementsObj),
      ]
    );

    storeLogger.info(`Saved tournament ${t.id} (${t.status})`);
  } catch (err) {
    storeLogger.error(`Failed to save tournament ${t.id}`, err instanceof Error ? err.message : err);
  }
}

export async function loadTournaments(): Promise<TournamentData[]> {
  const pool = getPool();
  if (!pool) return [];

  try {
    const { rows } = await pool.query(
      `SELECT * FROM tournaments WHERE status IN ('Registration', 'Active') ORDER BY created_at DESC`
    );

    return rows.map((row: Record<string, unknown>) => {
      const brackets = new Map<string, TournamentMatch>();
      const bracketsObj = row.brackets as Record<string, TournamentMatch>;
      for (const [key, match] of Object.entries(bracketsObj)) {
        brackets.set(key, match);
      }

      const placements = new Map<number, string>();
      const placementsObj = row.placements as Record<string, string>;
      for (const [place, addr] of Object.entries(placementsObj)) {
        placements.set(Number(place), addr);
      }

      return {
        id: row.id as string,
        onChainId: row.on_chain_id ? BigInt(row.on_chain_id as string) : null,
        name: row.name as string,
        entryFee: BigInt(row.entry_fee as string),
        prizePool: BigInt(row.prize_pool as string),
        maxParticipants: row.max_participants as number,
        currentRound: row.current_round as number,
        totalRounds: row.total_rounds as number,
        status: row.status as TournamentStatus,
        registrationDeadline: Number(row.registration_deadline),
        arenaType: row.arena_type as number,
        participants: row.participants as string[],
        brackets,
        placements,
        createdAt: Number(row.created_at),
      } as TournamentData;
    });
  } catch (err) {
    storeLogger.error("Failed to load tournaments", err instanceof Error ? err.message : err);
    return [];
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// Season Persistence
// ═══════════════════════════════════════════════════════════════════════════

export async function saveSeason(s: SeasonData): Promise<void> {
  const pool = getPool();
  if (!pool) return;

  try {
    const playerStatsObj: Record<string, SeasonPlayerStats> = {};
    for (const [addr, stats] of s.players.entries()) {
      playerStatsObj[addr] = stats;
    }

    await pool.query(
      `INSERT INTO seasons
         (id, on_chain_id, name, start_time, end_time, status,
          top_reward_slots, player_stats, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, now())
       ON CONFLICT (id) DO UPDATE SET
         on_chain_id = EXCLUDED.on_chain_id,
         status = EXCLUDED.status,
         player_stats = EXCLUDED.player_stats,
         updated_at = now()`,
      [
        s.id,
        s.onChainId !== null ? s.onChainId.toString() : null,
        s.name,
        s.startTime,
        s.endTime,
        s.status,
        s.topRewardSlots,
        JSON.stringify(playerStatsObj),
      ]
    );

    storeLogger.info(`Saved season ${s.id} (${s.status})`);
  } catch (err) {
    storeLogger.error(`Failed to save season ${s.id}`, err instanceof Error ? err.message : err);
  }
}

export async function loadSeasons(): Promise<SeasonData[]> {
  const pool = getPool();
  if (!pool) return [];

  try {
    const { rows } = await pool.query(
      `SELECT * FROM seasons WHERE status IN ('Upcoming', 'Active') ORDER BY created_at DESC`
    );

    return rows.map((row: Record<string, unknown>) => {
      const players = new Map<string, SeasonPlayerStats>();
      const statsObj = row.player_stats as Record<string, SeasonPlayerStats>;
      for (const [addr, stats] of Object.entries(statsObj)) {
        players.set(addr, stats);
      }

      return {
        id: row.id as string,
        onChainId: row.on_chain_id ? BigInt(row.on_chain_id as string) : null,
        name: row.name as string,
        startTime: Number(row.start_time),
        endTime: Number(row.end_time),
        status: row.status as SeasonStatus,
        topRewardSlots: row.top_reward_slots as number,
        players,
        createdAt: Number(row.created_at),
      } as SeasonData;
    });
  } catch (err) {
    storeLogger.error("Failed to load seasons", err instanceof Error ? err.message : err);
    return [];
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// Bet Persistence (analytics)
// ═══════════════════════════════════════════════════════════════════════════

export async function saveBet(bet: {
  gameId: string;
  bettor: string;
  betType: number;
  predictedAgent: string | null;
  amount: string;
  chainTxHash: string | null;
}): Promise<void> {
  const pool = getPool();
  if (!pool) return;

  try {
    await pool.query(
      `INSERT INTO bets (game_id, bettor, bet_type, predicted_agent, amount, chain_tx_hash)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [bet.gameId, bet.bettor, bet.betType, bet.predictedAgent, bet.amount, bet.chainTxHash]
    );
  } catch (err) {
    storeLogger.error(`Failed to save bet for game ${bet.gameId}`, err instanceof Error ? err.message : err);
  }
}

export async function settleBetInDb(gameId: string, bettor: string, won: boolean, payout: string): Promise<void> {
  const pool = getPool();
  if (!pool) return;

  try {
    await pool.query(
      `UPDATE bets SET settled = true, won = $3, payout = $4 WHERE game_id = $1 AND bettor = $2`,
      [gameId, bettor, won, payout]
    );
  } catch (err) {
    storeLogger.error(`Failed to settle bet for ${bettor} in game ${gameId}`, err instanceof Error ? err.message : err);
  }
}

export async function getBettingAnalytics(): Promise<{
  totalBets: number;
  totalVolume: string;
  totalPayout: string;
  uniqueBettors: number;
} | null> {
  const pool = getPool();
  if (!pool) return null;

  try {
    const { rows } = await pool.query(
      `SELECT
         COUNT(*) as total_bets,
         COALESCE(SUM(CAST(amount AS NUMERIC)), 0) as total_volume,
         COALESCE(SUM(CASE WHEN settled AND won THEN CAST(payout AS NUMERIC) ELSE 0 END), 0) as total_payout,
         COUNT(DISTINCT bettor) as unique_bettors
       FROM bets`
    );

    const row = rows[0];
    return {
      totalBets: Number(row.total_bets),
      totalVolume: String(row.total_volume),
      totalPayout: String(row.total_payout),
      uniqueBettors: Number(row.unique_bettors),
    };
  } catch (err) {
    storeLogger.error("Failed to get betting analytics", err instanceof Error ? err.message : err);
    return null;
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// Arena Persistence
// ═══════════════════════════════════════════════════════════════════════════

export async function saveArena(arena: ArenaType): Promise<void> {
  const pool = getPool();
  if (!pool) return;

  try {
    await pool.query(
      `INSERT INTO arenas (id, name, description, min_players, max_players, default_stake, active, games_played, total_volume)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       ON CONFLICT (id) DO UPDATE SET
         active = EXCLUDED.active,
         games_played = EXCLUDED.games_played,
         total_volume = EXCLUDED.total_volume`,
      [
        arena.id,
        arena.name,
        arena.description,
        arena.minPlayers,
        arena.maxPlayers,
        arena.defaultStake.toString(),
        arena.active,
        arena.gamesPlayed,
        arena.totalVolume.toString(),
      ]
    );
  } catch (err) {
    storeLogger.error(`Failed to save arena ${arena.id}`, err instanceof Error ? err.message : err);
  }
}

export async function loadArenas(): Promise<ArenaType[]> {
  const pool = getPool();
  if (!pool) return [];

  try {
    const { rows } = await pool.query(`SELECT * FROM arenas ORDER BY id`);

    return rows.map((row: Record<string, unknown>) => ({
      id: row.id as number,
      name: row.name as string,
      description: row.description as string,
      minPlayers: row.min_players as number,
      maxPlayers: row.max_players as number,
      defaultStake: BigInt(row.default_stake as string),
      active: row.active as boolean,
      gamesPlayed: row.games_played as number,
      totalVolume: BigInt(row.total_volume as string),
      createdAt: new Date(row.created_at as string).getTime(),
    }));
  } catch (err) {
    storeLogger.error("Failed to load arenas", err instanceof Error ? err.message : err);
    return [];
  }
}
