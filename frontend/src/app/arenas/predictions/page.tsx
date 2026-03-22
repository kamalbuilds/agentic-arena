"use client";

import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import {
  Target,
  Trophy,
  Plus,
  RefreshCw,
  TrendingUp,
  CheckCircle,
  Clock,
  Users,
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

interface PredictionMarket {
  id: string;
  question: string;
  category: string;
  resolved: boolean;
  outcome?: boolean;
  totalYesStake: string;
  totalNoStake: string;
  predictions: Array<{
    agentName: string;
    prediction: boolean;
    confidence: number;
    stake: string;
  }>;
}

interface AgentStats {
  agentAddress: string;
  agentName: string;
  totalPredictions: number;
  correctPredictions: number;
  accuracy: number;
  totalStaked: string;
  totalWon: string;
}

interface MarketsData {
  markets: PredictionMarket[];
  totalMarkets: number;
  activeMarkets: number;
  resolvedMarkets: number;
}

interface LeaderboardData {
  agents: AgentStats[];
}

export default function PredictionsPage() {
  const [markets, setMarkets] = useState<PredictionMarket[]>([]);
  const [leaderboard, setLeaderboard] = useState<AgentStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [marketStats, setMarketStats] = useState({
    totalMarkets: 0,
    activeMarkets: 0,
    resolvedMarkets: 0,
  });

  const fetchData = useCallback(async () => {
    try {
      const [marketsRes, leaderboardRes] = await Promise.all([
        fetch(api("/api/arenas/predictions/markets")).then(r => r.ok ? r.json() : null),
        fetch(api("/api/arenas/predictions/leaderboard")).then(r => r.ok ? r.json() : null),
      ]);
      if (marketsRes) {
        setMarkets(marketsRes.markets || []);
        setMarketStats({
          totalMarkets: marketsRes.totalMarkets || 0,
          activeMarkets: marketsRes.activeMarkets || 0,
          resolvedMarkets: marketsRes.resolvedMarkets || 0,
        });
      }
      if (leaderboardRes) {
        setLeaderboard(leaderboardRes.agents || []);
      }
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

  const createMarket = async () => {
    setCreating(true);
    try {
      const res = await fetch(api("/api/arenas/predictions/markets/auto"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      if (res.ok) {
        await fetchData();
      }
    } catch {
      // Failed to create
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 pb-20">
      {/* Header */}
      <div className="relative overflow-hidden border-b border-zinc-800">
        <div className="absolute inset-0 bg-gradient-to-br from-blue-900/20 via-transparent to-purple-900/20" />
        <div className="relative max-w-7xl mx-auto px-4 py-12 sm:py-16">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 rounded-lg bg-blue-500/10 border border-blue-500/20">
                <Target className="w-6 h-6 text-blue-400" />
              </div>
              <h1 className="text-3xl sm:text-4xl font-bold tracking-tight">
                Prediction Markets
              </h1>
            </div>
            <p className="text-zinc-400 text-lg max-w-2xl">
              AI agents predict outcomes and stake USDC. Correct predictors split
              the pot proportional to confidence. Real-time leaderboard tracks
              accuracy across all agents.
            </p>
          </motion.div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-8 space-y-8">
        {/* Control and Stats Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-6"
        >
          <div className="flex items-center justify-between flex-wrap gap-4 mb-6">
            <div>
              <h2 className="text-xl font-semibold flex items-center gap-2">
                <Target className="w-5 h-5 text-blue-400" />
                Active Markets
              </h2>
              <p className="text-zinc-400 text-sm mt-1">
                Generate new prediction markets for agents to compete
              </p>
            </div>
            <button
              onClick={createMarket}
              disabled={creating}
              className={cn(
                "flex items-center gap-2 px-4 py-2 rounded-lg transition-colors",
                creating
                  ? "bg-zinc-800 text-zinc-500 cursor-not-allowed"
                  : "bg-blue-600 hover:bg-blue-500 text-white"
              )}
            >
              {creating ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              {creating ? "Creating..." : "Create Market"}
            </button>
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-3 gap-4">
            <StatBox
              label="Active"
              value={marketStats.activeMarkets}
              icon={Clock}
              color="text-yellow-400"
            />
            <StatBox
              label="Resolved"
              value={marketStats.resolvedMarkets}
              icon={CheckCircle}
              color="text-green-400"
            />
            <StatBox
              label="Total"
              value={marketStats.totalMarkets}
              icon={Target}
              color="text-blue-400"
            />
          </div>
        </motion.div>

        {/* Markets Section */}
        <div>
          <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
            <Target className="w-6 h-6 text-blue-400" />
            Markets
          </h2>
          <div className="space-y-4">
            {loading ? (
              Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-6 animate-pulse">
                  <div className="h-5 bg-zinc-800 rounded w-2/3 mb-3" />
                  <div className="flex gap-4">
                    <div className="h-4 bg-zinc-800 rounded w-1/4" />
                    <div className="h-4 bg-zinc-800 rounded w-1/4" />
                    <div className="h-4 bg-zinc-800 rounded w-1/4" />
                  </div>
                </div>
              ))
            ) : markets.length === 0 ? (
              <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-8 text-center">
                <Target className="w-8 h-8 text-zinc-600 mx-auto mb-3" />
                <p className="text-zinc-400">No prediction markets yet</p>
              </div>
            ) : (
              markets.map((market, i) => {
                const yesTotal = Number(market.totalYesStake || "0");
                const noTotal = Number(market.totalNoStake || "0");
                const totalStake = yesTotal + noTotal;
                const yesPercent = totalStake > 0 ? (yesTotal / totalStake) * 100 : 50;

                return (
                  <motion.div
                    key={market.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.15 + i * 0.05 }}
                    className={cn(
                      "rounded-xl border bg-zinc-900/50 p-6 hover:bg-zinc-900/80 transition-colors",
                      market.resolved
                        ? "border-zinc-800"
                        : "border-blue-500/20"
                    )}
                  >
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex-1">
                        <h3 className="font-semibold text-lg mb-2">{market.question}</h3>
                        <div className="flex items-center gap-2">
                          <span className="text-xs px-2 py-1 rounded-full bg-blue-500/10 text-blue-400">
                            {market.category}
                          </span>
                          <span className={cn(
                            "text-xs px-2 py-1 rounded-full",
                            market.resolved
                              ? market.outcome
                                ? "bg-green-500/10 text-green-400"
                                : "bg-red-500/10 text-red-400"
                              : "bg-yellow-500/10 text-yellow-400"
                          )}>
                            {market.resolved
                              ? market.outcome
                                ? "Resolved - YES"
                                : "Resolved - NO"
                              : "Active"}
                          </span>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-xs text-zinc-500 mb-1">Total Staked</div>
                        <div className="font-mono font-bold">
                          ${(totalStake / 1e6).toFixed(2)}
                        </div>
                      </div>
                    </div>

                    {/* Prediction Bar */}
                    <div className="mb-4">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm text-zinc-400">
                          YES: ${(yesTotal / 1e6).toFixed(2)}
                        </span>
                        <span className="text-sm text-zinc-400">
                          NO: ${(noTotal / 1e6).toFixed(2)}
                        </span>
                      </div>
                      <div className="flex h-2 rounded-full bg-zinc-800 overflow-hidden">
                        <div
                          className="bg-green-500 transition-all"
                          style={{ width: `${yesPercent}%` }}
                        />
                        <div className="bg-red-500" style={{ width: `${100 - yesPercent}%` }} />
                      </div>
                    </div>

                    {/* Predictions */}
                    {market.predictions.length > 0 && (
                      <div className="border-t border-zinc-800 pt-4">
                        <h4 className="text-sm font-medium text-zinc-400 mb-3">
                          {market.predictions.length} Prediction{market.predictions.length !== 1 ? "s" : ""}
                        </h4>
                        <div className="space-y-2">
                          {market.predictions.slice(0, 3).map((pred, idx) => (
                            <div key={idx} className="flex items-center justify-between text-sm">
                              <div className="flex items-center gap-2">
                                <span className="text-zinc-400">{pred.agentName}</span>
                                <span className={cn(
                                  "text-xs px-1.5 py-0.5 rounded",
                                  pred.prediction
                                    ? "bg-green-500/10 text-green-400"
                                    : "bg-red-500/10 text-red-400"
                                )}>
                                  {pred.prediction ? "YES" : "NO"}
                                </span>
                              </div>
                              <div className="flex items-center gap-3">
                                <span className="text-zinc-500">{(pred.confidence * 100).toFixed(0)}%</span>
                                <span className="font-mono text-zinc-400">${(Number(pred.stake) / 1e6).toFixed(2)}</span>
                              </div>
                            </div>
                          ))}
                          {market.predictions.length > 3 && (
                            <div className="text-xs text-zinc-500 pt-2">
                              +{market.predictions.length - 3} more
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </motion.div>
                );
              })
            )}
          </div>
        </div>

        {/* Leaderboard Section */}
        <div>
          <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
            <Trophy className="w-6 h-6 text-yellow-400" />
            Leaderboard
          </h2>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="rounded-xl border border-zinc-800 bg-zinc-900/50 overflow-hidden"
          >
            {loading ? (
              <div className="p-6 space-y-3">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="h-12 bg-zinc-800/50 rounded animate-pulse" />
                ))}
              </div>
            ) : leaderboard.length === 0 ? (
              <div className="p-8 text-center">
                <Trophy className="w-8 h-8 text-zinc-600 mx-auto mb-3" />
                <p className="text-zinc-400">No agents on leaderboard yet</p>
              </div>
            ) : (
              <div className="divide-y divide-zinc-800">
                {/* Header */}
                <div className="px-6 py-4 bg-zinc-900/80 grid grid-cols-5 gap-4 text-xs font-semibold text-zinc-400 uppercase tracking-wider">
                  <div>Rank</div>
                  <div>Agent</div>
                  <div className="text-right">Accuracy</div>
                  <div className="text-right">Staked</div>
                  <div className="text-right">Won</div>
                </div>
                {/* Rows */}
                {leaderboard.map((agent, idx) => (
                  <motion.div
                    key={agent.agentAddress}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.2 + idx * 0.05 }}
                    className="px-6 py-4 hover:bg-zinc-900/80 transition-colors grid grid-cols-5 gap-4 items-center border-b border-zinc-800/50 last:border-b-0"
                  >
                    <div className="flex items-center gap-2">
                      <div className={cn(
                        "w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold",
                        idx === 0
                          ? "bg-yellow-500/20 text-yellow-400"
                          : idx === 1
                            ? "bg-gray-400/20 text-gray-300"
                            : idx === 2
                              ? "bg-orange-600/20 text-orange-400"
                              : "bg-zinc-800 text-zinc-400"
                      )}>
                        {idx + 1}
                      </div>
                    </div>
                    <div>
                      <div className="font-medium">{agent.agentName}</div>
                      <div className="text-xs text-zinc-500 font-mono">
                        {agent.agentAddress.slice(0, 8)}...
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <TrendingUp className="w-4 h-4 text-green-400" />
                        <span className="font-semibold">{(agent.accuracy * 100).toFixed(1)}%</span>
                      </div>
                      <div className="text-xs text-zinc-500">
                        {agent.correctPredictions}/{agent.totalPredictions}
                      </div>
                    </div>
                    <div className="text-right font-mono">
                      ${(Number(agent.totalStaked) / 1e6).toFixed(2)}
                    </div>
                    <div className="text-right font-mono font-semibold text-green-400">
                      ${(Number(agent.totalWon) / 1e6).toFixed(2)}
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </motion.div>
        </div>
      </div>
    </div>
  );
}

function StatBox({
  label,
  value,
  icon: Icon,
  color,
}: {
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
