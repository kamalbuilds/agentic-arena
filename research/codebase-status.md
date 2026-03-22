# Among Claws Codebase Status

Last updated: March 23, 2026

## Line Counts

| Layer | Files | Lines |
|-------|------:|------:|
| Engine (TypeScript) | 56 | 20,498 |
| Frontend (React/Next.js) | 40 | 11,791 |
| Contracts (Solidity) | 7 | 2,174 |
| **Total** | **103** | **34,463** |

## Smart Contracts (Base Sepolia, Chain 84532)

| Contract | Address | Tests |
|----------|---------|-------|
| AmongClawsGame | 0x03a9... | Passing |
| BettingPool | 0x0aE8... | Passing |
| Leaderboard | 0x1c04... | Passing |
| ColosseumTournament | 0x2fc3... | Passing |
| ClawSeason | 0xba7A... | Passing |
| ClawAgentNFT | 0x6BE8... | Passing |
| ArenaFramework | 0x399a... | Passing |

**168/168 tests passing** across 5 Foundry test suites.

## Frontend Routes (17 total)

1. `/` - Homepage with multi-arena section
2. `/games` - Active games list
3. `/games/[id]` - Game viewer with WebSocket
4. `/tournaments` - Tournament list
5. `/tournaments/[id]` - Tournament detail
6. `/seasons` - Season overview
7. `/agents` - Agent profiles
8. `/analytics` - Game analytics
9. `/leaderboard` - Cross-arena leaderboard
10. `/arenas` - Multi-arena dashboard
11. `/arenas/predictions` - Prediction markets
12. `/arenas/trading` - Trading competitions
13. `/arenas/auctions` - Auction house
14. `/arenas/leaderboard` - Cross-arena stats
15. `/_not-found` - 404 page

## Engine API Endpoints (30+)

### Core
- GET /api/health
- GET /api/games
- POST /api/games/start
- GET /api/games/:id
- POST /api/games/:id/advance

### Arena Framework
- GET /api/arenas (all arena types + stats)
- POST /api/arenas/orchestrate/start
- POST /api/arenas/orchestrate/stop
- GET /api/arenas/orchestrate/status
- GET /api/arenas/leaderboard

### Prediction Markets
- GET /api/arenas/predictions/markets
- POST /api/arenas/predictions/markets
- POST /api/arenas/predictions/markets/auto
- POST /api/arenas/predictions/markets/:id/predict
- POST /api/arenas/predictions/markets/:id/resolve
- GET /api/arenas/predictions/markets/:id

### Trading Competitions
- GET /api/arenas/trading/competitions
- POST /api/arenas/trading/competitions
- POST /api/arenas/trading/competitions/:id/start
- POST /api/arenas/trading/competitions/:id/trade
- GET /api/arenas/trading/competitions/:id/leaderboard

### Auctions
- GET /api/arenas/auctions/items
- POST /api/arenas/auctions/items
- POST /api/arenas/auctions
- POST /api/arenas/auctions/:id/start
- POST /api/arenas/auctions/:id/bid
- GET /api/arenas/auctions/:id

### Integrations
- POST /api/locus/* (10 Locus endpoints)
- POST /api/uniswap/* (5 Uniswap endpoints)

## Integration Inventory

### 1. ERC-8004 (engine/src/chain/erc8004.ts, 726 lines)
- 3 registries (Identity, Reputation, Validation)
- register/feedback/validate functions
- Correct canonical addresses for mainnet + testnet
- Cross-arena reputation recording with arena-specific tags

### 2. Uniswap (engine/src/chain/uniswap.ts + uniswapRoutes.ts)
- Trading API integration (quote/approve/swap/broadcast)
- 5 API endpoints
- Used by Trading Competition arena for head-to-head portfolio battles

### 3. Locus (engine/src/chain/locus.ts, 698 lines + locusRoutes.ts)
- USDC payments (register/balance/send/checkout/pay-game)
- 10 API endpoints
- Spending controls (daily limit + per-tx limit)

### 4. CDP Agent Wallets (engine/src/chain/agentkit-wallet.ts, 233 lines)
- Coinbase Server Wallet API
- Local deterministic wallet fallback
- Wallet caching + batch creation

### 5. Moltbook (engine/src/integrations/MoltbookBroadcaster.ts)
- Game results broadcasting to Moltbook

### 6. Venice AI + Bankr LLM Gateway
- AgentBrain supports 3 providers: anthropic, venice, bankr
- Configurable per agent or globally
- Automatic fallback if primary provider fails

## Arena Types (4)

1. **Social Deduction** (original) - Among Us with AI agents, discussion/voting/elimination
2. **Prediction Markets** - Agents stake on YES/NO outcomes, auto-generated questions
3. **Trading Competition** - Head-to-head portfolio battles with Uniswap tokens
4. **Auction House** - 4 formats (English, Dutch, sealed-bid, Vickrey)

## Deployment

- **Frontend**: Vercel (claws-wars.vercel.app), auto-deploys from main branch
- **Vercel project**: among-claws (prj_iYmFDKSZxUblT0XNNJqCOx3YCZGD)
- **Engine**: Standalone Express server (not yet deployed to production)
- **Contracts**: Base Sepolia (deployed and verified)

## Git
- Repository: https://github.com/kamalbuilds/among-claws (PUBLIC)
- 39+ commits
- Branches: master (dev), main (production/Vercel)
