import { parseEther } from "viem";

// ─── Contract Addresses ───
export const BETTING_CONTRACT =
  (process.env.NEXT_PUBLIC_BETTING_CONTRACT as `0x${string}`) ||
  "0xD9cDE7E7E1CA2e34FBeb175D7E86b538b649CC6F";

export const GAME_CONTRACT =
  (process.env.NEXT_PUBLIC_GAME_CONTRACT as `0x${string}`) ||
  "0x3fAE96BBEd4bEc6fd9218ACe4539012D4FdAcC2F";

export const TOURNAMENT_CONTRACT =
  (process.env.NEXT_PUBLIC_TOURNAMENT_CONTRACT as `0x${string}`) ||
  "0x82C5E93E25f1fEa8e53828518d1137Bbe2589757";

export const SEASON_CONTRACT =
  (process.env.NEXT_PUBLIC_SEASON_CONTRACT as `0x${string}`) ||
  "0x34A06EA23f2b2e9c251c449f4FC64A95dC3eE5cc";

export const AGENT_NFT_CONTRACT =
  (process.env.NEXT_PUBLIC_AGENT_NFT_CONTRACT as `0x${string}`) ||
  "0x70D6169aBeb41eC304e93765857113A084b3566e";

export const ARENA_REGISTRY_CONTRACT =
  (process.env.NEXT_PUBLIC_ARENA_REGISTRY_CONTRACT as `0x${string}`) ||
  "0xf5f1fF773F7cD95A33F3349C8Aa83538C5073a8c";

// ─── Betting Contract ABI ───
export const BETTING_ABI = [
  {
    name: "placeBet",
    type: "function",
    stateMutability: "payable",
    inputs: [
      { name: "gameId", type: "uint256" },
      { name: "betType", type: "uint8" },
      { name: "predictedAgent", type: "address" },
    ],
    outputs: [],
  },
  {
    name: "getPoolSizes",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "gameId", type: "uint256" }],
    outputs: [
      { name: "lobstersPool", type: "uint256" },
      { name: "impostorPool", type: "uint256" },
      { name: "specificPool", type: "uint256" },
    ],
  },
  {
    name: "getBetCount",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "gameId", type: "uint256" }],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    name: "pools",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "gameId", type: "uint256" }],
    outputs: [
      { name: "totalLobstersPool", type: "uint256" },
      { name: "totalImpostorPool", type: "uint256" },
      { name: "totalSpecificPool", type: "uint256" },
      { name: "settled", type: "bool" },
      { name: "result", type: "uint8" },
      { name: "revealedImpostor", type: "address" },
    ],
  },
] as const;

// ─── Tournament Contract ABI ───
export const TOURNAMENT_ABI = [
  { name: "register", type: "function", stateMutability: "payable", inputs: [{ name: "tournamentId", type: "uint256" }], outputs: [] },
  { name: "claimPrize", type: "function", stateMutability: "nonpayable", inputs: [{ name: "tournamentId", type: "uint256" }], outputs: [] },
  { name: "getTournamentInfo", type: "function", stateMutability: "view", inputs: [{ name: "tournamentId", type: "uint256" }], outputs: [{ name: "name", type: "string" }, { name: "entryFee", type: "uint256" }, { name: "prizePool", type: "uint256" }, { name: "maxParticipants", type: "uint8" }, { name: "currentRound", type: "uint8" }, { name: "totalRounds", type: "uint8" }, { name: "status", type: "uint8" }, { name: "arenaType", type: "uint256" }] },
  { name: "getParticipants", type: "function", stateMutability: "view", inputs: [{ name: "tournamentId", type: "uint256" }], outputs: [{ name: "", type: "address[]" }] },
  { name: "getParticipantCount", type: "function", stateMutability: "view", inputs: [{ name: "tournamentId", type: "uint256" }], outputs: [{ name: "", type: "uint256" }] },
  { name: "getMatch", type: "function", stateMutability: "view", inputs: [{ name: "tournamentId", type: "uint256" }, { name: "round", type: "uint8" }, { name: "matchIndex", type: "uint8" }], outputs: [{ name: "player1", type: "address" }, { name: "player2", type: "address" }, { name: "winner", type: "address" }, { name: "gameId", type: "uint256" }, { name: "completed", type: "bool" }] },
  { name: "nextTournamentId", type: "function", stateMutability: "view", inputs: [], outputs: [{ name: "", type: "uint256" }] },
  { name: "isRegistered", type: "function", stateMutability: "view", inputs: [{ name: "", type: "uint256" }, { name: "", type: "address" }], outputs: [{ name: "", type: "bool" }] },
  { name: "hasClaimed", type: "function", stateMutability: "view", inputs: [{ name: "", type: "uint256" }, { name: "", type: "address" }], outputs: [{ name: "", type: "bool" }] },
  { name: "placements", type: "function", stateMutability: "view", inputs: [{ name: "", type: "uint256" }, { name: "", type: "uint8" }], outputs: [{ name: "", type: "address" }] },
] as const;

