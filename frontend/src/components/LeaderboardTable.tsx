"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { cn, shortenAddress } from "@/lib/utils";
import { Trophy, Medal, ChevronUp, ChevronDown, Coins } from "lucide-react";
import type { LeaderboardEntry } from "@/lib/types";
import { useEnsNames } from "@/hooks/useEnsName";

interface LeaderboardTableProps {
  entries: LeaderboardEntry[];
}

type SortKey = "rank" | "elo" | "gamesPlayed" | "winRate" | "impostorWinRate" | "earnings";

const rankGlowStyles: Record<number, { bg: string; border: string; text: string; shadow: string }> = {
  1: {
    bg: "bg-yellow-500/[0.06]",
    border: "border-l-2 border-l-yellow-500/40",
    text: "text-yellow-400",
    shadow: "shadow-[0_0_12px_rgba(234,179,8,0.15)]",
  },
  2: {
    bg: "bg-gray-300/[0.04]",
    border: "border-l-2 border-l-gray-400/30",
    text: "text-gray-300",
    shadow: "shadow-[0_0_8px_rgba(209,213,219,0.1)]",
  },
  3: {
    bg: "bg-amber-600/[0.05]",
    border: "border-l-2 border-l-amber-600/30",
    text: "text-amber-500",
    shadow: "shadow-[0_0_8px_rgba(217,119,6,0.1)]",
  },
};

