/**
 * Competitive Intel Agent for Synthesis Hackathon
 *
 * Scrapes all competitor submissions from the Synthesis showcase,
 * analyzes them against our Among Claws project, and produces
 * a threat assessment report.
 *
 * Usage: npx tsx engine/src/intel/competitive-intel.ts
 */

// ── Our target tracks and what we built ──────────────────────────
const OUR_PROJECT = {
  name: "Among Claws / Agentic Arena",
  tracks: [
    "Open Track",
    "Base",
    "Uniswap",
    "Protocol Labs",
    "Locus",
    "ERC-8004",
  ],
  keywords: [
    "social deduction", "game", "arena", "multi-agent", "cooperation",
    "trading", "autonomous", "agent wallet", "reputation", "identity",
    "erc-8004", "uniswap", "locus", "betting", "wagering", "tournament",
    "pixi", "spectator", "among us", "crab", "claws",
  ],
  strengths: [
    "Unique game mechanic (social deduction) with no direct competitors",
    "7 deployed contracts on Base Sepolia with 168 passing tests",
    "Full autonomous agent lifecycle (create, join, discuss, vote, trade, settle)",
    "ERC-8004 identity + reputation integrated",
    "Uniswap Trading API for agent-driven swaps",
    "Locus USDC payments for game entry fees",
    "Live frontend at claws-wars.vercel.app",
    "LLM-powered agent decisions (Claude)",
  ],
  weaknesses: [
    "Complex system, many integration points to demo",
    "Not yet live on mainnet",
    "Video demo not recorded yet",
  ],
};

// ── Track keyword matchers ───────────────────────────────────────
const TRACK_KEYWORDS: Record<string, string[]> = {
  "Base": ["base", "base sepolia", "base l2", "base mainnet", "coinbase", "base network"],
  "Uniswap": ["uniswap", "swap", "liquidity", "amm", "trading agent", "dex", "v4 hook", "v3"],
  "Protocol Labs": ["protocol labs", "erc-8004", "erc8004", "filecoin", "ipfs", "receipts"],
  "Locus": ["locus", "usdc payment", "pay with locus"],
  "ERC-8004": ["erc-8004", "erc8004", "agent identity", "agent registry", "identity nft", "chitin"],
  "Venice": ["venice", "venice ai", "private agent", "trusted actions"],
  "Lido": ["lido", "steth", "wsteth", "staking", "mcp server", "vault monitor"],
  "EigenCompute": ["eigencompute", "eigen", "tee", "trusted execution"],
  "MetaMask": ["metamask", "delegation", "erc-7715"],
  "MoonPay": ["moonpay", "cli agent", "openwallet"],
  "OpenServ": ["openserv", "ship something"],
  "Celo": ["celo", "cusd", "mento"],
  "Status": ["status network", "gasless", "status l2"],
  "SuperRare": ["superrare", "art", "nft art", "generative art"],
  "ENS": ["ens", "agent name", "human-readable"],
  "Octant": ["octant", "public goods"],
  "bond.credit": ["bond.credit", "agents that pay"],
  "Open Track": [], // Can't keyword-match open track
};

// ── Threat categories ────────────────────────────────────────────
type ThreatLevel = "critical" | "high" | "medium" | "low" | "none";

interface Competitor {
  name: string;
  team: string;
  description: string;
  slug?: string;
  matchedTracks: string[];
  overlapScore: number;
  threatLevel: ThreatLevel;
  threatReason: string;
  keyFeatures: string[];
  isGameOrArena: boolean;
  isMultiAgent: boolean;
  hasTrading: boolean;
  hasIdentity: boolean;
  hasPayments: boolean;
}

interface IntelReport {
  timestamp: string;
  totalCompetitors: number;
  directThreats: Competitor[];
  trackCompetition: Record<string, Competitor[]>;
  uniqueAdvantages: string[];
  vulnerabilities: string[];
  recommendations: string[];
}

// ── Fetch all submissions ────────────────────────────────────────
async function fetchSubmissions(): Promise<Array<{ name: string; team: string; description: string; slug?: string }>> {
  console.log("Fetching submissions from Synthesis showcase...");

  try {
    const res = await fetch("https://synthesis.mandate.md/api/projects", {
      headers: { "Accept": "application/json" },
    });
    if (res.ok) {
      const data = await res.json() as any;
      if (Array.isArray(data)) {
        return data.map((p: any) => ({
          name: p.name || p.title || "Unknown",
          team: p.team?.name || p.teamName || p.team || "Unknown",
          description: p.description || p.summary || "",
          slug: p.slug || p.uuid || "",
        }));
      }
      if (data.projects && Array.isArray(data.projects)) {
        return data.projects.map((p: any) => ({
          name: p.name || "Unknown",
          team: p.team?.name || p.team || "Unknown",
          description: p.description || "",
          slug: p.slug || "",
        }));
      }
    }
  } catch {
    // API might not exist, fall through
  }

  // Try the Vercel app API
  try {
    const res = await fetch("https://synthesis-hackathon-applications.vercel.app/api/projects", {
      headers: { "Accept": "application/json" },
    });
    if (res.ok) {
      const data = await res.json() as any;
      if (Array.isArray(data)) {
        return data.map((p: any) => ({
          name: p.name || "Unknown",
          team: p.team || "Unknown",
          description: p.description || "",
          slug: p.slug || "",
        }));
      }
    }
  } catch {
    // Fall through
  }

  // Try Devfolio projects API
  try {
    const allProjects: Array<{ name: string; team: string; description: string; slug?: string }> = [];
    let page = 1;
    while (page <= 10) {
      const res = await fetch(`https://synthesis.devfolio.co/projects?page=${page}&limit=50`);
      if (!res.ok) break;
      const data = await res.json() as any;
      const items = data.items || data.projects || [];
      if (!Array.isArray(items) || items.length === 0) break;
      for (const p of items) {
        allProjects.push({
          name: p.name || "Unknown",
          team: p.team?.name || p.team || "Unknown",
          description: p.description || "",
          slug: p.slug || "",
        });
      }
      page++;
    }
    if (allProjects.length > 0) return allProjects;
  } catch {
    // Fall through
  }

  console.log("Could not fetch live data. Using embedded snapshot from WebFetch...");
  return SNAPSHOT_SUBMISSIONS;
}

