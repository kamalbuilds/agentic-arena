"use client";

import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import {
  Gavel,
  Package,
  Shield,
  Eye,
  Users,
  Flame,
  Sparkles,
  RefreshCw,
  TrendingUp,
} from "lucide-react";
import { cn } from "@/lib/utils";

const API_URL =
  typeof window !== "undefined" && window.location.protocol === "https:"
    ? ""
    : process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

function api(endpoint: string): string {
  if (API_URL === "") return `/engine${endpoint}`;
  return `${API_URL}${endpoint}`;
}

interface AuctionItem {
  id: string;
  name: string;
  description: string;
  category: 'power-up' | 'intelligence' | 'alliance' | 'sabotage' | 'wildcard';
  baseValue: string;
}

interface AuctionSession {
  id: string;
  name: string;
  status: 'pending' | 'active' | 'completed';
  auctions: Array<{
    id: string;
    format: 'english' | 'dutch' | 'sealed' | 'vickrey';
    item: AuctionItem;
    status: string;
    currentPrice: string;
    bids: Array<{ agentName: string; amount: string; reasoning: string }>;
    winner?: string;
    winningPrice?: string;
  }>;
}

const CATEGORY_COLORS = {
  'power-up': { bg: 'bg-red-500/10', border: 'border-red-500/20', text: 'text-red-400', badge: 'bg-red-500/20' },
  'intelligence': { bg: 'bg-blue-500/10', border: 'border-blue-500/20', text: 'text-blue-400', badge: 'bg-blue-500/20' },
  'alliance': { bg: 'bg-purple-500/10', border: 'border-purple-500/20', text: 'text-purple-400', badge: 'bg-purple-500/20' },
  'sabotage': { bg: 'bg-orange-500/10', border: 'border-orange-500/20', text: 'text-orange-400', badge: 'bg-orange-500/20' },
  'wildcard': { bg: 'bg-pink-500/10', border: 'border-pink-500/20', text: 'text-pink-400', badge: 'bg-pink-500/20' },
};

const CATEGORY_ICONS = {
  'power-up': Shield,
  'intelligence': Eye,
  'alliance': Users,
  'sabotage': Flame,
  'wildcard': Sparkles,
};

const AUCTION_FORMAT_COLORS = {
  'english': { bg: 'bg-green-500/10', border: 'border-green-500/20', text: 'text-green-400' },
  'dutch': { bg: 'bg-orange-500/10', border: 'border-orange-500/20', text: 'text-orange-400' },
  'sealed': { bg: 'bg-blue-500/10', border: 'border-blue-500/20', text: 'text-blue-400' },
  'vickrey': { bg: 'bg-purple-500/10', border: 'border-purple-500/20', text: 'text-purple-400' },
};

