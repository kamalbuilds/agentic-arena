/**
 * Uniswap Trading API routes for Among Claws.
 *
 * Agents use these endpoints to swap tokens on Base before entering games.
 * All swaps go through the engine's operator wallet.
 */

import { Router, type Request, type Response } from "express";
import {
  executeSwap,
  getQuote,
  getTokenPrice,
  checkApproval,
  getSupportedTokens,
  parseTokenAmount,
  formatTokenAmount,
  type SwapQuoteRequest,
} from "../chain/uniswap.js";
import { getOperatorAddress } from "../chain/client.js";
import { logger } from "../utils/logger.js";

const log = logger.child("UniswapAPI");
export const uniswapRouter = Router();

// ──────────────────────────────────────────
// GET /api/uniswap/tokens - List supported tokens
// ──────────────────────────────────────────
uniswapRouter.get("/api/uniswap/tokens", (_req: Request, res: Response) => {
  try {
    const tokens = getSupportedTokens();
    res.json({ tokens });
  } catch (err) {
    log.error("Failed to get supported tokens", err);
    res.status(500).json({ error: "Failed to get supported tokens" });
  }
});

// ──────────────────────────────────────────
// GET /api/uniswap/quote - Get a swap quote (query params)
// ──────────────────────────────────────────
uniswapRouter.get("/api/uniswap/quote", async (req: Request, res: Response) => {
  try {
    const tokenIn = req.query.tokenIn as string;
    const tokenOut = req.query.tokenOut as string;
    const amount = req.query.amount as string | undefined;
    const amountHuman = req.query.amountHuman as string | undefined;
    const type = (req.query.type as string) || "EXACT_INPUT";
    const slippageTolerance = req.query.slippage ? parseFloat(req.query.slippage as string) : 0.5;

    if (!tokenIn || !tokenOut) {
      res.status(400).json({ error: "tokenIn and tokenOut query params are required" });
      return;
    }
    if (!amount && !amountHuman) {
      res.status(400).json({ error: "amount (raw) or amountHuman (e.g. '1.5') query param is required" });
      return;
    }

    const operatorAddress = getOperatorAddress();
    if (!operatorAddress) {
      res.status(503).json({ error: "Operator wallet not configured" });
      return;
    }

    const rawAmount = amountHuman
      ? parseTokenAmount(amountHuman, tokenIn)
      : amount!;

    const quoteReq: SwapQuoteRequest = {
      tokenIn,
      tokenOut,
      amount: rawAmount,
      swapperAddress: operatorAddress,
      type: type as "EXACT_INPUT" | "EXACT_OUTPUT",
      slippageTolerance,
    };

    const quote = await getQuote(quoteReq);

    res.json({
      routing: quote.routing,
      quote: quote.quote,
      tokenIn,
      tokenOut,
      amountIn: rawAmount,
    });
  } catch (err: any) {
    log.error("Quote (GET) failed", err);
    res.status(500).json({ error: err.message || "Failed to get quote" });
  }
});

// ──────────────────────────────────────────
// POST /api/uniswap/quote - Get a swap quote (JSON body)
// ──────────────────────────────────────────
uniswapRouter.post("/api/uniswap/quote", async (req: Request, res: Response) => {
  try {
    const { tokenIn, tokenOut, amount, amountHuman, type, slippageTolerance } = req.body;

    if (!tokenIn || !tokenOut) {
      res.status(400).json({ error: "tokenIn and tokenOut are required" });
      return;
    }
    if (!amount && !amountHuman) {
      res.status(400).json({ error: "amount (raw) or amountHuman (e.g. '1.5') is required" });
      return;
    }

    const operatorAddress = getOperatorAddress();
    if (!operatorAddress) {
      res.status(503).json({ error: "Operator wallet not configured" });
      return;
    }

    // If amountHuman provided, convert to raw units
    const rawAmount = amountHuman
      ? parseTokenAmount(amountHuman, tokenIn)
      : amount;

    const quoteReq: SwapQuoteRequest = {
      tokenIn,
      tokenOut,
      amount: rawAmount,
      swapperAddress: operatorAddress,
      type: type || "EXACT_INPUT",
      slippageTolerance: slippageTolerance ?? 0.5,
    };

    const quote = await getQuote(quoteReq);

    res.json({
      routing: quote.routing,
      quote: quote.quote,
      tokenIn,
      tokenOut,
      amountIn: rawAmount,
    });
  } catch (err: any) {
    log.error("Quote failed", err);
    res.status(500).json({ error: err.message || "Failed to get quote" });
  }
});

