"use client";

import { use } from "react";
import { motion } from "framer-motion";
import { Loader2, ArrowLeft, WifiOff } from "lucide-react";
import Link from "next/link";
import GameViewer from "@/components/GameViewer";
import BettingPanel from "@/components/BettingPanel";
import { useGameSocket } from "@/hooks/useGameSocket";

export default function GamePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: gameId } = use(params);
  const {
    gameState,
    messages,
    phase,
    players,
    timeRemaining,
    connected,
    error,
    winner,
  } = useGameSocket(gameId);

  const showLoading = !gameState;

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-6 relative">
      {/* Ambient background glow */}
      <div className="absolute top-20 left-1/3 w-80 h-80 bg-red-500/5 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute top-60 right-1/4 w-64 h-64 bg-purple-500/4 rounded-full blur-[100px] pointer-events-none" />

      {/* Back link */}
      <motion.div
        initial={{ opacity: 0, x: -10 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.4 }}
      >
        <Link
          href="/games"
          className="group inline-flex items-center gap-2 text-sm text-gray-500 hover:text-white transition-all duration-300 mb-6 py-1.5 px-3 -ml-3 rounded-xl hover:bg-white/[0.04]"
        >
          <motion.span
            className="inline-flex"
            whileHover={{ x: -3 }}
            transition={{ type: "spring", stiffness: 400, damping: 20 }}
          >
            <ArrowLeft className="h-4 w-4 transition-transform duration-300 group-hover:-translate-x-0.5" />
          </motion.span>
          <span className="relative">
            Back to Games
            <span className="absolute bottom-0 left-0 w-0 h-[1px] bg-gradient-to-r from-gray-400 to-transparent group-hover:w-full transition-all duration-300" />
          </span>
        </Link>
      </motion.div>

      {/* Page title */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.1 }}
        className="mb-8"
      >
        <h1 className="text-2xl font-black text-white tracking-tight flex items-center gap-2">
          Game{" "}
          <span className="neon-red font-mono text-xl">
            #{gameId.split("-").pop() || gameId.slice(-6)}
          </span>
          {connected && (
            <motion.span
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              className="inline-flex items-center gap-1.5 ml-3 px-2.5 py-1 rounded-full glass-card text-[10px] font-bold text-green-400 uppercase tracking-widest"
            >
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-green-400 shadow-[0_0_6px_rgba(34,197,94,0.8)]" />
              </span>
              Live
            </motion.span>
          )}
        </h1>
        <div className="mt-3 h-[1px] bg-gradient-to-r from-red-500/30 via-purple-500/15 to-transparent" />
      </motion.div>

      {showLoading ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="flex flex-col items-center justify-center py-32 relative"
        >
          {/* Background pulse */}
          <div className="absolute w-40 h-40 bg-red-500/5 rounded-full blur-[60px] animate-pulse" />

          {error ? (
            <>
              <div className="relative glass-card rounded-full p-4">
                <WifiOff className="h-8 w-8 text-gray-500" />
              </div>
              <p className="text-sm text-gray-400 mt-6 font-medium">
                Unable to connect to game
              </p>
              <p className="text-xs text-gray-600 mt-2">
                {error}
              </p>
            </>
          ) : (
            <>
              <div className="relative">
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
                  className="relative"
                >
                  <div className="absolute inset-0 rounded-full bg-red-500/20 blur-lg animate-pulse-glow" />
                  <div className="relative glass-card rounded-full p-4 glow-red">
                    <Loader2 className="h-8 w-8 neon-red" />
                  </div>
                </motion.div>
              </div>

              <motion.p
                animate={{ opacity: [0.5, 1, 0.5] }}
                transition={{ duration: 2, repeat: Infinity }}
                className="text-sm text-gray-400 mt-6 font-medium"
              >
                Connecting to game server...
              </motion.p>
              <p className="text-xs text-gray-600 mt-2 font-mono">
                Game{" "}
                <span className="text-gray-500">
                  {gameId.slice(0, 12)}...
                </span>
              </p>

              {/* Loading bar */}
              <div className="mt-6 w-48 h-1 rounded-full bg-gray-800/80 overflow-hidden">
                <motion.div
                  className="h-full rounded-full bg-gradient-to-r from-red-500/60 to-red-400/40"
                  animate={{ x: ["-100%", "100%"] }}
                  transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
                  style={{ width: "40%" }}
                />
              </div>
            </>
          )}
        </motion.div>
      ) : (
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.23, 1, 0.32, 1] }}
          className="grid grid-cols-1 xl:grid-cols-4 gap-6"
        >
          {/* Main game viewer */}
          <div className="xl:col-span-3">
            <GameViewer
              gameState={gameState}
              messages={messages}
              phase={phase || "lobby"}
              players={players}
              timeRemaining={timeRemaining}
              connected={connected}
              error={error}
              winner={winner}
            />
          </div>

          {/* Betting sidebar */}
          <div className="xl:col-span-1">
            <BettingPanel
              gameId={gameId}
              players={players}
              odds={null}
              activeBets={[]}
            />
          </div>
        </motion.div>
      )}
    </div>
  );
}
