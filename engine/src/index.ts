import express from "express";
import cors from "cors";
import http from "node:http";
import { config } from "./config.js";
import { router } from "./api/routes.js";
import { tournamentRouter } from "./api/tournamentRoutes.js";
import { uniswapRouter } from "./api/uniswapRoutes.js";
import { locusRouter } from "./api/locusRoutes.js";
import { x402Router } from "./api/x402Routes.js";
import { agentRouter } from "./api/agentRoutes.js";
import { autonomousRouter } from "./api/autonomousRoutes.js";
import { serviceMarketRouter } from "./api/serviceMarketRoutes.js";
import { conversationLogRouter } from "./api/conversationLogRoutes.js";
import { safetyRouter } from "./api/safetyRoutes.js";
import { arenaRouter } from "./api/arenaRoutes.js";
import { recordSystemEvent } from "./api/conversationLogRoutes.js";
import { createWebSocketServer, getConnectedClients } from "./ws/server.js";
import { gameManager } from "./game/GameManager.js";
import { tournamentManager } from "./game/TournamentManager.js";
import { seasonTracker } from "./game/SeasonTracker.js";
import { arenaFramework } from "./game/ArenaFramework.js";
import { logger } from "./utils/logger.js";
import { initDb, closeDb } from "./persistence/db.js";
import { logErc8004Status } from "./chain/erc8004.js";
import { listAgentWallets } from "./chain/agentkit-wallet.js";

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Request logging
app.use((req, _res, next) => {
  if (req.path !== "/api/health") {
    logger.debug(`${req.method} ${req.path}`);
  }
  next();
});

// Mount API routes
app.use(router);
app.use(tournamentRouter);
app.use(uniswapRouter);
app.use(locusRouter);
app.use(x402Router);
app.use(agentRouter);
app.use(autonomousRouter);
app.use(serviceMarketRouter);
app.use(conversationLogRouter);
app.use(safetyRouter);
app.use(arenaRouter);

// 404 handler
app.use((_req, res) => {
  res.status(404).json({ error: "Not found" });
});

// Error handler
app.use(
  (
    err: Error,
    _req: express.Request,
    res: express.Response,
    _next: express.NextFunction
  ) => {
    logger.error("Unhandled error", err);
    res.status(500).json({ error: "Internal server error" });
  }
);

// Create HTTP server (shared for Express + WebSocket)
const server = http.createServer(app);

// Attach WebSocket server
const wss = createWebSocketServer(server);

// Initialize database and start server
async function start(): Promise<void> {
  // Initialize PostgreSQL (graceful — falls back to memory-only if unavailable)
  await initDb();

  // Load persisted Colosseum state from DB
  await Promise.all([
    tournamentManager.loadFromDb(),
    seasonTracker.loadFromDb(),
    arenaFramework.loadFromDb(),
  ]);

  await gameManager.initialize();

  server.listen(config.server.port, () => {
    logger.info(`Claw Wars Engine started`);
    logger.info(`  HTTP API: http://localhost:${config.server.port}`);
    logger.info(`  WebSocket: ws://localhost:${config.server.port}`);
    logger.info(`  Base RPC: ${config.base.rpcUrl}`);
    logger.info(`  Chain ID: ${config.base.chainId}`);

    if (config.database.url) {
      logger.info("  Database: PostgreSQL connected");
    } else {
      logger.warn("  Database: Not configured (memory-only mode)");
    }

    if (config.contracts.game) {
      logger.info(`  Game Contract: ${config.contracts.game}`);
    } else {
      logger.warn("  Game contract not configured (off-chain mode)");
    }

    if (config.contracts.betting) {
      logger.info(`  Betting Contract: ${config.contracts.betting}`);
    }

    if (config.contracts.leaderboard) {
      logger.info(`  Leaderboard Contract: ${config.contracts.leaderboard}`);
    }

    if (config.moltbook.apiKey) {
      logger.info("  Moltbook: Connected");
    } else {
      logger.warn("  Moltbook: Not configured");
    }

    // ERC-8004 Agent Identity
    logErc8004Status();

    // Uniswap Trading API
    if (config.uniswap.apiKey) {
      logger.info("  Uniswap: Trading API configured");
    } else {
      logger.warn("  Uniswap: Not configured (set UNISWAP_API_KEY)");
    }

    // Locus Payments
    if (config.locus.apiKey) {
      logger.info("  Locus: Payment API configured");
    } else {
      logger.warn("  Locus: Not configured (set LOCUS_API_KEY or register via /api/locus/register)");
    }

    // x402 Payment Protocol
    logger.info("  x402: Payment protocol active (USDC on Base via Locus)");

    // Coinbase AgentKit
    if (config.cdp.apiKeyId) {
      logger.info("  AgentKit: CDP Server Wallets enabled");
    } else {
      logger.info("  AgentKit: Local wallet derivation (set CDP_API_KEY_ID for CDP wallets)");
    }

    // Multi-Arena Colosseum
    const arenas = arenaFramework.getAllArenas();
    logger.info(`  Arenas: ${arenas.length} registered (${arenas.map(a => a.name).join(", ")})`);
    logger.info("  Arena API: GET /api/arenas for all arena types and state");

    // Autonomous Game System
    logger.info("  Autonomous: POST /api/autonomous/start to launch AI-vs-AI games");

    // Agent Service Market
    logger.info("  Service Market: GET /api/services to browse agent services");

    // Safety Guardrails
    logger.info("  Safety: GET /api/safety/dashboard for spending controls and audit trail");

    // Conversation Log Export
    logger.info("  Conversation Log: GET /api/conversation-log for hackathon submission");

    // Record startup event
    recordSystemEvent("engine_start", `Engine started on port ${config.server.port} (Base chain ${config.base.chainId})`);
  });
}

start().catch((err) => {
  logger.error("Failed to start engine", err);
  process.exit(1);
});

// Graceful shutdown
const shutdown = async () => {
  logger.info("Shutting down...");

  wss.close(() => {
    logger.info("WebSocket server closed");
  });

  server.close(async () => {
    await closeDb();
    logger.info("HTTP server closed");
    process.exit(0);
  });

  // Force exit after 10 seconds
  setTimeout(() => {
    logger.error("Forced shutdown after timeout");
    process.exit(1);
  }, 10000);
};

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

export { app, server };
