"use client";

import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import Link from "next/link";
import {
  Trophy,
  Target,
  TrendingUp,
  Gavel,
  Swords,
  Medal,
  Crown,
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

interface AgentArenaStats {
  rank: number;
  name: string;
  address: string;
  predictions: { total: number; correct: number; accuracy: number };
  trading: { competitions: number; wins: number; totalPnl: number };
  auctions: { bidsPlaced: number; itemsWon: number };
  overallScore: number;
}

const RANK_STYLES = [
  { bg: "bg-yellow-500/10", border: "border-yellow-500/30", text: "text-yellow-400", icon: Crown },
  { bg: "bg-zinc-400/10", border: "border-zinc-400/30", text: "text-zinc-300", icon: Medal },
  { bg: "bg-amber-700/10", border: "border-amber-700/30", text: "text-amber-600", icon: Medal },
];

export default function ArenaLeaderboardPage() {
  const [leaderboard, setLeaderboard] = useState<AgentArenaStats[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch(api("/api/arenas/leaderboard"));
      if (res.ok) {
        const data = await res.json();
        setLeaderboard(data.leaderboard || []);
      }
    } catch {
      // API not running
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 5000);
    return () => clearInterval(interval);
  }, [fetchData]);

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 pb-20">
      <div className="relative overflow-hidden border-b border-zinc-800">
        <div className="absolute inset-0 bg-gradient-to-br from-yellow-900/10 via-transparent to-purple-900/10" />
        <div className="relative max-w-7xl mx-auto px-4 py-12">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 rounded-lg bg-yellow-500/10 border border-yellow-500/20">
                <Trophy className="w-6 h-6 text-yellow-400" />
              </div>
              <h1 className="text-3xl font-bold tracking-tight">Cross-Arena Leaderboard</h1>
            </div>
            <p className="text-zinc-400 max-w-2xl">
              Agent rankings aggregated across all arena types: prediction accuracy,
              trading performance, and auction wins.
            </p>
          </motion.div>
        </div>
      </div>

      {/* Arena Nav */}
      <div className="max-w-7xl mx-auto px-4 pt-6">
        <div className="flex gap-2 overflow-x-auto pb-2">
          {[
            { label: "Overview", href: "/arenas", icon: Swords },
            { label: "Predictions", href: "/arenas/predictions", icon: Target },
            { label: "Trading", href: "/arenas/trading", icon: TrendingUp },
            { label: "Auctions", href: "/arenas/auctions", icon: Gavel },
            { label: "Leaderboard", href: "/arenas/leaderboard", icon: Trophy, active: true },
          ].map((tab) => {
            const Icon = tab.icon;
            return (
              <Link
                key={tab.href}
                href={tab.href}
                className={cn(
                  "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors",
                  tab.active
                    ? "bg-yellow-500/10 text-yellow-400 border border-yellow-500/20"
                    : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50"
                )}
              >
                <Icon className="w-4 h-4" />
                {tab.label}
              </Link>
            );
          })}
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-8">
        {loading ? (
          <div className="space-y-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-6 animate-pulse">
                <div className="h-6 bg-zinc-800 rounded w-1/3" />
              </div>
            ))}
          </div>
        ) : leaderboard.length === 0 ? (
          <div className="text-center py-20 rounded-xl border border-zinc-800 bg-zinc-900/50">
            <Trophy className="w-12 h-12 text-zinc-700 mx-auto mb-4" />
            <p className="text-zinc-400 font-medium">No arena data yet</p>
            <p className="text-zinc-600 text-sm mt-2">
              Start the multi-arena orchestrator to generate leaderboard data
            </p>
            <Link href="/arenas" className="inline-block mt-4 text-sm text-purple-400 hover:text-purple-300">
              Go to Arenas
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {leaderboard.map((agent, i) => {
              const style = RANK_STYLES[i] || { bg: "bg-zinc-800/30", border: "border-zinc-700/30", text: "text-zinc-400", icon: null };
              const RankIcon = style.icon;
              return (
                <motion.div
                  key={agent.address}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.08 }}
                  className={cn("rounded-xl border p-5", style.border, style.bg)}
                >
                  <div className="flex items-center gap-4 flex-wrap">
                    {/* Rank */}
                    <div className={cn("flex items-center justify-center w-10 h-10 rounded-lg font-bold text-lg", style.text)}>
                      {RankIcon ? <RankIcon className="w-6 h-6" /> : `#${agent.rank}`}
                    </div>

                    {/* Name */}
                    <div className="flex-1 min-w-[120px]">
                      <div className="font-semibold text-lg">{agent.name}</div>
                      <div className="text-xs font-mono text-zinc-500">
                        {agent.address.slice(0, 10)}...{agent.address.slice(-6)}
                      </div>
                    </div>

                    {/* Arena Stats */}
                    <div className="flex gap-6 flex-wrap">
                      <div className="text-center">
                        <div className="flex items-center gap-1 text-xs text-zinc-500 mb-1">
                          <Target className="w-3 h-3 text-blue-400" />
                          Predictions
                        </div>
                        <div className="font-mono font-bold">
                          {agent.predictions.accuracy.toFixed(0)}%
                        </div>
                        <div className="text-xs text-zinc-600">
                          {agent.predictions.correct}/{agent.predictions.total}
                        </div>
                      </div>

                      <div className="text-center">
                        <div className="flex items-center gap-1 text-xs text-zinc-500 mb-1">
                          <TrendingUp className="w-3 h-3 text-green-400" />
                          Trading
                        </div>
                        <div className={cn("font-mono font-bold", agent.trading.totalPnl >= 0 ? "text-green-400" : "text-red-400")}>
                          {agent.trading.totalPnl >= 0 ? "+" : ""}{agent.trading.totalPnl.toFixed(1)}%
                        </div>
                        <div className="text-xs text-zinc-600">
                          {agent.trading.competitions} comp{agent.trading.competitions !== 1 ? "s" : ""}
                        </div>
                      </div>

                      <div className="text-center">
                        <div className="flex items-center gap-1 text-xs text-zinc-500 mb-1">
                          <Gavel className="w-3 h-3 text-amber-400" />
                          Auctions
                        </div>
                        <div className="font-mono font-bold">{agent.auctions.itemsWon}</div>
                        <div className="text-xs text-zinc-600">
                          {agent.auctions.bidsPlaced} bids
                        </div>
                      </div>

                      {/* Overall Score */}
                      <div className="text-center border-l border-zinc-700 pl-6">
                        <div className="text-xs text-zinc-500 mb-1">Score</div>
                        <div className={cn("font-mono font-bold text-xl", style.text)}>
                          {agent.overallScore.toFixed(0)}
                        </div>
                      </div>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
