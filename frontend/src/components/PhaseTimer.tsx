"use client";

import { motion } from "framer-motion";
import { cn, formatTime, getPhaseColor, getPhaseBgColor } from "@/lib/utils";
import { Clock, MessageCircle, Vote, Skull, Trophy } from "lucide-react";
import type { GamePhase } from "@/lib/types";

interface PhaseTimerProps {
  phase: GamePhase;
  timeRemaining: number;
  round: number;
}

const phaseConfig: Record<
  GamePhase,
  {
    label: string;
    icon: typeof Clock;
    description: string;
    neonClass: string;
    glowClass: string;
    phaseGlowClass: string;
    accentColor: string;
    gradientFrom: string;
    gradientTo: string;
  }
> = {
  lobby: {
    label: "Lobby",
    icon: Clock,
    description: "Waiting for players to join...",
    neonClass: "",
    glowClass: "",
    phaseGlowClass: "",
    accentColor: "rgba(148, 163, 184, 0.4)",
    gradientFrom: "from-gray-500/20",
    gradientTo: "to-gray-600/5",
  },
  discussion: {
    label: "Discussion",
    icon: MessageCircle,
    description: "Agents are debating who the impostor is",
    neonClass: "neon-green",
    glowClass: "glow-green",
    phaseGlowClass: "phase-discussion",
    accentColor: "rgba(34, 197, 94, 0.5)",
    gradientFrom: "from-green-500/20",
    gradientTo: "to-emerald-500/5",
  },
  voting: {
    label: "Voting",
    icon: Vote,
    description: "Agents are casting their votes",
    neonClass: "neon-orange",
    glowClass: "glow-orange",
    phaseGlowClass: "phase-voting",
    accentColor: "rgba(251, 146, 60, 0.5)",
    gradientFrom: "from-orange-500/20",
    gradientTo: "to-amber-500/5",
  },
  elimination: {
    label: "Elimination",
    icon: Skull,
    description: "Someone is about to be eliminated...",
    neonClass: "neon-red",
    glowClass: "glow-red",
    phaseGlowClass: "phase-elimination",
    accentColor: "rgba(239, 68, 68, 0.5)",
    gradientFrom: "from-red-500/20",
    gradientTo: "to-rose-500/5",
  },
  results: {
    label: "Game Over",
    icon: Trophy,
    description: "The game has concluded",
    neonClass: "neon-purple",
    glowClass: "glow-purple",
    phaseGlowClass: "",
    accentColor: "rgba(168, 85, 247, 0.5)",
    gradientFrom: "from-purple-500/20",
    gradientTo: "to-violet-500/5",
  },
};

// Max times per phase for progress bar calculation
const phaseMaxTime: Record<GamePhase, number> = {
  lobby: 120,
  discussion: 60,
  voting: 30,
  elimination: 15,
  results: 0,
};

export default function PhaseTimer({
  phase,
  timeRemaining,
  round,
}: PhaseTimerProps) {
  const config = phaseConfig[phase];
  const Icon = config.icon;
  const isLowTime = timeRemaining > 0 && timeRemaining <= 10;
  const maxTime = phaseMaxTime[phase] || 60;
  const progressPercent = maxTime > 0 ? (timeRemaining / maxTime) * 100 : 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className={cn(
        "glass-card card-shine relative overflow-hidden rounded-2xl",
        config.phaseGlowClass
      )}
    >
      {/* Ambient gradient background */}
      <div
        className={cn(
          "absolute inset-0 bg-gradient-to-br opacity-60 pointer-events-none",
          config.gradientFrom,
          config.gradientTo
        )}
      />

      {/* Content */}
      <div className="relative z-10 p-5">
        <div className="flex items-center justify-between">
          {/* Left: Icon + Phase Info */}
          <div className="flex items-center gap-4">
            {/* Icon */}
            <div
              className={cn(
                "flex h-10 w-10 items-center justify-center rounded-lg",
                "bg-white/[0.04] border border-white/[0.06]"
              )}
            >
              <Icon
                className={cn("h-5 w-5", config.neonClass || getPhaseColor(phase))}
              />
            </div>

            {/* Phase name + description */}
            <div>
              <div className="flex items-center gap-3">
                <span
                  className={cn(
                    "font-pixel text-xs",
                    config.neonClass || getPhaseColor(phase)
                  )}
                >
                  {config.label.toUpperCase()}
                </span>

                {/* Round pill */}
                <span
                  className={cn(
                    "inline-flex items-center px-2.5 py-0.5 rounded-full",
                    "text-[10px] font-bold uppercase tracking-widest",
                    "bg-white/[0.05] border border-white/[0.08] text-gray-400"
                  )}
                >
                  Round {round}
                </span>
              </div>
              <p className="text-xs text-gray-500 mt-0.5">{config.description}</p>
            </div>
          </div>

          {/* Right: Countdown timer */}
          {timeRemaining > 0 && (
            <div className="flex flex-col items-end">
              <span
                className={cn(
                  "text-3xl font-mono font-bold tabular-nums tracking-tighter",
                  isLowTime
                    ? "text-red-400"
                    : config.neonClass || getPhaseColor(phase)
                )}
              >
                {formatTime(timeRemaining)}
              </span>
              {isLowTime && (
                <span className="text-[10px] font-semibold uppercase tracking-wider text-red-400/70 mt-0.5">
                  Low time
                </span>
              )}
            </div>
          )}

          {/* Results: no timer, show trophy glow */}
          {phase === "results" && (
            <div className="neon-purple text-xl font-bold tracking-tight">
              Complete
            </div>
          )}
        </div>
      </div>

      {/* Progress bar at bottom */}
      {timeRemaining > 0 && (
        <div className="relative h-0.5 w-full bg-white/[0.03]">
          <motion.div
            className={cn(
              "absolute left-0 top-0 h-full rounded-full",
              isLowTime
                ? "bg-red-500"
                : phase === "discussion"
                  ? "bg-green-500"
                  : phase === "voting"
                    ? "bg-orange-500"
                    : phase === "elimination"
                      ? "bg-red-500"
                      : "bg-gray-500"
            )}
            initial={{ width: `${progressPercent}%` }}
            animate={{ width: "0%" }}
            transition={{ duration: timeRemaining, ease: "linear" }}
          />
        </div>
      )}
    </motion.div>
  );
}
