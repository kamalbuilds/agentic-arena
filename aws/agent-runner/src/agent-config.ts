import dotenv from "dotenv";
import { getPersonality, type Personality } from "./personalities.js";

dotenv.config();

export interface AgentConfig {
  gameServerUrl: string;
  baseRpcUrl: string;
  agentCount: number;
  pollIntervalMs: number;
  maxWaitForStartMs: number;
  autoCreateGame: boolean;
  autoJoinDelay: number;
  gameCreationCooldown: number;
}

export interface AgentIdentity {
  index: number;
  privateKey: `0x${string}`;
  name: string;
  personality: Personality;
}

const AGENT_NAMES = [
  "CrabSleuth",
  "ClawStrike",
  "TideTurner",
  "ShellGuard",
  "PinchMaster",
  "ReefRunner",
  "DeepDiver",
  "CoralSpy",
  "WaveRider",
  "KelpHunter",
  "BubbleWatch",
  "SandDrifter",
  "PearlFinder",
  "TrenchLurker",
  "CurrentChaser",
  "BarnacleBot",
];

export function loadConfig(): AgentConfig {
  return {
    gameServerUrl: process.env.GAME_SERVER_URL || "http://localhost:3001",
    baseRpcUrl: process.env.BASE_RPC_URL || "https://sepolia.base.org",
    agentCount: parseInt(process.env.AGENT_COUNT || "8", 10),
    pollIntervalMs: parseInt(process.env.POLL_INTERVAL_MS || "3000", 10),
    maxWaitForStartMs: parseInt(process.env.MAX_WAIT_FOR_START_MS || "300000", 10),
    autoCreateGame: process.env.AUTO_CREATE_GAME !== "false",
    autoJoinDelay: parseInt(process.env.AUTO_JOIN_DELAY_MS || "2000", 10),
    gameCreationCooldown: parseInt(process.env.GAME_CREATION_COOLDOWN_MS || "30000", 10),
  };
}

export function loadAgentIdentities(config: AgentConfig): AgentIdentity[] {
  const keysEnv = process.env.AGENT_PRIVATE_KEYS || "";
  const keys = keysEnv
    .split(",")
    .map((k) => k.trim())
    .filter((k) => k.length > 0);

  if (keys.length === 0) {
    throw new Error(
      "AGENT_PRIVATE_KEYS environment variable is required. " +
      "Provide comma-separated hex private keys."
    );
  }

  const identities: AgentIdentity[] = [];

  for (let i = 0; i < config.agentCount; i++) {
    const keyIndex = i % keys.length;
    const key = keys[keyIndex];

    if (!key.startsWith("0x")) {
      throw new Error(`Invalid private key at index ${keyIndex}: must start with 0x`);
    }

    identities.push({
      index: i,
      privateKey: key as `0x${string}`,
      name: AGENT_NAMES[i % AGENT_NAMES.length],
      personality: getPersonality(i),
    });
  }

  return identities;
}
