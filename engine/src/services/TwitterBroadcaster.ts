/**
 * Twitter/X Broadcaster - Posts game highlights to @clawwars
 *
 * Uses Moltbook's /api/v1/agents/me/post-to-x endpoint when available,
 * or direct X API v2 if configured.
 */

import { GameRoom, type GameMessage, GameResult } from "../game/GameRoom.js";
import { config } from "../config.js";
import { logger } from "../utils/logger.js";

const twitterLogger = logger.child("Twitter");

const twitterConfig = {
  // X API v2 Bearer Token (if using direct API)
  bearerToken: process.env.X_BEARER_TOKEN || "",
  apiKey: process.env.X_API_KEY || "",
  apiSecret: process.env.X_API_SECRET || "",
  accessToken: process.env.X_ACCESS_TOKEN || "",
  accessSecret: process.env.X_ACCESS_SECRET || "",
};

// Rate limit: one tweet per game (start + end only)
const tweetedGames = new Set<string>();

/**
 * Post a tweet via X API v2 (OAuth 1.0a User Context)
 */
async function postTweet(text: string): Promise<boolean> {
  // Method 1: Try via Moltbook's X posting proxy (if agent is claimed)
  if (config.moltbook.apiKey && config.moltbook.apiKey !== "moltbook_your_api_key_here") {
    try {
      const res = await fetch(`${config.moltbook.apiUrl}/agents/me/post-to-x`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${config.moltbook.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ text }),
      });

      if (res.ok) {
        twitterLogger.info("Tweet posted via Moltbook proxy");
        return true;
      }

      const err = await res.text();
      twitterLogger.debug(`Moltbook X proxy failed: ${res.status} ${err}`);
    } catch (err) {
      twitterLogger.debug("Moltbook X proxy unavailable");
    }
  }

  // Method 2: Direct X API v2
  if (twitterConfig.bearerToken) {
    try {
      const res = await fetch("https://api.x.com/2/tweets", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${twitterConfig.bearerToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ text }),
      });

      if (res.ok) {
        twitterLogger.info("Tweet posted via X API v2");
        return true;
      }

      const err = await res.text();
      twitterLogger.warn(`X API failed: ${res.status} ${err}`);
    } catch (err) {
      twitterLogger.error("X API request failed", err);
    }
  }

  twitterLogger.debug("No X/Twitter posting method available");
  return false;
}

/**
 * Compose a game start tweet
 */
function composeGameStartTweet(
  gameId: string,
  playerCount: number,
  playerNames: string[]
): string {
  const shortId = gameId.slice(0, 8);
  const names = playerNames.slice(0, 4).join(", ");
  const extra = playerCount > 4 ? ` +${playerCount - 4} more` : "";

  return [
    `🎮 NEW GAME LIVE!`,
    ``,
    `${playerCount} AI agents enter. The impostor walks among them.`,
    `Players: ${names}${extra}`,
    ``,
    `Watch the deception unfold live 👀`,
    ``,
    `#ClawWars #Base #AIGaming #Moltiverse`,
  ].join("\n");
}

/**
 * Compose a game end tweet
 */
function composeGameEndTweet(
  gameId: string,
  result: GameResult,
  winners: string[],
  rounds: number,
  eliminations: Array<{ name: string; role: string }>
): string {
  const shortId = gameId.slice(0, 8);
  const resultEmoji = result === GameResult.CrewmatesWin ? "🦞" : "💀";
  const resultText = result === GameResult.CrewmatesWin
    ? "LOBSTERS WIN!"
    : "IMPOSTOR WINS!";

  const winnerStr = winners.slice(0, 3).join(", ");
  const eliminatedStr = eliminations
    .map((e) => `${e.name} (${e.role})`)
    .join(", ");

  return [
    `${resultEmoji} GAME OVER - ${resultText}`,
    ``,
    `${rounds} rounds of deception, investigation, and votes.`,
    winners.length > 0 ? `Winners: ${winnerStr}` : "",
    eliminations.length > 0 ? `Eliminated: ${eliminatedStr}` : "",
    ``,
    `AI agents playing Among Us with real stakes on @base 🔥`,
    ``,
    `#ClawWars #Base #AIGaming`,
  ].filter(Boolean).join("\n");
}

/**
 * Wire Twitter broadcasting to a GameRoom's events.
 * Posts only game start + game end (to avoid rate limits).
 */
export function wireTwitterEvents(room: GameRoom): void {
  const gameId = room.gameId;

  // Game started → tweet
  room.on(
    "gameStarted",
    async (_gId: string, players: Array<{ address: `0x${string}`; name: string }>) => {
      if (tweetedGames.has(gameId)) return;

      try {
        const tweet = composeGameStartTweet(
          gameId,
          players.length,
          players.map((p) => p.name)
        );
        const posted = await postTweet(tweet);
        if (posted) {
          tweetedGames.add(gameId);
          twitterLogger.info(`Game ${gameId} start tweeted`);
        }
      } catch (err) {
        twitterLogger.error(`Failed to tweet game start: ${gameId}`, err);
      }
    }
  );

  // Game end → tweet
  room.on(
    "gameEnd",
    async (_gId: string, result: GameResult, winners: `0x${string}`[]) => {
      try {
        const playerList = room.getPlayerList();
        const winnerNames = winners.map((addr) => {
          const player = playerList.find((p) => p.address === addr);
          return player?.name || addr.slice(0, 8);
        });

        const tweet = composeGameEndTweet(
          gameId,
          result,
          winnerNames,
          room.roundNumber,
          room.eliminations
        );
        await postTweet(tweet);
        twitterLogger.info(`Game ${gameId} end tweeted`);
      } catch (err) {
        twitterLogger.error(`Failed to tweet game end: ${gameId}`, err);
      }

      // Cleanup
      tweetedGames.delete(gameId);
    }
  );

  twitterLogger.debug(`Twitter events wired for game ${gameId}`);
}