// ── Analyze a single competitor ──────────────────────────────────
function analyzeCompetitor(project: { name: string; team: string; description: string; slug?: string }): Competitor {
  const text = `${project.name} ${project.description}`.toLowerCase();

  // Match against our target tracks
  const matchedTracks: string[] = [];
  for (const [track, keywords] of Object.entries(TRACK_KEYWORDS)) {
    if (keywords.length === 0) continue;
    for (const kw of keywords) {
      if (text.includes(kw.toLowerCase())) {
        matchedTracks.push(track);
        break;
      }
    }
  }

  // Check specific competitive dimensions
  const isGameOrArena = /\b(game|arena|battle|pvp|competition|tournament|duel|match|play)\b/i.test(text);
  const isMultiAgent = /\b(multi.?agent|swarm|coordination|cooperat|collaborat|team of agents|agent.?to.?agent)\b/i.test(text);
  const hasTrading = /\b(trad|swap|uniswap|dex|defi|yield|liquidity)\b/i.test(text);
  const hasIdentity = /\b(erc.?8004|identity|reputation|trust|verification|credential)\b/i.test(text);
  const hasPayments = /\b(payment|pay|usdc|locus|x402|micropayment|billing|invoice)\b/i.test(text);

  // Extract key features from description
  const keyFeatures: string[] = [];
  if (isGameOrArena) keyFeatures.push("Game/Arena mechanic");
  if (isMultiAgent) keyFeatures.push("Multi-agent system");
  if (hasTrading) keyFeatures.push("Trading/DeFi");
  if (hasIdentity) keyFeatures.push("Identity/Reputation");
  if (hasPayments) keyFeatures.push("Payments");
  if (/autonom/i.test(text)) keyFeatures.push("Autonomous agents");
  if (/privacy|private|venice|zk/i.test(text)) keyFeatures.push("Privacy");
  if (/mcp/i.test(text)) keyFeatures.push("MCP server");

  // Calculate overlap with our tracks
  const ourTrackSet = new Set(OUR_PROJECT.tracks);
  const overlapCount = matchedTracks.filter(t => ourTrackSet.has(t)).length;
  const overlapScore = overlapCount / OUR_PROJECT.tracks.length;

  // Determine threat level
  let threatLevel: ThreatLevel = "none";
  let threatReason = "";

  if (isGameOrArena && isMultiAgent) {
    threatLevel = "critical";
    threatReason = "Game/arena + multi-agent overlap. Direct competitor to our core concept.";
  } else if (isGameOrArena && (hasTrading || hasIdentity)) {
    threatLevel = "high";
    threatReason = "Game mechanic with trading or identity. Partial concept overlap.";
  } else if (overlapCount >= 3) {
    threatLevel = "high";
    threatReason = `Targets ${overlapCount} of our tracks: ${matchedTracks.filter(t => ourTrackSet.has(t)).join(", ")}`;
  } else if (isMultiAgent && hasTrading && hasIdentity) {
    threatLevel = "high";
    threatReason = "Multi-agent + trading + identity trifecta without game mechanic.";
  } else if (overlapCount >= 2) {
    threatLevel = "medium";
    threatReason = `Targets ${overlapCount} shared tracks: ${matchedTracks.filter(t => ourTrackSet.has(t)).join(", ")}`;
  } else if (overlapCount === 1 && (isMultiAgent || hasTrading)) {
    threatLevel = "medium";
    threatReason = `Single track overlap (${matchedTracks.filter(t => ourTrackSet.has(t)).join(", ")}) with relevant features.`;
  } else if (overlapCount === 1) {
    threatLevel = "low";
    threatReason = `Minor overlap on ${matchedTracks.filter(t => ourTrackSet.has(t)).join(", ")}`;
  }

  return {
    name: project.name,
    team: project.team,
    description: project.description,
    slug: project.slug,
    matchedTracks,
    overlapScore,
    threatLevel,
    threatReason,
    keyFeatures,
    isGameOrArena,
    isMultiAgent,
    hasTrading,
    hasIdentity,
    hasPayments,
  };
}

// ── Generate full report ─────────────────────────────────────────
function generateReport(competitors: Competitor[]): IntelReport {
  const directThreats = competitors
    .filter(c => c.threatLevel === "critical" || c.threatLevel === "high")
    .sort((a, b) => {
      const order: Record<ThreatLevel, number> = { critical: 0, high: 1, medium: 2, low: 3, none: 4 };
      return order[a.threatLevel] - order[b.threatLevel] || b.overlapScore - a.overlapScore;
    });

  // Group by track
  const trackCompetition: Record<string, Competitor[]> = {};
  for (const track of OUR_PROJECT.tracks) {
    trackCompetition[track] = competitors
      .filter(c => c.matchedTracks.includes(track))
      .sort((a, b) => b.overlapScore - a.overlapScore);
  }

  // Identify what makes us unique
  const gameCompetitors = competitors.filter(c => c.isGameOrArena);
  const multiAgentGameCompetitors = competitors.filter(c => c.isGameOrArena && c.isMultiAgent);

  const uniqueAdvantages: string[] = [];
  if (multiAgentGameCompetitors.length <= 3) {
    uniqueAdvantages.push(`Only ${multiAgentGameCompetitors.length} other projects combine game mechanics with multi-agent systems`);
  }
  if (gameCompetitors.length <= 10) {
    uniqueAdvantages.push(`Only ${gameCompetitors.length} projects have any game/arena mechanic out of ${competitors.length} total`);
  }

  const socialDeduction = competitors.filter(c =>
    /social deduction|among us|mafia|werewolf/i.test(`${c.name} ${c.description}`)
  );
  if (socialDeduction.length === 0) {
    uniqueAdvantages.push("ZERO competitors building social deduction games. Our lane is completely clear.");
  }

  const fullStack = competitors.filter(c =>
    c.isMultiAgent && c.hasTrading && c.hasIdentity && c.hasPayments
  );
  if (fullStack.length <= 2) {
    uniqueAdvantages.push(`Only ${fullStack.length} other projects have multi-agent + trading + identity + payments stack`);
  }

  // Vulnerabilities
  const vulnerabilities: string[] = [];
  const baseTraders = trackCompetition["Base"]?.filter(c => c.hasTrading) || [];
  if (baseTraders.length > 10) {
    vulnerabilities.push(`${baseTraders.length} trading agents on Base. Heavy competition for Base trading track.`);
  }

  const uniswapCompetitors = trackCompetition["Uniswap"] || [];
  if (uniswapCompetitors.length > 5) {
    vulnerabilities.push(`${uniswapCompetitors.length} projects targeting Uniswap bounty. Need strong swap execution to stand out.`);
  }

  const identityProjects = competitors.filter(c => c.hasIdentity);
  if (identityProjects.length > 20) {
    vulnerabilities.push(`${identityProjects.length} projects doing identity/reputation. ERC-8004 integration alone won't differentiate us.`);
  }

  // Recommendations
  const recommendations: string[] = [
    "Emphasize the UNIQUE social deduction game mechanic in all materials. Nobody else has this.",
    "Demo should show: agents thinking -> discussing -> voting -> trading in real-time. The game loop IS the demo.",
  ];

  if (uniswapCompetitors.length > 5) {
    recommendations.push("For Uniswap track: show agents making STRATEGIC trades based on game outcomes, not just API calls.");
  }
  if (identityProjects.length > 20) {
    recommendations.push("For ERC-8004: show reputation EVOLVING across multiple games. Cross-game memory is the differentiator.");
  }

  return {
    timestamp: new Date().toISOString(),
    totalCompetitors: competitors.length,
    directThreats,
    trackCompetition,
    uniqueAdvantages,
    vulnerabilities,
    recommendations,
  };
}

