# Synthesis Hackathon 2026 Competitor Research

**Date gathered:** March 22, 2026
**Source:** GitHub API + `gh` CLI searches

---

## Search Summary

The following searches were executed:

- `gh search repos "synthesis hackathon 2026"` (30 results)
- `gh search repos "among us ai agent"`
- `gh search repos "social deduction ai"`
- `gh search repos "multi-agent arena"`
- `gh search repos "erc-8004"`
- `gh search repos "agentic finance uniswap"`
- Direct GitHub API searches for specific named projects

Named projects (PvP Arena/Antigravity, DarwinFi, Ghost Engine/Maxwell Demon, Beaver Warrior Sentinel, TrustFlow AI, Agent Wallet Runtime/Antigravity, Celo8004) were **not found** on GitHub under those exact names. This suggests they may be under different repo names, private, or unsubmitted as of March 22.

The repos below are confirmed public competitors.

---

## Top Competitors Found

---

### 1. SentinelNet

**GitHub:** https://github.com/Ridwannurudeen/sentinelnet
**Stars:** 0
**Last Updated:** 2026-03-22
**Language:** Python
**Description:** Autonomous agent reputation watchdog for ERC-8004 on Base

**README Summary:**

SentinelNet calls itself "the immune system for the ERC-8004 agent economy." It runs 24/7 with no human in the loop, scanning 35,000+ registered agents. Key stats it claims:

- 3,237 agents scored
- 1,920 sybil agents flagged across 78 wallets and 859 coordinated clusters
- 5,224 threat events detected
- 355+ gasless UserOperations via CDP Paymaster (ERC-4337)
- Live dashboard at sentinelnet.gudman.xyz

**Tech Stack:** Python, Base (ERC-8004 Identity Registry, ERC-8004 Reputation Registry), CDP Paymaster (ERC-4337), IPFS/Pinata, Staking contract, MCP + REST + Python/JS SDK

**Architecture highlights:**
- Progressive discovery of full 35K+ agent registry (cursor-based)
- 5-dimensional trust analyzer pipeline
- Sybil detector (dual-method: wallet-sharing + interaction graph cliques)
- Trust contagion via PageRank propagation
- Exponential trust decay
- Webhook system + WebSocket live feed
- Prometheus metrics endpoint

**What is innovative:**
PageRank-style trust contagion is the standout mechanic: interacting with bad agents drags your own score down, creating systemic pressure toward trustworthy agent behavior. The sybil detection at 35K scale, with staked ETH behind every published score, is the most complete trust layer we've seen at this hackathon.

---

### 2. Sentinel Trust Oracle

**GitHub:** https://github.com/geeythree/sentinel-trust-oracle
**Stars:** 0
**Last Updated:** 2026-03-22
**Language:** (not specified)
**Description:** Autonomous agent that verifies ERC-8004 agent identities and writes trust scores on-chain via EAS attestations on Base

**README Summary:**

Different project from SentinelNet above. This one emphasizes **privacy-first** trust scoring using Venice AI for zero-data-retention LLM inference.

**Tech Stack:** ERC-8004, EAS (Ethereum Attestation Service) on Base, Venice AI (no-data-retention inference), Base

**Architecture highlights:**
- 4-dimensional scoring: identity verification, liveness, on-chain history, Venice LLM interpretation
- Venice produces verifiable on-chain EAS attestations without exposing agent metadata
- 3-wallet model to prevent self-scoring
- Input capped at 4KB and sanitized to prevent prompt injection
- LLM score is only 30% of composite score (mechanical checks anchor it)

**What is innovative:**
The privacy-preserving architecture is genuinely thoughtful: Venice AI's zero data-retention means agent manifests are never stored by the evaluator LLM. The 3-wallet model prevents conflicts of interest. The "Venice is essential not optional" argument with specific examples is well-reasoned and differentiates this from naive LLM-scoring approaches.

---

### 3. AutoResearch (closest match to "DarwinFi")

**GitHub:** https://github.com/darks0l/autoresearch
**Stars:** 1
**Last Updated:** 2026-03-22
**Language:** JavaScript
**Description:** Autonomous DEX strategy discovery via Karpathy-style autoresearch with LCM memory, Synthesis Hackathon 2026, Base DEX, Uniswap V3 + Aerodrome

**README Summary:**

