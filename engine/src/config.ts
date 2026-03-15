import dotenv from "dotenv";
dotenv.config();

export const config = {
  base: {
    rpcUrl: process.env.BASE_RPC_URL || "https://sepolia.base.org",
    chainId: parseInt(process.env.BASE_CHAIN_ID || "84532", 10),
  },
  operator: {
    privateKey: process.env.OPERATOR_PRIVATE_KEY || "",
  },
  contracts: {
    game: (process.env.GAME_CONTRACT_ADDRESS || "") as `0x${string}`,
    betting: (process.env.BETTING_CONTRACT_ADDRESS || "") as `0x${string}`,
    leaderboard: (process.env.LEADERBOARD_CONTRACT_ADDRESS || "") as `0x${string}`,
    tournament: (process.env.TOURNAMENT_CONTRACT_ADDRESS || "0x82C5E93E25f1fEa8e53828518d1137Bbe2589757") as `0x${string}`,
    season: (process.env.SEASON_CONTRACT_ADDRESS || "0x34A06EA23f2b2e9c251c449f4FC64A95dC3eE5cc") as `0x${string}`,
    agentNFT: (process.env.AGENT_NFT_CONTRACT_ADDRESS || "0x70D6169aBeb41eC304e93765857113A084b3566e") as `0x${string}`,
    arenaRegistry: (process.env.ARENA_REGISTRY_CONTRACT_ADDRESS || "0xf5f1fF773F7cD95A33F3349C8Aa83538C5073a8c") as `0x${string}`,
  },
  moltbook: {
    apiUrl: process.env.MOLTBOOK_API_URL || "https://moltbook.com/api",
    apiKey: process.env.MOLTBOOK_API_KEY || "",
    submolt: process.env.MOLTBOOK_SUBMOLT || "general",
  },
  claw: {
    tokenAddress: (process.env.CLAW_TOKEN_ADDRESS || "") as `0x${string}`,
  },
  server: {
    port: parseInt(process.env.PORT || "3001", 10),
    wsPort: parseInt(process.env.WS_PORT || "3002", 10),
  },
  cdp: {
    apiKeyId: process.env.CDP_API_KEY_ID || "",
    apiKeySecret: process.env.CDP_API_KEY_SECRET || "",
  },
  erc8004: {
    identityRegistry: (process.env.ERC8004_IDENTITY_REGISTRY || "") as `0x${string}`,
    reputationRegistry: (process.env.ERC8004_REPUTATION_REGISTRY || "") as `0x${string}`,
    validationRegistry: (process.env.ERC8004_VALIDATION_REGISTRY || "") as `0x${string}`,
  },
  uniswap: {
    apiKey: process.env.UNISWAP_API_KEY || "",
  },
  locus: {
    apiKey: process.env.LOCUS_API_KEY || "",
    apiBase: process.env.LOCUS_API_BASE || "https://beta-api.paywithlocus.com/api",
    treasuryAddress: (process.env.GAME_TREASURY_ADDRESS || "") as `0x${string}`,
  },
  gemini: {
    apiKey: process.env.GEMINI_API_KEY || "",
  },
  database: {
    url: process.env.DATABASE_URL || "",
  },
  game: {
    defaultStake: BigInt(process.env.DEFAULT_STAKE || "500000000000000000"),
    minPlayers: parseInt(process.env.MIN_PLAYERS || "5", 10),
    maxPlayers: parseInt(process.env.MAX_PLAYERS || "8", 10),
    discussionDuration: parseInt(process.env.DISCUSSION_DURATION || "180", 10),
    votingDuration: parseInt(process.env.VOTING_DURATION || "60", 10),
    maxRounds: parseInt(process.env.MAX_ROUNDS || "5", 10),
    impostorCount: parseInt(process.env.IMPOSTOR_COUNT || "1", 10),
  },
} as const;