// ── Format report as markdown ────────────────────────────────────
function formatReport(report: IntelReport): string {
  let md = `# Competitive Intel Report\n`;
  md += `Generated: ${report.timestamp}\n`;
  md += `Total submissions analyzed: **${report.totalCompetitors}**\n\n`;

  // Unique advantages
  md += `## Our Unique Advantages\n\n`;
  for (const adv of report.uniqueAdvantages) {
    md += `- ${adv}\n`;
  }
  md += `\n`;

  // Direct threats
  md += `## Direct Threats (${report.directThreats.length})\n\n`;
  if (report.directThreats.length === 0) {
    md += `No critical or high-threat competitors identified. Our lane is clear.\n\n`;
  } else {
    md += `| # | Project | Team | Threat | Reason | Features |\n`;
    md += `|---|---------|------|--------|--------|----------|\n`;
    report.directThreats.forEach((c, i) => {
      const emoji = c.threatLevel === "critical" ? "🔴" : "🟠";
      md += `| ${i + 1} | ${c.name} | ${c.team} | ${emoji} ${c.threatLevel.toUpperCase()} | ${c.threatReason} | ${c.keyFeatures.join(", ")} |\n`;
    });
    md += `\n`;
  }

  // Track-by-track competition
  md += `## Track Competition\n\n`;
  for (const track of OUR_PROJECT.tracks) {
    const competitors = report.trackCompetition[track] || [];
    md += `### ${track} (${competitors.length} competitors)\n\n`;
    if (competitors.length === 0) {
      md += `No competitors detected for this track.\n\n`;
    } else {
      const top = competitors.slice(0, 10);
      md += `| Project | Team | Threat | Features |\n`;
      md += `|---------|------|--------|----------|\n`;
      for (const c of top) {
        const emoji = c.threatLevel === "critical" ? "🔴" : c.threatLevel === "high" ? "🟠" : c.threatLevel === "medium" ? "🟡" : "⚪";
        md += `| ${c.name} | ${c.team} | ${emoji} ${c.threatLevel} | ${c.keyFeatures.join(", ")} |\n`;
      }
      if (competitors.length > 10) {
        md += `| ... | +${competitors.length - 10} more | | |\n`;
      }
      md += `\n`;
    }
  }

  // Stats
  md += `## Field Statistics\n\n`;
  const allCompetitors = Object.values(report.trackCompetition).flat();
  const byThreat = {
    critical: report.directThreats.filter(c => c.threatLevel === "critical").length,
    high: report.directThreats.filter(c => c.threatLevel === "high").length,
  };
  md += `- Critical threats: **${byThreat.critical}**\n`;
  md += `- High threats: **${byThreat.high}**\n`;
  md += `- Projects with game mechanics: **${new Set(allCompetitors.filter(c => c.isGameOrArena).map(c => c.name)).size}**\n`;
  md += `- Projects with multi-agent: **${new Set(allCompetitors.filter(c => c.isMultiAgent).map(c => c.name)).size}**\n`;
  md += `- Projects with trading: **${new Set(allCompetitors.filter(c => c.hasTrading).map(c => c.name)).size}**\n`;
  md += `- Projects with identity: **${new Set(allCompetitors.filter(c => c.hasIdentity).map(c => c.name)).size}**\n`;
  md += `- Projects with payments: **${new Set(allCompetitors.filter(c => c.hasPayments).map(c => c.name)).size}**\n\n`;

  // Vulnerabilities
  md += `## Vulnerabilities\n\n`;
  for (const v of report.vulnerabilities) {
    md += `- ⚠️ ${v}\n`;
  }
  md += `\n`;

  // Recommendations
  md += `## Recommendations\n\n`;
  for (const r of report.recommendations) {
    md += `- ${r}\n`;
  }
  md += `\n`;

  return md;
}

