import { GoogleGenerativeAI } from "@google/generative-ai";
import { config } from "../config.js";
import { logger } from "../utils/logger.js";

const themeLogger = logger.child("ThemeGenerator");

const FALLBACK_API_KEY = process.env.GEMINI_API_KEY!;

function getGenAI(): GoogleGenerativeAI {
  const apiKey = config.gemini.apiKey || FALLBACK_API_KEY;
  return new GoogleGenerativeAI(apiKey);
}

// ---------- Caching ----------

const themeCache = new Map<string, GameTheme>();
const agentDescCache = new Map<string, string>();

// ---------- Types ----------

export interface GameTheme {
  title: string;
  setting: string;
  mood: string;
  narrative: string;
  colorPalette: string[];
}

export interface RoundNarrative {
  intro: string;
  tension: string;
  cliffhanger: string;
}

// ---------- Text generation helper ----------

async function generateText(prompt: string): Promise<string> {
  const genAI = getGenAI();
  const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

  const result = await model.generateContent(prompt);
  return result.response.text().trim();
}

// ---------- Public API ----------

/**
 * Generate a unique dramatic theme for a game. Each game gets a distinct
 * narrative setting that makes the Moltbook content more engaging.
 */
export async function generateGameTheme(
  gameId: string,
  playerNames: string[]
): Promise<GameTheme> {
  // Return cached theme if available
  const cached = themeCache.get(gameId);
  if (cached) return cached;

  themeLogger.info(`Generating game theme for ${gameId}`);

  const prompt = [
    "You are a creative writer for an underwater social-deduction game called 'Claw Wars' featuring lobster characters.",
    "Generate a unique dramatic theme/setting for a new game session.",
    "",
    `Players joining this round: ${playerNames.join(", ")}`,
    "",
    "Return ONLY valid JSON (no markdown fences) with this exact structure:",
    '{',
    '  "title": "A dramatic two-to-five word title for this game session",',
    '  "setting": "A one-sentence description of the unique location/scenario (max 30 words)",',
    '  "mood": "A single evocative word describing the atmosphere",',
    '  "narrative": "A two-to-three sentence dramatic opening narrative (max 80 words)",',
    '  "colorPalette": ["hex1", "hex2", "hex3", "hex4"] // 4 theme colours as hex strings',
    '}',
  ].join("\n");

  try {
    const raw = await generateText(prompt);

    // Strip markdown fences if present
    const jsonStr = raw.replace(/```json?\s*/gi, "").replace(/```\s*/g, "").trim();
    const parsed = JSON.parse(jsonStr) as GameTheme;

    // Validate required fields
    if (!parsed.title || !parsed.setting || !parsed.narrative) {
      throw new Error("Missing required theme fields");
    }

    // Ensure colorPalette is an array
    if (!Array.isArray(parsed.colorPalette)) {
      parsed.colorPalette = ["#FF4444", "#44AAFF", "#44FF88", "#FFD700"];
    }

    themeCache.set(gameId, parsed);
    themeLogger.info(`Theme generated: "${parsed.title}"`);
    return parsed;
  } catch (err) {
    themeLogger.warn("Theme generation failed, using fallback", err);

    const fallback: GameTheme = {
      title: "Tides of Deception",
      setting:
        "Deep beneath the Base Trench, a research station hums with suspicion.",
      mood: "ominous",
      narrative:
        `The ${playerNames.length} crew members of Station Claw-9 thought this was a routine shift. But when the sonar pinged an anomaly, everyone started eyeing each other. Someone among them is not who they claim to be.`,
      colorPalette: ["#FF4444", "#1A1A3E", "#00D4FF", "#FFD700"],
    };

    themeCache.set(gameId, fallback);
    return fallback;
  }
}

/**
 * Generate a thematic description for an agent, making them feel like
 * a character in the game's narrative.
 */
export async function generateAgentDescription(
  agentName: string,
  gameTheme?: GameTheme
): Promise<string> {
  const cacheKey = `${agentName}:${gameTheme?.title || "default"}`;
  const cached = agentDescCache.get(cacheKey);
  if (cached) return cached;

  themeLogger.info(`Generating agent description for ${agentName}`);

  const settingContext = gameTheme
    ? `The game's theme is "${gameTheme.title}" set in: ${gameTheme.setting}. The mood is ${gameTheme.mood}.`
    : "The game takes place in an underwater space station.";

  const prompt = [
    "You are a creative writer for an underwater social-deduction game called 'Claw Wars' featuring lobster characters.",
    settingContext,
    "",
    `Generate a short, dramatic character introduction for a lobster agent named "${agentName}".`,
    "The description should be 1-2 sentences, evocative, and hint at personality without revealing their role.",
    "Return ONLY the description text, no quotes or labels.",
  ].join("\n");

  try {
    const description = await generateText(prompt);
    agentDescCache.set(cacheKey, description);
    return description;
  } catch (err) {
    themeLogger.warn(`Agent description generation failed for ${agentName}`, err);
    const fallback = `${agentName} emerges from the shadows, claws clicking with quiet purpose. Their intentions remain a mystery.`;
    agentDescCache.set(cacheKey, fallback);
    return fallback;
  }
}

/**
 * Generate a dramatic round summary as a narrative. This transforms the raw
 * game events into an engaging story for Moltbook readers.
 */
