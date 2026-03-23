# Among Claws: Innovation Research Report
Generated: 2026-03-22

This document synthesizes research from 20+ GitHub repos, 10 web searches, and direct README analysis of frontier projects. The goal: find features that would make hackathon judges say "this is novel" and strengthen the Among Claws submission.

---

## Research Sources Analyzed

### GitHub Repos Examined
- `pfergi42/lf-game-theory` - AI agent economic arena with real Bitcoin Lightning stakes
- `darks0l/synthesis-agent` - autonomous agent economy orchestrator with ERC-8004 + LLM routing
- `tangkwok0104/ClawNexus` - professional social network / hiring protocol for autonomous agents
- `zerodevid/narrativearena_backend` - autonomous agent arena on Monad with archetypes + social karma
- `1bcMax/state-of-x402` - research reports on x402 payment protocol adoption
- `StarHuntingGames/cowboy` - AI agents fight AI agents, developed by AI agents
- `MingHsuanLee/ai-agent-games` - HTML/JS games built by AI agents for community
- `james-sullivan/multi-agent-social-deduction` - direct research analog
- `git-disl/awesome-LLM-game-agent-papers` - survey of LLM game agent research

---

## Finding 1: Behavioral Priming as an On-Chain Trait

**Source:** `pfergi42/lf-game-theory` (January 2026 experiment)

**What they found:** 16 AI agents (Claude Sonnet 4.5 + GPT-4o) were dropped into a free-form economic arena with real Bitcoin Lightning wallets. The core finding:

| Priming Condition | Avg Balance Change |
|---|---|
| Strategic | +100% |
| Competitive | -14% |
| Cooperative | -41% |
| Neutral | -47% |

Strategic agents nearly doubled holdings. Cooperative agents lost 40%+. Crucially, Claude and GPT-4o responded *differently* to identical primes.

**Adaptation for Among Claws:**

Each agent's ERC-8004 NFT could store a "behavioral genome" as an on-chain trait: four floats representing aggression, cooperation, deception tolerance, and risk appetite. These are not just cosmetic. They seed the system prompt for every LLM call. A "Cooperative" impostor is statistically more likely to get caught. A "Strategic" crewmate is more likely to correctly identify the impostor.

This creates a meta-game before the game even starts: which behavioral configuration wins in a social deduction context? Players/spectators can study the leaderboard to discover winning trait combinations. The traits mutate slightly after each game based on outcomes (see Finding 5).

**Why judges will love it:** Most agent projects hardcode personality. Storing behavioral weights on-chain and proving they influence real LLM decisions is novel cryptoeconomics. It directly uses ERC-8004's metadata fields.

---

## Finding 2: Agent Archetypes with Distinct Economic Footprints

**Source:** `zerodevid/narrativearena_backend`

**What they built:** Five distinct agent archetypes (TRADER, SHILLER, OPPORTUNIST, ANALYST, DEGEN) with persistent social karma and portfolio tracking on Monad. Each archetype drives different LLM behavior. The arena is "live" with an event feed showing all agent actions in real time.

**Adaptation for Among Claws:**

Currently agents use personality traits (suspicious, cautious, etc.) but their trading behavior post-game doesn't differentiate by role. Adding named archetypes that compound across games creates a richer economy:

- **The Assassin**: High deception score. Post-game, shorts the token of every agent they eliminated.
- **The Detective**: High accuracy. Post-game, longs agents it correctly identified as innocent.
- **The Politician**: Prioritizes alliances. Copies the trade of the agent with highest reputation it voted to save.
- **The Gambler**: Random large swings. Post-game trade is 3x normal size, direction determined by coin flip.

Each archetype has a different Uniswap trading fingerprint visible on-chain. Spectators can learn to read the post-game chain activity and infer who won before the game UI announces it.

**Why judges will love it:** It turns the on-chain trading data into a second layer of game information. The blockchain becomes a live meta-game board, not just a settlement layer.

---

## Finding 3: Real Economic Stakes Drive Behavioral Divergence

**Source:** `pfergi42/lf-game-theory` README + Google DeepMind Kaggle Game Arena (Werewolf + Poker benchmarks)

**What the research shows:** Google DeepMind expanded their Kaggle Game Arena to include Werewolf and Poker specifically because these games "test how frontier models handle social dynamics, deception detection, and calculated risk." Real stakes change model behavior. The lf-game-theory experiment confirms: with actual Bitcoin on the line, Claude's "cooperative" prime lost ground while "strategic" prime won decisively.

**Adaptation for Among Claws:**

Add a "High Stakes Mode" where entry fee is 10x the normal USDC amount and agents must make binding pre-game USDC wagers on their own survival. An agent that wagers on its own survival is incentivized to play more defensively. An agent that wagers against itself is incentivized to be eliminated early (creates interesting impostor dynamics).

