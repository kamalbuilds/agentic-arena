/**
 * Autonomous Game API routes
 *
 * Endpoints for launching, monitoring, and stopping fully autonomous
 * agent games. This is the primary demo surface for the Synthesis hackathon.
 *
 * POST /api/autonomous/start   - Launch autonomous game session
 * POST /api/autonomous/stop    - Stop the orchestrator
 * GET  /api/autonomous/status  - Current state + agent logs
 * GET  /api/autonomous/logs    - Full action logs for all agents
 */

import { Router, type Request, type Response } from "express";
import {
  createOrchestrator,
  getOrchestrator,
} from "../agents/GameOrchestrator.js";
import { startDemo, getDemoState, stopDemo } from "../agents/DemoSimulation.js";
import { config } from "../config.js";
import { logger } from "../utils/logger.js";

const log = logger.child("AutonomousAPI");
export const autonomousRouter = Router();

// POST /api/autonomous/start
autonomousRouter.post("/api/autonomous/start", async (req: Request, res: Response) => {
  try {
    const existing = getOrchestrator();
    if (existing?.getStatus().running) {
      res.status(409).json({
        error: "Orchestrator already running",
        status: existing.getStatus(),
      });
      return;
    }

    const {
      agentCount = 6,
      gamesPerSession = 3,
      delayBetweenGamesMs = 5000,
    } = req.body;

    const serverUrl = `http://localhost:${config.server.port}`;

    const orchestrator = createOrchestrator({
      serverUrl,
      agentCount: Math.min(Math.max(agentCount, 3), 8),
      anthropicApiKey: process.env.ANTHROPIC_API_KEY,
      gamesPerSession: Math.min(gamesPerSession, 10),
      delayBetweenGamesMs,
    });

    // Start in background (non-blocking)
    orchestrator.start().catch((err) => {
      log.error("Orchestrator crashed", err);
    });

    // Give it a moment to initialize
    await new Promise((r) => setTimeout(r, 500));

    log.info(`Autonomous session started: ${agentCount} agents, ${gamesPerSession} games`);

    res.status(201).json({
      message: "Autonomous game session started",
      status: orchestrator.getStatus(),
    });
  } catch (err) {
    log.error("Failed to start autonomous session", err);
    const message = err instanceof Error ? err.message : "Unknown error";
    res.status(500).json({ error: message });
  }
});

// POST /api/autonomous/stop
autonomousRouter.post("/api/autonomous/stop", (_req: Request, res: Response) => {
  const orchestrator = getOrchestrator();
  if (!orchestrator) {
    res.status(404).json({ error: "No orchestrator instance found" });
    return;
  }

  orchestrator.stop();
  log.info("Autonomous session stopped");

  res.json({
    message: "Orchestrator stopping",
    status: orchestrator.getStatus(),
  });
});

// GET /api/autonomous/status
autonomousRouter.get("/api/autonomous/status", (_req: Request, res: Response) => {
  const orchestrator = getOrchestrator();
  if (!orchestrator) {
    res.json({
      running: false,
      gamesPlayed: 0,
      agents: [],
      gameResults: [],
    });
    return;
  }

  res.json(orchestrator.getStatus());
});

// GET /api/autonomous/logs
autonomousRouter.get("/api/autonomous/logs", (_req: Request, res: Response) => {
  const orchestrator = getOrchestrator();
  if (!orchestrator) {
    res.json({ logs: {} });
    return;
  }

  res.json({ logs: orchestrator.getFullLogs() });
});

// ─── Demo Simulation Endpoints ───

// POST /api/autonomous/demo/start - Start a compressed demo game
autonomousRouter.post("/api/autonomous/demo/start", async (_req: Request, res: Response) => {
  try {
    const serverUrl = `http://localhost:${config.server.port}`;
    const state = getDemoState();

    if (state?.running) {
      res.status(409).json({ error: "Demo already running", state });
      return;
    }

    // Start demo in background
    startDemo(serverUrl).catch((err) => {
      log.error("Demo simulation failed", err);
    });

    // Give it a moment to initialize agents
    await new Promise((r) => setTimeout(r, 1000));

    log.info("Demo simulation started");
    res.status(201).json({
      message: "Demo simulation started",
      state: getDemoState(),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    res.status(500).json({ error: message });
  }
});

// GET /api/autonomous/demo/status - Get demo state + events
autonomousRouter.get("/api/autonomous/demo/status", (_req: Request, res: Response) => {
  const state = getDemoState();
  if (!state) {
    res.json({ running: false, events: [], agents: [] });
    return;
  }
  res.json(state);
});

// POST /api/autonomous/demo/stop - Stop the demo
autonomousRouter.post("/api/autonomous/demo/stop", (_req: Request, res: Response) => {
  stopDemo();
  res.json({ message: "Demo stopped", state: getDemoState() });
});
