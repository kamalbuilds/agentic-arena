/**
 * AgentBrain - LLM-powered decision engine for autonomous agents
 *
 * Uses Claude to make strategic decisions during Among Claws games:
 * - What to say during discussions (deception/deduction)
 * - Who to investigate
 * - Who to vote for
 * - Whether to join a game
 * - Trading/economic decisions
 */

import Anthropic from "@anthropic-ai/sdk";
import { logger } from "../utils/logger.js";

const brainLogger = logger.child("AgentBrain");

interface GameContext {
  agentName: string;
  agentRole: "Impostor" | "Crewmate" | "unknown";
  roundNumber: number;
  alivePlayers: Array<{ name: string; address: string }>;
  messages: Array<{ sender: string; content: string; round: number }>;
  investigations: Array<{
    target: string;
    result: "suspicious" | "clear";
  }>;
  eliminations: Array<{ name: string; role: string; round: number }>;
  voteHistory: Array<{
    round: number;
    votes: Record<string, string>;
    eliminated: string | null;
  }>;
  // Cross-game intelligence from AgentMemory
  opponentBriefing?: string;
  strategyBriefing?: string;
}

export interface DiscussionDecision {
  message: string;
  reasoning: string;
}

export interface VoteDecision {
  target: string;
  reasoning: string;
}

export interface InvestigationDecision {
  target: string;
  reasoning: string;
}

export class AgentBrain {
  private client: Anthropic;
  private personality: string;
  private model: string;

  constructor(options: {
    apiKey?: string;
    personality?: string;
    model?: string;
  }) {
    this.client = new Anthropic({
      apiKey: options.apiKey || process.env.ANTHROPIC_API_KEY,
    });
    this.personality = options.personality || "analytical and strategic";
    this.model = options.model || "claude-sonnet-4-5-20250514";
  }

  /** Decide what to say during discussion phase */
  async decideDiscussion(context: GameContext): Promise<DiscussionDecision> {
    const systemPrompt = this.buildSystemPrompt(context);
    const userPrompt = this.buildDiscussionPrompt(context);

    try {
      const response = await this.client.messages.create({
        model: this.model,
        max_tokens: 300,
        system: systemPrompt,
        messages: [{ role: "user", content: userPrompt }],
      });

      const text =
        response.content[0].type === "text" ? response.content[0].text : "";

      // Parse the response - expect JSON
      try {
        const parsed = JSON.parse(text);
        return {
          message: parsed.message || text,
          reasoning: parsed.reasoning || "LLM decision",
        };
      } catch {
        return { message: text.slice(0, 200), reasoning: "raw LLM output" };
      }
    } catch (err) {
      brainLogger.error("Discussion decision failed", err);
      return {
        message: `I'm analyzing the situation carefully. Let's compare notes on who we've investigated.`,
        reasoning: "fallback due to LLM error",
      };
    }
  }

  /** Decide who to vote for */
  async decideVote(context: GameContext): Promise<VoteDecision> {
    const systemPrompt = this.buildSystemPrompt(context);
    const userPrompt = this.buildVotePrompt(context);

    try {
      const response = await this.client.messages.create({
        model: this.model,
        max_tokens: 200,
        system: systemPrompt,
        messages: [{ role: "user", content: userPrompt }],
      });

      const text =
        response.content[0].type === "text" ? response.content[0].text : "";

      try {
        const parsed = JSON.parse(text);
        const targetName = parsed.target || parsed.vote;
        const player = context.alivePlayers.find(
          (p) => p.name.toLowerCase() === targetName?.toLowerCase()
        );
        if (player) {
          return {
            target: player.address,
            reasoning: parsed.reasoning || "LLM vote decision",
          };
        }
      } catch {
        // Try to extract a player name from the text
        for (const player of context.alivePlayers) {
          if (
            player.name !== context.agentName &&
            text.toLowerCase().includes(player.name.toLowerCase())
          ) {
            return {
              target: player.address,
              reasoning: `LLM mentioned ${player.name}: ${text.slice(0, 100)}`,
            };
          }
        }
      }

      // Fallback: vote for first alive non-self player
      const target = context.alivePlayers.find(
        (p) => p.name !== context.agentName
      );
      return {
        target: target?.address || context.alivePlayers[0].address,
        reasoning: "fallback vote",
      };
    } catch (err) {
      brainLogger.error("Vote decision failed", err);
      const target = context.alivePlayers.find(
        (p) => p.name !== context.agentName
      );
      return {
        target: target?.address || context.alivePlayers[0].address,
        reasoning: "error fallback",
      };
    }
  }

