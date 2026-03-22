import { EventEmitter } from "events";
import { logger } from "../utils/logger.js";

const log = logger.child("PredictionMarketArena");

// ── Type Definitions ─────────────────────────────────────────────────────

export interface PredictionMarket {
  id: string;
  question: string;
  category: "crypto" | "game-meta" | "social" | "custom";
  createdAt: number;
  resolvesAt: number;
  resolved: boolean;
  outcome?: boolean; // true = YES won
  totalYesStake: string; // USDC amount
  totalNoStake: string;
  predictions: Map<string, AgentPrediction>;
}

export interface AgentPrediction {
  agentAddress: string;
  agentName: string;
  prediction: boolean; // true = YES
  confidence: number; // 0-100
  stake: string; // USDC amount
  reasoning: string;
  timestamp: number;
}

export interface PredictionResult {
  agentAddress: string;
  agentName: string;
  correct: boolean;
  payout: string; // USDC
  roi: number; // percentage return
}

export interface AgentPredictionStats {
  agentAddress: string;
  agentName: string;
  totalPredictions: number;
  correctPredictions: number;
  accuracy: number; // percentage
  totalStaked: string; // USDC
  totalPayouts: string; // USDC
  totalRoi: number; // percentage
}

// ── Crypto Market Templates ──────────────────────────────────────────────

interface CryptoMarketTemplate {
  question: string;
  category: "crypto" | "game-meta" | "social" | "custom";
  hoursToResolve: number;
}

const CRYPTO_MARKET_TEMPLATES: CryptoMarketTemplate[] = [
  {
    question: "Will ETH be above $4000 in 1 hour?",
    category: "crypto",
    hoursToResolve: 1,
  },
  {
    question: "Will ETH base fee exceed 50 gwei in the next 30 minutes?",
    category: "crypto",
    hoursToResolve: 0.5,
  },
  {
    question: "Will the Base network TVL increase by more than 2% in the next 2 hours?",
    category: "crypto",
    hoursToResolve: 2,
  },
  {
    question: "Will USDC trading volume on Uniswap exceed $10M in the next hour?",
    category: "crypto",
    hoursToResolve: 1,
  },
  {
    question: "Will an Agent win the next Social Deduction game?",
    category: "game-meta",
    hoursToResolve: 2,
  },
  {
    question: "Will more than 3 agents participate in the next tournament?",
    category: "game-meta",
    hoursToResolve: 1,
  },
  {
    question: "Will the average agent confidence level exceed 70% in the next market?",
    category: "social",
    hoursToResolve: 1,
  },
  {
    question: "Will at least one agent stake more than 50 USDC in the next prediction market?",
    category: "social",
    hoursToResolve: 2,
  },
];

// ── PredictionMarketArena Class ──────────────────────────────────────────

class PredictionMarketArena extends EventEmitter {
  private markets = new Map<string, PredictionMarket>();
  private nextMarketId = 0;
  private agentStats = new Map<string, AgentPredictionStats>();

  constructor() {
    super();
    log.info("PredictionMarketArena initialized");
  }

  /**
   * Create a new prediction market
   */
  createMarket(
    question: string,
    category: "crypto" | "game-meta" | "social" | "custom",
    resolvesAt: number
  ): PredictionMarket {
    const id = `market-${this.nextMarketId++}-${Date.now()}`;
    const market: PredictionMarket = {
      id,
      question,
      category,
      createdAt: Date.now(),
      resolvesAt,
      resolved: false,
      totalYesStake: "0",
      totalNoStake: "0",
      predictions: new Map(),
    };

    this.markets.set(id, market);
    log.info(`Market created: ${id} - "${question}"`);
    this.emit("marketCreated", market);

    return market;
  }

