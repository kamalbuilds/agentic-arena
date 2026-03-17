import { Router, type Request, type Response } from "express";
import { tournamentManager } from "../game/TournamentManager.js";
import { seasonTracker } from "../game/SeasonTracker.js";
import { arenaFramework } from "../game/ArenaFramework.js";
import { getBettingAnalytics } from "../persistence/colosseumStore.js";
import { logger } from "../utils/logger.js";

const routeLogger = logger.child("TournamentAPI");
const router = Router();

function getParam(param: string | string[] | undefined): string {
  if (Array.isArray(param)) return param[0];
  return param || "";
}

// ══════════════════════════════════════════
// TOURNAMENT ROUTES
// ══════════════════════════════════════════

// POST /api/tournaments - Create tournament
router.post("/api/tournaments", async (req: Request, res: Response) => {
  try {
    const { name, entryFee, maxParticipants, registrationDurationMs, arenaType } = req.body;

    const tournament = tournamentManager.createTournament({
      name: name || "Claw Wars Tournament",
      entryFee: BigInt(entryFee || "500000000000000000"),
      maxParticipants: parseInt(maxParticipants || "8", 10),
      registrationDurationMs: parseInt(registrationDurationMs || "3600000", 10), // 1 hour default
      arenaType: parseInt(arenaType || "0", 10),
    });

    res.status(201).json(tournamentManager.getState(tournament.id));
  } catch (err) {
    routeLogger.error("Failed to create tournament", err);
    res.status(500).json({ error: err instanceof Error ? err.message : "Failed to create tournament" });
  }
});

// GET /api/tournaments - List all tournaments
router.get("/api/tournaments", (_req: Request, res: Response) => {
  try {
    const tournaments = tournamentManager.getAllTournaments().map((t) => tournamentManager.getState(t.id));
    res.json({ tournaments, count: tournaments.length });
  } catch (err) {
    routeLogger.error("Failed to list tournaments", err);
    res.status(500).json({ error: "Failed to list tournaments" });
  }
});

// GET /api/tournaments/active - List active tournaments
router.get("/api/tournaments/active", (_req: Request, res: Response) => {
  try {
    const tournaments = tournamentManager.getActiveTournaments().map((t) => tournamentManager.getState(t.id));
    res.json({ tournaments, count: tournaments.length });
  } catch (err) {
    res.status(500).json({ error: "Failed to list active tournaments" });
  }
});

// GET /api/tournaments/:id - Get tournament state
router.get("/api/tournaments/:id", (req: Request, res: Response) => {
  try {
    const state = tournamentManager.getState(getParam(req.params.id));
    if (!state) {
      res.status(404).json({ error: "Tournament not found" });
      return;
    }
    res.json(state);
  } catch (err) {
    res.status(500).json({ error: "Failed to get tournament" });
  }
});

// POST /api/tournaments/:id/register - Register for tournament
router.post("/api/tournaments/:id/register", (req: Request, res: Response) => {
  try {
    const { address } = req.body;
    if (!address) {
      res.status(400).json({ error: "Address required" });
      return;
    }

    const success = tournamentManager.registerPlayer(getParam(req.params.id), address);
    if (!success) {
      res.status(400).json({ error: "Failed to register — tournament may be full or closed" });
      return;
    }

    res.json({ success: true, tournamentId: getParam(req.params.id), address });
  } catch (err) {
    res.status(500).json({ error: "Failed to register" });
  }
});

// POST /api/tournaments/:id/start - Start tournament
router.post("/api/tournaments/:id/start", (req: Request, res: Response) => {
  try {
    const success = tournamentManager.startTournament(getParam(req.params.id));
    if (!success) {
      res.status(400).json({ error: "Cannot start tournament" });
      return;
    }
    res.json(tournamentManager.getState(getParam(req.params.id)));
  } catch (err) {
    res.status(500).json({ error: "Failed to start tournament" });
  }
});

