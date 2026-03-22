/**
 * MultiArenaOrchestrator - Runs all arena types concurrently
 *
 * Extends the GameOrchestrator concept to run prediction markets,
 * trading competitions, and auctions alongside social deduction games.
 * This demonstrates genuine multi-arena agent autonomy for the hackathon.
 *
 * Usage:
 *   POST /api/arenas/orchestrate/start  - Start multi-arena session
 *   POST /api/arenas/orchestrate/stop   - Stop all arenas
 *   GET  /api/arenas/orchestrate/status - Full session state
 */

import { predictionMarketArena } from "../arenas/PredictionMarketArena.js";
import { tradingCompetitionArena } from "../arenas/TradingCompetitionArena.js";
import { auctionArena } from "../arenas/AuctionArena.js";
import { arenaFramework } from "../game/ArenaFramework.js";
import { AgentBrain } from "./AgentBrain.js";
import { submitAgentFeedback, isErc8004Configured } from "../chain/erc8004.js";
import { config } from "../config.js";
import { logger } from "../utils/logger.js";

const log = logger.child("MultiArenaOrchestrator");

const AGENT_POOL = [
  { name: "Karkinos", personality: "analytical risk-taker, loves bold predictions" },
  { name: "Callinectes", personality: "conservative value investor, slow and steady" },
  { name: "Portunus", personality: "aggressive trader, high frequency decisions" },
  { name: "Scylla", personality: "contrarian thinker, bets against the crowd" },
  { name: "Charybdis", personality: "pattern recognition expert, relies on data" },
  { name: "Homarus", personality: "social strategist, reads other agents' moves" },
  { name: "Astacus", personality: "balanced moderate, diversifies across strategies" },
  { name: "Pagurus", personality: "momentum follower, rides winning streaks" },
];

interface ArenaSessionConfig {
  agentCount?: number;
  predictionMarkets?: boolean;
  tradingCompetitions?: boolean;
  auctions?: boolean;
  roundsPerArena?: number;
  delayBetweenRoundsMs?: number;
}

interface ArenaSessionState {
  running: boolean;
  startTime: number;
  agents: Array<{ name: string; address: string; personality: string }>;
  predictionMarkets: {
    enabled: boolean;
    marketsCreated: number;
    predictionsPlaced: number;
    marketsResolved: number;
  };
  tradingCompetitions: {
    enabled: boolean;
    competitionsRun: number;
    tradesExecuted: number;
  };
  auctions: {
    enabled: boolean;
    sessionsRun: number;
    bidsPlaced: number;
  };
  totalRoundsCompleted: number;
  uptimeSeconds: number;
}

interface SimulatedAgent {
  name: string;
  address: string;
  personality: string;
  balance: number; // simulated USDC balance
  wins: number;
  losses: number;
  brain: AgentBrain;
}

export class MultiArenaOrchestrator {
  private running = false;
  private startTime = 0;
  private agents: SimulatedAgent[] = [];
  private config: Required<ArenaSessionConfig>;
  private stats = {
    marketsCreated: 0,
    predictionsPlaced: 0,
    marketsResolved: 0,
    competitionsRun: 0,
    tradesExecuted: 0,
    sessionsRun: 0,
    bidsPlaced: 0,
    roundsCompleted: 0,
  };

  constructor(config: ArenaSessionConfig = {}) {
    this.config = {
      agentCount: Math.min(config.agentCount || 6, AGENT_POOL.length),
      predictionMarkets: config.predictionMarkets ?? true,
      tradingCompetitions: config.tradingCompetitions ?? true,
      auctions: config.auctions ?? true,
      roundsPerArena: config.roundsPerArena || 3,
      delayBetweenRoundsMs: config.delayBetweenRoundsMs || 2000,
    };
  }

