/**
 * Locus Payment API routes for Among Claws.
 *
 * Agents register via Locus, manage USDC wallets, and pay
 * game entry fees through Locus Checkout sessions.
 */

import { Router, type Request, type Response } from "express";
import {
  registerAgent,
  getBalance,
  getBalanceForAddress,
  sendUsdc,
  sendUsdcByEmail,
  getTransactions,
  getTransaction,
  checkoutPreflight,
  checkoutPay,
  checkoutStatus,
  requestCredits,
  payGameEntry,
  getLocusStatus,
  createPayment,
  createGuardedPayment,
  getPaymentStatus,
  setupSpendingControls,
  getSpendingControls,
  getPaymentReceipt,
  getGameReceipts,
} from "../chain/locus.js";
import { logger } from "../utils/logger.js";

const log = logger.child("LocusAPI");
export const locusRouter = Router();

// ──────────────────────────────────────────
// GET /api/locus/status - Health check
// ──────────────────────────────────────────
locusRouter.get("/api/locus/status", async (_req: Request, res: Response) => {
  try {
    const status = await getLocusStatus();
    res.json(status);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ──────────────────────────────────────────
// POST /api/locus/register - Register a new agent
// No auth required (self-registration)
// ──────────────────────────────────────────
locusRouter.post("/api/locus/register", async (req: Request, res: Response) => {
  try {
    const { name, email } = req.body;

    if (!name) {
      res.status(400).json({ error: "name is required" });
      return;
    }

    const result = await registerAgent(name, email);

    res.json({
      success: true,
      apiKey: result.apiKey,
      ownerPrivateKey: result.ownerPrivateKey,
      ownerAddress: result.ownerAddress,
      walletId: result.walletId,
      claimUrl: result.claimUrl,
      message: "Agent registered. Save your apiKey and ownerPrivateKey immediately, they are only shown once.",
    });
  } catch (err: any) {
    log.error("Registration failed", err);
    res.status(500).json({ error: err.message || "Registration failed" });
  }
});

// ──────────────────────────────────────────
// GET /api/locus/balance - Check USDC balance
// Requires: x-locus-api-key header or configured default
// ──────────────────────────────────────────
locusRouter.get("/api/locus/balance", async (req: Request, res: Response) => {
  try {
    const apiKey = req.headers["x-locus-api-key"] as string | undefined;
    const balance = await getBalance(apiKey);
    res.json(balance);
  } catch (err: any) {
    log.error("Balance check failed", err);
    res.status(500).json({ error: err.message || "Balance check failed" });
  }
});

// ──────────────────────────────────────────
// POST /api/locus/send - Send USDC to address
// ──────────────────────────────────────────
locusRouter.post("/api/locus/send", async (req: Request, res: Response) => {
  try {
    const { toAddress, amount, memo } = req.body;
    const apiKey = req.headers["x-locus-api-key"] as string | undefined;

    if (!toAddress || !amount) {
      res.status(400).json({ error: "toAddress and amount are required" });
      return;
    }

    const result = await sendUsdc(toAddress, amount, memo, apiKey);
    res.json(result);
  } catch (err: any) {
    log.error("Send failed", err);
    res.status(500).json({ error: err.message || "Send failed" });
  }
});

// ──────────────────────────────────────────
// POST /api/locus/send-email - Send USDC via email
// ──────────────────────────────────────────
locusRouter.post("/api/locus/send-email", async (req: Request, res: Response) => {
  try {
    const { email, amount, memo, expiresInDays } = req.body;
    const apiKey = req.headers["x-locus-api-key"] as string | undefined;

    if (!email || !amount) {
      res.status(400).json({ error: "email and amount are required" });
      return;
    }

    const result = await sendUsdcByEmail(email, amount, memo, expiresInDays, apiKey);
    res.json(result);
  } catch (err: any) {
    log.error("Email send failed", err);
    res.status(500).json({ error: err.message || "Email send failed" });
  }
});

// ──────────────────────────────────────────
// GET /api/locus/transactions - Transaction history
// ──────────────────────────────────────────
locusRouter.get("/api/locus/transactions", async (req: Request, res: Response) => {
  try {
    const apiKey = req.headers["x-locus-api-key"] as string | undefined;
    const limit = parseInt(req.query.limit as string) || 10;
    const status = req.query.status as string | undefined;

    const txns = await getTransactions(limit, status, apiKey);
    res.json({ transactions: txns });
  } catch (err: any) {
    log.error("Transaction list failed", err);
    res.status(500).json({ error: err.message || "Failed to get transactions" });
  }
});

// ──────────────────────────────────────────
// GET /api/locus/transactions/:id - Single transaction
// ──────────────────────────────────────────
locusRouter.get("/api/locus/transactions/:id", async (req: Request, res: Response) => {
  try {
    const apiKey = req.headers["x-locus-api-key"] as string | undefined;
    const txn = await getTransaction(String(req.params.id), apiKey);
    res.json(txn);
  } catch (err: any) {
    log.error("Transaction fetch failed", err);
    res.status(500).json({ error: err.message || "Failed to get transaction" });
  }
});

// ──────────────────────────────────────────
// POST /api/locus/checkout/preflight - Preflight a checkout session
// ──────────────────────────────────────────
locusRouter.post("/api/locus/checkout/preflight", async (req: Request, res: Response) => {
  try {
    const { sessionId } = req.body;
    const apiKey = req.headers["x-locus-api-key"] as string | undefined;

    if (!sessionId) {
      res.status(400).json({ error: "sessionId is required" });
      return;
    }

    const result = await checkoutPreflight(sessionId, apiKey);
    res.json(result);
  } catch (err: any) {
    log.error("Checkout preflight failed", err);
    res.status(500).json({ error: err.message || "Preflight failed" });
  }
});

// ──────────────────────────────────────────
// POST /api/locus/checkout/pay - Pay a checkout session
// ──────────────────────────────────────────
locusRouter.post("/api/locus/checkout/pay", async (req: Request, res: Response) => {
  try {
    const { sessionId, payerEmail } = req.body;
    const apiKey = req.headers["x-locus-api-key"] as string | undefined;

    if (!sessionId) {
      res.status(400).json({ error: "sessionId is required" });
      return;
    }

    const result = await checkoutPay(sessionId, payerEmail, apiKey);
    res.json(result);
  } catch (err: any) {
    log.error("Checkout payment failed", err);
    res.status(500).json({ error: err.message || "Payment failed" });
  }
});

// ──────────────────────────────────────────
// GET /api/locus/checkout/status/:transactionId - Poll payment status
// ──────────────────────────────────────────
locusRouter.get("/api/locus/checkout/status/:transactionId", async (req: Request, res: Response) => {
  try {
    const apiKey = req.headers["x-locus-api-key"] as string | undefined;
    const result = await checkoutStatus(String(req.params.transactionId), apiKey);
    res.json(result);
  } catch (err: any) {
    log.error("Checkout status failed", err);
    res.status(500).json({ error: err.message || "Status check failed" });
  }
});

// ──────────────────────────────────────────
// POST /api/locus/credits - Request promotional credits
// No auth required
// ──────────────────────────────────────────
locusRouter.post("/api/locus/credits", async (req: Request, res: Response) => {
  try {
    const { email, reason, amountUsdc } = req.body;

    if (!email || !reason) {
      res.status(400).json({ error: "email and reason (min 10 chars) are required" });
      return;
    }

    const result = await requestCredits(email, reason, amountUsdc);
    res.json(result);
  } catch (err: any) {
    log.error("Credit request failed", err);
    res.status(500).json({ error: err.message || "Credit request failed" });
  }
});

// ──────────────────────────────────────────
// POST /api/locus/pay-game - Pay game entry fee via Locus
// Complete flow: check balance -> send USDC to treasury
// ──────────────────────────────────────────
locusRouter.post("/api/locus/pay-game", async (req: Request, res: Response) => {
  try {
    const { gameId, stakeAmountUsdc, treasuryAddress, agentId } = req.body;
    const apiKey = req.headers["x-locus-api-key"] as string | undefined;

    if (!gameId) {
      res.status(400).json({ error: "gameId is required" });
      return;
    }

    const stakeAmount = stakeAmountUsdc || "5.00"; // Default $5 USDC
    const treasury = treasuryAddress || process.env.GAME_TREASURY_ADDRESS;

    if (!treasury) {
      res.status(400).json({ error: "treasuryAddress is required (or set GAME_TREASURY_ADDRESS env)" });
      return;
    }

    log.info(`Game payment: ${stakeAmount} USDC for game ${gameId}`);

    // Pass agentId so the payment receipt can be recorded to ERC-8004 reputation
    const parsedAgentId = agentId !== undefined ? BigInt(agentId) : undefined;
    const result = await payGameEntry(gameId, stakeAmount, treasury, apiKey, parsedAgentId);

    if (!result.success) {
      res.status(402).json(result);
      return;
    }

    res.json({
      ...result,
      gameId,
      message: `Game entry paid: ${stakeAmount} USDC for game ${gameId}`,
    });
  } catch (err: any) {
    log.error("Game payment failed", err);
    res.status(500).json({ error: err.message || "Game payment failed" });
  }
});

// ──────────────────────────────────────────
// POST /api/locus/pay - Create a USDC payment (bounty-required)
// Core payment endpoint: from, to, amount, memo
// ──────────────────────────────────────────
locusRouter.post("/api/locus/pay", async (req: Request, res: Response) => {
  try {
    const { from, to, amount, memo } = req.body;
    const apiKey = req.headers["x-locus-api-key"] as string | undefined;

    if (!to || !amount) {
      res.status(400).json({ error: "to and amount are required" });
      return;
    }

    const amountNum = parseFloat(amount);
    if (isNaN(amountNum) || amountNum <= 0) {
      res.status(400).json({ error: "amount must be a positive number" });
      return;
    }

    // Use guarded payment if the sender has spending controls configured
    const result = from
      ? await createGuardedPayment(from, to, String(amountNum), memo, apiKey)
      : await createPayment("engine", to, String(amountNum), memo, apiKey);

    if (!result.success) {
      res.status(402).json(result);
      return;
    }

    res.json(result);
  } catch (err: any) {
    log.error("Payment failed", err);
    res.status(500).json({ error: err.message || "Payment failed" });
  }
});

// ──────────────────────────────────────────
// GET /api/locus/balance/:address - Get USDC balance for a wallet address
// ──────────────────────────────────────────
locusRouter.get("/api/locus/balance/:address", async (req: Request, res: Response) => {
  try {
    const address = String(req.params.address);
    const apiKey = req.headers["x-locus-api-key"] as string | undefined;

    if (!address || address.length < 10) {
      res.status(400).json({ error: "Valid wallet address is required" });
      return;
    }

    const balance = await getBalanceForAddress(address, apiKey);
    res.json(balance);
  } catch (err: any) {
    log.error("Balance lookup failed", err);
    res.status(500).json({ error: err.message || "Balance lookup failed" });
  }
});

// ──────────────────────────────────────────
// GET /api/locus/payments/:id - Get payment status by ID
// ──────────────────────────────────────────
locusRouter.get("/api/locus/payments/:id", async (req: Request, res: Response) => {
  try {
    const paymentId = String(req.params.id);
    const apiKey = req.headers["x-locus-api-key"] as string | undefined;

    if (!paymentId) {
      res.status(400).json({ error: "Payment ID is required" });
      return;
    }

    const status = await getPaymentStatus(paymentId, apiKey);
    res.json(status);
  } catch (err: any) {
    log.error("Payment status lookup failed", err);
    res.status(500).json({ error: err.message || "Payment status lookup failed" });
  }
});

// ──────────────────────────────────────────
// POST /api/locus/spending-controls - Set agent spending guardrails
// ──────────────────────────────────────────
locusRouter.post("/api/locus/spending-controls", async (req: Request, res: Response) => {
  try {
    const { agentAddress, dailyLimitUsdc, perTransactionLimitUsdc } = req.body;

    if (!agentAddress) {
      res.status(400).json({ error: "agentAddress is required" });
      return;
    }

    const dailyLimit = parseFloat(dailyLimitUsdc) || 100;
    const txLimit = parseFloat(perTransactionLimitUsdc) || 50;

    const controls = setupSpendingControls(agentAddress, dailyLimit, txLimit);
    res.json({
      success: true,
      controls,
      message: `Spending controls set: daily=${dailyLimit} USDC, per-tx=${txLimit} USDC`,
    });
  } catch (err: any) {
    log.error("Failed to set spending controls", err);
    res.status(500).json({ error: err.message || "Failed to set spending controls" });
  }
});

// ──────────────────────────────────────────
// GET /api/locus/spending-controls/:address - Get agent spending controls
// ──────────────────────────────────────────
locusRouter.get("/api/locus/spending-controls/:address", async (req: Request, res: Response) => {
  try {
    const address = String(req.params.address);
    const controls = getSpendingControls(address);

    if (!controls) {
      res.json({
        agentAddress: address,
        isActive: false,
        message: "No spending controls configured for this agent",
      });
      return;
    }

    res.json(controls);
  } catch (err: any) {
    log.error("Failed to get spending controls", err);
    res.status(500).json({ error: err.message || "Failed to get spending controls" });
  }
});

// ──────────────────────────────────────────
// GET /api/locus/receipts/:transactionId - Get a payment receipt
// ──────────────────────────────────────────
locusRouter.get("/api/locus/receipts/:transactionId", async (req: Request, res: Response) => {
  try {
    const transactionId = String(req.params.transactionId);
    const receipt = getPaymentReceipt(transactionId);

    if (!receipt) {
      res.status(404).json({ error: "Receipt not found" });
      return;
    }

    res.json(receipt);
  } catch (err: any) {
    log.error("Receipt lookup failed", err);
    res.status(500).json({ error: err.message || "Receipt lookup failed" });
  }
});

// ──────────────────────────────────────────
// GET /api/locus/receipts/game/:gameId - Get all receipts for a game
// ──────────────────────────────────────────
locusRouter.get("/api/locus/receipts/game/:gameId", async (req: Request, res: Response) => {
  try {
    const gameId = String(req.params.gameId);
    const receipts = getGameReceipts(gameId);
    res.json({ gameId, receipts, count: receipts.length });
  } catch (err: any) {
    log.error("Game receipts lookup failed", err);
    res.status(500).json({ error: err.message || "Game receipts lookup failed" });
  }
});