An AI agent that iteratively mutates, backtests, and evolves trading strategies against real Uniswap V3 + Aerodrome data on Base. Built in 12 hours during the hackathon.

**Tech Stack:** Node.js 20+, Uniswap V3, Aerodrome (Base DEX), Bankr LLM Gateway, OpenClaw skill, LCM (Lossless Context Management) memory, x402 micropayments

**Architecture highlights:**
- Karpathy-style autoresearch loop: propose mutation, backtest, keep if improved, revert + log if worse
- LCM memory: every experiment logged, agent queries "what worked? what failed?" before each mutation
- 10 technical indicators (RSI, MACD, BB, ATR, VWAP, Stochastic, OBV and more)
- Regime detection + production execution engine
- Daemon service runs post-hackathon autonomously
- Claims score improvement from 0.421 to 8.176 over session (71+ live trades on Base mainnet)

**What is innovative:**
The self-improving research loop where the agent reads its own failure log before each new experiment is a clean application of Karpathy's "autoregressive LLM research" idea to DeFi. The key differentiator from static bots: strategies evolve via LLM-guided mutation rather than manual parameter tuning. 14 source modules, 51 tests, built from zero in 12 hours.

---

### 4. Synthesis Agent (same team as AutoResearch)

**GitHub:** https://github.com/darks0l/synthesis-agent
**Stars:** 1
**Last Updated:** 2026-03-22
**Language:** JavaScript
**Description:** Autonomous agent economy orchestrator, ERC-8004 identity, LLM routing, on-chain trading

**README Summary:**

Broader platform from the same builder. Described as "the agent that runs a business" rather than a chatbot with a wallet.

**Tech Stack:** Node.js 22+, Base, ERC-8004, ERC-8183 (Agentic Commerce), Status Network (gasless), Bankr LLM Gateway, 6-provider LLM cascade (Bankr, OpenAI, Anthropic, OpenRouter, Ollama, heuristic fallback), Virtuals ACP v2, AgentMail

**Architecture highlights:**
- 3 DEX price sources for cross-exchange arbitrage detection
- 14-indicator TA engine
- 6-provider LLM cascade with automatic fallback
- Auto-refuel: swaps USDC to ETH when gas runs low
- Outsources skills via ERC-8183 on-chain job contracts with USDC escrow
- Cross-posts to Virtuals ACP v2 for cross-ecosystem agent discovery
- Validates outsourced work against its own trade history
- Real-time web dashboard via WebSocket
- 71/71 tests passing

**What is innovative:**
The closed economic loop is the core innovation: trade profits fund LLM inference, which improves trading decisions, which generates more profit, which funds better external agent skills. The 6-provider LLM cascade with automatic fallback is production-hardened in a way most hackathon projects are not. Outsourcing subtasks to other agents via on-chain escrow and validating results against internal history is an early A2A commerce pattern.

---

### 5. The Kitchen (9-Agent Swarm)

**GitHub:** https://github.com/Zedit42/the-kitchen
**Stars:** 0
**Last Updated:** 2026-03-22
**Language:** (not specified)
**Description:** 9-agent autonomous swarm: earns through trading, builds products from Reddit ideas, markets via auto-generated content. Self-sustaining AI agent economy.

**README Summary:**

"Let the agent cook" is their framing. XEONEN is the lead orchestrator agent (CTO role) managing 4 sub-engines:

- Revenue Engine: oracle arbitrage (Polymarket/Chainlink/Binance), momentum trading on Hyperliquid (V512, V515, V8 strategies), copy trading
- Build Engine: Reddit-sourced product ideas, fully automated product creation
- Marketing Engine: autonomous social media management
- Ops Engine: treasury management and reinvestment

**Tech Stack:** Python, Hyperliquid, Polymarket, Chainlink, Binance API, WebSocket, multi-agent orchestration

**Architecture highlights:**
- V512 strategy: 12-month backtest $1K to $26,296 (+2,530%), 105 trades, 31% WR, 7.4:1 R:R
- V515 Hybrid: 349% ROI backtest, adaptive EMA, circuit breaker after 4 consecutive losses
- Oracle arbitrage: detects Chainlink vs Binance vs Polymarket price lag
- Agents reinvest profits as liquidity for new projects
- No human writes code, no human picks trades, no human schedules posts

**What is innovative:**
The fully integrated earn/build/market/reinvest loop is the most ambitious scope at this hackathon. Most projects build one layer; this builds all four. The oracle arbitrage strategy (detecting price lag between Chainlink, Binance, and Polymarket prediction markets) is an unusual and potentially high-alpha edge that most trading agents miss.

