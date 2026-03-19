"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getTournaments } from "@/lib/api";
import { Swords, Users, Trophy, Clock, Coins } from "lucide-react";
import { motion } from "framer-motion";

interface Tournament {
  id: string;
  name: string;
  entryFee: string;
  prizePool: string;
  maxParticipants: number;
  participantCount: number;
  currentRound: number;
  totalRounds: number;
  status: string;
  registrationDeadline: number;
  arenaType: number;
}

export default function TournamentsPage() {
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const data = await getTournaments();
        setTournaments(data);
      } catch {
        // API may not be running yet
      } finally {
        setLoading(false);
      }
    };
    fetchData();
    const interval = setInterval(fetchData, 10000);
    return () => clearInterval(interval);
  }, []);

  const statusColor = (status: string) => {
    switch (status) {
      case "Registration": return "text-green-400 bg-green-500/10 border-green-500/20";
      case "Active": return "text-orange-400 bg-orange-500/10 border-orange-500/20";
      case "Completed": return "text-blue-400 bg-blue-500/10 border-blue-500/20";
      case "Cancelled": return "text-red-400 bg-red-500/10 border-red-500/20";
      default: return "text-gray-400 bg-gray-500/10 border-gray-500/20";
    }
  };

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="font-pixel text-2xl text-white mb-2">
          <span className="text-claw-red">TOURNAMENT</span> ARENA
        </h1>
        <p className="text-gray-400 text-sm">
          Single-elimination brackets. Entry fees. Prize pools. Glory.
        </p>
      </div>

      {/* Stats Bar */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        {[
          { label: "Active", value: tournaments.filter(t => t.status === "Active" || t.status === "Registration").length, icon: Swords },
          { label: "Total", value: tournaments.length, icon: Trophy },
          { label: "Players", value: tournaments.reduce((sum, t) => sum + t.participantCount, 0), icon: Users },
          { label: "Prize Pool", value: `${(tournaments.reduce((sum, t) => sum + Number(t.prizePool || 0), 0) / 1e18).toFixed(2)} ETH`, icon: Coins },
        ].map((stat, i) => (
          <div key={i} className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-4">
            <div className="flex items-center gap-2 text-gray-400 text-xs mb-1">
              <stat.icon className="w-3.5 h-3.5" />
              {stat.label}
            </div>
            <div className="text-white font-semibold text-lg">{stat.value}</div>
          </div>
        ))}
      </div>

      {/* Tournament List */}
      {loading ? (
        <div className="text-center py-20 text-gray-500">Loading tournaments...</div>
      ) : tournaments.length === 0 ? (
        <div className="text-center py-20">
          <Swords className="w-12 h-12 text-gray-600 mx-auto mb-4" />
          <p className="text-gray-400 mb-2">No tournaments yet</p>
          <p className="text-gray-600 text-sm">Tournaments will appear here when created by the operator</p>
        </div>
      ) : (
        <div className="grid gap-4">
          {tournaments.map((t, i) => (
            <motion.div
              key={t.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
            >
              <Link href={`/tournaments/${t.id}`}>
                <div className="group bg-white/[0.03] hover:bg-white/[0.05] border border-white/[0.06] hover:border-white/[0.1] rounded-xl p-5 transition-all duration-300 cursor-pointer">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <Swords className="w-5 h-5 text-claw-red" />
                      <h3 className="text-white font-semibold">{t.name}</h3>
                    </div>
                    <span className={`text-xs px-2.5 py-1 rounded-full border ${statusColor(t.status)}`}>
                      {t.status}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-5 gap-3 text-sm">
                    <div>
                      <div className="text-gray-500 text-xs">Entry Fee</div>
                      <div className="text-white">{(Number(t.entryFee) / 1e18).toFixed(2)} ETH</div>
                    </div>
                    <div>
                      <div className="text-gray-500 text-xs">Prize Pool</div>
                      <div className="text-green-400">{(Number(t.prizePool) / 1e18).toFixed(2)} ETH</div>
                    </div>
                    <div>
                      <div className="text-gray-500 text-xs">Players</div>
                      <div className="text-white">{t.participantCount}/{t.maxParticipants}</div>
                    </div>
                    <div>
                      <div className="text-gray-500 text-xs">Round</div>
                      <div className="text-white">{t.currentRound}/{t.totalRounds}</div>
                    </div>
                    <div>
                      <div className="text-gray-500 text-xs">Format</div>
                      <div className="text-white">{t.maxParticipants}-player bracket</div>
                    </div>
                  </div>

                  {t.status === "Registration" && (
                    <div className="mt-3 flex items-center gap-2 text-xs text-gray-400">
                      <Clock className="w-3 h-3" />
                      Registration closes {new Date(t.registrationDeadline).toLocaleString()}
                    </div>
                  )}
                </div>
              </Link>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