export default function AuctionsPage() {
  const [items, setItems] = useState<AuctionItem[]>([]);
  const [sessions, setSessions] = useState<AuctionSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const [itemsRes, sessionsRes] = await Promise.all([
        fetch(api("/api/arenas/auctions/items")).then(r => r.ok ? r.json() : null),
        fetch(api("/api/arenas/auctions/sessions")).then(r => r.ok ? r.json() : null),
      ]);
      if (itemsRes) setItems(itemsRes.items || itemsRes || []);
      if (sessionsRes) setSessions(sessionsRes.sessions || sessionsRes || []);
    } catch {
      // API might not be running
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 3000);
    return () => clearInterval(interval);
  }, [fetchData]);

  const generateNewItems = async () => {
    setGenerating(true);
    try {
      const res = await fetch(api("/api/arenas/auctions/items?count=5"), {
        method: "GET",
      });
      if (res.ok) {
        await fetchData();
      }
    } catch {
      // Failed to generate
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 pb-20">
      {/* Header */}
      <div className="relative overflow-hidden border-b border-zinc-800">
        <div className="absolute inset-0 bg-gradient-to-br from-amber-900/20 via-transparent to-orange-900/20" />
        <div className="relative max-w-7xl mx-auto px-4 py-12 sm:py-16">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 rounded-lg bg-amber-500/10 border border-amber-500/20">
                <Gavel className="w-6 h-6 text-amber-400" />
              </div>
              <h1 className="text-3xl sm:text-4xl font-bold tracking-tight">
                Auction House
              </h1>
            </div>
            <p className="text-zinc-400 text-lg max-w-2xl">
              Strategic auctions for game power-ups and rare items. English, Dutch, sealed-bid,
              and Vickrey auction formats with AI agent bidding strategies.
            </p>
          </motion.div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-8 space-y-8">
        {/* Controls */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-6"
        >
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div>
              <h2 className="text-xl font-semibold flex items-center gap-2">
                <Package className="w-5 h-5 text-amber-400" />
                Auction Management
              </h2>
              <p className="text-zinc-400 text-sm mt-1">
                Generate new items and manage active auction sessions
              </p>
            </div>
            <button
              onClick={generateNewItems}
              disabled={generating}
              className={cn(
                "flex items-center gap-2 px-4 py-2 rounded-lg transition-colors",
                generating
                  ? "bg-zinc-800 text-zinc-500 cursor-not-allowed"
                  : "bg-amber-600 hover:bg-amber-500 text-white"
              )}
            >
              {generating ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Package className="w-4 h-4" />}
              {generating ? "Generating..." : "Generate New Items"}
            </button>
          </div>
        </motion.div>

        {/* Available Items */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-6"
        >
          <h2 className="text-xl font-semibold mb-6 flex items-center gap-2">
            <Package className="w-5 h-5 text-amber-400" />
            Available Items ({items.length})
          </h2>

          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-4 animate-pulse">
                  <div className="h-5 bg-zinc-800 rounded w-2/3 mb-3" />
                  <div className="h-4 bg-zinc-800 rounded w-full mb-2" />
                  <div className="h-4 bg-zinc-800 rounded w-1/2" />
                </div>
              ))}
            </div>
          ) : items.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {items.map((item) => {
                const categoryColor = CATEGORY_COLORS[item.category];
                const CategoryIcon = CATEGORY_ICONS[item.category];
                return (
                  <motion.div
                    key={item.id}
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className={cn(
                      "rounded-lg border bg-zinc-900/50 p-4 hover:bg-zinc-900/80 transition-colors",
                      categoryColor.border
                    )}
                  >
                    <div className="flex items-start justify-between mb-2">
                      <h3 className="font-semibold text-sm flex-1">{item.name}</h3>
                      <div className={cn("p-1.5 rounded-md ml-2", categoryColor.bg)}>
                        <CategoryIcon className={cn("w-4 h-4", categoryColor.text)} />
                      </div>
                    </div>
                    <p className="text-zinc-400 text-xs mb-3 line-clamp-2">{item.description}</p>
                    <div className="flex items-center justify-between">
                      <span className={cn(
                        "text-xs px-2 py-1 rounded-full",
                        categoryColor.badge
                      )}>
                        {item.category}
                      </span>
                      <span className="font-mono text-xs text-zinc-400">
                        {Number(item.baseValue).toLocaleString()} USDC
                      </span>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-12 text-zinc-400">
              <Package className="w-8 h-8 mx-auto mb-3 opacity-50" />
              <p>No items available. Generate new items to start.</p>
            </div>
          )}
        </motion.div>

        {/* Active Sessions */}
        {sessions.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="space-y-4"
          >
            <h2 className="text-xl font-semibold flex items-center gap-2">
              <Gavel className="w-5 h-5 text-amber-400" />
              Active Sessions ({sessions.filter(s => s.status === 'active').length})
            </h2>

            {sessions.map((session) => (
              <div
                key={session.id}
                className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-6"
              >
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold">{session.name}</h3>
                  <span className={cn(
                    "text-xs px-3 py-1 rounded-full",
                    session.status === 'active' ? "bg-green-500/10 text-green-400" :
                    session.status === 'pending' ? "bg-yellow-500/10 text-yellow-400" :
                    "bg-zinc-800 text-zinc-500"
                  )}>
                    {session.status.charAt(0).toUpperCase() + session.status.slice(1)}
                  </span>
                </div>

                <div className="space-y-4">
                  {session.auctions.map((auction) => {
                    const formatColor = AUCTION_FORMAT_COLORS[auction.format];
                    const categoryColor = CATEGORY_COLORS[auction.item.category];
                    const CategoryIcon = CATEGORY_ICONS[auction.item.category];

                    return (
                      <div
                        key={auction.id}
                        className={cn(
                          "rounded-lg border bg-zinc-950/50 p-4",
                          categoryColor.border
                        )}
                      >
                        <div className="flex items-start justify-between mb-3">
                          <div>
                            <h4 className="font-semibold text-sm">{auction.item.name}</h4>
                            <p className="text-zinc-400 text-xs mt-1">{auction.item.description}</p>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className={cn(
                              "text-xs px-2 py-1 rounded-full",
                              formatColor.bg
                            )}>
                              {auction.format.charAt(0).toUpperCase() + auction.format.slice(1)}
                            </span>
                            <div className={cn("p-1.5 rounded-md", categoryColor.bg)}>
                              <CategoryIcon className={cn("w-3 h-3", categoryColor.text)} />
                            </div>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-3">
                          <div>
                            <span className="text-xs text-zinc-500">Base Value</span>
                            <div className="font-mono text-sm">{Number(auction.item.baseValue).toLocaleString()} USDC</div>
                          </div>
                          <div>
                            <span className="text-xs text-zinc-500">Current Price</span>
                            <div className="font-mono text-sm">{Number(auction.currentPrice).toLocaleString()} USDC</div>
                          </div>
                          <div>
                            <span className="text-xs text-zinc-500">Bids</span>
                            <div className="font-mono text-sm">{auction.bids.length}</div>
                          </div>
                          <div>
                            <span className="text-xs text-zinc-500">Status</span>
                            <div className="font-mono text-sm capitalize">{auction.status}</div>
                          </div>
                        </div>

                        {auction.winner && (
                          <div className="bg-green-500/5 border border-green-500/20 rounded p-2 mb-3">
                            <div className="text-xs text-green-400">
                              <strong>{auction.winner}</strong> won at {Number(auction.winningPrice).toLocaleString()} USDC
                            </div>
                          </div>
                        )}

                        {auction.bids.length > 0 && (
                          <div className="space-y-2">
                            <span className="text-xs text-zinc-500">Bidding Activity</span>
                            <div className="space-y-1 max-h-40 overflow-y-auto">
                              {auction.bids.slice(-3).map((bid, idx) => (
                                <div key={idx} className="text-xs bg-zinc-950 rounded p-2 border border-zinc-800">
                                  <div className="flex justify-between mb-1">
                                    <span className="text-zinc-300 font-mono">{bid.agentName}</span>
                                    <span className="text-zinc-400">{Number(bid.amount).toLocaleString()} USDC</span>
                                  </div>
                                  <div className="text-zinc-500 italic truncate">{bid.reasoning}</div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </motion.div>
        )}

        {/* Empty State */}
        {!loading && sessions.length === 0 && items.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-12 text-center"
          >
            <Gavel className="w-12 h-12 mx-auto mb-4 text-zinc-600" />
            <h3 className="text-lg font-semibold mb-2">No Active Auctions</h3>
            <p className="text-zinc-400">
              Auctions will appear here when agents start bidding on items.
            </p>
          </motion.div>
        )}
      </div>
    </div>
  );
}
