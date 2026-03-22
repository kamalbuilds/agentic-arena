# ERC-8004 Specification (As Researched)

Trustless agent identity standard on Base Mainnet. Three registries: Identity, Reputation, Validation.
Minted automatically during Synthesis registration (/register/complete).
Chitin is the soul identity layer built on top of ERC-8004 registries.

## Canonical Addresses (CREATE2, same on all EVM chains)

### Mainnet
- Identity Registry: `0x8004A169FB4a3325136EB29fA0ceB6D2e539a432`
- Reputation Registry: `0x8004BAa17C55a88189AE136b182e5fdA19dE9b63`

### Testnet (Base Sepolia)
- Identity Registry: `0x8004A818BFB912233c491871b3d84c89A494BD9e`
- Reputation Registry: `0x8004B663056A597Dffe9eCcC1965A193B7388713`

Note: The `0x8004` prefix is a vanity address consistent with the standard name.

## Three Registries

### 1. Identity Registry (ERC-721)
One NFT per agent. Stores agentURI (off-chain metadata) and on-chain key-value metadata.

**Key functions:**
- `register(agentURI)` -> uint256 agentId
- `register(agentURI, MetadataEntry[] metadata)` -> uint256 agentId
- `setAgentURI(agentId, newURI)`
- `setAgentWallet(agentId, newWallet, deadline, signature)` (EIP-712 signed)
- `getAgentWallet(agentId)` -> address
- `isAuthorizedOrOwner(spender, agentId)` -> bool
- `getMetadata(agentId, key)` -> string
- `setMetadata(agentId, key, value)`

### 2. Reputation Registry
Feedback signals from any address about any agent. Supports revocation, responses, summaries.

**Key functions:**
- `giveFeedback(agentId, value, decimals, tag1, tag2, endpoint, feedbackURI, feedbackHash)`
  - value: int128 (can be negative for bad feedback)
  - decimals: uint8 (0-18, like ERC-20)
  - tag1, tag2: bytes32 (categorize feedback, e.g. "game:win", "arena:prediction")
  - endpoint: string (what service was used)
  - feedbackURI: string (off-chain details)
  - feedbackHash: bytes32 (integrity proof of off-chain data)
- `readFeedback(feedbackId)` -> FeedbackEntry
- `getSummary(agentId, clientAddresses[], tag1, tag2)` -> (count, summaryValue, decimals)
- `getClients(agentId)` -> address[] (who has given feedback)
- `revokeFeedback(feedbackId)`
- `respondToFeedback(feedbackId, responseURI)`

### 3. Validation Registry
Request/response flow for validating agent capabilities. Response is 0-100 scale.
Still evolving per spec authors.

**Key functions:**
- `validationRequest(agentId, ...params)`
- `validationResponse(requestId, score, ...)` (score 0-100)

## Agent Registration File (Off-chain JSON at agentURI)

```json
{
  "type": "agent",
  "name": "Among Claws Arena Agent",
  "description": "Autonomous social deduction agent with cross-arena competition",
  "image": "ipfs://...",
  "services": [
    {
      "name": "Social Deduction Game",
      "endpoint": "https://api.claws-wars.vercel.app/api/games",
      "version": "1.0"
    },
    {
      "name": "Prediction Markets",
      "endpoint": "https://api.claws-wars.vercel.app/api/arenas/predictions",
      "version": "1.0"
    }
  ],
  "x402Support": true,
  "active": true,
  "registrations": [
    {
      "agentId": 123,
      "agentRegistry": "0x8004A818BFB912233c491871b3d84c89A494BD9e"
    }
  ],
  "supportedTrust": ["reputation", "crypto-economic"]
}
```

## Our Integration Status

File: `engine/src/chain/erc8004.ts` (726 lines)

Implements:
- Full Identity Registry ABI (register, setAgentURI, metadata, wallet management)
- Full Reputation Registry ABI (giveFeedback, readFeedback, getSummary, getClients)
- Correct canonical contract addresses for both mainnet and testnet
- `registerAgent()` function for game agents
- `submitAgentFeedback()` for recording game results as reputation
- Cross-arena reputation recording with arena-specific tags

Confirmed working:
- Agent registration tx confirmed (block 39218109 on Base Sepolia)
- Reputation feedback tx confirmed (0xb3192a... on Base Sepolia)

## ERC-8004 Ecosystem at Synthesis

10+ projects using ERC-8004 (see competitor-repos.md for details):
- SentinelNet: Reputation scoring for all 35K+ registered agents
- Sentinel Trust Oracle: Privacy-preserving trust via Venice + EAS
- Liveness Oracle: Permissionless heartbeat verification
- MoltForge: Labor marketplace with Merit SBT
- Khora: On-chain pixel art agent identity generator
- Execution Market: Bidirectional task marketplace on 15 networks

Key insight: ERC-8004 is table stakes at Synthesis. Every serious project uses it. Our differentiation is that reputation has REAL economic consequences (gates arena access, feeds leaderboards, influences matchmaking).
