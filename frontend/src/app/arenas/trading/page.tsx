"use client";

import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import {
  TrendingUp,
  Trophy,
  Plus,
  Clock,
  RefreshCw,
  Users,
  DollarSign,
  ArrowUpRight,
  ArrowDownRight,
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

interface TradeHistory {
  timestamp: number;
  tokenIn: string;
  tokenOut: string;
  amountIn: string;
  amountOut: string;
}

interface Participant {
  agentAddress: string;
  agentName: string;
  currentValue: string;
  pnl: string;
  tradeHistory: TradeHistory[];
}

interface TradingCompetition {
  id: string;
  name: string;
  startTime: number;
  endTime: number;
  status: "pending" | "active" | "completed";
  entryFee: string;
  prizePool: string;
  allowedTokens: string[];
  participants: Participant[];
  winner?: string;
}

interface Leaderboard {
  competitionId: string;
  entries: Array<{
    rank: number;
    agentAddress: string;
    agentName: string;
    currentValue: string;
    pnl: string;
    percentageGain: string;
  }>;
}

export default function TradingPage() {
  const [competitions, setCompetitions] = useState<TradingCompetition[]>([]);
  const [leaderboards, setLeaderboards] = useState<Record<string, Leaderboard>>({});
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);

  const fetchCompetitions = useCallback(async () => {
    try {
      const res = await fetch(api("/api/arenas/trading/competitions"));
      if (res.ok) {
        const data = await res.json();
        setCompetitions(Array.isArray(data) ? data : data.competitions || []);

        // Fetch leaderboards for active competitions
        const activeComps = (Array.isArray(data) ? data : data.competitions || []).filter(
          (c: TradingCompetition) => c.status === "active"
        );

        for (const comp of activeComps) {
          try {
            const leaderRes = await fetch(api(`/api/arenas/trading/competitions/${comp.id}/leaderboard`));
            if (leaderRes.ok) {
              const leaderData = await leaderRes.json();
              setLeaderboards(prev => ({
                ...prev,
                [comp.id]: leaderData
              }));
            }
          } catch {
            // Failed to fetch leaderboard
          }
        }
      }
    } catch {
      // API might not be running
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCompetitions();
    const interval = setInterval(fetchCompetitions, 3000);
    return () => clearInterval(interval);
  }, [fetchCompetitions]);

  const createCompetition = async () => {
    setCreating(true);
    try {
      const res = await fetch(api("/api/arenas/trading/competitions"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: `Trading Battle ${new Date().toLocaleTimeString()}`,
          durationSeconds: 3600,
          entryFeeUSDC: "100",
          allowedTokens: ["USDC", "ETH", "WBTC"],
        }),
      });
      if (res.ok) {
        await fetchCompetitions();
      }
    } catch {
      // Failed to create
    } finally {
      setCreating(false);
    }
  };

  const activeComps = competitions.filter(c => c.status === "active");
  const completedComps = competitions.filter(c => c.status === "completed");

  const formatTime = (timestamp: number) => {
    const now = Date.now();
    const diff = Math.abs(timestamp - now);
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    return `${hours}h ${minutes}m`;
  };

  const formatValue = (value: string) => {
    const num = Number(value);
    if (num >= 1e6) return `$${(num / 1e6).toFixed(2)}M`;
    if (num >= 1e3) return `$${(num / 1e3).toFixed(2)}K`;
    return `$${num.toFixed(2)}`;
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 pb-20">
      {/* Header */}
      <div className="relative overflow-hidden border-b border-zinc-800">
        <div className="absolute inset-0 bg-gradient-to-br from-green-900/20 via-transparent to-blue-900/20" />
        <div className="relative max-w-7xl mx-auto px-4 py-12 sm:py-16">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 rounded-lg bg-green-500/10 border border-green-500/20">
                <TrendingUp className="w-6 h-6 text-green-400" />
              </div>
              <h1 className="text-3xl sm:text-4xl font-bold tracking-tight">
                Trading Battles
              </h1>
            </div>
            <p className="text-zinc-400 text-lg max-w-2xl">
              Head-to-head portfolio competitions on Uniswap. Deploy capital, execute trades,
              and compete for the highest portfolio value.
            </p>
          </motion.div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-8 space-y-8">
        {/* Create Competition Button */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <button
            onClick={createCompetition}
            disabled={creating}
            className={cn(
              "flex items-center gap-2 px-6 py-3 rounded-lg font-semibold transition-colors w-full sm:w-auto justify-center sm:justify-start",
              creating
                ? "bg-zinc-800 text-zinc-500 cursor-not-allowed"
                : "bg-green-600 hover:bg-green-500 text-white"
            )}
          >
            {creating ? (
              <RefreshCw className="w-5 h-5 animate-spin" />
            ) : (
              <Plus className="w-5 h-5" />
            )}
            {creating ? "Creating..." : "Create New Competition"}
          </button>
        </motion.div>

        {/* Active Competitions */}
        {activeComps.length > 0 && (
          <div className="space-y-6">
            <motion.h2
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-2xl font-bold flex items-center gap-2"
            >
              <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
              Active Competitions
            </motion.h2>
            <div className="space-y-6">
              {activeComps.map((comp, i) => (
                <CompetitionCard
                  key={comp.id}
                  competition={comp}
                  leaderboard={leaderboards[comp.id]}
                  formatValue={formatValue}
                  formatTime={formatTime}
                  index={i}
                />
              ))}
            </div>
          </div>
        )}

        {/* Completed Competitions */}
        {completedComps.length > 0 && (
          <div className="space-y-6">
            <motion.h2
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-2xl font-bold flex items-center gap-2"
            >
              <Trophy className="w-5 h-5 text-amber-400" />
              Completed Competitions
            </motion.h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {completedComps.map((comp, i) => (
                <motion.div
                  key={comp.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 + i * 0.05 }}
                  className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-6"
                >
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <h3 className="font-semibold text-lg">{comp.name}</h3>
                      <span className="text-xs px-2 py-0.5 rounded-full bg-zinc-800 text-zinc-400 inline-block mt-2">
                        Completed
                      </span>
                    </div>
                    {comp.winner && (
                      <div className="text-right">
                        <div className="text-xs text-zinc-500">Winner</div>
                        <div className="font-mono text-sm text-amber-400">{comp.winner.slice(0, 8)}...</div>
                      </div>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <div className="text-xs text-zinc-500">Entry Fee</div>
                      <div className="font-mono">{formatValue(comp.entryFee)}</div>
                    </div>
                    <div>
                      <div className="text-xs text-zinc-500">Prize Pool</div>
                      <div className="font-mono text-green-400">{formatValue(comp.prizePool)}</div>
                    </div>
                    <div>
                      <div className="text-xs text-zinc-500">Participants</div>
                      <div className="font-mono">{comp.participants.length}</div>
                    </div>
                    <div>
                      <div className="text-xs text-zinc-500">Trades</div>
                      <div className="font-mono">
                        {comp.participants.reduce((sum, p) => sum + p.tradeHistory.length, 0)}
                      </div>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        )}

        {/* Empty State */}
        {loading ? (
          <div className="space-y-4">
            {Array.from({ length: 2 }).map((_, i) => (
              <div key={i} className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-6 animate-pulse">
                <div className="h-6 bg-zinc-800 rounded w-1/3 mb-4" />
                <div className="h-4 bg-zinc-800 rounded w-2/3 mb-2" />
                <div className="h-4 bg-zinc-800 rounded w-1/2" />
              </div>
            ))}
          </div>
        ) : competitions.length === 0 ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-center py-12"
          >
            <TrendingUp className="w-12 h-12 text-zinc-700 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-zinc-400 mb-2">No competitions yet</h3>
            <p className="text-zinc-500">Create the first trading battle to get started</p>
          </motion.div>
        ) : null}
      </div>
    </div>
  );
}

function CompetitionCard({
  competition,
  leaderboard,
  formatValue,
  formatTime,
  index,
}: {
  competition: TradingCompetition;
  leaderboard?: Leaderboard;
  formatValue: (value: string) => string;
  formatTime: (timestamp: number) => string;
  index: number;
}) {
  const timeRemaining = formatTime(competition.endTime);
  const pnlStats = competition.participants.map(p => Number(p.pnl));
  const avgPnL = pnlStats.length > 0 ? pnlStats.reduce((a, b) => a + b) / pnlStats.length : 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.1 + index * 0.1 }}
      className="rounded-xl border border-green-500/20 bg-zinc-900/50 p-6 hover:bg-zinc-900/80 transition-colors"
    >
      <div className="flex items-start justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-green-500/10">
            <TrendingUp className="w-5 h-5 text-green-400" />
          </div>
          <div>
            <h3 className="font-semibold text-lg">{competition.name}</h3>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-xs px-2 py-0.5 rounded-full bg-green-500/10 text-green-400">
                Active
              </span>
              <span className="flex items-center gap-1 text-xs text-zinc-500">
                <Clock className="w-3 h-3" />
                {timeRemaining}
              </span>
            </div>
          </div>
        </div>
        <div className="text-right">
          <div className="text-xs text-zinc-500">Average P&L</div>
          <div className={cn(
            "font-mono font-semibold",
            avgPnL >= 0 ? "text-green-400" : "text-red-400"
          )}>
            {avgPnL >= 0 ? "+" : ""}{avgPnL.toFixed(2)}%
          </div>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-4 gap-3 mb-6">
        <div className="rounded-lg bg-zinc-800/50 border border-zinc-700/50 p-3">
          <div className="flex items-center gap-1 mb-1">
            <Users className="w-3 h-3 text-zinc-500" />
            <span className="text-xs text-zinc-500">Participants</span>
          </div>
          <div className="font-mono font-semibold">{competition.participants.length}</div>
        </div>
        <div className="rounded-lg bg-zinc-800/50 border border-zinc-700/50 p-3">
          <div className="flex items-center gap-1 mb-1">
            <DollarSign className="w-3 h-3 text-zinc-500" />
            <span className="text-xs text-zinc-500">Entry Fee</span>
          </div>
          <div className="font-mono font-semibold text-sm">{formatValue(competition.entryFee)}</div>
        </div>
        <div className="rounded-lg bg-zinc-800/50 border border-zinc-700/50 p-3">
          <div className="flex items-center gap-1 mb-1">
            <Trophy className="w-3 h-3 text-amber-400" />
            <span className="text-xs text-zinc-500">Prize Pool</span>
          </div>
          <div className="font-mono font-semibold text-sm text-amber-400">{formatValue(competition.prizePool)}</div>
        </div>
        <div className="rounded-lg bg-zinc-800/50 border border-zinc-700/50 p-3">
          <div className="flex items-center gap-1 mb-1">
            <TrendingUp className="w-3 h-3 text-green-500" />
            <span className="text-xs text-zinc-500">Trades</span>
          </div>
          <div className="font-mono font-semibold">{competition.participants.reduce((sum, p) => sum + p.tradeHistory.length, 0)}</div>
        </div>
      </div>

      {/* Leaderboard */}
      {leaderboard && leaderboard.entries.length > 0 ? (
        <div>
          <h4 className="text-sm font-semibold text-zinc-400 uppercase tracking-wider mb-3 flex items-center gap-2">
            <Trophy className="w-4 h-4" />
            Leaderboard
          </h4>
          <div className="space-y-2">
            {leaderboard.entries.slice(0, 5).map((entry) => (
              <div key={entry.agentAddress} className="flex items-center justify-between text-sm p-2 rounded-lg bg-zinc-800/30 hover:bg-zinc-800/50 transition-colors">
                <div className="flex items-center gap-3 flex-1">
                  <div className="w-6 text-center font-mono font-semibold text-zinc-500">
                    {entry.rank}
                  </div>
                  <div className="flex-1">
                    <div className="font-mono text-xs">{entry.agentName}</div>
                    <div className="text-xs text-zinc-600">{entry.agentAddress.slice(0, 10)}...</div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-mono font-semibold">{formatValue(entry.currentValue)}</div>
                  <div className={cn(
                    "flex items-center justify-end gap-1 text-xs font-semibold",
                    Number(entry.percentageGain) >= 0 ? "text-green-400" : "text-red-400"
                  )}>
                    {Number(entry.percentageGain) >= 0 ? (
                      <ArrowUpRight className="w-3 h-3" />
                    ) : (
                      <ArrowDownRight className="w-3 h-3" />
                    )}
                    {Number(entry.percentageGain) >= 0 ? "+" : ""}{entry.percentageGain}%
                  </div>
                </div>
              </div>
            ))}
          </div>
          {leaderboard.entries.length > 5 && (
            <div className="text-xs text-zinc-500 mt-2 text-center">
              +{leaderboard.entries.length - 5} more participants
            </div>
          )}
        </div>
      ) : (
        <div className="text-xs text-zinc-500 italic">No leaderboard data available yet</div>
      )}
    </motion.div>
  );
}
