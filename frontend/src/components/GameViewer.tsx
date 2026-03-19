"use client";

import { useRef, useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { motion, AnimatePresence } from "framer-motion";
import { cn, formatETH, shortenAddress, getAgentColor } from "@/lib/utils";
import {
  Users,
  Coins,
  Wifi,
  WifiOff,
  ArrowRight,
  Crown,
  Skull,
  Shield,
  X,
  Vote,
} from "lucide-react";
import PlayerAvatar from "./PlayerAvatar";
import PhaseTimer from "./PhaseTimer";
import DiscussionMessage from "./DiscussionMessage";
import type { GameState, Player, ChatMessage, GamePhase } from "@/lib/types";

const PixiArena = dynamic(() => import("./game/PixiArena"), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center h-[350px]">
      <div className="animate-pulse text-gray-600 text-sm">Loading arena...</div>
    </div>
  ),
});

interface GameViewerProps {
  gameState: GameState | null;
  messages: ChatMessage[];
  phase: GamePhase | null;
  players: Player[];
  timeRemaining: number;
  connected: boolean;
  error: string | null;
  winner: "lobsters" | "impostor" | null;
}

/* ─── helper: phase accent config ─── */
function getPhaseAccent(phase: GamePhase | null) {
  switch (phase) {
    case "discussion":
      return {
        border: "border-green-500/10",
        glow: "phase-discussion",
        accent: "#22c55e",
        accentFaded: "rgba(34,197,94,0.03)",
        neonClass: "neon-green",
        glowClass: "glow-green",
        dotColor: "bg-green-400",
        label: "Discussion Phase",
      };
    case "voting":
      return {
        border: "border-orange-500/10",
        glow: "phase-voting",
        accent: "#fb923c",
        accentFaded: "rgba(251,146,60,0.03)",
        neonClass: "neon-orange",
        glowClass: "glow-orange",
        dotColor: "bg-orange-400",
        label: "Voting Phase",
      };
    case "elimination":
      return {
        border: "border-red-500/10",
        glow: "phase-elimination",
        accent: "#ef4444",
        accentFaded: "rgba(239,68,68,0.03)",
        neonClass: "neon-red",
        glowClass: "glow-red",
        dotColor: "bg-red-400",
        label: "Elimination Phase",
      };
    case "results":
      return {
        border: "border-purple-500/10",
        glow: "",
        accent: "#a855f7",
        accentFaded: "rgba(168,85,247,0.03)",
        neonClass: "neon-purple",
        glowClass: "glow-purple",
        dotColor: "bg-purple-400",
        label: "Results",
      };
    default:
      return {
        border: "border-gray-700/20",
        glow: "",
        accent: "#64748b",
        accentFaded: "rgba(100,116,139,0.02)",
        neonClass: "",
        glowClass: "",
        dotColor: "bg-gray-500",
        label: "Lobby",
      };
  }
}

/* ─── confetti particle colors ─── */
const CONFETTI_COLORS_LOBSTER = [
  "#22c55e",
  "#4ade80",
  "#86efac",
  "#16a34a",
  "#34d399",
  "#10b981",
  "#a7f3d0",
  "#6ee7b7",
];
const CONFETTI_COLORS_IMPOSTOR = [
  "#a855f7",
  "#c084fc",
  "#e879f9",
  "#d946ef",
  "#7c3aed",
  "#8b5cf6",
  "#f0abfc",
  "#d8b4fe",
];

