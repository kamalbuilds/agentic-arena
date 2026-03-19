"use client";

import { motion } from "framer-motion";
import { cn, shortenAddress, getAgentColor, getAgentName } from "@/lib/utils";
import type { ChatMessage } from "@/lib/types";
import {
  AlertTriangle,
  ShieldCheck,
  Info,
  Skull,
} from "lucide-react";

interface DiscussionMessageProps {
  message: ChatMessage;
  index: number;
}

export default function DiscussionMessage({
  message,
  index,
}: DiscussionMessageProps) {
  const color = getAgentColor(message.sender);
  const isSystem = message.type === "system";
  const isAccusation = message.type === "accusation";
  const isDefense = message.type === "defense";
  const isEliminated = !message.senderAlive;

  const timeStr = new Date(message.timestamp).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });

  // ---- System Message: centered glass pill with icon ----
  if (isSystem) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 10, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ delay: index * 0.04, duration: 0.35, ease: "easeOut" }}
        className="flex justify-center py-2.5"
      >
        <div
          className={cn(
            "glass-card inline-flex items-center gap-2 rounded-full px-5 py-2",
            "text-xs text-gray-400 border border-white/[0.06]",
            "shadow-[0_0_20px_rgba(0,0,0,0.3)]"
          )}
        >
          <Info className="h-3 w-3 text-gray-500 shrink-0" />
          <span className="leading-relaxed">{message.content}</span>
        </div>
      </motion.div>
    );
  }

  // ---- Regular / Accusation / Defense Messages ----
  return (
    <motion.div
      initial={{ opacity: 0, x: -24, y: 4 }}
      animate={{ opacity: 1, x: 0, y: 0 }}
      transition={{
        delay: index * 0.03,
        duration: 0.4,
        ease: [0.25, 0.46, 0.45, 0.94],
      }}
      className={cn(
        "group relative flex gap-3.5 rounded-xl p-3.5 transition-all duration-300",
        "hover:bg-white/[0.03]",
        // Accusation: red left border + animated red glow bg
        isAccusation && [
          "border-l-[3px] border-red-500/70 bg-red-500/[0.04]",
          "hover:bg-red-500/[0.07]",
          "shadow-[inset_4px_0_12px_-4px_rgba(239,68,68,0.15)]",
        ],
        // Defense: blue left border + blue tint
        isDefense && [
          "border-l-[3px] border-cyan-400/60 bg-cyan-500/[0.03]",
          "hover:bg-cyan-500/[0.06]",
          "shadow-[inset_4px_0_12px_-4px_rgba(34,211,238,0.12)]",
        ],
        // Eliminated sender: faded
        isEliminated && "opacity-50"
      )}
    >
      {/* Animated red glow overlay for accusations */}
      {isAccusation && (
        <div className="absolute inset-0 rounded-xl animate-pulse-glow opacity-20 pointer-events-none" />
      )}

      {/* Avatar */}
      <div className="relative mt-0.5 shrink-0">
        <div
          className={cn(
            "flex h-9 w-9 items-center justify-center rounded-full text-[11px] font-bold tracking-wide",
            "ring-2 ring-white/[0.06] transition-all duration-300",
            "group-hover:ring-white/[0.12]",
            isEliminated && "grayscale"
          )}
          style={{
            backgroundColor: `${color}20`,
            color: color,
            boxShadow: `0 0 12px ${color}25`,
          }}
        >
          {message.sender.slice(2, 4).toUpperCase()}
        </div>
        {/* Online dot (alive indicator) */}
        {!isEliminated && (
          <div
            className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-[#0f172a]"
            style={{ backgroundColor: color }}
          />
        )}
        {/* Skull for eliminated */}
        {isEliminated && (
          <div className="absolute -bottom-0.5 -right-0.5 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-gray-900 border border-red-500/40">
            <Skull className="h-2 w-2 text-red-400" />
          </div>
        )}
      </div>

      {/* Message Content */}
      <div className="flex-1 min-w-0">
        {/* Header row: name, badges, timestamp */}
        <div className="flex items-center gap-2 mb-1">
          {/* Sender Name */}
          <span
            className={cn(
              "text-sm font-semibold tracking-tight",
              isEliminated && "line-through decoration-red-500/50"
            )}
            style={{ color: isEliminated ? `${color}80` : color }}
          >
            {message.senderName || getAgentName(message.sender)}
          </span>

          {/* Address badge */}
          <span className="text-[10px] text-gray-600 font-mono">
            {shortenAddress(message.sender)}
          </span>

          {/* Eliminated badge */}
          {isEliminated && (
            <span
              className={cn(
                "inline-flex items-center gap-1 text-[9px] font-bold uppercase tracking-wider",
                "text-red-400/80 bg-red-500/10 border border-red-500/20",
                "px-1.5 py-0.5 rounded-md"
              )}
            >
              <Skull className="h-2.5 w-2.5" />
              Dead
            </span>
          )}

          {/* Accusation badge with subtle pulse */}
          {isAccusation && (
            <motion.span
              animate={{
                boxShadow: [
                  "0 0 0 0 rgba(239, 68, 68, 0)",
                  "0 0 8px 2px rgba(239, 68, 68, 0.3)",
                  "0 0 0 0 rgba(239, 68, 68, 0)",
                ],
              }}
              transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
              className={cn(
                "inline-flex items-center gap-1 text-[9px] font-bold uppercase tracking-wider",
                "text-red-400 bg-red-500/15 border border-red-500/30",
                "px-2 py-0.5 rounded-md"
              )}
            >
              <AlertTriangle className="h-2.5 w-2.5" />
              Accuses
            </motion.span>
          )}

          {/* Defense badge */}
          {isDefense && (
            <span
              className={cn(
                "inline-flex items-center gap-1 text-[9px] font-bold uppercase tracking-wider",
                "text-cyan-400 bg-cyan-500/15 border border-cyan-500/30",
                "px-2 py-0.5 rounded-md"
              )}
            >
              <ShieldCheck className="h-2.5 w-2.5" />
              Defends
            </span>
          )}

          {/* Timestamp */}
          <span
            className="ml-auto text-[10px] text-gray-500 font-mono tabular-nums"
          >
            {timeStr}
          </span>
        </div>

        {/* Message body */}
        <p
          className={cn(
            "text-sm leading-relaxed break-words",
            isEliminated ? "text-gray-400 italic" : "text-gray-200",
            isAccusation && "text-white/90",
            isDefense && "text-white/90"
          )}
        >
          {message.content}
        </p>
      </div>
    </motion.div>
  );
}
