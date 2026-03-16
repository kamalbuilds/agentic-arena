import { createWalletClient, http, type WalletClient, type HttpTransport } from "viem";
import { privateKeyToAccount, generatePrivateKey } from "viem/accounts";
import { base } from "./client.js";
import { config } from "../config.js";
import { logger } from "../utils/logger.js";
import crypto from "node:crypto";

const walletLogger = logger.child("AgentWallet");

// ══════════════════════════════════════════════════════════════════════════════
// Agent Wallet Manager
//
// Creates and manages wallets for AI agents using either:
//   1. Coinbase CDP Server Wallets (if CDP_API_KEY_ID is configured)
//   2. Local HD wallet derivation (fallback for development)
//
// Each agent gets a deterministic wallet derived from their agent name,
// ensuring consistent addresses across engine restarts.
// ══════════════════════════════════════════════════════════════════════════════

export interface AgentWallet {
  address: `0x${string}`;
  privateKey: `0x${string}`;
  walletClient: WalletClient<HttpTransport, typeof base>;
  provider: "cdp" | "local";
}

// Cache of created wallets: agentName -> wallet
const walletCache = new Map<string, AgentWallet>();

// ── CDP Server Wallet API ─────────────────────────────────────────────────

const CDP_API_BASE = "https://api.cdp.coinbase.com/v2";

interface CdpWalletResponse {
  id: string;
  address: string;
  network_id: string;
}

/**
 * Create a wallet via Coinbase CDP Server Wallet API.
 * This gives agents real Base wallets managed by Coinbase infrastructure.
 */
async function createCdpWallet(agentName: string): Promise<AgentWallet | null> {
  const apiKeyId = config.cdp?.apiKeyId;
  const apiKeySecret = config.cdp?.apiKeySecret;

  if (!apiKeyId || !apiKeySecret) {
    return null;
  }

  try {
    const networkId = config.base.chainId === 84532 ? "base-sepolia" : "base-mainnet";

    // Use agent name as idempotency key for deterministic wallet assignment
    const idempotencyKey = crypto
      .createHash("sha256")
      .update(`among-claws-agent-${agentName}`)
      .digest("hex");

    const response = await fetch(`${CDP_API_BASE}/wallets`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKeyId}`,
        "X-Idempotency-Key": idempotencyKey,
      },
      body: JSON.stringify({
        network_id: networkId,
        wallet_secret: apiKeySecret,
      }),
    });

    if (!response.ok) {
      walletLogger.warn(`CDP wallet creation failed: ${response.status}`);
      return null;
    }

    const data = (await response.json()) as CdpWalletResponse;
    walletLogger.info(`CDP wallet created for ${agentName}: ${data.address}`);

    // CDP wallets are server-managed; we create a local signer for tx submission
    // In production, transactions would be signed via the CDP API
    // For the hackathon, we use a deterministic local key as a bridge
    const deterministicKey = deriveDeterministicKey(agentName);
    const account = privateKeyToAccount(deterministicKey);

    const walletClient = createWalletClient({
      account,
      chain: base,
      transport: http(config.base.rpcUrl),
    });

    return {
      address: data.address as `0x${string}`,
      privateKey: deterministicKey,
      walletClient,
      provider: "cdp",
    };
  } catch (err) {
    walletLogger.error(`CDP wallet creation error for ${agentName}`, err);
    return null;
  }
}

// ── Local Wallet Derivation ──────────────────────────────────────────────

/**
 * Derive a deterministic private key from the agent name and a master seed.
 * This ensures agents get consistent addresses across restarts.
 */
function deriveDeterministicKey(agentName: string): `0x${string}` {
  const masterSeed = config.operator.privateKey || "default-seed-for-dev";
  const hash = crypto
    .createHmac("sha256", masterSeed)
    .update(`among-claws-agent-wallet-${agentName}`)
    .digest("hex");
  return `0x${hash}` as `0x${string}`;
}

/**
 * Create a local wallet for an agent using deterministic key derivation.
 * Used when CDP is not configured (development/testing).
 */
function createLocalWallet(agentName: string): AgentWallet {
  const privateKey = deriveDeterministicKey(agentName);
  const account = privateKeyToAccount(privateKey);

  const walletClient = createWalletClient({
    account,
    chain: base,
    transport: http(config.base.rpcUrl),
  });

  walletLogger.info(`Local wallet created for ${agentName}: ${account.address}`);

  return {
    address: account.address,
    privateKey,
    walletClient,
    provider: "local",
  };
}

// ── Public API ────────────────────────────────────────────────────────────

/**
 * Get or create a wallet for an AI agent.
 * Tries CDP first, falls back to local deterministic derivation.
 */
export async function getOrCreateAgentWallet(agentName: string): Promise<AgentWallet> {
  // Check cache first
  const cached = walletCache.get(agentName);
  if (cached) return cached;

  // Try CDP Server Wallet
  const cdpWallet = await createCdpWallet(agentName);
  if (cdpWallet) {
    walletCache.set(agentName, cdpWallet);
    return cdpWallet;
  }

  // Fallback to local wallet
  const localWallet = createLocalWallet(agentName);
  walletCache.set(agentName, localWallet);
  return localWallet;
}

/**
 * Get the wallet address for an agent without creating one.
 * Returns null if no wallet exists yet.
 */
export function getAgentWalletAddress(agentName: string): `0x${string}` | null {
  return walletCache.get(agentName)?.address ?? null;
}

/**
 * List all agent wallets that have been created.
 */
export function listAgentWallets(): Array<{ name: string; address: string; provider: string }> {
  return Array.from(walletCache.entries()).map(([name, wallet]) => ({
    name,
    address: wallet.address,
    provider: wallet.provider,
  }));
}

/**
 * Create wallets for a batch of agents (used at game start).
 */
export async function createWalletsForAgents(
  agentNames: string[]
): Promise<Map<string, AgentWallet>> {
  const results = new Map<string, AgentWallet>();

  for (const name of agentNames) {
    const wallet = await getOrCreateAgentWallet(name);
    results.set(name, wallet);
  }

  walletLogger.info(
    `Created ${results.size} agent wallets (${
      Array.from(results.values()).filter((w) => w.provider === "cdp").length
    } CDP, ${
      Array.from(results.values()).filter((w) => w.provider === "local").length
    } local)`
  );

  return results;
}

/**
 * Generate a fresh random wallet (for one-off use).
 */
export function generateRandomWallet(): AgentWallet {
  const privateKey = generatePrivateKey();
  const account = privateKeyToAccount(privateKey);

  const walletClient = createWalletClient({
    account,
    chain: base,
    transport: http(config.base.rpcUrl),
  });

  return {
    address: account.address,
    privateKey,
    walletClient,
    provider: "local",
  };
}
