"use client";

import { useEffect, useState, useCallback } from "react";
import {
  getAutonomousStatus,
  startAutonomousSession,
  stopAutonomousSession,
  getAutonomousLogs,
  startDemoSimulation,
  getDemoStatus,
} from "@/lib/api";
import { shortenAddress } from "@/lib/utils";
import {
  Bot,
  Play,
  Square,
  Activity,
  Trophy,
  Clock,
  Zap,
  ScrollText,
  Sparkles,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface AgentStatus {
  name: string;
  address: string;
  erc8004Id: string | null;
  personality: string;
  actionCount: number;
  lastAction: { timestamp: number; action: string; detail: string } | null;
}

interface GameResult {
  gameId: string;
  winner: string;
  rounds: number;
  duration: number;
  agents: number;
}

interface OrchestratorStatus {
  running: boolean;
  gamesPlayed: number;
  gamesPlanned: number;
  uptimeSeconds: number;
  agents: AgentStatus[];
  gameResults: GameResult[];
}

export default function AutonomousPage() {
  const [status, setStatus] = useState<OrchestratorStatus | null>(null);
  const [logs, setLogs] = useState<Record<string, Array<{ timestamp: number; action: string; detail: string }>>>({});
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);
  const [showLogs, setShowLogs] = useState(false);
  const [agentCount, setAgentCount] = useState(6);
  const [gamesCount, setGamesCount] = useState(3);
  const [demoState, setDemoState] = useState<{
    running: boolean;
    phase: string;
    events: Array<{ timestamp: number; phase: string; event: string; detail: string; agentName?: string }>;
    agents: Array<{ name: string; address: string; personality: string; actions: number; services: number; memory: { totalGames: number; winRate: number } }>;
    winner: string | null;
    elapsed: number;
  } | null>(null);
  const [demoRunning, setDemoRunning] = useState(false);

  const fetchStatus = useCallback(async () => {
    try {
      const data = await getAutonomousStatus();
      setStatus(data);
    } catch {
      setStatus(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStatus();
    const interval = setInterval(fetchStatus, 3000);
    return () => clearInterval(interval);
  }, [fetchStatus]);

  const handleStart = async () => {
    setStarting(true);
    try {
      await startAutonomousSession({
        agentCount,
        gamesPerSession: gamesCount,
      });
      await fetchStatus();
    } catch (err) {
      console.error("Failed to start:", err);
    } finally {
      setStarting(false);
    }
  };

  const handleStop = async () => {
    try {
      await stopAutonomousSession();
      await fetchStatus();
    } catch (err) {
      console.error("Failed to stop:", err);
    }
  };

  const handleViewLogs = async () => {
    try {
      const data = await getAutonomousLogs();
      setLogs(data.logs || {});
      setShowLogs(true);
    } catch (err) {
      console.error("Failed to fetch logs:", err);
    }
  };

  const handleStartDemo = async () => {
    setDemoRunning(true);
    try {
      await startDemoSimulation();
      // Poll demo status
      const pollDemo = setInterval(async () => {
        try {
          const state = await getDemoStatus();
          setDemoState(state);
          if (!state.running) {
            clearInterval(pollDemo);
            setDemoRunning(false);
          }
        } catch {
          clearInterval(pollDemo);
          setDemoRunning(false);
        }
      }, 2000);
    } catch (err) {
      console.error("Failed to start demo:", err);
      setDemoRunning(false);
    }
  };

  const isRunning = status?.running ?? false;

  return (
    <div className="min-h-screen bg-[#030712] text-gray-100">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <div className="flex items-center gap-3 mb-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-red-500/15">
              <Bot className="h-5 w-5 text-red-400" />
            </div>
            <h1 className="text-2xl font-bold tracking-tight">
              Autonomous Arena
            </h1>
            {isRunning && (
              <span className="flex items-center gap-1.5 rounded-full bg-green-500/15 px-3 py-1 text-xs font-medium text-green-400 border border-green-500/20">
                <span className="h-1.5 w-1.5 rounded-full bg-green-400 animate-pulse" />
                Live
              </span>
            )}
          </div>
          <p className="text-sm text-gray-500">
            AI agents create games, play, trade, and build reputation autonomously on Base
          </p>
        </motion.div>

        {/* Controls */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="mb-8 rounded-xl border border-white/[0.06] bg-white/[0.02] p-6"
        >
          <div className="flex flex-wrap items-end gap-6">
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1.5">
                Agents
              </label>
              <select
                value={agentCount}
                onChange={(e) => setAgentCount(Number(e.target.value))}
                disabled={isRunning}
                className="rounded-lg border border-white/[0.08] bg-white/[0.04] px-3 py-2 text-sm text-white disabled:opacity-50"
              >
                {[3, 4, 5, 6, 7, 8].map((n) => (
                  <option key={n} value={n}>
                    {n} agents
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1.5">
                Games
              </label>
              <select
                value={gamesCount}
                onChange={(e) => setGamesCount(Number(e.target.value))}
                disabled={isRunning}
                className="rounded-lg border border-white/[0.08] bg-white/[0.04] px-3 py-2 text-sm text-white disabled:opacity-50"
              >
                {[1, 2, 3, 5, 10].map((n) => (
                  <option key={n} value={n}>
                    {n} game{n > 1 ? "s" : ""}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex gap-3">
              {!isRunning ? (
                <button
                  onClick={handleStart}
                  disabled={starting || loading}
                  className="flex items-center gap-2 rounded-lg bg-red-600 px-5 py-2 text-sm font-semibold text-white hover:bg-red-500 transition-colors disabled:opacity-50"
                >
                  <Play className="h-4 w-4" />
                  {starting ? "Starting..." : "Launch Autonomous Session"}
                </button>
              ) : (
                <button
                  onClick={handleStop}
                  className="flex items-center gap-2 rounded-lg bg-gray-700 px-5 py-2 text-sm font-semibold text-white hover:bg-gray-600 transition-colors"
                >
                  <Square className="h-4 w-4" />
                  Stop
                </button>
              )}
              <button
                onClick={handleStartDemo}
                disabled={demoRunning || isRunning}
                className="flex items-center gap-2 rounded-lg bg-purple-600 px-4 py-2 text-sm font-semibold text-white hover:bg-purple-500 transition-colors disabled:opacity-50"
              >
                <Sparkles className="h-4 w-4" />
                {demoRunning ? "Demo Running..." : "Demo Mode"}
              </button>
              <button
                onClick={handleViewLogs}
                className="flex items-center gap-2 rounded-lg border border-white/[0.08] bg-white/[0.04] px-4 py-2 text-sm font-medium text-gray-300 hover:bg-white/[0.06] transition-colors"
              >
                <ScrollText className="h-4 w-4" />
                View Logs
              </button>
            </div>
          </div>
        </motion.div>

        {/* Stats Grid */}
        {status && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="mb-8 grid grid-cols-2 gap-4 sm:grid-cols-4"
          >
            {[
              {
                label: "Games Played",
                value: `${status.gamesPlayed}/${status.gamesPlanned}`,
                icon: Trophy,
                color: "text-yellow-400",
              },
              {
                label: "Active Agents",
                value: status.agents.length,
                icon: Bot,
                color: "text-blue-400",
              },
              {
                label: "Total Actions",
                value: status.agents.reduce((s, a) => s + a.actionCount, 0),
                icon: Zap,
                color: "text-purple-400",
              },
              {
                label: "Uptime",
                value: `${Math.floor(status.uptimeSeconds / 60)}m ${status.uptimeSeconds % 60}s`,
                icon: Clock,
                color: "text-green-400",
              },
            ].map((stat, i) => (
              <div
                key={stat.label}
                className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4"
              >
                <div className="flex items-center gap-2 mb-2">
                  <stat.icon className={`h-4 w-4 ${stat.color}`} />
                  <span className="text-xs text-gray-500">{stat.label}</span>
                </div>
                <p className="text-xl font-bold">{stat.value}</p>
              </div>
            ))}
          </motion.div>
        )}

        {/* Agent Cards */}
        {status && status.agents.length > 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
            className="mb-8"
          >
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <Activity className="h-4 w-4 text-red-400" />
              Agent Status
            </h2>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {status.agents.map((agent, i) => (
                <motion.div
                  key={agent.name}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 * i }}
                  className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4"
                >
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-red-500/15 text-xs font-bold text-red-400">
                        {agent.name.split("_")[0]?.slice(0, 2) || "AG"}
                      </div>
                      <div>
                        <p className="text-sm font-semibold">{agent.name}</p>
                        <p className="text-xs text-gray-500 font-mono">
                          {shortenAddress(agent.address)}
                        </p>
                      </div>
                    </div>
                    {agent.erc8004Id && (
                      <span className="rounded-full bg-blue-500/15 px-2 py-0.5 text-[10px] font-medium text-blue-400 border border-blue-500/20">
                        ERC-8004
                      </span>
                    )}
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-gray-500">
                      {agent.actionCount} actions
                    </span>
                    {agent.lastAction && (
                      <span className="text-gray-400 truncate ml-2 max-w-[180px]">
                        {agent.lastAction.action}: {agent.lastAction.detail.slice(0, 40)}
                      </span>
                    )}
                  </div>
                </motion.div>
              ))}
            </div>
          </motion.div>
        )}

        {/* Game Results */}
        {status && status.gameResults.length > 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.4 }}
          >
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <Trophy className="h-4 w-4 text-yellow-400" />
              Game Results
            </h2>
            <div className="rounded-xl border border-white/[0.06] overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/[0.06] bg-white/[0.02]">
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-400">
                      Game
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-400">
                      Winner
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-400">
                      Rounds
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-400">
                      Duration
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-400">
                      Agents
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {status.gameResults.map((game, i) => (
                    <tr
                      key={game.gameId}
                      className="border-b border-white/[0.03] hover:bg-white/[0.02] transition-colors"
                    >
                      <td className="px-4 py-3 font-mono text-xs">
                        {game.gameId.slice(0, 8)}...
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={
                            game.winner === "crewmates"
                              ? "text-green-400"
                              : game.winner === "impostor"
                                ? "text-red-400"
                                : "text-gray-400"
                          }
                        >
                          {game.winner}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-300">{game.rounds}</td>
                      <td className="px-4 py-3 text-gray-300">{game.duration}s</td>
                      <td className="px-4 py-3 text-gray-300">{game.agents}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </motion.div>
        )}

        {/* Empty State */}
        {!loading && (!status || status.agents.length === 0) && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex flex-col items-center justify-center py-20 text-center"
          >
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-white/[0.04] mb-4">
              <Bot className="h-8 w-8 text-gray-600" />
            </div>
            <h3 className="text-lg font-semibold text-gray-400 mb-2">
              No Active Session
            </h3>
            <p className="text-sm text-gray-600 max-w-md">
              Launch an autonomous session to watch AI agents create games, negotiate alliances,
              execute Uniswap trades, and build ERC-8004 reputation on Base.
            </p>
          </motion.div>
        )}

        {/* Demo Event Timeline */}
        {demoState && demoState.events.length > 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
            className="mb-8"
          >
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-purple-400" />
              Demo Simulation
              {demoState.running && (
                <span className="ml-2 flex items-center gap-1.5 rounded-full bg-purple-500/15 px-2.5 py-0.5 text-xs font-medium text-purple-400 border border-purple-500/20">
                  <span className="h-1.5 w-1.5 rounded-full bg-purple-400 animate-pulse" />
                  {demoState.phase}
                </span>
              )}
              {demoState.winner && (
                <span className="ml-2 rounded-full bg-green-500/15 px-2.5 py-0.5 text-xs font-medium text-green-400 border border-green-500/20">
                  {demoState.winner} Win
                </span>
              )}
              <span className="ml-auto text-xs text-gray-500 font-normal">
                {demoState.elapsed}s elapsed
              </span>
            </h2>

            {/* Demo Agents */}
            {demoState.agents.length > 0 && (
              <div className="mb-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                {demoState.agents.map((agent) => (
                  <div
                    key={agent.name}
                    className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-3"
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <div className="flex h-6 w-6 items-center justify-center rounded bg-purple-500/15 text-[10px] font-bold text-purple-400">
                        {agent.name.slice(0, 2)}
                      </div>
                      <span className="text-xs font-semibold">{agent.name}</span>
                    </div>
                    <div className="flex items-center gap-3 text-[10px] text-gray-500">
                      <span>{agent.actions} actions</span>
                      <span>{agent.services} services</span>
                      {agent.memory.totalGames > 0 && (
                        <span>{Math.round(agent.memory.winRate * 100)}% WR</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Event Stream */}
            <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4 max-h-64 overflow-y-auto">
              <div className="space-y-1 font-mono text-xs">
                {demoState.events.slice(-30).map((event, i) => {
                  const phaseColors: Record<string, string> = {
                    init: "text-blue-400",
                    services: "text-purple-400",
                    market: "text-cyan-400",
                    game: "text-yellow-400",
                    gameplay: "text-green-400",
                    results: "text-red-400",
                    memory: "text-orange-400",
                    summary: "text-pink-400",
                    complete: "text-emerald-400",
                    error: "text-red-500",
                  };
                  return (
                    <div
                      key={i}
                      className="flex gap-3 text-gray-400 hover:text-gray-200 transition-colors"
                    >
                      <span className="text-gray-600 shrink-0 w-16">
                        {new Date(event.timestamp).toLocaleTimeString()}
                      </span>
                      <span className={`shrink-0 w-16 ${phaseColors[event.phase] || "text-gray-500"}`}>
                        [{event.phase}]
                      </span>
                      {event.agentName && (
                        <span className="text-purple-400 shrink-0 w-20">
                          {event.agentName}
                        </span>
                      )}
                      <span className="truncate">{event.detail}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </motion.div>
        )}

        {/* Logs Modal */}
        <AnimatePresence>
          {showLogs && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
              onClick={() => setShowLogs(false)}
            >
              <motion.div
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.95, opacity: 0 }}
                className="w-full max-w-4xl max-h-[80vh] rounded-xl border border-white/[0.08] bg-[#0a0e1a] overflow-hidden"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex items-center justify-between border-b border-white/[0.06] px-6 py-4">
                  <h3 className="font-semibold flex items-center gap-2">
                    <ScrollText className="h-4 w-4 text-red-400" />
                    Agent Action Logs
                  </h3>
                  <button
                    onClick={() => setShowLogs(false)}
                    className="text-gray-400 hover:text-white"
                  >
                    Close
                  </button>
                </div>
                <div className="overflow-auto max-h-[calc(80vh-60px)] p-6 space-y-6">
                  {Object.entries(logs).map(([agentName, agentLogs]) => (
                    <div key={agentName}>
                      <h4 className="text-sm font-semibold text-red-400 mb-2">
                        {agentName}
                      </h4>
                      <div className="space-y-1 font-mono text-xs">
                        {agentLogs.slice(-20).map((entry, i) => (
                          <div
                            key={i}
                            className="flex gap-3 text-gray-400 hover:text-gray-200 transition-colors"
                          >
                            <span className="text-gray-600 shrink-0">
                              {new Date(entry.timestamp).toLocaleTimeString()}
                            </span>
                            <span className="text-blue-400 shrink-0 w-20">
                              [{entry.action}]
                            </span>
                            <span className="truncate">{entry.detail}</span>
                          </div>
                        ))}
                        {agentLogs.length === 0 && (
                          <p className="text-gray-600">No actions yet</p>
                        )}
                      </div>
                    </div>
                  ))}
                  {Object.keys(logs).length === 0 && (
                    <p className="text-center text-gray-600">
                      No logs available. Start a session first.
                    </p>
                  )}
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
