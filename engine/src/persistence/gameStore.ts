import { getPool } from "./db.js";
import { GameRoom, GameResult } from "../game/GameRoom.js";
import { Role } from "../game/RoleAssigner.js";
import { getVoteHistory } from "../game/VoteResolver.js";
import { logger } from "../utils/logger.js";

const storeLogger = logger.child("GameStore");

// ─── Types ──────────────────────────────────────────────────────────────────

export interface StoredGame {
  gameId: string;
  chainGameId: string | null;
  result: number;
  roundNumber: number;
  maxRounds: number;
  maxPlayers: number;
  stakePerPlayer: string;
  players: Array<{
    address: string;
    name: string;
    alive: boolean;
    role: string;
  }>;
  eliminations: Array<{
    address: string;
    name: string;
    role: string;
    round: number;
  }>;
  voteHistory: unknown[];
  messages: unknown[];
  createdAt: number;
  endedAt: string;
}

export interface DbLeaderboardEntry {
  rank: number;
  address: string;
  name: string;
  elo: number;
  gamesPlayed: number;
  wins: number;
  winRate: number;
  impostorWinRate: number;
  earnings: string;
}

// ─── Save a completed game ──────────────────────────────────────────────────

export async function saveCompletedGame(room: GameRoom): Promise<void> {
  const pool = getPool();
  if (!pool) return;

  try {
    const state = room.getState();

    // Build players with roles always revealed (game is over)
    const playersWithRoles = Array.from(room.players.values()).map((p) => ({
      address: p.address,
      name: p.name,
      alive: p.alive,
      role: p.role === Role.Impostor ? "Impostor" : "Crewmate",
    }));

    await pool.query(
      `INSERT INTO completed_games
         (game_id, chain_game_id, result, round_number, max_rounds,
          max_players, stake_per_player, players, eliminations,
          vote_history, messages)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       ON CONFLICT (game_id) DO NOTHING`,
      [
        room.gameId,
        state.chainGameId,
        room.result,
        room.roundNumber,
        room.maxRounds,
        state.maxPlayers,
        state.stakePerPlayer,
        JSON.stringify(playersWithRoles),
        JSON.stringify(room.eliminations),
        JSON.stringify(getVoteHistory(room.gameId)),
        JSON.stringify(room.messages),
      ]
    );

    storeLogger.info(`Saved completed game ${room.gameId} to DB`);

    // Upsert agent stats for all players
    await updateAgentStats(room);
  } catch (err) {
    storeLogger.error(
      `Failed to save game ${room.gameId}`,
      err instanceof Error ? err.message : err
    );
  }
}

// ─── Upsert per-player stats ────────────────────────────────────────────────

async function updateAgentStats(room: GameRoom): Promise<void> {
  const pool = getPool();
  if (!pool) return;

  const winners = new Set(
    room.getWinners().map((a) => a.toLowerCase())
  );

  for (const player of room.players.values()) {
    const isWinner = winners.has(player.address.toLowerCase());
    const isImpostor = player.role === Role.Impostor;

    try {
      await pool.query(
        `INSERT INTO agent_stats
           (address, name, games_played, wins, impostor_games, impostor_wins, elo)
         VALUES ($1, $2, 1, $3, $4, $5, $6)
         ON CONFLICT (address) DO UPDATE SET
           name           = EXCLUDED.name,
           games_played   = agent_stats.games_played + 1,
           wins           = agent_stats.wins + $3,
           impostor_games = agent_stats.impostor_games + $4,
           impostor_wins  = agent_stats.impostor_wins + $5,
           elo            = agent_stats.elo + $7,
           updated_at     = now()`,
        [
          player.address.toLowerCase(),
          player.name,
          isWinner ? 1 : 0,         // $3: wins increment
          isImpostor ? 1 : 0,        // $4: impostor_games increment
          isImpostor && isWinner ? 1 : 0,  // $5: impostor_wins increment
          1000 + (isWinner ? 25 : 0),      // $6: initial ELO for INSERT
          isWinner ? 25 : -10,             // $7: ELO delta for UPDATE
        ]
      );
    } catch (err) {
      storeLogger.error(
        `Failed to update stats for ${player.name}`,
        err instanceof Error ? err.message : err
      );
    }
  }
}

// ─── Load completed games on startup ────────────────────────────────────────

export async function loadCompletedGames(): Promise<StoredGame[]> {
  const pool = getPool();
  if (!pool) return [];

  try {
    const { rows } = await pool.query(
      `SELECT game_id, chain_game_id, result, round_number, max_rounds,
              max_players, stake_per_player, players, eliminations,
              vote_history, messages, created_at, ended_at
       FROM completed_games
       ORDER BY ended_at DESC
       LIMIT 200`
    );

    storeLogger.info(`Loaded ${rows.length} completed games from DB`);

    return rows.map((row: Record<string, unknown>) => ({
      gameId: row.game_id as string,
      chainGameId: row.chain_game_id as string | null,
      result: row.result as number,
      roundNumber: row.round_number as number,
      maxRounds: row.max_rounds as number,
      maxPlayers: row.max_players as number,
      stakePerPlayer: row.stake_per_player as string,
      players: row.players as StoredGame["players"],
      eliminations: row.eliminations as StoredGame["eliminations"],
      voteHistory: row.vote_history as unknown[],
      messages: row.messages as unknown[],
      createdAt: Number(row.created_at),
      endedAt: String(row.ended_at),
    }));
  } catch (err) {
    storeLogger.error(
      "Failed to load completed games",
      err instanceof Error ? err.message : err
    );
    return [];
  }
}

// ─── Leaderboard from DB ────────────────────────────────────────────────────

export async function getDbLeaderboard(): Promise<DbLeaderboardEntry[] | null> {
  const pool = getPool();
  if (!pool) return null;

  try {
    const { rows } = await pool.query(
      `SELECT address, name, games_played, wins, impostor_games, impostor_wins, elo
       FROM agent_stats
       WHERE games_played > 0
       ORDER BY wins DESC, elo DESC
       LIMIT 20`
    );

    return rows.map((row: Record<string, unknown>, i: number) => ({
      rank: i + 1,
      address: row.address as string,
      name: row.name as string,
      elo: row.elo as number,
      gamesPlayed: row.games_played as number,
      wins: row.wins as number,
      winRate:
        (row.games_played as number) > 0
          ? Math.round(((row.wins as number) / (row.games_played as number)) * 100)
          : 0,
      impostorWinRate:
        (row.impostor_games as number) > 0
          ? Math.round(((row.impostor_wins as number) / (row.impostor_games as number)) * 100)
          : 0,
      earnings: "0.0000",
    }));
  } catch (err) {
    storeLogger.error(
      "Failed to get leaderboard from DB",
      err instanceof Error ? err.message : err
    );
    return null;
  }
}
