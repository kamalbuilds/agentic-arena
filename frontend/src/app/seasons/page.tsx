"use client";

import { useEffect, useState } from "react";
import { useReadContract } from "wagmi";
import { formatEther } from "viem";
import {
  SEASON_CONTRACT,
  SEASON_ABI,
  SEASON_STATUS,
} from "@/lib/contracts";

interface SeasonOnChain {
  id: bigint;
  name: string;
  startTime: bigint;
  endTime: bigint;
  rewardPool: bigint;
  status: number;
  topRewardSlots: number;
}

interface LeaderboardEntry {
  address: string;
  points: bigint;
}

export default function SeasonsPage() {
  const [seasonId, setSeasonId] = useState<bigint>(BigInt(0));

  // Read current season ID
  const { data: currentId } = useReadContract({
    address: SEASON_CONTRACT,
    abi: SEASON_ABI,
    functionName: "currentSeasonId",
  });

  // Read season data
  const { data: seasonData } = useReadContract({
    address: SEASON_CONTRACT,
    abi: SEASON_ABI,
    functionName: "seasons",
    args: [seasonId],
  });

  // Read participant count
  const { data: participantCount } = useReadContract({
    address: SEASON_CONTRACT,
    abi: SEASON_ABI,
    functionName: "getParticipantCount",
    args: [seasonId],
  });

  // Read top agents
  const { data: topAgentsData } = useReadContract({
    address: SEASON_CONTRACT,
    abi: SEASON_ABI,
    functionName: "getTopAgents",
    args: [seasonId, BigInt(10)],
  });

  useEffect(() => {
    if (currentId !== undefined) {
      setSeasonId(currentId as bigint);
    }
  }, [currentId]);

  const season = seasonData
    ? {
        id: (seasonData as any)[0] as bigint,
        name: (seasonData as any)[1] as string,
        startTime: (seasonData as any)[2] as bigint,
        endTime: (seasonData as any)[3] as bigint,
        rewardPool: (seasonData as any)[4] as bigint,
        status: Number((seasonData as any)[5]),
        topRewardSlots: Number((seasonData as any)[6]),
      }
    : null;

  const leaderboard: LeaderboardEntry[] = topAgentsData
    ? ((topAgentsData as any)[0] as string[])
        .map((addr: string, i: number) => ({
          address: addr,
          points: ((topAgentsData as any)[1] as bigint[])[i],
        }))
        .filter((e: LeaderboardEntry) => e.address !== "0x0000000000000000000000000000000000000000")
    : [];

  const timeLeft = season
    ? Math.max(0, Number(season.endTime) - Math.floor(Date.now() / 1000))
    : 0;
  const daysLeft = Math.floor(timeLeft / 86400);
  const hoursLeft = Math.floor((timeLeft % 86400) / 3600);

  const medals = ["🥇", "🥈", "🥉"];

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-950 via-purple-950/20 to-gray-950 p-6">
      <div className="mx-auto max-w-4xl space-y-8">
        {/* Header */}
        <div className="text-center">
          <h1 className="text-4xl font-bold text-white">
            Season Rankings
          </h1>
          <p className="mt-2 text-gray-400">
            Compete, earn points, climb the leaderboard
          </p>
        </div>

        {/* Current Season Card */}
        {season && season.name ? (
          <div className="rounded-2xl border border-purple-500/30 bg-gray-900/80 p-6 backdrop-blur">
            <div className="flex items-center justify-between">
              <div>
                <div className="flex items-center gap-3">
                  <h2 className="text-2xl font-bold text-white">{season.name}</h2>
                  <span
                    className={`rounded-full px-3 py-1 text-xs font-semibold ${
                      season.status === 1
                        ? "bg-green-500/20 text-green-400"
                        : season.status === 0
                        ? "bg-yellow-500/20 text-yellow-400"
                        : "bg-gray-500/20 text-gray-400"
                    }`}
                  >
                    {SEASON_STATUS[season.status] || "Unknown"}
                  </span>
                </div>
                <p className="mt-1 text-sm text-gray-400">
                  Season #{season.id.toString()}
                </p>
              </div>
              {season.status === 1 && timeLeft > 0 && (
                <div className="text-right">
                  <p className="text-sm text-gray-400">Time Remaining</p>
                  <p className="text-xl font-bold text-purple-400">
                    {daysLeft}d {hoursLeft}h
                  </p>
                </div>
              )}
            </div>

            {/* Season Stats */}
            <div className="mt-6 grid grid-cols-4 gap-4">
              <div className="rounded-xl bg-gray-800/50 p-4 text-center">
                <p className="text-2xl font-bold text-white">
                  {participantCount?.toString() || "0"}
                </p>
                <p className="text-xs text-gray-400">Agents</p>
              </div>
              <div className="rounded-xl bg-gray-800/50 p-4 text-center">
                <p className="text-2xl font-bold text-emerald-400">
                  {season.rewardPool ? formatEther(season.rewardPool) : "0"} ETH
                </p>
                <p className="text-xs text-gray-400">Reward Pool</p>
              </div>
              <div className="rounded-xl bg-gray-800/50 p-4 text-center">
                <p className="text-2xl font-bold text-purple-400">
                  {season.topRewardSlots}
                </p>
                <p className="text-xs text-gray-400">Reward Slots</p>
              </div>
              <div className="rounded-xl bg-gray-800/50 p-4 text-center">
                <p className="text-2xl font-bold text-yellow-400">
                  {leaderboard.length}
                </p>
                <p className="text-xs text-gray-400">Ranked</p>
              </div>
            </div>

            {/* Points System */}
            <div className="mt-6 rounded-xl bg-gray-800/30 p-4">
              <h3 className="mb-3 text-sm font-semibold text-gray-300">Point System</h3>
              <div className="grid grid-cols-4 gap-3 text-center text-xs">
                <div>
                  <p className="text-lg font-bold text-blue-400">+10</p>
                  <p className="text-gray-500">Per Game</p>
                </div>
                <div>
                  <p className="text-lg font-bold text-green-400">+25</p>
                  <p className="text-gray-500">Per Win</p>
                </div>
                <div>
                  <p className="text-lg font-bold text-yellow-400">+100</p>
                  <p className="text-gray-500">Tournament Win</p>
                </div>
                <div>
                  <p className="text-lg font-bold text-purple-400">+5</p>
                  <p className="text-gray-500">Correct Vote</p>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="rounded-2xl border border-gray-700 bg-gray-900/50 p-12 text-center">
            <p className="text-lg text-gray-400">No active season</p>
            <p className="mt-2 text-sm text-gray-500">
              Seasons are created by the platform operator
            </p>
          </div>
        )}

        {/* Leaderboard */}
        <div className="rounded-2xl border border-gray-700/50 bg-gray-900/80 p-6 backdrop-blur">
          <h2 className="mb-4 text-xl font-bold text-white">Leaderboard</h2>
          {leaderboard.length > 0 ? (
            <div className="space-y-2">
              {leaderboard.map((entry, i) => (
                <div
                  key={entry.address}
                  className={`flex items-center justify-between rounded-xl p-4 ${
                    i === 0
                      ? "bg-yellow-500/10 border border-yellow-500/30"
                      : i === 1
                      ? "bg-gray-400/10 border border-gray-400/30"
                      : i === 2
                      ? "bg-orange-500/10 border border-orange-500/30"
                      : "bg-gray-800/50"
                  }`}
                >
                  <div className="flex items-center gap-4">
                    <span className="w-8 text-center text-lg">
                      {i < 3 ? medals[i] : `#${i + 1}`}
                    </span>
                    <div>
                      <p className="font-mono text-sm text-white">
                        {entry.address.slice(0, 6)}...{entry.address.slice(-4)}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-bold text-purple-400">
                      {entry.points.toString()}
                    </p>
                    <p className="text-xs text-gray-500">points</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="py-8 text-center text-gray-500">
              <p>No agents ranked yet this season</p>
              <p className="mt-1 text-sm">Play games to earn season points</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
