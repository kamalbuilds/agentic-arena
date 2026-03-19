"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useAccount, useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { cn, shortenAddress } from "@/lib/utils";
import { Coins, TrendingUp, Target, ChevronDown, CheckCircle, XCircle } from "lucide-react";
import type { Player, BettingOdds, Bet } from "@/lib/types";
import {
  BETTING_CONTRACT,
  BETTING_ABI,
  BET_TYPE_MAP,
  gameIdToUint256,
  ethToWei,
} from "@/lib/contracts";

interface BettingPanelProps {
  gameId: string;
  players: Player[];
  odds: BettingOdds | null;
  activeBets: Bet[];
}

type BetType = "lobsters_win" | "impostor_wins" | "specific_agent";

const betOptions: {
  type: BetType;
  label: string;
  icon: typeof Coins;
  activeNeonClass: string;
  activeGlowClass: string;
  activeBorderColor: string;
  activeBgColor: string;
}[] = [
  {
    type: "lobsters_win",
    label: "Lobsters Win",
    icon: Target,
    activeNeonClass: "neon-green",
    activeGlowClass: "glow-green",
    activeBorderColor: "border-green-500/50",
    activeBgColor: "bg-green-500/[0.08]",
  },
  {
    type: "impostor_wins",
    label: "Impostor Wins",
    icon: TrendingUp,
    activeNeonClass: "neon-purple",
    activeGlowClass: "glow-purple",
    activeBorderColor: "border-purple-500/50",
    activeBgColor: "bg-purple-500/[0.08]",
  },
  {
    type: "specific_agent",
    label: "Specific Agent",
    icon: Target,
    activeNeonClass: "neon-orange",
    activeGlowClass: "glow-orange",
    activeBorderColor: "border-orange-500/50",
    activeBgColor: "bg-orange-500/[0.08]",
  },
];

