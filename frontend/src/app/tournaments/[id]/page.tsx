"use client";

import { useEffect, useState, useMemo } from "react";
import { useParams } from "next/navigation";
import { getTournament } from "@/lib/api";
import { Swords, Trophy, Users, Coins, ArrowRight } from "lucide-react";
import { motion } from "framer-motion";
import { useEnsNames } from "@/hooks/useEnsName";

interface Match {
  round: number;
  matchIndex: number;
  player1: string;
  player2: string;
  winner: string | null;
  gameId: string | null;
  completed: boolean;
}

interface TournamentState {
  id: string;
  name: string;
  entryFee: string;
  prizePool: string;
  maxParticipants: number;
  participantCount: number;
  currentRound: number;
  totalRounds: number;
  status: string;
  arenaType: number;
  participants: string[];
  bracket: Match[];
  placements: Record<string, string>;
}

function shortAddr(addr: string, ensName?: string | null): string {
  if (!addr) return "TBD";
  if (ensName) return ensName;
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

export default function TournamentDetailPage() {
  const params = useParams();
  const [tournament, setTournament] = useState<TournamentState | null>(null);
  const [loading, setLoading] = useState(true);

  // Collect all addresses for ENS batch resolution
  const allAddresses = useMemo(() => {
    if (!tournament) return [];
    const addrs = new Set<string>(tournament.participants);
    for (const match of tournament.bracket) {
      if (match.player1) addrs.add(match.player1);
      if (match.player2) addrs.add(match.player2);
      if (match.winner) addrs.add(match.winner);
    }
    if (tournament.placements) {
      Object.values(tournament.placements).forEach((a) => { if (a) addrs.add(a); });
    }
    return Array.from(addrs);
  }, [tournament]);
  const { ensNames } = useEnsNames(allAddresses);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const data = await getTournament(params.id as string);
        setTournament(data);
      } catch {
        // Tournament may not exist
      } finally {
        setLoading(false);
      }
    };
    fetchData();
    const interval = setInterval(fetchData, 5000);
    return () => clearInterval(interval);
  }, [params.id]);

  if (loading) return <div className="text-center py-20 text-gray-500">Loading tournament...</div>;
  if (!tournament) return <div className="text-center py-20 text-gray-500">Tournament not found</div>;

  // Group matches by round
  const roundMatches = new Map<number, Match[]>();
  for (const match of tournament.bracket) {
    if (!roundMatches.has(match.round)) roundMatches.set(match.round, []);
    roundMatches.get(match.round)!.push(match);
  }

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <Swords className="w-6 h-6 text-claw-red" />
          <h1 className="font-pixel text-xl text-white">{tournament.name}</h1>
          <span className={`text-xs px-2.5 py-1 rounded-full border ${
            tournament.status === "Active" ? "text-orange-400 bg-orange-500/10 border-orange-500/20" :
            tournament.status === "Completed" ? "text-blue-400 bg-blue-500/10 border-blue-500/20" :
            "text-green-400 bg-green-500/10 border-green-500/20"
          }`}>
            {tournament.status}
          </span>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-4">
          <div className="flex items-center gap-2 text-gray-400 text-xs mb-1"><Coins className="w-3.5 h-3.5" />Prize Pool</div>
          <div className="text-green-400 font-semibold text-lg">{(Number(tournament.prizePool) / 1e18).toFixed(2)} ETH</div>
        </div>
        <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-4">
          <div className="flex items-center gap-2 text-gray-400 text-xs mb-1"><Users className="w-3.5 h-3.5" />Players</div>
          <div className="text-white font-semibold text-lg">{tournament.participantCount}/{tournament.maxParticipants}</div>
        </div>
        <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-4">
          <div className="flex items-center gap-2 text-gray-400 text-xs mb-1"><Swords className="w-3.5 h-3.5" />Round</div>
          <div className="text-white font-semibold text-lg">{tournament.currentRound}/{tournament.totalRounds}</div>
        </div>
        <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-4">
          <div className="flex items-center gap-2 text-gray-400 text-xs mb-1"><Trophy className="w-3.5 h-3.5" />Entry Fee</div>
          <div className="text-white font-semibold text-lg">{(Number(tournament.entryFee) / 1e18).toFixed(2)} ETH</div>
        </div>
      </div>

      {/* Placements (if completed) */}
      {tournament.status === "Completed" && tournament.placements && (
        <div className="mb-8">
          <h2 className="font-pixel text-sm text-gray-300 mb-4">FINAL STANDINGS</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[1, 2, 3, 4].map((place) => {
              const addr = tournament.placements[String(place)];
              const colors = place === 1 ? "border-yellow-500/30 bg-yellow-500/5" :
                            place === 2 ? "border-gray-400/30 bg-gray-400/5" :
                            "border-orange-700/30 bg-orange-700/5";
              const medal = place === 1 ? "🥇" : place === 2 ? "🥈" : place === 3 ? "🥉" : "4th";
              return (
                <div key={place} className={`border rounded-xl p-4 ${colors}`}>
                  <div className="text-2xl mb-1">{medal}</div>
                  <div className="text-white text-sm font-mono">{addr ? shortAddr(addr, ensNames[addr.toLowerCase()]) : "—"}</div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Bracket Visualization */}
      <h2 className="font-pixel text-sm text-gray-300 mb-4">BRACKET</h2>

      {tournament.bracket.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          <p>Bracket will be generated when the tournament starts</p>
        </div>
      ) : (
        <div className="overflow-x-auto pb-4">
          <div className="flex gap-8 min-w-max">
            {Array.from(roundMatches.entries()).sort(([a], [b]) => a - b).map(([round, matches]) => (
              <div key={round} className="flex flex-col gap-4">
                <div className="text-center text-xs text-gray-400 font-pixel mb-2">
                  {round === tournament.totalRounds ? "FINAL" : `ROUND ${round}`}
                </div>
                <div className="flex flex-col justify-around gap-4" style={{ minHeight: `${matches.length * 100}px` }}>
                  {matches.sort((a, b) => a.matchIndex - b.matchIndex).map((match) => (
                    <motion.div
                      key={`${match.round}-${match.matchIndex}`}
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className={`bg-white/[0.03] border rounded-xl p-3 w-56 ${
                        match.completed ? "border-white/[0.08]" : "border-white/[0.04]"
                      }`}
                    >
                      {/* Player 1 */}
                      <div className={`flex items-center justify-between py-1.5 px-2 rounded-lg text-sm ${
                        match.winner === match.player1 ? "bg-green-500/10 text-green-400" :
                        match.completed && match.winner !== match.player1 ? "text-gray-600 line-through" :
                        "text-white"
                      }`}>
                        <span className="font-mono text-xs">{shortAddr(match.player1, ensNames[match.player1?.toLowerCase()])}</span>
                        {match.winner === match.player1 && <Trophy className="w-3.5 h-3.5" />}
                      </div>

                      <div className="text-center text-gray-600 text-xs py-0.5">vs</div>

                      {/* Player 2 */}
                      <div className={`flex items-center justify-between py-1.5 px-2 rounded-lg text-sm ${
                        match.winner === match.player2 ? "bg-green-500/10 text-green-400" :
                        match.completed && match.winner !== match.player2 ? "text-gray-600 line-through" :
                        "text-white"
                      }`}>
                        <span className="font-mono text-xs">{shortAddr(match.player2, ensNames[match.player2?.toLowerCase()])}</span>
                        {match.winner === match.player2 && <Trophy className="w-3.5 h-3.5" />}
                      </div>

                      {match.gameId && (
                        <div className="mt-2 text-center">
                          <a href={`/games/${match.gameId}`} className="text-xs text-claw-red hover:underline flex items-center justify-center gap-1">
                            Watch Game <ArrowRight className="w-3 h-3" />
                          </a>
                        </div>
                      )}
                    </motion.div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Participants */}
      <h2 className="font-pixel text-sm text-gray-300 mb-4 mt-8">PARTICIPANTS ({tournament.participantCount})</h2>
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-2">
        {tournament.participants.map((addr, i) => (
          <div key={i} className="bg-white/[0.03] border border-white/[0.06] rounded-lg p-2 text-center">
            <div className="text-xs font-mono text-gray-300">{shortAddr(addr, ensNames[addr.toLowerCase()])}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
