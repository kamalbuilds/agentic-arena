"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import {
  cn,
  formatETH,
  formatTime,
  getPhaseColor,
  getPhaseBgColor,
} from "@/lib/utils";
import { Users, Coins, Clock, Trophy } from "lucide-react";
import type { GameSummary } from "@/lib/types";

interface GameCardProps {
  game: GameSummary;
  index: number;
}

function getPhaseNeonClass(phase: string): string {
  switch (phase.toLowerCase()) {
    case "discussion":
      return "neon-green";
    case "voting":
      return "neon-orange";
    case "elimination":
      return "neon-red";
    case "results":
      return "neon-purple";
    default:
      return "";
  }
}

function getPhaseGlowClass(phase: string): string {
  switch (phase.toLowerCase()) {
    case "discussion":
      return "glow-green";
    case "voting":
      return "glow-orange";
    case "elimination":
      return "glow-red";
    case "results":
      return "glow-purple";
    default:
      return "";
  }
}

function getPhaseAccentColor(phase: string): string {
  switch (phase.toLowerCase()) {
    case "discussion":
      return "rgba(34, 197, 94, 0.4)";
    case "voting":
      return "rgba(251, 146, 60, 0.4)";
    case "elimination":
      return "rgba(239, 68, 68, 0.4)";
    case "results":
      return "rgba(168, 85, 247, 0.4)";
    default:
      return "rgba(148, 163, 184, 0.2)";
  }
}

function PlayerDots({
  count,
  max,
  phase,
}: {
  count: number;
  max: number;
  phase: string;
}) {
  const activeColor =
    phase === "discussion"
      ? "bg-green-400"
      : phase === "voting"
        ? "bg-orange-400"
        : phase === "elimination"
          ? "bg-red-400"
          : phase === "results"
            ? "bg-purple-400"
            : "bg-gray-400";

  const activeShadow =
    phase === "discussion"
      ? "shadow-[0_0_6px_rgba(34,197,94,0.6)]"
      : phase === "voting"
        ? "shadow-[0_0_6px_rgba(251,146,60,0.6)]"
        : phase === "elimination"
          ? "shadow-[0_0_6px_rgba(239,68,68,0.6)]"
          : phase === "results"
            ? "shadow-[0_0_6px_rgba(168,85,247,0.6)]"
            : "";

  return (
    <div className="flex items-center gap-1">
      {Array.from({ length: max }).map((_, i) => (
        <motion.div
          key={i}
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ delay: i * 0.05, type: "spring", stiffness: 300 }}
          className={cn(
            "h-2 w-2 rounded-full transition-all duration-300",
            i < count
              ? cn(activeColor, activeShadow)
              : "bg-gray-700/60 border border-gray-600/30"
          )}
        />
      ))}
    </div>
  );
}

