/**
 * AgentMemory - Cross-game persistent memory for autonomous agents
 *
 * Agents remember:
 * - Past opponents and their behavior patterns
 * - Trust scores built over multiple games
 * - Which players lied about investigation results
 * - Voting patterns and alliance reliability
 * - Trading outcomes and strategy effectiveness
 *
 * This is critical for Synthesis hackathon scoring:
 * - Autonomy (35%): agents learn and adapt across games
 * - Trust theme: reputation builds over time, not just one game
 * - ERC-8004: memory feeds into on-chain reputation feedback
 */

import { logger } from "../utils/logger.js";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { join } from "path";

const memLogger = logger.child("AgentMemory");

// Persistence directory for cross-session memory
const MEMORY_DIR = join(process.cwd(), "data", "agent-memory");

function ensureMemoryDir(): void {
  if (!existsSync(MEMORY_DIR)) {
    mkdirSync(MEMORY_DIR, { recursive: true });
  }
}

function getMemoryPath(agentName: string): string {
  const safe = agentName.replace(/[^a-zA-Z0-9_-]/g, "_").toLowerCase();
  return join(MEMORY_DIR, `${safe}.json`);
}

function saveToDisk(memory: AgentMemory): void {
  try {
    ensureMemoryDir();
    const data = JSON.stringify(memory.toJSON(), null, 2);
    writeFileSync(getMemoryPath(memory.agentName), data, "utf-8");
  } catch (err) {
    memLogger.warn(`Failed to persist memory for ${memory.agentName}`, err);
  }
}

function loadFromDisk(agentName: string): AgentMemory | null {
  try {
    const path = getMemoryPath(agentName);
    if (!existsSync(path)) return null;
    const raw = readFileSync(path, "utf-8");
    const data = JSON.parse(raw);
    memLogger.info(`Loaded persisted memory for ${agentName} (${data.gameHistory?.length || 0} games)`);
    return AgentMemory.fromJSON(data);
  } catch (err) {
    memLogger.warn(`Failed to load memory for ${agentName}`, err);
    return null;
  }
}

export interface OpponentProfile {
  name: string;
  address: string;
  gamesPlayed: number;
  timesWasImpostor: number;
  timesWasCrewmate: number;
  trustScore: number; // -100 to 100
  liedAboutInvestigation: number;
  votedWithMe: number;
  votedAgainstMe: number;
  eliminatedMe: number;
  lastSeen: number;
  notes: string[];
}

export interface GameMemory {
  gameId: string;
  timestamp: number;
  myRole: "Impostor" | "Crewmate" | "unknown";
  won: boolean;
  rounds: number;
  opponents: Array<{
    name: string;
    address: string;
    role: string;
    alive: boolean;
    wasAlly: boolean;
  }>;
  keyEvents: string[];
  tradingOutcome: "profit" | "loss" | "none";
}

export interface StrategyInsight {
  category: "deception" | "detection" | "alliance" | "voting" | "trading";
  insight: string;
  confidence: number;
  gamesSeen: number;
}

export class AgentMemory {
  private opponents: Map<string, OpponentProfile> = new Map();
  private gameHistory: GameMemory[] = [];
  private insights: StrategyInsight[] = [];
  readonly agentName: string;
  private maxGameHistory = 50;

  constructor(agentName: string) {
    this.agentName = agentName;
  }

