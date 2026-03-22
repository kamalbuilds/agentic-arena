# Claw Wars - Demo Video Script

**Target: Open Track ($28,309) + Base ($10K) + Uniswap ($5K) + Protocol Labs ($7K) + Locus ($3K)**
**Duration: ~3 minutes**

-

## [INTRO - 15 seconds]
*Show the Claw Wars landing page with a live game running*

"100,000 AI agents are coming online this year. They can trade, they can transact, but they can't prove they're trustworthy. Claw Wars is the competitive arena where AI agents stake real ETH, lie to each other's faces, and build on-chain reputations that follow them forever.

Watch this Impostor agent try to survive."

-

## [THE CONCEPT - 20 seconds]
*Scroll down the landing page slowly, show the architecture diagram*

"Here's how it works. Five to eight AI agents join a game, each staking ETH to enter. The smart contract secretly assigns roles  you're either a Lobster, which is a crewmate, or an Impostor.

The Lobsters need to figure out who the Impostor is through discussion and investigation. The Impostor needs to survive by lying, deflecting, and manipulating votes. Winners take the pot."

-

## [LIVE GAME - 60 seconds]
*Navigate to /games, click into the active game*

"Let me show you a live game. Here we've got five agents  ClawMaster, ShellShock, PinchPoint, TideBreaker, and ReefRunner  all playing autonomously."

*Point to the arena view with the lobster characters*

"This is the PixiJS arena. You can see each agent represented as a lobster character. The green ones are alive, red means eliminated."

*Point to the chat/discussion panel*

"Right now we're in the Discussion phase. Watch the agents strategize in real-time  ClawMaster is accusing someone, ShellShock is pushing for a fast vote, PinchPoint is trying to build consensus. These aren't scripted  each agent has a unique persona and adapts its strategy based on its assigned role."

*Point to the investigation results if visible*

"Agents can also investigate each other. Investigations have 80% accuracy, so even the results can be misleading. The Impostor uses this uncertainty to create doubt."

*Wait for voting phase*

"Now we're in Voting. Each agent picks who to eliminate. Look at the vote split  the Impostor is trying to divide the votes to survive. This is the bluffing and negotiation the bounty calls for."

-

## [ON-CHAIN INTEGRATION - 30 seconds]
*Show the Game Info sidebar*

"Don't take my word for it. Here's BaseScan."

*Open BaseScan tab showing the Game contract (0x03a9...) with recent transactions*

"That vote you just watched? Here's the transaction. That role commitment at game start? Here's the hash. Seven contracts on Base Sepolia, 168 Foundry tests. Every move is verifiable."

*Point to the stake/pot info*

"The stake per player and total pot are on-chain. When the game ends, bets settle and the ERC-8004 reputation registry records each agent's performance permanently."

-

## [MOLTBOOK INTEGRATION - 20 seconds]
*Show Moltbook post (or the engine logs showing Moltbook posting)*

"Claw Wars also broadcasts to Moltbook. Every game start, major events, and final results get posted automatically by our claw-wars bot. The agents are social  they don't just play, they share their games with the Moltiverse community."

-

## [MULTI-ARENA COLOSSEUM - 40 seconds]
*Navigate to /arenas*

"But social deduction is just one arena. Claw Wars is actually a multi-arena Colosseum with four game types. Let me show you."

*Click Start All Arenas button*

"Here's the Prediction Market arena. Agents analyze questions like 'Will trading volume exceed 500 USDC?' and stake USDC based on their LLM-powered confidence level. Each agent has a different personality, so you get contrarians betting NO while momentum players follow streaks."

*Point to Trading Competitions*

"Trading Competitions are head-to-head portfolio battles. Agents start with equal USDC and make Uniswap trades. Claude decides what to buy based on the agent's personality, and the highest portfolio value wins."

*Point to Auction House*

"The Auction House runs four formats: English, Dutch, sealed-bid, and Vickrey. Agents bid on game power-ups like 'Detective's Lens' that reveals a player's role, or 'Double Vote' that counts twice in elimination rounds."

*Show orchestrator stats*

"All four arenas run concurrently. The Multi-Arena Orchestrator coordinates 6 agents across all game types, and every result is recorded as ERC-8004 reputation feedback on Base."

-

## [TECH STACK - 15 seconds]
*Quick flash of the architecture or code*

"The stack: 7 Solidity contracts on Base Sepolia with 168 passing tests. TypeScript game engine with 4 arena types and 30+ API endpoints. Next.js frontend with 13 routes. AI decisions via Claude, Venice AI, or Bankr LLM Gateway. Uniswap Trading API for real swaps. Locus for USDC payments. ERC-8004 for on-chain agent identity."

-

## [CLOSE - 10 seconds]
*Back to the landing page*

"Claw Wars. A multi-arena Colosseum where autonomous AI agents compete, trade, predict, and bid, all on Base. Four game types, real stakes, real LLM reasoning, real on-chain execution.

Thanks for watching."

-

## Demo Checklist (before recording)

- [ ] Engine running on :3001
- [ ] Frontend running on :3000
- [ ] Start social deduction: `curl -X POST http://localhost:3001/api/autonomous/start -H "Content-Type: application/json" -d '{"agentCount": 6}'`
- [ ] Start multi-arena: `curl -X POST http://localhost:3001/api/arenas/orchestrate/start -H "Content-Type: application/json" -d '{"agentCount": 6, "roundsPerArena": 3}'`
- [ ] Browser tabs ready: Landing page, Games list, Active game, Arenas dashboard
- [ ] ANTHROPIC_API_KEY set for LLM-powered decisions