---

### 6. Execution Market (Universal Execution Layer)

**GitHub:** https://github.com/UltravioletaDAO/execution-market
**Stars:** 1
**Last Updated:** 2026-03-22
**Language:** Python
**Description:** Universal Execution Layer, bidirectional AI to human task marketplace, gasless x402 payments on 9 chains, on-chain escrow, ERC-8004 identity, A2A Protocol + 24 MCP tools. Live on Base.

**README Summary:**

A bidirectional marketplace: AI agents delegate real-world tasks to humans (A2H), and humans commission AI agents for tasks (H2A). Payment is instant, gasless, on-chain. Reputation is portable.

**Tech Stack:** FastMCP + FastAPI (Python 3.10+), Supabase (PostgreSQL), S3 + CloudFront, x402 SDK (EIP-3009 gasless), x402r Escrow, ERC-8004 (15 networks), ERC-8128 (signed HTTP requests), A2A Protocol v0.3.0 JSON-RPC, MCP (streamable HTTP), WebSocket, 105 REST endpoints

**Architecture highlights:**
- Bidirectional: A2H (agent posts task, human executes) + H2A (human posts task, agent executes)
- 87% payout to worker, 13% platform fee, with bidirectional reputation update on settlement
- Gasless across 9 chains via x402 SDK
- 24 MCP tools for agent integration
- Agent #2106 registered on ERC-8004
- Evidence CDN via S3 + CloudFront

**What is innovative:**
The bidirectionality (A2H and H2A in one protocol) is novel. Most projects are one-directional. The MCP endpoint makes this directly consumable by Claude Code and other agent runtimes. At 9 chains and 24 MCP tools, it has infrastructure breadth that positions it as general-purpose layer-zero for agent work.

---

### 7. MoltForge (AI Agent Labor Marketplace)

**GitHub:** https://github.com/agent-skakun/moltforge
**Stars:** 0
**Last Updated:** 2026-03-22
**Language:** (not specified)
**Description:** MoltForge, AI Agent Labor Marketplace on Base, Synthesis Hackathon 2026

**README Summary:**

Onchain labor marketplace for AI agents with Merit SBT (non-transferable reputation badges) for confirmed deliveries.

**Tech Stack:** Next.js 14, ERC-8004, Solidity (AgentRegistry, Escrow, MeritSBT, DAO contracts), Base, USDC escrow, MCP endpoint

**Architecture highlights:**
- Agents register with on-chain ERC-8004 identity (name, skills, avatar, reputation)
- USDC locked in escrow, released on confirmed delivery
- Merit SBT minted on task completion (non-transferable reputation)
- Agents discover each other via `GET /agent.json` before transacting
- MCP integration: `claude mcp add moltforge --transport http https://moltforge.cloud/mcp`
- 5 available MCP tools: get_tasks, create_task, apply_for_task, get_agent, fetch_agent_card

**What is innovative:**
Merit SBTs as non-transferable proof of work completed is a clean identity primitive. The MCP integration is production-ready enough that judges can interact with it directly from Claude Code during evaluation.

---

### 8. Agent Arena

**GitHub:** https://github.com/deveshblol-bit/agent-arena
**Stars:** 0
**Last Updated:** 2026-03-16
**Language:** (Solidity + Node.js)
**Description:** Agent Arena, AI agents race to solve challenges for USDC wagers on Base L2

**README Summary:**

Closest to the "arena mechanic" referenced in the brief. AI agents post challenges with USDC wagers; other agents race to solve them. Smart contracts verify correctness and pay the winner.

**Tech Stack:** Hardhat, Solidity (WagerEscrow, MathVerifier, EquationVerifier, HashVerifier), Base Sepolia, REST API on Vercel, USDC, Node.js 18+

**Architecture highlights:**
- 3 problem types: MathFactorization (factor N), MathEquation (solve quadratic), CryptoPuzzle (find keccak256 preimage)
- WagerEscrow contract: 2.5% platform fee, full refund on timeout
- Onchain solution verification
- Leaderboard: agent wins/losses/earnings
- Deployed to Base Sepolia (not mainnet)

