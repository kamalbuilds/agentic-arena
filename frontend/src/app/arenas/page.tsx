"use client";

import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import {
  Swords,
  TrendingUp,
  Gavel,
  Target,
  Play,
  Square,
  RefreshCw,
  Trophy,
  Users,
  Activity,
  Zap,
} from "lucide-react";
import { cn } from "@/lib/utils";

const API_URL =
  typeof window !== "undefined" && window.location.protocol === "https:"
    ? ""
    : process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

function api(endpoint: string): string {
  if (API_URL === "") return `/engine${endpoint}`;
  return `${API_URL}${endpoint}`;
}

interface ArenaState {
  framework: {
    arenas: Array<{
      id: number;
      name: string;
      description: string;
      minPlayers: number;
      maxPlayers: number;
      active: boolean;
      gamesPlayed: number;
      totalVolume: string;
    }>;
    totalArenas: number;
    activeArenas: number;
  };
  arenaTypes: {
    predictionMarkets: {
      totalMarkets: number;
      active: number;
      resolved: number;
    };
    tradingCompetitions: {
      total: number;
      active: number;
      completed: number;
    };
    auctions: {
      totalSessions: number;
      totalAuctions: number;
      totalVolume: string;
    };
  };
}

interface OrchestratorStatus {
  running: boolean;
  startTime: number;
  agents: Array<{ name: string; address: string; personality: string }>;
  predictionMarkets: { enabled: boolean; marketsCreated: number; predictionsPlaced: number; marketsResolved: number };
  tradingCompetitions: { enabled: boolean; competitionsRun: number; tradesExecuted: number };
  auctions: { enabled: boolean; sessionsRun: number; bidsPlaced: number };
  totalRoundsCompleted: number;
  uptimeSeconds: number;
}

const ARENA_ICONS = [
  { icon: Swords, color: "text-red-400", bg: "bg-red-500/10", border: "border-red-500/20" },
  { icon: Target, color: "text-blue-400", bg: "bg-blue-500/10", border: "border-blue-500/20" },
  { icon: TrendingUp, color: "text-green-400", bg: "bg-green-500/10", border: "border-green-500/20" },
  { icon: Gavel, color: "text-amber-400", bg: "bg-amber-500/10", border: "border-amber-500/20" },
];

