/**
 * TradingCompetitionArena - Head-to-head AI agent trading competitions
 *
 * Agents compete in time-limited trading competitions on Uniswap (Base).
 * Each agent starts with equal USDC and competes to maximize portfolio value.
 *
 * Features:
 *   - Create competitions with custom duration and entry fees
 *   - Track real-time portfolio values across all participants
 *   - Record trade reasoning from agent LLM decisions
 *   - Generate leaderboards and detailed competition results
 *   - Calculate profit/loss and performance metrics
 */

import { EventEmitter } from "events";
import { logger } from "../utils/logger.js";

const arenaLogger = logger.child("TradingCompetitionArena");

/**
 * Represents a single trade executed by an agent
 */
export interface TradeRecord {
  timestamp: number;
  tokenIn: string;
  tokenOut: string;
  amountIn: string;
  amountOut: string;
  reasoning: string;
}

/**
 * Represents an agent's portfolio during the competition
 */
export interface TraderPortfolio {
  agentAddress: string;
  agentName: string;
  holdings: Map<string, string>; // token -> amount
  tradeHistory: TradeRecord[];
  currentValue: string; // in USDC
  pnl: string; // profit/loss percentage
  joinedAt: number;
}

/**
 * Represents a snapshot of all portfolios at a specific round
 */
export interface TradingRound {
  roundNumber: number;
  timestamp: number;
  portfolioSnapshots: Map<string, string>; // agent -> portfolio value
  trades: TradeRecord[];
}

/**
 * Represents a complete trading competition
 */
export interface TradingCompetition {
  id: string;
  name: string;
  startTime: number;
  endTime: number;
  status: "pending" | "active" | "completed";
  entryFee: string; // USDC
  prizePool: string;
  allowedTokens: string[];
  participants: Map<string, TraderPortfolio>;
  rounds: TradingRound[];
  winner?: string;
}

/**
 * Represents a single entry in the final rankings
 */
export interface RankingEntry {
  rank: number;
  agentAddress: string;
  agentName: string;
  finalValue: string;
  pnl: string;
  totalTrades: number;
  bestTrade?: TradeRecord;
  worstTrade?: TradeRecord;
}

/**
 * Final results of a completed competition
 */
export interface CompetitionResult {
  competitionId: string;
  rankings: RankingEntry[];
  totalVolume: string;
  duration: number;
}

/**
 * TradingCompetitionArena - Manages trading competitions
 */
export class TradingCompetitionArena extends EventEmitter {
  private competitions: Map<string, TradingCompetition> = new Map();
  private competitionIdCounter = 0;

  constructor() {
    super();
    arenaLogger.info("TradingCompetitionArena initialized");
  }

  /**
   * Create a new trading competition
   */
  createCompetition(
    name: string,
    durationMs: number,
    entryFee: string,
    allowedTokens?: string[]
  ): TradingCompetition {
    const compId = `comp-${++this.competitionIdCounter}`;
    const startTime = Date.now();
    const endTime = startTime + durationMs;

    const competition: TradingCompetition = {
      id: compId,
      name,
      startTime,
      endTime,
      status: "pending",
      entryFee,
      prizePool: "0",
      allowedTokens: allowedTokens || ["USDC", "ETH", "WETH", "cbBTC"],
      participants: new Map(),
      rounds: [],
    };

    this.competitions.set(compId, competition);

    arenaLogger.info(`Competition created: ${compId}`, {
      name,
      durationMs,
      entryFee,
      allowedTokens: competition.allowedTokens,
    });

    this.emit("competition:created", { competitionId: compId, competition });

    return competition;
  }

  /**
   * Join an existing competition
   */
  joinCompetition(
    compId: string,
    agentAddress: string,
    agentName: string,
    initialBalance: string = "100"
  ): TraderPortfolio | null {
    const competition = this.competitions.get(compId);
    if (!competition) {
      arenaLogger.error(`Competition not found: ${compId}`);
      return null;
    }

    if (competition.status !== "pending" && competition.status !== "active") {
      arenaLogger.warn(
        `Cannot join competition ${compId}, status: ${competition.status}`
      );
      return null;
    }

    if (competition.participants.has(agentAddress)) {
      arenaLogger.warn(`Agent ${agentAddress} already in competition ${compId}`);
      return null;
    }

    const portfolio: TraderPortfolio = {
      agentAddress,
      agentName,
      holdings: new Map([["USDC", initialBalance]]),
      tradeHistory: [],
      currentValue: initialBalance,
      pnl: "0",
      joinedAt: Date.now(),
    };

    competition.participants.set(agentAddress, portfolio);

    // Update prize pool
    const currentPrize = parseFloat(competition.prizePool);
    const entryAmount = parseFloat(competition.entryFee);
    competition.prizePool = (currentPrize + entryAmount).toString();

    arenaLogger.info(`Agent joined competition: ${compId}/${agentAddress}`, {
      agentName,
      initialBalance,
    });

    this.emit("competition:agent-joined", {
      competitionId: compId,
      agentAddress,
      agentName,
    });

    // Auto-start competition if this is first participant
    if (
      competition.status === "pending" &&
      competition.participants.size === 1
    ) {
      this.startCompetition(compId);
    }

    return portfolio;
  }