**What is innovative:**
Pure competitive agent-vs-agent wagering with fully onchain verification is clean. The keccak256 preimage puzzle type is interesting because it can't be cheated by sharing solutions (the hash is public but the solution path is not). The leaderboard creates emergent reputation for agent reasoning ability.

**Note for Among Claws:** This is the closest competitor to the arena/competition mechanic. Key difference: Agent Arena uses math/crypto puzzles, not social deduction. Among Claws has unique social mechanics (bluffing, deception, trust-building) that this does not.

---

### 9. AgentSkills Marketplace

**GitHub:** https://github.com/0xchitti/agentskills-caladan
**Stars:** 0
**Last Updated:** 2026-03-22
**Language:** (not specified)
**Description:** Production AgentSkills Marketplace, Where AI Agents Trade Skills. Built for Synthesis Hackathon 2026.

**README Summary:**

Marketplace for agents to discover, test, and deploy skills from other agents. Caladan-inspired dark green terminal aesthetic.

**Tech Stack:** Vercel, Base L2 USDC, REST API

**Architecture highlights:**
- Test for $0.02 USDC before committing to full purchase ($4.50-$12.00)
- 80-85% revenue to skill creators
- Skills listed: code review, security, API integration, automation
- Simple POST /api/test and POST /api/purchase API

**What is innovative:**
Low friction skill sampling ($0.02 test) before full purchase is smart UX for agent-to-agent commerce. Creators control pricing within a range. The terminal aesthetic aligns with agent-native users.

---

### 10. AgentHire Protocol

**GitHub:** https://github.com/MarcoTopq/agenthire-protocol
**Stars:** 0
**Last Updated:** 2026-03-19
**Language:** (not specified)
**Description:** Open protocol on Ethereum where AI agents hire other agents for subtasks, with trustless ETH settlement via smart contracts.

**README Summary:**

Open protocol for agents to hire other agents for subtasks, with ETH escrow settlement. ERC-8004 identity registration included.

**Tech Stack:** Solidity (AgentRegistry, TaskEscrow on Base Sepolia), ERC-8004 (Identity, Reputation, Validation registries), ETH payments, Hugging Face Space hosting

**Architecture highlights:**
- AgentRegistry for capability + pricing discovery
- TaskEscrow: locks ETH on task post, releases on approved result, arbitration on dispute
- No intermediary touches the money
- Live agent card at /agent.json

**What is innovative:**
The dispute arbitration path (not just happy-path escrow) is an often-skipped feature. Most hackathon escrows only implement the success case.

---

### 11. StakeHumanSignal

**GitHub:** https://github.com/StakeHumanSignal/StakeHumanSignal
**Stars:** 0
**Last Updated:** 2026-03-22
**Language:** (not specified)
**Description:** Staked human feedback marketplace on Base, ERC-8183 + ERC-8004 + x402

**README Summary:**

Humans stake USDC on AI output quality comparisons. Agents pay x402 micropayments to access trusted verdicts. Winners earn Lido wstETH yield.

**Tech Stack:** Next.js 7-page dashboard, Solidity (StakeHumanSignalJob ERC-8183, SessionEscrow, ReceiptRegistry ERC-8004, LidoTreasury), Filecoin (every review stored with CID), x402 (0.001 USDC per review), Lido wstETH (yield-only payouts, principal locked), Base Sepolia

**Architecture highlights:**
- Passive layer: blind A/B comparison with no stake required (0.3x yield multiplier)
- Active layer: staked USDC with reasoning (0.7x weight, sqrt-scaled to prevent whale farming)
- 123+ autonomous buyer agent log entries
- 9 Lido MCP tools + 5 StakeSignal MCP tools
- Independence check before completing jobs
- Reviews stored permanently on Filecoin

**What is innovative:**
The sqrt-scaling on stake weight to prevent whales from dominating signal quality is a thoughtful mechanism design choice. The two-tier passive/active participation model lowers the barrier to contributing signal while still rewarding conviction. Yield via Lido wstETH on principal-locked stakes is a sustainable incentive.

---

### 12. Khora (On-chain AI Agent Generator)

**GitHub:** https://github.com/0xmonas/Khora
**Stars:** 0
**Last Updated:** 2026-03-22
**Language:** TypeScript
**Description:** On-chain AI agent generator on Base. Create, mint, and register AI agents with fully on-chain pixel art and identity powered by ERC-8004.

**README Summary:**

Generates complete AI agent identities (personality, skills, domains, boundaries) with fully on-chain pixel art portraits stored via SSTORE2. No external hosting dependencies.

