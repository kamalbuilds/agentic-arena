# Coinbase AgentKit Documentation

## Package
`npm install @coinbase/agentkit`
- Requires Node.js 22+
- Requires CDP API Key + Secret (from Coinbase Developer Platform)
- Smart wallets ONLY on Base (base-sepolia, base-mainnet)
- 50+ TypeScript actions, protocol integrations

## Setup

```typescript
import { AgentKit, CdpWalletProvider } from "@coinbase/agentkit";

const walletProvider = await CdpWalletProvider.configureWithWallet({
  apiKeyId: "CDP_API_KEY_ID",
  apiKeyPrivate: "CDP_API_KEY_SECRET",
  networkId: "base-sepolia", // or "base-mainnet"
});

const agentKit = await AgentKit.from({ walletProvider });
```

## Wallet Providers

| Provider | Description | Use Case |
|----------|-------------|----------|
| `CdpWalletProvider` | Server-managed CDP wallets | Standard backend agents |
| `CdpSmartWalletProvider` | ERC-4337 smart wallets | Base-only, gasless UX |
| `CdpEvmWalletProvider` | EVM wallet with CDP key mgmt | General EVM |
| `ViemWalletProvider` | Local viem-based signing | Testing, self-hosted |

## Framework Integrations

- **LangChain**: `@coinbase/agentkit-langchain` + `getLangChainTools(agentKit)`
- **Vercel AI SDK**: Direct integration available
- **MCP**: Extension available for Claude Code / cursor

## CLI Setup

```bash
npm create onchain-agent@latest
# Interactive: choose framework, template, network, wallet provider
```

## Protocol Integrations (50+ actions)

AgentKit comes with built-in actions for:
- Token transfers (ETH, ERC-20)
- Token swaps (via Uniswap)
- NFT minting (ERC-721)
- Lending (Compound, Morpho)
- OpenSea marketplace
- Alchemy API calls

## Our Integration Status

File: `engine/src/chain/agentkit-wallet.ts` (233 lines)

Our implementation uses CDP REST API + viem directly (NOT the @coinbase/agentkit npm package).

Implements:
- CDP Server Wallet API (POST to api.cdp.coinbase.com/v2/wallets)
- Local deterministic wallet fallback (HMAC-SHA256 derivation from agent name)
- Wallet caching
- Batch creation for game agents

Could upgrade to use full AgentKit for:
- Built-in Uniswap swaps
- NFT minting for agent identities
- Compound/Morpho lending
- But current implementation works fine for our needs

## Environment Variables Needed
```
CDP_API_KEY_ID=...
CDP_API_KEY_SECRET=...
```

These go in the engine's .env file. Already have config slots ready.