export default function GameCard({ game, index }: GameCardProps) {
  const isActive = game.phase !== "results";
  const isLive = isActive && game.phase !== "lobby";
  const hasWinner = game.winner !== null;

  const winnerGlowClass =
    game.winner === "lobsters"
      ? "shadow-[0_0_30px_rgba(34,197,94,0.15),0_0_60px_rgba(34,197,94,0.05)]"
      : game.winner === "impostor"
        ? "shadow-[0_0_30px_rgba(168,85,247,0.15),0_0_60px_rgba(168,85,247,0.05)]"
        : "";

  const winnerBorderClass =
    game.winner === "lobsters"
      ? "border-green-500/30"
      : game.winner === "impostor"
        ? "border-purple-500/30"
        : "";

  return (
    <motion.div
      initial={{ opacity: 0, y: 30, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{
        delay: index * 0.08,
        duration: 0.5,
        ease: [0.23, 1, 0.32, 1],
      }}
      whileHover={{ y: -6, transition: { duration: 0.3, ease: "easeOut" } }}
      className="group"
    >
      <Link href={`/games/${game.id}`}>
        <div
          className={cn(
            "relative overflow-hidden rounded-2xl p-[1px] transition-all duration-500 cursor-pointer",
            hasWinner ? winnerGlowClass : ""
          )}
        >
          {/* Inner card */}
          <div
            className={cn(
              "glass-card glass-card-hover relative rounded-2xl p-5 transition-all duration-300",
              hasWinner ? winnerBorderClass : "",
              isLive && getPhaseGlowClass(game.phase)
            )}
          >

            {/* ---- Header Row: Game ID + Live/Winner Badge ---- */}
            <div className="flex items-start justify-between mb-4">
              <div>
                <h3 className="text-sm font-bold text-gray-300 group-hover:text-white transition-colors duration-300 tracking-wide">
                  Game{" "}
                  <span className="text-gray-400 font-mono text-xs">
                    #{game.id.split("-").pop() || game.id.slice(-6)}
                  </span>
                </h3>
              </div>

              {/* Live indicator */}
              {isLive && (
                <div className="flex items-center gap-1.5">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-50" />
                    <span className="relative inline-flex h-2 w-2 rounded-full bg-red-500" />
                  </span>
                  <span className="text-[10px] font-bold text-red-400 uppercase tracking-wider">
                    Live
                  </span>
                </div>
              )}

              {/* Winner badge */}
              {hasWinner && (
                <motion.div
                  initial={{ scale: 0, rotate: -12 }}
                  animate={{ scale: 1, rotate: 0 }}
                  transition={{ type: "spring", stiffness: 200, damping: 12 }}
                  className={cn(
                    "flex items-center gap-1.5 rounded-full px-2.5 py-1",
                    game.winner === "lobsters"
                      ? "bg-green-500/15 border border-green-500/30"
                      : "bg-purple-500/15 border border-purple-500/30"
                  )}
                >
                  <Trophy
                    className={cn(
                      "h-3 w-3",
                      game.winner === "lobsters"
                        ? "text-green-400"
                        : "text-purple-400"
                    )}
                  />
                  <span
                    className={cn(
                      "text-[10px] font-bold uppercase tracking-wider",
                      game.winner === "lobsters"
                        ? "neon-green"
                        : "neon-purple"
                    )}
                  >
                    {game.winner === "lobsters"
                      ? "Lobsters Win"
                      : "Impostor Wins"}
                  </span>
                </motion.div>
              )}
            </div>

            {/* ---- Phase Badge ---- */}
            <div className="mb-5">
              <motion.div
                className={cn(
                  "inline-flex items-center gap-2 rounded-full border px-3.5 py-1.5 font-pixel text-[8px] backdrop-blur-sm",
                  getPhaseBgColor(game.phase)
                )}
                animate={
                  game.phase === "voting"
                    ? { scale: [1, 1.03, 1] }
                    : game.phase === "elimination"
                      ? { scale: [1, 1.02, 1] }
                      : {}
                }
                transition={{ duration: 1.5, repeat: Infinity }}
              >
                {/* Phase dot indicator */}
                <span
                  className={cn(
                    "h-1.5 w-1.5 rounded-full",
                    game.phase === "discussion" && "bg-green-400 shadow-[0_0_6px_rgba(34,197,94,0.8)]",
                    game.phase === "voting" && "bg-orange-400 shadow-[0_0_6px_rgba(251,146,60,0.8)]",
                    game.phase === "elimination" && "bg-red-400 shadow-[0_0_6px_rgba(239,68,68,0.8)]",
                    game.phase === "results" && "bg-purple-400 shadow-[0_0_6px_rgba(168,85,247,0.8)]",
                    game.phase === "lobby" && "bg-gray-400"
                  )}
                />

                <span className={cn(getPhaseNeonClass(game.phase) || getPhaseColor(game.phase))}>
                  {game.phase.charAt(0).toUpperCase() + game.phase.slice(1)}
                </span>

                {game.timeRemaining > 0 && (
                  <>
                    <span className="text-gray-600/80">|</span>
                    <span className="text-gray-300 font-mono text-[11px] tabular-nums">
                      {formatTime(game.timeRemaining)}
                    </span>
                  </>
                )}
              </motion.div>
            </div>

            {/* ---- Player Dots Visual ---- */}
            <div className="mb-4">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[10px] text-gray-500 uppercase tracking-widest font-medium">
                  Players
                </span>
                <span className="text-[10px] text-gray-500 font-mono">
                  {game.playerCount}/{game.maxPlayers}
                </span>
              </div>
              <PlayerDots
                count={game.playerCount}
                max={game.maxPlayers}
                phase={game.phase}
              />
            </div>

            {/* ---- Stats Row ---- */}
            <div className="flex items-center gap-0 rounded-xl bg-gray-900/40 border border-gray-800/50 overflow-hidden">
              {/* Stake */}
              <div className="flex-1 flex items-center justify-center gap-2 py-2.5 px-3">
                <Coins className="h-3.5 w-3.5 text-yellow-500/70" />
                <div className="flex flex-col">
                  <span className="text-[10px] text-gray-500 uppercase tracking-wider leading-none mb-0.5">
                    Stake
                  </span>
                  <span className="text-xs text-white font-semibold leading-none">
                    {formatETH(game.totalStake)}
                  </span>
                </div>
              </div>

              {/* Separator */}
              <div className="w-[1px] h-8 bg-gradient-to-b from-transparent via-gray-700/50 to-transparent" />

              {/* Round */}
              <div className="flex-1 flex items-center justify-center gap-2 py-2.5 px-3">
                <Clock className="h-3.5 w-3.5 text-cyan-500/70" />
                <div className="flex flex-col">
                  <span className="text-[10px] text-gray-500 uppercase tracking-wider leading-none mb-0.5">
                    Round
                  </span>
                  <span className="text-xs text-white font-semibold leading-none">
                    {game.round}
                  </span>
                </div>
              </div>

              {/* Separator */}
              <div className="w-[1px] h-8 bg-gradient-to-b from-transparent via-gray-700/50 to-transparent" />

              {/* Players */}
              <div className="flex-1 flex items-center justify-center gap-2 py-2.5 px-3">
                <Users className="h-3.5 w-3.5 text-blue-500/70" />
                <div className="flex flex-col">
                  <span className="text-[10px] text-gray-500 uppercase tracking-wider leading-none mb-0.5">
                    Agents
                  </span>
                  <span className="text-xs text-white font-semibold leading-none">
                    {game.playerCount}
                  </span>
                </div>
              </div>
            </div>

          </div>
        </div>
      </Link>
    </motion.div>
  );
}
