import { encodePacked, keccak256, toHex, parseAbiItem } from "viem";
import { publicClient, walletClient, base } from "./client.js";
import { config } from "../config.js";
import { logger } from "../utils/logger.js";

// Re-export the Base Mainnet chain config for consumers that need to
// target Base Mainnet (chain 8453) specifically for ERC-8004 identity,
// as required by the Synthesis hackathon.
export const BASE_MAINNET_CHAIN_ID = 8453;
export const BASE_MAINNET_IDENTITY_REGISTRY = "0x8004A169FB4a3325136EB29fA0ceB6D2e539a432" as `0x${string}`;
export const BASE_MAINNET_REPUTATION_REGISTRY = "0x8004BAa17C55a88189AE136b182e5fdA19dE9b63" as `0x${string}`;

const erc8004Logger = logger.child("ERC8004");

// ══════════════════════════════════════════════════════════════════════════════
// ERC-8004: Trustless Agent Identity on Base
//
// Three registries per the canonical spec (EIP-8004 v2.0):
//   1. Identity Registry  - ERC-721 NFT per agent, stores URI + metadata
//   2. Reputation Registry - Feedback scoring from clients (int128 + decimals)
//   3. Validation Registry - Independent verification of agent work
//
// Canonical addresses (CREATE2 deployed, same on all chains):
//   Mainnet  Identity:   0x8004A169FB4a3325136EB29fA0ceB6D2e539a432
//   Mainnet  Reputation: 0x8004BAa17C55a88189AE136b182e5fdA19dE9b63
//   Testnet  Identity:   0x8004A818BFB912233c491871b3d84c89A494BD9e
//   Testnet  Reputation: 0x8004B663056A597Dffe9eCcC1965A193B7388713
//
// Reference: https://eips.ethereum.org/EIPS/eip-8004
// Repo:      https://github.com/erc-8004/erc-8004-contracts
// ══════════════════════════════════════════════════════════════════════════════

// ── Identity Registry ABI (v2.0 from canonical repo) ────────────────────

