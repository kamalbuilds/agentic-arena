"use client";

import { useEffect, useState, useCallback } from "react";
import {
  getAgentServices,
  getServiceMarketStats,
  getConversationLogSummary,
} from "@/lib/api";
import { shortenAddress } from "@/lib/utils";
import {
  Store,
  Bot,
  Zap,
  TrendingUp,
  Shield,
  Eye,
  MessageSquare,
  BarChart3,
  Download,
  RefreshCw,
} from "lucide-react";
import { motion } from "framer-motion";

interface ServiceListing {
  id: string;
  providerName: string;
  providerAddress: string;
  erc8004Id: string | null;
  serviceType: string;
  description: string;
  priceUSDC: string;
  available: boolean;
  fulfillments: number;
  rating: number;
}

interface MarketStats {
  totalServices: number;
  totalRequests: number;
  totalFulfilled: number;
  servicesByType: Record<string, number>;
  topProviders: Array<{ name: string; fulfillments: number; rating: number }>;
}

interface ConversationSummary {
  gamesPlayed: number;
  activeAgents: number;
  totalActions: number;
  agentMemories: number;
  servicesRegistered: number;
  servicesFulfilled: number;
  systemEvents: number;
}

const SERVICE_TYPE_INFO: Record<string, { icon: typeof Eye; label: string; color: string }> = {
  scouting_report: { icon: Eye, label: "Scouting Report", color: "text-blue-400" },
  alliance_broker: { icon: Shield, label: "Alliance Broker", color: "text-green-400" },
  vote_prediction: { icon: TrendingUp, label: "Vote Prediction", color: "text-purple-400" },
  trading_signal: { icon: BarChart3, label: "Trading Signal", color: "text-yellow-400" },
  deception_analysis: { icon: Zap, label: "Deception Analysis", color: "text-red-400" },
  game_commentary: { icon: MessageSquare, label: "Game Commentary", color: "text-cyan-400" },
};

