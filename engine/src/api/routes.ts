import { Router, type Request, type Response } from "express";
import { gameManager } from "../game/GameManager.js";
import { GameRoom } from "../game/GameRoom.js";
import { wireGameEvents } from "../ws/server.js";
import { wireMoltbookEvents } from "../moltbook/MoltbookBroadcaster.js";
import { wireTwitterEvents } from "../services/TwitterBroadcaster.js";
import {
  authMiddleware,
  verifySignature,
  buildSignatureMessage,
  type AuthenticatedRequest,
} from "../utils/auth.js";
import { getAgentStats, getTopAgents, placeBetOnChain } from "../chain/contract.js";
import { getOrCreateAgentWallet, listAgentWallets } from "../chain/agentkit-wallet.js";
import {
  registerAgentIdentity,
  getAgentReputationSummary,
  isErc8004Configured,
} from "../chain/erc8004.js";
import { config } from "../config.js";
import { logger } from "../utils/logger.js";
import { getDbLeaderboard } from "../persistence/gameStore.js";
import { saveBet } from "../persistence/colosseumStore.js";
import { GamePhase } from "../game/PhaseManager.js";

const routeLogger = logger.child("API");
const router = Router();

function getParam(param: string | string[] | undefined): string {
  if (Array.isArray(param)) return param[0];
  return param || "";
}

// ──────────────────────────────────────────
// POST /api/games - Create new game
// ──────────────────────────────────────────
router.post("/api/games", async (req: Request, res: Response) => {
  try {
    const {
      stake,
      minPlayers,
      maxPlayers,
      impostorCount,
      maxRounds,
    } = req.body;

    const room = await gameManager.createGame({
      stake: stake ? BigInt(stake) : undefined,
      minPlayers: minPlayers ? parseInt(minPlayers, 10) : undefined,
      maxPlayers: maxPlayers ? parseInt(maxPlayers, 10) : undefined,
      impostorCount: impostorCount ? parseInt(impostorCount, 10) : undefined,
      maxRounds: maxRounds ? parseInt(maxRounds, 10) : undefined,
    });

    // Wire WebSocket + Moltbook + Twitter events
    wireGameEvents(room);
    wireMoltbookEvents(room);
    wireTwitterEvents(room);

    routeLogger.info(`Game created via API: ${room.gameId}`);

    res.status(201).json({
      gameId: room.gameId,
      chainGameId: room.chainGameId?.toString() || null,
      phase: "Lobby",
      players: 0,
    });
  } catch (err) {
    routeLogger.error("Failed to create game", err);
    res.status(500).json({ error: "Failed to create game" });
  }
});

// ──────────────────────────────────────────
// GET /api/games - List all games (active + completed)
// ──────────────────────────────────────────
router.get("/api/games", (_req: Request, res: Response) => {
  try {
    // In-memory games (active + recently completed)
    const inMemoryIds = new Set<string>();
    const games = gameManager.getAllGames().map((g) => {
      inMemoryIds.add(g.gameId);
      const state = g.getState();
      return {
        gameId: g.gameId,
        chainGameId: state.chainGameId,
        phase: g.phase,
        playerCount: g.getPlayerCount(),
        aliveCount: g.getAliveCount(),
        roundNumber: g.roundNumber,
        maxPlayers: state.maxPlayers,
        totalStake: state.totalStake,
        stakePerPlayer: state.stakePerPlayer,
        spectatorCount: g.spectators.size,
        result: state.result,
        winner: state.result === 1 ? "lobsters" : state.result === 2 ? "impostor" : null,
      };
    });

    // Append DB completed games (skip duplicates)
    for (const sg of gameManager.getCompletedGamesFromDb()) {
      if (inMemoryIds.has(sg.gameId)) continue;
      const stakePerPlayer = parseFloat(sg.stakePerPlayer) || 0;
      games.push({
        gameId: sg.gameId,
        chainGameId: sg.chainGameId,
        phase: GamePhase.End,
        playerCount: sg.players.length,
        aliveCount: sg.players.filter((p) => p.alive).length,
        roundNumber: sg.roundNumber,
        maxPlayers: sg.maxPlayers,
        totalStake: (stakePerPlayer * sg.players.length).toFixed(4),
        stakePerPlayer: sg.stakePerPlayer,
        spectatorCount: 0,
        result: sg.result,
        winner: sg.result === 1 ? "lobsters" : sg.result === 2 ? "impostor" : null,
      });
    }

    res.json({ games, count: games.length });
  } catch (err) {
    routeLogger.error("Failed to list games", err);
    res.status(500).json({ error: "Failed to list games" });
  }
});

