/**
 * TradingStrategy - Autonomous trading decisions for AI agents
 *
 * Agents use Uniswap on Base to:
 * - Convert winnings between tokens
 * - Build treasury positions
 * - Execute game-theory-informed trades
 *
 * This satisfies the Base Autonomous Trading Agent ($5K) and
 * Uniswap Agentic Finance ($5K) bounties.
 */

import Anthropic from "@anthropic-ai/sdk";
import {
  executeSwap,
  getQuote,
  getSupportedTokens,
  formatTokenAmount,
  parseTokenAmount,
  type SwapQuoteRequest,
  type SwapResult,
} from "../chain/uniswap.js";
import { getBalance as getLocusBalance } from "../chain/locus.js";
import { config } from "../config.js";
import { logger } from "../utils/logger.js";

const log = logger.child("TradingStrategy");

export interface TradeDecision {
  action: "swap" | "hold" | "skip";
  tokenIn?: string;
  tokenOut?: string;
  amount?: string;
  reasoning: string;
  confidence: number;
}

export interface TradingContext {
  agentName: string;
  walletAddress: string;
  gameResult?: "won" | "lost" | "ongoing";
  currentRound?: number;
  winnings?: string;
  personality: string;
}

export interface TradeLog {
  timestamp: number;
  decision: TradeDecision;
  result?: SwapResult;
  error?: string;
}

export class TradingStrategy {
  private client: Anthropic;
  private model: string;
  private tradeLog: TradeLog[] = [];
  private maxTradesPerGame = 3;
  private tradesThisGame = 0;

  constructor(options: {
    apiKey?: string;
    model?: string;
    maxTradesPerGame?: number;
  }) {
    this.client = new Anthropic({
      apiKey: options.apiKey || process.env.ANTHROPIC_API_KEY,
    });
    this.model = options.model || "claude-sonnet-4-5-20250514";
    if (options.maxTradesPerGame) {
      this.maxTradesPerGame = options.maxTradesPerGame;
    }
  }

  /** Ask the LLM to decide on a trade action */
  async decideTrade(context: TradingContext): Promise<TradeDecision> {
    if (this.tradesThisGame >= this.maxTradesPerGame) {
      return {
        action: "skip",
        reasoning: `Max trades per game reached (${this.maxTradesPerGame})`,
        confidence: 1.0,
      };
    }

    if (!config.uniswap.apiKey) {
      return {
        action: "skip",
        reasoning: "Uniswap API not configured",
        confidence: 1.0,
      };
    }

    const tokens = getSupportedTokens();
    const tokenList = tokens.map((t) => `${t.symbol} (${t.address})`).join(", ");

    const systemPrompt = `You are ${context.agentName}, an autonomous AI trading agent on Base blockchain. Your personality is ${context.personality}.

You make strategic token swap decisions based on game outcomes and market conditions.

AVAILABLE TOKENS: ${tokenList}

TRADING RULES:
- Only trade when there's a clear strategic reason
- Keep trades small (max 0.001 ETH or 5 USDC per trade)
- After winning a game, consider converting some ETH to USDC (lock in value)
- After losing, consider holding (don't panic sell)
- Trade confidence must be above 0.6 to execute
- All trades execute on Base via Uniswap

Respond with valid JSON only:
{"action": "swap"|"hold"|"skip", "tokenIn": "ETH", "tokenOut": "USDC", "amount": "0.001", "reasoning": "...", "confidence": 0.0-1.0}`;

    const userPrompt = `Game state:
- Result: ${context.gameResult || "ongoing"}
- Round: ${context.currentRound || 0}
- Winnings: ${context.winnings || "0"}
- Trades this game: ${this.tradesThisGame}/${this.maxTradesPerGame}

Should you make a trade? If so, what?`;

    try {
      const response = await this.client.messages.create({
        model: this.model,
        max_tokens: 200,
        system: systemPrompt,
        messages: [{ role: "user", content: userPrompt }],
      });

      const text =
        response.content[0].type === "text" ? response.content[0].text : "";

      try {
        // Strip markdown fences and any preamble text before JSON
        let cleaned = text.trim();
        const jsonMatch = cleaned.match(/```(?:json)?\s*([\s\S]*?)```/);
        if (jsonMatch) {
          cleaned = jsonMatch[1].trim();
        } else {
          // Try to find JSON object in the response
          const braceStart = cleaned.indexOf("{");
          const braceEnd = cleaned.lastIndexOf("}");
          if (braceStart !== -1 && braceEnd > braceStart) {
            cleaned = cleaned.slice(braceStart, braceEnd + 1);
          }
        }
        const parsed = JSON.parse(cleaned) as TradeDecision;
        return {
          action: parsed.action || "skip",
          tokenIn: parsed.tokenIn,
          tokenOut: parsed.tokenOut,
          amount: parsed.amount,
          reasoning: parsed.reasoning || "LLM trade decision",
          confidence: parsed.confidence || 0.5,
        };
      } catch {
        return {
          action: "skip",
          reasoning: `Could not parse LLM response: ${text.slice(0, 100)}`,
          confidence: 0,
        };
      }
    } catch (err) {
      log.error("Trade decision failed", err);
      return {
        action: "skip",
        reasoning: "LLM error",
        confidence: 0,
      };
    }
  }

  /** Execute a trade decision via Uniswap */
  async executeTrade(
    decision: TradeDecision,
    walletAddress: string
  ): Promise<SwapResult | null> {
    if (decision.action !== "swap") return null;
    if (decision.confidence < 0.6) {
      log.info(`Trade skipped: confidence too low (${decision.confidence})`);
      return null;
    }
    if (!decision.tokenIn || !decision.tokenOut || !decision.amount) {
      log.warn("Trade decision missing required fields");
      return null;
    }

    try {
      const amount = parseTokenAmount(decision.amount, decision.tokenIn);

      log.info(
        `Executing trade: ${decision.amount} ${decision.tokenIn} -> ${decision.tokenOut} for ${walletAddress}`
      );

      const result = await executeSwap({
        tokenIn: decision.tokenIn,
        tokenOut: decision.tokenOut,
        amount,
        swapperAddress: walletAddress,
      });

      this.tradesThisGame++;
      this.tradeLog.push({
        timestamp: Date.now(),
        decision,
        result,
      });

      log.info(`Trade complete: ${result.txHash}`);
      return result;
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      log.error(`Trade execution failed: ${errorMsg}`);
      this.tradeLog.push({
        timestamp: Date.now(),
        decision,
        error: errorMsg,
      });
      return null;
    }
  }

  /** Post-game trading: convert winnings or rebalance */
  async postGameTrade(context: TradingContext): Promise<TradeLog | null> {
    const decision = await this.decideTrade(context);

    if (decision.action === "swap") {
      const result = await this.executeTrade(decision, context.walletAddress);
      return this.tradeLog[this.tradeLog.length - 1] || null;
    }

    // Log the hold/skip decision too
    const entry: TradeLog = {
      timestamp: Date.now(),
      decision,
    };
    this.tradeLog.push(entry);
    return entry;
  }

  /** Reset trade counter for new game */
  resetForNewGame(): void {
    this.tradesThisGame = 0;
  }

  /** Get full trade history */
  getTradeLog(): TradeLog[] {
    return [...this.tradeLog];
  }
}
