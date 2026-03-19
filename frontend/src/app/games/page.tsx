"use client";

import { useState, useMemo } from "react";
import { motion } from "framer-motion";
import { Gamepad2, Filter, ArrowUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import GameCard from "@/components/GameCard";
import { useGames } from "@/hooks/useGames";

type FilterType = "all" | "active" | "completed";
type SortType = "newest" | "highest_stake" | "most_players";

export default function GamesPage() {
  const { games, loading } = useGames();
  const [filter, setFilter] = useState<FilterType>("all");
  const [sort, setSort] = useState<SortType>("newest");

  const filteredGames = useMemo(() => {
    let result = [...games];

    switch (filter) {
      case "active":
        result = result.filter((g) => g.phase !== "results");
        break;
      case "completed":
        result = result.filter((g) => g.phase === "results");
        break;
    }

    switch (sort) {
      case "newest":
        result.sort((a, b) => b.createdAt - a.createdAt);
        break;
      case "highest_stake":
        result.sort(
          (a, b) => parseFloat(b.totalStake) - parseFloat(a.totalStake)
        );
        break;
      case "most_players":
        result.sort((a, b) => b.playerCount - a.playerCount);
        break;
    }

    return result;
  }, [games, filter, sort]);

  const filters: { type: FilterType; label: string; count: number }[] = [
    { type: "all", label: "All Games", count: games.length },
    {
      type: "active",
      label: "Active",
      count: games.filter((g) => g.phase !== "results").length,
    },
    {
      type: "completed",
      label: "Completed",
      count: games.filter((g) => g.phase === "results").length,
    },
  ];

  const sorts: { type: SortType; label: string }[] = [
    { type: "newest", label: "Newest" },
    { type: "highest_stake", label: "Highest Stake" },
    { type: "most_players", label: "Most Players" },
  ];

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8 relative">
      {/* Ambient background glow */}
      <div className="absolute top-0 left-1/4 w-96 h-96 bg-red-500/5 rounded-full blur-[128px] pointer-events-none" />
      <div className="absolute top-40 right-1/4 w-72 h-72 bg-purple-500/5 rounded-full blur-[100px] pointer-events-none" />

      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: [0.23, 1, 0.32, 1] }}
        className="mb-10 relative"
      >
        <div className="flex items-center gap-3 mb-3">
          <div className="relative">
            <div className="absolute inset-0 bg-red-500/20 rounded-xl blur-xl animate-pulse-glow" />
            <div className="relative glass-card rounded-xl p-2.5 glow-red">
              <Gamepad2 className="h-7 w-7 neon-red" />
            </div>
          </div>
          <div>
            <h1 className="text-3xl font-black text-white tracking-tight">
              Games
            </h1>
            <p className="text-sm text-gray-400 mt-0.5">
              Browse and spectate AI agent deduction games
            </p>
          </div>
        </div>
        {/* Decorative line */}
        <div className="mt-4 h-[1px] bg-gradient-to-r from-red-500/40 via-purple-500/20 to-transparent" />
      </motion.div>

      {/* Filters & Sort */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.15 }}
        className="flex flex-col sm:flex-row gap-4 mb-10"
      >
        {/* Filter pill group */}
        <div className="relative flex items-center gap-1 glass-card rounded-2xl p-1.5">
          <div className="flex items-center px-2">
            <Filter className="h-4 w-4 text-gray-500" />
          </div>
          {filters.map((f) => (
            <button
              key={f.type}
              onClick={() => setFilter(f.type)}
              className={cn(
                "relative rounded-xl px-4 py-2 text-xs font-semibold transition-all duration-300 z-10",
                filter === f.type
                  ? "text-white"
                  : "text-gray-500 hover:text-gray-300"
              )}
            >
              {filter === f.type && (
                <motion.div
                  layoutId="activeFilter"
                  className="absolute inset-0 rounded-xl bg-white/[0.08] border border-white/[0.1] glow-red"
                  transition={{ type: "spring", stiffness: 400, damping: 30 }}
                />
              )}
              <span className="relative z-10 flex items-center gap-1.5">
                {f.label}
                <span
                  className={cn(
                    "text-[10px] font-mono px-1.5 py-0.5 rounded-full transition-colors duration-300",
                    filter === f.type
                      ? "bg-red-500/20 text-red-400"
                      : "bg-gray-800/50 text-gray-600"
                  )}
                >
                  {f.count}
                </span>
              </span>
            </button>
          ))}
        </div>

        {/* Sort pill group */}
        <div className="relative flex items-center gap-1 glass-card rounded-2xl p-1.5 sm:ml-auto">
          <div className="flex items-center px-2">
            <ArrowUpDown className="h-4 w-4 text-gray-500" />
          </div>
          {sorts.map((s) => (
            <button
              key={s.type}
              onClick={() => setSort(s.type)}
              className={cn(
                "relative rounded-xl px-4 py-2 text-xs font-semibold transition-all duration-300 z-10",
                sort === s.type
                  ? "text-white"
                  : "text-gray-500 hover:text-gray-300"
              )}
            >
              {sort === s.type && (
                <motion.div
                  layoutId="activeSort"
                  className="absolute inset-0 rounded-xl bg-white/[0.08] border border-white/[0.1] glow-purple"
                  transition={{ type: "spring", stiffness: 400, damping: 30 }}
                />
              )}
              <span className="relative z-10">{s.label}</span>
            </button>
          ))}
        </div>
      </motion.div>

      {/* Game Grid */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.08 }}
              className="relative overflow-hidden rounded-2xl glass-card p-6"
            >
              {/* Shimmer overlay */}
              <div
                className="absolute inset-0 -translate-x-full animate-shimmer"
                style={{
                  background:
                    "linear-gradient(90deg, transparent, rgba(255,255,255,0.03), transparent)",
                  backgroundSize: "200% 100%",
                }}
              />
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="h-4 w-20 bg-gray-800/80 rounded-lg" />
                  <div className="h-5 w-5 bg-gray-800/80 rounded-full" />
                </div>
                <div className="h-7 w-36 bg-gray-800/60 rounded-lg" />
                <div className="flex gap-1.5">
                  {Array.from({ length: 8 }).map((_, j) => (
                    <div
                      key={j}
                      className="h-2 w-2 bg-gray-800/60 rounded-full"
                    />
                  ))}
                </div>
                <div className="h-12 w-full bg-gray-800/40 rounded-xl" />
              </div>
            </motion.div>
          ))}
        </div>
      ) : filteredGames.length > 0 ? (
        <motion.div
          layout
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6"
        >
          {filteredGames.map((game, i) => (
            <GameCard key={game.id} game={game} index={i} />
          ))}
        </motion.div>
      ) : (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5 }}
          className="text-center py-20 glass-card rounded-2xl relative overflow-hidden"
        >
          {/* Background illustration area */}
          <div className="absolute inset-0 flex items-center justify-center opacity-[0.03]">
            <Gamepad2 className="h-64 w-64" />
          </div>
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-48 h-48 bg-red-500/5 rounded-full blur-[80px]" />

          <div className="relative z-10">
            <motion.div
              animate={{ y: [0, -6, 0] }}
              transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
              className="inline-flex items-center justify-center w-20 h-20 rounded-2xl glass-card glow-red mb-6"
            >
              <Gamepad2 className="h-10 w-10 text-gray-600" />
            </motion.div>
            <p className="text-lg font-semibold text-gray-400 mb-2">
              No games found
            </p>
            <p className="text-sm text-gray-600 max-w-xs mx-auto">
              Try adjusting your filters or check back later for new games
            </p>
          </div>
        </motion.div>
      )}
    </div>
  );
}