export async function generateRoundNarrative(
  gameId: string,
  roundNumber: number,
  events: {
    messages: Array<{ sender: string; content: string }>;
    eliminated: string | null;
    eliminatedRole: string | null;
    voteTally: Record<string, number>;
    alivePlayers: string[];
  },
  gameTheme?: GameTheme
): Promise<RoundNarrative> {
  themeLogger.info(`Generating round ${roundNumber} narrative for ${gameId}`);

  const themeContext = gameTheme
    ? `Theme: "${gameTheme.title}" - ${gameTheme.setting} (${gameTheme.mood})`
    : "Setting: underwater space station with lobster crew members";

  const messageExcerpts = events.messages
    .slice(-10)
    .map((m) => `${m.sender}: "${m.content.slice(0, 80)}"`)
    .join("\n");

  const eliminationText = events.eliminated
    ? `${events.eliminated} was eliminated and revealed to be a ${events.eliminatedRole}.`
    : "No one was eliminated this round (tie vote).";

  const voteBreakdown = Object.entries(events.voteTally)
    .map(([target, count]) => `${target}: ${count} votes`)
    .join(", ");

  const prompt = [
    "You are a dramatic narrator for an underwater social-deduction game called 'Claw Wars' with lobster characters.",
    themeContext,
    "",
    `Round ${roundNumber} Summary:`,
    `Alive players: ${events.alivePlayers.join(", ")}`,
    "",
    "Key discussion excerpts:",
    messageExcerpts || "(no discussion recorded)",
    "",
    `Vote results: ${voteBreakdown || "no votes cast"}`,
    eliminationText,
    "",
    "Generate a dramatic narrative for this round. Return ONLY valid JSON (no markdown fences):",
    '{',
    '  "intro": "A one-sentence dramatic opening for the round (max 25 words)",',
    '  "tension": "A two-sentence account of the key moments - accusations, defences, suspicion (max 60 words)",',
    '  "cliffhanger": "A one-sentence dramatic ending that builds anticipation for the next round (max 25 words)"',
    '}',
  ].join("\n");

  try {
    const raw = await generateText(prompt);
    const jsonStr = raw.replace(/```json?\s*/gi, "").replace(/```\s*/g, "").trim();
    const parsed = JSON.parse(jsonStr) as RoundNarrative;

    if (!parsed.intro || !parsed.tension || !parsed.cliffhanger) {
      throw new Error("Missing required narrative fields");
    }

    return parsed;
  } catch (err) {
    themeLogger.warn(`Round narrative generation failed for round ${roundNumber}`, err);

    return {
      intro: `Round ${roundNumber} began with whispered accusations echoing through the station corridors.`,
      tension: events.eliminated
        ? `After heated deliberation, ${events.eliminated} was dragged to the airlock. The revelation of their role as ${events.eliminatedRole} sent shockwaves through the remaining crew.`
        : `The vote ended in a deadlock. No one was eliminated, but trust eroded further among the crew.`,
      cliffhanger: `As the lights flickered, ${events.alivePlayers.length} lobsters remained, each wondering who would be next.`,
    };
  }
}

/**
 * Generate a dramatic game summary suitable for a final Moltbook post.
 */
export async function generateGameSummary(
  gameId: string,
  totalRounds: number,
  result: "crewmates_win" | "impostor_wins",
  winnerNames: string[],
  eliminationHistory: Array<{ name: string; role: string; round: number }>,
  gameTheme?: GameTheme
): Promise<string> {
  themeLogger.info(`Generating game summary for ${gameId}`);

  const themeContext = gameTheme
    ? `Theme: "${gameTheme.title}" - ${gameTheme.setting}`
    : "Setting: underwater space station";

  const eliminationTimeline = eliminationHistory
    .map((e) => `Round ${e.round}: ${e.name} eliminated (${e.role})`)
    .join("\n");

  const resultText =
    result === "crewmates_win"
      ? `The crewmates won! Winners: ${winnerNames.join(", ")}`
      : `The impostor won! The deceiver: ${winnerNames.join(", ")}`;

  const prompt = [
    "You are a dramatic sports commentator covering an underwater social-deduction game called 'Claw Wars' with lobster characters.",
    themeContext,
    "",
    `Game lasted ${totalRounds} rounds.`,
    "Elimination timeline:",
    eliminationTimeline || "No eliminations occurred.",
    "",
    resultText,
    "",
    "Write a dramatic 3-4 sentence game summary that captures the key moments.",
    "Write it as if you are a breathless commentator recapping an epic contest.",
    "Return ONLY the summary text.",
  ].join("\n");

  try {
    return await generateText(prompt);
  } catch (err) {
    themeLogger.warn("Game summary generation failed", err);

    const winType =
      result === "crewmates_win" ? "The crewmates prevailed" : "The impostor claimed victory";
    return `After ${totalRounds} rounds of suspicion and betrayal, ${winType}. ${eliminationHistory.length} lobsters were eliminated along the way. The winners - ${winnerNames.join(", ")} - earned their place in Claw Wars history.`;
  }
}

/**
 * Clear cached data for a completed game.
 */
export function clearGameThemeCache(gameId: string): void {
  themeCache.delete(gameId);
}
