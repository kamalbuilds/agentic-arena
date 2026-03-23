/**
 * Arena Routes - API endpoints for the multi-arena Colosseum
 *
 * Exposes three arena types beyond Social Deduction:
 * - Prediction Markets: agents bet on outcomes
 * - Trading Competitions: head-to-head portfolio battles
 * - Auctions: strategic bidding with game items
 */

import { Router, Request, Response } from "express";
import { predictionMarketArena } from "../arenas/PredictionMarketArena.js";
import { tradingCompetitionArena } from "../arenas/TradingCompetitionArena.js";
import { auctionArena } from "../arenas/AuctionArena.js";
import { arenaFramework } from "../game/ArenaFramework.js";
import {
  createMultiArenaOrchestrator,
  getMultiArenaOrchestrator,
} from "../agents/MultiArenaOrchestrator.js";
import { logger } from "../utils/logger.js";

const log = logger.child("ArenaRoutes");
export const arenaRouter = Router();

function p(param: string | string[] | undefined): string {
  if (Array.isArray(param)) return param[0];
  return param || "";
}

// ─── Arena Framework Overview ───────────────────────────────────────

arenaRouter.get("/api/arenas", (_req: Request, res: Response) => {
  const framework = arenaFramework.getState();
  const predictions = predictionMarketArena.getState();
  const auctions = auctionArena.getState();
  const tradingComps = tradingCompetitionArena.getAllCompetitions();

  res.json({
    framework,
    arenaTypes: {
      predictionMarkets: predictions,
      tradingCompetitions: {
        total: tradingComps.length,
        active: tradingComps.filter(c => c.status === "active").length,
        completed: tradingComps.filter(c => c.status === "completed").length,
      },
      auctions,
    },
  });
});

// ─── Prediction Market Endpoints ────────────────────────────────────