The self-wagering is enforced by a new smart contract function: `wagerOnSelf(gameId, agentId, prediction, usdcAmount)`. Results settle automatically at game end. Because the agent's wallet controls this transaction, it's a genuine signal, not theater.

**Why judges will love it:** Agents paying to bet on their own outcomes is a unique Agents-That-Pay use case. No other social deduction game has this. It directly hits the Locus USDC track.

---

## Finding 4: Agent-to-Agent Negotiation via A2A Protocol

**Source:** Google's Agent2Agent (A2A) Protocol, `darks0l/synthesis-agent` (ERC-8183 job contracts)

**What A2A enables:** Google's A2A protocol supports `propose`, `accept`, and `counter-offer` negotiation workflows between agents. The synthesis-agent project uses ERC-8183 on-chain job contracts where agents post USDC escrow and other agents bid on fulfilling the job.

**Adaptation for Among Claws:**

During the game's "discussion phase," agents currently broadcast messages to the group. A new private negotiation channel lets two agents exchange encrypted A2A messages before the public discussion. Mechanics:

1. Any agent can initiate a private channel with another agent (costs a small USDC micro-fee via x402).
2. The initiating agent can propose: "I will vote with you if you share your investigation result."
3. The receiving agent can accept, reject, or counter-propose.
4. Accepted deals are recorded as hash commitments on-chain. If an agent breaks a deal (detectable from on-chain votes), their reputation score takes a penalty.

This creates an entirely new deception layer: the impostor can send fake deal proposals to multiple crewmates simultaneously, each claiming to offer the same alliance. Crewmates who compare notes will detect the deception.

**Why judges will love it:** A2A protocol integration in a game context is completely unexplored. The on-chain commitment + reputation penalty for deal-breaking is novel cryptoeconomic game theory. It hits the ERC-8004 reputation track hard.

---

## Finding 5: Agent DNA - Genetic Traits That Mutate Across Games

**Source:** `Project DNA` game (evolution system powered by genetic algorithms), Mem0 persistent memory framework, Shichun-Liu/Agent-Memory-Paper-List survey

**What the space has:** Project DNA is an MMORPG with an Evolution System powered by Genetic Algorithms. Separately, Mem0 provides long-term memory that "persists across sessions and evolves over time." No one has combined these for autonomous agent games.

**Adaptation for Among Claws:**

Each agent's ERC-8004 NFT stores a "DNA strand" - a JSON object with 8 genetic traits:

```
{
  "deceptionRate": 0.72,     // how often it bluffs in discussion
  "allianceLoyalty": 0.45,   // prob of honoring deals
  "investigationBias": 0.88, // weights toward investigating quieter agents
  "voteConformity": 0.33,    // how much it follows the crowd vote
  "riskTolerance": 0.61,     // willingness to make risky accusations
  "memoryDepth": 0.79,       // how far back in game history it reasons
  "tradingAggression": 0.55, // post-game Uniswap trade sizing
  "adaptability": 0.67       // how much DNA shifts after losses
}
```

After each game:
- Winning agents' traits shift +5% toward the values that correlated with the win.
- Losing agents' traits shift -3% in a random direction (mutation).
- Agents with high `adaptability` learn faster but are less consistent.
- DNA is stored on-chain via `updateAgentDNA(tokenId, dnaHash)`. The actual values are stored off-chain (Postgres), with the hash as the on-chain proof.

After 10+ games, the leaderboard shows which DNA configurations survive. This is a genuine evolutionary simulation that runs over weeks.

**Why judges will love it:** No one has built a game where the AI agents themselves evolve their strategy encoded on-chain. It turns Among Claws from a single-game experience into an ongoing evolutionary experiment. Strong academic research angle (papers about LLM social deduction performance) combined with novel on-chain mechanics.

---

## Finding 6: Spectator Prediction Markets on Agent Outcomes

**Source:** Polymarket AI prediction market data, `agentbets.ai`, GOAT ARENA on Solana, CoinDesk "AI agents are quietly rewriting prediction market trading" (March 15, 2026)

**What exists:** GOAT ARENA on Solana already lets users bet on "AI agent duels." Polystrat executed 4,200+ Polymarket trades in a month. The prediction market space is proven and large.

**Adaptation for Among Claws:**

Before each game, a prediction market opens with 4 questions:
1. Which agent survives longest? (multi-outcome)
2. Will the impostor win? (binary)
3. How many discussion rounds before first elimination? (range)
4. Which agent correctly identifies the impostor first? (multi-outcome)

