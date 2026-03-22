# Among Claws Multi-Bounty Strategy

## Core Thesis
We're the only project combining social deduction game mechanics with real economic stakes.
This lets us target 7+ tracks simultaneously because each integration is load-bearing, not bolted on.

## Primary Targets ($51.3K)

### 1. Open Track ($28,309)
**Pitch:** Only social deduction game at Synthesis. Multi-agent coordination where agents think, deceive, cooperate, vote, trade, pay, and build reputation in one system.
**Evidence:** Zero competitors in this space across 433 submissions.

### 2. Base ($10,000 across 2 sub-tracks)
**Pitch:** 7 smart contracts deployed on Base Sepolia. Autonomous trading agents making real Uniswap decisions. Agent services (prediction markets, auctions, trading competitions) running on Base.
**Evidence:** 168/168 contract tests passing. Real on-chain transactions confirmed in E2E tests.

### 3. Protocol Labs ($8,000 across 2 sub-tracks)
**Pitch:**
- "Let Agent Cook" ($4K): Agents run autonomously with zero human intervention. Multi-arena orchestrator handles prediction markets, trading, and auctions concurrently.
- "ERC-8004 Agents w/ Receipts" ($4K): Full ERC-8004 integration with cross-arena reputation recording. Game results become on-chain reputation feedback.
**Evidence:** erc8004.ts (726 lines) with all three registries. Cross-arena reputation tx confirmed on-chain.

### 4. Uniswap ($5,000)
**Pitch:** Agents make strategic Uniswap trades based on game outcomes. Trading Competition arena pits agents head-to-head in portfolio battles using real Uniswap Trading API.
**Evidence:** uniswap.ts + uniswapRoutes.ts with quote/approve/swap/broadcast endpoints. 12 trades executed in E2E test.

### 5. Locus ($3,000)
**Pitch:** USDC payments for game entry, agent service purchases, betting, and cross-agent payments. Full spending controls with daily limits and per-transaction caps.
**Evidence:** locus.ts (698 lines) with 10 endpoints. Basically uncontested (1 competitor in this track).

## Secondary Targets ($19.5K)

### 6. Venice ($11,500)
**Pitch:** Venice AI's zero data retention is perfect for agent deception. The impostor's reasoning stays private. No other project has a game-theory reason for needing private LLM inference.
**Requirement:** Need to verify VVV token integration is feasible.
**Evidence:** AgentBrain supports Venice as LLM provider.

### 7. Bankr ($5,000)
**Pitch:** Self-funding LLM inference. Game winnings pay for future agent decisions through Bankr gateway routing.
**Evidence:** AgentBrain supports Bankr as LLM provider with fallback cascade.

### 8. Lido ($9,500)
**Note:** This is a separate project opportunity (Lido MCP Server). Not part of Among Claws directly. Worth building separately if time allows.

## Why Multi-Bounty Works for Us

Most projects target 1-2 tracks because their integrations are shallow.
Our integrations are structural:

- ERC-8004 isn't a badge, it's the identity system that tracks reputation across games
- Uniswap isn't a demo swap, it's the post-game economy where trading performance feeds leaderboards
- Locus isn't a payment button, it's the entry fee + service market + betting system
- Base isn't just deployment, it's 7 contracts governing game logic, betting, tournaments, and seasons
- Venice isn't just another LLM, it's private reasoning for a deception game where secrecy matters

## Competitive Advantages

1. **Zero direct competitors** in social deduction across 433 submissions
2. **Cross-sponsor coherence**: One project, 7 tracks, each integration meaningful
3. **4 arena types**: Not just one game, a full competitive framework
4. **168 passing tests**: More than most competitors combined
5. **Live deployment**: claws-wars.vercel.app + engine E2E tested
6. **Theme alignment**: Pay + Trust + Cooperate + Secrets all hit naturally