// ──────────────────────────────────────────
// GET /api/games/:id - Get game state
// ──────────────────────────────────────────
router.get("/api/games/:id", (req: Request, res: Response) => {
  try {
    const gameId = getParam(req.params.id);

    // Try in-memory game first (active or recently completed)
    const room = gameManager.getGame(gameId);
    if (room) {
      const forAgent = req.query.agent as `0x${string}` | undefined;
      const state = room.getState(forAgent);
      res.json(state);
      return;
    }

    // Fall back to DB-stored completed game
    const dbGame = gameManager.getCompletedGamesFromDb().find(
      (g) => g.gameId === gameId
    );
    if (dbGame) {
      const stakePerPlayer = parseFloat(dbGame.stakePerPlayer) || 0;
      res.json({
        gameId: dbGame.gameId,
        chainGameId: dbGame.chainGameId,
        phase: GamePhase.End,
        phaseName: "End",
        roundNumber: dbGame.roundNumber,
        maxRounds: dbGame.maxRounds,
        maxPlayers: dbGame.maxPlayers,
        totalStake: (stakePerPlayer * dbGame.players.length).toFixed(4),
        stakePerPlayer: dbGame.stakePerPlayer,
        players: dbGame.players.map((p) => ({
          address: p.address,
          name: p.name,
          alive: p.alive,
          role: p.role,
        })),
        messages: dbGame.messages || [],
        remainingTime: 0,
        result: dbGame.result,
        eliminations: dbGame.eliminations || [],
        voteHistory: dbGame.voteHistory || [],
        spectatorCount: 0,
      });
      return;
    }

    res.status(404).json({ error: "Game not found" });
  } catch (err) {
    routeLogger.error("Failed to get game state", err);
    res.status(500).json({ error: "Failed to get game state" });
  }
});

// ──────────────────────────────────────────
// POST /api/games/:id/join - Join game
// ──────────────────────────────────────────
router.post(
  "/api/games/:id/join",
  authMiddleware,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { name } = req.body;
      const address = req.authenticatedAddress!;

      if (!name || typeof name !== "string" || name.length < 1) {
        res.status(400).json({ error: "Name is required" });
        return;
      }

      const joined = await gameManager.joinGame(getParam(req.params.id), address, name);

      if (!joined) {
        res.status(400).json({ error: "Failed to join game" });
        return;
      }

      routeLogger.info(
        `${name} (${address}) joined game ${getParam(req.params.id)}`
      );

      res.json({
        success: true,
        gameId: getParam(req.params.id),
        address,
        name,
      });
    } catch (err) {
      routeLogger.error("Failed to join game", err);
      res.status(500).json({ error: "Failed to join game" });
    }
  }
);

// ──────────────────────────────────────────
// POST /api/games/:id/start - Manually start game
// ──────────────────────────────────────────
router.post("/api/games/:id/start", async (req: Request, res: Response) => {
  try {
    const room = gameManager.getGame(getParam(req.params.id));
    if (!room) {
      res.status(404).json({ error: "Game not found" });
      return;
    }

    if (!room.canStart()) {
      res.status(400).json({
        error: "Cannot start game: not enough players or wrong phase",
      });
      return;
    }

    await room.start();

    res.json({
      success: true,
      gameId: room.gameId,
      phase: "Discussion",
      roundNumber: room.roundNumber,
      playerCount: room.getPlayerCount(),
    });
  } catch (err) {
    routeLogger.error("Failed to start game", err);
    res.status(500).json({ error: "Failed to start game" });
  }
});