  async start(): Promise<void> {
    if (this.running) {
      log.warn("Multi-arena orchestrator already running");
      return;
    }

    this.running = true;
    this.startTime = Date.now();
    log.info(`Multi-arena orchestrator starting with ${this.config.agentCount} agents`);

    // Initialize simulated agents
    this.initializeAgents();

    // Run arena rounds
    for (let round = 0; round < this.config.roundsPerArena && this.running; round++) {
      log.info(`\n=== MULTI-ARENA ROUND ${round + 1}/${this.config.roundsPerArena} ===\n`);

      // Run all enabled arenas concurrently
      const arenaPromises: Promise<void>[] = [];

      if (this.config.predictionMarkets) {
        arenaPromises.push(this.runPredictionMarketRound(round));
      }
      if (this.config.tradingCompetitions) {
        arenaPromises.push(this.runTradingCompetitionRound(round));
      }
      if (this.config.auctions) {
        arenaPromises.push(this.runAuctionRound(round));
      }

      await Promise.all(arenaPromises);
      this.stats.roundsCompleted++;

      // Record arena activity on-chain (non-blocking)
      arenaFramework.recordGamePlayed(1, BigInt(this.stats.marketsCreated * 1000000));
      arenaFramework.recordGamePlayed(2, BigInt(this.stats.tradesExecuted * 1000000));
      arenaFramework.recordGamePlayed(3, BigInt(this.stats.bidsPlaced * 1000000));

      // Record cross-arena reputation via ERC-8004
      await this.recordArenaReputation().catch(() => {});

      if (round < this.config.roundsPerArena - 1 && this.running) {
        log.info(`Next round in ${this.config.delayBetweenRoundsMs / 1000}s...`);
        await this.sleep(this.config.delayBetweenRoundsMs);
      }
    }

    this.running = false;
    log.info(`Multi-arena orchestrator finished: ${this.stats.roundsCompleted} rounds in ${this.getUptime()}s`);
  }

  stop(): void {
    log.info("Multi-arena orchestrator stopping...");
    this.running = false;
  }

  getStatus(): ArenaSessionState {
    return {
      running: this.running,
      startTime: this.startTime,
      agents: this.agents.map(a => ({
        name: a.name,
        address: a.address,
        personality: a.personality,
      })),
      predictionMarkets: {
        enabled: this.config.predictionMarkets,
        marketsCreated: this.stats.marketsCreated,
        predictionsPlaced: this.stats.predictionsPlaced,
        marketsResolved: this.stats.marketsResolved,
      },
      tradingCompetitions: {
        enabled: this.config.tradingCompetitions,
        competitionsRun: this.stats.competitionsRun,
        tradesExecuted: this.stats.tradesExecuted,
      },
      auctions: {
        enabled: this.config.auctions,
        sessionsRun: this.stats.sessionsRun,
        bidsPlaced: this.stats.bidsPlaced,
      },
      totalRoundsCompleted: this.stats.roundsCompleted,
      uptimeSeconds: this.getUptime(),
    };
  }

  private initializeAgents(): void {
    this.agents = [];
    const hasApiKey = !!(process.env.ANTHROPIC_API_KEY || config.ai.provider !== "anthropic");
    for (let i = 0; i < this.config.agentCount; i++) {
      const pool = AGENT_POOL[i];
      this.agents.push({
        name: pool.name,
        address: `0x${(i + 1).toString(16).padStart(40, "0")}`,
        personality: pool.personality,
        balance: 1000,
        wins: 0,
        losses: 0,
        brain: new AgentBrain({ personality: pool.personality }),
      });
    }
    log.info(`Initialized ${this.agents.length} agents for multi-arena play (LLM: ${hasApiKey ? "enabled" : "fallback mode"})`);
  }

  // ─── Prediction Market Round ──────────────────────────────────────

  private async runPredictionMarketRound(round: number): Promise<void> {
    log.info(`[Prediction Market] Round ${round + 1} starting`);

    // Create a market
    const questions = [
      "Will the total trading volume exceed 500 USDC this session?",
      "Will any agent win 3+ auctions in a single session?",
      "Will the top trader have over 20% ROI?",
      "Will more than half the agents make profitable trades?",
      "Will the auction house generate more revenue than the trading arena?",
      "Will any agent correctly predict 3 markets in a row?",
      "Will the total number of trades exceed 50 this session?",
      "Will the winning agent have the most conservative personality?",
    ];

    const question = questions[round % questions.length];
    const resolvesAt = Date.now() + 60000; // resolves in 1 minute
    const market = predictionMarketArena.createMarket(question, "game-meta", resolvesAt);
    this.stats.marketsCreated++;

    log.info(`  Market: "${question}"`);

    // Each agent makes a prediction using LLM reasoning
    const predictionPromises = this.agents.map(async (agent) => {
      try {
        const decision = await agent.brain.decidePrediction(question, "game-meta", agent.balance);
        predictionMarketArena.placePrediction(
          market.id,
          agent.address,
          agent.name,
          decision.prediction,
          decision.confidence,
          decision.stake,
          decision.reasoning
        );
        this.stats.predictionsPlaced++;
        log.info(`  ${agent.name}: ${decision.prediction ? "YES" : "NO"} (${decision.confidence}% conf, ${decision.stake} USDC)`);
      } catch {
        // Fallback: random prediction if LLM fails
        const prediction = Math.random() > 0.5;
        const stake = Math.min(Math.floor(agent.balance * 0.1), 50).toString();
        predictionMarketArena.placePrediction(market.id, agent.address, agent.name, prediction, 50, stake, "fallback");
        this.stats.predictionsPlaced++;
      }
    });
    await Promise.all(predictionPromises);

    // Resolve after a short delay (simulate time passing)
    await this.sleep(1000);
    const outcome = Math.random() > 0.5;
    const results = predictionMarketArena.resolveMarket(market.id, outcome);
    this.stats.marketsResolved++;

    // Update agent balances based on results
    for (const result of results) {
      const agent = this.agents.find(a => a.address === result.agentAddress);
      if (agent) {
        if (result.correct) {
          agent.balance += parseFloat(result.payout);
          agent.wins++;
        } else {
          agent.losses++;
        }
      }
    }

    const winners = results.filter(r => r.correct).length;
    log.info(`  Resolved: ${outcome ? "YES" : "NO"}, ${winners}/${results.length} correct`);
  }

