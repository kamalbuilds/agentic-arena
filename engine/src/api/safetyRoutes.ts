/**
 * Safety Guardrails API Routes
 *
 * Exposes the agent safety and spending control system via REST.
 * Safety scores 20% of Synthesis hackathon judging weight.
 *
 * GET  /api/safety/dashboard       - Full safety dashboard data
 * GET  /api/safety/audit           - Recent audit trail
 * POST /api/safety/check           - Pre-check a transaction
 * POST /api/safety/approve/:id     - Approve a pending transaction
 * POST /api/safety/deny/:id        - Deny a pending transaction
 * POST /api/safety/limits          - Update global spending limits
 * POST /api/safety/emergency-stop  - Toggle emergency stop
 * POST /api/safety/agent/:name/block - Block/unblock an agent
 * POST /api/safety/agent/:name/reset - Reset game spending for agent
 */

import { Router, type Request, type Response } from "express";
import {
  getSafetyDashboard,
  checkTransaction,
  recordTransaction,
  approveTransaction,
  denyTransaction,
  updateLimits,
  setEmergencyStop,
  setAgentBlocked,
  resetGameSpending,
  type SpendingLimits,
} from "../agents/SafetyGuardrails.js";
import { logger } from "../utils/logger.js";

const log = logger.child("SafetyAPI");
export const safetyRouter = Router();

// GET /api/safety/dashboard - Full safety dashboard
safetyRouter.get("/api/safety/dashboard", (_req: Request, res: Response) => {
  const dashboard = getSafetyDashboard();
  res.json(dashboard);
});

// GET /api/safety/audit - Recent audit trail with optional filters
safetyRouter.get("/api/safety/audit", (req: Request, res: Response) => {
  const dashboard = getSafetyDashboard();
  const { agent, action, blocked } = req.query;

  let entries = dashboard.recentAudit;

  if (agent) {
    entries = entries.filter(
      (e) => e.agentName.toLowerCase() === (agent as string).toLowerCase()
    );
  }
  if (action) {
    entries = entries.filter((e) => e.action === action);
  }
  if (blocked !== undefined) {
    const isBlocked = blocked === "true";
    entries = entries.filter((e) => (e.blocked ?? false) === isBlocked);
  }

  res.json({
    entries,
    total: entries.length,
    stats: dashboard.stats,
  });
});

// POST /api/safety/check - Pre-check a transaction against limits
safetyRouter.post("/api/safety/check", (req: Request, res: Response) => {
  const { agentName, action, amountUSDC } = req.body;

  if (!agentName || !action || amountUSDC === undefined) {
    res.status(400).json({
      error: "Missing required fields: agentName, action, amountUSDC",
    });
    return;
  }

  const result = checkTransaction({
    agentName,
    action,
    amountUSDC: parseFloat(amountUSDC),
  });

  res.json(result);
});

// POST /api/safety/record - Record a completed transaction
safetyRouter.post("/api/safety/record", (req: Request, res: Response) => {
  const { agentName, action, amount, asset, txHash, blocked, blockReason } =
    req.body;

  if (!agentName || !action || !amount || !asset) {
    res.status(400).json({
      error: "Missing required fields: agentName, action, amount, asset",
    });
    return;
  }

  recordTransaction({
    agentName,
    action,
    amount,
    asset,
    txHash,
    blocked,
    blockReason,
  });

  res.json({ recorded: true });
});

// POST /api/safety/approve/:id - Approve a pending transaction
safetyRouter.post(
  "/api/safety/approve/:id",
  (req: Request, res: Response) => {
    const approved = approveTransaction(req.params.id as string);
    if (!approved) {
      res
        .status(404)
        .json({ error: "Approval not found or expired" });
      return;
    }
    log.info(`Transaction ${req.params.id} approved`);
    res.json({ approved: true, approvalId: req.params.id });
  }
);

// POST /api/safety/deny/:id - Deny a pending transaction
safetyRouter.post("/api/safety/deny/:id", (req: Request, res: Response) => {
  const denied = denyTransaction(req.params.id as string);
  if (!denied) {
    res
      .status(404)
      .json({ error: "Approval not found or expired" });
    return;
  }
  log.info(`Transaction ${req.params.id} denied`);
  res.json({ denied: true, approvalId: req.params.id });
});

// POST /api/safety/limits - Update global spending limits
safetyRouter.post("/api/safety/limits", (req: Request, res: Response) => {
  const updates: Partial<SpendingLimits> = {};

  if (req.body.maxPerTransaction !== undefined)
    updates.maxPerTransaction = parseFloat(req.body.maxPerTransaction);
  if (req.body.maxPerGame !== undefined)
    updates.maxPerGame = parseFloat(req.body.maxPerGame);
  if (req.body.maxDaily !== undefined)
    updates.maxDaily = parseFloat(req.body.maxDaily);
  if (req.body.maxTradesPerGame !== undefined)
    updates.maxTradesPerGame = parseInt(req.body.maxTradesPerGame);
  if (req.body.requireApprovalAbove !== undefined)
    updates.requireApprovalAbove = parseFloat(req.body.requireApprovalAbove);

  if (Object.keys(updates).length === 0) {
    res.status(400).json({ error: "No valid limit fields provided" });
    return;
  }

  const newLimits = updateLimits(updates);
  log.info(`Limits updated: ${JSON.stringify(newLimits)}`);
  res.json({ limits: newLimits });
});

// POST /api/safety/emergency-stop - Toggle emergency stop
safetyRouter.post(
  "/api/safety/emergency-stop",
  (req: Request, res: Response) => {
    const active =
      req.body.active !== undefined ? Boolean(req.body.active) : true;
    setEmergencyStop(active);
    log.warn(`Emergency stop ${active ? "ACTIVATED" : "deactivated"}`);
    res.json({ emergencyStop: active });
  }
);

// POST /api/safety/agent/:name/block - Block/unblock an agent
safetyRouter.post(
  "/api/safety/agent/:name/block",
  (req: Request, res: Response) => {
    const blocked =
      req.body.blocked !== undefined ? Boolean(req.body.blocked) : true;
    const reason = req.body.reason || "Manual block via API";
    setAgentBlocked(req.params.name as string, blocked, reason);
    res.json({
      agentName: req.params.name,
      blocked,
      reason,
    });
  }
);

// POST /api/safety/agent/:name/reset - Reset game spending
safetyRouter.post(
  "/api/safety/agent/:name/reset",
  (req: Request, res: Response) => {
    resetGameSpending(req.params.name as string);
    res.json({
      agentName: req.params.name,
      reset: true,
    });
  }
);