// ──────────────────────────────────────────
// POST /api/games/:id/discuss - Submit message
// ──────────────────────────────────────────
router.post(
  "/api/games/:id/discuss",
  authMiddleware,
  (req: AuthenticatedRequest, res: Response) => {
    try {
      const { message } = req.body;
      const address = req.authenticatedAddress!;

      if (!message || typeof message !== "string") {
        res.status(400).json({ error: "Message is required" });
        return;
      }

      const room = gameManager.getGame(getParam(req.params.id));
      if (!room) {
        res.status(404).json({ error: "Game not found" });
        return;
      }

      const gameMessage = room.submitMessage(address, message);
      if (!gameMessage) {
        res.status(400).json({ error: "Cannot send message" });
        return;
      }

      res.json({ success: true, message: gameMessage });
    } catch (err) {
      routeLogger.error("Failed to submit message", err);
      res.status(500).json({ error: "Failed to submit message" });
    }
  }
);

// ──────────────────────────────────────────
// POST /api/games/:id/investigate - Investigate agent
// ──────────────────────────────────────────
router.post(
  "/api/games/:id/investigate",
  authMiddleware,
  (req: AuthenticatedRequest, res: Response) => {
    try {
      const { target } = req.body;
      const address = req.authenticatedAddress!;

      if (!target) {
        res.status(400).json({ error: "Target address is required" });
        return;
      }

      const room = gameManager.getGame(getParam(req.params.id));
      if (!room) {
        res.status(404).json({ error: "Game not found" });
        return;
      }

      const result = room.investigate(address, target as `0x${string}`);
      if (!result) {
        res.status(400).json({ error: "Cannot investigate" });
        return;
      }

      // Return result without accuracy info (agent sees reported result only)
      res.json({
        success: true,
        scanner: result.scanner,
        target: result.target,
        result: result.result,
      });
    } catch (err) {
      routeLogger.error("Failed to investigate", err);
      res.status(500).json({ error: "Failed to investigate" });
    }
  }
);

// ──────────────────────────────────────────
// POST /api/games/:id/vote - Cast vote
// ──────────────────────────────────────────
router.post(
  "/api/games/:id/vote",
  authMiddleware,
  (req: AuthenticatedRequest, res: Response) => {
    try {
      const { target } = req.body;
      const address = req.authenticatedAddress!;

      if (!target) {
        res.status(400).json({ error: "Target address is required" });
        return;
      }

      const room = gameManager.getGame(getParam(req.params.id));
      if (!room) {
        res.status(404).json({ error: "Game not found" });
        return;
      }

      const voted = room.submitVote(address, target as `0x${string}`);
      if (!voted) {
        res.status(400).json({ error: "Cannot vote" });
        return;
      }

      res.json({
        success: true,
        voter: address,
        target,
      });
    } catch (err) {
      routeLogger.error("Failed to cast vote", err);
      res.status(500).json({ error: "Failed to cast vote" });
    }
  }
);

// ──────────────────────────────────────────
// GET /api/agents/:address - Agent profile
// ──────────────────────────────────────────
router.get("/api/agents/:address", async (req: Request, res: Response) => {
  try {
    const address = getParam(req.params.address) as `0x${string}`;

    // Try to get on-chain stats
    if (config.contracts.leaderboard) {
      try {
        const stats = await getAgentStats(address);
        res.json({
          address,
          stats: {
            gamesPlayed: stats.gamesPlayed.toString(),
            gamesWon: stats.gamesWon.toString(),
            impostorGames: stats.impostorGames.toString(),
            impostorWins: stats.impostorWins.toString(),
            crewmateGames: stats.crewmateGames.toString(),
            crewmateWins: stats.crewmateWins.toString(),
            totalEarned: stats.totalEarned.toString(),
            totalStaked: stats.totalStaked.toString(),
          },
        });
        return;
      } catch {
        // Fall through to local data
      }
    }

    // Return local game data
    const games = gameManager.getGamesByPlayer(address);
    res.json({
      address,
      activeGames: games.filter((g) => g.result === 0).length,
      totalGames: games.length,
      stats: null,
    });
  } catch (err) {
    routeLogger.error("Failed to get agent profile", err);
    res.status(500).json({ error: "Failed to get agent profile" });
  }
});