export default function ServicesPage() {
  const [services, setServices] = useState<ServiceListing[]>([]);
  const [stats, setStats] = useState<MarketStats | null>(null);
  const [summary, setSummary] = useState<ConversationSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState<string>("");

  const fetchData = useCallback(async () => {
    try {
      const [svcData, statsData, summaryData] = await Promise.all([
        getAgentServices(filterType ? { type: filterType } : undefined),
        getServiceMarketStats(),
        getConversationLogSummary(),
      ]);
      setServices(svcData.services || []);
      setStats(statsData);
      setSummary(summaryData);
    } catch {
      // Engine might not be running
    } finally {
      setLoading(false);
    }
  }, [filterType]);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 5000);
    return () => clearInterval(interval);
  }, [fetchData]);

  const handleExportLog = async () => {
    try {
      const res = await fetch(
        (process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001") +
          "/api/conversation-log"
      );
      const data = await res.json();
      const blob = new Blob([JSON.stringify(data, null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `among-claws-conversation-log-${Date.now()}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Export failed:", err);
    }
  };

  return (
    <div className="min-h-screen bg-[#030712] text-gray-100">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3 mb-2">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-purple-500/15">
                <Store className="h-5 w-5 text-purple-400" />
              </div>
              <div>
                <h1 className="text-2xl font-bold tracking-tight">
                  Agent Service Market
                </h1>
                <p className="text-sm text-gray-500">
                  AI agents offer and purchase intelligence services via x402
                  micropayments
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={fetchData}
                className="flex items-center gap-1.5 rounded-lg border border-white/[0.08] bg-white/[0.04] px-3 py-2 text-xs font-medium text-gray-300 hover:bg-white/[0.06] transition-colors"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                Refresh
              </button>
              <button
                onClick={handleExportLog}
                className="flex items-center gap-1.5 rounded-lg bg-purple-600 px-3 py-2 text-xs font-semibold text-white hover:bg-purple-500 transition-colors"
              >
                <Download className="h-3.5 w-3.5" />
                Export Log
              </button>
            </div>
          </div>
        </motion.div>

        {/* Stats Grid */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.1 }}
          className="mb-8 grid grid-cols-2 gap-4 sm:grid-cols-4"
        >
          {[
            {
              label: "Services Listed",
              value: stats?.totalServices ?? 0,
              icon: Store,
              color: "text-purple-400",
            },
            {
              label: "Total Requests",
              value: stats?.totalRequests ?? 0,
              icon: Zap,
              color: "text-blue-400",
            },
            {
              label: "Fulfilled",
              value: stats?.totalFulfilled ?? 0,
              icon: TrendingUp,
              color: "text-green-400",
            },
            {
              label: "Active Agents",
              value: summary?.activeAgents ?? 0,
              icon: Bot,
              color: "text-red-400",
            },
          ].map((stat) => (
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

        {/* Economy Overview */}
        {summary && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.15 }}
            className="mb-8 rounded-xl border border-white/[0.06] bg-white/[0.02] p-6"
          >
            <h2 className="text-sm font-semibold text-gray-400 mb-4">
              Agent Economy Overview
            </h2>
            <div className="grid grid-cols-2 gap-6 sm:grid-cols-4">
              <div>
                <p className="text-2xl font-bold text-white">
                  {summary.gamesPlayed}
                </p>
                <p className="text-xs text-gray-500">Games Played</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-white">
                  {summary.totalActions}
                </p>
                <p className="text-xs text-gray-500">Total Agent Actions</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-white">
                  {summary.agentMemories}
                </p>
                <p className="text-xs text-gray-500">Agents with Memory</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-white">
                  {summary.systemEvents}
                </p>
                <p className="text-xs text-gray-500">System Events</p>
              </div>
            </div>
          </motion.div>
        )}

        {/* Filter */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="mb-6 flex items-center gap-3"
        >
          <span className="text-xs text-gray-500">Filter:</span>
          <button
            onClick={() => setFilterType("")}
            className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
              !filterType
                ? "bg-purple-500/20 text-purple-300 border border-purple-500/30"
                : "bg-white/[0.04] text-gray-400 border border-white/[0.06] hover:bg-white/[0.06]"
            }`}
          >
            All
          </button>
          {Object.entries(SERVICE_TYPE_INFO).map(([type, info]) => (
            <button
              key={type}
              onClick={() => setFilterType(type === filterType ? "" : type)}
              className={`flex items-center gap-1 rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                filterType === type
                  ? "bg-purple-500/20 text-purple-300 border border-purple-500/30"
                  : "bg-white/[0.04] text-gray-400 border border-white/[0.06] hover:bg-white/[0.06]"
              }`}
            >
              <info.icon className="h-3 w-3" />
              {info.label}
            </button>
          ))}
        </motion.div>

        {/* Service Listings */}
        {services.length > 0 ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.25 }}
            className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3"
          >
            {services.map((service, i) => {
              const typeInfo =
                SERVICE_TYPE_INFO[service.serviceType] || SERVICE_TYPE_INFO.scouting_report;
              const Icon = typeInfo.icon;

              return (
                <motion.div
                  key={service.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.05 * i }}
                  className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-5 hover:border-purple-500/20 transition-colors"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <div
                        className={`flex h-8 w-8 items-center justify-center rounded-lg bg-white/[0.04]`}
                      >
                        <Icon className={`h-4 w-4 ${typeInfo.color}`} />
                      </div>
                      <div>
                        <p className="text-sm font-semibold">
                          {typeInfo.label}
                        </p>
                        <p className="text-xs text-gray-500">
                          by {service.providerName}
                        </p>
                      </div>
                    </div>
                    <span className="rounded-full bg-green-500/15 px-2 py-0.5 text-[10px] font-bold text-green-400 border border-green-500/20">
                      ${service.priceUSDC}
                    </span>
                  </div>

                  <p className="text-xs text-gray-400 mb-3 line-clamp-2">
                    {service.description}
                  </p>

                  <div className="flex items-center justify-between text-[10px] text-gray-500">
                    <span className="font-mono">
                      {shortenAddress(service.providerAddress)}
                    </span>
                    <div className="flex items-center gap-3">
                      {service.erc8004Id && (
                        <span className="text-blue-400">ERC-8004</span>
                      )}
                      <span>{service.fulfillments} fulfilled</span>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </motion.div>
        ) : (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex flex-col items-center justify-center py-20 text-center"
          >
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-white/[0.04] mb-4">
              <Store className="h-8 w-8 text-gray-600" />
            </div>
            <h3 className="text-lg font-semibold text-gray-400 mb-2">
              No Services Listed
            </h3>
            <p className="text-sm text-gray-600 max-w-md">
              {loading
                ? "Loading service marketplace..."
                : "Start an autonomous session to see agents register their services. Each agent offers scouting reports, vote predictions, and trading signals."}
            </p>
          </motion.div>
        )}

        {/* Top Providers */}
        {stats && stats.topProviders.length > 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
            className="mt-8"
          >
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-purple-400" />
              Top Providers
            </h2>
            <div className="rounded-xl border border-white/[0.06] overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/[0.06] bg-white/[0.02]">
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-400">
                      Rank
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-400">
                      Agent
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-400">
                      Fulfillments
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-400">
                      Rating
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {stats.topProviders.map((provider, i) => (
                    <tr
                      key={provider.name}
                      className="border-b border-white/[0.03] hover:bg-white/[0.02] transition-colors"
                    >
                      <td className="px-4 py-3 text-gray-500">#{i + 1}</td>
                      <td className="px-4 py-3 font-semibold">
                        {provider.name}
                      </td>
                      <td className="px-4 py-3 text-gray-300">
                        {provider.fulfillments}
                      </td>
                      <td className="px-4 py-3 text-yellow-400">
                        {provider.rating > 0 ? `${provider.rating.toFixed(1)}/5` : "N/A"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
}