// POST /api/tournaments/:id/match-result - Report match result
router.post("/api/tournaments/:id/match-result", (req: Request, res: Response) => {
  try {
    const { round, matchIndex, winner } = req.body;
    if (!round || matchIndex === undefined || !winner) {
      res.status(400).json({ error: "round, matchIndex, and winner required" });
      return;
    }

    const success = tournamentManager.setMatchWinner(
      getParam(req.params.id),
      parseInt(round, 10),
      parseInt(matchIndex, 10),
      winner
    );

    if (!success) {
      res.status(400).json({ error: "Failed to report match result" });
      return;
    }

    res.json(tournamentManager.getState(getParam(req.params.id)));
  } catch (err) {
    res.status(500).json({ error: "Failed to report result" });
  }
});

// GET /api/tournaments/:id/bracket - Get bracket
router.get("/api/tournaments/:id/bracket", (req: Request, res: Response) => {
  try {
    const bracket = tournamentManager.getBracket(getParam(req.params.id));
    res.json({ bracket });
  } catch (err) {
    res.status(500).json({ error: "Failed to get bracket" });
  }
});

// POST /api/tournaments/:id/cancel - Cancel tournament
router.post("/api/tournaments/:id/cancel", (req: Request, res: Response) => {
  try {
    const success = tournamentManager.cancelTournament(getParam(req.params.id));
    if (!success) {
      res.status(400).json({ error: "Cannot cancel tournament" });
      return;
    }
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Failed to cancel tournament" });
  }
});

// ══════════════════════════════════════════
// SEASON ROUTES
// ══════════════════════════════════════════

// POST /api/seasons - Create season
router.post("/api/seasons", (req: Request, res: Response) => {
  try {
    const { name, startTime, endTime, topRewardSlots } = req.body;

    const season = seasonTracker.createSeason({
      name: name || "Season 1",
      startTime: parseInt(startTime || String(Date.now()), 10),
      endTime: parseInt(endTime || String(Date.now() + 30 * 24 * 60 * 60 * 1000), 10),
      topRewardSlots: parseInt(topRewardSlots || "10", 10),
    });

    res.status(201).json(seasonTracker.getState(season.id));
  } catch (err) {
    res.status(500).json({ error: "Failed to create season" });
  }
});

// GET /api/seasons - List all seasons
router.get("/api/seasons", (_req: Request, res: Response) => {
  try {
    const seasons = seasonTracker.getAllSeasons().map((s) => seasonTracker.getState(s.id));
    res.json({ seasons, count: seasons.length });
  } catch (err) {
    res.status(500).json({ error: "Failed to list seasons" });
  }
});

// GET /api/seasons/current - Get current season
router.get("/api/seasons/current", (_req: Request, res: Response) => {
  try {
    const current = seasonTracker.getCurrentSeason();
    if (!current) {
      res.status(404).json({ error: "No active season" });
      return;
    }
    res.json(seasonTracker.getState(current.id));
  } catch (err) {
    res.status(500).json({ error: "Failed to get current season" });
  }
});

// GET /api/seasons/:id - Get season state
router.get("/api/seasons/:id", (req: Request, res: Response) => {
  try {
    const state = seasonTracker.getState(getParam(req.params.id));
    if (!state) {
      res.status(404).json({ error: "Season not found" });
      return;
    }
    res.json(state);
  } catch (err) {
    res.status(500).json({ error: "Failed to get season" });
  }
});

// POST /api/seasons/:id/start - Start season
router.post("/api/seasons/:id/start", (req: Request, res: Response) => {
  try {
    const success = seasonTracker.startSeason(getParam(req.params.id));
    if (!success) {
      res.status(400).json({ error: "Cannot start season" });
      return;
    }
    res.json(seasonTracker.getState(getParam(req.params.id)));
  } catch (err) {
    res.status(500).json({ error: "Failed to start season" });
  }
});

// POST /api/seasons/:id/end - End season
router.post("/api/seasons/:id/end", (req: Request, res: Response) => {
  try {
    const success = seasonTracker.endSeason(getParam(req.params.id));
    if (!success) {
      res.status(400).json({ error: "Cannot end season" });
      return;
    }
    res.json(seasonTracker.getState(getParam(req.params.id)));
  } catch (err) {
    res.status(500).json({ error: "Failed to end season" });
  }
});