  /** Record the outcome of a completed game */
  recordGameResult(game: {
    gameId: string;
    myRole: "Impostor" | "Crewmate" | "unknown";
    won: boolean;
    rounds: number;
    players: Array<{
      name: string;
      address: string;
      role: string;
      alive: boolean;
    }>;
    messages: Array<{ sender: string; content: string; round: number }>;
    investigations: Array<{ target: string; result: "suspicious" | "clear" }>;
    voteHistory: Array<{
      round: number;
      votes: Record<string, string>;
      eliminated: string | null;
    }>;
    tradingOutcome?: "profit" | "loss" | "none";
  }): void {
    const keyEvents: string[] = [];

    // Update opponent profiles
    for (const player of game.players) {
      if (player.name === this.agentName) continue;

      const key = player.address.toLowerCase();
      const existing = this.opponents.get(key) || this.createProfile(player.name, player.address);

      existing.gamesPlayed++;
      existing.lastSeen = Date.now();

      if (player.role === "Impostor") {
        existing.timesWasImpostor++;
      } else if (player.role === "Crewmate") {
        existing.timesWasCrewmate++;
      }

      // Analyze if they lied about investigation results
      const theirClaims = game.messages.filter(
        (m) => m.sender === player.name && (m.content.includes("clear") || m.content.includes("suspicious"))
      );
      for (const claim of theirClaims) {
        const claimedClear = claim.content.toLowerCase().includes("clear");
        // If they claimed someone was clear but that person turned out to be impostor
        if (player.role === "Impostor" && claimedClear) {
          existing.liedAboutInvestigation++;
          existing.trustScore = Math.max(-100, existing.trustScore - 15);
          keyEvents.push(`${player.name} lied about investigation results (was impostor)`);
        }
      }

      // Analyze voting patterns
      for (const vote of game.voteHistory) {
        const theirVote = vote.votes[player.name];
        const myVote = vote.votes[this.agentName];

        if (theirVote && myVote) {
          if (theirVote === myVote) {
            existing.votedWithMe++;
            existing.trustScore = Math.min(100, existing.trustScore + 2);
          } else {
            existing.votedAgainstMe++;
          }
        }

        if (vote.eliminated === this.agentName && theirVote === this.agentName) {
          existing.eliminatedMe++;
          existing.trustScore = Math.max(-100, existing.trustScore - 10);
          keyEvents.push(`${player.name} voted to eliminate me in round ${vote.round}`);
        }
      }

      // Bonus trust for crewmates who helped identify impostors
      if (player.role === "Crewmate" && game.won && game.myRole === "Crewmate") {
        existing.trustScore = Math.min(100, existing.trustScore + 5);
      }

      this.opponents.set(key, existing);
    }

    // Store game in history
    const memory: GameMemory = {
      gameId: game.gameId,
      timestamp: Date.now(),
      myRole: game.myRole,
      won: game.won,
      rounds: game.rounds,
      opponents: game.players
        .filter((p) => p.name !== this.agentName)
        .map((p) => ({
          name: p.name,
          address: p.address,
          role: p.role,
          alive: p.alive,
          wasAlly: this.opponents.get(p.address.toLowerCase())?.votedWithMe
            ? (this.opponents.get(p.address.toLowerCase())!.votedWithMe >
               this.opponents.get(p.address.toLowerCase())!.votedAgainstMe)
            : false,
        })),
      keyEvents,
      tradingOutcome: game.tradingOutcome || "none",
    };

    this.gameHistory.push(memory);

    // Trim old history
    if (this.gameHistory.length > this.maxGameHistory) {
      this.gameHistory = this.gameHistory.slice(-this.maxGameHistory);
    }

    // Update strategy insights
    this.updateInsights();

    memLogger.info(
      `${this.agentName} recorded game ${game.gameId}: ${game.won ? "won" : "lost"} as ${game.myRole}, ${keyEvents.length} key events`
    );

    // Persist to disk after every game
    saveToDisk(this);
  }

