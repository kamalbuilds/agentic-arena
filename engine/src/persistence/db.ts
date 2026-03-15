import pg from "pg";
import { config } from "../config.js";
import { logger } from "../utils/logger.js";

const dbLogger = logger.child("DB");

let pool: pg.Pool | null = null;

export function getPool(): pg.Pool | null {
  return pool;
}

export function isDbEnabled(): boolean {
  return pool !== null;
}

const MIGRATION_SQL = `
  CREATE TABLE IF NOT EXISTS completed_games (
    game_id          TEXT        PRIMARY KEY,
    chain_game_id    TEXT,
    result           SMALLINT    NOT NULL,
    round_number     SMALLINT    NOT NULL,
    max_rounds       SMALLINT    NOT NULL,
    max_players      SMALLINT    NOT NULL,
    stake_per_player TEXT        NOT NULL,
    players          JSONB       NOT NULL,
    eliminations     JSONB       NOT NULL,
    vote_history     JSONB       NOT NULL,
    messages         JSONB       NOT NULL,
    created_at       BIGINT      NOT NULL DEFAULT (EXTRACT(EPOCH FROM now()) * 1000)::BIGINT,
    ended_at         TIMESTAMPTZ NOT NULL DEFAULT now()
  );

  CREATE TABLE IF NOT EXISTS agent_stats (
    address        TEXT        PRIMARY KEY,
    name           TEXT        NOT NULL,
    games_played   INT         NOT NULL DEFAULT 0,
    wins           INT         NOT NULL DEFAULT 0,
    impostor_games INT         NOT NULL DEFAULT 0,
    impostor_wins  INT         NOT NULL DEFAULT 0,
    elo            INT         NOT NULL DEFAULT 1000,
    updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
  );

  CREATE INDEX IF NOT EXISTS idx_agent_stats_wins
    ON agent_stats (wins DESC);

  CREATE INDEX IF NOT EXISTS idx_completed_games_ended
    ON completed_games (ended_at DESC);

  -- Colosseum: Tournaments
  CREATE TABLE IF NOT EXISTS tournaments (
    id               TEXT        PRIMARY KEY,
    on_chain_id      TEXT,
    name             TEXT        NOT NULL,
    entry_fee        TEXT        NOT NULL DEFAULT '0',
    prize_pool       TEXT        NOT NULL DEFAULT '0',
    max_participants SMALLINT    NOT NULL,
    current_round    SMALLINT    NOT NULL DEFAULT 0,
    total_rounds     SMALLINT    NOT NULL,
    status           TEXT        NOT NULL DEFAULT 'Registration',
    registration_deadline BIGINT NOT NULL,
    arena_type       SMALLINT    NOT NULL DEFAULT 0,
    participants     JSONB       NOT NULL DEFAULT '[]',
    brackets         JSONB       NOT NULL DEFAULT '{}',
    placements       JSONB       NOT NULL DEFAULT '{}',
    created_at       BIGINT      NOT NULL DEFAULT (EXTRACT(EPOCH FROM now()) * 1000)::BIGINT,
    updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
  );

  CREATE INDEX IF NOT EXISTS idx_tournaments_status
    ON tournaments (status);

  -- Colosseum: Seasons
  CREATE TABLE IF NOT EXISTS seasons (
    id              TEXT        PRIMARY KEY,
    on_chain_id     TEXT,
    name            TEXT        NOT NULL,
    start_time      BIGINT      NOT NULL,
    end_time        BIGINT      NOT NULL,
    status          TEXT        NOT NULL DEFAULT 'Upcoming',
    top_reward_slots SMALLINT   NOT NULL DEFAULT 10,
    player_stats    JSONB       NOT NULL DEFAULT '{}',
    created_at      BIGINT      NOT NULL DEFAULT (EXTRACT(EPOCH FROM now()) * 1000)::BIGINT,
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
  );

  CREATE INDEX IF NOT EXISTS idx_seasons_status
    ON seasons (status);

  -- Colosseum: Bets (for analytics)
  CREATE TABLE IF NOT EXISTS bets (
    id              SERIAL      PRIMARY KEY,
    game_id         TEXT        NOT NULL,
    bettor          TEXT        NOT NULL,
    bet_type        SMALLINT    NOT NULL,
    predicted_agent TEXT,
    amount          TEXT        NOT NULL,
    settled         BOOLEAN     NOT NULL DEFAULT false,
    won             BOOLEAN,
    payout          TEXT,
    chain_tx_hash   TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
  );

  CREATE INDEX IF NOT EXISTS idx_bets_game
    ON bets (game_id);

  CREATE INDEX IF NOT EXISTS idx_bets_bettor
    ON bets (bettor);

  -- Colosseum: Arena stats
  CREATE TABLE IF NOT EXISTS arenas (
    id              SMALLINT    PRIMARY KEY,
    name            TEXT        NOT NULL,
    description     TEXT        NOT NULL DEFAULT '',
    min_players     SMALLINT    NOT NULL,
    max_players     SMALLINT    NOT NULL,
    default_stake   TEXT        NOT NULL DEFAULT '0',
    active          BOOLEAN     NOT NULL DEFAULT true,
    games_played    INT         NOT NULL DEFAULT 0,
    total_volume    TEXT        NOT NULL DEFAULT '0',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
  );
`;

export async function initDb(): Promise<void> {
  if (!config.database.url) {
    dbLogger.warn("DATABASE_URL not set — running in memory-only mode");
    return;
  }

  try {
    pool = new pg.Pool({
      connectionString: config.database.url,
      max: 5,
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 5_000,
      ssl: config.database.url.includes("localhost") ? false : { rejectUnauthorized: false },
    });

    const client = await pool.connect();
    await client.query(MIGRATION_SQL);
    client.release();

    dbLogger.info("PostgreSQL connected and schema migrated");
  } catch (err) {
    dbLogger.error("Failed to connect to PostgreSQL — falling back to memory-only", err);
    pool = null;
  }
}

export async function closeDb(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
    dbLogger.info("PostgreSQL pool closed");
  }
}