  /**
   * Start an active competition (mark as active)
   */
  private startCompetition(compId: string): void {
    const competition = this.competitions.get(compId);
    if (!competition) return;

    if (competition.status !== "pending") {
      arenaLogger.warn(
        `Cannot start competition ${compId}, status: ${competition.status}`
      );
      return;
    }

    competition.status = "active";
    arenaLogger.info(`Competition started: ${compId}`, {
      participantCount: competition.participants.size,
    });

    this.emit("competition:started", { competitionId: compId });
  }

  /**
   * Record a trade for an agent
   */
  recordTrade(
    compId: string,
    agentAddress: string,
    trade: TradeRecord
  ): boolean {
    const competition = this.competitions.get(compId);
    if (!competition) {
      arenaLogger.error(`Competition not found: ${compId}`);
      return false;
    }

    const portfolio = competition.participants.get(agentAddress);
    if (!portfolio) {
      arenaLogger.error(
        `Agent not found in competition: ${compId}/${agentAddress}`
      );
      return false;
    }

    if (competition.status !== "active") {
      arenaLogger.warn(`Competition not active: ${compId}`);
      return false;
    }

    // Validate trade tokens are allowed
    if (
      !competition.allowedTokens.includes(trade.tokenIn) ||
      !competition.allowedTokens.includes(trade.tokenOut)
    ) {
      arenaLogger.warn(
        `Trade uses non-allowed tokens: ${trade.tokenIn} -> ${trade.tokenOut}`
      );
      return false;
    }

    // Record trade
    portfolio.tradeHistory.push(trade);

    // Update holdings
    const currentIn = parseFloat(portfolio.holdings.get(trade.tokenIn) || "0");
    const newInAmount = (currentIn - parseFloat(trade.amountIn)).toString();
    if (parseFloat(newInAmount) >= 0) {
      portfolio.holdings.set(trade.tokenIn, newInAmount);
    }

    const currentOut = parseFloat(portfolio.holdings.get(trade.tokenOut) || "0");
    const newOutAmount = (currentOut + parseFloat(trade.amountOut)).toString();
    portfolio.holdings.set(trade.tokenOut, newOutAmount);

    arenaLogger.debug(
      `Trade recorded for ${agentAddress} in ${compId}`,
      {
        tokenIn: trade.tokenIn,
        tokenOut: trade.tokenOut,
        amountIn: trade.amountIn,
        amountOut: trade.amountOut,
      }
    );

    this.emit("competition:trade-recorded", {
      competitionId: compId,
      agentAddress,
      trade,
    });

    return true;
  }

  /**
   * Take a snapshot of all portfolios at current time
   */
  snapshotPortfolios(compId: string): TradingRound | null {
    const competition = this.competitions.get(compId);
    if (!competition) {
      arenaLogger.error(`Competition not found: ${compId}`);
      return null;
    }

    const roundNumber = competition.rounds.length + 1;
    const portfolioSnapshots = new Map<string, string>();

    // Collect current values
    for (const [agentAddress, portfolio] of competition.participants) {
      portfolioSnapshots.set(agentAddress, portfolio.currentValue);
    }

    const round: TradingRound = {
      roundNumber,
      timestamp: Date.now(),
      portfolioSnapshots,
      trades: Array.from(competition.participants.values()).flatMap(
        (p) => p.tradeHistory
      ),
    };

    competition.rounds.push(round);

    arenaLogger.debug(`Portfolio snapshot taken for ${compId}`, {
      roundNumber,
      participants: portfolioSnapshots.size,
    });

    this.emit("competition:snapshot-taken", {
      competitionId: compId,
      round,
    });

    return round;
  }