// ──────────────────────────────────────────
// GET /api/leaderboard - Top agents
// ──────────────────────────────────────────
router.get("/api/leaderboard", async (_req: Request, res: Response) => {
  try {
    if (config.contracts.leaderboard) {
      try {
        const topAgents = await getTopAgents(BigInt(20));
        const typedAgents = topAgents as readonly { agent: `0x${string}`; gamesWon: bigint; totalEarned: bigint }[];

        // Enrich each agent with full stats
        const leaderboard = await Promise.all(
          typedAgents
            .filter((a) => a.agent !== "0x0000000000000000000000000000000000000000")
            .map(async (a, i) => {
              try {
                const stats = await getAgentStats(a.agent);
                const gamesPlayed = Number(stats.gamesPlayed);
                const gamesWon = Number(stats.gamesWon);
                const impostorGames = Number(stats.impostorGames);
                const impostorWins = Number(stats.impostorWins);

                // Look up name from active games
                const name = gameManager.getPlayerName(a.agent) ||
                  `${a.agent.slice(0, 6)}...${a.agent.slice(-4)}`;

                return {
                  rank: i + 1,
                  address: a.agent,
                  name,
                  elo: 1000 + gamesWon * 25,
                  gamesPlayed,
                  wins: gamesWon,
                  winRate: gamesPlayed > 0 ? Math.round((gamesWon / gamesPlayed) * 100) : 0,
                  impostorWinRate: impostorGames > 0 ? Math.round((impostorWins / impostorGames) * 100) : 0,
                  earnings: (Number(stats.totalEarned) / 1e18).toFixed(4),
                };
              } catch {
                return {
                  rank: i + 1,
                  address: a.agent,
                  name: `${a.agent.slice(0, 6)}...${a.agent.slice(-4)}`,
                  elo: 1000 + Number(a.gamesWon) * 25,
                  gamesPlayed: 0,
                  wins: Number(a.gamesWon),
                  winRate: 0,
                  impostorWinRate: 0,
                  earnings: (Number(a.totalEarned) / 1e18).toFixed(4),
                };
              }
            })
        );

        res.json({ leaderboard });
        return;
      } catch (err) {
        routeLogger.warn("On-chain leaderboard read failed", err instanceof Error ? err.message : "");
      }
    }

    // Tier 2: DB leaderboard (persisted across restarts)
    const dbLeaderboard = await getDbLeaderboard();
    if (dbLeaderboard && dbLeaderboard.length > 0) {
      res.json({ leaderboard: dbLeaderboard });
      return;
    }

    // Tier 3: in-memory fallback (current session only)
    const localLeaderboard = gameManager.getLocalLeaderboard();
    res.json({ leaderboard: localLeaderboard });
  } catch (err) {
    routeLogger.error("Failed to get leaderboard", err);
    res.status(500).json({ error: "Failed to get leaderboard" });
  }
});

// ──────────────────────────────────────────
// POST /api/bets - Place bet
// ──────────────────────────────────────────
router.post(
  "/api/bets",
  authMiddleware,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { gameId, betType, predictedAgent, amount } = req.body;
      const address = req.authenticatedAddress!;

      if (!gameId || betType === undefined || !amount) {
        res.status(400).json({ error: "Missing required fields" });
        return;
      }

      const room = gameManager.getGame(gameId);
      if (!room) {
        res.status(404).json({ error: "Game not found" });
        return;
      }

      if (!config.contracts.betting) {
        res.status(503).json({ error: "Betting contract not configured" });
        return;
      }

      try {
        const txHash = await placeBetOnChain(
          BigInt(gameId),
          parseInt(betType, 10),
          (predictedAgent || "0x0000000000000000000000000000000000000000") as `0x${string}`,
          BigInt(amount)
        );

        // Persist bet to DB for analytics (non-blocking)
        saveBet({
          gameId,
          bettor: address,
          betType: parseInt(betType, 10),
          predictedAgent: predictedAgent || null,
          amount: String(amount),
          chainTxHash: txHash,
        }).catch((err) => routeLogger.error("Failed to save bet to DB", err));

        res.json({
          success: true,
          txHash,
          bettor: address,
          gameId,
          betType,
          amount,
        });
      } catch (err) {
        routeLogger.error("Failed to place bet on-chain", err);
        res.status(500).json({ error: "Failed to place bet on-chain" });
      }
    } catch (err) {
      routeLogger.error("Failed to place bet", err);
      res.status(500).json({ error: "Failed to place bet" });
    }
  }
);