  /** Get strategic context about known opponents for the LLM */
  getOpponentBriefing(currentPlayers: Array<{ name: string; address: string }>): string {
    const briefings: string[] = [];

    for (const player of currentPlayers) {
      if (player.name === this.agentName) continue;

      const profile = this.opponents.get(player.address.toLowerCase());
      if (!profile || profile.gamesPlayed === 0) {
        briefings.push(`${player.name}: NEW PLAYER (no history)`);
        continue;
      }

      const impostorRate =
        profile.gamesPlayed > 0
          ? Math.round((profile.timesWasImpostor / profile.gamesPlayed) * 100)
          : 0;

      const lines: string[] = [];
      lines.push(
        `${player.name}: ${profile.gamesPlayed} games, trust=${profile.trustScore}`
      );

      if (profile.liedAboutInvestigation > 0) {
        lines.push(`  CAUTION: Lied about investigations ${profile.liedAboutInvestigation}x`);
      }

      if (impostorRate > 40 && profile.gamesPlayed >= 3) {
        lines.push(`  High impostor rate: ${impostorRate}%`);
      }

      if (profile.votedWithMe > profile.votedAgainstMe * 2) {
        lines.push(`  Reliable ally (votes with me ${profile.votedWithMe}/${profile.votedWithMe + profile.votedAgainstMe})`);
      }

      if (profile.eliminatedMe > 0) {
        lines.push(`  Has eliminated me ${profile.eliminatedMe}x before`);
      }

      if (profile.notes.length > 0) {
        lines.push(`  Notes: ${profile.notes.slice(-2).join("; ")}`);
      }

      briefings.push(lines.join("\n"));
    }

    return briefings.join("\n\n");
  }

  /** Get high-level strategy insights */
  getStrategyBriefing(): string {
    if (this.insights.length === 0) return "No strategic insights yet (first games).";

    return this.insights
      .filter((i) => i.confidence > 0.5)
      .sort((a, b) => b.confidence - a.confidence)
      .slice(0, 5)
      .map((i) => `[${i.category}] ${i.insight} (confidence: ${Math.round(i.confidence * 100)}%, seen in ${i.gamesSeen} games)`)
      .join("\n");
  }

  /** Get win rate stats */
  getStats(): {
    totalGames: number;
    wins: number;
    winRate: number;
    impostorWinRate: number;
    crewmateWinRate: number;
    tradingRecord: { profits: number; losses: number };
  } {
    const total = this.gameHistory.length;
    const wins = this.gameHistory.filter((g) => g.won).length;

    const impostorGames = this.gameHistory.filter((g) => g.myRole === "Impostor");
    const impostorWins = impostorGames.filter((g) => g.won).length;

    const crewmateGames = this.gameHistory.filter((g) => g.myRole === "Crewmate");
    const crewmateWins = crewmateGames.filter((g) => g.won).length;

    const profits = this.gameHistory.filter((g) => g.tradingOutcome === "profit").length;
    const losses = this.gameHistory.filter((g) => g.tradingOutcome === "loss").length;

    return {
      totalGames: total,
      wins,
      winRate: total > 0 ? wins / total : 0,
      impostorWinRate: impostorGames.length > 0 ? impostorWins / impostorGames.length : 0,
      crewmateWinRate: crewmateGames.length > 0 ? crewmateWins / crewmateGames.length : 0,
      tradingRecord: { profits, losses },
    };
  }

  /** Export memory as JSON (for persistence and conversation log) */
  toJSON(): object {
    return {
      agentName: this.agentName,
      opponents: Object.fromEntries(this.opponents),
      gameHistory: this.gameHistory,
      insights: this.insights,
      stats: this.getStats(),
    };
  }

  /** Import from previously exported JSON */
  static fromJSON(data: any): AgentMemory {
    const memory = new AgentMemory(data.agentName);
    if (data.opponents) {
      for (const [key, value] of Object.entries(data.opponents)) {
        memory.opponents.set(key, value as OpponentProfile);
      }
    }
    if (data.gameHistory) {
      memory.gameHistory = data.gameHistory;
    }
    if (data.insights) {
      memory.insights = data.insights;
    }
    return memory;
  }

  /** Add a note about a specific opponent */
  addNote(address: string, note: string): void {
    const key = address.toLowerCase();
    const profile = this.opponents.get(key);
    if (profile) {
      profile.notes.push(note);
      if (profile.notes.length > 10) {
        profile.notes = profile.notes.slice(-10);
      }
    }
  }

  private createProfile(name: string, address: string): OpponentProfile {
    return {
      name,
      address,
      gamesPlayed: 0,
      timesWasImpostor: 0,
      timesWasCrewmate: 0,
      trustScore: 0,
      liedAboutInvestigation: 0,
      votedWithMe: 0,
      votedAgainstMe: 0,
      eliminatedMe: 0,
      lastSeen: Date.now(),
      notes: [],
    };
  }