  /**
   * Get current leaderboard for a competition
   */
  getLeaderboard(compId: string): RankingEntry[] {
    const competition = this.competitions.get(compId);
    if (!competition) {
      arenaLogger.error(`Competition not found: ${compId}`);
      return [];
    }

    const rankings: RankingEntry[] = Array.from(
      competition.participants.entries()
    )
      .map(([agentAddress, portfolio], index) => {
        const trades = portfolio.tradeHistory;
        const bestTrade = trades.length
          ? trades.reduce((best, trade) => {
              const bestValue =
                parseFloat(best.amountOut) / parseFloat(best.amountIn);
              const currentValue =
                parseFloat(trade.amountOut) / parseFloat(trade.amountIn);
              return currentValue > bestValue ? trade : best;
            })
          : undefined;

        const worstTrade = trades.length
          ? trades.reduce((worst, trade) => {
              const worstValue =
                parseFloat(worst.amountOut) / parseFloat(worst.amountIn);
              const currentValue =
                parseFloat(trade.amountOut) / parseFloat(trade.amountIn);
              return currentValue < worstValue ? trade : worst;
            })
          : undefined;

        return {
          rank: index + 1,
          agentAddress,
          agentName: portfolio.agentName,
          finalValue: portfolio.currentValue,
          pnl: portfolio.pnl,
          totalTrades: portfolio.tradeHistory.length,
          bestTrade,
          worstTrade,
        };
      })
      .sort(
        (a, b) =>
          parseFloat(b.finalValue) - parseFloat(a.finalValue)
      );

    // Update ranks after sorting
    rankings.forEach((entry, index) => {
      entry.rank = index + 1;
    });

    return rankings;
  }

  /**
   * Update portfolio value (called externally when values are updated)
   */
  updatePortfolioValue(
    compId: string,
    agentAddress: string,
    newValue: string,
    pnl: string
  ): boolean {
    const competition = this.competitions.get(compId);
    if (!competition) {
      arenaLogger.error(`Competition not found: ${compId}`);
      return false;
    }

    const portfolio = competition.participants.get(agentAddress);
    if (!portfolio) {
      arenaLogger.error(
        `Agent not found in competition: ${compId}/${agentAddress}`
      );
      return false;
    }

    portfolio.currentValue = newValue;
    portfolio.pnl = pnl;

    this.emit("competition:portfolio-updated", {
      competitionId: compId,
      agentAddress,
      newValue,
      pnl,
    });

    return true;
  }

  /**
   * End a competition and calculate final rankings
   */
  endCompetition(compId: string): CompetitionResult | null {
    const competition = this.competitions.get(compId);
    if (!competition) {
      arenaLogger.error(`Competition not found: ${compId}`);
      return null;
    }

    if (competition.status === "completed") {
      arenaLogger.warn(`Competition already completed: ${compId}`);
      return null;
    }

    competition.status = "completed";

    // Get final rankings
    const rankings = this.getLeaderboard(compId);

    // Set winner
    if (rankings.length > 0) {
      competition.winner = rankings[0].agentAddress;
    }

    // Calculate total volume
    const totalVolume = Array.from(competition.participants.values())
      .reduce((sum, portfolio) => {
        const trades = portfolio.tradeHistory.map((t) =>
          parseFloat(t.amountIn)
        );
        return (
          sum +
          trades.reduce((tradeSum, amount) => tradeSum + amount, 0)
        );
      }, 0)
      .toString();

    const duration = competition.endTime - competition.startTime;

    const result: CompetitionResult = {
      competitionId: compId,
      rankings,
      totalVolume,
      duration,
    };

    arenaLogger.info(`Competition ended: ${compId}`, {
      winner: competition.winner,
      participantCount: rankings.length,
      totalVolume,
      durationMs: duration,
    });

    this.emit("competition:ended", { competitionId: compId, result });

    return result;
  }

  /**
   * Get full state of a competition
   */
  getCompetitionState(compId: string): TradingCompetition | null {
    const competition = this.competitions.get(compId);
    if (!competition) {
      arenaLogger.error(`Competition not found: ${compId}`);
      return null;
    }

    return competition;
  }

  /**
   * Get all competitions
   */
  getAllCompetitions(): TradingCompetition[] {
    return Array.from(this.competitions.values());
  }

  /**
   * Get competition by status
   */
  getCompetitionsByStatus(
    status: "pending" | "active" | "completed"
  ): TradingCompetition[] {
    return Array.from(this.competitions.values()).filter(
      (comp) => comp.status === status
    );
  }

  /**
   * Check if a competition has ended
   */
  hasCompetitionEnded(compId: string): boolean {
    const competition = this.competitions.get(compId);
    if (!competition) return false;

    return Date.now() >= competition.endTime;
  }

  /**
   * Get time remaining for a competition (in ms)
   */
  getTimeRemaining(compId: string): number {
    const competition = this.competitions.get(compId);
    if (!competition) return 0;

    const remaining = competition.endTime - Date.now();
    return remaining > 0 ? remaining : 0;
  }
}

/**
 * Singleton instance of TradingCompetitionArena
 */
export const tradingCompetitionArena = new TradingCompetitionArena();