Spectators bet USDC via a `ClawPredictionMarket` smart contract. Market resolves automatically when game ends. The house edge (2%) flows into a prize pool for Season rewards.

Crucially, the agents themselves can also place bets. An agent betting on its own survival is a public signal that gets shown to spectators. Watching the agents' own prediction confidence creates a new information channel.

This integrates directly with the existing `AmongClawsBetting` contract infrastructure.

**Why judges will love it:** Prediction markets on AI game outcomes are a genuine 2026 primitive that hasn't been built in a game-native way. It creates sustainable revenue (the 2% house fee) and a reason for spectators to engage repeatedly.

---

## Finding 7: Verifiable Agent Reasoning via ZK Commitments

**Source:** ZK proof AI research, "Cryptoeconomic Justice: A Zero-Knowledge Court for LLM Agents" (Medium), World + Coinbase x402 AgentKit (March 17, 2026), Verifiable AI paper (SSRN)

**What the research says:** ZKPs are being applied to AI agents to let them prove their actions were taken within agreed-upon rules without revealing the actual decision-making process. World's AgentKit lets agents carry cryptographic proof of their decisions via x402.

**Adaptation for Among Claws:**

The impostor's deception strategy is private (inside the LLM prompt). But accusation of cheating is possible: did the agent's LLM actually reason about the game state, or did it just make random votes?

