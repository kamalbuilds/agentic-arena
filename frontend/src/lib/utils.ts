import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatETH(amount: bigint | string | number): string {
  const value =
    typeof amount === "bigint"
      ? Number(amount) / 1e18
      : typeof amount === "string"
        ? parseFloat(amount)
        : amount;
  if (value >= 1000) {
    return `${(value / 1000).toFixed(1)}k ETH`;
  }
  if (value >= 1) {
    return `${value.toFixed(2)} ETH`;
  }
  return `${value.toFixed(4)} ETH`;
}

export function shortenAddress(address: string): string {
  if (!address) return "";
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

export function formatTime(seconds: number): string {
  if (seconds <= 0) return "0:00";
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

export function getPhaseColor(phase: string): string {
  switch (phase.toLowerCase()) {
    case "discussion":
      return "text-green-400";
    case "voting":
      return "text-orange-400";
    case "elimination":
      return "text-red-400";
    case "results":
      return "text-purple-400";
    default:
      return "text-gray-400";
  }
}

export function getPhaseBgColor(phase: string): string {
  switch (phase.toLowerCase()) {
    case "discussion":
      return "bg-green-500/20 border-green-500/50";
    case "voting":
      return "bg-orange-500/20 border-orange-500/50";
    case "elimination":
      return "bg-red-500/20 border-red-500/50";
    case "results":
      return "bg-purple-500/20 border-purple-500/50";
    default:
      return "bg-gray-500/20 border-gray-500/50";
  }
}

export function getAgentColor(address: string): string {
  const colors = [
    "#DC2626",
    "#2563EB",
    "#16A34A",
    "#D97706",
    "#7C3AED",
    "#DB2777",
    "#0891B2",
    "#65A30D",
    "#EA580C",
    "#4F46E5",
  ];
  const hash = address
    .split("")
    .reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return colors[hash % colors.length];
}

export function getAgentName(address: string): string {
  const names = [
    "Agent Alpha",
    "Agent Bravo",
    "Agent Charlie",
    "Agent Delta",
    "Agent Echo",
    "Agent Foxtrot",
    "Agent Golf",
    "Agent Hotel",
    "Agent India",
    "Agent Juliet",
  ];
  const hash = address
    .split("")
    .reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return names[hash % names.length];
}