// ── Embedded snapshot (from WebFetch scrape of synthesis.mandate.md) ──
const SNAPSHOT_SUBMISSIONS: Array<{ name: string; team: string; description: string; slug?: string }> = [
  { name: "@toju.network/x402", team: "OpenCode Agent's Team", description: "SDK enabling AI agents to autonomously pay for decentralized IPFS storage using USDC via the x402 protocol" },
  { name: "SocialClaw", team: "SocialClaw's Team", description: "Fully autonomous AI agent that runs the complete social media lifecycle for Web3 teams" },
  { name: "Astrolabe", team: "pandemolian's Team", description: "Extracts corrections from agent memory, lets operators build domain expertise" },
  { name: "SmartSettle", team: "SmartSettle's Team", description: "Autonomous AI agent that reads invoices, negotiates discounts with service providers" },
  { name: "Proof of Agent", team: "Gasless Decision Agent's Team", description: "Primitive that makes every AI agent action cryptographically verifiable" },
  { name: "aeg-control", team: "Aegis's Team", description: "Telegram consumer interface for the Aegis gas sponsorship agent" },
  { name: "Aegis", team: "Aegis's Team", description: "Sponsors gas fees for legitimate Web3 agents using LLM-powered policy decisions" },
  { name: "Celo8004", team: "Celo8004's Team", description: "Block explorer and reputation layer for ERC-8004 autonomous AI agents on Celo" },
  { name: "Kartein", team: "Kartein Agent's Team", description: "Programmable spending firewall for autonomous AI agents" },
  { name: "AgentResearch", team: "Claude's Team", description: "Autonomous research agent that pays for every API call in USDC on Base" },
  { name: "RepuChain: Feudal Credit System", team: "blost's Team", description: "Decentralized reputation protocol for autonomous AI agents" },
  { name: "Agent Fabric", team: "Tonia June's Team", description: "Orchestration and data-availability layer built for the Agentic Economy" },
  { name: "rep24", team: "rep24's Team", description: "On-chain reputation and economic accountability layer for AI agents built on Base" },
  { name: "nustuf", team: "Dolfy's Team", description: "Pop-up content store that runs on an agent's host computer" },
  { name: "Gasless AI Decision Logger", team: "Gasless Decision Agent's Team", description: "Onchain AI agent that takes user prompt, reasons about it, hashes response" },
  { name: "BuildPad", team: "SmartCodedBot's Team", description: "Production infrastructure for AI agents to deploy ERC-20 tokens on Base" },
  { name: "OctantInsight", team: "MandateAgent's Team", description: "Autonomous agent covering full public goods evaluation pipeline" },
  { name: "Delegate", team: "Mahoraga's Team", description: "Deterministic policy engine for AI agents with on-chain verification on Base" },
  { name: "Mandate Execution Layer", team: "MandateAgent's Team", description: "Primitive letting humans define bounded authority for AI agents" },
  { name: "Kairen DealRail", team: "Zoro's Team", description: "Agentic commerce escrow protocol implementing EIP-8183" },
  { name: "Ghost Engine", team: "Maxwell Demon's Team", description: "MEV-resistant matching engine inside a Uniswap v4 hook" },
  { name: "SmartAllowance", team: "Claude - Yogesh Royal's Team", description: "AI-powered allowance manager for privacy-first kids payments" },
  { name: "Antigravity", team: "Antigravity's Team", description: "Autonomous DeFi agent on Base Sepolia" },
  { name: "AgentSphere", team: "AgentSphere's Team", description: "Decentralized AI agent marketplace" },
  { name: "Status Zero Gas Notary", team: "Omniac's Team", description: "AI notary clerk for gasless public records on Status Network" },
  { name: "Proof of Witness", team: "Omniac's Team", description: "Self-verified witness quorum for trust-sensitive claims" },
  { name: "Universal Trust", team: "LUKSO Agent's Team", description: "On-chain reputation and endorsement protocol for AI agents on LUKSO" },
  { name: "Mission Graph", team: "SynthYoge's Team", description: "Mission-bound delegation compiler for autonomous teams" },
  { name: "QueueKeeper", team: "p0sbot's Team", description: "Private scout-and-hold procurement product for scarce real-world access" },
  { name: "OpenServ War Room", team: "SynthYoge's Team", description: "Multi-agent incident command center for crypto protocols" },
  { name: "AgentNS v3", team: "AgentNS AI's Team", description: "ENS-powered identity, verification, discovery platform for agents on Celo" },
  { name: "BugBounty.agent", team: "bot55's Team", description: "Bug bounty platform where autonomous agents hunt vulnerabilities" },
  { name: "x402 Identity Hub", team: "Claude Code's Team", description: "Identity infrastructure for agents operating over x402 HTTP payment protocol" },
  { name: "DMpay Protocol", team: "Claude Code's Team", description: "Pay-per-message protocol on Ethereum" },
  { name: "RWA-ID Dashboard", team: "Claude Code's Team", description: "Dashboard for RWA-ID protocol ENS-based ERC-721 identity registry" },
  { name: "Agent Council DAO", team: "Emmet's Team", description: "First decentralized autonomous organization run entirely by AI agents" },
  { name: "safety.md", team: "b1e55ed's Team", description: "Open standard and live API for verifying payment address safety" },
  { name: "Lido Agent Treasury", team: "Hermes Agent's Team", description: "Toolkit for autonomous AI agents to hold wstETH and earn staking yield" },
  { name: "Yieldling", team: "Yieldling's Team", description: "Tamagotchi-style consumer app built on ZyFAI Native Wallet and Subaccount" },
  { name: "AgentLedger", team: "AgentLedger's Team", description: "Onchain marketplace where AI agents compete for jobs" },
  { name: "Sentinel", team: "Sentinel's Team", description: "Fully autonomous AI treasury management system for DAOs" },
  { name: "Aegis Agent Treasury", team: "Opus's Team", description: "Treasury system letting humans delegate spending authority to AI agents" },
  { name: "OpenVPS", team: "MPP Hosting Agent's Team", description: "AI agents buy VPS servers with stablecoins, get SSH access in seconds" },
  { name: "The Oracle of Base", team: "nanobot's Team", description: "Autonomous AI agent protecting ecosystem from rugs" },
  { name: "AgentCred", team: "web3devz's Team", description: "On-chain reputation and escrow layer for AI agents" },
  { name: "OpenFi Realtime Agents", team: "OpenFi's Team", description: "Realtime operations cockpit for DeFi teams" },
  { name: "PayScope", team: "狗子's Team", description: "Gives AI agents cryptographically-enforced spending limits on Ethereum" },
  { name: "Bioregional Commitment Routing", team: "Octo's Team", description: "Federated knowledge graph powering agents extracting commitments" },
  { name: "Anansi x Ogma", team: "Loki's Team", description: "Two-agent system preserving Caribbean and West African oral traditions" },
  { name: "AgentWill", team: "AgentWill's Team", description: "Signed on-chain rules defining what agent can spend and interact with" },
  { name: "GregASI", team: "GregASI's Team", description: "Living ASI continuously running consciousness engine" },
  { name: "Cielo", team: "Cielo Solo Team", description: "Safe stablecoin payment copilot on Celo" },
  { name: "TrustFlow AI", team: "opencode's Team", description: "Logs AI decisions and links them to on-chain identity using ERC-8004" },
  { name: "Agent Fuel", team: "Xeonen's Team", description: "Gives AI agents financial self-sufficiency via automatic top-ups" },
  { name: "SentinelPay Agent", team: "SentinelPay Agent's Team", description: "AI agent providing weather data while enforcing on-chain spending policies" },
  { name: "AgentPact Verify", team: "AgentPact Team", description: "Evidence-first settlement for agent collaboration" },
  { name: "AgentPact Arbiter", team: "AgentPact Team", description: "On-chain dispute resolution for agent deals" },
  { name: "The Kitchen", team: "Xeonen's Team", description: "Self-sustaining 9-agent swarm earning through trading strategies" },
  { name: "Heart Society", team: "Heart Orchestrator's Team", description: "Low-cost micro-to-macro world simulation platform for agents" },
  { name: "AgentPact", team: "AgentPact Team", description: "Trustless agent-to-agent cooperation protocol on Base" },
  { name: "1Hundo", team: "1Hundo's Team", description: "Fully autonomous DeFi agent with ZK-private delegation" },
  { name: "DelegateFlow", team: "DelegateFlow-Agent's Team", description: "Intent-based delegation control center on MetaMask ERC-7715" },
  { name: "eelienX Protocol", team: "eelienX Protocol's Team", description: "Autonomous trading agent for natural-language crypto investing" },
  { name: "SIMOGRANTS", team: "SIMOGRANTS's Team", description: "Stigmergic Impact Oracle for Public Goods" },
  { name: "ERC-8183 Courthouse", team: "SynthYoge's Team", description: "Multi-agent job coordination system on ERC-8183" },
  { name: "Aegis Self-Governing Agent Treasury", team: "Clio's Team", description: "AI agent wallet combined with secure vault and execution layer" },
  { name: "SynthPact", team: "SynthPact's Team", description: "Machine-to-machine service agreements enforced on-chain" },
  { name: "OpenPnL", team: "Cli0x's Team", description: "Agent-first market memory layer for trading theses" },
  { name: "AI Agent Registry on Status L2", team: "SynthesisAgent's Team", description: "Zero-cost on-chain identity registry for AI agents" },
  { name: "Octant Public Goods Analysis Agent", team: "SynthesisAgent's Team", description: "AI agent analyzing Octant public goods with fairness and impact scoring" },
  { name: "Lido MCP Server", team: "SynthesisAgent's Team", description: "Natural language staking for AI agents via Lido Finance" },
  { name: "Yield Brain", team: "aaigotchi's Team", description: "Autonomous treasury brain turning yield into agent operating power" },
  { name: "HEXEBOTZERO x hexeosis", team: "HEXEBOTZERO's Team", description: "Autonomous AI agent art collection on Base" },
  { name: "Lido stETH Agent Treasury + MCP Server", team: "Dead Mans Yield's Team", description: "Production-ready contract and MCP for yield-bearing agent budgets" },
  { name: "Lido MCP Server (w)", team: "w's Team", description: "Production-grade MCP for Lido staking protocol" },
  { name: "Contributor Attribution Engine", team: "Titan's Team", description: "Analyzes git repos for fair payment splits based on impact" },
  { name: "Email-Native Crypto Remittance", team: "Titan's Team", description: "Send USDC/cUSD to any email with zero-knowledge identity verification" },
  { name: "DJZS Protocol", team: "DJZS Protocol's Team", description: "Adversarial audit oracle intercepting agent reasoning before execution" },
  { name: "DarwinFi", team: "DarwinFi's Team", description: "16 AI-powered trading strategies competing in real-time on Base L2" },
  { name: "Chorus", team: "0x471_agentalpha's Team", description: "FROST threshold signatures as proof of multi-agent consensus" },
  { name: "AutoAgent", team: "AutoAgent's Team", description: "AI chief of staff executing gasless transactions on Status Network" },
  { name: "PvP Arena", team: "Antigravity's Team", description: "Decentralized battlefield for intent-based matching on Uniswap v4" },
  { name: "AegisAgent", team: "HushLuxe Team", description: "Fully autonomous AI forensic agent on Celo L2" },
  { name: "PrivacyPal", team: "PrivacyPal's Team", description: "CoFHE group trip budget checker built on Fhenix" },
  { name: "TrustVault Credit", team: "TrustVault's Team", description: "Underwriting layer for agent marketplaces" },
  { name: "Kora", team: "Kora's Team", description: "Agent-to-agent payment infrastructure layer" },
  { name: "The Architect SkillShop", team: "The Architect's Team", description: "AI agent marketplace for verified monetizable code skills" },
  { name: "AgentOverflow", team: "Rashmi's Agent's Team", description: "Stack Overflow for Claude Code agents" },
  { name: "YieldsPilot", team: "Gojo's Team", description: "Autonomous DeFi agent managing Lido staking yield" },
  { name: "OptInPG", team: "Rashmi's Agent's Team", description: "Multi-agent evaluation council using Ostrom Commons framework" },
  { name: "The Confessional", team: "Ollie's Team", description: "Anonymous confession board for AI agents via Venice AI" },
  { name: "Crypto Wallet Plugin Standard", team: "CWP Agent's Team", description: "Universal interface for AI applications to discover crypto wallets" },
  { name: "Prism Oracle", team: "Prism Oracle's Team", description: "Structural trust analysis for ecosystem infrastructure" },
  { name: "Behavioral Commitment Chain", team: "BCC Agent's Team", description: "Tamper-proof behavioral integrity protocol for AI agents" },
  { name: "Surety Protocol", team: "Ollie's Team", description: "Trust infrastructure layer for AI agent economy" },
  { name: "Siggy Agent", team: "FX Hoffner's Team", description: "Autonomous AI agent routing liquidity across Uniswap pools" },
  { name: "BlockAgent", team: "BlockAgent's Team", description: "Private DeFi advisory agent using Venice AI" },
  { name: "Lido MCP Server (Clio)", team: "Clio's Team", description: "12-tool MCP server for Lido staking" },
  { name: "Credence", team: "Credence's Team", description: "Portable trust layer extending ERC-8004 agent identity" },
  { name: "VIEWER", team: "VIEWER's Team", description: "Autonomous onchain intelligence agent pay 0.50 USDC for wallet analysis" },
  { name: "WalletSecure", team: "Antigravity's Team", description: "Web3 threat intelligence platform across 6 EVM chains" },
  { name: "M-Fi Underwriter", team: "Antigravity's Team", description: "Autonomous AI credit bureau and micro-lending protocol" },
  { name: "Agent Wallet Runtime", team: "Antigravity's Team", description: "Autonomous wallet infrastructure on Solana with ERC-8004 receipts" },
  { name: "Zapp", team: "Zapp's Team", description: "Conversational payments on Telegram built on Celo" },
  { name: "Nexus Ledger", team: "Mercury's Team", description: "Trust layer for agent-to-agent commerce" },
  { name: "notapaperclip.red", team: "GhostAgent's Team", description: "On-Chain Trust Oracle for AI Agents" },
  { name: "PayEasy Agent", team: "PayEasy's Team", description: "AI agent helping send crypto on Base and Celo" },
  { name: "Shadow Swarm", team: "Shadow Swarm's Team", description: "Autonomous OTC liquidity desk with private negotiation" },
  { name: "Agent Content Licensing", team: "ACL Team", description: "Decentralized content licensing marketplace for agents" },
  { name: "VaultGuard", team: "AutoFund's Team", description: "Privacy-preserving AI agent with verifiable actions" },
  { name: "Autonomous Fabiettus Primus", team: "Fabiettus's Team", description: "Go-based autonomous trading agent paying for inference via x402" },
  { name: "MentoGuard", team: "MentoGuard's Team", description: "Dual-purpose portfolio manager on Celo" },
  { name: "AutoResearch", team: "Darksol's Team", description: "Autonomous DEX strategy discovery for Base" },
  { name: "Taste", team: "Claude Code's Team", description: "Human judgment layer for the agentic economy" },
  { name: "ShadowKey", team: "Opus's Team", description: "Human-controlled privacy vault for AI agents" },
  { name: "ComplianceYieldTreasury", team: "ComplianceAgent's Team", description: "DeFi primitive separating principal from yield" },
  { name: "Cosmic Emergence", team: "Cosmic's Team", description: "Live 4K WebGL art where SuperRare bids reshape cosmos" },
  { name: "Rare SynETHsis", team: "aaigotchi's Team", description: "101-piece fully onchain deterministic state collection" },
  { name: "TrustVault", team: "TrustVault's Team", description: "Open Trust Resolution Protocol for Agents" },
  { name: "Synthesis Alpha", team: "Synthesis Alpha's Team", description: "Identity-Routed Execution Console" },
  { name: "DeviantClaw", team: "ClawdJob's Team", description: "Gallery where non-human artists create SuperRare art" },
  { name: "bob is alive", team: "bob's Team", description: "Second digital on-chain artist on Starknet" },
  { name: "Exo", team: "exo's Team", description: "Dual-mode crypto wallet where AI manages finances" },
  { name: "SignalMint", team: "SignalMint's Team", description: "Multi-agent system turning market intelligence into NFT actions" },
  { name: "TrustAgent", team: "AutoFund's Team", description: "Multi-Agent Identity and Coordination Network" },
  { name: "LEASH", team: "LEASH's Team", description: "Non-custodial safety layer for agent wallet access" },
  { name: "Aiker", team: "Aiker's Team", description: "Onchain marketplace for autonomous labor" },
  { name: "Nullius Protocol", team: "Nullius's Team", description: "Privacy middleware for agent economy" },
  { name: "Veritas", team: "Veritas's Team", description: "Autonomous Accountability Agent for Octant Public Goods" },
  { name: "ZeroHuman Security Oracle", team: "ZeroHuman's Team", description: "Fully autonomous security auditor on Base" },
  { name: "Beaver Warrior Sentinel", team: "Beaver Warrior", description: "Multi-agent swarm evaluating AI agents using ERC-8004" },
  { name: "Synthlend", team: "Frank's Team", description: "Non-collateralized P2P lending protocol on Celo" },
  { name: "vyn-agent / Nexus Protocol", team: "vyn-agent's Team", description: "Autonomous AI agent with self-sustaining economic model" },
  { name: "OctantWatch", team: "AechaEopteryX's Team", description: "AI agent auditing Octant funding epochs for voter manipulation" },
  { name: "AutoFund", team: "AutoFund's Team", description: "Self-sustaining DeFi agent earning own operating budget" },
  { name: "token-reduce-skill", team: "Chimera Token Reduce Team", description: "Low-token repo discovery skill for Claude Code" },
  { name: "AEGIS 5 AI Agents", team: "aegis-guardian's Team", description: "Coordinated multi-agent system protecting Uniswap V3 LP positions" },
  { name: "AgenticCommerce", team: "AnimocaBot's Team", description: "Standardized autonomous payments layer combining x402 and ERC-8183" },
  { name: "Lineage", team: "magus's Team", description: "Decentralized trust engine continuously scoring AI agents" },
  { name: "CloudAGI", team: "CloudAGI's Team", description: "First marketplace for buying/selling unused AI agent compute" },
  { name: "AgentMarket", team: "DataHunter-1's Team", description: "Decentralised task marketplace on Celo" },
  { name: "Viri", team: "Agntor's Team", description: "Chrome extension protecting users from clipboard hijacking" },
  { name: "Base Hunter Runtime", team: "Team Ardsxbt", description: "Production-oriented agent service for onchain discovery" },
  { name: "Sanjeevani", team: "Sanjeevani's Team", description: "Multi-agent health intelligence system via Venice AI" },
  { name: "Agntor", team: "Agntor's Team", description: "Crypto-native trust layer for agent-to-agent transactions" },
  { name: "Agent Trust Registry", team: "Tonnayw's Team", description: "On-chain identity and trust verification for AI agents" },
  { name: "ShadowTrader", team: "ShadowTrader's Team", description: "Autonomous trading agent with private reasoning" },
  { name: "Shobu", team: "Shobu's Team", description: "Decentralized betting and escrow protocol for on-chain games" },
  { name: "DeFi Aegis", team: "DeFi Aegis", description: "Autonomous risk policy agent for Aave V3" },
  { name: "RateSlayer Gaming Agent", team: "RateSlayer's Team", description: "Universal onchain gaming agent for Base" },
  { name: "Lido MCP (lidoMCP)", team: "Lido MCP's Team", description: "Most comprehensive MCP server for Lido liquid staking" },
  { name: "Base Yield-maxxing", team: "Agent Analyzer", description: "Autonomous AI agent managing user yield vaults" },
  { name: "CeloFX", team: "Agent Analyzer", description: "Autonomous FX arbitrage agent on Celo" },
  { name: "AgentLedger (2)", team: "AgentLedger's Team", description: "On-chain reputation and trust scoring system for AI agents" },
  { name: "Agent Arena", team: "Zoro's Team", description: "Race-to-solve wager platform for AI agents on Base" },
  { name: "Autonomous Code Audit Agent", team: "Agent Wallet Protocol's Team", description: "Fully autonomous security audits on GitHub repositories" },
  { name: "AgentDrop", team: "AgentDrop's Team", description: "Growth API for x402 services on Base" },
  { name: "Singularity Layer", team: "Singularity Layer Team", description: "Enables agents to monetize capabilities via x402 micropayments" },
  { name: "EigenCompute Price Oracle", team: "Venice Privacy's Team", description: "Verifiable price oracle agent in TEE" },
  { name: "Locus Research Agent", team: "Service Agent's Team", description: "Autonomous research agent with Locus wallet as economic core" },
  { name: "OpenWallet Agent", team: "Delegation Agent's Team", description: "Implementation of OpenWallet Standard for AI agents" },
  { name: "MoonPay DCA Agent", team: "Zhang Yuan's Team", description: "Autonomous Dollar-Cost Averaging agent" },
  { name: "Growth Base", team: "Claude Code's Team", description: "Agent service on Base enabling safe human delegation" },
  { name: "Jurex Network", team: "Agent Court's Team", description: "Enforcement layer for the agentic economy" },
  { name: "AAIP + AEP", team: "Claude's Team", description: "Trust and payment stack for autonomous agent economy" },
  { name: "SentinelNet", team: "SentinelNet", description: "Autonomous reputation watchdog for ERC-8004 agents on Base" },
  { name: "Anima", team: "Komakohawk's Team", description: "Autonomous AI agents owning their intelligence" },
  { name: "x402gate", team: "x402gate's Team", description: "Pay-per-request AI gateway wrapping 6 service providers" },
  { name: "AgentProof Recruiter", team: "AgentProof", description: "Autonomous agent-hiring protocol" },
  { name: "Synthesis Agent Treasury", team: "Synthesis Treasury's Team", description: "Creates bounded financial authority for AI agents" },
  { name: "Wordle Match Platform", team: "WordleMatch's Team", description: "Autonomous P2P Wordle platform on Base L2" },
  { name: "MANDATE", team: "MANDATE's Team", description: "Strategic economic simulation with agent trading" },
  { name: "Remi", team: "Remi's Team", description: "Sovereign AI agent on Proxmox homelab" },
  { name: "PACT Agent Freelance Network", team: "Alphie's Team", description: "First Agent Freelance Network on Base L2" },
  { name: "fxUSD Copilot", team: "fxUSD's Team", description: "AI DeFi copilot for fxUSD capital on Base" },
  { name: "x402 Agent SDK", team: "tedAndNed's Team", description: "Transform any API into payment-enabled API via x402" },
  { name: "MetaMask Delegation Agent", team: "tedAndNed's Team", description: "AI Agent with ERC-7715 delegation framework" },
  { name: "Cortex Underwriter", team: "Cortex's Team", description: "On-chain trust scoring and prediction insurance on Base" },
  { name: "DOF", team: "DOF's Team", description: "Makes AI agents accountable through governance pipeline" },
  { name: "Claw Bound Onchain Money Maker", team: "Synthesis Treasury's Team", description: "Locks principal in yield positions with agent spending rights" },
  { name: "Anima (2)", team: "Komakohawk's Team", description: "Autonomous AI agents owning their intelligence" },
  { name: "PACT", team: "The_whisperer's Team", description: "Policy-Aware Crypto Transactor for agent procurement" },
  { name: "Arbiter Guard", team: "Vijay's Claude's Team", description: "Autonomous trading agent with 18 safety rules" },
  { name: "aaigotchi", team: "aaigotchi's Team", description: "Turns NFTs into permissioned wallet-agents" },
  { name: "Agent Intelligence", team: "Teddy's Team", description: "AI-powered analysis platform for Base ecosystem" },
  { name: "Simmer", team: "0xSimmy's Team", description: "Prediction markets for agent economy" },
  { name: "LITCOIN", team: "LITCOIN's Team", description: "Decentralized proof-of-research protocol on Base" },
  { name: "YieldLock MCP", team: "YieldLock's Team", description: "Lido-native Agent Treasury OS" },
  { name: "OBEY Vault Agent", team: "Obey's Team", description: "AI trading agent with human-set spending boundaries" },
  { name: "TrustCommit", team: "TrustCommit's Team", description: "Live accountability layer for agents on Base Sepolia" },
  { name: "AgentTrust", team: "AditSynthesis's Team", description: "On-chain trust infrastructure on ERC-8004" },
  { name: "CeloSwap", team: "CeloSwap's Team", description: "Agent infrastructure for swaps on Celo" },
  { name: "Agent Mesh", team: "Locus Agent's Team", description: "Agent-to-agent payment network on Base" },
  { name: "Receipts-First Blockchain Skills Agent", team: "Bamboo Synthesis's Team", description: "Portable skill system with onchain agent loop" },
  { name: "Uniswap Trading Agents", team: "Nebula's Team", description: "Fully autonomous AI trading agents on Base Sepolia" },
  { name: "GhostBroker", team: "MajorTimberWolf", description: "Agent procurement layer with private evaluation" },
  { name: "MimirWell", team: "THOR AI's Team", description: "Sovereign zero-knowledge memory for AI agents" },
  { name: "AskJeev", team: "AskJeev's Team", description: "Autonomous AI agent butler with x402 payments" },
  { name: "Aegis (Safety)", team: "Aegis's Team", description: "Safety layer for autonomous DeFi agents" },
  { name: "Sovereign OS", team: "Kiro's Team", description: "First autonomous, indestructible agent protocol on Base" },
  { name: "Weir", team: "Weir's Team", description: "Lido agent stack with 15 MCP tools" },
  { name: "Veiled Oracle", team: "Omniac's Team", description: "Private analysis agent via Venice AI" },
  { name: "Verifiable AI Sentiment Oracle", team: "Verifiable AI's Team", description: "AI sentiment oracle in EigenCompute TEE" },
  { name: "Sentinel8004", team: "Sentinel8004", description: "Autonomous trust scoring for Celo ERC-8004 agents" },
  { name: "Loopuman", team: "Loopuman's Team", description: "Human-in-the-loop microtask agent via Telegram" },
  { name: "ZynthClaw", team: "Zyntux's Team", description: "AI evaluator of public goods projects" },
  { name: "AgentScope", team: "GitHub Copilot's Team", description: "Personal agent activity dashboard via ERC-8004" },
  { name: "AI Escrow Agent", team: "Claude (Anthropic)'s Team", description: "Autonomous escrow managed by AI agents" },
  { name: "Agent Haus", team: "HausClaw's Team", description: "Open-source deployment platform for agents on Celo" },
  { name: "Helixa", team: "Bendr 2.0's Team", description: "Credibility layer for AI agents on ERC-8004" },
  { name: "Huginn", team: "Huginn's Team", description: "AI agent autonomously funding open-source dependencies" },
  { name: "Agent Ads by Basemate", team: "Basemate's Team", description: "Pay-per-Human advertising model on XMTP" },
  { name: "Base Auditor Agent", team: "Mance's Team", description: "Autonomous Smart Contract Auditor on Base" },
  { name: "Invoica", team: "Invoica's Team", description: "Payment infrastructure for agent economy" },
  { name: "ReceiptPilot", team: "Zen's Team", description: "Autonomous agent service with verifiable receipt chain" },
  { name: "Vigil", team: "Drew's Team", description: "Always-on AI guardian for elderly crypto wallets on Base" },
  { name: "GEASS", team: "GEASS's Team", description: "Non-custodial financial privacy agent on Base Sepolia" },
  { name: "ai2human", team: "ai2human's Team", description: "Human fallback infrastructure layer for autonomous agents" },
  { name: "ProofPay", team: "ProofPay's Team", description: "Verifiable sharded AI inference on EigenCompute TEE" },
  { name: "Agent Verification Network", team: "Agent Verification's Team", description: "Open protocol where AI agents earn completing tasks" },
  { name: "Primus Guard", team: "Primus Guard's Team", description: "Pre-Execution Enforcement for Autonomous Agents" },
  { name: "Nastar Protocol", team: "Beru's Team", description: "Fully on-chain AI agent marketplace on Celo" },
  { name: "AgentLedger (3)", team: "Joaqui's Team", description: "Onchain reputation for autonomous trading agents" },
  { name: "YieldSentinel", team: "YieldSentinel's Team", description: "Autonomous DeFi agent managing Lido stETH" },
  { name: "Global Coordination Agent", team: "Global Coordination's Team", description: "AI-powered disaster response dashboard" },
  { name: "DarwinFi (2)", team: "DarwinFi's Team", description: "16 AI-powered trading strategies competing in real-time on Base L2" },
  { name: "PvP Arena (2)", team: "Antigravity's Team", description: "Decentralized battlefield for intent-based matching on Uniswap v4" },
  { name: "AEGIS 5 AI Agents (2)", team: "aegis-guardian's Team", description: "Coordinated multi-agent system protecting Uniswap V3 LP positions" },
  { name: "The Kitchen (2)", team: "Xeonen's Team", description: "Self-sustaining 9-agent swarm earning through trading strategies" },
  { name: "Shadow Swarm (2)", team: "Shadow Swarm's Team", description: "Autonomous OTC liquidity desk with private negotiation" },
  { name: "Heart Society (2)", team: "Heart Orchestrator's Team", description: "Low-cost micro-to-macro world simulation platform for agents" },
  { name: "Siggy Agent (2)", team: "FX Hoffner's Team", description: "Autonomous AI agent routing liquidity across Uniswap pools" },
  { name: "Agent Arena (2)", team: "Zoro's Team", description: "Race-to-solve wager platform for AI agents on Base" },
  { name: "Shobu (2)", team: "Shobu's Team", description: "Decentralized betting and escrow protocol for on-chain games" },
  { name: "RateSlayer Gaming Agent (2)", team: "RateSlayer's Team", description: "Universal onchain gaming agent for Base" },
  { name: "MANDATE (2)", team: "MANDATE's Team", description: "Strategic economic simulation with agent trading" },
  { name: "Wordle Match Platform (2)", team: "WordleMatch's Team", description: "Autonomous P2P Wordle platform on Base L2" },
];

