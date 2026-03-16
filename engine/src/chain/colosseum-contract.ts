import { publicClient, walletClient, base } from "./client.js";
import { config } from "../config.js";
import { logger } from "../utils/logger.js";
import { parseEther } from "viem";

const colosseumLogger = logger.child("ColosseumContract");

// ══════════════════════════════════════════════════════════════════════════════
// ClawTournament ABI
// ══════════════════════════════════════════════════════════════════════════════

export const tournamentAbi = [
  // Write functions
  {
    type: "function",
    name: "createTournament",
    inputs: [
      { name: "name", type: "string" },
      { name: "entryFee", type: "uint256" },
      { name: "maxParticipants", type: "uint8" },
      { name: "registrationDuration", type: "uint256" },
      { name: "arenaType", type: "uint256" },
    ],
    outputs: [{ name: "id", type: "uint256" }],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "startTournament",
    inputs: [
      { name: "tournamentId", type: "uint256" },
      { name: "seededPlayers", type: "address[]" },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "reportMatchResult",
    inputs: [
      { name: "tournamentId", type: "uint256" },
      { name: "round", type: "uint8" },
      { name: "matchIndex", type: "uint8" },
      { name: "winner", type: "address" },
      { name: "gameId", type: "uint256" },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "cancelTournament",
    inputs: [{ name: "tournamentId", type: "uint256" }],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "register",
    inputs: [{ name: "tournamentId", type: "uint256" }],
    outputs: [],
    stateMutability: "payable",
  },
  {
    type: "function",
    name: "claimPrize",
    inputs: [{ name: "tournamentId", type: "uint256" }],
    outputs: [],
    stateMutability: "nonpayable",
  },
  // Read functions
  {
    type: "function",
    name: "getTournamentInfo",
    inputs: [{ name: "tournamentId", type: "uint256" }],
    outputs: [
      { name: "name", type: "string" },
      { name: "entryFee", type: "uint256" },
      { name: "prizePool", type: "uint256" },
      { name: "maxParticipants", type: "uint8" },
      { name: "currentRound", type: "uint8" },
      { name: "totalRounds", type: "uint8" },
      { name: "status", type: "uint8" },
      { name: "arenaType", type: "uint256" },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "getParticipants",
    inputs: [{ name: "tournamentId", type: "uint256" }],
    outputs: [{ name: "", type: "address[]" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "getParticipantCount",
    inputs: [{ name: "tournamentId", type: "uint256" }],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "getMatch",
    inputs: [
      { name: "tournamentId", type: "uint256" },
      { name: "round", type: "uint8" },
      { name: "matchIndex", type: "uint8" },
    ],
    outputs: [
      { name: "player1", type: "address" },
      { name: "player2", type: "address" },
      { name: "winner", type: "address" },
      { name: "gameId", type: "uint256" },
      { name: "completed", type: "bool" },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "nextTournamentId",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
  },
  // Events
  {
    type: "event",
    name: "TournamentCreated",
    inputs: [
      { name: "id", type: "uint256", indexed: true },
      { name: "name", type: "string", indexed: false },
      { name: "entryFee", type: "uint256", indexed: false },
      { name: "maxParticipants", type: "uint8", indexed: false },
      { name: "arenaType", type: "uint256", indexed: false },
    ],
  },
  {
    type: "event",
    name: "TournamentCompleted",
    inputs: [
      { name: "id", type: "uint256", indexed: true },
      { name: "champion", type: "address", indexed: false },
    ],
  },
] as const;

// ══════════════════════════════════════════════════════════════════════════════
// ClawSeason ABI
// ══════════════════════════════════════════════════════════════════════════════

export const seasonAbi = [
  // Write functions
  {
    type: "function",
    name: "createSeason",
    inputs: [
      { name: "name", type: "string" },
      { name: "startTime", type: "uint256" },
      { name: "endTime", type: "uint256" },
      { name: "topRewardSlots", type: "uint8" },
    ],
    outputs: [{ name: "id", type: "uint256" }],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "startSeason",
    inputs: [{ name: "seasonId", type: "uint256" }],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "endSeason",
    inputs: [{ name: "seasonId", type: "uint256" }],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "fundSeason",
    inputs: [{ name: "seasonId", type: "uint256" }],
    outputs: [],
    stateMutability: "payable",
  },
  {
    type: "function",
    name: "recordGame",
    inputs: [
      { name: "seasonId", type: "uint256" },
      { name: "agent", type: "address" },
      { name: "won", type: "bool" },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "recordTournamentWin",
    inputs: [
      { name: "seasonId", type: "uint256" },
      { name: "agent", type: "address" },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "recordCorrectVote",
    inputs: [
      { name: "seasonId", type: "uint256" },
      { name: "agent", type: "address" },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "addBonusPoints",
    inputs: [
      { name: "seasonId", type: "uint256" },
      { name: "agent", type: "address" },
      { name: "points", type: "uint256" },
      { name: "reason", type: "string" },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
  // Read functions
  {
    type: "function",
    name: "getSeasonStats",
    inputs: [
      { name: "seasonId", type: "uint256" },
      { name: "agent", type: "address" },
    ],
    outputs: [
      { name: "gamesPlayed", type: "uint256" },
      { name: "gamesWon", type: "uint256" },
      { name: "tournamentsWon", type: "uint256" },
      { name: "totalEarnings", type: "uint256" },
      { name: "seasonPoints", type: "uint256" },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "getTopAgents",
    inputs: [
      { name: "seasonId", type: "uint256" },
      { name: "count", type: "uint256" },
    ],
    outputs: [
      { name: "", type: "address[]" },
      { name: "", type: "uint256[]" },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "currentSeasonId",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "getParticipantCount",
    inputs: [{ name: "seasonId", type: "uint256" }],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
  },
  // Events
  {
    type: "event",
    name: "SeasonCreated",
    inputs: [
      { name: "id", type: "uint256", indexed: true },
      { name: "name", type: "string", indexed: false },
      { name: "startTime", type: "uint256", indexed: false },
      { name: "endTime", type: "uint256", indexed: false },
    ],
  },
  {
    type: "event",
    name: "GameRecorded",
    inputs: [
      { name: "seasonId", type: "uint256", indexed: true },
      { name: "agent", type: "address", indexed: true },
      { name: "won", type: "bool", indexed: false },
    ],
  },
] as const;

// ══════════════════════════════════════════════════════════════════════════════
// ClawAgentNFT ABI
// ══════════════════════════════════════════════════════════════════════════════

export const agentNFTAbi = [
  // Write functions (operator)
  {
    type: "function",
    name: "updateGameStats",
    inputs: [
      { name: "agent", type: "address" },
      { name: "won", type: "bool" },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "recordTournamentWin",
    inputs: [{ name: "agent", type: "address" }],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "recordSeasonTitle",
    inputs: [{ name: "agent", type: "address" }],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "setArenaSpecialty",
    inputs: [
      { name: "agent", type: "address" },
      { name: "specialty", type: "string" },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
  // Write function (public — anyone can mint)
  {
    type: "function",
    name: "mintAgent",
    inputs: [{ name: "name", type: "string" }],
    outputs: [],
    stateMutability: "payable",
  },
  // Read functions
  {
    type: "function",
    name: "getProfile",
    inputs: [{ name: "tokenId", type: "uint256" }],
    outputs: [
      { name: "agentAddress", type: "address" },
      { name: "name", type: "string" },
      { name: "tier", type: "uint8" },
      { name: "totalWins", type: "uint256" },
      { name: "totalGames", type: "uint256" },
      { name: "tournamentWins", type: "uint256" },
      { name: "seasonTitles", type: "uint256" },
      { name: "mintedAt", type: "uint256" },
      { name: "arenaSpecialty", type: "string" },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "getAgentToken",
    inputs: [{ name: "agent", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "hasNFT",
    inputs: [{ name: "", type: "address" }],
    outputs: [{ name: "", type: "bool" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "totalSupply",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "MINT_FEE",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
  },
  // Events
  {
    type: "event",
    name: "AgentMinted",
    inputs: [
      { name: "tokenId", type: "uint256", indexed: true },
      { name: "agentAddress", type: "address", indexed: true },
      { name: "name", type: "string", indexed: false },
    ],
  },
  {
    type: "event",
    name: "AgentEvolved",
    inputs: [
      { name: "tokenId", type: "uint256", indexed: true },
      { name: "oldTier", type: "uint8", indexed: false },
      { name: "newTier", type: "uint8", indexed: false },
    ],
  },
] as const;

// ══════════════════════════════════════════════════════════════════════════════
// ClawArenaRegistry ABI
// ══════════════════════════════════════════════════════════════════════════════

export const arenaRegistryAbi = [
  // Write functions
  {
    type: "function",
    name: "registerArena",
    inputs: [
      { name: "name", type: "string" },
      { name: "description", type: "string" },
      { name: "minPlayers", type: "uint256" },
      { name: "maxPlayers", type: "uint256" },
      { name: "defaultStake", type: "uint256" },
    ],
    outputs: [{ name: "id", type: "uint256" }],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "setArenaActive",
    inputs: [
      { name: "arenaId", type: "uint256" },
      { name: "active", type: "bool" },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "recordGamePlayed",
    inputs: [
      { name: "arenaId", type: "uint256" },
      { name: "volume", type: "uint256" },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
  // Read functions
  {
    type: "function",
    name: "getArena",
    inputs: [{ name: "arenaId", type: "uint256" }],
    outputs: [
      { name: "name", type: "string" },
      { name: "description", type: "string" },
      { name: "minPlayers", type: "uint256" },
      { name: "maxPlayers", type: "uint256" },
      { name: "defaultStake", type: "uint256" },
      { name: "active", type: "bool" },
      { name: "gamesPlayed", type: "uint256" },
      { name: "totalVolume", type: "uint256" },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "getActiveArenas",
    inputs: [],
    outputs: [{ name: "", type: "uint256[]" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "getTotalArenas",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
  },
  // Events
  {
    type: "event",
    name: "ArenaRegistered",
    inputs: [
      { name: "id", type: "uint256", indexed: true },
      { name: "name", type: "string", indexed: false },
      { name: "creator", type: "address", indexed: false },
      { name: "minPlayers", type: "uint256", indexed: false },
      { name: "maxPlayers", type: "uint256", indexed: false },
    ],
  },
] as const;

// ══════════════════════════════════════════════════════════════════════════════
// Helper: fire-and-forget with logging (non-blocking for game flow)
// ══════════════════════════════════════════════════════════════════════════════

function ensureWallet() {
  if (!walletClient || !walletClient.account) {
    throw new Error("Wallet client not initialized — set OPERATOR_PRIVATE_KEY");
  }
  return walletClient;
}

async function fireAndForget(label: string, txPromise: Promise<`0x${string}`>): Promise<`0x${string}` | null> {
  try {
    const hash = await txPromise;
    colosseumLogger.info(`${label} tx: ${hash}`);
    // Wait for receipt in background — don't block the caller
    publicClient.waitForTransactionReceipt({ hash }).then((receipt) => {
      colosseumLogger.info(`${label} confirmed in block ${receipt.blockNumber}`);
    }).catch((err) => {
      colosseumLogger.error(`${label} receipt failed`, err);
    });
    return hash;
  } catch (err) {
    colosseumLogger.error(`${label} FAILED`, err);
    return null;
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// TOURNAMENT Contract Interactions
// ══════════════════════════════════════════════════════════════════════════════

export async function createTournamentOnChain(
  name: string,
  entryFee: bigint,
  maxParticipants: number,
  registrationDurationSec: bigint,
  arenaType: bigint
): Promise<`0x${string}` | null> {
  const wc = ensureWallet();
  return fireAndForget("CreateTournament", wc.writeContract({
    account: wc.account!,
    address: config.contracts.tournament,
    abi: tournamentAbi,
    functionName: "createTournament",
    args: [name, entryFee, maxParticipants, registrationDurationSec, arenaType],
    chain: base,
  }));
}

export async function startTournamentOnChain(
  tournamentId: bigint,
  seededPlayers: `0x${string}`[]
): Promise<`0x${string}` | null> {
  const wc = ensureWallet();
  return fireAndForget("StartTournament", wc.writeContract({
    account: wc.account!,
    address: config.contracts.tournament,
    abi: tournamentAbi,
    functionName: "startTournament",
    args: [tournamentId, seededPlayers],
    chain: base,
  }));
}

export async function reportMatchResultOnChain(
  tournamentId: bigint,
  round: number,
  matchIndex: number,
  winner: `0x${string}`,
  gameId: bigint
): Promise<`0x${string}` | null> {
  const wc = ensureWallet();
  return fireAndForget("ReportMatchResult", wc.writeContract({
    account: wc.account!,
    address: config.contracts.tournament,
    abi: tournamentAbi,
    functionName: "reportMatchResult",
    args: [tournamentId, round, matchIndex, winner, gameId],
    chain: base,
  }));
}

export async function cancelTournamentOnChain(
  tournamentId: bigint
): Promise<`0x${string}` | null> {
  const wc = ensureWallet();
  return fireAndForget("CancelTournament", wc.writeContract({
    account: wc.account!,
    address: config.contracts.tournament,
    abi: tournamentAbi,
    functionName: "cancelTournament",
    args: [tournamentId],
    chain: base,
  }));
}

// Read
export async function getTournamentInfoFromChain(tournamentId: bigint) {
  return publicClient.readContract({
    address: config.contracts.tournament,
    abi: tournamentAbi,
    functionName: "getTournamentInfo",
    args: [tournamentId],
  });
}

export async function getTournamentParticipantsFromChain(tournamentId: bigint) {
  return publicClient.readContract({
    address: config.contracts.tournament,
    abi: tournamentAbi,
    functionName: "getParticipants",
    args: [tournamentId],
  });
}

export async function getMatchFromChain(tournamentId: bigint, round: number, matchIndex: number) {
  return publicClient.readContract({
    address: config.contracts.tournament,
    abi: tournamentAbi,
    functionName: "getMatch",
    args: [tournamentId, round, matchIndex],
  });
}

export async function getNextTournamentId() {
  return publicClient.readContract({
    address: config.contracts.tournament,
    abi: tournamentAbi,
    functionName: "nextTournamentId",
  });
}

// ══════════════════════════════════════════════════════════════════════════════
// SEASON Contract Interactions
// ══════════════════════════════════════════════════════════════════════════════

export async function createSeasonOnChain(
  name: string,
  startTime: bigint,
  endTime: bigint,
  topRewardSlots: number
): Promise<`0x${string}` | null> {
  const wc = ensureWallet();
  return fireAndForget("CreateSeason", wc.writeContract({
    account: wc.account!,
    address: config.contracts.season,
    abi: seasonAbi,
    functionName: "createSeason",
    args: [name, startTime, endTime, topRewardSlots],
    chain: base,
  }));
}

export async function startSeasonOnChain(
  seasonId: bigint
): Promise<`0x${string}` | null> {
  const wc = ensureWallet();
  return fireAndForget("StartSeason", wc.writeContract({
    account: wc.account!,
    address: config.contracts.season,
    abi: seasonAbi,
    functionName: "startSeason",
    args: [seasonId],
    chain: base,
  }));
}

export async function endSeasonOnChain(
  seasonId: bigint
): Promise<`0x${string}` | null> {
  const wc = ensureWallet();
  return fireAndForget("EndSeason", wc.writeContract({
    account: wc.account!,
    address: config.contracts.season,
    abi: seasonAbi,
    functionName: "endSeason",
    args: [seasonId],
    chain: base,
  }));
}

export async function recordGameOnChain(
  seasonId: bigint,
  agent: `0x${string}`,
  won: boolean
): Promise<`0x${string}` | null> {
  const wc = ensureWallet();
  return fireAndForget("RecordGame", wc.writeContract({
    account: wc.account!,
    address: config.contracts.season,
    abi: seasonAbi,
    functionName: "recordGame",
    args: [seasonId, agent, won],
    chain: base,
  }));
}

export async function recordTournamentWinOnChain(
  seasonId: bigint,
  agent: `0x${string}`
): Promise<`0x${string}` | null> {
  const wc = ensureWallet();
  return fireAndForget("RecordTournamentWin", wc.writeContract({
    account: wc.account!,
    address: config.contracts.season,
    abi: seasonAbi,
    functionName: "recordTournamentWin",
    args: [seasonId, agent],
    chain: base,
  }));
}

export async function recordCorrectVoteOnChain(
  seasonId: bigint,
  agent: `0x${string}`
): Promise<`0x${string}` | null> {
  const wc = ensureWallet();
  return fireAndForget("RecordCorrectVote", wc.writeContract({
    account: wc.account!,
    address: config.contracts.season,
    abi: seasonAbi,
    functionName: "recordCorrectVote",
    args: [seasonId, agent],
    chain: base,
  }));
}

// Read
export async function getSeasonStatsFromChain(seasonId: bigint, agent: `0x${string}`) {
  return publicClient.readContract({
    address: config.contracts.season,
    abi: seasonAbi,
    functionName: "getSeasonStats",
    args: [seasonId, agent],
  });
}

export async function getTopAgentsFromChain(seasonId: bigint, count: bigint) {
  return publicClient.readContract({
    address: config.contracts.season,
    abi: seasonAbi,
    functionName: "getTopAgents",
    args: [seasonId, count],
  });
}

export async function getCurrentSeasonIdFromChain() {
  return publicClient.readContract({
    address: config.contracts.season,
    abi: seasonAbi,
    functionName: "currentSeasonId",
  });
}

// ══════════════════════════════════════════════════════════════════════════════
// AGENT NFT Contract Interactions
// ══════════════════════════════════════════════════════════════════════════════

export async function updateNFTGameStats(
  agent: `0x${string}`,
  won: boolean
): Promise<`0x${string}` | null> {
  const wc = ensureWallet();
  return fireAndForget("UpdateNFTGameStats", wc.writeContract({
    account: wc.account!,
    address: config.contracts.agentNFT,
    abi: agentNFTAbi,
    functionName: "updateGameStats",
    args: [agent, won],
    chain: base,
  }));
}

export async function recordNFTTournamentWin(
  agent: `0x${string}`
): Promise<`0x${string}` | null> {
  const wc = ensureWallet();
  return fireAndForget("RecordNFTTournamentWin", wc.writeContract({
    account: wc.account!,
    address: config.contracts.agentNFT,
    abi: agentNFTAbi,
    functionName: "recordTournamentWin",
    args: [agent],
    chain: base,
  }));
}

export async function recordNFTSeasonTitle(
  agent: `0x${string}`
): Promise<`0x${string}` | null> {
  const wc = ensureWallet();
  return fireAndForget("RecordNFTSeasonTitle", wc.writeContract({
    account: wc.account!,
    address: config.contracts.agentNFT,
    abi: agentNFTAbi,
    functionName: "recordSeasonTitle",
    args: [agent],
    chain: base,
  }));
}

export async function setNFTArenaSpecialty(
  agent: `0x${string}`,
  specialty: string
): Promise<`0x${string}` | null> {
  const wc = ensureWallet();
  return fireAndForget("SetNFTArenaSpecialty", wc.writeContract({
    account: wc.account!,
    address: config.contracts.agentNFT,
    abi: agentNFTAbi,
    functionName: "setArenaSpecialty",
    args: [agent, specialty],
    chain: base,
  }));
}

// Read
export async function hasAgentNFT(agent: `0x${string}`): Promise<boolean> {
  return publicClient.readContract({
    address: config.contracts.agentNFT,
    abi: agentNFTAbi,
    functionName: "hasNFT",
    args: [agent],
  }) as Promise<boolean>;
}

export async function getAgentProfile(tokenId: bigint) {
  return publicClient.readContract({
    address: config.contracts.agentNFT,
    abi: agentNFTAbi,
    functionName: "getProfile",
    args: [tokenId],
  });
}

export async function getAgentTokenId(agent: `0x${string}`) {
  return publicClient.readContract({
    address: config.contracts.agentNFT,
    abi: agentNFTAbi,
    functionName: "getAgentToken",
    args: [agent],
  });
}

export async function getNFTTotalSupply() {
  return publicClient.readContract({
    address: config.contracts.agentNFT,
    abi: agentNFTAbi,
    functionName: "totalSupply",
  });
}

// ══════════════════════════════════════════════════════════════════════════════
// ARENA REGISTRY Contract Interactions
// ══════════════════════════════════════════════════════════════════════════════

export async function registerArenaOnChain(
  name: string,
  description: string,
  minPlayers: bigint,
  maxPlayers: bigint,
  defaultStake: bigint
): Promise<`0x${string}` | null> {
  const wc = ensureWallet();
  return fireAndForget("RegisterArena", wc.writeContract({
    account: wc.account!,
    address: config.contracts.arenaRegistry,
    abi: arenaRegistryAbi,
    functionName: "registerArena",
    args: [name, description, minPlayers, maxPlayers, defaultStake],
    chain: base,
  }));
}

export async function setArenaActiveOnChain(
  arenaId: bigint,
  active: boolean
): Promise<`0x${string}` | null> {
  const wc = ensureWallet();
  return fireAndForget("SetArenaActive", wc.writeContract({
    account: wc.account!,
    address: config.contracts.arenaRegistry,
    abi: arenaRegistryAbi,
    functionName: "setArenaActive",
    args: [arenaId, active],
    chain: base,
  }));
}

export async function recordArenaGamePlayedOnChain(
  arenaId: bigint,
  volume: bigint
): Promise<`0x${string}` | null> {
  const wc = ensureWallet();
  return fireAndForget("RecordArenaGamePlayed", wc.writeContract({
    account: wc.account!,
    address: config.contracts.arenaRegistry,
    abi: arenaRegistryAbi,
    functionName: "recordGamePlayed",
    args: [arenaId, volume],
    chain: base,
  }));
}

// Read
export async function getArenaFromChain(arenaId: bigint) {
  return publicClient.readContract({
    address: config.contracts.arenaRegistry,
    abi: arenaRegistryAbi,
    functionName: "getArena",
    args: [arenaId],
  });
}

export async function getActiveArenasFromChain() {
  return publicClient.readContract({
    address: config.contracts.arenaRegistry,
    abi: arenaRegistryAbi,
    functionName: "getActiveArenas",
  });
}

export async function getTotalArenasFromChain() {
  return publicClient.readContract({
    address: config.contracts.arenaRegistry,
    abi: arenaRegistryAbi,
    functionName: "getTotalArenas",
  });
}
