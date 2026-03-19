"use client";

import { useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useAccount } from "wagmi";
import { cn, shortenAddress } from "@/lib/utils";
import {
  DollarSign,
  CheckCircle,
  XCircle,
  Loader2,
  ExternalLink,
  Shield,
  Wallet,
} from "lucide-react";

// ── Types ────────────────────────────────────────────────────────────

interface LocusCheckoutProps {
  gameId: string;
  amount: string;
  treasuryAddress?: string;
  onSuccess?: (data: { txHash?: string; transactionId?: string; gameId: string }) => void;
  onCancel?: () => void;
  onError?: (error: string) => void;
}

interface PaymentResult {
  success: boolean;
  transactionId?: string;
  txHash?: string;
  balance?: string;
  error?: string;
  gameId?: string;
  spendingCheck?: { allowed: boolean; reason?: string };
}

type CheckoutStep = "idle" | "confirming" | "processing" | "success" | "error";

const ENGINE_API = process.env.NEXT_PUBLIC_ENGINE_API || "http://localhost:3001";

// ── Main Component ───────────────────────────────────────────────────

/**
 * Self-contained USDC payment component for Among Claws game entry fees.
 * Communicates with the engine's Locus API routes to process payments
 * on Base chain via Locus payment infrastructure.
 */