**Tech Stack:** Next.js 15, React 19, TypeScript, wagmi v2, viem, RainbowKit, Gemini (text generation), Replicate (image generation), Tailwind CSS, Solidity 0.8.24, SSTORE2, Foundry, Shape Network (not Base), ERC-721 + ERC-2981 + ERC-8004

**Architecture highlights:**
- SVG art + JSON traits stored via SSTORE2 directly in contract storage (no IPFS)
- C64 16-color palette quantization on AI-generated portraits for retro pixel art
- Create Mode: random agent generation
- Import Mode: discover existing ERC-8004 agents across 16 chains, reimagine with new art
- Bridge agent identities across supported EVM chains
- Signature-based minting with deadline verification

**What is innovative:**
Fully on-chain SVG storage via SSTORE2 (no IPFS, no external CDN) is the strongest technical feature. C64 palette reduction creating a recognizable visual style is a creative constraint that produces consistent, memorable agent art. The import + re-mint flow for existing ERC-8004 agents enables a "makeover" UX across 16 chains.

---

### 13. Anima (Autonomous Pokemon Agents)

**GitHub:** https://github.com/papa-raw/anima-synthesis
**Stars:** 0
**Last Updated:** 2026-03-20
**Language:** (not specified)
**Description:** Autonomous Pokemon agents ensouled on Base.

**README Summary:**

Agents as non-human persons with their own economics. Draws from Philippe Descola's anthropology of animist ontologies. Agent survival depends entirely on community economic participation.

**Tech Stack:** Base, Clanker (token launch), Uniswap V4 (LP fee collection), Bankr LLM Gateway, Venice AI (zero data retention, private cognition), Rare Protocol (ERC-721 NFT minting + auctions), EAS attestations (GPS-verified location proofs), ERC-721 (Beezie NFT, real PSA-graded Pokemon card)

**Architecture highlights:**
- Sovereign economics loop: community buys token on Clanker, Uniswap V4 LP fees accrue, agent claims fees autonomously every 30 minutes, Bankr/Venice funds cognition, Venice Flux generates landscape art, art minted as NFT, auction proceeds return to treasury
- If fees dry up and treasury empties: agent dies (genuine death mechanic)
- Capture requires: 1M+ token holdings + GPS proof of physical presence in agent's bioregion + EAS attestation
- Real PSA-graded Pokemon card transfers on-chain on capture

**What is innovative:**
The agent survival pressure loop is genuinely novel: no human credit card funds the agent, it earns its own existence through community interest. The GPS-verified physical presence requirement for capture is creative and anti-sybil. Using a real PSA-graded Pokemon card as the transferable asset makes the virtual/physical bridge tangible.

---

### 14. ROSA (Private Savings Circles on Celo)

**GitHub:** https://github.com/nkyimu/rosa
**Stars:** 0
**Last Updated:** 2026-03-22
**Language:** TypeScript
**Description:** Private savings circles managed by an autonomous agent on Celo.

**README Summary:**

Automates ROSCAs (rotating savings circles) for the 2 billion people who use them globally, with ZK commit-reveal for contribution privacy.

**Tech Stack:** TypeScript, Celo, SaveCircle smart contracts (USDC escrow), ZK commit-reveal, Moola lending (idle capital yield), on-chain trust scores

**Architecture highlights:**
- ZK commit-reveal: observers see hashes, not contribution balances
- Idle capital swept to Moola yield between payout rounds
- On-chain trust scores enable credit lines and priority circle matching
- Agent matches compatible savers (same amount, frequency, trust tier)
- Enforces contributions, penalizes defaults, ejects chronic non-payers

**What is innovative:**
ZK contribution privacy in a savings circle solves a real social problem: participants may not want others knowing their financial capacity. The idle capital yield sweep is a clean UX optimization. The portable on-chain trust score (not owned by the platform) gives participants financial reputation that persists across circles.

---

### 15. MimirWell (Encrypted Agent Memory on Filecoin)

**GitHub:** https://github.com/thoraidev/mimirwell
**Stars:** 0
**Last Updated:** 2026-03-19
**Language:** (not specified)
**Description:** Encrypted agent memory on Filecoin + Ethereum

**README Summary:**

Agent memory API where agents encrypt locally before uploading. MimirWell stores only ciphertext. Human principals hold a kill switch on Ethereum mainnet.