arenaRouter.post("/api/arenas/predictions/markets", (req: Request, res: Response) => {
  try {
    const { question, category, resolvesInMs } = req.body;
    if (!question) {
      res.status(400).json({ error: "question is required" });
      return;
    }
    const resolvesAt = Date.now() + (resolvesInMs || 3600000);
    const market = predictionMarketArena.createMarket(
      question,
      category || "custom",
      resolvesAt
    );
    log.info(`Market created: ${market.id} - ${question}`);
    res.json(market);
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

arenaRouter.post("/api/arenas/predictions/markets/auto", (_req: Request, res: Response) => {
  try {
    const market = predictionMarketArena.generateCryptoMarket();
    log.info(`Auto-generated market: ${market.id} - ${market.question}`);
    res.json(market);
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

arenaRouter.get("/api/arenas/predictions/markets", (req: Request, res: Response) => {
  const status = req.query.status as string | undefined;
  const filter = status === "active" ? "active" : status === "resolved" ? "resolved" : undefined;
  res.json(predictionMarketArena.getAllMarkets(filter));
});

arenaRouter.get("/api/arenas/predictions/markets/:id", (req: Request, res: Response) => {
  const id = p(req.params.id);
  const market = predictionMarketArena.getMarket(id);
  if (!market) {
    res.status(404).json({ error: "Market not found" });
    return;
  }
  res.json(predictionMarketArena.getMarketState(id));
});

arenaRouter.post("/api/arenas/predictions/markets/:id/predict", (req: Request, res: Response) => {
  try {
    const { agentAddress, agentName, prediction, confidence, stake, reasoning } = req.body;
    if (!agentAddress || !agentName || prediction === undefined) {
      res.status(400).json({ error: "agentAddress, agentName, prediction required" });
      return;
    }
    const id = p(req.params.id);
    predictionMarketArena.placePrediction(
      id,
      agentAddress,
      agentName,
      Boolean(prediction),
      confidence || 50,
      stake || "0",
      reasoning || "No reasoning provided"
    );
    res.json({ success: true, marketId: id });
  } catch (err) {
    res.status(400).json({ error: String(err) });
  }
});

arenaRouter.post("/api/arenas/predictions/markets/:id/resolve", (req: Request, res: Response) => {
  try {
    const { outcome } = req.body;
    if (outcome === undefined) {
      res.status(400).json({ error: "outcome (true/false) required" });
      return;
    }
    const id = p(req.params.id);
    const results = predictionMarketArena.resolveMarket(id, Boolean(outcome));
    log.info(`Market ${id} resolved: ${outcome ? "YES" : "NO"}, ${results.length} predictions`);
    res.json({ results });
  } catch (err) {
    res.status(400).json({ error: String(err) });
  }
});

arenaRouter.get("/api/arenas/predictions/stats/:address", (req: Request, res: Response) => {
  const stats = predictionMarketArena.getAgentStats(p(req.params.address));
  res.json(stats || { error: "No stats for this agent" });
});

arenaRouter.get("/api/arenas/predictions/leaderboard", (_req: Request, res: Response) => {
  res.json(predictionMarketArena.getAllAgentStats());
});

// ─── Trading Competition Endpoints ──────────────────────────────────

arenaRouter.post("/api/arenas/trading/competitions", (req: Request, res: Response) => {
  try {
    const { name, durationMs, entryFee, allowedTokens } = req.body;
    if (!name) {
      res.status(400).json({ error: "name is required" });
      return;
    }
    const comp = tradingCompetitionArena.createCompetition(
      name,
      durationMs || 1800000,
      entryFee || "10",
      allowedTokens
    );
    log.info(`Trading competition created: ${comp.id} - ${name}`);
    res.json({
      id: comp.id,
      name: comp.name,
      startTime: comp.startTime,
      endTime: comp.endTime,
      status: comp.status,
      entryFee: comp.entryFee,
    });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

arenaRouter.post("/api/arenas/trading/competitions/:id/join", (req: Request, res: Response) => {
  try {
    const { agentAddress, agentName, initialBalance } = req.body;
    if (!agentAddress || !agentName) {
      res.status(400).json({ error: "agentAddress and agentName required" });
      return;
    }
    const id = p(req.params.id);
    tradingCompetitionArena.joinCompetition(id, agentAddress, agentName, initialBalance || "100");
    res.json({ success: true, competitionId: id });
  } catch (err) {
    res.status(400).json({ error: String(err) });
  }
});

arenaRouter.post("/api/arenas/trading/competitions/:id/trade", (req: Request, res: Response) => {
  try {
    const { agentAddress, tokenIn, tokenOut, amountIn, amountOut, reasoning } = req.body;
    if (!agentAddress || !tokenIn || !tokenOut) {
      res.status(400).json({ error: "agentAddress, tokenIn, tokenOut required" });
      return;
    }
    tradingCompetitionArena.recordTrade(p(req.params.id), agentAddress, {
      timestamp: Date.now(),
      tokenIn,
      tokenOut,
      amountIn: amountIn || "0",
      amountOut: amountOut || "0",
      reasoning: reasoning || "",
    });
    res.json({ success: true });
  } catch (err) {
    res.status(400).json({ error: String(err) });
  }
});

arenaRouter.get("/api/arenas/trading/competitions/:id", (req: Request, res: Response) => {
  const state = tradingCompetitionArena.getCompetitionState(p(req.params.id));
  if (!state) {
    res.status(404).json({ error: "Competition not found" });
    return;
  }
  res.json(state);
});

arenaRouter.get("/api/arenas/trading/competitions/:id/leaderboard", (req: Request, res: Response) => {
  try {
    const leaderboard = tradingCompetitionArena.getLeaderboard(p(req.params.id));
    res.json(leaderboard);
  } catch (err) {
    res.status(404).json({ error: String(err) });
  }
});

arenaRouter.post("/api/arenas/trading/competitions/:id/end", (req: Request, res: Response) => {
  try {
    const id = p(req.params.id);
    const result = tradingCompetitionArena.endCompetition(id);
    const winnerName = result?.rankings?.[0]?.agentName || "none";
    log.info(`Trading competition ${id} ended. Winner: ${winnerName}`);
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: String(err) });
  }
});

arenaRouter.get("/api/arenas/trading/competitions", (req: Request, res: Response) => {
  const status = req.query.status as string | undefined;
  if (status) {
    res.json(tradingCompetitionArena.getCompetitionsByStatus(status as "pending" | "active" | "completed"));
  } else {
    res.json(tradingCompetitionArena.getAllCompetitions());
  }
});

// ─── Auction Endpoints ──────────────────────────────────────────────

arenaRouter.post("/api/arenas/auctions/sessions", (req: Request, res: Response) => {
  try {
    const { name, participants } = req.body;
    if (!name) {
      res.status(400).json({ error: "name is required" });
      return;
    }
    const session = auctionArena.createSession(name, participants || []);
    log.info(`Auction session created: ${session.id} - ${name}`);
    res.json({
      id: session.id,
      name: session.name,
      status: session.status,
      participantCount: session.participants.size,
    });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

arenaRouter.post("/api/arenas/auctions/sessions/:id/auction", (req: Request, res: Response) => {
  try {
    const { item, format, startingPrice, durationMs } = req.body;
    if (!item || !format) {
      res.status(400).json({ error: "item and format required" });
      return;
    }
    const auction = auctionArena.addAuction(
      p(req.params.id),
      item,
      format,
      startingPrice || "10",
      durationMs || 300000
    );
    res.json(auction);
  } catch (err) {
    res.status(400).json({ error: String(err) });
  }
});

arenaRouter.post("/api/arenas/auctions/sessions/:sessionId/auto-generate", (req: Request, res: Response) => {
  try {
    const { count, format } = req.body;
    const sessionId = p(req.params.sessionId);
    const items = auctionArena.generateGameItems(count || 5);
    const auctions = items.map((item) =>
      auctionArena.addAuction(sessionId, item, format || "english", item.baseValue, 300000)
    );
    res.json({ generated: auctions.length, auctions });
  } catch (err) {
    res.status(400).json({ error: String(err) });
  }
});

arenaRouter.post("/api/arenas/auctions/:id/bid", (req: Request, res: Response) => {
  try {
    const { agentAddress, agentName, amount, reasoning } = req.body;
    if (!agentAddress || !agentName || !amount) {
      res.status(400).json({ error: "agentAddress, agentName, amount required" });
      return;
    }
    auctionArena.placeBid(p(req.params.id), agentAddress, agentName, amount, reasoning || "");
    res.json({ success: true });
  } catch (err) {
    res.status(400).json({ error: String(err) });
  }
});

arenaRouter.post("/api/arenas/auctions/:id/resolve", (req: Request, res: Response) => {
  try {
    const result = auctionArena.resolveSealedAuction(p(req.params.id));
    res.json(result || { error: "No result" });
  } catch (err) {
    res.status(400).json({ error: String(err) });
  }
});

arenaRouter.get("/api/arenas/auctions/sessions/:id", (req: Request, res: Response) => {
  try {
    const results = auctionArena.getSessionResults(p(req.params.id));
    res.json(results);
  } catch (err) {
    res.status(404).json({ error: String(err) });
  }
});

arenaRouter.get("/api/arenas/auctions/items", (_req: Request, res: Response) => {
  const count = parseInt(_req.query.count as string) || 10;
  res.json(auctionArena.generateGameItems(count));
});

// ─── Multi-Arena Orchestrator ───────────────────────────────────────

arenaRouter.post("/api/arenas/orchestrate/start", (req: Request, res: Response) => {
  try {
    const { agentCount, predictionMarkets, tradingCompetitions, auctions, roundsPerArena } = req.body;
    const orchestrator = createMultiArenaOrchestrator({
      agentCount,
      predictionMarkets,
      tradingCompetitions,
      auctions,
      roundsPerArena,
    });
    orchestrator.start().catch(err => log.error("Multi-arena orchestrator error", err));
    res.json({ success: true, message: "Multi-arena orchestrator started", status: orchestrator.getStatus() });
  } catch (err) {
    res.status(400).json({ error: String(err) });
  }
});

arenaRouter.post("/api/arenas/orchestrate/stop", (_req: Request, res: Response) => {
  const orchestrator = getMultiArenaOrchestrator();
  if (!orchestrator) {
    res.status(404).json({ error: "No orchestrator running" });
    return;
  }
  orchestrator.stop();
  res.json({ success: true, status: orchestrator.getStatus() });
});

arenaRouter.get("/api/arenas/orchestrate/status", (_req: Request, res: Response) => {
  const orchestrator = getMultiArenaOrchestrator();
  if (!orchestrator) {
    res.json({ running: false, message: "No orchestrator initialized" });
    return;
  }
  res.json(orchestrator.getStatus());
});

// ─── Cross-Arena Leaderboard ────────────────────────────────────────

// Quick demo: create one of each arena type instantly
arenaRouter.post("/api/arenas/demo", async (_req: Request, res: Response) => {
  try {
    // Create a prediction market
    const market = predictionMarketArena.generateCryptoMarket();

    // Create a trading competition
    const comp = tradingCompetitionArena.createCompetition("Demo Battle", 600000, "10", undefined);

    // Create an auction session with auto items
    const session = auctionArena.createSession("Demo Auction", []);
    const items = auctionArena.generateGameItems(3);
    const auctions = items.map((item) =>
      auctionArena.addAuction(session.id, item, "english", item.baseValue, 300000)
    );

    log.info("Demo created: 1 market + 1 competition + 3 auctions");
    res.json({
      success: true,
      demo: {
        predictionMarket: { id: market.id, question: market.question },
        tradingCompetition: { id: comp.id, name: comp.name },
        auctionSession: { id: session.id, auctionCount: auctions.length },
      },
    });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

arenaRouter.get("/api/arenas/leaderboard", (_req: Request, res: Response) => {
  // Aggregate agent performance across all arena types
  const predictionStats = predictionMarketArena.getAllAgentStats();
  const allComps = tradingCompetitionArena.getAllCompetitions();

  // Build cross-arena agent map
  const agentMap = new Map<string, {
    name: string;
    address: string;
    predictions: { total: number; correct: number; accuracy: number };
    trading: { competitions: number; wins: number; totalPnl: number };
    auctions: { bidsPlaced: number; itemsWon: number };
    overallScore: number;
  }>();

  // Add prediction stats
  for (const stat of predictionStats) {
    agentMap.set(stat.agentAddress, {
      name: stat.agentName,
      address: stat.agentAddress,
      predictions: {
        total: stat.totalPredictions,
        correct: stat.correctPredictions,
        accuracy: stat.accuracy,
      },
      trading: { competitions: 0, wins: 0, totalPnl: 0 },
      auctions: { bidsPlaced: 0, itemsWon: 0 },
      overallScore: stat.accuracy * 0.4, // 40% weight for prediction accuracy
    });
  }

  // Add trading stats from completed competitions
  for (const comp of allComps.filter(c => c.status === "completed")) {
    const participants = Array.from(comp.participants.values());
    for (const participant of participants) {
      const existing = agentMap.get(participant.agentAddress);
      const pnl = parseFloat(participant.pnl || "0");
      if (existing) {
        existing.trading.competitions++;
        existing.trading.totalPnl += pnl;
        existing.overallScore += pnl > 0 ? 20 : 0; // 20 points for profitable competition
      } else {
        agentMap.set(participant.agentAddress, {
          name: participant.agentName,
          address: participant.agentAddress,
          predictions: { total: 0, correct: 0, accuracy: 0 },
          trading: { competitions: 1, wins: 0, totalPnl: pnl },
          auctions: { bidsPlaced: 0, itemsWon: 0 },
          overallScore: pnl > 0 ? 20 : 0,
        });
      }
    }
  }

  // Sort by overall score
  const leaderboard = Array.from(agentMap.values())
    .sort((a, b) => b.overallScore - a.overallScore)
    .map((agent, i) => ({ rank: i + 1, ...agent }));

  res.json({
    leaderboard,
    lastUpdated: Date.now(),
    arenaCount: 4,
  });
});