export default function BettingPanel({
  gameId,
  players,
  odds,
  activeBets,
}: BettingPanelProps) {
  const { address, isConnected } = useAccount();
  const [betType, setBetType] = useState<BetType>("lobsters_win");
  const [amount, setAmount] = useState("");
  const [targetAgent, setTargetAgent] = useState("");
  const [showAgentSelect, setShowAgentSelect] = useState(false);
  const [betError, setBetError] = useState<string | null>(null);
  const [betSuccess, setBetSuccess] = useState(false);

  // On-chain bet transaction
  const { writeContract, data: txHash, isPending: isWriting, error: writeError } = useWriteContract();
  const { isLoading: isConfirming, isSuccess: isConfirmed } = useWaitForTransactionReceipt({
    hash: txHash,
  });

  const isPlacing = isWriting || isConfirming;

  const currentOdds =
    betType === "lobsters_win"
      ? odds?.lobstersWin ?? 1.8
      : betType === "impostor_wins"
        ? odds?.impostorWins ?? 2.5
        : targetAgent
          ? odds?.specificAgents?.[targetAgent] ?? 5.0
          : 5.0;

  const parsedAmount = parseFloat(amount);
  const potentialPayout = amount && !isNaN(parsedAmount)
    ? (parsedAmount * currentOdds).toFixed(2)
    : "0.00";

  const isDisabled =
    isPlacing ||
    !isConnected ||
    !amount ||
    isNaN(parsedAmount) ||
    parsedAmount <= 0 ||
    (betType === "specific_agent" && !targetAgent);

  async function handlePlaceBet() {
    if (isDisabled || !address) return;

    setBetError(null);
    setBetSuccess(false);

    try {
      const numericGameId = gameIdToUint256(gameId);
      const betTypeNum = BET_TYPE_MAP[betType];
      const predictedAgent = betType === "specific_agent" && targetAgent
        ? targetAgent as `0x${string}`
        : "0x0000000000000000000000000000000000000000" as `0x${string}`;
      const value = ethToWei(amount);

      if (value <= BigInt(0)) {
        setBetError("Invalid amount");
        return;
      }

      writeContract({
        address: BETTING_CONTRACT,
        abi: BETTING_ABI,
        functionName: "placeBet",
        args: [numericGameId, betTypeNum, predictedAgent],
        value,
      });
    } catch (error) {
      setBetError(error instanceof Error ? error.message : "Failed to place bet");
    }
  }

  // Show success after confirmation
  if (isConfirmed && !betSuccess) {
    setBetSuccess(true);
    setAmount("");
    setTimeout(() => setBetSuccess(false), 4000);
  }

  const displayError = betError || (writeError ? writeError.message.split("\n")[0] : null);

  return (
    <div className="gradient-border overflow-hidden">
      <div className="glass-card card-shine rounded-2xl overflow-hidden">
        {/* Header */}
        <div className="relative border-b border-white/[0.06] p-5">
          <div className="absolute top-4 left-4 h-8 w-8 rounded-full bg-yellow-500/10 blur-xl" />
          <div className="relative flex items-center gap-3">
            <div className="relative flex h-10 w-10 items-center justify-center rounded-xl bg-yellow-500/[0.08] border border-yellow-500/20">
              <Coins className="h-5 w-5 neon-orange" />
            </div>
            <div>
              <h3 className="font-bold text-white text-base tracking-tight">
                Place Your Bet
              </h3>
              <p className="text-[11px] text-gray-500 mt-0.5">
                Wager on the game outcome
              </p>
            </div>
          </div>
        </div>

        <div className="p-5 space-y-5">
          {/* Not connected state */}
          {!isConnected ? (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex flex-col items-center justify-center py-10 space-y-4"
            >
              <div className="relative">
                <div className="absolute inset-0 rounded-full bg-orange-500/10 blur-2xl animate-pulse-glow" />
                <Coins className="relative h-12 w-12 text-gray-600" />
              </div>
              <p className="text-sm text-gray-400 text-center max-w-[200px]">
                Connect your wallet to start placing bets
              </p>
              <div className="mt-2">
                <ConnectButton />
              </div>
            </motion.div>
          ) : (
            <>
              {/* Bet Type Selection */}
              <div className="space-y-2.5">
                <label className="text-[10px] text-gray-500 uppercase tracking-[0.15em] font-semibold">
                  Bet Type
                </label>
                <div className="grid gap-2">
                  {betOptions.map((option) => {
                    const Icon = option.icon;
                    const isActive = betType === option.type;
                    return (
                      <motion.button
                        key={option.type}
                        whileHover={{ scale: 1.01 }}
                        whileTap={{ scale: 0.99 }}
                        onClick={() => {
                          setBetType(option.type);
                          setBetError(null);
                          if (option.type !== "specific_agent") {
                            setTargetAgent("");
                            setShowAgentSelect(false);
                          }
                        }}
                        className={cn(
                          "relative flex items-center gap-3 rounded-xl border p-3.5 text-sm font-medium",
                          "transition-all duration-300 text-left overflow-hidden",
                          isActive
                            ? [
                                option.activeBorderColor,
                                option.activeBgColor,
                                option.activeGlowClass,
                              ]
                            : [
                                "border-white/[0.06] bg-white/[0.02]",
                                "text-gray-400 hover:border-white/[0.1] hover:bg-white/[0.03]",
                                "hover:text-gray-300",
                              ]
                        )}
                      >
                        {isActive && (
                          <div className="absolute inset-0 opacity-20 pointer-events-none">
                            <div
                              className={cn(
                                "absolute inset-0 rounded-xl",
                                option.type === "lobsters_win" && "bg-gradient-to-r from-green-500/10 to-transparent",
                                option.type === "impostor_wins" && "bg-gradient-to-r from-purple-500/10 to-transparent",
                                option.type === "specific_agent" && "bg-gradient-to-r from-orange-500/10 to-transparent"
                              )}
                            />
                          </div>
                        )}
                        <div
                          className={cn(
                            "flex h-8 w-8 items-center justify-center rounded-lg",
                            isActive ? "bg-white/[0.08]" : "bg-white/[0.03]"
                          )}
                        >
                          <Icon
                            className={cn(
                              "h-4 w-4 transition-colors",
                              isActive ? option.activeNeonClass : "text-gray-500"
                            )}
                          />
                        </div>
                        <span className={cn("relative", isActive && option.activeNeonClass)}>
                          {option.label}
                        </span>
                        <span
                          className={cn(
                            "ml-auto text-xs font-mono tabular-nums",
                            isActive ? "text-white/50" : "text-gray-600"
                          )}
                        >
                          {option.type === "lobsters_win"
                            ? `${(odds?.lobstersWin ?? 1.8).toFixed(1)}x`
                            : option.type === "impostor_wins"
                              ? `${(odds?.impostorWins ?? 2.5).toFixed(1)}x`
                              : "varies"}
                        </span>
                      </motion.button>
                    );
                  })}
                </div>
              </div>

              {/* Agent Selector */}
              <AnimatePresence>
                {betType === "specific_agent" && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.3, ease: "easeInOut" }}
                    className="overflow-hidden"
                  >
                    <div className="space-y-2.5">
                      <label className="text-[10px] text-gray-500 uppercase tracking-[0.15em] font-semibold">
                        Select Agent
                      </label>
                      <div className="relative">
                        <button
                          onClick={() => setShowAgentSelect(!showAgentSelect)}
                          className={cn(
                            "w-full flex items-center justify-between rounded-xl border p-3.5 text-sm",
                            "transition-all duration-200",
                            "glass-card border-white/[0.08] text-gray-300",
                            "hover:border-orange-500/30 hover:bg-orange-500/[0.03]",
                            showAgentSelect && "border-orange-500/40 glow-orange"
                          )}
                        >
                          <span className={targetAgent ? "text-white" : "text-gray-500"}>
                            {targetAgent
                              ? players.find((p) => p.address === targetAgent)?.name ||
                                shortenAddress(targetAgent)
                              : "Choose an agent..."}
                          </span>
                          <motion.div
                            animate={{ rotate: showAgentSelect ? 180 : 0 }}
                            transition={{ duration: 0.2 }}
                          >
                            <ChevronDown className="h-4 w-4 text-gray-500" />
                          </motion.div>
                        </button>

                        <AnimatePresence>
                          {showAgentSelect && (
                            <motion.div
                              initial={{ opacity: 0, y: -8, scale: 0.97 }}
                              animate={{ opacity: 1, y: 0, scale: 1 }}
                              exit={{ opacity: 0, y: -8, scale: 0.97 }}
                              transition={{ duration: 0.2 }}
                              className={cn(
                                "absolute z-20 mt-2 w-full rounded-xl overflow-hidden",
                                "glass-card border border-white/[0.08]",
                                "shadow-[0_16px_48px_rgba(0,0,0,0.4)]",
                                "max-h-48 overflow-y-auto"
                              )}
                            >
                              {players
                                .filter((p) => p.isAlive)
                                .map((player, idx) => (
                                  <button
                                    key={player.address}
                                    onClick={() => {
                                      setTargetAgent(player.address);
                                      setShowAgentSelect(false);
                                    }}
                                    className={cn(
                                      "w-full flex items-center gap-3 px-4 py-3 text-sm",
                                      "transition-all duration-150 text-left",
                                      "hover:bg-orange-500/[0.06] hover:text-white",
                                      targetAgent === player.address
                                        ? "bg-orange-500/[0.08] text-orange-300"
                                        : "text-gray-300",
                                      idx !== 0 && "border-t border-white/[0.03]"
                                    )}
                                  >
                                    <div className="flex h-7 w-7 items-center justify-center rounded-full bg-white/[0.06] text-[10px] font-bold text-gray-400">
                                      {player.address.slice(2, 4).toUpperCase()}
                                    </div>
                                    <span className="flex-1 truncate">
                                      {player.name || shortenAddress(player.address)}
                                    </span>
                                    <span className="text-xs font-mono text-orange-400/70">
                                      {(odds?.specificAgents?.[player.address] ?? 5.0).toFixed(1)}x
                                    </span>
                                  </button>
                                ))}
                              {players.filter((p) => p.isAlive).length === 0 && (
                                <div className="px-4 py-6 text-center text-xs text-gray-500">
                                  No alive agents
                                </div>
                              )}
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Amount Input */}
              <div className="space-y-2.5">
                <label className="text-[10px] text-gray-500 uppercase tracking-[0.15em] font-semibold">
                  Amount (ETH)
                </label>
                <div className="relative group">
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="0.00"
                    value={amount}
                    onChange={(e) => {
                      setAmount(e.target.value);
                      setBetError(null);
                    }}
                    className={cn(
                      "w-full rounded-xl border px-4 py-3.5 pr-14 text-white text-base font-mono",
                      "placeholder-gray-600 transition-all duration-300",
                      "glass-card border-white/[0.08]",
                      "focus:outline-none focus:border-orange-500/40 focus:ring-1 focus:ring-orange-500/20",
                      "focus:shadow-[0_0_20px_rgba(251,146,60,0.1)]"
                    )}
                  />
                  <div className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-semibold text-gray-500 tracking-wide">
                    ETH
                  </div>
                </div>

                {/* Quick amount buttons */}
                <div className="flex gap-2">
                  {["1", "5", "10", "25"].map((val) => (
                    <motion.button
                      key={val}
                      whileHover={{ scale: 1.04, y: -1 }}
                      whileTap={{ scale: 0.97 }}
                      onClick={() => {
                        setAmount(val);
                        setBetError(null);
                      }}
                      className={cn(
                        "flex-1 rounded-lg border py-2 text-xs font-semibold",
                        "transition-all duration-200",
                        amount === val
                          ? "border-orange-500/40 bg-orange-500/[0.08] text-orange-300 glow-orange"
                          : "border-white/[0.06] bg-white/[0.02] text-gray-500 hover:text-white hover:border-white/[0.12] hover:bg-white/[0.04]"
                      )}
                    >
                      {val}
                    </motion.button>
                  ))}
                </div>
              </div>

              {/* Odds & Payout Display */}
              <div className="rounded-xl bg-white/[0.02] border border-white/[0.05] p-4 space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-[11px] text-gray-500 uppercase tracking-wider font-medium">
                    Odds
                  </span>
                  <span className="text-sm font-mono font-bold tabular-nums neon-orange">
                    {currentOdds.toFixed(2)}x
                  </span>
                </div>
                <div className="h-px bg-white/[0.04]" />
                <div className="flex justify-between items-center">
                  <span className="text-[11px] text-gray-500 uppercase tracking-wider font-medium">
                    Potential Payout
                  </span>
                  <span className="text-sm font-mono font-bold tabular-nums neon-green">
                    {potentialPayout} ETH
                  </span>
                </div>
              </div>

              {/* Error / Success messages */}
              <AnimatePresence>
                {displayError && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    className="flex items-start gap-2 rounded-xl bg-red-500/[0.08] border border-red-500/20 p-3"
                  >
                    <XCircle className="h-4 w-4 text-red-400 mt-0.5 shrink-0" />
                    <p className="text-xs text-red-300 leading-relaxed">{displayError}</p>
                  </motion.div>
                )}
                {betSuccess && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    className="flex items-center gap-2 rounded-xl bg-green-500/[0.08] border border-green-500/20 p-3"
                  >
                    <CheckCircle className="h-4 w-4 text-green-400 shrink-0" />
                    <p className="text-xs text-green-300">Bet placed on-chain successfully!</p>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Place Bet Button */}
              <motion.button
                whileHover={!isDisabled ? { scale: 1.02 } : {}}
                whileTap={!isDisabled ? { scale: 0.98 } : {}}
                onClick={handlePlaceBet}
                disabled={isDisabled}
                className={cn(
                  "relative w-full rounded-xl py-3.5 text-sm font-bold tracking-wide",
                  "transition-all duration-300 overflow-hidden",
                  isDisabled
                    ? "bg-white/[0.03] border border-white/[0.05] text-gray-600 cursor-not-allowed"
                    : [
                        "bg-gradient-to-r from-red-600 via-orange-500 to-red-600 text-white",
                        "shadow-[0_0_30px_rgba(239,68,68,0.2)]",
                        "hover:shadow-[0_0_40px_rgba(239,68,68,0.35)]",
                        "bg-[length:200%_100%] animate-shimmer",
                      ]
                )}
              >
                {!isDisabled && (
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/[0.08] to-transparent animate-shimmer bg-[length:200%_100%] pointer-events-none" />
                )}
                <span className="relative">
                  {isWriting ? (
                    <span className="inline-flex items-center gap-2">
                      <motion.span
                        animate={{ rotate: 360 }}
                        transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                        className="inline-block h-4 w-4 border-2 border-white/30 border-t-white rounded-full"
                      />
                      Confirm in wallet...
                    </span>
                  ) : isConfirming ? (
                    <span className="inline-flex items-center gap-2">
                      <motion.span
                        animate={{ rotate: 360 }}
                        transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                        className="inline-block h-4 w-4 border-2 border-white/30 border-t-white rounded-full"
                      />
                      Confirming tx...
                    </span>
                  ) : (
                    "Place Bet"
                  )}
                </span>
              </motion.button>
            </>
          )}

          {/* Active Bets List */}
          {activeBets.length > 0 && (
            <div className="border-t border-white/[0.05] pt-5">
              <h4 className="text-[10px] text-gray-500 uppercase tracking-[0.15em] font-semibold mb-3">
                Your Active Bets
              </h4>
              <div className="space-y-2">
                {activeBets.map((bet, idx) => (
                  <motion.div
                    key={bet.id}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: idx * 0.05 }}
                    className={cn(
                      "flex items-center justify-between rounded-xl p-3",
                      "glass-card glass-card-hover border border-white/[0.04]",
                      "transition-all duration-200"
                    )}
                  >
                    <div className="min-w-0">
                      <span className="text-xs font-medium text-gray-300 block truncate">
                        {bet.betType === "lobsters_win"
                          ? "Lobsters Win"
                          : bet.betType === "impostor_wins"
                            ? "Impostor Wins"
                            : `Agent ${shortenAddress(bet.targetAgent || "")}`}
                      </span>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-[10px] text-gray-500 font-mono">
                          {bet.amount} ETH
                        </span>
                        <span className="text-[10px] text-gray-600">@</span>
                        <span className="text-[10px] text-orange-400/70 font-mono">
                          {bet.odds.toFixed(1)}x
                        </span>
                      </div>
                    </div>
                    <span
                      className={cn(
                        "text-[9px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-lg",
                        "border",
                        bet.status === "active" && [
                          "bg-yellow-500/[0.08] text-yellow-400 border-yellow-500/20",
                          "shadow-[0_0_8px_rgba(234,179,8,0.1)]",
                        ],
                        bet.status === "won" && [
                          "bg-green-500/[0.08] text-green-400 border-green-500/20",
                          "shadow-[0_0_8px_rgba(34,197,94,0.1)]",
                        ],
                        bet.status === "lost" && [
                          "bg-red-500/[0.08] text-red-400 border-red-500/20",
                        ]
                      )}
                    >
                      {bet.status.toUpperCase()}
                    </span>
                  </motion.div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