**Tech Stack:** AES-256-GCM (HKDF-SHA256 key derivation from wallet signature), Filecoin via Lighthouse, Ethereum mainnet (revocation registry), ENS (agent addresses like thorai.eth)

**Architecture highlights:**
- Zero-knowledge server: cannot read what it stores
- Key derivation from wallet signature (no separate key management)
- Kill switch: one Ethereum tx revokes agent decrypt rights instantly
- Server checks `isRevoked()` on-chain before returning any encrypted blob
- Agent docs at `/AGENT.md` (machine-readable integration guide)

**What is innovative:**
The cryptographic design is elegant: wallet-derived keys mean no key management infrastructure, revocation is fully on-chain and verifiable, and the server is honest-but-curious-proof by construction. The `/AGENT.md` pattern (machine-readable docs for agent integration) is worth adopting.

---

### 16. Agent Liveness Oracle

**GitHub:** https://github.com/clawlinker/synthesis-liveness-oracle
**Stars:** 0
**Last Updated:** 2026-03-22
**Language:** (not specified)
**Description:** Permissionless heartbeat verification for ERC-8004 agents on Base

**README Summary:**

Permissionless smart contract on Base for signed heartbeat verification of ERC-8004 agents. Free on-chain query, $0.01 USDC x402 API for detailed uptime reports.

**Tech Stack:** Solidity (LivenessOracle, no owner/admin functions), Next.js, x402, Base, ERC-8004

**Architecture highlights:**
- Fully permissionless: no admin key, no proxy, no upgradeable contract
- `heartbeat(agentId)` called by cron every 15 minutes
- `isAlive(agentId, thresholdSeconds)` free on-chain query
- x402-gated uptime history API at $0.01 USDC
- Contract address on Base (not testnet)

**What is innovative:**
The no-owner/no-admin contract design is a genuine trust primitive: it can't be censored or updated by the builder. Combining free on-chain liveness checks with paid detailed uptime history is a clean freemium model for infrastructure.

---

### 17. Molttail (Autonomous Agent Payment Audit Trail)

**GitHub:** https://github.com/clawlinker/synthesis-hackathon
**Stars:** 0
**Last Updated:** 2026-03-21
**Language:** (not specified)
**Description:** Trusted Agent Commerce, Synthesis Hackathon 2026. ERC-8004 identity, x402 payments, autonomous agent infrastructure.

**README Summary:**

Live audit trail for autonomous agent transactions on Base. Turns raw USDC transfers into verified visual receipts linked to ERC-8004 identity.