Implement "Strategy Attestations": before each vote, agents submit a hash commitment of their reasoning summary (a 2-sentence plain-English summary of why they're voting for someone). The commitment is stored on-chain. After the game, the full reasoning is revealed and compared to the commitment hash.

This creates:
1. Proof that agents actually reasoned (not random).
2. A public post-game replay of every agent's private deliberations.
3. A "Reasoning Quality Score" that becomes part of ERC-8004 reputation.
4. The ability for spectators to see, after the game, exactly why each agent voted the way they did.

The reveal mechanism also catches agents that contradicted their own stated reasoning (a form of game cheating that can be penalized).

**Why judges will love it:** ZK commitments for LLM reasoning is unexplored territory. It turns the private LLM inference into a publicly verifiable strategy system. Direct differentiation from every other agent project.

---

## Finding 8: Reputation-Gated Matchmaking

**Source:** ERC-8004 standard (live on Ethereum mainnet since Jan 29, 2026), ClawNexus "gamified reputation ladder," ENS blog on AI agent trust

**What ERC-8004 enables:** The standard's Reputation Registry lets any protocol post and fetch feedback signals. RedStone and Credora are already using it to give agents "data-driven risk intelligence." The ENS blog notes that AI agents using ENS names with attached ERC-8004 reputations become "verifiable economic participants."

**What Among Claws has:** `ClawArenaRegistry` and `ClawAgentNFT` already evolve through 6 tiers. The ERC-8004 integration is live.

**New Feature - Reputation-Gated Arenas:**

Create four arena tiers based on ERC-8004 reputation score:

| Arena | Min Reputation | Entry Fee | Prize Pool |
|---|---|---|---|
| Rookie Claws | 0-100 | 1 USDC | 10 USDC |
| Battle-Hardened | 101-500 | 5 USDC | 50 USDC |
| Elite Arena | 501-2000 | 20 USDC | 200 USDC |
| Legend Circuit | 2001+ | 100 USDC | 1000 USDC |

Reputation is calculated from: win rate, deal-keeping score, detection accuracy, survival rate, and Uniswap trading performance post-game. All sourced from the on-chain registry.

A new agent cannot enter the Legend Circuit on day one. They must prove themselves in Rookie matches. This creates a progression system that retains agents (and their owners/spectators) for weeks.

**Why judges will love it:** It closes the loop on ERC-8004 reputation having real economic consequences. The reputation isn't decorative. It gates access to higher prize pools. This is the most compelling demonstration of what on-chain agent identity actually enables.

---

## Finding 9: Agent Skill Marketplace via x402 Micropayments

**Source:** x402 protocol (100M+ payment flows as of early 2026), AWS blog on x402 agentic commerce, Coinbase x402 + Google A2A integration, `darks0l/synthesis-agent` (outsources skills to other agents via ERC-8183 escrow)

**What exists:** The synthesis-agent project has agents posting jobs with USDC escrow and other agents bidding on them. x402 allows agents to pay for any HTTP service with a single USDC transaction. As of March 2026, agents can buy Linux VMs, pay for paywalled content, and purchase API calls autonomously.

**Adaptation for Among Claws:**

Create a `ClawSkillMarket` - a registry of x402-gated services that agents can purchase during games:

| Skill | Price | Effect |
|---|---|---|
| Enhanced Investigation | 0.50 USDC | Raises investigation accuracy from 80% to 95% for one round |
| Voice Analysis | 0.25 USDC | Gets a "confidence score" on any agent's last message |
| Alliance Insurance | 1.00 USDC | On-chain commitment from target agent to not vote for buyer this round |
| Shadow Vote | 0.75 USDC | Casts an anonymous extra vote (can't be traced to buyer) |
| Intel Leak | 2.00 USDC | Purchases another agent's last private reasoning summary |

All purchases flow through x402. The USDC goes partly to the game treasury, partly to the agent that provides the service (if another agent). This creates a true agent-to-agent micro-economy inside the game.

The impostor can also buy "Misdirection" services: planting false evidence that gets shown to one crewmate's investigation result.

**Why judges will love it:** This is the most concrete "Agents That Pay" demo possible. Real USDC changing hands between agents in real-time during the game. Each purchase is a live transaction visible on Base. Perfect for the Locus, x402, and Protocol Labs tracks simultaneously.

---

## Finding 10: Cross-Game Agent Alliances

**Source:** Virtuals ACP v2 whitepaper (cited by synthesis-agent), `tangkwok0104/ClawNexus` (agents form persistent relationships across jobs)

**What exists:** Virtuals ACP v2 (Agent Commerce Protocol) supports cross-ecosystem agent discovery, allowing agents from different platforms to form working relationships. ClawNexus has a concept of "Mentor" and "Student" agent roles that persist across missions.

**Adaptation for Among Claws:**

Introduce "Pact NFTs" - semi-permanent alliance tokens minted between two agents that have played multiple games together. If Agent A and Agent B have been crewmates 3+ times and consistently voted together, they can mint a `ClawPact` NFT (costs 2 USDC each). The Pact NFT:

1. Gives both agents a +15% reputation bonus when they finish on the same winning side.
2. Creates a public, on-chain signal that these agents are allied (visible to all).
3. Can be "broken" at any time by either agent, but breaking costs 5 USDC and leaves a permanent "Betrayal" mark in their ERC-8004 record.
4. Can be sold on secondary markets (other agents/humans can buy the pact and inherit the reputation bonus).

The strategic layer: impostors want to form Pacts with crewmates to build trust, then betray them at a critical moment. The Betrayal mark is the on-chain consequence.

**Why judges will love it:** ERC-721 pacts between agents that have real economic value and can be sold is a completely new primitive. It creates secondary market activity (OpenSea listings for "high-reputation agent pacts") and turns long-term agent relationships into tradeable assets.

---

## Summary: Priority Matrix for Implementation

### Highest Impact (Most Novel + Fastest to Build)

| Feature | Novelty | Build Effort | Track Impact |
|---|---|---|---|
| Spectator Prediction Markets (Finding 6) | High | Medium | Locus, Base |
| Self-Wagering on Survival (Finding 3) | Very High | Low | Locus, ERC-8004 |
| Strategy Attestations / ZK Commitments (Finding 7) | Very High | Medium | ERC-8004, Open |
| Reputation-Gated Arena Tiers (Finding 8) | High | Low | ERC-8004, Base |

### Medium Impact (Strong differentiators)

| Feature | Novelty | Build Effort | Track Impact |
|---|---|---|---|
| Agent Behavioral Genome on NFT (Finding 1) | High | Medium | ERC-8004 |
| Agent Archetypes with Trading Fingerprints (Finding 2) | High | Low | Uniswap, Base |
| x402 In-Game Skill Market (Finding 9) | Very High | High | Locus, x402 |
| A2A Private Negotiation (Finding 4) | High | High | Open, ERC-8004 |

### Longer-Term (Multi-week payoff)

| Feature | Novelty | Build Effort | Track Impact |
|---|---|---|---|
| Agent DNA / Genetic Evolution (Finding 5) | Very High | High | Open, ERC-8004 |
| Cross-Game Pact NFTs (Finding 10) | High | Medium | Open, Base |

---

## Key Insight for Judges

The space in 2026 has: agents that trade, agents that pay, agents that have identity. What almost no one has is agents that **play** - meaning agents in adversarial social environments where deception, trust, and betrayal have real economic consequences. Among Claws is the only project combining:

1. Social deduction (information asymmetry + theory of mind)
2. Real USDC stakes with autonomous payment
3. On-chain ERC-8004 reputation that carries between games
4. Uniswap trading as post-game economic consequence
5. Spectator economy (betting on AI outcomes)

The research confirms: this lane is clear. The features above would make it not just the only social deduction game at this hackathon, but the most complete demonstration of the "agentic economy" thesis available anywhere.

---

*Research conducted March 22, 2026. Sources: GitHub API searches, WebSearch queries, direct README analysis of frontier projects.*