export default function LocusCheckout({
  gameId,
  amount,
  treasuryAddress,
  onSuccess,
  onCancel,
  onError,
}: LocusCheckoutProps) {
  const { address, isConnected } = useAccount();
  const [step, setStep] = useState<CheckoutStep>("idle");
  const [txResult, setTxResult] = useState<PaymentResult | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [balance, setBalance] = useState<string | null>(null);
  const [loadingBalance, setLoadingBalance] = useState(false);

  const fetchBalance = useCallback(async () => {
    if (!address) return;
    setLoadingBalance(true);
    try {
      const res = await fetch(`${ENGINE_API}/api/locus/balance/${address}`);
      if (res.ok) {
        const data = await res.json();
        setBalance(data.balance || "0.00");
      }
    } catch {
      // Balance fetch is best-effort
    } finally {
      setLoadingBalance(false);
    }
  }, [address]);

  const handlePay = useCallback(async () => {
    if (!address) return;

    setStep("confirming");
    setErrorMessage(null);

    try {
      // Brief delay for UX feedback
      await new Promise((r) => setTimeout(r, 400));
      setStep("processing");

      const res = await fetch(`${ENGINE_API}/api/locus/pay`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          from: address,
          to: treasuryAddress || "",
          amount,
          memo: `Game entry fee for game ${gameId}`,
        }),
      });

      const data: PaymentResult = await res.json();

      if (!res.ok || !data.success) {
        const msg = data.error || data.spendingCheck?.reason || "Payment failed";
        setErrorMessage(msg);
        setStep("error");
        onError?.(msg);
        return;
      }

      setTxResult(data);
      setStep("success");
      onSuccess?.({
        txHash: data.txHash,
        transactionId: data.transactionId,
        gameId,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Payment request failed";
      setErrorMessage(msg);
      setStep("error");
      onError?.(msg);
    }
  }, [address, amount, gameId, treasuryAddress, onSuccess, onError]);

  const handleRetry = useCallback(() => {
    setStep("idle");
    setErrorMessage(null);
    setTxResult(null);
  }, []);

  const parsedAmount = parseFloat(amount);
  const hasSufficientBalance = balance !== null ? parseFloat(balance) >= parsedAmount : true;

  return (
    <div className="gradient-border overflow-hidden">
      <div className="glass-card card-shine rounded-2xl overflow-hidden">
        {/* Header */}
        <div className="relative border-b border-white/[0.06] p-5">
          <div className="absolute top-4 left-4 h-8 w-8 rounded-full bg-blue-500/10 blur-xl" />
          <div className="relative flex items-center gap-3">
            <div className="relative flex h-10 w-10 items-center justify-center rounded-xl bg-blue-500/[0.08] border border-blue-500/20">
              <DollarSign className="h-5 w-5 text-blue-400" />
            </div>
            <div>
              <h3 className="font-bold text-white text-base tracking-tight">
                Pay with USDC
              </h3>
              <p className="text-[11px] text-gray-500 mt-0.5">
                via Locus on Base
              </p>
            </div>
            <div className="ml-auto flex items-center gap-1.5">
              <Shield className="h-3.5 w-3.5 text-green-500/60" />
              <span className="text-[10px] text-green-500/60 font-medium">Secured</span>
            </div>
          </div>
        </div>

        <div className="p-5 space-y-5">
          {/* Payment Summary */}
          <div className="rounded-xl bg-white/[0.02] border border-white/[0.05] p-4 space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-[11px] text-gray-500 uppercase tracking-wider font-medium">
                Game Entry Fee
              </span>
              <span className="text-sm font-mono font-bold tabular-nums text-blue-400">
                {parsedAmount.toFixed(2)} USDC
              </span>
            </div>
            <div className="h-px bg-white/[0.04]" />
            <div className="flex justify-between items-center">
              <span className="text-[11px] text-gray-500 uppercase tracking-wider font-medium">
                Network
              </span>
              <span className="text-sm font-medium text-gray-300">
                Base (L2)
              </span>
            </div>
            <div className="h-px bg-white/[0.04]" />
            <div className="flex justify-between items-center">
              <span className="text-[11px] text-gray-500 uppercase tracking-wider font-medium">
                Game
              </span>
              <span className="text-sm font-mono text-gray-400">
                {gameId.length > 12 ? `${gameId.slice(0, 8)}...` : gameId}
              </span>
            </div>
            {isConnected && address && (
              <>
                <div className="h-px bg-white/[0.04]" />
                <div className="flex justify-between items-center">
                  <span className="text-[11px] text-gray-500 uppercase tracking-wider font-medium">
                    From
                  </span>
                  <span className="text-sm font-mono text-gray-400">
                    {shortenAddress(address)}
                  </span>
                </div>
              </>
            )}
          </div>

          {/* Balance Display */}
          {isConnected && (
            <div className="flex items-center justify-between">
              <button
                onClick={fetchBalance}
                disabled={loadingBalance}
                className="flex items-center gap-1.5 text-[11px] text-gray-500 hover:text-gray-300 transition-colors"
              >
                <Wallet className="h-3.5 w-3.5" />
                {loadingBalance ? "Checking..." : "Check USDC Balance"}
              </button>
              {balance !== null && (
                <span
                  className={cn(
                    "text-sm font-mono tabular-nums",
                    hasSufficientBalance ? "text-green-400" : "text-red-400"
                  )}
                >
                  {parseFloat(balance).toFixed(2)} USDC
                </span>
              )}
            </div>
          )}

          {/* Insufficient balance warning */}
          <AnimatePresence>
            {balance !== null && !hasSufficientBalance && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="flex items-start gap-2 rounded-xl bg-yellow-500/[0.08] border border-yellow-500/20 p-3"
              >
                <XCircle className="h-4 w-4 text-yellow-400 mt-0.5 shrink-0" />
                <p className="text-xs text-yellow-300 leading-relaxed">
                  Insufficient USDC balance. You need {parsedAmount.toFixed(2)} USDC but have {parseFloat(balance).toFixed(2)} USDC.
                </p>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Step: Success */}
          <AnimatePresence>
            {step === "success" && txResult && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="rounded-xl bg-green-500/[0.08] border border-green-500/20 p-4 space-y-3"
              >
                <div className="flex items-center gap-2">
                  <CheckCircle className="h-5 w-5 text-green-400" />
                  <p className="text-sm font-medium text-green-300">
                    Payment confirmed
                  </p>
                </div>
                {txResult.transactionId && (
                  <p className="text-xs text-gray-400 font-mono">
                    ID: {txResult.transactionId}
                  </p>
                )}
                {txResult.txHash && (
                  <a
                    href={`https://basescan.org/tx/${txResult.txHash}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-xs text-blue-400 hover:text-blue-300 transition-colors"
                  >
                    View on BaseScan
                    <ExternalLink className="h-3 w-3" />
                  </a>
                )}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Step: Error */}
          <AnimatePresence>
            {step === "error" && errorMessage && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="flex items-start gap-2 rounded-xl bg-red-500/[0.08] border border-red-500/20 p-3"
              >
                <XCircle className="h-4 w-4 text-red-400 mt-0.5 shrink-0" />
                <p className="text-xs text-red-300 leading-relaxed">
                  {errorMessage}
                </p>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Action Buttons */}
          {step === "success" ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-center text-xs text-gray-500 py-2"
            >
              You are now entered in the game
            </motion.div>
          ) : step === "error" ? (
            <div className="flex gap-3">
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={handleRetry}
                className={cn(
                  "flex-1 rounded-xl py-3 text-sm font-bold tracking-wide",
                  "bg-white/[0.05] border border-white/[0.08] text-gray-300",
                  "hover:bg-white/[0.08] transition-all duration-200"
                )}
              >
                Try Again
              </motion.button>
              {onCancel && (
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={onCancel}
                  className={cn(
                    "flex-1 rounded-xl py-3 text-sm font-medium tracking-wide",
                    "border border-white/[0.06] text-gray-500",
                    "hover:text-gray-300 transition-all duration-200"
                  )}
                >
                  Cancel
                </motion.button>
              )}
            </div>
          ) : (
            <div className="flex gap-3">
              <motion.button
                whileHover={step === "idle" ? { scale: 1.02 } : {}}
                whileTap={step === "idle" ? { scale: 0.98 } : {}}
                onClick={handlePay}
                disabled={step !== "idle" || !isConnected}
                className={cn(
                  "relative flex-1 rounded-xl py-3.5 text-sm font-bold tracking-wide",
                  "transition-all duration-300 overflow-hidden",
                  step !== "idle" || !isConnected
                    ? "bg-white/[0.03] border border-white/[0.05] text-gray-600 cursor-not-allowed"
                    : [
                        "bg-gradient-to-r from-blue-600 via-cyan-500 to-blue-600 text-white",
                        "shadow-[0_0_30px_rgba(59,130,246,0.2)]",
                        "hover:shadow-[0_0_40px_rgba(59,130,246,0.35)]",
                        "bg-[length:200%_100%] animate-shimmer",
                      ]
                )}
              >
                {step !== "idle" && (
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/[0.06] to-transparent animate-shimmer bg-[length:200%_100%] pointer-events-none" />
                )}
                <span className="relative inline-flex items-center justify-center gap-2">
                  {step === "confirming" ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Confirming...
                    </>
                  ) : step === "processing" ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Processing payment...
                    </>
                  ) : (
                    <>
                      <DollarSign className="h-4 w-4" />
                      Pay {parsedAmount.toFixed(2)} USDC
                    </>
                  )}
                </span>
              </motion.button>
              {onCancel && step === "idle" && (
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={onCancel}
                  className={cn(
                    "rounded-xl px-5 py-3.5 text-sm font-medium tracking-wide",
                    "border border-white/[0.06] text-gray-500",
                    "hover:text-gray-300 hover:border-white/[0.1] transition-all duration-200"
                  )}
                >
                  Cancel
                </motion.button>
              )}
            </div>
          )}

          {/* Powered by Locus footer */}
          <div className="flex items-center justify-center gap-1.5 pt-1">
            <span className="text-[10px] text-gray-600">Powered by</span>
            <span className="text-[10px] font-semibold text-gray-500">Locus</span>
            <span className="text-[10px] text-gray-600">on Base</span>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Compact button variant for triggering Locus payment in other contexts.
 */
export function LocusPayButton({
  amount,
  label,
  onClick,
  disabled = false,
  className = "",
}: {
  amount: string;
  label?: string;
  onClick: () => void;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <motion.button
      whileHover={!disabled ? { scale: 1.02 } : {}}
      whileTap={!disabled ? { scale: 0.98 } : {}}
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold",
        "transition-all duration-200",
        disabled
          ? "bg-white/[0.03] border border-white/[0.05] text-gray-600 cursor-not-allowed"
          : [
              "bg-blue-600/90 text-white border border-blue-500/30",
              "hover:bg-blue-600 hover:border-blue-500/50",
              "shadow-[0_0_15px_rgba(59,130,246,0.15)]",
            ],
        className
      )}
    >
      <DollarSign className="h-4 w-4" />
      {label || `Pay ${parseFloat(amount).toFixed(2)} USDC`}
    </motion.button>
  );
}