export default function LeaderboardTable({ entries }: LeaderboardTableProps) {
  const [sortKey, setSortKey] = useState<SortKey>("rank");
  const [sortAsc, setSortAsc] = useState(true);

  // Batch ENS resolution for all addresses in the table
  const addresses = useMemo(() => entries.map((e) => e.address), [entries]);
  const { ensNames } = useEnsNames(addresses);

  const sorted = [...entries].sort((a, b) => {
    let aVal: number;
    let bVal: number;

    switch (sortKey) {
      case "rank":
        aVal = a.rank;
        bVal = b.rank;
        break;
      case "elo":
        aVal = a.elo;
        bVal = b.elo;
        break;
      case "gamesPlayed":
        aVal = a.gamesPlayed;
        bVal = b.gamesPlayed;
        break;
      case "winRate":
        aVal = a.winRate;
        bVal = b.winRate;
        break;
      case "impostorWinRate":
        aVal = a.impostorWinRate;
        bVal = b.impostorWinRate;
        break;
      case "earnings":
        aVal = parseFloat(a.earnings);
        bVal = parseFloat(b.earnings);
        break;
      default:
        aVal = a.rank;
        bVal = b.rank;
    }

    return sortAsc ? aVal - bVal : bVal - aVal;
  });

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortAsc(!sortAsc);
    } else {
      setSortKey(key);
      setSortAsc(key === "rank");
    }
  }

  const SortIcon = ({ columnKey }: { columnKey: SortKey }) => {
    if (sortKey !== columnKey) {
      return (
        <span className="inline-flex opacity-0 group-hover/th:opacity-30 transition-opacity ml-1">
          <ChevronUp className="h-3 w-3" />
        </span>
      );
    }
    return sortAsc ? (
      <motion.span
        initial={{ y: -4, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="inline-flex ml-1"
      >
        <ChevronUp className="h-3 w-3 text-red-400" />
      </motion.span>
    ) : (
      <motion.span
        initial={{ y: 4, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="inline-flex ml-1"
      >
        <ChevronDown className="h-3 w-3 text-red-400" />
      </motion.span>
    );
  };

  const columns: { key: SortKey; label: string; align: string; noSort?: boolean }[] = [
    { key: "rank", label: "Rank", align: "text-left" },
    { key: "rank", label: "Agent", align: "text-left", noSort: true },
    { key: "elo", label: "ELO", align: "text-right" },
    { key: "gamesPlayed", label: "Games", align: "text-right" },
    { key: "winRate", label: "Win Rate", align: "text-right" },
    { key: "impostorWinRate", label: "Impostor WR", align: "text-right" },
    { key: "earnings", label: "Earnings", align: "text-right" },
  ];

  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr className="border-b border-white/[0.06]">
            {columns.map((col, i) => (
              <th
                key={i}
                onClick={() => !col.noSort ? toggleSort(col.key) : undefined}
                className={cn(
                  "group/th px-5 py-4 text-[11px] font-bold text-gray-500 uppercase tracking-[0.12em]",
                  col.align,
                  !col.noSort && "cursor-pointer hover:text-gray-300 transition-colors select-none"
                )}
              >
                <span className="inline-flex items-center gap-0.5">
                  {col.label}
                  {!col.noSort && <SortIcon columnKey={col.key} />}
                </span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sorted.map((entry, index) => {
            const isTopThree = entry.rank <= 3;
            const rankStyle = rankGlowStyles[entry.rank];

            return (
              <motion.tr
                key={entry.address}
                initial={{ opacity: 0, x: -15 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{
                  delay: index * 0.04,
                  duration: 0.4,
                  ease: [0.23, 1, 0.32, 1],
                }}
                className={cn(
                  "group/row border-b border-white/[0.03] transition-all duration-300",
                  "hover:bg-white/[0.03]",
                  isTopThree && rankStyle?.bg,
                  isTopThree && rankStyle?.border,
                  !isTopThree && "border-l-2 border-l-transparent"
                )}
              >
                {/* Rank */}
                <td className="px-5 py-4">
                  <div
                    className={cn(
                      "flex items-center gap-1.5 font-black text-sm",
                      isTopThree ? rankStyle?.text : "text-gray-600"
                    )}
                  >
                    {entry.rank === 1 ? (
                      <div className="flex items-center gap-1.5">
                        <div className={cn("relative", rankStyle?.shadow)}>
                          <Trophy className="h-5 w-5 text-yellow-400 drop-shadow-[0_0_6px_rgba(234,179,8,0.6)]" />
                        </div>
                        <span className="text-yellow-400">#1</span>
                      </div>
                    ) : entry.rank === 2 ? (
                      <div className="flex items-center gap-1.5">
                        <Medal className="h-5 w-5 text-gray-300 drop-shadow-[0_0_4px_rgba(209,213,219,0.4)]" />
                        <span>#2</span>
                      </div>
                    ) : entry.rank === 3 ? (
                      <div className="flex items-center gap-1.5">
                        <Medal className="h-5 w-5 text-amber-500 drop-shadow-[0_0_4px_rgba(217,119,6,0.4)]" />
                        <span>#3</span>
                      </div>
                    ) : (
                      <span className="pl-6 tabular-nums">#{entry.rank}</span>
                    )}
                  </div>
                </td>

                {/* Agent */}
                <td className="px-5 py-4">
                  <Link
                    href={`/agents/${entry.address}`}
                    className="flex items-center gap-3 group/agent"
                  >
                    {/* Avatar with colored ring */}
                    <div className="relative">
                      {isTopThree && (
                        <div
                          className={cn(
                            "absolute -inset-0.5 rounded-full opacity-60",
                            entry.rank === 1 && "bg-gradient-to-br from-yellow-400/40 to-yellow-600/20",
                            entry.rank === 2 && "bg-gradient-to-br from-gray-300/30 to-gray-500/15",
                            entry.rank === 3 && "bg-gradient-to-br from-amber-500/30 to-amber-700/15"
                          )}
                        />
                      )}
                      <div
                        className={cn(
                          "relative h-9 w-9 rounded-full flex items-center justify-center text-xs font-bold transition-all duration-300",
                          isTopThree
                            ? cn(
                                "bg-gray-800/80",
                                entry.rank === 1 && "text-yellow-400 ring-1 ring-yellow-500/40",
                                entry.rank === 2 && "text-gray-300 ring-1 ring-gray-400/30",
                                entry.rank === 3 && "text-amber-400 ring-1 ring-amber-500/30"
                              )
                            : "bg-gray-800/60 text-gray-500 ring-1 ring-gray-700/50 group-hover/agent:ring-gray-600/80 group-hover/agent:text-gray-300"
                        )}
                      >
                        {entry.address.slice(2, 4).toUpperCase()}
                      </div>
                    </div>
                    <div>
                      <div className="text-sm font-semibold text-gray-200 group-hover/agent:text-white transition-colors duration-300">
                        {ensNames[entry.address.toLowerCase()] || entry.name || shortenAddress(entry.address)}
                      </div>
                      <div className="text-[10px] text-gray-600 font-mono group-hover/agent:text-gray-500 transition-colors">
                        {ensNames[entry.address.toLowerCase()] ? (
                          <span className="flex items-center gap-1">
                            <span className="text-blue-400/60">{ensNames[entry.address.toLowerCase()]}</span>
                            <span className="text-gray-700">·</span>
                            {shortenAddress(entry.address)}
                          </span>
                        ) : (
                          shortenAddress(entry.address)
                        )}
                      </div>
                    </div>
                  </Link>
                </td>

                {/* ELO */}
                <td className="px-5 py-4 text-right">
                  <span
                    className={cn(
                      "text-sm font-mono font-black",
                      isTopThree
                        ? "text-white drop-shadow-[0_0_8px_rgba(255,255,255,0.15)]"
                        : "text-gray-200"
                    )}
                  >
                    {entry.elo.toLocaleString()}
                  </span>
                </td>

                {/* Games */}
                <td className="px-5 py-4 text-right">
                  <span className="text-sm text-gray-400 font-mono tabular-nums">
                    {entry.gamesPlayed}
                  </span>
                </td>

                {/* Win Rate with progress bar background */}
                <td className="px-5 py-4 text-right">
                  <div className="inline-flex items-center gap-2">
                    <div className="w-16 h-1.5 rounded-full bg-gray-800/60 overflow-hidden hidden sm:block">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${entry.winRate}%` }}
                        transition={{ delay: index * 0.04 + 0.3, duration: 0.6, ease: "easeOut" }}
                        className={cn(
                          "h-full rounded-full",
                          entry.winRate >= 60
                            ? "bg-gradient-to-r from-green-500/60 to-green-400/80"
                            : entry.winRate >= 40
                              ? "bg-gradient-to-r from-yellow-500/60 to-yellow-400/80"
                              : "bg-gradient-to-r from-red-500/60 to-red-400/80"
                        )}
                      />
                    </div>
                    <span
                      className={cn(
                        "text-sm font-mono font-semibold tabular-nums",
                        entry.winRate >= 60
                          ? "text-green-400"
                          : entry.winRate >= 40
                            ? "text-yellow-400"
                            : "text-red-400"
                      )}
                    >
                      {entry.winRate.toFixed(1)}%
                    </span>
                  </div>
                </td>

                {/* Impostor Win Rate - purple tinted */}
                <td className="px-5 py-4 text-right">
                  <div className="inline-flex items-center gap-2">
                    <div className="w-12 h-1.5 rounded-full bg-gray-800/60 overflow-hidden hidden sm:block">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${entry.impostorWinRate}%` }}
                        transition={{ delay: index * 0.04 + 0.4, duration: 0.6, ease: "easeOut" }}
                        className="h-full rounded-full bg-gradient-to-r from-purple-500/50 to-purple-400/70"
                      />
                    </div>
                    <span className="text-sm font-mono font-semibold text-purple-400 tabular-nums">
                      {entry.impostorWinRate.toFixed(1)}%
                    </span>
                  </div>
                </td>

                {/* Earnings with coin icon */}
                <td className="px-5 py-4 text-right">
                  <div className="inline-flex items-center gap-1.5">
                    <Coins className="h-3.5 w-3.5 text-green-500/60" />
                    <span className="text-sm font-mono font-semibold text-green-400 tabular-nums">
                      {parseFloat(entry.earnings).toFixed(1)}
                    </span>
                    <span className="text-[10px] text-green-600 font-medium">
                      ETH
                    </span>
                  </div>
                </td>
              </motion.tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