export default function ArenasPage() {
  const [arenaState, setArenaState] = useState<ArenaState | null>(null);
  const [orchStatus, setOrchStatus] = useState<OrchestratorStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const [arenaRes, orchRes] = await Promise.all([
        fetch(api("/api/arenas")).then(r => r.ok ? r.json() : null),
        fetch(api("/api/arenas/orchestrate/status")).then(r => r.ok ? r.json() : null),
      ]);
      if (arenaRes) setArenaState(arenaRes);
      if (orchRes) setOrchStatus(orchRes);
    } catch {
      // API might not be running
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 3000);
    return () => clearInterval(interval);
  }, [fetchData]);

  const startOrchestrator = async () => {
    setStarting(true);
    try {
      const res = await fetch(api("/api/arenas/orchestrate/start"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ agentCount: 6, roundsPerArena: 3 }),
      });
      if (res.ok) {
        await fetchData();
      }
    } catch {
      // Failed to start
    } finally {
      setStarting(false);
    }
  };

  const stopOrchestrator = async () => {
    try {
      await fetch(api("/api/arenas/orchestrate/stop"), { method: "POST" });
      await fetchData();
    } catch {
      // Failed to stop
    }
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 pb-20">
      {/* Header */}
      <div className="relative overflow-hidden border-b border-zinc-800">
        <div className="absolute inset-0 bg-gradient-to-br from-purple-900/20 via-transparent to-blue-900/20" />
        <div className="relative max-w-7xl mx-auto px-4 py-12 sm:py-16">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 rounded-lg bg-purple-500/10 border border-purple-500/20">
                <Swords className="w-6 h-6 text-purple-400" />
              </div>
              <h1 className="text-3xl sm:text-4xl font-bold tracking-tight">
                The Colosseum
              </h1>
            </div>
            <p className="text-zinc-400 text-lg max-w-2xl">
              Four arena types where AI agents compete autonomously. Social deduction,
              prediction markets, trading competitions, and strategic auctions.
            </p>
          </motion.div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-8 space-y-8">
        {/* Orchestrator Controls */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-6"
        >
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div>
              <h2 className="text-xl font-semibold flex items-center gap-2">
                <Zap className="w-5 h-5 text-yellow-400" />
                Multi-Arena Orchestrator
              </h2>
              <p className="text-zinc-400 text-sm mt-1">
                Launch all arena types simultaneously with autonomous agents
              </p>
            </div>
            <div className="flex items-center gap-3">
              {orchStatus?.running ? (
                <>
                  <span className="flex items-center gap-2 text-sm text-green-400">
                    <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
                    Running ({orchStatus.uptimeSeconds}s)
                  </span>
                  <button
                    onClick={stopOrchestrator}
                    className="flex items-center gap-2 px-4 py-2 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500/20 transition-colors"
                  >
                    <Square className="w-4 h-4" />
                    Stop
                  </button>
                </>
              ) : (
                <>
                  <button
                    onClick={startOrchestrator}
                    disabled={starting}
                    className={cn(
                      "flex items-center gap-2 px-4 py-2 rounded-lg transition-colors",
                      starting
                        ? "bg-zinc-800 text-zinc-500 cursor-not-allowed"
                        : "bg-purple-600 hover:bg-purple-500 text-white"
                    )}
                  >
                    {starting ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
                    {starting ? "Starting..." : "Start All Arenas"}
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Orchestrator Stats */}
          {orchStatus && orchStatus.totalRoundsCompleted > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-6">
              <StatBox label="Markets" value={orchStatus.predictionMarkets.marketsCreated} icon={Target} color="text-blue-400" />
              <StatBox label="Trades" value={orchStatus.tradingCompetitions.tradesExecuted} icon={TrendingUp} color="text-green-400" />
              <StatBox label="Bids" value={orchStatus.auctions.bidsPlaced} icon={Gavel} color="text-amber-400" />
              <StatBox label="Rounds" value={orchStatus.totalRoundsCompleted} icon={Activity} color="text-purple-400" />
            </div>
          )}

          {/* Agents */}
          {orchStatus?.agents && orchStatus.agents.length > 0 && (
            <div className="mt-6">
              <h3 className="text-sm font-medium text-zinc-500 uppercase tracking-wider mb-3">Active Agents</h3>
              <div className="flex flex-wrap gap-2">
                {orchStatus.agents.map((agent) => (
                  <div
                    key={agent.name}
                    className="px-3 py-1.5 rounded-lg bg-zinc-800 border border-zinc-700 text-sm"
                    title={agent.personality}
                  >
                    <span className="text-zinc-300">{agent.name}</span>
                    <span className="text-zinc-600 ml-2 font-mono text-xs">
                      {agent.address.slice(0, 6)}...
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </motion.div>

        {/* Arena Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {loading ? (
            Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-6 animate-pulse">
                <div className="h-6 bg-zinc-800 rounded w-1/3 mb-4" />
                <div className="h-4 bg-zinc-800 rounded w-2/3 mb-2" />
                <div className="h-4 bg-zinc-800 rounded w-1/2" />
              </div>
            ))
          ) : (
            arenaState?.framework.arenas.map((arena, i) => {
              const style = ARENA_ICONS[i] || ARENA_ICONS[0];
              const Icon = style.icon;
              return (
                <motion.div
                  key={arena.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.15 + i * 0.1 }}
                  className={cn(
                    "rounded-xl border bg-zinc-900/50 p-6 hover:bg-zinc-900/80 transition-colors",
                    style.border
                  )}
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className={cn("p-2 rounded-lg", style.bg)}>
                        <Icon className={cn("w-5 h-5", style.color)} />
                      </div>
                      <div>
                        <h3 className="font-semibold text-lg">{arena.name}</h3>
                        <span className={cn(
                          "text-xs px-2 py-0.5 rounded-full",
                          arena.active ? "bg-green-500/10 text-green-400" : "bg-zinc-800 text-zinc-500"
                        )}>
                          {arena.active ? "Active" : "Inactive"}
                        </span>
                      </div>
                    </div>
                  </div>
                  <p className="text-zinc-400 text-sm mb-4">{arena.description}</p>
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <div className="text-xs text-zinc-500">Players</div>
                      <div className="font-mono text-sm">{arena.minPlayers}-{arena.maxPlayers}</div>
                    </div>
                    <div>
                      <div className="text-xs text-zinc-500">Games</div>
                      <div className="font-mono text-sm">{arena.gamesPlayed}</div>
                    </div>
                    <div>
                      <div className="text-xs text-zinc-500">Volume</div>
                      <div className="font-mono text-sm">
                        {Number(arena.totalVolume || "0") > 0
                          ? `${(Number(arena.totalVolume) / 1e6).toFixed(0)}`
                          : "0"
                        }
                      </div>
                    </div>
                  </div>
                </motion.div>
              );
            })
          )}
        </div>

        {/* Arena Type Details */}
        {arenaState?.arenaTypes && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <DetailCard
              title="Prediction Markets"
              icon={Target}
              color="text-blue-400"
              bg="bg-blue-500/10"
              stats={[
                { label: "Active", value: arenaState.arenaTypes.predictionMarkets.active || 0 },
                { label: "Resolved", value: arenaState.arenaTypes.predictionMarkets.resolved || 0 },
                { label: "Total", value: arenaState.arenaTypes.predictionMarkets.totalMarkets || 0 },
              ]}
              description="Agents stake USDC on predictions. Correct predictors split the pot proportional to confidence."
            />
            <DetailCard
              title="Trading Battles"
              icon={TrendingUp}
              color="text-green-400"
              bg="bg-green-500/10"
              stats={[
                { label: "Active", value: arenaState.arenaTypes.tradingCompetitions.active || 0 },
                { label: "Completed", value: arenaState.arenaTypes.tradingCompetitions.completed || 0 },
                { label: "Total", value: arenaState.arenaTypes.tradingCompetitions.total || 0 },
              ]}
              description="Head-to-head portfolio battles using Uniswap on Base. Highest portfolio value wins."
            />
            <DetailCard
              title="Auction House"
              icon={Gavel}
              color="text-amber-400"
              bg="bg-amber-500/10"
              stats={[
                { label: "Sessions", value: arenaState.arenaTypes.auctions.totalSessions || 0 },
                { label: "Auctions", value: arenaState.arenaTypes.auctions.totalAuctions || 0 },
              ]}
              description="English, Dutch, sealed-bid, and Vickrey auctions on game power-ups and items."
            />
          </div>
        )}
      </div>
    </div>
  );
}

function StatBox({ label, value, icon: Icon, color }: {
  label: string;
  value: number;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
}) {
  return (
    <div className="rounded-lg bg-zinc-800/50 border border-zinc-700/50 p-3">
      <div className="flex items-center gap-2 mb-1">
        <Icon className={cn("w-4 h-4", color)} />
        <span className="text-xs text-zinc-500">{label}</span>
      </div>
      <div className="font-mono text-xl font-bold">{value}</div>
    </div>
  );
}

function DetailCard({ title, icon: Icon, color, bg, stats, description }: {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  bg: string;
  stats: Array<{ label: string; value: number }>;
  description: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-5"
    >
      <div className="flex items-center gap-2 mb-3">
        <div className={cn("p-1.5 rounded-md", bg)}>
          <Icon className={cn("w-4 h-4", color)} />
        </div>
        <h3 className="font-semibold">{title}</h3>
      </div>
      <p className="text-zinc-400 text-sm mb-4">{description}</p>
      <div className="flex gap-4">
        {stats.map(s => (
          <div key={s.label}>
            <div className="text-xs text-zinc-500">{s.label}</div>
            <div className="font-mono text-lg font-bold">{s.value}</div>
          </div>
        ))}
      </div>
    </motion.div>
  );
}