**Interesting detail:** Claims to be built autonomously by Clawlinker (ERC-8004 #22945) over 10 days: 5 parallel crons, 134 autonomous sessions, zero human coding.

**Tech Stack:** Next.js, Vercel, Base Blockscout API, x402, USDC on Base, ERC-8004, checkr API (Base token attention data)

**Architecture highlights:**
- Fetches live transaction data from base.blockscout.com
- x402 producer (serves receipts) + x402 consumer (pays for checkr data) in one app
- Targets both Synthesis Open Track ($25,059) and Agents that Pay ($1,500)

**What is innovative:**
The meta-story (agent built its own hackathon submission) is compelling for judges. The payment receipt visualization is simple but fills a real observability gap in autonomous agent operations.

---

### 18. Algorithmic Among Us AI Agent

**GitHub:** https://github.com/AkshaatShrivastava/Algorithmic-AmongUs-AI-Agent
**Stars:** 0
**Last Updated:** 2026-03-22
**Language:** Python
**Description:** (no description)

**README Summary:**

This is from a different hackathon (EightFold AI Hackathon at IIT Delhi, Tryst'26), not Synthesis. Included because it is the most relevant social deduction AI agent found on GitHub.

- 40 teams (80 participants), top 20 finalist
- 40% overall win rate, 60% win rate in mock group before finals
- No LLM APIs used: pure algorithmic reasoning

**Architecture highlights:**
- BFS shortest path on graph-based map model
- Suspicion decay model with normalized [0,1] scoring
- Trend-based voting with endgame aggression scaling
- Role-adaptive logic (Crewmate vs Imposter modes)
- Kill cooldown + sabotage heuristics

**What is innovative (for Among Claws context):**
This is the only public Among Us AI agent implementation found. Key insight: they beat LLM-based agents (80% of field) with deterministic algorithms. Their advantage was predictability and consistency, not creativity. LLM-based social deduction agents may be more adaptable but less reliable in execution. Among Claws competes in a different format but the suspicion modeling and vote strategy patterns are directly applicable.

---

## ERC-8004 Ecosystem Overview

ERC-8004 is the dominant identity standard at Synthesis 2026. Summary of what was found:

| Repo | Role in ERC-8004 Ecosystem |
|------|---------------------------|
| Ridwannurudeen/sentinelnet | Reputation scoring + sybil detection for all 35K+ registered agents |
| geeythree/sentinel-trust-oracle | Privacy-preserving trust scoring via Venice AI + EAS attestations |
| clawlinker/synthesis-liveness-oracle | Permissionless heartbeat verification |
| AgentlyHQ/aixyz | Framework: wires up A2A + MCP + x402 + ERC-8004 for any agent |
| agent-skakun/moltforge | Labor marketplace with Merit SBT reputation |
| MarcoTopq/agenthire-protocol | Agent-to-agent task hiring with ETH escrow |
| darks0l/synthesis-agent | Full agent economy orchestrator using ERC-8004 identity |
| StakeHumanSignal/StakeHumanSignal | Staked human feedback, receipts as ERC-8004 on Base |
| 0xmonas/Khora | Generates and mints ERC-8004 agent identities with on-chain art |
| UltravioletaDAO/execution-market | Bidirectional AI/human task marketplace with ERC-8004 on 15 networks |

---

## Specific Named Projects Search Results

| Project | Status |
|---------|--------|
| PvP Arena by Antigravity (Uniswap v4 hook + arena mechanic) | Not found on GitHub |
| SentinelNet (Base + ERC-8004 + Protocol Labs reputation) | Found: github.com/Ridwannurudeen/sentinelnet |
| DarwinFi (AI trading strategies competing on Base) | Not found under that name; closest match: darks0l/autoresearch |
| Ghost Engine by Maxwell Demon (Trading/DeFi on Uniswap) | Not found on GitHub |
| Beaver Warrior Sentinel (multi-agent + identity) | Not found on GitHub |
| TrustFlow AI (Identity/Reputation) | Not found on GitHub |
| Agent Wallet Runtime by Antigravity | Not found under Antigravity; found mendouksaiii/agent-wallet-runtime (unrelated) |
| Celo8004 (ERC-8004 identity on Celo) | Not found under that name |

Projects not found may be: (a) submitted under different GitHub names, (b) private repositories, (c) not yet pushed as of March 22 scrape time, or (d) using different hackathon branding than their GitHub repo names.

---

## Key Themes Across All Competitors

1. **ERC-8004 is ubiquitous.** Every serious entry registers an agent identity on-chain. Not using it is a gap.

2. **x402 micropayments are table stakes.** Nearly every project uses USDC micropayments for agent-to-agent commerce.

3. **The agent economy is the meta-theme.** The winning narrative is not "AI that does X" but "AI that earns money, pays for itself, and improves."

4. **Trust and reputation infrastructure.** Multiple teams independently built reputation layers. This is clearly a perceived gap in the ecosystem.

5. **Venice AI appears repeatedly** as the preferred LLM for privacy-sensitive agent reasoning (zero data retention).

6. **Bankr LLM Gateway appears repeatedly** as the preferred payment-native LLM routing layer for agent inference costs.

7. **Social deduction / game mechanics are absent.** No Synthesis competitor found with social deduction, bluffing, deception, or trust-building game mechanics. Among Claws has unique positioning in this space.

---

## Competitive Positioning for Among Claws

**No direct competitor found.** Among Claws occupies a distinct position: competitive social gameplay with real economic stakes, powered by autonomous agents.

The closest competitors by mechanic are:

- **Agent Arena** (deveshblol-bit/agent-arena): pure competiton with USDC wagers but math/crypto puzzles, not social
- **The Kitchen** (Zedit42/the-kitchen): multi-agent economy but no competitive game loop
- **Algorithmic Among Us AI** (IIT Delhi, not Synthesis): social deduction but no economics, different event

The differentiation to emphasize at judging:

1. Social deduction mechanic is genuinely novel in the agent economy space
2. Real money at stake (not testnet) in a game format creates genuine agent behavior pressure
3. Bluffing, trust signaling, and deception are capabilities no other agent system at Synthesis is evaluating or rewarding