  // ─── Trading Competition Round ────────────────────────────────────

  private async runTradingCompetitionRound(round: number): Promise<void> {
    log.info(`[Trading Competition] Round ${round + 1} starting`);

    const comp = tradingCompetitionArena.createCompetition(
      `Round ${round + 1} Battle`,
      300000, // 5 min
      "10",
      ["USDC", "ETH", "WETH", "cbBTC"]
    );
    this.stats.competitionsRun++;

    // All agents join
    for (const agent of this.agents) {
      tradingCompetitionArena.joinCompetition(comp.id, agent.address, agent.name, "100");
    }

    // LLM-powered trading rounds
    const allowedTokens = ["USDC", "ETH", "WETH", "cbBTC"];
    const tradeRounds = 3;

    for (let t = 0; t < tradeRounds && this.running; t++) {
      const tradePromises = this.agents.map(async (agent) => {
        try {
          const portfolio: Record<string, string> = { USDC: "100" };
          const decision = await agent.brain.decideTradeAction(portfolio, allowedTokens, t + 1, tradeRounds);

          if (decision.action !== "hold" && parseFloat(decision.amount) > 0) {
            const priceMultiplier = 0.95 + Math.random() * 0.1;
            const amountOut = (parseFloat(decision.amount) * priceMultiplier).toFixed(4);

            tradingCompetitionArena.recordTrade(comp.id, agent.address, {
              timestamp: Date.now(),
              tokenIn: decision.action === "buy" ? "USDC" : decision.token,
              tokenOut: decision.action === "buy" ? decision.token : "USDC",
              amountIn: decision.amount,
              amountOut,
              reasoning: decision.reasoning,
            });
            this.stats.tradesExecuted++;
            log.info(`  ${agent.name}: ${decision.action} ${decision.amount} ${decision.token} - ${decision.reasoning.slice(0, 60)}`);
          }
        } catch {
          // Fallback: random trade
          const tokenOut = allowedTokens[1 + Math.floor(Math.random() * (allowedTokens.length - 1))];
          tradingCompetitionArena.recordTrade(comp.id, agent.address, {
            timestamp: Date.now(), tokenIn: "USDC", tokenOut,
            amountIn: "10", amountOut: (10 * (0.95 + Math.random() * 0.1)).toFixed(4),
            reasoning: "fallback trade",
          });
          this.stats.tradesExecuted++;
        }
      });
      await Promise.all(tradePromises);

      tradingCompetitionArena.snapshotPortfolios(comp.id);
      await this.sleep(500);
    }

    // Simulate portfolio value changes
    for (const agent of this.agents) {
      const pnlPercent = -15 + Math.random() * 30; // -15% to +15%
      const newValue = (100 * (1 + pnlPercent / 100)).toFixed(2);
      tradingCompetitionArena.updatePortfolioValue(
        comp.id,
        agent.address,
        newValue,
        pnlPercent.toFixed(2)
      );
    }

    // End competition
    const result = tradingCompetitionArena.endCompetition(comp.id);
    const rankings = result?.rankings;
    if (rankings && rankings.length > 0) {
      const winner = this.agents.find(a => a.address === rankings[0].agentAddress);
      if (winner) {
        winner.wins++;
        winner.balance += 20;
        log.info(`  Winner: ${winner.name} (${rankings[0].finalValue} USDC)`);
      }
    }
  }

  // ─── Auction Round ────────────────────────────────────────────────