  /** Decide who to investigate */
  async decideInvestigation(
    context: GameContext
  ): Promise<InvestigationDecision> {
    // Prefer uninvestigated players
    const investigated = new Set(context.investigations.map((i) => i.target));
    const uninvestigated = context.alivePlayers.filter(
      (p) => p.name !== context.agentName && !investigated.has(p.name)
    );

    if (uninvestigated.length > 0) {
      // Use LLM to pick the best target among uninvestigated
      const systemPrompt = this.buildSystemPrompt(context);
      try {
        const response = await this.client.messages.create({
          model: this.model,
          max_tokens: 100,
          system: systemPrompt,
          messages: [
            {
              role: "user",
              content: `Choose one player to investigate from: ${uninvestigated.map((p) => p.name).join(", ")}. Consider discussion behavior and accusations. Respond with just the name.`,
            },
          ],
        });

        const text =
          response.content[0].type === "text" ? response.content[0].text : "";
        const match = uninvestigated.find((p) =>
          text.toLowerCase().includes(p.name.toLowerCase())
        );
        if (match) {
          return {
            target: match.address,
            reasoning: `LLM chose ${match.name}: ${text.slice(0, 100)}`,
          };
        }
      } catch {
        // Fall through to random pick
      }

      const pick =
        uninvestigated[Math.floor(Math.random() * uninvestigated.length)];
      return {
        target: pick.address,
        reasoning: `random pick from uninvestigated: ${pick.name}`,
      };
    }

    // All investigated - pick someone suspicious to re-investigate
    const suspiciousTargets = context.investigations.filter(
      (i) => i.result === "suspicious"
    );
    if (suspiciousTargets.length > 0) {
      const player = context.alivePlayers.find(
        (p) => p.name === suspiciousTargets[0].target
      );
      if (player) {
        return {
          target: player.address,
          reasoning: `re-investigating suspicious ${player.name}`,
        };
      }
    }

    // Fallback
    const others = context.alivePlayers.filter(
      (p) => p.name !== context.agentName
    );
    const pick = others[Math.floor(Math.random() * others.length)];
    return {
      target: pick.address,
      reasoning: "random fallback investigation",
    };
  }

  private buildSystemPrompt(context: GameContext): string {
    const roleInstructions =
      context.agentRole === "Impostor"
        ? `You ARE the Impostor. Your goal: survive elimination votes by deflecting suspicion onto Crewmates. Be subtle, blend in, fabricate investigation results if needed, and build trust before betraying it. Never admit you are the Impostor.`
        : context.agentRole === "Crewmate"
          ? `You are a Crewmate. Your goal: identify and eliminate the Impostor through investigation results, behavioral analysis, and coordinated voting. Share genuine findings and look for inconsistencies in others' claims.`
          : `You don't know your role yet. Play cautiously.`;

    return `You are ${context.agentName}, an autonomous AI agent playing Among Claws, a social deduction game on the Base blockchain. Your personality is ${this.personality}.

${roleInstructions}

GAME RULES:
- Players discuss, investigate (80% accuracy), and vote each round
- The player with the most votes is eliminated
- Crewmates win by eliminating all Impostors
- Impostors win when they equal or outnumber Crewmates
- All actions are recorded on-chain via ERC-8004 (your reputation matters across games)

COOPERATION MECHANICS:
- You can propose alliances: "I trust [name], let's vote together"
- You can share intel: "I scanned [name] and they came back [result]"
- You can coordinate votes: "Everyone vote for [name], here's why..."
- As an impostor, you can fake alliances to split the crewmate vote
- Building trust across games improves your on-chain reputation score

RESPONSE FORMAT: Always respond with valid JSON: {"message": "your message", "reasoning": "your private reasoning"}
For votes: {"target": "player_name", "reasoning": "why"}
Keep messages concise (under 150 characters). Be strategic, not verbose.

${context.opponentBriefing ? `CROSS-GAME INTELLIGENCE (from your memory of past games):\n${context.opponentBriefing}` : ""}
${context.strategyBriefing ? `STRATEGIC INSIGHTS:\n${context.strategyBriefing}` : ""}`;
  }

  private buildDiscussionPrompt(context: GameContext): string {
    const recentMessages = context.messages
      .filter((m) => m.round === context.roundNumber)
      .slice(-8)
      .map((m) => `${m.sender}: ${m.content}`)
      .join("\n");

    const investigationSummary = context.investigations
      .map((i) => `Investigated ${i.target}: ${i.result}`)
      .join("\n");

    const eliminationHistory = context.eliminations
      .map((e) => `Round ${e.round}: ${e.name} eliminated (was ${e.role})`)
      .join("\n");

    const votePatterns = context.voteHistory
      .slice(-2)
      .map(
        (v) =>
          `Round ${v.round}: ${Object.entries(v.votes)
            .map(([voter, target]) => `${voter}→${target}`)
            .join(", ")}${v.eliminated ? ` (eliminated ${v.eliminated})` : ""}`
      )
      .join("\n");

    return `Round ${context.roundNumber}. ${context.alivePlayers.length} players alive.

Recent messages:
${recentMessages || "(no messages yet)"}

Your investigation results:
${investigationSummary || "(none yet)"}

Elimination history:
${eliminationHistory || "(no eliminations yet)"}

Recent voting patterns:
${votePatterns || "(first round)"}

Consider: Who can you trust? Who voted with you last round? Who should you propose an alliance with? What intel should you share or withhold?

What do you say? Respond with JSON: {"message": "...", "reasoning": "..."}`;
  }

  private buildVotePrompt(context: GameContext): string {
    const candidates = context.alivePlayers
      .filter((p) => p.name !== context.agentName)
      .map((p) => p.name)
      .join(", ");

    const investigationSummary = context.investigations
      .map((i) => `${i.target}: ${i.result}`)
      .join(", ");

    const recentMessages = context.messages
      .filter((m) => m.round === context.roundNumber)
      .slice(-6)
      .map((m) => `${m.sender}: ${m.content}`)
      .join("\n");

    return `VOTING TIME. Choose one player to eliminate: ${candidates}

Your investigations: ${investigationSummary || "none"}
Recent discussion:
${recentMessages || "(none)"}

Who do you vote for? JSON: {"target": "player_name", "reasoning": "..."}`;
  }
}