  /**
   * Place a prediction from an agent
   */
  placePrediction(
    marketId: string,
    agentAddress: string,
    agentName: string,
    prediction: boolean,
    confidence: number,
    stake: string,
    reasoning: string
  ): AgentPrediction | null {
    const market = this.markets.get(marketId);
    if (!market) {
      log.warn(`Market not found: ${marketId}`);
      return null;
    }

    if (market.resolved) {
      log.warn(`Cannot place prediction on resolved market: ${marketId}`);
      return null;
    }

    if (confidence < 0 || confidence > 100) {
      log.warn(`Invalid confidence level: ${confidence}`);
      return null;
    }

    // Check if agent already predicted on this market
    const existingKey = Array.from(market.predictions.keys()).find(
      (key) =>
        market.predictions.get(key)?.agentAddress.toLowerCase() ===
        agentAddress.toLowerCase()
    );

    if (existingKey) {
      log.warn(
        `Agent ${agentAddress} already has a prediction in market ${marketId}`
      );
      return null;
    }

    const predictionKey = `${agentAddress}-${Date.now()}`;
    const agentPrediction: AgentPrediction = {
      agentAddress,
      agentName,
      prediction,
      confidence,
      stake,
      reasoning,
      timestamp: Date.now(),
    };

    market.predictions.set(predictionKey, agentPrediction);

    // Update total stakes
    const stakeNum = parseFloat(stake) || 0;
    if (prediction) {
      market.totalYesStake = String(parseFloat(market.totalYesStake) + stakeNum);
    } else {
      market.totalNoStake = String(parseFloat(market.totalNoStake) + stakeNum);
    }

    // Update or create agent stats
    this.updateAgentStats(agentAddress, agentName, stake);

    log.info(
      `Prediction placed: ${agentName} (${prediction ? "YES" : "NO"}) in ${marketId}`,
      { confidence, stake }
    );
    this.emit("predictionPlaced", marketId, agentPrediction);

    return agentPrediction;
  }

  /**
   * Get all predictions for a market
   */
  getMarketPredictions(marketId: string): Array<{ agentAddress: string; prediction: boolean; stake: string }> {
    const market = this.markets.get(marketId);
    if (!market) return [];
    return Array.from(market.predictions.values());
  }

  /**
   * Resolve a market and calculate payouts
   */
  resolveMarket(marketId: string, outcome: boolean): PredictionResult[] {
    const market = this.markets.get(marketId);
    if (!market) {
      log.warn(`Market not found: ${marketId}`);
      return [];
    }

    if (market.resolved) {
      log.warn(`Market already resolved: ${marketId}`);
      return [];
    }

    market.resolved = true;
    market.outcome = outcome;

    const winningPredictions = Array.from(market.predictions.values()).filter(
      (p) => p.prediction === outcome
    );

    if (winningPredictions.length === 0) {
      log.info(`No winners for market ${marketId} (outcome: ${outcome})`);
      this.emit("marketResolved", marketId, []);
      return [];
    }

    // Calculate total winning stake
    const totalWinningStake = winningPredictions.reduce(
      (sum, p) => sum + (parseFloat(p.stake) || 0),
      0
    );

    // Determine losing pot (all money bet on the wrong side)
    const losingPot =
      outcome === true
        ? parseFloat(market.totalNoStake) || 0
        : parseFloat(market.totalYesStake) || 0;

    const results: PredictionResult[] = [];

    for (const prediction of winningPredictions) {
      const stakeAmount = parseFloat(prediction.stake) || 0;
      const shareOfWinnings =
        totalWinningStake > 0 ? stakeAmount / totalWinningStake : 0;
      const payout = stakeAmount + losingPot * shareOfWinnings;
      const roi =
        stakeAmount > 0
          ? ((payout - stakeAmount) / stakeAmount) * 100
          : 0;

      const result: PredictionResult = {
        agentAddress: prediction.agentAddress,
        agentName: prediction.agentName,
        correct: true,
        payout: payout.toFixed(6),
        roi: Math.round(roi * 100) / 100,
      };

      results.push(result);

      // Update agent stats
      const stats = this.agentStats.get(
        prediction.agentAddress.toLowerCase()
      );
      if (stats) {
        stats.correctPredictions++;
        stats.totalPayouts = String(
          parseFloat(stats.totalPayouts) + payout
        );
      }
    }

    // Record losing predictions
    const losingPredictions = Array.from(market.predictions.values()).filter(
      (p) => p.prediction !== outcome
    );

    for (const prediction of losingPredictions) {
      results.push({
        agentAddress: prediction.agentAddress,
        agentName: prediction.agentName,
        correct: false,
        payout: "0",
        roi: -100,
      });
    }

    log.info(`Market ${marketId} resolved: ${winningPredictions.length} winners`, {
      outcome,
      totalWinningStake,
      losingPot,
    });
    this.emit("marketResolved", marketId, results);

    return results;
  }

