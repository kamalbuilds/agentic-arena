import { getContract, type GetContractReturnType, encodePacked, keccak256 } from "viem";
import { publicClient, walletClient, base } from "./client.js";
import { config } from "../config.js";
import { logger } from "../utils/logger.js";

const contractLogger = logger.child("Contract");

// ──────────────────────────────────────────
// AmongClawsGame ABI
// ──────────────────────────────────────────
export const gameAbi = [
  {
    type: "function",
    name: "createGame",
    inputs: [
      { name: "stake", type: "uint256" },
      { name: "minPlayers", type: "uint8" },
      { name: "maxPlayers", type: "uint8" },
      { name: "impostorCount", type: "uint8" },
      { name: "maxRounds", type: "uint8" },
    ],
    outputs: [{ name: "gameId", type: "uint256" }],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "joinGame",
    inputs: [
      { name: "gameId", type: "uint256" },
    ],
    outputs: [],
    stateMutability: "payable",
  },
  {
    type: "function",
    name: "startGame",
    inputs: [{ name: "gameId", type: "uint256" }],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "commitRoles",
    inputs: [
      { name: "gameId", type: "uint256" },
      { name: "agents", type: "address[]" },
      { name: "commitments", type: "bytes32[]" },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "advancePhase",
    inputs: [
      { name: "gameId", type: "uint256" },
      { name: "phase", type: "uint8" },
      { name: "duration", type: "uint256" },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "resolveVote",
    inputs: [
      { name: "gameId", type: "uint256" },
      { name: "eliminated", type: "address" },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "revealRole",
    inputs: [
      { name: "gameId", type: "uint256" },
      { name: "agent", type: "address" },
      { name: "role", type: "uint8" },
      { name: "salt", type: "bytes32" },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "endGame",
    inputs: [
      { name: "gameId", type: "uint256" },
      { name: "result", type: "uint8" },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "getGame",
    inputs: [{ name: "gameId", type: "uint256" }],
    outputs: [
      {
        name: "",
        type: "tuple",
        components: [
          { name: "id", type: "uint256" },
          { name: "stake", type: "uint256" },
          { name: "minPlayers", type: "uint8" },
          { name: "maxPlayers", type: "uint8" },
          { name: "impostorCount", type: "uint8" },
          { name: "maxRounds", type: "uint8" },
          { name: "currentRound", type: "uint8" },
          { name: "phase", type: "uint8" },
          { name: "result", type: "uint8" },
          { name: "playerCount", type: "uint8" },
          { name: "alive", type: "uint8" },
          { name: "operator", type: "address" },
        ],
      },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "getPlayers",
    inputs: [{ name: "gameId", type: "uint256" }],
    outputs: [{ name: "", type: "address[]" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "isAlive",
    inputs: [
      { name: "gameId", type: "uint256" },
      { name: "agent", type: "address" },
    ],
    outputs: [{ name: "", type: "bool" }],
    stateMutability: "view",
  },
  {
    type: "event",
    name: "GameCreated",
    inputs: [
      { name: "gameId", type: "uint256", indexed: true },
      { name: "operator", type: "address", indexed: true },
      { name: "stake", type: "uint256", indexed: false },
    ],
  },
  {
    type: "event",
    name: "PlayerJoined",
    inputs: [
      { name: "gameId", type: "uint256", indexed: true },
      { name: "agent", type: "address", indexed: true },
    ],
  },
  {
    type: "event",
    name: "GameStarted",
    inputs: [
      { name: "gameId", type: "uint256", indexed: true },
    ],
  },
  {
    type: "event",
    name: "RolesCommitted",
    inputs: [
      { name: "gameId", type: "uint256", indexed: true },
    ],
  },
  {
    type: "event",
    name: "PhaseAdvanced",
    inputs: [
      { name: "gameId", type: "uint256", indexed: true },
      { name: "phase", type: "uint8", indexed: false },
      { name: "duration", type: "uint256", indexed: false },
    ],
  },
  {
    type: "event",
    name: "PlayerEliminated",
    inputs: [
      { name: "gameId", type: "uint256", indexed: true },
      { name: "agent", type: "address", indexed: true },
    ],
  },
  {
    type: "event",
    name: "RoleRevealed",
    inputs: [
      { name: "gameId", type: "uint256", indexed: true },
      { name: "agent", type: "address", indexed: true },
      { name: "role", type: "uint8", indexed: false },
    ],
  },
  {
    type: "event",
    name: "GameEnded",
    inputs: [
      { name: "gameId", type: "uint256", indexed: true },
      { name: "result", type: "uint8", indexed: false },
    ],
  },
] as const;

// ──────────────────────────────────────────
// AmongClawsBetting ABI
// ──────────────────────────────────────────
export const bettingAbi = [
  {
    type: "function",
    name: "placeBet",
    inputs: [
      { name: "gameId", type: "uint256" },
      { name: "betType", type: "uint8" },
      { name: "predictedAgent", type: "address" },
    ],
    outputs: [{ name: "betId", type: "uint256" }],
    stateMutability: "payable",
  },
  {
    type: "function",
    name: "settleBets",
    inputs: [
      { name: "gameId", type: "uint256" },
      { name: "result", type: "uint8" },
      { name: "impostor", type: "address" },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "claimWinnings",
    inputs: [{ name: "betId", type: "uint256" }],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "getBet",
    inputs: [{ name: "betId", type: "uint256" }],
    outputs: [
      {
        name: "",
        type: "tuple",
        components: [
          { name: "id", type: "uint256" },
          { name: "gameId", type: "uint256" },
          { name: "bettor", type: "address" },
          { name: "betType", type: "uint8" },
          { name: "predictedAgent", type: "address" },
          { name: "amount", type: "uint256" },
          { name: "settled", type: "bool" },
          { name: "won", type: "bool" },
          { name: "payout", type: "uint256" },
        ],
      },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "getGameBets",
    inputs: [{ name: "gameId", type: "uint256" }],
    outputs: [{ name: "", type: "uint256[]" }],
    stateMutability: "view",
  },
  {
    type: "event",
    name: "BetPlaced",
    inputs: [
      { name: "betId", type: "uint256", indexed: true },
      { name: "gameId", type: "uint256", indexed: true },
      { name: "bettor", type: "address", indexed: true },
      { name: "betType", type: "uint8", indexed: false },
      { name: "amount", type: "uint256", indexed: false },
    ],
  },
  {
    type: "event",
    name: "BetsSettled",
    inputs: [
      { name: "gameId", type: "uint256", indexed: true },
    ],
  },
  {
    type: "event",
    name: "WinningsClaimed",
    inputs: [
      { name: "betId", type: "uint256", indexed: true },
      { name: "bettor", type: "address", indexed: true },
      { name: "payout", type: "uint256", indexed: false },
    ],
  },
] as const;

// ──────────────────────────────────────────
// AmongClawsLeaderboard ABI
// ──────────────────────────────────────────
export const leaderboardAbi = [
  {
    type: "function",
    name: "updateStats",
    inputs: [
      { name: "agent", type: "address" },
      { name: "won", type: "bool" },
      { name: "wasImpostor", type: "bool" },
      { name: "earned", type: "uint256" },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "getStats",
    inputs: [{ name: "agent", type: "address" }],
    outputs: [
      {
        name: "",
        type: "tuple",
        components: [
          { name: "gamesPlayed", type: "uint256" },
          { name: "gamesWon", type: "uint256" },
          { name: "impostorGames", type: "uint256" },
          { name: "impostorWins", type: "uint256" },
          { name: "crewmateGames", type: "uint256" },
          { name: "crewmateWins", type: "uint256" },
          { name: "totalEarned", type: "uint256" },
          { name: "totalStaked", type: "uint256" },
        ],
      },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "getTopAgents",
    inputs: [{ name: "count", type: "uint256" }],
    outputs: [
      {
        name: "",
        type: "tuple[]",
        components: [
          { name: "agent", type: "address" },
          { name: "gamesWon", type: "uint256" },
          { name: "totalEarned", type: "uint256" },
        ],
      },
    ],
    stateMutability: "view",
  },
  {
    type: "event",
    name: "StatsUpdated",
    inputs: [
      { name: "agent", type: "address", indexed: true },
      { name: "gamesPlayed", type: "uint256", indexed: false },
      { name: "gamesWon", type: "uint256", indexed: false },
    ],
  },
] as const;

// ──────────────────────────────────────────
// Contract instances
// ──────────────────────────────────────────
function getGameContract() {
  if (!config.contracts.game) {
    throw new Error("Game contract address not configured");
  }
  return getContract({
    address: config.contracts.game,
    abi: gameAbi,
    client: { public: publicClient, wallet: walletClient! },
  });
}

function getBettingContract() {
  if (!config.contracts.betting) {
    throw new Error("Betting contract address not configured");
  }
  return getContract({
    address: config.contracts.betting,
    abi: bettingAbi,
    client: { public: publicClient, wallet: walletClient! },
  });
}

function getLeaderboardContract() {
  if (!config.contracts.leaderboard) {
    throw new Error("Leaderboard contract address not configured");
  }
  return getContract({
    address: config.contracts.leaderboard,
    abi: leaderboardAbi,
    client: { public: publicClient, wallet: walletClient! },
  });
}

// ──────────────────────────────────────────
// Game contract interactions
// ──────────────────────────────────────────
export async function createGameOnChain(
  stake: bigint,
  minPlayers: number,
  maxPlayers: number,
  impostorCount: number,
  maxRounds: number
): Promise<`0x${string}`> {
  contractLogger.info("Creating game on-chain", {
    stake: stake.toString(),
    minPlayers,
    maxPlayers,
    impostorCount,
    maxRounds,
  });

  if (!walletClient || !walletClient.account) {
    throw new Error("Wallet client not initialized");
  }

  const hash = await walletClient.writeContract({
    account: walletClient.account!,
    address: config.contracts.game,
    abi: gameAbi,
    functionName: "createGame",
    args: [stake, minPlayers, maxPlayers, impostorCount, maxRounds],
    chain: base,
  });

  contractLogger.info(`Game creation tx: ${hash}`);
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  contractLogger.info(`Game creation confirmed in block ${receipt.blockNumber}`);
  return hash;
}

export async function joinGameOnChain(
  gameId: bigint,
  stake: bigint
): Promise<`0x${string}`> {
  contractLogger.info(`Joining game ${gameId} on-chain`);

  if (!walletClient || !walletClient.account) {
    throw new Error("Wallet client not initialized");
  }

  const hash = await walletClient.writeContract({
    account: walletClient.account!,
    address: config.contracts.game,
    abi: gameAbi,
    functionName: "joinGame",
    args: [gameId],
    value: stake,
    chain: base,
  });

  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  contractLogger.info(`Join game confirmed in block ${receipt.blockNumber}`);
  return hash;
}

export async function startGameOnChain(
  gameId: bigint
): Promise<`0x${string}`> {
  contractLogger.info(`Starting game ${gameId} on-chain`);

  if (!walletClient || !walletClient.account) {
    throw new Error("Wallet client not initialized");
  }

  const hash = await walletClient.writeContract({
    account: walletClient.account!,
    address: config.contracts.game,
    abi: gameAbi,
    functionName: "startGame",
    args: [gameId],
    chain: base,
  });

  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  contractLogger.info(`Start game confirmed in block ${receipt.blockNumber}`);
  return hash;
}

export async function commitRolesOnChain(
  gameId: bigint,
  agents: `0x${string}`[],
  commitments: `0x${string}`[]
): Promise<`0x${string}`> {
  contractLogger.info(`Committing roles for game ${gameId}`);

  if (!walletClient || !walletClient.account) {
    throw new Error("Wallet client not initialized");
  }

  const hash = await walletClient.writeContract({
    account: walletClient.account!,
    address: config.contracts.game,
    abi: gameAbi,
    functionName: "commitRoles",
    args: [gameId, agents, commitments],
    chain: base,
  });

  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  contractLogger.info(`Roles committed in block ${receipt.blockNumber}`);
  return hash;
}

export async function advancePhaseOnChain(
  gameId: bigint,
  phase: number,
  duration: bigint
): Promise<`0x${string}`> {
  contractLogger.info(`Advancing phase for game ${gameId} to ${phase}`);

  if (!walletClient || !walletClient.account) {
    throw new Error("Wallet client not initialized");
  }

  const hash = await walletClient.writeContract({
    account: walletClient.account!,
    address: config.contracts.game,
    abi: gameAbi,
    functionName: "advancePhase",
    args: [gameId, phase, duration],
    chain: base,
  });

  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  contractLogger.info(`Phase advanced in block ${receipt.blockNumber}`);
  return hash;
}

export async function resolveVoteOnChain(
  gameId: bigint,
  eliminated: `0x${string}`
): Promise<`0x${string}`> {
  contractLogger.info(
    `Resolving vote for game ${gameId}, eliminated: ${eliminated}`
  );

  if (!walletClient || !walletClient.account) {
    throw new Error("Wallet client not initialized");
  }

  const hash = await walletClient.writeContract({
    account: walletClient.account!,
    address: config.contracts.game,
    abi: gameAbi,
    functionName: "resolveVote",
    args: [gameId, eliminated],
    chain: base,
  });

  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  contractLogger.info(`Vote resolved in block ${receipt.blockNumber}`);
  return hash;
}

export async function revealRoleOnChain(
  gameId: bigint,
  agent: `0x${string}`,
  role: number,
  salt: `0x${string}`
): Promise<`0x${string}`> {
  contractLogger.info(`Revealing role for ${agent} in game ${gameId}`);

  if (!walletClient || !walletClient.account) {
    throw new Error("Wallet client not initialized");
  }

  const hash = await walletClient.writeContract({
    account: walletClient.account!,
    address: config.contracts.game,
    abi: gameAbi,
    functionName: "revealRole",
    args: [gameId, agent, role, salt],
    chain: base,
  });

  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  contractLogger.info(`Role revealed in block ${receipt.blockNumber}`);
  return hash;
}

export async function endGameOnChain(
  gameId: bigint,
  result: number
): Promise<`0x${string}`> {
  contractLogger.info(`Ending game ${gameId} with result ${result}`);

  if (!walletClient || !walletClient.account) {
    throw new Error("Wallet client not initialized");
  }

  const hash = await walletClient.writeContract({
    account: walletClient.account!,
    address: config.contracts.game,
    abi: gameAbi,
    functionName: "endGame",
    args: [gameId, result],
    chain: base,
  });

  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  contractLogger.info(`Game ended in block ${receipt.blockNumber}`);
  return hash;
}

// ──────────────────────────────────────────
// Betting contract interactions
// ──────────────────────────────────────────
export async function placeBetOnChain(
  gameId: bigint,
  betType: number,
  predictedAgent: `0x${string}`,
  amount: bigint
): Promise<`0x${string}`> {
  contractLogger.info(`Placing bet on game ${gameId}`);

  if (!walletClient || !walletClient.account) {
    throw new Error("Wallet client not initialized");
  }

  const hash = await walletClient.writeContract({
    account: walletClient.account!,
    address: config.contracts.betting,
    abi: bettingAbi,
    functionName: "placeBet",
    args: [gameId, betType, predictedAgent],
    value: amount,
    chain: base,
  });

  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  contractLogger.info(`Bet placed in block ${receipt.blockNumber}`);
  return hash;
}

export async function settleBetsOnChain(
  gameId: bigint,
  result: number,
  impostor: `0x${string}`
): Promise<`0x${string}`> {
  contractLogger.info(`Settling bets for game ${gameId}`);

  if (!walletClient || !walletClient.account) {
    throw new Error("Wallet client not initialized");
  }

  const hash = await walletClient.writeContract({
    account: walletClient.account!,
    address: config.contracts.betting,
    abi: bettingAbi,
    functionName: "settleBets",
    args: [gameId, result, impostor],
    chain: base,
  });

  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  contractLogger.info(`Bets settled in block ${receipt.blockNumber}`);
  return hash;
}

// ──────────────────────────────────────────
// Leaderboard contract interactions
// ──────────────────────────────────────────
export async function updateStatsOnChain(
  agent: `0x${string}`,
  won: boolean,
  wasImpostor: boolean,
  earned: bigint
): Promise<`0x${string}`> {
  contractLogger.info(`Updating stats for ${agent}`);

  if (!walletClient || !walletClient.account) {
    throw new Error("Wallet client not initialized");
  }

  const hash = await walletClient.writeContract({
    account: walletClient.account!,
    address: config.contracts.leaderboard,
    abi: leaderboardAbi,
    functionName: "updateStats",
    args: [agent, won, wasImpostor, earned],
    chain: base,
  });

  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  contractLogger.info(`Stats updated in block ${receipt.blockNumber}`);
  return hash;
}

// ──────────────────────────────────────────
// Read functions
// ──────────────────────────────────────────
export async function getGameFromChain(gameId: bigint) {
  const contract = getGameContract();
  return await publicClient.readContract({
    address: config.contracts.game,
    abi: gameAbi,
    functionName: "getGame",
    args: [gameId],
  });
}

export async function getPlayersFromChain(
  gameId: bigint
): Promise<readonly `0x${string}`[]> {
  return await publicClient.readContract({
    address: config.contracts.game,
    abi: gameAbi,
    functionName: "getPlayers",
    args: [gameId],
  });
}

export async function getAgentStats(agent: `0x${string}`) {
  return await publicClient.readContract({
    address: config.contracts.leaderboard,
    abi: leaderboardAbi,
    functionName: "getStats",
    args: [agent],
  });
}

export async function getTopAgents(count: bigint) {
  return await publicClient.readContract({
    address: config.contracts.leaderboard,
    abi: leaderboardAbi,
    functionName: "getTopAgents",
    args: [count],
  });
}