  private async runAuctionRound(round: number): Promise<void> {
    log.info(`[Auction House] Round ${round + 1} starting`);

    const session = auctionArena.createSession(
      `Round ${round + 1} Auction`,
      this.agents.map(a => a.address)
    );
    this.stats.sessionsRun++;

    // Generate items and create auctions
    const items = auctionArena.generateGameItems(3);
    const formats: Array<"english" | "sealed" | "vickrey"> = ["english", "sealed", "vickrey"];

    for (let i = 0; i < items.length; i++) {
      const format = formats[i % formats.length];
      const auction = auctionArena.addAuction(
        session.id,
        items[i],
        format,
        items[i].baseValue,
        60000 // 1 minute
      );
      if (!auction) continue;

      const auctionId = auction.id;
      const baseValue = parseFloat(items[i].baseValue);

      if (format === "english") {
        // English: LLM decides each round whether to raise
        let currentBid = baseValue;
        for (let bidRound = 0; bidRound < 3; bidRound++) {
          for (const agent of this.agents) {
            try {
              const decision = await agent.brain.decideAuctionBid(
                items[i].name, items[i].description || items[i].category,
                currentBid.toString(), agent.balance, "english"
              );
              if (!decision.bid || parseFloat(decision.amount) <= currentBid) continue;
              if (parseFloat(decision.amount) > agent.balance * 0.4) continue;

              auctionArena.placeBid(auctionId, agent.address, agent.name, decision.amount, decision.reasoning);
              this.stats.bidsPlaced++;
              currentBid = parseFloat(decision.amount);
              log.info(`  ${agent.name} bids ${decision.amount} on ${items[i].name}`);
            } catch { /* Bid rejected or LLM error */ }
          }
        }
        try { auctionArena.endAuction(auctionId); } catch { /* already ended */ }
      } else {
        // Sealed/Vickrey: LLM makes one-shot bid decision
        const bidPromises = this.agents.map(async (agent) => {
          try {
            const decision = await agent.brain.decideAuctionBid(
              items[i].name, items[i].description || items[i].category,
              baseValue.toString(), agent.balance, format
            );
            if (!decision.bid || parseFloat(decision.amount) <= 0) return;
            if (parseFloat(decision.amount) > agent.balance * 0.4) return;

            auctionArena.placeBid(auctionId, agent.address, agent.name, decision.amount, decision.reasoning);
            this.stats.bidsPlaced++;
          } catch { /* Bid rejected or LLM error */ }
        });
        await Promise.all(bidPromises);

        try {
          const auctionResult = auctionArena.resolveSealedAuction(auctionId);
          if (auctionResult) {
            const winner = this.agents.find(a => a.address === auctionResult.winner);
            if (winner) {
              winner.balance -= parseFloat(auctionResult.pricePaid);
              winner.wins++;
              log.info(`  ${items[i].name} (${format}): won by ${winner.name} for ${auctionResult.pricePaid}`);
            }
          }
        } catch { /* Resolution failed */ }
      }
    }
  }

  /** Record arena performance as ERC-8004 reputation feedback */
  private async recordArenaReputation(): Promise<void> {
    if (!isErc8004Configured()) return;

    for (const agent of this.agents) {
      // Calculate cross-arena performance score (0-100)
      const totalGames = agent.wins + agent.losses;
      if (totalGames === 0) continue;

      const winRate = agent.wins / totalGames;
      const score = Math.round(winRate * 100);

      try {
        // Submit reputation feedback with arena-specific tags
        await submitAgentFeedback(
          BigInt(0), // placeholder agentId (real ID from ERC-8004 registration)
          score,
          "multi_arena",
          `rounds:${this.stats.roundsCompleted}`,
          `balance:${agent.balance.toFixed(0)}`
        );
      } catch {
        // Non-blocking
      }
    }
  }

  private getUptime(): number {
    return this.startTime ? Math.round((Date.now() - this.startTime) / 1000) : 0;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

// Singleton
let multiArenaInstance: MultiArenaOrchestrator | null = null;

export function getMultiArenaOrchestrator(): MultiArenaOrchestrator | null {
  return multiArenaInstance;
}

export function createMultiArenaOrchestrator(config: ArenaSessionConfig = {}): MultiArenaOrchestrator {
  if (multiArenaInstance?.getStatus().running) {
    throw new Error("Multi-arena orchestrator is already running. Stop it first.");
  }
  multiArenaInstance = new MultiArenaOrchestrator(config);
  return multiArenaInstance;
}
