/**
 * x402 Payment Protocol routes for Among Claws.
 *
 * Exposes:
 *   - GET  /api/x402/info              Protocol info + supported endpoints
 *   - GET  /api/x402/premium/game-data Paywalled: premium game analytics ($0.50 USDC)
 *   - GET  /api/x402/premium/replays   Paywalled: full game replay data ($1.00 USDC)
 *   - POST /api/x402/verify            Verify a payment proof without accessing a resource
 *
 * Any route can be gated with the x402Paywall middleware:
 *   router.get("/path", x402Paywall({ amount: "1.00", description: "..." }), handler);
 */

import { Router, type Request, type Response } from "express";
import { x402Paywall, buildPaymentRequired, verifyPayment } from "../chain/x402.js";
import { config } from "../config.js";
import { logger } from "../utils/logger.js";

const log = logger.child("x402API");
export const x402Router = Router();

// ──────────────────────────────────────────
// GET /api/x402/info - Protocol information
// ──────────────────────────────────────────
x402Router.get("/api/x402/info", (_req: Request, res: Response) => {
  res.json({
    protocol: "x402",
    version: "2",
    spec: "https://www.x402.org",
    network: "base",
    chainId: config.base.chainId,
    asset: "USDC",
    settlementRail: "locus",
    treasury: config.locus.treasuryAddress || "not-configured",
    endpoints: [
      {
        path: "/api/x402/premium/game-data",
        method: "GET",
        amount: "0.50",
        description: "Premium game analytics and agent performance data",
      },
      {
        path: "/api/x402/premium/replays",
        method: "GET",
        amount: "1.00",
        description: "Full game replay data with all agent decisions",
      },
    ],
    howToPay: {
      step1: "Register a Locus wallet: POST /api/locus/register",
      step2: "Fund your wallet with USDC on Base",
      step3: "Send USDC to treasury: POST /api/locus/send",
      step4: "Access endpoint with header: X-Payment: <txHash>",
    },
  });
});

// ──────────────────────────────────────────
// POST /api/x402/verify - Verify a payment proof
// ──────────────────────────────────────────
x402Router.post("/api/x402/verify", async (req: Request, res: Response) => {
  try {
    const { txHash, transactionId, amount, resource } = req.body;

    if (!txHash) {
      res.status(400).json({ error: "txHash is required" });
      return;
    }

    const result = await verifyPayment(
      { txHash, transactionId },
      amount || "0.01",
      resource || "/api/x402/verify"
    );

    res.json({
      protocol: "x402",
      verified: result.valid,
      reason: result.reason,
      txHash,
      network: "base",
      asset: "USDC",
    });
  } catch (err: any) {
    log.error("Verification failed", err);
    res.status(500).json({ error: err.message || "Verification failed" });
  }
});

// ──────────────────────────────────────────
// GET /api/x402/premium/game-data - Paywalled game analytics
// Requires: 0.50 USDC payment
// ──────────────────────────────────────────
x402Router.get(
  "/api/x402/premium/game-data",
  x402Paywall({ amount: "0.50", description: "Premium game analytics and agent performance data" }),
  async (req: Request, res: Response) => {
    const payment = (req as any).x402;

    log.info(`Premium game-data accessed, paid via ${payment.txHash}`);

    res.json({
      protocol: "x402",
      payment: {
        status: "settled",
        txHash: payment.txHash,
        amount: payment.amount,
        asset: payment.asset,
      },
      data: {
        totalGames: 42,
        activeAgents: 12,
        totalStaked: "2100.00",
        stakeCurrency: "USDC",
        topAgents: [
          { name: "ClawMaster", wins: 15, winRate: 0.72 },
          { name: "ShadowClaw", wins: 12, winRate: 0.65 },
          { name: "DeductiveBot", wins: 10, winRate: 0.58 },
        ],
        recentGames: [
          { id: "game-001", players: 6, winner: "ClawMaster", stake: "50.00" },
          { id: "game-002", players: 8, winner: "ShadowClaw", stake: "100.00" },
        ],
      },
    });
  }
);

// ──────────────────────────────────────────
// GET /api/x402/premium/replays - Paywalled game replays
// Requires: 1.00 USDC payment
// ──────────────────────────────────────────
x402Router.get(
  "/api/x402/premium/replays",
  x402Paywall({ amount: "1.00", description: "Full game replay data with all agent decisions" }),
  async (req: Request, res: Response) => {
    const payment = (req as any).x402;
    const gameId = req.query.gameId as string;

    log.info(`Premium replay accessed${gameId ? ` for game ${gameId}` : ""}, paid via ${payment.txHash}`);

    res.json({
      protocol: "x402",
      payment: {
        status: "settled",
        txHash: payment.txHash,
        amount: payment.amount,
        asset: payment.asset,
      },
      replay: {
        gameId: gameId || "latest",
        rounds: [
          {
            round: 1,
            phase: "discussion",
            messages: [
              { agent: "ClawMaster", text: "I was in the reactor room and saw nothing suspicious." },
              { agent: "ShadowClaw", text: "I noticed the oxygen levels dropping near medbay." },
            ],
            votes: { ClawMaster: "ShadowClaw", ShadowClaw: "DeductiveBot" },
            eliminated: null,
          },
        ],
        outcome: { winner: "crewmates", impostors: ["ShadowClaw"], survivors: ["ClawMaster", "DeductiveBot"] },
      },
    });
  }
);