export const identityRegistryAbi = [
  // register() - simple, no URI
  {
    type: "function",
    name: "register",
    inputs: [],
    outputs: [{ name: "agentId", type: "uint256" }],
    stateMutability: "nonpayable",
  },
  // register(string agentURI) - with URI only
  {
    type: "function",
    name: "register",
    inputs: [{ name: "agentURI", type: "string" }],
    outputs: [{ name: "agentId", type: "uint256" }],
    stateMutability: "nonpayable",
  },
  // register(string agentURI, MetadataEntry[] metadata) - full registration
  {
    type: "function",
    name: "register",
    inputs: [
      { name: "agentURI", type: "string" },
      {
        name: "metadata",
        type: "tuple[]",
        components: [
          { name: "metadataKey", type: "string" },
          { name: "metadataValue", type: "bytes" },
        ],
      },
    ],
    outputs: [{ name: "agentId", type: "uint256" }],
    stateMutability: "nonpayable",
  },
  // setAgentURI
  {
    type: "function",
    name: "setAgentURI",
    inputs: [
      { name: "agentId", type: "uint256" },
      { name: "newURI", type: "string" },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
  // getMetadata / setMetadata
  {
    type: "function",
    name: "getMetadata",
    inputs: [
      { name: "agentId", type: "uint256" },
      { name: "metadataKey", type: "string" },
    ],
    outputs: [{ name: "", type: "bytes" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "setMetadata",
    inputs: [
      { name: "agentId", type: "uint256" },
      { name: "metadataKey", type: "string" },
      { name: "metadataValue", type: "bytes" },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
  // Agent wallet management (EIP-712 signed)
  {
    type: "function",
    name: "setAgentWallet",
    inputs: [
      { name: "agentId", type: "uint256" },
      { name: "newWallet", type: "address" },
      { name: "deadline", type: "uint256" },
      { name: "signature", type: "bytes" },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "unsetAgentWallet",
    inputs: [{ name: "agentId", type: "uint256" }],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "getAgentWallet",
    inputs: [{ name: "agentId", type: "uint256" }],
    outputs: [{ name: "", type: "address" }],
    stateMutability: "view",
  },
  // Authorization check
  {
    type: "function",
    name: "isAuthorizedOrOwner",
    inputs: [
      { name: "spender", type: "address" },
      { name: "agentId", type: "uint256" },
    ],
    outputs: [{ name: "", type: "bool" }],
    stateMutability: "view",
  },
  // Version
  {
    type: "function",
    name: "getVersion",
    inputs: [],
    outputs: [{ name: "", type: "string" }],
    stateMutability: "pure",
  },
  // ERC-721 standard
  {
    type: "function",
    name: "ownerOf",
    inputs: [{ name: "tokenId", type: "uint256" }],
    outputs: [{ name: "", type: "address" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "tokenURI",
    inputs: [{ name: "tokenId", type: "uint256" }],
    outputs: [{ name: "", type: "string" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "balanceOf",
    inputs: [{ name: "owner", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
  },
  // Events
  {
    type: "event",
    name: "Registered",
    inputs: [
      { name: "agentId", type: "uint256", indexed: true },
      { name: "agentURI", type: "string", indexed: false },
      { name: "owner", type: "address", indexed: true },
    ],
  },
  {
    type: "event",
    name: "MetadataSet",
    inputs: [
      { name: "agentId", type: "uint256", indexed: true },
      { name: "indexedMetadataKey", type: "string", indexed: true },
      { name: "metadataKey", type: "string", indexed: false },
      { name: "metadataValue", type: "bytes", indexed: false },
    ],
  },
  {
    type: "event",
    name: "URIUpdated",
    inputs: [
      { name: "agentId", type: "uint256", indexed: true },
      { name: "newURI", type: "string", indexed: false },
      { name: "updatedBy", type: "address", indexed: true },
    ],
  },
] as const;

// ── Reputation Registry ABI (v2.0 from canonical repo) ──────────────────

export const reputationRegistryAbi = [
  {
    type: "function",
    name: "getIdentityRegistry",
    inputs: [],
    outputs: [{ name: "", type: "address" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "giveFeedback",
    inputs: [
      { name: "agentId", type: "uint256" },
      { name: "value", type: "int128" },
      { name: "valueDecimals", type: "uint8" },
      { name: "tag1", type: "string" },
      { name: "tag2", type: "string" },
      { name: "endpoint", type: "string" },
      { name: "feedbackURI", type: "string" },
      { name: "feedbackHash", type: "bytes32" },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "revokeFeedback",
    inputs: [
      { name: "agentId", type: "uint256" },
      { name: "feedbackIndex", type: "uint64" },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "appendResponse",
    inputs: [
      { name: "agentId", type: "uint256" },
      { name: "clientAddress", type: "address" },
      { name: "feedbackIndex", type: "uint64" },
      { name: "responseURI", type: "string" },
      { name: "responseHash", type: "bytes32" },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "readFeedback",
    inputs: [
      { name: "agentId", type: "uint256" },
      { name: "clientAddress", type: "address" },
      { name: "feedbackIndex", type: "uint64" },
    ],
    outputs: [
      { name: "value", type: "int128" },
      { name: "valueDecimals", type: "uint8" },
      { name: "tag1", type: "string" },
      { name: "tag2", type: "string" },
      { name: "isRevoked", type: "bool" },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "getLastIndex",
    inputs: [
      { name: "agentId", type: "uint256" },
      { name: "clientAddress", type: "address" },
    ],
    outputs: [{ name: "", type: "uint64" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "getSummary",
    inputs: [
      { name: "agentId", type: "uint256" },
      { name: "clientAddresses", type: "address[]" },
      { name: "tag1", type: "string" },
      { name: "tag2", type: "string" },
    ],
    outputs: [
      { name: "count", type: "uint64" },
      { name: "summaryValue", type: "int128" },
      { name: "summaryValueDecimals", type: "uint8" },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "getClients",
    inputs: [{ name: "agentId", type: "uint256" }],
    outputs: [{ name: "", type: "address[]" }],
    stateMutability: "view",
  },
  // readAllFeedback - batch read of all feedback entries (EIP-8004 v2.0)
  {
    type: "function",
    name: "readAllFeedback",
    inputs: [
      { name: "agentId", type: "uint256" },
      { name: "clientAddresses", type: "address[]" },
      { name: "tag1", type: "string" },
      { name: "tag2", type: "string" },
      { name: "includeRevoked", type: "bool" },
    ],
    outputs: [
      { name: "clients", type: "address[]" },
      { name: "feedbackIndexes", type: "uint64[]" },
      { name: "values", type: "int128[]" },
      { name: "valueDecimals", type: "uint8[]" },
      { name: "tag1s", type: "string[]" },
      { name: "tag2s", type: "string[]" },
      { name: "revokedStatuses", type: "bool[]" },
    ],
    stateMutability: "view",
  },
  // getResponseCount - count of responses to a specific feedback entry (EIP-8004 v2.0)
  {
    type: "function",
    name: "getResponseCount",
    inputs: [
      { name: "agentId", type: "uint256" },
      { name: "clientAddress", type: "address" },
      { name: "feedbackIndex", type: "uint64" },
      { name: "responders", type: "address[]" },
    ],
    outputs: [{ name: "count", type: "uint64" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "getVersion",
    inputs: [],
    outputs: [{ name: "", type: "string" }],
    stateMutability: "pure",
  },
  // Events
  {
    type: "event",
    name: "NewFeedback",
    inputs: [
      { name: "agentId", type: "uint256", indexed: true },
      { name: "clientAddress", type: "address", indexed: true },
      { name: "feedbackIndex", type: "uint64", indexed: false },
      { name: "value", type: "int128", indexed: false },
      { name: "valueDecimals", type: "uint8", indexed: false },
      { name: "indexedTag1", type: "string", indexed: true },
      { name: "tag1", type: "string", indexed: false },
      { name: "tag2", type: "string", indexed: false },
      { name: "endpoint", type: "string", indexed: false },
      { name: "feedbackURI", type: "string", indexed: false },
      { name: "feedbackHash", type: "bytes32", indexed: false },
    ],
  },
  {
    type: "event",
    name: "FeedbackRevoked",
    inputs: [
      { name: "agentId", type: "uint256", indexed: true },
      { name: "clientAddress", type: "address", indexed: true },
      { name: "feedbackIndex", type: "uint64", indexed: true },
    ],
  },
  {
    type: "event",
    name: "ResponseAppended",
    inputs: [
      { name: "agentId", type: "uint256", indexed: true },
      { name: "clientAddress", type: "address", indexed: true },
      { name: "feedbackIndex", type: "uint64", indexed: false },
      { name: "responder", type: "address", indexed: true },
      { name: "responseURI", type: "string", indexed: false },
      { name: "responseHash", type: "bytes32", indexed: false },
    ],
  },
] as const;

// ── Validation Registry ABI (v2.0 from canonical repo) ──────────────────

export const validationRegistryAbi = [
  {
    type: "function",
    name: "getIdentityRegistry",
    inputs: [],
    outputs: [{ name: "", type: "address" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "validationRequest",
    inputs: [
      { name: "validatorAddress", type: "address" },
      { name: "agentId", type: "uint256" },
      { name: "requestURI", type: "string" },
      { name: "requestHash", type: "bytes32" },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "validationResponse",
    inputs: [
      { name: "requestHash", type: "bytes32" },
      { name: "response", type: "uint8" },
      { name: "responseURI", type: "string" },
      { name: "responseHash", type: "bytes32" },
      { name: "tag", type: "string" },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "getValidationStatus",
    inputs: [{ name: "requestHash", type: "bytes32" }],
    outputs: [
      { name: "validatorAddress", type: "address" },
      { name: "agentId", type: "uint256" },
      { name: "response", type: "uint8" },
      { name: "responseHash", type: "bytes32" },
      { name: "tag", type: "string" },
      { name: "lastUpdate", type: "uint256" },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "getSummary",
    inputs: [
      { name: "agentId", type: "uint256" },
      { name: "validatorAddresses", type: "address[]" },
      { name: "tag", type: "string" },
    ],
    outputs: [
      { name: "count", type: "uint64" },
      { name: "avgResponse", type: "uint8" },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "getAgentValidations",
    inputs: [{ name: "agentId", type: "uint256" }],
    outputs: [{ name: "requestHashes", type: "bytes32[]" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "getValidatorRequests",
    inputs: [{ name: "validatorAddress", type: "address" }],
    outputs: [{ name: "", type: "bytes32[]" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "getVersion",
    inputs: [],
    outputs: [{ name: "", type: "string" }],
    stateMutability: "pure",
  },
  // Events
  {
    type: "event",
    name: "ValidationRequest",
    inputs: [
      { name: "validatorAddress", type: "address", indexed: true },
      { name: "agentId", type: "uint256", indexed: true },
      { name: "requestURI", type: "string", indexed: false },
      { name: "requestHash", type: "bytes32", indexed: true },
    ],
  },
  {
    type: "event",
    name: "ValidationResponse",
    inputs: [
      { name: "validatorAddress", type: "address", indexed: true },
      { name: "agentId", type: "uint256", indexed: true },
      { name: "requestHash", type: "bytes32", indexed: true },
      { name: "response", type: "uint8", indexed: false },
      { name: "responseURI", type: "string", indexed: false },
      { name: "responseHash", type: "bytes32", indexed: false },
      { name: "tag", type: "string", indexed: false },
    ],
  },
] as const;

// ══════════════════════════════════════════════════════════════════════════════
// Canonical contract addresses (CREATE2, same on all EVM chains)
// ══════════════════════════════════════════════════════════════════════════════

export const CANONICAL_ADDRESSES = {
  mainnet: {
    identityRegistry: "0x8004A169FB4a3325136EB29fA0ceB6D2e539a432" as `0x${string}`,
    reputationRegistry: "0x8004BAa17C55a88189AE136b182e5fdA19dE9b63" as `0x${string}`,
  },
  testnet: {
    identityRegistry: "0x8004A818BFB912233c491871b3d84c89A494BD9e" as `0x${string}`,
    reputationRegistry: "0x8004B663056A597Dffe9eCcC1965A193B7388713" as `0x${string}`,
  },
} as const;

/**
 * Resolve the correct registry addresses based on chain ID.
 * Falls back to env config, then to canonical addresses.
 */
function resolveRegistryAddresses() {
  const isTestnet = config.base.chainId === 84532;
  const canonical = isTestnet ? CANONICAL_ADDRESSES.testnet : CANONICAL_ADDRESSES.mainnet;

  return {
    identityRegistry: (config.erc8004.identityRegistry || canonical.identityRegistry) as `0x${string}`,
    reputationRegistry: (config.erc8004.reputationRegistry || canonical.reputationRegistry) as `0x${string}`,
    // ValidationRegistry is not yet in the canonical deployment
    validationRegistry: config.erc8004.validationRegistry || ("" as `0x${string}`),
  };
}

// ══════════════════════════════════════════════════════════════════════════════
// Helper: fire-and-forget with logging
// ══════════════════════════════════════════════════════════════════════════════

function ensureWallet() {
  if (!walletClient || !walletClient.account) {
    throw new Error("Wallet client not initialized for ERC-8004 operations");
  }
  return walletClient;
}

async function fireAndForget(
  label: string,
  txPromise: Promise<`0x${string}`>
): Promise<`0x${string}` | null> {
  try {
    const hash = await txPromise;
    erc8004Logger.info(`${label} tx: ${hash}`);
    publicClient
      .waitForTransactionReceipt({ hash })
      .then((receipt) => {
        erc8004Logger.info(`${label} confirmed in block ${receipt.blockNumber}`);
      })
      .catch((err) => {
        erc8004Logger.error(`${label} receipt failed`, err);
      });
    return hash;
  } catch (err) {
    erc8004Logger.error(`${label} FAILED`, err);
    return null;
  }
}

/**
 * Encode a string value as bytes for ERC-8004 metadata storage.
 */
function encodeMetadataBytes(value: string): `0x${string}` {
  return toHex(new TextEncoder().encode(value));
}

/**
 * Decode bytes from ERC-8004 metadata storage back to a string.
 */
function decodeMetadataBytes(hex: `0x${string}`): string {
  const bytes = Buffer.from(hex.slice(2), "hex");
  return new TextDecoder().decode(bytes);
}

// ══════════════════════════════════════════════════════════════════════════════
// Identity Registry Operations
// ══════════════════════════════════════════════════════════════════════════════

/**
 * Build the agent URI JSON for ERC-8004 registration.
 * This follows the standard agentURI schema from the spec.
 */
export function buildAgentURI(params: {
  name: string;
  description: string;
  agentAddress: string;
  gameEndpoint?: string;
}): string {
  const agentDoc = {
    name: params.name,
    description: params.description,
    version: "1.0.0",
    protocols: ["among-claws-v1"],
    endpoints: {
      game: params.gameEndpoint || `http://localhost:${config.server.port}/api`,
    },
    capabilities: [
      "social-deduction",
      "strategic-voting",
      "deception-detection",
      "alliance-formation",
    ],
    chain: {
      id: config.base.chainId,
      name: config.base.chainId === 84532 ? "Base Sepolia" : "Base",
      address: params.agentAddress,
    },
  };

  return `data:application/json,${encodeURIComponent(JSON.stringify(agentDoc))}`;
}

/**
 * Register an agent on the ERC-8004 Identity Registry.
 * Mints an ERC-721 token representing the agent's on-chain identity.
 *
 * Uses the full register(string, MetadataEntry[]) overload to set
 * game-specific metadata at registration time.
 */
export async function registerAgentIdentity(
  agentName: string,
  agentDescription: string,
  agentAddress: string,
  gameEndpoint?: string
): Promise<{ txHash: `0x${string}` | null; agentURI: string }> {
  const addrs = resolveRegistryAddresses();
  if (!addrs.identityRegistry) {
    erc8004Logger.warn("Identity Registry not configured, skipping registration");
    return { txHash: null, agentURI: "" };
  }

  const wc = ensureWallet();
  const agentURI = buildAgentURI({
    name: agentName,
    description: agentDescription,
    agentAddress,
    gameEndpoint,
  });

  // Encode metadata entries as proper hex bytes for the contract
  const metadata = [
    {
      metadataKey: "game",
      metadataValue: encodeMetadataBytes("among-claws"),
    },
    {
      metadataKey: "role",
      metadataValue: encodeMetadataBytes("player"),
    },
  ];

  const txHash = await fireAndForget(
    `RegisterAgent(${agentName})`,
    wc.writeContract({
      account: wc.account!,
      address: addrs.identityRegistry,
      abi: identityRegistryAbi,
      functionName: "register",
      args: [agentURI, metadata],
      chain: base,
    })
  );

  return { txHash, agentURI };
}

/**
 * Register an agent with URI only (no metadata).
 * Simpler alternative when metadata is not needed upfront.
 */
export async function registerAgentIdentitySimple(
  agentURI: string
): Promise<`0x${string}` | null> {
  const addrs = resolveRegistryAddresses();
  if (!addrs.identityRegistry) return null;

  const wc = ensureWallet();
  return fireAndForget(
    "RegisterAgentSimple",
    wc.writeContract({
      account: wc.account!,
      address: addrs.identityRegistry,
      abi: identityRegistryAbi,
      functionName: "register",
      args: [agentURI],
      chain: base,
    })
  );
}

/**
 * Update the URI for an already-registered agent.
 */
export async function updateAgentURI(
  agentId: bigint,
  newURI: string
): Promise<`0x${string}` | null> {
  const addrs = resolveRegistryAddresses();
  if (!addrs.identityRegistry) return null;

  const wc = ensureWallet();
  return fireAndForget(
    `UpdateURI(${agentId})`,
    wc.writeContract({
      account: wc.account!,
      address: addrs.identityRegistry,
      abi: identityRegistryAbi,
      functionName: "setAgentURI",
      args: [agentId, newURI],
      chain: base,
    })
  );
}

/**
 * Set metadata on an agent's identity.
 * Note: "agentWallet" is a reserved key and cannot be set via this function.
 */
export async function setAgentMetadata(
  agentId: bigint,
  key: string,
  value: string
): Promise<`0x${string}` | null> {
  const addrs = resolveRegistryAddresses();
  if (!addrs.identityRegistry) return null;

  const wc = ensureWallet();
  return fireAndForget(
    `SetMetadata(${agentId}, ${key})`,
    wc.writeContract({
      account: wc.account!,
      address: addrs.identityRegistry,
      abi: identityRegistryAbi,
      functionName: "setMetadata",
      args: [agentId, key, encodeMetadataBytes(value)],
      chain: base,
    })
  );
}

// ── Identity Registry Read Functions ────────────────────────────────────

export async function getAgentIdentityOwner(
  agentId: bigint
): Promise<`0x${string}` | null> {
  const addrs = resolveRegistryAddresses();
  if (!addrs.identityRegistry) return null;

  try {
    return (await publicClient.readContract({
      address: addrs.identityRegistry,
      abi: identityRegistryAbi,
      functionName: "ownerOf",
      args: [agentId],
    })) as `0x${string}`;
  } catch {
    return null;
  }
}

export async function getAgentIdentityURI(
  agentId: bigint
): Promise<string | null> {
  const addrs = resolveRegistryAddresses();
  if (!addrs.identityRegistry) return null;

  try {
    return (await publicClient.readContract({
      address: addrs.identityRegistry,
      abi: identityRegistryAbi,
      functionName: "tokenURI",
      args: [agentId],
    })) as string;
  } catch {
    return null;
  }
}

export async function getAgentMetadata(
  agentId: bigint,
  key: string
): Promise<string | null> {
  const addrs = resolveRegistryAddresses();
  if (!addrs.identityRegistry) return null;

  try {
    const result = await publicClient.readContract({
      address: addrs.identityRegistry,
      abi: identityRegistryAbi,
      functionName: "getMetadata",
      args: [agentId, key],
    });
    return decodeMetadataBytes(result as `0x${string}`);
  } catch {
    return null;
  }
}

export async function getAgentWallet(
  agentId: bigint
): Promise<`0x${string}` | null> {
  const addrs = resolveRegistryAddresses();
  if (!addrs.identityRegistry) return null;

  try {
    return (await publicClient.readContract({
      address: addrs.identityRegistry,
      abi: identityRegistryAbi,
      functionName: "getAgentWallet",
      args: [agentId],
    })) as `0x${string}`;
  } catch {
    return null;
  }
}

export async function isAuthorizedOrOwner(
  spender: `0x${string}`,
  agentId: bigint
): Promise<boolean> {
  const addrs = resolveRegistryAddresses();
  if (!addrs.identityRegistry) return false;

  try {
    return (await publicClient.readContract({
      address: addrs.identityRegistry,
      abi: identityRegistryAbi,
      functionName: "isAuthorizedOrOwner",
      args: [spender, agentId],
    })) as boolean;
  } catch {
    return false;
  }
}

export async function getRegistryVersion(
  registry: "identity" | "reputation" | "validation"
): Promise<string | null> {
  const addrs = resolveRegistryAddresses();
  let address: `0x${string}` | "" = "";
  let abi: typeof identityRegistryAbi | typeof reputationRegistryAbi | typeof validationRegistryAbi;

  switch (registry) {
    case "identity":
      address = addrs.identityRegistry;
      abi = identityRegistryAbi;
      break;
    case "reputation":
      address = addrs.reputationRegistry;
      abi = reputationRegistryAbi;
      break;
    case "validation":
      address = addrs.validationRegistry;
      abi = validationRegistryAbi;
      break;
  }

  if (!address) return null;

  try {
    return (await publicClient.readContract({
      address,
      abi,
      functionName: "getVersion",
    })) as string;
  } catch {
    return null;
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// Reputation Registry Operations
// ══════════════════════════════════════════════════════════════════════════════

/**
 * Submit reputation feedback for an agent after a game.
 * Called by the game engine to record agent performance on-chain.
 *
 * IMPORTANT: The canonical ReputationRegistry prevents self-feedback.
 * The caller (msg.sender) must NOT be the owner or approved operator
 * of the agent. This means a separate "feedback client" address should
 * submit feedback, not the agent's own wallet.
 *
 * Standard tags for Among Claws:
 *   tag1: "starred" | "successRate" | "deception" | "detection"
 *   tag2: "among-claws" (game identifier)
 */
export async function submitAgentFeedback(
  agentId: bigint,
  score: number,
  tag1: string,
  tag2: string,
  feedbackURI?: string
): Promise<`0x${string}` | null> {
  const addrs = resolveRegistryAddresses();
  if (!addrs.reputationRegistry) return null;

  const wc = ensureWallet();

  // Convert score to int128 with 2 decimals (e.g., 85.50 -> 8550)
  const scaledValue = BigInt(Math.round(score * 100));
  const feedbackHash =
    "0x0000000000000000000000000000000000000000000000000000000000000000" as `0x${string}`;

  return fireAndForget(
    `Feedback(agent=${agentId}, ${tag1}=${score})`,
    wc.writeContract({
      account: wc.account!,
      address: addrs.reputationRegistry,
      abi: reputationRegistryAbi,
      functionName: "giveFeedback",
      args: [
        agentId,
        scaledValue,
        2, // 2 decimal places
        tag1,
        tag2,
        `base:among-claws`,
        feedbackURI || "",
        feedbackHash,
      ],
      chain: base,
    })
  );
}

/**
 * Revoke previously submitted feedback.
 * Can only be called by the original feedback author.
 */
export async function revokeFeedback(
  agentId: bigint,
  feedbackIndex: bigint
): Promise<`0x${string}` | null> {
  const addrs = resolveRegistryAddresses();
  if (!addrs.reputationRegistry) return null;

  const wc = ensureWallet();
  return fireAndForget(
    `RevokeFeedback(agent=${agentId}, idx=${feedbackIndex})`,
    wc.writeContract({
      account: wc.account!,
      address: addrs.reputationRegistry,
      abi: reputationRegistryAbi,
      functionName: "revokeFeedback",
      args: [agentId, feedbackIndex],
      chain: base,
    })
  );
}

/**
 * Read a single feedback entry.
 */
export async function readFeedback(
  agentId: bigint,
  clientAddress: `0x${string}`,
  feedbackIndex: bigint
): Promise<{
  value: bigint;
  valueDecimals: number;
  tag1: string;
  tag2: string;
  isRevoked: boolean;
} | null> {
  const addrs = resolveRegistryAddresses();
  if (!addrs.reputationRegistry) return null;

  try {
    const [value, valueDecimals, tag1, tag2, isRevoked] = (await publicClient.readContract({
      address: addrs.reputationRegistry,
      abi: reputationRegistryAbi,
      functionName: "readFeedback",
      args: [agentId, clientAddress, feedbackIndex],
    })) as [bigint, number, string, string, boolean];

    return { value, valueDecimals, tag1, tag2, isRevoked };
  } catch {
    return null;
  }
}

/**
 * Get the reputation summary for an agent.
 *
 * IMPORTANT: The canonical contract requires clientAddresses to be non-empty.
 * If no specific clients are given, we first fetch all clients via getClients(),
 * then pass them to getSummary().
 */
export async function getAgentReputationSummary(
  agentId: bigint,
  tag1: string = "",
  tag2: string = "",
  clientAddresses?: `0x${string}`[]
): Promise<{ count: bigint; value: bigint; decimals: number } | null> {
  const addrs = resolveRegistryAddresses();
  if (!addrs.reputationRegistry) return null;

  try {
    // The canonical contract reverts if clientAddresses is empty.
    // Fetch all clients first if none specified.
    let clients = clientAddresses;
    if (!clients || clients.length === 0) {
      clients = await getAgentClients(agentId);
      if (!clients || clients.length === 0) {
        // No clients have left feedback yet
        return { count: 0n, value: 0n, decimals: 0 };
      }
    }

    const [count, summaryValue, summaryValueDecimals] = (await publicClient.readContract({
      address: addrs.reputationRegistry,
      abi: reputationRegistryAbi,
      functionName: "getSummary",
      args: [agentId, clients, tag1, tag2],
    })) as [bigint, bigint, number];

    return { count, value: summaryValue, decimals: summaryValueDecimals };
  } catch (err) {
    erc8004Logger.error(`getAgentReputationSummary(${agentId}) failed`, err);
    return null;
  }
}

/**
 * Get all unique client addresses that have submitted feedback for an agent.
 */
export async function getAgentClients(
  agentId: bigint
): Promise<`0x${string}`[]> {
  const addrs = resolveRegistryAddresses();
  if (!addrs.reputationRegistry) return [];

  try {
    return (await publicClient.readContract({
      address: addrs.reputationRegistry,
      abi: reputationRegistryAbi,
      functionName: "getClients",
      args: [agentId],
    })) as `0x${string}`[];
  } catch {
    return [];
  }
}

/**
 * Get the last feedback index for a specific client on an agent.
 */
export async function getLastFeedbackIndex(
  agentId: bigint,
  clientAddress: `0x${string}`
): Promise<bigint> {
  const addrs = resolveRegistryAddresses();
  if (!addrs.reputationRegistry) return 0n;

  try {
    return (await publicClient.readContract({
      address: addrs.reputationRegistry,
      abi: reputationRegistryAbi,
      functionName: "getLastIndex",
      args: [agentId, clientAddress],
    })) as bigint;
  } catch {
    return 0n;
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// Validation Registry Operations
// ══════════════════════════════════════════════════════════════════════════════

/**
 * Submit a validation request for an agent's game result.
 * Used to create verifiable proof of agent performance.
 *
 * The caller must be the owner or approved operator of the agentId.
 */
export async function requestAgentValidation(
  validatorAddress: `0x${string}`,
  agentId: bigint,
  requestURI: string,
  requestHash: `0x${string}`
): Promise<`0x${string}` | null> {
  const addrs = resolveRegistryAddresses();
  if (!addrs.validationRegistry) return null;

  const wc = ensureWallet();
  return fireAndForget(
    `ValidationRequest(agent=${agentId})`,
    wc.writeContract({
      account: wc.account!,
      address: addrs.validationRegistry,
      abi: validationRegistryAbi,
      functionName: "validationRequest",
      args: [validatorAddress, agentId, requestURI, requestHash],
      chain: base,
    })
  );
}

/**
 * Submit a validation response (called by the validator/engine).
 * Response is 0-100 (uint8).
 */
export async function submitValidationResponse(
  requestHash: `0x${string}`,
  response: number,
  responseURI: string,
  tag: string
): Promise<`0x${string}` | null> {
  const addrs = resolveRegistryAddresses();
  if (!addrs.validationRegistry) return null;

  const wc = ensureWallet();
  const responseHash =
    "0x0000000000000000000000000000000000000000000000000000000000000000" as `0x${string}`;

  return fireAndForget(
    `ValidationResponse(${response}/100)`,
    wc.writeContract({
      account: wc.account!,
      address: addrs.validationRegistry,
      abi: validationRegistryAbi,
      functionName: "validationResponse",
      args: [requestHash, response, responseURI, responseHash, tag],
      chain: base,
    })
  );
}

/**
 * Get validation status for a specific request.
 */
export async function getValidationStatus(
  requestHash: `0x${string}`
): Promise<{
  validatorAddress: `0x${string}`;
  agentId: bigint;
  response: number;
  responseHash: `0x${string}`;
  tag: string;
  lastUpdate: bigint;
} | null> {
  const addrs = resolveRegistryAddresses();
  if (!addrs.validationRegistry) return null;

  try {
    const [validatorAddress, agentId, response, responseHash, tag, lastUpdate] =
      (await publicClient.readContract({
        address: addrs.validationRegistry,
        abi: validationRegistryAbi,
        functionName: "getValidationStatus",
        args: [requestHash],
      })) as [`0x${string}`, bigint, number, `0x${string}`, string, bigint];

    return { validatorAddress, agentId, response, responseHash, tag, lastUpdate };
  } catch {
    return null;
  }
}

/**
 * Get validation summary for an agent.
 */
export async function getAgentValidationSummary(
  agentId: bigint,
  tag: string = ""
): Promise<{ count: bigint; averageResponse: number } | null> {
  const addrs = resolveRegistryAddresses();
  if (!addrs.validationRegistry) return null;

  try {
    const [count, averageResponse] = (await publicClient.readContract({
      address: addrs.validationRegistry,
      abi: validationRegistryAbi,
      functionName: "getSummary",
      args: [agentId, [], tag],
    })) as [bigint, number];

    return { count, averageResponse };
  } catch {
    return null;
  }
}

/**
 * Get all validation request hashes for an agent.
 */
export async function getAgentValidations(
  agentId: bigint
): Promise<`0x${string}`[]> {
  const addrs = resolveRegistryAddresses();
  if (!addrs.validationRegistry) return [];

  try {
    return (await publicClient.readContract({
      address: addrs.validationRegistry,
      abi: validationRegistryAbi,
      functionName: "getAgentValidations",
      args: [agentId],
    })) as `0x${string}`[];
  } catch {
    return [];
  }
}

/**
 * Get all validation request hashes assigned to a validator.
 */
export async function getValidatorRequests(
  validatorAddress: `0x${string}`
): Promise<`0x${string}`[]> {
  const addrs = resolveRegistryAddresses();
  if (!addrs.validationRegistry) return [];

  try {
    return (await publicClient.readContract({
      address: addrs.validationRegistry,
      abi: validationRegistryAbi,
      functionName: "getValidatorRequests",
      args: [validatorAddress],
    })) as `0x${string}`[];
  } catch {
    return [];
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// Game Result Receipts
// ══════════════════════════════════════════════════════════════════════════════

export interface GameReceipt {
  gameId: string;
  agentId: bigint;
  agentAddress: `0x${string}`;
  role: string;
  won: boolean;
  roundsPlayed: number;
  eliminations: number;
  timestamp: number;
}

/**
 * Create a verifiable receipt hash for a game result.
 * This hash can be used as a requestHash in the ValidationRegistry
 * to create an on-chain proof of the game outcome.
 */
export function createGameReceiptHash(receipt: GameReceipt): `0x${string}` {
  return keccak256(
    encodePacked(
      ["string", "uint256", "address", "string", "bool", "uint256", "uint256", "uint256"],
      [
        receipt.gameId,
        receipt.agentId,
        receipt.agentAddress,
        receipt.role,
        receipt.won,
        BigInt(receipt.roundsPlayed),
        BigInt(receipt.eliminations),
        BigInt(receipt.timestamp),
      ]
    )
  );
}

/**
 * Submit a full game result as a validation request + response.
 * This creates a verifiable on-chain record of an agent's game performance.
 *
 * Flow:
 * 1. Hash the game result data into a requestHash
 * 2. Submit a validationRequest linking the agent to this hash
 * 3. Immediately submit a validationResponse with the score
 */
export async function recordGameResult(
  receipt: GameReceipt,
  validatorAddress: `0x${string}`,
  score: number,
  tag: string = "game-result"
): Promise<{
  requestHash: `0x${string}`;
  requestTxHash: `0x${string}` | null;
  responseTxHash: `0x${string}` | null;
}> {
  const requestHash = createGameReceiptHash(receipt);
  const receiptJSON = JSON.stringify(receipt);
  const requestURI = `data:application/json,${encodeURIComponent(receiptJSON)}`;

  // Submit validation request (must be called by agent owner/operator)
  const requestTxHash = await requestAgentValidation(
    validatorAddress,
    receipt.agentId,
    requestURI,
    requestHash
  );

  // Submit validation response (must be called by the validator)
  // Score: 0-100 mapping game performance
  const responseTxHash = await submitValidationResponse(
    requestHash,
    Math.min(100, Math.max(0, Math.round(score))),
    requestURI,
    tag
  );

  return { requestHash, requestTxHash, responseTxHash };
}

// ══════════════════════════════════════════════════════════════════════════════
// Convenience: Full agent identity query
// ══════════════════════════════════════════════════════════════════════════════

export interface AgentIdentityProfile {
  agentId: bigint;
  owner: `0x${string}`;
  agentWallet: `0x${string}` | null;
  uri: string | null;
  game: string | null;
  role: string | null;
  reputation: { count: bigint; value: bigint; decimals: number } | null;
  validationSummary: { count: bigint; averageResponse: number } | null;
}

/**
 * Fetch a comprehensive identity profile for an agent,
 * including metadata, reputation, and validation summaries.
 */
export async function getAgentProfile(
  agentId: bigint
): Promise<AgentIdentityProfile | null> {
  const owner = await getAgentIdentityOwner(agentId);
  if (!owner) return null;

  // Fetch all data in parallel
  const [agentWallet, uri, game, role, reputation, validationSummary] =
    await Promise.all([
      getAgentWallet(agentId),
      getAgentIdentityURI(agentId),
      getAgentMetadata(agentId, "game"),
      getAgentMetadata(agentId, "role"),
      getAgentReputationSummary(agentId, "", "among-claws"),
      getAgentValidationSummary(agentId, "game-result"),
    ]);

  return {
    agentId,
    owner,
    agentWallet,
    uri,
    game,
    role,
    reputation,
    validationSummary,
  };
}

// ══════════════════════════════════════════════════════════════════════════════
// Configuration helpers
// ══════════════════════════════════════════════════════════════════════════════

/**
 * Check if ERC-8004 registries are configured (either from env or canonical defaults).
 */
export function isErc8004Configured(): boolean {
  const addrs = resolveRegistryAddresses();
  return !!addrs.identityRegistry;
}

/**
 * Log the current ERC-8004 configuration status.
 */
export function logErc8004Status(): void {
  const addrs = resolveRegistryAddresses();

  if (addrs.identityRegistry) {
    erc8004Logger.info(`Identity Registry: ${addrs.identityRegistry}`);
  } else {
    erc8004Logger.warn("Identity Registry: Not configured");
  }
  if (addrs.reputationRegistry) {
    erc8004Logger.info(`Reputation Registry: ${addrs.reputationRegistry}`);
  } else {
    erc8004Logger.warn("Reputation Registry: Not configured");
  }
  if (addrs.validationRegistry) {
    erc8004Logger.info(`Validation Registry: ${addrs.validationRegistry}`);
  } else {
    erc8004Logger.info("Validation Registry: Not deployed in canonical set (set ERC8004_VALIDATION_REGISTRY to use)");
  }
}