// ──────────────────────────────────────────
// POST /api/demo - Launch a quick demo game with simulated agents
// ──────────────────────────────────────────
router.post("/api/demo", async (_req: Request, res: Response) => {
  try {
    const room = await gameManager.createGame({
      minPlayers: 5,
      maxPlayers: 5,
      impostorCount: 1,
      maxRounds: 3,
      onChainEnabled: false, // off-chain for speed
    });

    wireGameEvents(room);
    wireMoltbookEvents(room);
    wireTwitterEvents(room);

    // Generate 5 demo agents with deterministic addresses
    const demoAgents = [
      { name: "ClawMaster", address: "0x1111111111111111111111111111111111111111" as `0x${string}` },
      { name: "ShellShock", address: "0x2222222222222222222222222222222222222222" as `0x${string}` },
      { name: "PinchPoint", address: "0x3333333333333333333333333333333333333333" as `0x${string}` },
      { name: "TideBreaker", address: "0x4444444444444444444444444444444444444444" as `0x${string}` },
      { name: "ReefRunner", address: "0x5555555555555555555555555555555555555555" as `0x${string}` },
    ];

    for (const agent of demoAgents) {
      room.addPlayer(agent.address, agent.name);
    }

    // Start game immediately
    await room.start();

    // Simulate discussion messages after a short delay
    setTimeout(() => simulateDemoGame(room, demoAgents), 1000);

    res.status(201).json({
      gameId: room.gameId,
      phase: "Discussion",
      players: demoAgents.map((a) => a.name),
      message: "Demo game started! Watch it live on the frontend.",
    });
  } catch (err) {
    routeLogger.error("Failed to launch demo", err);
    res.status(500).json({ error: "Failed to launch demo" });
  }
});

async function simulateDemoGame(
  room: GameRoom,
  agents: Array<{ name: string; address: `0x${string}` }>
): Promise<void> {
  const discussionMessages = [
    "I've been watching everyone carefully. Something feels off.",
    "My scan results are interesting. Let me share what I found.",
    "That's a bold claim. Can anyone verify?",
    "The impostor is trying to blend in. Look at who's deflecting!",
    "I trust the evidence. Let's vote based on facts, not feelings.",
    "Hmm, that defense seems rehearsed. Suspicious.",
    "I investigated and found something worth discussing.",
    "We need to work together or the impostor wins.",
    "Who hasn't spoken up yet? Silence is suspicious.",
    "Let's cross-reference our scan results before voting.",
    "I'm pretty sure I know who the impostor is. Let's be strategic.",
    "Don't let smooth talk fool you — watch the actions.",
    "Can we talk about what happened last round?",
    "The evidence points in one clear direction here.",
    "I'm going to trust my gut on this one.",
  ];

  const doDiscussion = async () => {
    const alive = agents.filter((a) => room.isPlayerAlive(a.address));
    for (const agent of alive) {
      const msg = discussionMessages[Math.floor(Math.random() * discussionMessages.length)];
      room.submitMessage(agent.address, msg);
      await new Promise((r) => setTimeout(r, 600 + Math.random() * 800));
    }
    // Investigations
    for (const agent of alive.slice(0, 3)) {
      const targets = alive.filter((a) => a.address !== agent.address);
      const target = targets[Math.floor(Math.random() * targets.length)];
      room.investigate(agent.address, target.address);
      await new Promise((r) => setTimeout(r, 300));
    }
  };

  const doVoting = async () => {
    const alive = agents.filter((a) => room.isPlayerAlive(a.address));
    // Each alive agent votes for a random other alive agent
    for (const agent of alive) {
      const targets = alive.filter((a) => a.address !== agent.address);
      if (targets.length === 0) continue;
      const target = targets[Math.floor(Math.random() * targets.length)];
      room.submitVote(agent.address, target.address);
      await new Promise((r) => setTimeout(r, 500 + Math.random() * 1000));
    }
  };

  // Wire up phase-change-driven simulation
  room.on("phaseChange", async (_gId: string, phase: string) => {
    try {
      if (phase === "Discussion") {
        // Small delay so the phase is fully set
        await new Promise((r) => setTimeout(r, 2000));
        await doDiscussion();
      } else if (phase === "Voting") {
        await new Promise((r) => setTimeout(r, 2000));
        await doVoting();
      }
    } catch {
      // Game may have ended
    }
  });

  // Run initial discussion (game already started in Discussion phase)
  await new Promise((r) => setTimeout(r, 1000));
  await doDiscussion();
}

