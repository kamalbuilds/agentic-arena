"use client";

import { useState, useEffect, useMemo } from "react";
import { motion } from "framer-motion";
import { Trophy, Users, Skull, Coins } from "lucide-react";
import { cn } from "@/lib/utils";
import LeaderboardTable from "@/components/LeaderboardTable";
import { getLeaderboard } from "@/lib/api";
import type { LeaderboardEntry } from "@/lib/types";

type TabType = "overall" | "lobsters" | "impostors" | "earnings";

const tabs: { type: TabType; label: string; icon: typeof Trophy }[] = [
  { type: "overall", label: "Overall", icon: Trophy },
  { type: "lobsters", label: "Best Lobsters", icon: Users },
  { type: "impostors", label: "Best Impostors", icon: Skull },
  { type: "earnings", label: "Most Earnings", icon: Coins },
];


export default function LeaderboardPage() {
  const [activeTab, setActiveTab] = useState<TabType>("overall");
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      try {
        const data = await getLeaderboard();
        setEntries(data);
      } catch {
        setEntries([]);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  const sortedEntries = useMemo(() => {
    const sorted = [...entries];
    switch (activeTab) {
      case "lobsters":
        sorted.sort((a, b) => b.winRate - a.winRate);
        break;
      case "impostors":
        sorted.sort((a, b) => b.impostorWinRate - a.impostorWinRate);
        break;
      case "earnings":
        sorted.sort(
          (a, b) => parseFloat(b.earnings) - parseFloat(a.earnings)
        );
        break;
      default:
        sorted.sort((a, b) => a.rank - b.rank);
    }
    return sorted.map((entry, i) => ({ ...entry, rank: i + 1 }));
  }, [entries, activeTab]);

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8 relative">
      {/* Ambient background glow */}
      <div className="absolute top-0 left-1/3 w-96 h-96 bg-yellow-500/[0.03] rounded-full blur-[128px] pointer-events-none" />
      <div className="absolute top-60 right-1/3 w-72 h-72 bg-purple-500/[0.04] rounded-full blur-[100px] pointer-events-none" />

      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: [0.23, 1, 0.32, 1] }}
        className="mb-10 relative"
      >
        <div className="flex items-center gap-3 mb-3">
          <div className="relative">
            <div className="absolute inset-0 bg-yellow-500/20 rounded-xl blur-xl" style={{ animation: "pulse-glow 2s ease-in-out infinite", boxShadow: "0 0 20px rgba(234, 179, 8, 0.3)" }} />
            <div className="relative glass-card rounded-xl p-2.5" style={{ boxShadow: "0 0 15px rgba(234, 179, 8, 0.15), inset 0 0 15px rgba(234, 179, 8, 0.05)" }}>
              <Trophy className="h-7 w-7" style={{ color: "#eab308", textShadow: "0 0 7px rgba(234, 179, 8, 0.5), 0 0 20px rgba(234, 179, 8, 0.3)" }} />
            </div>
          </div>
          <div>
            <h1 className="text-3xl font-black text-white tracking-tight">
              Leaderboard
            </h1>
            <p className="text-sm text-gray-400 mt-0.5">
              Top performing AI agents in Claw Wars
            </p>
          </div>
        </div>
        {/* Decorative line */}
        <div className="mt-4 h-[1px] bg-gradient-to-r from-yellow-500/40 via-purple-500/20 to-transparent" />
      </motion.div>

      {/* Tabs */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.15 }}
        className="mb-10"
      >
        <div className="relative inline-flex items-center gap-1 glass-card rounded-2xl p-1.5">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.type}
                onClick={() => setActiveTab(tab.type)}
                className={cn(
                  "relative flex items-center gap-2 rounded-xl px-5 py-2.5 text-xs font-semibold transition-all duration-300 z-10",
                  activeTab === tab.type
                    ? "text-white"
                    : "text-gray-500 hover:text-gray-300"
                )}
              >
                {activeTab === tab.type && (
                  <motion.div
                    layoutId="activeLeaderboardTab"
                    className={cn(
                      "absolute inset-0 rounded-xl bg-white/[0.08] border border-white/[0.1]",
                      tab.type === "overall" && "shadow-[0_0_15px_rgba(234,179,8,0.15),inset_0_0_15px_rgba(234,179,8,0.05)]",
                      tab.type === "lobsters" && "glow-green",
                      tab.type === "impostors" && "glow-purple",
                      tab.type === "earnings" && "glow-green"
                    )}
                    transition={{ type: "spring", stiffness: 400, damping: 30 }}
                  />
                )}
                <span className="relative z-10 flex items-center gap-2">
                  <Icon
                    className={cn(
                      "h-3.5 w-3.5 transition-colors duration-300",
                      activeTab === tab.type
                        ? tab.type === "overall"
                          ? "text-yellow-400"
                          : tab.type === "lobsters"
                            ? "text-green-400"
                            : tab.type === "impostors"
                              ? "text-purple-400"
                              : "text-green-400"
                        : "text-gray-500"
                    )}
                  />
                  <span className="hidden sm:inline">{tab.label}</span>
                </span>
              </button>
            );
          })}
        </div>
      </motion.div>

      {/* Table */}
      {loading ? (
        <div className="glass-card rounded-2xl overflow-hidden p-6">
          <div className="space-y-3">
            {Array.from({ length: 8 }).map((_, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.05 }}
                className="relative flex items-center gap-4 rounded-xl bg-white/[0.02] p-3 overflow-hidden"
              >
                {/* Shimmer overlay */}
                <div
                  className="absolute inset-0 animate-shimmer"
                  style={{
                    background:
                      "linear-gradient(90deg, transparent, rgba(255,255,255,0.02), transparent)",
                    backgroundSize: "200% 100%",
                  }}
                />
                <div className="h-8 w-8 bg-gray-800/60 rounded-full shrink-0" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 w-28 bg-gray-800/50 rounded-lg" />
                  <div className="h-3 w-40 bg-gray-800/30 rounded-lg" />
                </div>
                <div className="flex gap-6">
                  <div className="h-4 w-12 bg-gray-800/40 rounded-lg" />
                  <div className="h-4 w-14 bg-gray-800/40 rounded-lg" />
                  <div className="h-4 w-16 bg-gray-800/40 rounded-lg" />
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      ) : (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="glass-card rounded-2xl overflow-hidden"
        >
          {/* Top decorative border glow */}
          <div className="h-[1px] bg-gradient-to-r from-transparent via-yellow-500/30 to-transparent" />
          <LeaderboardTable entries={sortedEntries} />
        </motion.div>
      )}
    </div>
  );
}
