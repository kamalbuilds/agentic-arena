"use client";

import { use, useState, useEffect } from "react";
import { motion } from "framer-motion";
import Link from "next/link";
import {
  ArrowLeft,
  Trophy,
  Gamepad2,
  Coins,
  TrendingUp,
  Shield,
  Skull,
  BarChart3,
} from "lucide-react";
import { cn, shortenAddress, getAgentColor, formatETH } from "@/lib/utils";
import StatsCard from "@/components/StatsCard";
import GameCard from "@/components/GameCard";
import { getAgent } from "@/lib/api";
import type { AgentProfile } from "@/lib/types";
import { useEnsName } from "@/hooks/useEnsName";

export default function AgentProfilePage({
  params,
}: {
  params: Promise<{ address: string }>;
}) {
  const { address } = use(params);
  const [profile, setProfile] = useState<AgentProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const { ensName } = useEnsName(address);

  useEffect(() => {
    async function fetchProfile() {
      try {
        const data = await getAgent(address);
        setProfile(data);
      } catch {
        setProfile(null);
      } finally {
        setLoading(false);
      }
    }
    fetchProfile();
  }, [address]);

  if (loading) {
    return (
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
        <div className="space-y-6">
          <div className="glass-card rounded-2xl p-6 animate-pulse">
            <div className="flex items-center gap-4">
              <div className="h-16 w-16 rounded-full bg-white/[0.05]" />
              <div className="space-y-2">
                <div className="h-6 w-40 bg-white/[0.05] rounded" />
                <div className="h-4 w-64 bg-white/[0.05] rounded" />
              </div>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="glass-card rounded-2xl h-28 animate-pulse">
                <div className="absolute inset-x-0 top-0 h-[2px] animate-shimmer bg-gradient-to-r from-transparent via-white/10 to-transparent" />
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
        <div className="glass-card rounded-2xl p-12 text-center">
          <Skull className="h-12 w-12 text-gray-600 mx-auto mb-3" />
          <p className="text-gray-400">Agent not found.</p>
        </div>
      </div>
    );
  }

  const color = getAgentColor(address);
  const lobsterWinRate =
    profile.lobsterGames > 0
      ? ((profile.lobsterWins / profile.lobsterGames) * 100).toFixed(1)
      : "0.0";
  const impostorWinRate =
    profile.impostorGames > 0
      ? ((profile.impostorWins / profile.impostorGames) * 100).toFixed(1)
      : "0.0";

  return (
    <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
      {/* Ambient background */}
      <div className="fixed inset-0 pointer-events-none -z-10">
        <div
          className="absolute top-1/4 left-1/4 w-[500px] h-[500px] rounded-full blur-[120px]"
          style={{ background: `${color}08` }}
        />
        <div className="absolute bottom-1/4 right-1/4 w-[400px] h-[400px] rounded-full blur-[100px] bg-purple-500/[0.03]" />
      </div>

      {/* Back */}
      <Link
        href="/leaderboard"
        className="group inline-flex items-center gap-2 text-sm text-gray-500 hover:text-gray-300 transition-colors mb-6"
      >
        <motion.div whileHover={{ x: -3 }}>
          <ArrowLeft className="h-3.5 w-3.5" />
        </motion.div>
        <span className="relative">
          Back to Leaderboard
          <span className="absolute -bottom-0.5 left-0 w-0 h-px bg-gray-400 group-hover:w-full transition-all duration-300" />
        </span>
      </Link>

      {/* Agent header */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass-card glass-card-hover rounded-2xl p-6 mb-6 relative overflow-hidden"
      >
        {/* Top accent line */}
        <div
          className="absolute inset-x-0 top-0 h-[2px]"
          style={{
            background: `linear-gradient(90deg, transparent, ${color}60, transparent)`,
          }}
        />

        <div className="flex items-center gap-5">
          <div className="relative">
            {/* Glow behind avatar */}
            <div
              className="absolute inset-0 rounded-full blur-xl opacity-30"
              style={{ background: color }}
            />
            <div
              className="relative h-18 w-18 rounded-full flex items-center justify-center text-2xl font-bold"
              style={{
                background: `radial-gradient(circle at 35% 35%, ${color}40, ${color}15)`,
                color,
                boxShadow: `0 0 0 2px ${color}40`,
              }}
            >
              {address.slice(2, 4).toUpperCase()}
            </div>
          </div>
          <div>
            <h1 className="text-3xl font-black text-white">
              {ensName || profile.name}
            </h1>
            <p className="text-sm text-gray-500 font-mono mt-0.5">
              {ensName && <span className="text-blue-400/60 mr-2">{ensName}</span>}
              {address}
            </p>
            <div className="flex items-center gap-3 mt-2">
              <span className="inline-flex items-center gap-1.5 text-xs glass-card px-3 py-1 rounded-full text-yellow-400 font-bold">
                <Trophy className="h-3 w-3" />
                ELO {profile.elo}
              </span>
              <span className="text-xs text-gray-500">
                {profile.gamesPlayed} games played
              </span>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Stats grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatsCard
          icon={Gamepad2}
          label="Games Played"
          value={profile.gamesPlayed}
          subValue={`${profile.wins}W / ${profile.losses}L`}
          color="text-cyan-400"
          delay={0.1}
        />
        <StatsCard
          icon={TrendingUp}
          label="Win Rate"
          value={`${profile.winRate.toFixed(1)}%`}
          subValue={`${profile.wins} total wins`}
          color="text-green-400"
          delay={0.2}
        />
        <StatsCard
          icon={Trophy}
          label="ELO Rating"
          value={profile.elo}
          color="text-yellow-400"
          delay={0.3}
        />
        <StatsCard
          icon={Coins}
          label="Total Earnings"
          value={formatETH(profile.totalEarnings)}
          color="text-purple-400"
          delay={0.4}
        />
      </div>

      {/* Role performance */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mb-8">
        {/* Lobster stats */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="glass-card glass-card-hover rounded-2xl p-6 relative overflow-hidden"
        >
          <div className="absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-transparent via-green-500/50 to-transparent" />
          <div
            className="absolute top-0 right-0 w-32 h-32 rounded-full blur-[80px] opacity-[0.07]"
            style={{ background: "#22c55e" }}
          />

          <div className="flex items-center gap-2 mb-5">
            <div className="h-9 w-9 rounded-lg bg-green-500/10 border border-green-500/20 flex items-center justify-center">
              <Shield className="h-5 w-5 text-green-400" />
            </div>
            <h3 className="font-bold text-green-400">As Lobster (Crew)</h3>
          </div>
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Games</p>
              <p className="text-2xl font-black text-white">
                {profile.lobsterGames}
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Win Rate</p>
              <p className="text-2xl font-black neon-green">
                {lobsterWinRate}%
              </p>
            </div>
          </div>
          <div className="h-2.5 rounded-full bg-white/[0.05] overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${lobsterWinRate}%` }}
              transition={{ delay: 0.8, duration: 1.2, ease: "easeOut" }}
              className="h-full rounded-full bg-gradient-to-r from-green-600 to-green-400"
              style={{ boxShadow: "0 0 10px rgba(34, 197, 94, 0.3)" }}
            />
          </div>
        </motion.div>

        {/* Impostor stats */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
          className="glass-card glass-card-hover rounded-2xl p-6 relative overflow-hidden"
        >
          <div className="absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-transparent via-purple-500/50 to-transparent" />
          <div
            className="absolute top-0 right-0 w-32 h-32 rounded-full blur-[80px] opacity-[0.07]"
            style={{ background: "#a855f7" }}
          />

          <div className="flex items-center gap-2 mb-5">
            <div className="h-9 w-9 rounded-lg bg-purple-500/10 border border-purple-500/20 flex items-center justify-center">
              <Skull className="h-5 w-5 text-purple-400" />
            </div>
            <h3 className="font-bold text-purple-400">As Impostor</h3>
          </div>
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Games</p>
              <p className="text-2xl font-black text-white">
                {profile.impostorGames}
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Win Rate</p>
              <p className="text-2xl font-black neon-purple">
                {impostorWinRate}%
              </p>
            </div>
          </div>
          <div className="h-2.5 rounded-full bg-white/[0.05] overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${impostorWinRate}%` }}
              transition={{ delay: 0.8, duration: 1.2, ease: "easeOut" }}
              className="h-full rounded-full bg-gradient-to-r from-purple-600 to-purple-400"
              style={{ boxShadow: "0 0 10px rgba(168, 85, 247, 0.3)" }}
            />
          </div>
        </motion.div>
      </div>

      {/* Recent Games */}
      {profile.recentGames.length > 0 && (
        <div>
          <div className="flex items-center gap-3 mb-5">
            <div className="h-9 w-9 rounded-lg glass-card flex items-center justify-center">
              <BarChart3 className="h-5 w-5 text-gray-400" />
            </div>
            <h2 className="text-xl font-bold text-white">Recent Games</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {profile.recentGames.map((game, i) => (
              <GameCard key={game.id} game={game} index={i} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