export default function GameViewer({
  gameState,
  messages,
  phase,
  players,
  timeRemaining,
  connected,
  error,
  winner,
}: GameViewerProps) {
  const chatEndRef = useRef<HTMLDivElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const [selectedPlayer, setSelectedPlayer] = useState<string | null>(null);
  const [showWinOverlay, setShowWinOverlay] = useState(true);

  // Auto-scroll chat within its container only (not the page)
  useEffect(() => {
    const container = chatContainerRef.current;
    if (container) {
      container.scrollTop = container.scrollHeight;
    }
  }, [messages]);

  const alivePlayers = players.filter((p) => p.isAlive);
  const eliminatedPlayers = players.filter((p) => !p.isAlive);
  const currentRound = gameState?.round ?? 1;
  const totalStake = gameState?.totalStake ?? "0";

  // Votes tally
  const voteTally: Record<string, string[]> = {};
  if (phase === "voting") {
    players.forEach((p) => {
      if (p.votedFor && p.isAlive) {
        if (!voteTally[p.votedFor]) voteTally[p.votedFor] = [];
        voteTally[p.votedFor].push(p.address);
      }
    });
  }
  const maxVotes = Math.max(
    1,
    ...Object.values(voteTally).map((v) => v.length)
  );

  const accent = getPhaseAccent(phase);
  const confettiColors =
    winner === "lobsters" ? CONFETTI_COLORS_LOBSTER : CONFETTI_COLORS_IMPOSTOR;

  return (
    <div className="relative">
      {/* ━━━ Phase-reactive ambient background tint ━━━ */}
      <div
        className="absolute inset-0 -z-10 rounded-2xl pointer-events-none transition-all duration-1000"
        style={{
          background: `radial-gradient(ellipse at 50% 0%, ${accent.accentFaded} 0%, transparent 60%)`,
        }}
      />

      {/* ━━━━━━━━━━ WINNER OVERLAY ━━━━━━━━━━ */}
      <AnimatePresence>
        {winner && showWinOverlay && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-50 flex items-center justify-center rounded-2xl overflow-hidden"
          >
            {/* Dismiss button */}
            <motion.button
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 1.2 }}
              onClick={() => setShowWinOverlay(false)}
              className="absolute top-4 right-4 z-[60] p-2 rounded-full glass-card border border-gray-600/30 text-gray-400 hover:text-white hover:border-gray-500/50 transition-all"
            >
              <X className="h-5 w-5" />
            </motion.button>
            {/* Dark backdrop with pulsing color wash */}
            <motion.div
              className="absolute inset-0"
              style={{
                background:
                  winner === "lobsters"
                    ? "radial-gradient(ellipse at center, rgba(34,197,94,0.12) 0%, rgba(0,0,0,0.92) 70%)"
                    : "radial-gradient(ellipse at center, rgba(168,85,247,0.12) 0%, rgba(0,0,0,0.92) 70%)",
              }}
              animate={{
                background:
                  winner === "lobsters"
                    ? [
                        "radial-gradient(ellipse at center, rgba(34,197,94,0.12) 0%, rgba(0,0,0,0.92) 70%)",
                        "radial-gradient(ellipse at center, rgba(34,197,94,0.25) 0%, rgba(0,0,0,0.88) 70%)",
                        "radial-gradient(ellipse at center, rgba(34,197,94,0.12) 0%, rgba(0,0,0,0.92) 70%)",
                      ]
                    : [
                        "radial-gradient(ellipse at center, rgba(168,85,247,0.12) 0%, rgba(0,0,0,0.92) 70%)",
                        "radial-gradient(ellipse at center, rgba(168,85,247,0.25) 0%, rgba(0,0,0,0.88) 70%)",
                        "radial-gradient(ellipse at center, rgba(168,85,247,0.12) 0%, rgba(0,0,0,0.92) 70%)",
                      ],
              }}
              transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
            />
            {/* Backdrop blur */}
            <div className="absolute inset-0 backdrop-blur-md" />

            {/* Confetti particles - 40 particles for dramatic effect */}
            {Array.from({ length: 40 }).map((_, i) => {
              const startX = (Math.random() - 0.5) * 100;
              const size = 3 + Math.random() * 8;
              const isRect = Math.random() > 0.5;
              return (
                <motion.div
                  key={`confetti-${i}`}
                  className="absolute pointer-events-none"
                  style={{
                    width: isRect ? size * 2.5 : size,
                    height: size,
                    borderRadius: isRect ? "2px" : "50%",
                    backgroundColor:
                      confettiColors[i % confettiColors.length],
                    left: `calc(50% + ${startX}%)`,
                    top: "50%",
                    boxShadow: `0 0 6px ${confettiColors[i % confettiColors.length]}80`,
                  }}
                  initial={{ y: 0, x: 0, opacity: 1, rotate: 0, scale: 0 }}
                  animate={{
                    y: [0, (Math.random() - 0.5) * 500 - 100],
                    x: [(Math.random() - 0.5) * 80, (Math.random() - 0.5) * 400],
                    opacity: [0, 1, 1, 0],
                    rotate: [0, Math.random() * 720 - 360],
                    scale: [0, 1.2, 1, 0.3],
                  }}
                  transition={{
                    duration: 2.5 + Math.random() * 2,
                    repeat: Infinity,
                    repeatDelay: Math.random() * 1.5,
                    delay: Math.random() * 1.5,
                    ease: "easeOut",
                  }}
                />
              );
            })}

            {/* Radiating ring burst */}
            {Array.from({ length: 3 }).map((_, i) => (
              <motion.div
                key={`ring-${i}`}
                className="absolute rounded-full pointer-events-none"
                style={{
                  border: `2px solid ${winner === "lobsters" ? "#22c55e" : "#a855f7"}`,
                }}
                initial={{ width: 0, height: 0, opacity: 0.6 }}
                animate={{
                  width: [0, 600],
                  height: [0, 600],
                  opacity: [0.5, 0],
                }}
                transition={{
                  duration: 2.5,
                  repeat: Infinity,
                  delay: i * 0.8,
                  ease: "easeOut",
                }}
              />
            ))}

            {/* Center content */}
            <motion.div
              initial={{ scale: 0, rotate: -15 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ type: "spring", delay: 0.2, damping: 12 }}
              className="relative text-center z-10"
            >
              {/* Icon with float animation */}
              <motion.div
                animate={{ y: [0, -8, 0], rotate: [0, 3, -3, 0] }}
                transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
                className="relative inline-block"
              >
                {/* Glow behind icon */}
                <div
                  className="absolute inset-0 blur-3xl opacity-40"
                  style={{
                    background:
                      winner === "lobsters"
                        ? "radial-gradient(circle, #22c55e, transparent)"
                        : "radial-gradient(circle, #a855f7, transparent)",
                    transform: "scale(2)",
                  }}
                />
                {winner === "lobsters" ? (
                  <Shield className="h-28 w-28 text-green-400 mx-auto mb-6 relative z-10 drop-shadow-[0_0_30px_rgba(34,197,94,0.5)]" />
                ) : (
                  <Skull className="h-28 w-28 text-purple-400 mx-auto mb-6 relative z-10 drop-shadow-[0_0_30px_rgba(168,85,247,0.5)]" />
                )}
              </motion.div>

              {/* Winner title */}
              <motion.h2
                initial={{ y: 30, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.5 }}
                className={cn(
                  "font-pixel text-2xl sm:text-3xl mb-3",
                  winner === "lobsters" ? "neon-green" : "neon-purple"
                )}
                style={{
                  textShadow:
                    winner === "lobsters"
                      ? "0 0 20px rgba(34,197,94,0.6), 0 0 60px rgba(34,197,94,0.3), 0 0 100px rgba(34,197,94,0.15)"
                      : "0 0 20px rgba(168,85,247,0.6), 0 0 60px rgba(168,85,247,0.3), 0 0 100px rgba(168,85,247,0.15)",
                }}
              >
                {winner === "lobsters" ? "LOBSTERS WIN!" : "IMPOSTOR WINS!"}
              </motion.h2>

              <motion.p
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.7 }}
                className="text-gray-400 text-lg mb-6 max-w-sm mx-auto"
              >
                {winner === "lobsters"
                  ? "The crew successfully identified and eliminated the impostor!"
                  : "The impostor outplayed the crew and claimed victory!"}
              </motion.p>

              {/* Pot display */}
              <motion.div
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.9 }}
                className="inline-flex items-center gap-3 px-6 py-3 rounded-xl glass-card border border-yellow-500/15"
              >
                <Crown className="h-5 w-5 text-yellow-400" />
                <span className="font-bold text-lg text-yellow-400">
                  Pot: {formatETH(totalStake)}
                </span>
              </motion.div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ━━━━━━━━━━ MAIN GRID LAYOUT ━━━━━━━━━━ */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* ─── Left 2 columns: Main area ─── */}
        <div className="lg:col-span-2 space-y-5">
          {/* Connection status pill */}
          <div className="flex items-center gap-3">
            <div
              className={cn(
                "flex items-center gap-2 rounded-full px-3.5 py-1.5 text-xs font-medium transition-all",
                connected
                  ? "text-green-400 border border-green-500/15 bg-green-500/5"
                  : "text-red-400 border border-red-500/15 bg-red-500/5"
              )}
            >
              {connected ? (
                <Wifi className="h-3.5 w-3.5" />
              ) : (
                <WifiOff className="h-3.5 w-3.5" />
              )}
              <span>{connected ? "Connected" : "Disconnected"}</span>
              {connected && (
                <span className="relative flex h-1.5 w-1.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-50" />
                  <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-green-500" />
                </span>
              )}
            </div>

            {error && (
              <span className="text-xs text-red-400/80 px-3 py-1 rounded-full border border-red-500/10 bg-red-500/5">
                {error}
              </span>
            )}
          </div>

          {/* Phase timer */}
          {phase && (
            <PhaseTimer
              phase={phase}
              timeRemaining={timeRemaining}
              round={currentRound}
            />
          )}

          {/* ─── Player Arena ─── */}
          <div
            className={cn(
              "rounded-2xl p-5 glass-card transition-all duration-500",
              accent.glow
            )}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-pixel text-[10px] text-gray-400 flex items-center gap-2">
                <Users className="h-4 w-4" style={{ color: accent.accent }} />
                <span>
                  ARENA
                  <span className="text-gray-600 font-sans text-xs ml-2">
                    {alivePlayers.length}/{players.length}
                  </span>
                </span>
              </h3>
              {phase && (
                <div
                  className={cn(
                    "font-pixel text-[8px] uppercase px-2.5 py-1 rounded-md",
                    phase === "discussion" && "text-green-400 bg-green-500/8",
                    phase === "voting" && "text-orange-400 bg-orange-500/8",
                    phase === "elimination" && "text-red-400 bg-red-500/8",
                    phase === "results" && "text-purple-400 bg-purple-500/8",
                    phase === "lobby" && "text-gray-500 bg-gray-500/8"
                  )}
                >
                  {phase}
                </div>
              )}
            </div>

            {/* PixiJS 2D Game Arena */}
            <div className="rounded-xl overflow-hidden mb-3">
              <PixiArena
                players={players}
                phase={phase}
                winner={winner}
              />
            </div>

            {/* Eliminated section - gravestone style */}
            <AnimatePresence>
              {eliminatedPlayers.length > 0 && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                >
                  <div className="border-t border-gray-800/50 pt-4 mt-2">
                    <div className="flex items-center gap-2 mb-3">
                      <Skull className="h-3 w-3 text-red-500/60" />
                      <p className="text-[10px] text-red-400/60 uppercase tracking-[0.2em] font-bold">
                        Fallen
                      </p>
                      <div className="flex-1 h-px bg-gradient-to-r from-red-500/20 to-transparent" />
                    </div>
                    <div className="flex flex-wrap justify-center gap-4">
                      {eliminatedPlayers.map((player, idx) => (
                        <motion.div
                          key={player.address}
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 0.6, y: 0 }}
                          transition={{ delay: idx * 0.1 }}
                          className="relative"
                        >
                          {/* Tombstone-like background */}
                          <div
                            className="absolute inset-0 -z-10 rounded-xl opacity-30"
                            style={{
                              background:
                                "linear-gradient(180deg, rgba(127,29,29,0.15) 0%, transparent 100%)",
                            }}
                          />
                          <PlayerAvatar
                            player={player}
                            size="sm"
                            showRole
                          />
                        </motion.div>
                      ))}
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* ─── Vote Tracker ─── */}
          <AnimatePresence>
            {(phase === "voting" || phase === "elimination") && Object.keys(voteTally).length > 0 && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden"
              >
                <div className="rounded-2xl p-5 glass-card border-orange-500/10">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-pixel text-[10px] text-orange-400 flex items-center gap-2">
                      <svg
                        viewBox="0 0 24 24"
                        fill="none"
                        className="h-4 w-4"
                        stroke="currentColor"
                        strokeWidth={2}
                      >
                        <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      Vote Tracker
                    </h3>
                    <span className="text-[10px] text-gray-500 font-mono">
                      {Object.values(voteTally).reduce(
                        (sum, v) => sum + v.length,
                        0
                      )}/{alivePlayers.length}
                    </span>
                  </div>

                  <div className="space-y-3">
                    {Object.entries(voteTally)
                      .sort((a, b) => b[1].length - a[1].length)
                      .map(([target, voters], idx) => {
                        const targetPlayer = players.find(
                          (p) => p.address === target
                        );
                        const percentage = (voters.length / maxVotes) * 100;
                        const targetColor = getAgentColor(target);

                        return (
                          <motion.div
                            key={target}
                            initial={{ x: -20, opacity: 0 }}
                            animate={{ x: 0, opacity: 1 }}
                            transition={{ delay: idx * 0.1 }}
                            className="relative rounded-xl overflow-hidden bg-gray-900/40 border border-gray-800/50"
                          >
                            {/* Animated progress bar background */}
                            <motion.div
                              className="absolute inset-y-0 left-0 rounded-xl"
                              initial={{ width: 0 }}
                              animate={{ width: `${percentage}%` }}
                              transition={{
                                duration: 0.8,
                                delay: idx * 0.1 + 0.2,
                                ease: "easeOut",
                              }}
                              style={{
                                background: `linear-gradient(90deg, ${targetColor}15, ${targetColor}08)`,
                                borderRight: `2px solid ${targetColor}40`,
                              }}
                            />

                            <div className="relative flex items-center gap-3 p-3">
                              {/* Voter avatars */}
                              <div className="flex items-center -space-x-1.5">
                                {voters.map((voter) => (
                                  <motion.div
                                    key={voter}
                                    initial={{ scale: 0 }}
                                    animate={{ scale: 1 }}
                                    className="h-7 w-7 rounded-full flex items-center justify-center text-[8px] font-black border-2 border-gray-900"
                                    style={{
                                      backgroundColor: `${getAgentColor(voter)}30`,
                                      color: getAgentColor(voter),
                                      boxShadow: `0 0 6px ${getAgentColor(voter)}30`,
                                    }}
                                  >
                                    {voter.slice(2, 4).toUpperCase()}
                                  </motion.div>
                                ))}
                              </div>

                              <ArrowRight className="h-3 w-3 text-orange-400/60 shrink-0" />

                              {/* Target */}
                              <div className="flex items-center gap-2 flex-1 min-w-0">
                                <div
                                  className="h-8 w-8 rounded-full flex items-center justify-center text-[9px] font-black shrink-0 border-2"
                                  style={{
                                    backgroundColor: `${targetColor}25`,
                                    color: targetColor,
                                    borderColor: `${targetColor}50`,
                                    boxShadow: `0 0 10px ${targetColor}25`,
                                  }}
                                >
                                  {target.slice(2, 4).toUpperCase()}
                                </div>
                                <span className="text-xs text-gray-300 font-medium truncate">
                                  {targetPlayer?.name ||
                                    shortenAddress(target)}
                                </span>
                              </div>

                              {/* Vote count */}
                              <div
                                className="flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-bold shrink-0"
                                style={{
                                  background: `${targetColor}12`,
                                  color: targetColor,
                                }}
                              >
                                {voters.length}
                                <span className="text-[10px] font-normal opacity-60">
                                  vote{voters.length > 1 ? "s" : ""}
                                </span>
                              </div>
                            </div>
                          </motion.div>
                        );
                      })}
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* ─── Vote History (completed games) ─── */}
          {gameState && gameState.voteHistory && gameState.voteHistory.length > 0 && (
            <div className="rounded-2xl p-5 glass-card">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-pixel text-[10px] text-orange-400 flex items-center gap-2">
                  <Vote className="h-4 w-4" />
                  VOTE HISTORY
                </h3>
                <span className="text-[10px] text-gray-500 font-mono">
                  {gameState.voteHistory.length} round{gameState.voteHistory.length > 1 ? "s" : ""}
                </span>
              </div>

              <div className="space-y-3">
                {gameState.voteHistory.map((roundHistory) => {
                  // Build tally for this round
                  const tally: Record<string, string[]> = {};
                  for (const vote of roundHistory.votes) {
                    const target = vote.target.toLowerCase();
                    if (!tally[target]) tally[target] = [];
                    tally[target].push(vote.voter);
                  }
                  const sortedTargets = Object.entries(tally).sort(
                    (a, b) => b[1].length - a[1].length
                  );
                  const roundMax = Math.max(1, ...sortedTargets.map(([, v]) => v.length));

                  // Find eliminated player name
                  const eliminatedInfo = roundHistory.eliminated
                    ? gameState.eliminations?.find(
                        (e) => e.address.toLowerCase() === roundHistory.eliminated?.toLowerCase()
                      )
                    : null;

                  return (
                    <div key={roundHistory.round} className="rounded-xl border border-gray-800/50 overflow-hidden">
                      {/* Round header */}
                      <div className="flex items-center justify-between px-3.5 py-2 bg-gray-900/60 border-b border-gray-800/40">
                        <span className="text-[10px] font-pixel text-gray-400 uppercase tracking-wider">
                          Round {roundHistory.round}
                        </span>
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] text-gray-500 font-mono">
                            {roundHistory.votes.length} votes
                          </span>
                          {eliminatedInfo ? (
                            <span className={cn(
                              "text-[9px] font-bold px-2 py-0.5 rounded-full",
                              eliminatedInfo.role === "Impostor"
                                ? "text-purple-400 bg-purple-500/15"
                                : "text-red-400 bg-red-500/15"
                            )}>
                              <Skull className="h-2.5 w-2.5 inline mr-1" />
                              {eliminatedInfo.name}
                              {eliminatedInfo.role === "Impostor" ? " (Impostor)" : ""}
                            </span>
                          ) : roundHistory.votes.length === 0 ? (
                            <span className="text-[9px] text-gray-600 italic">no votes</span>
                          ) : (
                            <span className="text-[9px] text-yellow-500/80">tie broken</span>
                          )}
                        </div>
                      </div>

                      {/* Vote bars */}
                      {sortedTargets.length > 0 ? (
                        <div className="p-2.5 space-y-1.5">
                          {sortedTargets.map(([target, voters]) => {
                            const targetPlayer = players.find(
                              (p) => p.address.toLowerCase() === target
                            );
                            const targetColor = getAgentColor(target);
                            const pct = (voters.length / roundMax) * 100;
                            const isEliminated = roundHistory.eliminated?.toLowerCase() === target;

                            return (
                              <div key={target} className="relative rounded-lg overflow-hidden bg-gray-900/30">
                                <div
                                  className="absolute inset-y-0 left-0 rounded-lg transition-all"
                                  style={{
                                    width: `${pct}%`,
                                    background: `linear-gradient(90deg, ${targetColor}18, ${targetColor}08)`,
                                    borderRight: `2px solid ${targetColor}40`,
                                  }}
                                />
                                <div className="relative flex items-center gap-2 px-3 py-1.5">
                                  <span className="text-xs font-medium text-gray-300 truncate flex-1">
                                    {targetPlayer?.name || `${target.slice(0, 6)}...${target.slice(-4)}`}
                                  </span>
                                  {isEliminated && (
                                    <Skull className="h-3 w-3 text-red-400 shrink-0" />
                                  )}
                                  <span
                                    className="text-xs font-bold tabular-nums shrink-0"
                                    style={{ color: targetColor }}
                                  >
                                    {voters.length}
                                  </span>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <div className="p-3 text-center text-xs text-gray-600">
                          No votes cast this round
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ─── Discussion Feed ─── */}
          <div
            className="rounded-2xl overflow-hidden glass-card"
          >
            {/* Header */}
            <div
              className="px-5 py-3 flex items-center justify-between"
              style={{
                borderBottom: "1px solid rgba(148,163,184,0.06)",
              }}
            >
              <div className="flex items-center gap-2">
                <div
                  className="h-1.5 w-1.5 rounded-full"
                  style={{ backgroundColor: accent.accent }}
                />
                <h3 className="font-pixel text-[10px] text-gray-300">
                  DISCUSSION
                </h3>
              </div>
              <span className="text-[10px] text-gray-600 font-mono">
                {messages.length}
              </span>
            </div>

            {/* Messages area */}
            <div ref={chatContainerRef} className="h-[400px] overflow-y-auto p-3 space-y-1 scroll-smooth" style={{ background: "rgba(8,12,24,0.5)" }}>
              {messages.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full gap-3">
                  <motion.div
                    animate={{ opacity: [0.3, 0.6, 0.3] }}
                    transition={{ duration: 3, repeat: Infinity }}
                    className="text-gray-700"
                  >
                    <svg
                      viewBox="0 0 24 24"
                      fill="none"
                      className="h-10 w-10"
                      stroke="currentColor"
                      strokeWidth={1}
                    >
                      <path d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                    </svg>
                  </motion.div>
                  <p className="text-gray-600 text-sm font-medium">
                    Waiting for discussion to begin...
                  </p>
                </div>
              ) : (
                (() => {
                  // Group messages by round
                  const rounds = new Map<number, typeof messages>();
                  let globalIdx = 0;
                  messages.forEach((msg) => {
                    const r = msg.round ?? 1;
                    if (!rounds.has(r)) rounds.set(r, []);
                    rounds.get(r)!.push(msg);
                  });
                  const sortedRounds = Array.from(rounds.entries()).sort((a, b) => a[0] - b[0]);

                  return sortedRounds.map(([round, msgs]) => (
                    <div key={`round-${round}`}>
                      {sortedRounds.length > 1 && (
                        <div className="flex items-center gap-2 py-2 px-1">
                          <div className="flex-1 h-px bg-gray-700/50" />
                          <span className="text-[10px] font-pixel text-gray-500 uppercase tracking-wider">
                            Round {round}
                          </span>
                          <div className="flex-1 h-px bg-gray-700/50" />
                        </div>
                      )}
                      {msgs.map((msg) => {
                        const idx = globalIdx++;
                        return <DiscussionMessage key={msg.id} message={msg} index={idx} />;
                      })}
                    </div>
                  ));
                })()
              )}
              <div ref={chatEndRef} />
            </div>
          </div>
        </div>

        {/* ─── Sidebar (right column) ─── */}
        <div className="space-y-5">
          {/* Game Info Card */}
          <div className="rounded-2xl p-5 space-y-4 glass-card">
            <h3 className="font-pixel text-[10px] text-gray-400 flex items-center gap-2">
              <Coins className="h-4 w-4" style={{ color: accent.accent }} />
              GAME INFO
            </h3>

            <div className="space-y-3">
              {/* Game ID */}
              <div className="flex justify-between items-center">
                <span className="text-xs text-gray-500 font-medium">
                  Game ID
                </span>
                <span className="text-xs font-mono text-gray-400 bg-gray-800/40 px-2 py-0.5 rounded">
                  {gameState?.id
                    ? `${gameState.id.slice(0, 8)}...`
                    : "---"}
                </span>
              </div>

              {/* Total Pot */}
              <div className="flex justify-between items-center rounded-lg p-3 bg-yellow-500/[0.04] border border-yellow-500/10">
                <span className="text-xs text-gray-400">Total Pot</span>
                <span className="text-base font-bold text-yellow-400 tabular-nums">
                  {formatETH(totalStake)}
                </span>
              </div>

              {/* Stake per player */}
              <div className="flex justify-between items-center">
                <span className="text-xs text-gray-500 font-medium">
                  Stake / Player
                </span>
                <span className="text-xs text-gray-300 font-semibold">
                  {formatETH(gameState?.stakePerPlayer ?? "0")}
                </span>
              </div>

              {/* Round */}
              <div className="flex justify-between items-center">
                <span className="text-xs text-gray-500">Round</span>
                <span className="text-sm font-bold" style={{ color: accent.accent }}>
                  {currentRound}
                </span>
              </div>

              {/* Players alive */}
              <div className="flex justify-between items-center">
                <span className="text-xs text-gray-500 font-medium">
                  Players Alive
                </span>
                <div className="flex items-center gap-1.5">
                  <span className="text-sm font-black text-green-400">
                    {alivePlayers.length}
                  </span>
                  <span className="text-xs text-gray-600">/</span>
                  <span className="text-xs text-gray-500">
                    {players.length}
                  </span>
                  {/* Visual health bar */}
                  <div className="w-12 h-1 bg-gray-800 rounded-full ml-1.5 overflow-hidden">
                    <motion.div
                      className="h-full rounded-full bg-green-500"
                      initial={{ width: "100%" }}
                      animate={{
                        width: `${players.length > 0 ? (alivePlayers.length / players.length) * 100 : 0}%`,
                      }}
                      transition={{ duration: 0.8, ease: "easeOut" }}
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Selected Player Detail */}
          <AnimatePresence>
            {selectedPlayer && (
              <motion.div
                initial={{ opacity: 0, y: 12, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 12, scale: 0.97 }}
                transition={{ type: "spring", damping: 20, stiffness: 300 }}
                className="rounded-2xl glass-card p-5 card-shine"
                style={{
                  border: `1px solid ${getAgentColor(selectedPlayer)}25`,
                  boxShadow: `0 0 20px ${getAgentColor(selectedPlayer)}08`,
                }}
              >
                {(() => {
                  const player = players.find(
                    (p) => p.address === selectedPlayer
                  );
                  if (!player) return null;
                  const pColor = getAgentColor(player.address);
                  return (
                    <div className="space-y-4">
                      {/* Player header */}
                      <div className="flex items-center gap-3">
                        <div
                          className="h-11 w-11 rounded-full flex items-center justify-center text-sm font-black border-2"
                          style={{
                            background: `radial-gradient(circle at 35% 35%, ${pColor}40, ${pColor}10)`,
                            color: pColor,
                            borderColor: `${pColor}40`,
                            boxShadow: `0 0 12px ${pColor}25`,
                          }}
                        >
                          {player.address.slice(2, 4).toUpperCase()}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="font-bold text-white text-sm truncate">
                            {player.name || shortenAddress(player.address)}
                          </div>
                          <div className="text-[10px] text-gray-600 font-mono truncate">
                            {player.address}
                          </div>
                        </div>
                        {/* Close button */}
                        <button
                          onClick={() => setSelectedPlayer(null)}
                          className="text-gray-600 hover:text-gray-400 transition-colors text-lg leading-none p-1"
                        >
                          x
                        </button>
                      </div>

                      {/* Status grid */}
                      <div className="grid grid-cols-2 gap-2">
                        <div
                          className="rounded-xl p-3 text-center"
                          style={{
                            background: player.isAlive
                              ? "rgba(34,197,94,0.06)"
                              : "rgba(239,68,68,0.06)",
                            border: player.isAlive
                              ? "1px solid rgba(34,197,94,0.15)"
                              : "1px solid rgba(239,68,68,0.15)",
                          }}
                        >
                          <div className="text-[10px] text-gray-500 font-medium mb-1">
                            Status
                          </div>
                          <div
                            className={cn(
                              "text-xs font-black tracking-wide",
                              player.isAlive
                                ? "text-green-400"
                                : "text-red-400"
                            )}
                          >
                            {player.isAlive ? "ALIVE" : "ELIMINATED"}
                          </div>
                        </div>
                        <div
                          className="rounded-xl p-3 text-center"
                          style={{
                            background:
                              player.role === "impostor"
                                ? "rgba(168,85,247,0.06)"
                                : player.role === "lobster"
                                  ? "rgba(34,197,94,0.06)"
                                  : "rgba(100,116,139,0.06)",
                            border:
                              player.role === "impostor"
                                ? "1px solid rgba(168,85,247,0.15)"
                                : player.role === "lobster"
                                  ? "1px solid rgba(34,197,94,0.15)"
                                  : "1px solid rgba(100,116,139,0.1)",
                          }}
                        >
                          <div className="text-[10px] text-gray-500 font-medium mb-1">
                            Role
                          </div>
                          <div
                            className={cn(
                              "text-xs font-black tracking-wide",
                              player.role === "impostor"
                                ? "text-purple-400"
                                : player.role === "lobster"
                                  ? "text-green-400"
                                  : "text-gray-500"
                            )}
                          >
                            {player.role === "unknown"
                              ? "HIDDEN"
                              : player.role.toUpperCase()}
                          </div>
                        </div>
                      </div>

                      {/* Vote info */}
                      {player.votedFor && (
                        <div
                          className="text-xs text-gray-400 rounded-lg p-2 flex items-center gap-2"
                          style={{
                            background: "rgba(251,146,60,0.06)",
                            border: "1px solid rgba(251,146,60,0.12)",
                          }}
                        >
                          <span className="text-gray-500">Voted for:</span>
                          <span
                            className="font-bold"
                            style={{
                              color: getAgentColor(player.votedFor),
                            }}
                          >
                            {players.find(
                              (p) => p.address === player.votedFor
                            )?.name || shortenAddress(player.votedFor)}
                          </span>
                        </div>
                      )}
                    </div>
                  );
                })()}
              </motion.div>
            )}
          </AnimatePresence>

          {/* All Players list */}
          <div className="rounded-2xl p-5 glass-card">
            <h3 className="font-pixel text-[10px] text-gray-400 mb-4 flex items-center gap-2">
              <Users className="h-4 w-4" style={{ color: accent.accent }} />
              PLAYERS
            </h3>

            <div className="space-y-1.5">
              {players.map((player) => {
                const pColor = getAgentColor(player.address);
                const isSelected = selectedPlayer === player.address;
                return (
                  <motion.button
                    key={player.address}
                    onClick={() =>
                      setSelectedPlayer(
                        isSelected ? null : player.address
                      )
                    }
                    className={cn(
                      "w-full flex items-center gap-2.5 rounded-xl p-2.5 text-left transition-all duration-200",
                      isSelected
                        ? "bg-gray-800/60"
                        : "hover:bg-gray-800/30"
                    )}
                    style={{
                      border: isSelected
                        ? `1px solid ${pColor}30`
                        : "1px solid transparent",
                      boxShadow: isSelected
                        ? `0 0 10px ${pColor}10`
                        : "none",
                    }}
                    whileHover={{ x: 2 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    {/* Mini avatar */}
                    <div
                      className="h-7 w-7 rounded-full flex items-center justify-center text-[9px] font-black shrink-0 border"
                      style={{
                        background: player.isAlive
                          ? `radial-gradient(circle at 35% 35%, ${pColor}35, ${pColor}10)`
                          : "#1f2937",
                        color: player.isAlive ? pColor : "#4b5563",
                        borderColor: player.isAlive
                          ? `${pColor}35`
                          : "#374151",
                        boxShadow: player.isAlive
                          ? `0 0 6px ${pColor}15`
                          : "none",
                      }}
                    >
                      {player.address.slice(2, 4).toUpperCase()}
                    </div>

                    {/* Name */}
                    <span
                      className={cn(
                        "text-xs truncate flex-1 font-medium",
                        player.isAlive
                          ? "text-gray-300"
                          : "text-gray-600 line-through"
                      )}
                    >
                      {player.name || shortenAddress(player.address)}
                    </span>

                    {/* Role badge for eliminated */}
                    {!player.isAlive && player.role !== "unknown" && (
                      <span
                        className={cn(
                          "text-[9px] font-black px-2 py-0.5 rounded-full border",
                          player.role === "impostor"
                            ? "text-purple-400 bg-purple-500/10 border-purple-500/25"
                            : "text-green-400 bg-green-500/10 border-green-500/25"
                        )}
                        style={{
                          boxShadow:
                            player.role === "impostor"
                              ? "0 0 6px rgba(168,85,247,0.15)"
                              : "0 0 6px rgba(34,197,94,0.15)",
                        }}
                      >
                        {player.role === "impostor" ? "IMP" : "LOB"}
                      </span>
                    )}

                    {/* Speaking indicator */}
                    {player.isSpeaking && player.isAlive && (
                      <div className="flex items-center gap-1">
                        {[0, 1, 2].map((i) => (
                          <motion.div
                            key={i}
                            className="w-0.5 rounded-full bg-green-400"
                            animate={{
                              height: ["4px", "10px", "4px"],
                            }}
                            transition={{
                              duration: 0.6,
                              repeat: Infinity,
                              delay: i * 0.15,
                            }}
                            style={{
                              boxShadow: "0 0 4px rgba(34,197,94,0.5)",
                            }}
                          />
                        ))}
                      </div>
                    )}

                    {/* Alive dot */}
                    {player.isAlive && !player.isSpeaking && (
                      <div
                        className="w-1.5 h-1.5 rounded-full shrink-0"
                        style={{
                          backgroundColor: pColor,
                          boxShadow: `0 0 4px ${pColor}60`,
                        }}
                      />
                    )}
                  </motion.button>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
