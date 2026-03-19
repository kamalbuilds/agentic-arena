"use client";

import { motion, AnimatePresence } from "framer-motion";
import { cn, shortenAddress, getAgentColor } from "@/lib/utils";
import type { Player } from "@/lib/types";

interface PlayerAvatarProps {
  player: Player;
  size?: "sm" | "md" | "lg";
  showVote?: boolean;
  showRole?: boolean;
  onClick?: () => void;
}

export default function PlayerAvatar({
  player,
  size = "md",
  showVote = false,
  showRole = false,
  onClick,
}: PlayerAvatarProps) {
  const color = getAgentColor(player.address);
  const initials = player.address.slice(2, 4).toUpperCase();

  const sizeClasses = {
    sm: "w-10 h-10 text-xs",
    md: "w-14 h-14 text-sm",
    lg: "w-20 h-20 text-lg",
  };

  const outerRingSize = {
    sm: "w-12 h-12",
    md: "w-[66px] h-[66px]",
    lg: "w-[92px] h-[92px]",
  };

  const speakingRingSize = {
    sm: "w-14 h-14",
    md: "w-[74px] h-[74px]",
    lg: "w-[100px] h-[100px]",
  };

  const nameMaxWidth = {
    sm: "max-w-[70px]",
    md: "max-w-[90px]",
    lg: "max-w-[110px]",
  };

  const voteBadgeSize = {
    sm: "w-4 h-4 text-[7px]",
    md: "w-5 h-5 text-[9px]",
    lg: "w-7 h-7 text-[11px]",
  };

  const voteBadgePos = {
    sm: "-top-0.5 -right-0.5",
    md: "-top-1 -right-1",
    lg: "-top-1.5 -right-1.5",
  };

  return (
    <motion.div
      className={cn(
        "flex flex-col items-center gap-1.5 cursor-pointer group relative",
        !player.isAlive && "pointer-events-none"
      )}
      onClick={onClick}
      whileHover={player.isAlive ? { scale: 1.08 } : undefined}
      whileTap={player.isAlive ? { scale: 0.95 } : undefined}
      layout
    >
      {/* Avatar container */}
      <div className="relative flex items-center justify-center">
        {/* Speaking pulse rings - triple layered for dramatic glow */}
        <AnimatePresence>
          {player.isSpeaking && player.isAlive && (
            <>
              <motion.div
                key="speak-ring-1"
                className={cn(
                  "absolute rounded-full",
                  speakingRingSize[size]
                )}
                style={{
                  border: `2px solid ${color}`,
                  boxShadow: `0 0 12px ${color}60, inset 0 0 12px ${color}20`,
                }}
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{
                  scale: [1, 1.2, 1],
                  opacity: [0.6, 0.15, 0.6],
                }}
                exit={{ scale: 0.8, opacity: 0 }}
                transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }}
              />
              <motion.div
                key="speak-ring-2"
                className={cn(
                  "absolute rounded-full",
                  speakingRingSize[size]
                )}
                style={{
                  border: `1.5px solid #22c55e`,
                  boxShadow: `0 0 20px rgba(34,197,94,0.3)`,
                }}
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{
                  scale: [1.05, 1.35, 1.05],
                  opacity: [0.4, 0, 0.4],
                }}
                exit={{ scale: 0.9, opacity: 0 }}
                transition={{ duration: 2.2, repeat: Infinity, ease: "easeInOut", delay: 0.3 }}
              />
              <motion.div
                key="speak-ring-3"
                className={cn(
                  "absolute rounded-full",
                  speakingRingSize[size]
                )}
                style={{
                  border: `1px solid #4ade80`,
                  boxShadow: `0 0 30px rgba(74,222,128,0.15)`,
                }}
                initial={{ scale: 1, opacity: 0 }}
                animate={{
                  scale: [1.1, 1.5, 1.1],
                  opacity: [0.25, 0, 0.25],
                }}
                exit={{ scale: 1, opacity: 0 }}
                transition={{ duration: 2.6, repeat: Infinity, ease: "easeInOut", delay: 0.6 }}
              />
            </>
          )}
        </AnimatePresence>

        {/* Glowing ring (outer border) */}
        <div
          className={cn(
            "absolute rounded-full transition-all duration-500",
            outerRingSize[size],
            player.isAlive
              ? "group-hover:scale-105"
              : "opacity-30"
          )}
          style={{
            background: player.isAlive
              ? `conic-gradient(from 0deg, ${color}90, ${color}20, ${color}60, ${color}10, ${color}90)`
              : "conic-gradient(from 0deg, #374151, #1f2937, #374151)",
            padding: "2px",
            WebkitMask: "linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)",
            WebkitMaskComposite: "xor",
            maskComposite: "exclude",
            boxShadow: player.isAlive
              ? `0 0 18px ${color}40, 0 0 6px ${color}30`
              : "none",
          }}
        >
          {/* Inner spacer to create ring effect */}
          <div className={cn("rounded-full w-full h-full", outerRingSize[size])} />
        </div>

        {/* Hover glow intensifier */}
        {player.isAlive && (
          <div
            className={cn(
              "absolute rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none",
              outerRingSize[size]
            )}
            style={{
              boxShadow: `0 0 28px ${color}50, 0 0 56px ${color}20`,
            }}
          />
        )}

        {/* Avatar circle - glassmorphism */}
        <motion.div
          className={cn(
            "rounded-full flex items-center justify-center font-bold relative z-10 transition-all duration-300",
            sizeClasses[size],
            player.isAlive
              ? "backdrop-blur-sm"
              : "grayscale brightness-50"
          )}
          style={{
            background: player.isAlive
              ? `radial-gradient(circle at 35% 35%, ${color}45, ${color}15 70%, ${color}08)`
              : "radial-gradient(circle at 35% 35%, #374151, #1f2937 70%, #111827)",
            color: player.isAlive ? color : "#4b5563",
            boxShadow: player.isAlive
              ? `inset 0 1px 2px rgba(255,255,255,0.1), inset 0 -2px 6px ${color}15`
              : "inset 0 2px 8px rgba(0,0,0,0.5)",
          }}
        >
          {/* Inner highlight / specular */}
          <div
            className="absolute inset-0 rounded-full pointer-events-none"
            style={{
              background: "linear-gradient(135deg, rgba(255,255,255,0.12) 0%, transparent 50%, rgba(0,0,0,0.1) 100%)",
            }}
          />

          {/* Initials text */}
          <span
            className={cn(
              "relative z-10 font-black tracking-wider",
              player.isAlive && "drop-shadow-[0_0_6px_var(--glow)]"
            )}
            style={{
              "--glow": `${color}80`,
            } as React.CSSProperties}
          >
            {initials}
          </span>
        </motion.div>

        {/* Eliminated X overlay - shattered effect */}
        <AnimatePresence>
          {!player.isAlive && (
            <motion.div
              initial={{ scale: 0, rotate: -90, opacity: 0 }}
              animate={{ scale: 1, rotate: 0, opacity: 1 }}
              exit={{ scale: 0, opacity: 0 }}
              transition={{ type: "spring", damping: 12, stiffness: 200 }}
              className="absolute inset-0 flex items-center justify-center z-20 pointer-events-none"
            >
              {/* Shattered crack lines */}
              <svg
                viewBox="0 0 100 100"
                className={cn("absolute", sizeClasses[size])}
                style={{ filter: "drop-shadow(0 0 4px rgba(239,68,68,0.6))" }}
              >
                {/* Main X */}
                <line x1="15" y1="15" x2="85" y2="85" stroke="#ef4444" strokeWidth="4" strokeLinecap="round" />
                <line x1="85" y1="15" x2="15" y2="85" stroke="#ef4444" strokeWidth="4" strokeLinecap="round" />
                {/* Crack lines radiating from center */}
                <line x1="50" y1="50" x2="50" y2="10" stroke="#ef444480" strokeWidth="1.5" strokeLinecap="round" />
                <line x1="50" y1="50" x2="90" y2="50" stroke="#ef444480" strokeWidth="1.5" strokeLinecap="round" />
                <line x1="50" y1="50" x2="50" y2="90" stroke="#ef444480" strokeWidth="1.5" strokeLinecap="round" />
                <line x1="50" y1="50" x2="10" y2="50" stroke="#ef444480" strokeWidth="1.5" strokeLinecap="round" />
                {/* Diagonal cracks */}
                <line x1="50" y1="50" x2="25" y2="10" stroke="#ef444440" strokeWidth="1" strokeLinecap="round" />
                <line x1="50" y1="50" x2="75" y2="10" stroke="#ef444440" strokeWidth="1" strokeLinecap="round" />
                <line x1="50" y1="50" x2="90" y2="25" stroke="#ef444440" strokeWidth="1" strokeLinecap="round" />
                <line x1="50" y1="50" x2="90" y2="75" stroke="#ef444440" strokeWidth="1" strokeLinecap="round" />
              </svg>

              {/* Red glow behind X */}
              <div
                className="absolute rounded-full"
                style={{
                  width: "60%",
                  height: "60%",
                  background: "radial-gradient(circle, rgba(239,68,68,0.2) 0%, transparent 70%)",
                }}
              />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Vote indicator badge */}
        <AnimatePresence>
          {showVote && player.votedFor && player.isAlive && (
            <motion.div
              initial={{ scale: 0, rotate: -180 }}
              animate={{ scale: 1, rotate: 0 }}
              exit={{ scale: 0, rotate: 180 }}
              transition={{ type: "spring", damping: 10, stiffness: 260 }}
              className={cn(
                "absolute rounded-full flex items-center justify-center font-black z-30",
                voteBadgeSize[size],
                voteBadgePos[size]
              )}
              style={{
                background: "linear-gradient(135deg, #fb923c, #f97316, #ea580c)",
                boxShadow: "0 0 12px rgba(251,146,60,0.6), 0 0 24px rgba(251,146,60,0.2), 0 2px 4px rgba(0,0,0,0.3)",
                color: "white",
              }}
            >
              <motion.span
                animate={{ scale: [1, 1.15, 1] }}
                transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
              >
                V
              </motion.span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Speaking mic indicator for small size */}
        <AnimatePresence>
          {player.isSpeaking && player.isAlive && size === "sm" && (
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0 }}
              className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-green-500 z-30 flex items-center justify-center"
              style={{
                boxShadow: "0 0 8px rgba(34,197,94,0.6), 0 0 16px rgba(34,197,94,0.3)",
              }}
            >
              <motion.div
                className="w-1.5 h-1.5 rounded-full bg-green-300"
                animate={{ scale: [1, 0.5, 1] }}
                transition={{ duration: 0.8, repeat: Infinity }}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Name + role below avatar */}
      <div className="text-center flex flex-col items-center">
        <div
          className={cn(
            "font-semibold truncate leading-tight",
            nameMaxWidth[size],
            size === "sm" ? "text-[10px]" : size === "md" ? "text-xs" : "text-sm",
            player.isAlive ? "text-gray-200" : "text-gray-600"
          )}
          style={{
            textShadow: player.isAlive ? `0 0 10px ${color}30` : "none",
          }}
        >
          {player.name || shortenAddress(player.address)}
        </div>

        {/* Role badge */}
        <AnimatePresence>
          {(showRole || !player.isAlive) && player.role !== "unknown" && (
            <motion.div
              initial={{ opacity: 0, y: -4, scale: 0.8 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -4, scale: 0.8 }}
              transition={{ type: "spring", damping: 15, stiffness: 300 }}
              className={cn(
                "mt-1 text-[9px] font-black tracking-widest uppercase px-2 py-0.5 rounded-full border",
                player.role === "impostor"
                  ? "border-purple-500/50 text-purple-300"
                  : "border-green-500/50 text-green-300"
              )}
              style={{
                background: player.role === "impostor"
                  ? "linear-gradient(135deg, rgba(168,85,247,0.25), rgba(168,85,247,0.08))"
                  : "linear-gradient(135deg, rgba(34,197,94,0.25), rgba(34,197,94,0.08))",
                boxShadow: player.role === "impostor"
                  ? "0 0 10px rgba(168,85,247,0.25), inset 0 0 8px rgba(168,85,247,0.1)"
                  : "0 0 10px rgba(34,197,94,0.25), inset 0 0 8px rgba(34,197,94,0.1)",
                textShadow: player.role === "impostor"
                  ? "0 0 6px rgba(168,85,247,0.5)"
                  : "0 0 6px rgba(34,197,94,0.5)",
              }}
            >
              {player.role === "impostor" ? "IMPOSTOR" : "LOBSTER"}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}