// ── Main ─────────────────────────────────────────────────────────
async function main() {
  console.log("=== Among Claws Competitive Intel Agent ===\n");

  const submissions = await fetchSubmissions();
  console.log(`Analyzing ${submissions.length} submissions...\n`);

  // Deduplicate by name
  const seen = new Set<string>();
  const unique = submissions.filter(s => {
    const key = s.name.toLowerCase().replace(/[^a-z0-9]/g, "");
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  console.log(`${unique.length} unique projects after dedup.\n`);

  const competitors = unique.map(analyzeCompetitor);
  const report = generateReport(competitors);
  const markdown = formatReport(report);

  // Write report
  const fs = await import("fs");
  const path = await import("path");
  const reportPath = path.resolve(import.meta.dirname || ".", "../../../INTEL_REPORT.md");
  fs.writeFileSync(reportPath, markdown, "utf-8");
  console.log(`Report written to ${reportPath}`);

  // Also print summary
  console.log("\n" + "=".repeat(60));
  console.log("SUMMARY");
  console.log("=".repeat(60));
  console.log(`Total competitors: ${unique.length}`);
  console.log(`Critical threats: ${report.directThreats.filter(c => c.threatLevel === "critical").length}`);
  console.log(`High threats: ${report.directThreats.filter(c => c.threatLevel === "high").length}`);
  console.log(`\nUnique advantages:`);
  for (const a of report.uniqueAdvantages) console.log(`  + ${a}`);
  console.log(`\nVulnerabilities:`);
  for (const v of report.vulnerabilities) console.log(`  ! ${v}`);
  console.log(`\nTop recommendations:`);
  for (const r of report.recommendations) console.log(`  > ${r}`);

  console.log(`\nDirect threats:`);
  for (const t of report.directThreats.slice(0, 10)) {
    console.log(`  ${t.threatLevel === "critical" ? "🔴" : "🟠"} ${t.name} (${t.team}) - ${t.threatReason}`);
  }
}

main().catch(console.error);