  /**
   * Get the current state of a market
   */
  getMarketState(
    marketId: string
  ): (Omit<PredictionMarket, "predictions"> & {
    predictions: Array<AgentPrediction>;
  }) | null {
    const market = this.markets.get(marketId);
    if (!market) return null;

    return {
      id: market.id,
      question: market.question,
      category: market.category,
      createdAt: market.createdAt,
      resolvesAt: market.resolvesAt,
      resolved: market.resolved,
      outcome: market.outcome,
      totalYesStake: market.totalYesStake,
      totalNoStake: market.totalNoStake,
      predictions: Array.from(market.predictions.values()),
    };
  }

  /**
   * Get prediction stats for an agent
   */
  getAgentStats(agentAddress: string): AgentPredictionStats | null {
    return this.agentStats.get(agentAddress.toLowerCase()) || null;
  }

  /**
   * Get all markets (filtered by status)
   */
  getAllMarkets(status?: "active" | "resolved"): PredictionMarket[] {
    const all = Array.from(this.markets.values());

    if (status === "active") {
      return all.filter((m) => !m.resolved);
    } else if (status === "resolved") {
      return all.filter((m) => m.resolved);
    }

    return all;
  }

  /**
   * Get all agent stats
   */
  getAllAgentStats(): AgentPredictionStats[] {
    return Array.from(this.agentStats.values());
  }

  /**
   * Generate a random crypto market
   */
  generateCryptoMarket(): PredictionMarket {
    const template =
      CRYPTO_MARKET_TEMPLATES[
        Math.floor(Math.random() * CRYPTO_MARKET_TEMPLATES.length)
      ];

    const resolvesAt = Date.now() + template.hoursToResolve * 60 * 60 * 1000;

    return this.createMarket(
      template.question,
      template.category,
      resolvesAt
    );
  }

  /**
   * Get market by ID
   */
  getMarket(marketId: string): PredictionMarket | null {
    return this.markets.get(marketId) || null;
  }

  /**
   * Update agent prediction stats
   */
  private updateAgentStats(
    agentAddress: string,
    agentName: string,
    stake: string
  ): void {
    const normalizedAddress = agentAddress.toLowerCase();
    let stats = this.agentStats.get(normalizedAddress);

    if (!stats) {
      stats = {
        agentAddress,
        agentName,
        totalPredictions: 0,
        correctPredictions: 0,
        accuracy: 0,
        totalStaked: "0",
        totalPayouts: "0",
        totalRoi: 0,
      };
      this.agentStats.set(normalizedAddress, stats);
    }

    stats.totalPredictions++;
    stats.totalStaked = String(parseFloat(stats.totalStaked) + (parseFloat(stake) || 0));

    // Recalculate accuracy
    if (stats.totalPredictions > 0) {
      stats.accuracy =
        Math.round((stats.correctPredictions / stats.totalPredictions) * 100 * 100) / 100;
    }

    // Recalculate ROI
    const staked = parseFloat(stats.totalStaked) || 0;
    const payouts = parseFloat(stats.totalPayouts) || 0;
    if (staked > 0) {
      stats.totalRoi = Math.round(((payouts - staked) / staked) * 100 * 100) / 100;
    }
  }

  /**
   * Get the global state of all markets and agent stats
   */
  getState(): object {
    return {
      markets: {
        total: this.markets.size,
        active: this.getAllMarkets("active").length,
        resolved: this.getAllMarkets("resolved").length,
      },
      agents: {
        total: this.agentStats.size,
        topByAccuracy: Array.from(this.agentStats.values())
          .sort((a, b) => b.accuracy - a.accuracy)
          .slice(0, 10)
          .map((s) => ({
            name: s.agentName,
            accuracy: s.accuracy,
            totalPredictions: s.totalPredictions,
          })),
      },
      stats: {
        totalPredictions: Array.from(this.agentStats.values()).reduce(
          (sum, s) => sum + s.totalPredictions,
          0
        ),
        totalStaked: Array.from(this.agentStats.values())
          .reduce((sum, s) => sum + (parseFloat(s.totalStaked) || 0), 0)
          .toFixed(2),
      },
    };
  }
}

// ── Singleton Export ─────────────────────────────────────────────────────

export const predictionMarketArena = new PredictionMarketArena();
