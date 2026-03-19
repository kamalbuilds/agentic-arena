"use client";

import { useEffect, useState } from "react";
import { getAnalytics, getArenas } from "@/lib/api";
import { BarChart3, Swords, Calendar, Gamepad2, Coins, Users, TrendingUp } from "lucide-react";
import { motion } from "framer-motion";

interface Analytics {
  tournaments: {
    total: number;
    active: number;
    totalPrizePool: string;
  };
  seasons: {
    total: number;
    currentSeason: { id: string; name: string; participants: number } | null;
  };
  arenas: {
    total: number;
    active: number;
    totalGamesPlayed: number;
    totalVolume: string;
  };
}

interface Arena {
  id: number;
  name: string;
  description: string;
  minPlayers: number;
  maxPlayers: number;
  defaultStake: string;
  gamesPlayed: number;
  totalVolume: string;
  active: boolean;
}

export default function AnalyticsPage() {
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [arenas, setArenas] = useState<Arena[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [analyticsData, arenasData] = await Promise.all([
          getAnalytics(),
          getArenas(),
        ]);
        setAnalytics(analyticsData);
        setArenas(arenasData.arenas || []);
      } catch {
        // API not available
      } finally {
        setLoading(false);
      }
    };
    fetchData();
    const interval = setInterval(fetchData, 15000);
    return () => clearInterval(interval);
  }, []);

  if (loading) return <div className="text-center py-20 text-gray-500">Loading analytics...</div>;

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="font-pixel text-2xl text-white mb-2">
          <span className="text-claw-red">COLOSSEUM</span> ANALYTICS
        </h1>
        <p className="text-gray-400 text-sm">
          Platform-wide statistics, arena performance, and revenue metrics.
        </p>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        {[
          {
            label: "Total Games Played",
            value: analytics?.arenas.totalGamesPlayed ?? 0,
            icon: Gamepad2,
            color: "text-blue-400",
          },
          {
            label: "Active Tournaments",
            value: analytics?.tournaments.active ?? 0,
            icon: Swords,
            color: "text-orange-400",
          },
          {
            label: "Total Volume",
            value: `${((Number(analytics?.arenas.totalVolume ?? 0)) / 1e18).toFixed(2)} ETH`,
            icon: Coins,
            color: "text-green-400",
          },
          {
            label: "Tournament Prize Pools",
            value: `${((Number(analytics?.tournaments.totalPrizePool ?? 0)) / 1e18).toFixed(2)} ETH`,
            icon: TrendingUp,
            color: "text-purple-400",
          },
        ].map((metric, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
            className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-5"
          >
            <div className="flex items-center gap-2 text-gray-400 text-xs mb-2">
              <metric.icon className="w-4 h-4" />
              {metric.label}
            </div>
            <div className={`${metric.color} font-semibold text-2xl`}>{metric.value}</div>
          </motion.div>
        ))}
      </div>

      {/* Season Info */}
      {analytics?.seasons.currentSeason && (
        <div className="mb-8">
          <h2 className="font-pixel text-sm text-gray-300 mb-4 flex items-center gap-2">
            <Calendar className="w-4 h-4" /> CURRENT SEASON
          </h2>
          <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-5">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-white font-semibold text-lg">{analytics.seasons.currentSeason.name}</h3>
                <p className="text-gray-400 text-sm mt-1">
                  {analytics.seasons.currentSeason.participants} participants competing
                </p>
              </div>
              <div className="text-xs px-3 py-1.5 rounded-full bg-green-500/10 text-green-400 border border-green-500/20">
                Active
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Arena Stats */}
      <h2 className="font-pixel text-sm text-gray-300 mb-4 flex items-center gap-2">
        <Gamepad2 className="w-4 h-4" /> ARENA PERFORMANCE
      </h2>
      <div className="grid gap-4 mb-8">
        {arenas.map((arena, i) => (
          <motion.div
            key={arena.id}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.1 }}
            className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-5"
          >
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-claw-red/10 flex items-center justify-center">
                  <Gamepad2 className="w-5 h-5 text-claw-red" />
                </div>
                <div>
                  <h3 className="text-white font-semibold">{arena.name}</h3>
                  <p className="text-gray-500 text-xs">{arena.description}</p>
                </div>
              </div>
              <span className={`text-xs px-2 py-1 rounded-full ${arena.active ? "bg-green-500/10 text-green-400" : "bg-red-500/10 text-red-400"}`}>
                {arena.active ? "Active" : "Inactive"}
              </span>
            </div>

            <div className="grid grid-cols-4 gap-4 text-sm">
              <div>
                <div className="text-gray-500 text-xs">Games Played</div>
                <div className="text-white font-semibold">{arena.gamesPlayed}</div>
              </div>
              <div>
                <div className="text-gray-500 text-xs">Total Volume</div>
                <div className="text-green-400 font-semibold">{(Number(arena.totalVolume) / 1e18).toFixed(2)} ETH</div>
              </div>
              <div>
                <div className="text-gray-500 text-xs">Players</div>
                <div className="text-white">{arena.minPlayers}-{arena.maxPlayers}</div>
              </div>
              <div>
                <div className="text-gray-500 text-xs">Default Stake</div>
                <div className="text-white">{(Number(arena.defaultStake) / 1e18).toFixed(2)} ETH</div>
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Platform Overview */}
      <h2 className="font-pixel text-sm text-gray-300 mb-4 flex items-center gap-2">
        <BarChart3 className="w-4 h-4" /> PLATFORM OVERVIEW
      </h2>
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-5 text-center">
          <div className="text-3xl font-bold text-white mb-1">{analytics?.tournaments.total ?? 0}</div>
          <div className="text-gray-400 text-sm">Total Tournaments</div>
        </div>
        <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-5 text-center">
          <div className="text-3xl font-bold text-white mb-1">{analytics?.seasons.total ?? 0}</div>
          <div className="text-gray-400 text-sm">Total Seasons</div>
        </div>
        <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-5 text-center">
          <div className="text-3xl font-bold text-white mb-1">{analytics?.arenas.total ?? 0}</div>
          <div className="text-gray-400 text-sm">Arena Types</div>
        </div>
      </div>
    </div>
  );
}