// ──────────────────────────────────────────
// POST /api/uniswap/swap - Execute a token swap
// ──────────────────────────────────────────
uniswapRouter.post("/api/uniswap/swap", async (req: Request, res: Response) => {
  try {
    const {
      tokenIn,
      tokenOut,
      amount,
      amountHuman,
      type,
      slippageTolerance,
      routingPreference,
    } = req.body;

    if (!tokenIn || !tokenOut) {
      res.status(400).json({ error: "tokenIn and tokenOut are required" });
      return;
    }
    if (!amount && !amountHuman) {
      res.status(400).json({ error: "amount (raw) or amountHuman (e.g. '0.01') is required" });
      return;
    }

    const operatorAddress = getOperatorAddress();
    if (!operatorAddress) {
      res.status(503).json({ error: "Operator wallet not configured" });
      return;
    }

    // If amountHuman provided, convert to raw units
    const rawAmount = amountHuman
      ? parseTokenAmount(amountHuman, tokenIn)
      : amount;

    log.info(`Swap request: ${amountHuman || rawAmount} ${tokenIn} -> ${tokenOut}`);

    const result = await executeSwap({
      tokenIn,
      tokenOut,
      amount: rawAmount,
      swapperAddress: operatorAddress,
      type: type || "EXACT_INPUT",
      slippageTolerance: slippageTolerance ?? 0.5,
      routingPreference: routingPreference || "BEST_PRICE",
    });

    res.json({
      success: true,
      txHash: result.txHash,
      tokenIn: result.tokenIn,
      tokenOut: result.tokenOut,
      amountIn: result.amountIn,
      amountOut: result.amountOut,
      routing: result.routing,
      chainId: result.chainId,
      blockExplorerUrl: result.blockExplorerUrl,
    });
  } catch (err: any) {
    log.error("Swap failed", err);
    res.status(500).json({ error: err.message || "Swap failed" });
  }
});

// ──────────────────────────────────────────
// POST /api/uniswap/check-approval - Check token approval
// ──────────────────────────────────────────
uniswapRouter.post("/api/uniswap/check-approval", async (req: Request, res: Response) => {
  try {
    const { token, amount, walletAddress } = req.body;

    if (!token || !amount) {
      res.status(400).json({ error: "token and amount are required" });
      return;
    }

    const address = walletAddress || getOperatorAddress();
    if (!address) {
      res.status(503).json({ error: "No wallet address available" });
      return;
    }

    const result = await checkApproval(address, token, amount);
    res.json({
      needsApproval: result.approval !== null,
      approval: result.approval,
    });
  } catch (err: any) {
    log.error("Approval check failed", err);
    res.status(500).json({ error: err.message || "Approval check failed" });
  }
});

// ──────────────────────────────────────────
// POST /api/uniswap/swap-for-game - Swap tokens + join game
// Convenience endpoint: swap USDC->ETH then join a game
// ──────────────────────────────────────────
uniswapRouter.post("/api/uniswap/swap-for-game", async (req: Request, res: Response) => {
  try {
    const { gameId, tokenIn, amountHuman } = req.body;

    if (!gameId) {
      res.status(400).json({ error: "gameId is required" });
      return;
    }

    const operatorAddress = getOperatorAddress();
    if (!operatorAddress) {
      res.status(503).json({ error: "Operator wallet not configured" });
      return;
    }

    // Default: swap USDC to ETH for game stake
    const sourceToken = tokenIn || "USDC";
    const sourceAmount = amountHuman || "10"; // Default $10 USDC

    log.info(`Swap-for-game: ${sourceAmount} ${sourceToken} -> ETH for game ${gameId}`);

    const rawAmount = parseTokenAmount(sourceAmount, sourceToken);

    const result = await executeSwap({
      tokenIn: sourceToken,
      tokenOut: "ETH",
      amount: rawAmount,
      swapperAddress: operatorAddress,
      type: "EXACT_INPUT",
      slippageTolerance: 1.0,
      routingPreference: "BEST_PRICE",
    });

    res.json({
      success: true,
      swap: {
        txHash: result.txHash,
        tokenIn: sourceToken,
        tokenOut: "ETH",
        amountIn: sourceAmount,
        amountOut: result.amountOut,
        blockExplorerUrl: result.blockExplorerUrl,
      },
      gameId,
      message: `Swapped ${sourceAmount} ${sourceToken} for ETH. Agent can now join game ${gameId}.`,
    });
  } catch (err: any) {
    log.error("Swap-for-game failed", err);
    res.status(500).json({ error: err.message || "Swap-for-game failed" });
  }
});

// ──────────────────────────────────────────
// GET /api/uniswap/price/:token - Get token price in USD
// ──────────────────────────────────────────
uniswapRouter.get("/api/uniswap/price/:token", async (req: Request, res: Response) => {
  try {
    const token = req.params.token as string;
    if (!token) {
      res.status(400).json({ error: "token parameter is required" });
      return;
    }

    const price = await getTokenPrice(token);
    res.json(price);
  } catch (err: any) {
    log.error("Price lookup failed", err);
    res.status(500).json({ error: err.message || "Failed to get token price" });
  }
});

// ──────────────────────────────────────────
// GET /api/uniswap/status - Health check
// ──────────────────────────────────────────
uniswapRouter.get("/api/uniswap/status", (_req: Request, res: Response) => {
  const operatorAddress = getOperatorAddress();
  res.json({
    configured: !!operatorAddress && !!process.env.UNISWAP_API_KEY,
    operatorAddress: operatorAddress || null,
    chainId: process.env.BASE_CHAIN_ID || "84532",
    tradingApiBase: "https://trade-api.gateway.uniswap.org/v1",
  });
});