// ──────────────────────────────────────────
// POST /api/wallets - Create agent wallet (Coinbase AgentKit)
// ──────────────────────────────────────────
router.post("/api/wallets", async (req: Request, res: Response) => {
  try {
    const { agentName } = req.body;
    if (!agentName || typeof agentName !== "string") {
      res.status(400).json({ error: "agentName is required" });
      return;
    }

    const wallet = await getOrCreateAgentWallet(agentName);
    res.status(201).json({
      agentName,
      address: wallet.address,
      provider: wallet.provider,
    });
  } catch (err) {
    routeLogger.error("Failed to create agent wallet", err);
    res.status(500).json({ error: "Failed to create agent wallet" });
  }
});

// ──────────────────────────────────────────
// GET /api/wallets - List all agent wallets
// ──────────────────────────────────────────
router.get("/api/wallets", (_req: Request, res: Response) => {
  res.json({ wallets: listAgentWallets() });
});

// ──────────────────────────────────────────
// POST /api/identity/register - Register agent on ERC-8004
// ──────────────────────────────────────────
router.post("/api/identity/register", async (req: Request, res: Response) => {
  try {
    if (!isErc8004Configured()) {
      res.status(503).json({ error: "ERC-8004 Identity Registry not configured" });
      return;
    }

    const { agentName, description, agentAddress } = req.body;
    if (!agentName || !agentAddress) {
      res.status(400).json({ error: "agentName and agentAddress are required" });
      return;
    }

    const result = await registerAgentIdentity(
      agentName,
      description || `${agentName} - Among Claws AI agent`,
      agentAddress
    );

    res.status(201).json({
      success: !!result.txHash,
      txHash: result.txHash,
      agentURI: result.agentURI,
    });
  } catch (err) {
    routeLogger.error("Failed to register agent identity", err);
    res.status(500).json({ error: "Failed to register agent identity" });
  }
});

// ──────────────────────────────────────────
// GET /api/identity/:agentId/reputation - Agent reputation summary
// ──────────────────────────────────────────
router.get("/api/identity/:agentId/reputation", async (req: Request, res: Response) => {
  try {
    const agentId = BigInt(getParam(req.params.agentId));
    const tag1 = (req.query.tag1 as string) || "";
    const tag2 = (req.query.tag2 as string) || "";

    const summary = await getAgentReputationSummary(agentId, tag1, tag2);
    if (!summary) {
      res.status(503).json({ error: "Reputation Registry not configured" });
      return;
    }

    res.json({
      agentId: agentId.toString(),
      feedbackCount: summary.count.toString(),
      averageScore: Number(summary.value) / Math.pow(10, summary.decimals),
      decimals: summary.decimals,
    });
  } catch (err) {
    routeLogger.error("Failed to get reputation", err);
    res.status(500).json({ error: "Failed to get reputation" });
  }
});

// ──────────────────────────────────────────
// GET /api/stats - Engine stats
// ──────────────────────────────────────────
router.get("/api/stats", (_req: Request, res: Response) => {
  const stats = gameManager.getStats();
  res.json(stats);
});

// ──────────────────────────────────────────
// GET /api/health - Health check
// ──────────────────────────────────────────
router.get("/api/health", (_req: Request, res: Response) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

export { router };
