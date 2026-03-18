"use client";

import { motion } from "framer-motion";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface StatsCardProps {
  icon: LucideIcon;
  label: string;
  value: string | number;
  subValue?: string;
  color?: string;
  delay?: number;
}

function getGlowFromColor(color: string): string {
  if (color.includes("red")) return "glow-red";
  if (color.includes("green")) return "glow-green";
  if (color.includes("purple") || color.includes("violet")) return "glow-purple";
  if (color.includes("orange") || color.includes("amber") || color.includes("yellow"))
    return "glow-orange";
  return "";
}

function getIconBgGradient(color: string): string {
  if (color.includes("red"))
    return "bg-gradient-to-br from-red-500/20 to-red-600/10 border-red-500/20";
  if (color.includes("green"))
    return "bg-gradient-to-br from-green-500/20 to-green-600/10 border-green-500/20";
  if (color.includes("purple") || color.includes("violet"))
    return "bg-gradient-to-br from-purple-500/20 to-purple-600/10 border-purple-500/20";
  if (color.includes("orange") || color.includes("amber"))
    return "bg-gradient-to-br from-orange-500/20 to-orange-600/10 border-orange-500/20";
  if (color.includes("yellow"))
    return "bg-gradient-to-br from-yellow-500/20 to-yellow-600/10 border-yellow-500/20";
  if (color.includes("cyan") || color.includes("teal"))
    return "bg-gradient-to-br from-cyan-500/20 to-cyan-600/10 border-cyan-500/20";
  if (color.includes("blue"))
    return "bg-gradient-to-br from-blue-500/20 to-blue-600/10 border-blue-500/20";
  return "bg-gradient-to-br from-gray-500/20 to-gray-600/10 border-gray-500/20";
}

function getAccentGradient(color: string): string {
  if (color.includes("red"))
    return "from-red-400 to-red-600";
  if (color.includes("green"))
    return "from-green-400 to-green-600";
  if (color.includes("purple") || color.includes("violet"))
    return "from-purple-400 to-purple-600";
  if (color.includes("orange") || color.includes("amber"))
    return "from-orange-400 to-orange-600";
  if (color.includes("yellow"))
    return "from-yellow-400 to-yellow-600";
  if (color.includes("cyan") || color.includes("teal"))
    return "from-cyan-400 to-cyan-600";
  if (color.includes("blue"))
    return "from-blue-400 to-blue-600";
  return "from-gray-400 to-gray-600";
}

function getShimmerColor(color: string): string {
  if (color.includes("red")) return "rgba(239, 68, 68, 0.3)";
  if (color.includes("green")) return "rgba(34, 197, 94, 0.3)";
  if (color.includes("purple") || color.includes("violet"))
    return "rgba(168, 85, 247, 0.3)";
  if (color.includes("orange") || color.includes("amber"))
    return "rgba(251, 146, 60, 0.3)";
  if (color.includes("yellow")) return "rgba(234, 179, 8, 0.3)";
  if (color.includes("cyan") || color.includes("teal"))
    return "rgba(34, 211, 238, 0.3)";
  if (color.includes("blue")) return "rgba(59, 130, 246, 0.3)";
  return "rgba(148, 163, 184, 0.2)";
}

export default function StatsCard({
  icon: Icon,
  label,
  value,
  subValue,
  color = "text-red-400",
  delay = 0,
}: StatsCardProps) {
  const glowClass = getGlowFromColor(color);
  const iconBgClass = getIconBgGradient(color);
  const accentGradient = getAccentGradient(color);
  const shimmerColor = getShimmerColor(color);

  return (
    <motion.div
      initial={{ opacity: 0, y: 24, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{
        delay,
        duration: 0.5,
        ease: [0.23, 1, 0.32, 1],
      }}
      whileHover={{
        y: -3,
        transition: { duration: 0.25, ease: "easeOut" },
      }}
      className={cn(
        "glass-card glass-card-hover card-shine relative overflow-hidden rounded-2xl p-5 group cursor-default",
        glowClass
      )}
    >
      <div className="relative flex items-start gap-4">
        {/* Icon */}
        <div
          className={cn(
            "flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border",
            iconBgClass
          )}
        >
          <Icon className={cn("h-5 w-5", color)} />
        </div>

        {/* Content */}
        <div className="flex flex-col min-w-0">
          {/* Label */}
          <p className="text-[11px] text-gray-500 uppercase tracking-[0.12em] font-medium mb-1.5">
            {label}
          </p>

          {/* Value with gradient accent */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{
              delay: delay + 0.3,
              duration: 0.5,
              ease: "easeOut",
            }}
          >
            <p
              className={cn(
                "text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r leading-tight",
                accentGradient
              )}
            >
              {value}
            </p>
          </motion.div>

          {/* Sub-value */}
          {subValue && (
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: delay + 0.5, duration: 0.4 }}
              className="text-xs text-gray-400 mt-1 truncate"
            >
              {subValue}
            </motion.p>
          )}
        </div>
      </div>

    </motion.div>
  );
}