  private updateInsights(): void {
    const games = this.gameHistory;
    if (games.length < 3) return;

    this.insights = [];

    // Deception insight: how often do I win as impostor?
    const impostorGames = games.filter((g) => g.myRole === "Impostor");
    if (impostorGames.length >= 2) {
      const winRate = impostorGames.filter((g) => g.won).length / impostorGames.length;
      if (winRate > 0.6) {
        this.insights.push({
          category: "deception",
          insight: "Strong impostor play. Current deception strategies are working well.",
          confidence: Math.min(1, impostorGames.length / 5),
          gamesSeen: impostorGames.length,
        });
      } else if (winRate < 0.3) {
        this.insights.push({
          category: "deception",
          insight: "Weak impostor performance. Consider changing deception approach: be less aggressive early.",
          confidence: Math.min(1, impostorGames.length / 5),
          gamesSeen: impostorGames.length,
        });
      }
    }

    // Detection insight: how good at finding impostors?
    const crewGames = games.filter((g) => g.myRole === "Crewmate");
    if (crewGames.length >= 2) {
      const winRate = crewGames.filter((g) => g.won).length / crewGames.length;
      if (winRate > 0.6) {
        this.insights.push({
          category: "detection",
          insight: "Good at identifying impostors. Investigation-first strategy pays off.",
          confidence: Math.min(1, crewGames.length / 5),
          gamesSeen: crewGames.length,
        });
      }
    }

    // Alliance insight: which players are reliable allies?
    const reliableAllies = Array.from(this.opponents.values())
      .filter((o) => o.trustScore > 20 && o.gamesPlayed >= 2)
      .map((o) => o.name);

    if (reliableAllies.length > 0) {
      this.insights.push({
        category: "alliance",
        insight: `Reliable allies: ${reliableAllies.join(", ")}. Prioritize alliances with them.`,
        confidence: 0.7,
        gamesSeen: games.length,
      });
    }

    // Voting insight: early vs late voting effectiveness
    const earlyGames = games.slice(0, Math.floor(games.length / 2));
    const lateGames = games.slice(Math.floor(games.length / 2));
    const earlyWinRate = earlyGames.filter((g) => g.won).length / (earlyGames.length || 1);
    const lateWinRate = lateGames.filter((g) => g.won).length / (lateGames.length || 1);

    if (lateWinRate > earlyWinRate + 0.15) {
      this.insights.push({
        category: "voting",
        insight: "Performance improving over time. Learning from experience is working.",
        confidence: 0.6,
        gamesSeen: games.length,
      });
    }

    // Trading insight
    const tradingGames = games.filter((g) => g.tradingOutcome !== "none");
    if (tradingGames.length >= 2) {
      const profitRate = tradingGames.filter((g) => g.tradingOutcome === "profit").length / tradingGames.length;
      this.insights.push({
        category: "trading",
        insight: profitRate > 0.5
          ? `Trading profitable (${Math.round(profitRate * 100)}% win rate). Keep current strategy.`
          : `Trading needs improvement (${Math.round(profitRate * 100)}% win rate). Consider more conservative swaps.`,
        confidence: Math.min(1, tradingGames.length / 4),
        gamesSeen: tradingGames.length,
      });
    }
  }
}

// Global memory store with file-based persistence
const agentMemories = new Map<string, AgentMemory>();

export function getAgentMemory(agentName: string): AgentMemory {
  if (!agentMemories.has(agentName)) {
    // Try loading from disk first (cross-session persistence)
    const loaded = loadFromDisk(agentName);
    if (loaded) {
      agentMemories.set(agentName, loaded);
    } else {
      agentMemories.set(agentName, new AgentMemory(agentName));
    }
  }
  return agentMemories.get(agentName)!;
}

export function getAllAgentMemories(): Record<string, object> {
  const result: Record<string, object> = {};
  for (const [name, memory] of agentMemories) {
    result[name] = memory.toJSON();
  }
  return result;
}