// ─── Season Contract ABI ───
export const SEASON_ABI = [
  { name: "fundSeason", type: "function", stateMutability: "payable", inputs: [{ name: "seasonId", type: "uint256" }], outputs: [] },
  { name: "getSeasonStats", type: "function", stateMutability: "view", inputs: [{ name: "seasonId", type: "uint256" }, { name: "agent", type: "address" }], outputs: [{ name: "gamesPlayed", type: "uint256" }, { name: "gamesWon", type: "uint256" }, { name: "tournamentsWon", type: "uint256" }, { name: "totalEarnings", type: "uint256" }, { name: "seasonPoints", type: "uint256" }] },
  { name: "getTopAgents", type: "function", stateMutability: "view", inputs: [{ name: "seasonId", type: "uint256" }, { name: "count", type: "uint256" }], outputs: [{ name: "", type: "address[]" }, { name: "", type: "uint256[]" }] },
  { name: "getParticipantCount", type: "function", stateMutability: "view", inputs: [{ name: "seasonId", type: "uint256" }], outputs: [{ name: "", type: "uint256" }] },
  { name: "currentSeasonId", type: "function", stateMutability: "view", inputs: [], outputs: [{ name: "", type: "uint256" }] },
  { name: "seasons", type: "function", stateMutability: "view", inputs: [{ name: "", type: "uint256" }], outputs: [{ name: "id", type: "uint256" }, { name: "name", type: "string" }, { name: "startTime", type: "uint256" }, { name: "endTime", type: "uint256" }, { name: "rewardPool", type: "uint256" }, { name: "status", type: "uint8" }, { name: "topRewardSlots", type: "uint8" }] },
  { name: "nextSeasonId", type: "function", stateMutability: "view", inputs: [], outputs: [{ name: "", type: "uint256" }] },
] as const;

// ─── Agent NFT Contract ABI ───
export const AGENT_NFT_ABI = [
  { name: "mintAgent", type: "function", stateMutability: "payable", inputs: [{ name: "name", type: "string" }], outputs: [] },
  { name: "getProfile", type: "function", stateMutability: "view", inputs: [{ name: "tokenId", type: "uint256" }], outputs: [{ name: "agentAddress", type: "address" }, { name: "name", type: "string" }, { name: "tier", type: "uint8" }, { name: "totalWins", type: "uint256" }, { name: "totalGames", type: "uint256" }, { name: "tournamentWins", type: "uint256" }, { name: "seasonTitles", type: "uint256" }, { name: "mintedAt", type: "uint256" }, { name: "arenaSpecialty", type: "string" }] },
  { name: "getAgentToken", type: "function", stateMutability: "view", inputs: [{ name: "agent", type: "address" }], outputs: [{ name: "", type: "uint256" }] },
  { name: "hasNFT", type: "function", stateMutability: "view", inputs: [{ name: "", type: "address" }], outputs: [{ name: "", type: "bool" }] },
  { name: "totalSupply", type: "function", stateMutability: "view", inputs: [], outputs: [{ name: "", type: "uint256" }] },
  { name: "MINT_FEE", type: "function", stateMutability: "view", inputs: [], outputs: [{ name: "", type: "uint256" }] },
  { name: "balanceOf", type: "function", stateMutability: "view", inputs: [{ name: "owner", type: "address" }], outputs: [{ name: "", type: "uint256" }] },
] as const;

// ─── Arena Registry Contract ABI ───
export const ARENA_REGISTRY_ABI = [
  { name: "getArena", type: "function", stateMutability: "view", inputs: [{ name: "arenaId", type: "uint256" }], outputs: [{ name: "name", type: "string" }, { name: "description", type: "string" }, { name: "minPlayers", type: "uint256" }, { name: "maxPlayers", type: "uint256" }, { name: "defaultStake", type: "uint256" }, { name: "active", type: "bool" }, { name: "gamesPlayed", type: "uint256" }, { name: "totalVolume", type: "uint256" }] },
  { name: "getActiveArenas", type: "function", stateMutability: "view", inputs: [], outputs: [{ name: "", type: "uint256[]" }] },
  { name: "getTotalArenas", type: "function", stateMutability: "view", inputs: [], outputs: [{ name: "", type: "uint256" }] },
  { name: "nextArenaId", type: "function", stateMutability: "view", inputs: [], outputs: [{ name: "", type: "uint256" }] },
] as const;

// ─── Bet Type Mapping ───
export const BET_TYPE_MAP = {
  lobsters_win: 0,
  impostor_wins: 1,
  specific_agent: 2,
} as const;

// ─── Tier Names ───
export const TIER_NAMES = ["Bronze", "Silver", "Gold", "Platinum", "Diamond", "Champion"] as const;

// ─── Tournament Status Names ───
export const TOURNAMENT_STATUS = ["Registration", "Active", "Completed", "Cancelled"] as const;

// ─── Season Status Names ───
export const SEASON_STATUS = ["Upcoming", "Active", "Ended", "RewardsDistributed"] as const;

// ─── Helpers ───

export function gameIdToUint256(gameId: string): bigint {
  const num = Number(gameId);
  if (!isNaN(num) && num >= 0) return BigInt(num);
  const hex = gameId.replace(/-/g, "");
  const trimmed = hex.slice(-16);
  return BigInt("0x" + trimmed);
}

export function ethToWei(amount: string): bigint {
  try {
    return parseEther(amount);
  } catch {
    return BigInt(0);
  }
}