// GET /api/seasons/:id/leaderboard - Season leaderboard
router.get("/api/seasons/:id/leaderboard", (req: Request, res: Response) => {
  try {
    const count = parseInt((req.query.count as string) || "20", 10);
    const leaderboard = seasonTracker.getLeaderboard(getParam(req.params.id), count);
    res.json({ leaderboard, seasonId: getParam(req.params.id) });
  } catch (err) {
    res.status(500).json({ error: "Failed to get leaderboard" });
  }
});

// ══════════════════════════════════════════
// ARENA ROUTES
// ══════════════════════════════════════════

// GET /api/arenas - List all arenas
router.get("/api/arenas", (_req: Request, res: Response) => {
  try {
    res.json(arenaFramework.getState());
  } catch (err) {
    res.status(500).json({ error: "Failed to list arenas" });
  }
});

// POST /api/arenas - Register new arena
router.post("/api/arenas", (req: Request, res: Response) => {
  try {
    const { name, description, minPlayers, maxPlayers, defaultStake } = req.body;

    const arena = arenaFramework.registerArena({
      name: name || "New Arena",
      description: description || "",
      minPlayers: parseInt(minPlayers || "2", 10),
      maxPlayers: parseInt(maxPlayers || "8", 10),
      defaultStake: BigInt(defaultStake || "500000000000000000"),
    });

    res.status(201).json({
      id: arena.id,
      name: arena.name,
      description: arena.description,
      minPlayers: arena.minPlayers,
      maxPlayers: arena.maxPlayers,
      defaultStake: arena.defaultStake.toString(),
      active: arena.active,
    });
  } catch (err) {
    res.status(500).json({ error: "Failed to register arena" });
  }
});

// GET /api/arenas/active - List active arenas
router.get("/api/arenas/active", (_req: Request, res: Response) => {
  try {
    const arenas = arenaFramework.getActiveArenas().map((a) => ({
      id: a.id,
      name: a.name,
      description: a.description,
      minPlayers: a.minPlayers,
      maxPlayers: a.maxPlayers,
      defaultStake: a.defaultStake.toString(),
      gamesPlayed: a.gamesPlayed,
      totalVolume: a.totalVolume.toString(),
    }));
    res.json({ arenas });
  } catch (err) {
    res.status(500).json({ error: "Failed to list active arenas" });
  }
});

// ══════════════════════════════════════════
// ANALYTICS ROUTES
// ══════════════════════════════════════════

// GET /api/analytics - Platform analytics
router.get("/api/analytics", async (_req: Request, res: Response) => {
  try {
    const tournaments = tournamentManager.getAllTournaments();
    const seasons = seasonTracker.getAllSeasons();
    const arenas = arenaFramework.getAllArenas();

    const totalTournaments = tournaments.length;
    const activeTournaments = tournaments.filter((t) => t.status === "Active" || t.status === "Registration").length;
    const totalPrizePool = tournaments.reduce((sum, t) => sum + t.prizePool, 0n);

    const currentSeason = seasonTracker.getCurrentSeason();
    const totalArenaGames = arenas.reduce((sum, a) => sum + a.gamesPlayed, 0);
    const totalArenaVolume = arenas.reduce((sum, a) => sum + a.totalVolume, 0n);

    // Fetch betting analytics from DB
    const bettingStats = await getBettingAnalytics();

    res.json({
      tournaments: {
        total: totalTournaments,
        active: activeTournaments,
        totalPrizePool: totalPrizePool.toString(),
      },
      seasons: {
        total: seasons.length,
        currentSeason: currentSeason ? { id: currentSeason.id, name: currentSeason.name, participants: currentSeason.players.size } : null,
      },
      arenas: {
        total: arenas.length,
        active: arenas.filter((a) => a.active).length,
        totalGamesPlayed: totalArenaGames,
        totalVolume: totalArenaVolume.toString(),
      },
      betting: bettingStats || { totalBets: 0, totalVolume: "0", totalPayout: "0", uniqueBettors: 0 },
    });
  } catch (err) {
    res.status(500).json({ error: "Failed to get analytics" });
  }
});

export { router as tournamentRouter };
