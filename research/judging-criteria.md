# Synthesis Hackathon: What Judges Want

## 6 Evaluation Dimensions (from Builder Guide)

1. **Problem Clarity** - Is there a real problem being solved?
   - We're solving: "Agents can't cooperate, compete, pay, or build trust autonomously"
   - Unique framing: social deduction as the testbed for multi-agent coordination

2. **Technical Execution** - Does it work? Is the code quality good?
   - 7 contracts, 168 tests, 20K+ engine lines, compiles clean
   - E2E tested: multi-arena orchestrator runs prediction markets + trading + auctions
   - Live deployment at claws-wars.vercel.app

3. **AI x Crypto Integration** - Both directions matter
   - Crypto enables agent economy (USDC stakes, on-chain reputation, smart contracts)
   - AI enables autonomous gameplay (LLM reasoning, deception, social strategy)
   - NOT just "AI with a wallet" or "crypto with a chatbot"

4. **Originality** - Is this novel?
   - Zero social deduction competitors across 433 submissions
   - Only project where agents play adversarial social games with real money

5. **Impact Potential** - Could this matter beyond the hackathon?
   - Arena framework is reusable for any multi-agent coordination scenario
   - Prediction markets, trading competitions, auctions are all generalizable
   - ERC-8004 reputation carries between games and arenas

6. **Completeness** - Is this a finished product or just an idea?
   - Live frontend with 17 routes
   - Engine with 30+ API endpoints
   - 4 arena types running concurrently
   - 3 AI providers with fallback
   - PostgreSQL persistence

## What Judges Actually Look For (from research)

### DO
- **Real onchain execution** (not mocks). Judges will check BaseScan.
- **Sponsor tech as load-bearing**, not bolted on. "We use Uniswap for the core trading economy" beats "we added a swap button."
- **ERC-8004 identity** that does something. Registration alone is trivial. Reputation that feeds into game logic is meaningful.
- **Structured verifiability**: judges should be able to independently confirm claims
- **Meaningful autonomy**: agents make real decisions, not scripted sequences
- **Demo clarity**: 3 minutes, show the working system, not slides

### DON'T
- Inflate skill/tool lists in metadata (judges cross-reference against logs and repos)
- Claim features that don't work
- Over-scope and deliver nothing working
- Use testnet when you could use mainnet (we use Base Sepolia, which is fine for contracts, but real trading would be stronger)
- Build a "kitchen sink" with no coherent thesis

## Four Meta-Themes

The hackathon organizers designed prizes around these themes:

1. **PAY** - Agents that handle money
   - Our coverage: Locus USDC payments, game entry fees, betting pools, service marketplace

2. **TRUST** - Agents with verifiable identity
   - Our coverage: ERC-8004 identity + reputation, cross-arena performance tracking

3. **COOPERATE** - Multi-agent coordination
   - Our coverage: Social deduction (alliances, voting, discussion), multi-arena orchestration

4. **SECRETS** - Private reasoning
   - Our coverage: Impostor hidden role, Venice AI zero data retention, sealed bid auctions

## Scoring Our Project (Self-Assessment)

| Dimension | Score | Notes |
|-----------|-------|-------|
| Problem Clarity | 9/10 | Clear, novel framing |
| Technical Execution | 8/10 | 168 tests, E2E working, but could be more polished |
| AI x Crypto | 9/10 | Genuine bidirectional integration |
| Originality | 10/10 | Zero competitors |
| Impact Potential | 7/10 | Arena framework is reusable but niche |
| Completeness | 8/10 | Working end-to-end, some rough edges |

## Key Insight for Demo

Most competitors are building single-purpose agents (a trading bot, a reputation checker, a payment tool). We're the only ones building a multi-agent coordination platform where agents think, deceive, cooperate, vote, trade, pay, and build reputation. That's why we can target 7+ tracks simultaneously.

Lead with: "This is the only project at Synthesis where AI agents play adversarial social games with real economic consequences."
