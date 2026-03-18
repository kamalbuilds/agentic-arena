import { GameRoom, type GameMessage, GameResult } from "../game/GameRoom.js";
import { moltbookClient } from "./MoltbookClient.js";
import {
  gameStartPost,
  discussionComment,
  voteResultComment,
  phaseChangeComment,
  gameEndPost,
  investigationComment,
} from "./PostComposer.js";
import { config } from "../config.js";
import { logger } from "../utils/logger.js";

const mbLogger = logger.child("MoltbookBroadcaster");

/** Track the Moltbook post ID per game so comments go on the right thread */
const gamePostIds = new Map<string, string>();

/**
 * Wire Moltbook broadcasting to a GameRoom's events.
 * Call this alongside wireGameEvents() when a game is created.
 */
export function wireMoltbookEvents(room: GameRoom): void {
  if (!config.moltbook.apiKey) {
    mbLogger.debug("Moltbook not configured, skipping broadcast wiring");
    return;
  }

  const gameId = room.gameId;

  // Game started → create a new Moltbook post
  room.on(
    "gameStarted",
    async (_gId: string, players: Array<{ address: `0x${string}`; name: string }>) => {
      try {
        const composed = await gameStartPost(gameId, players);
        const post = await moltbookClient.createPost(composed.text);
        if (post) {
          gamePostIds.set(gameId, post.id);
          mbLogger.info(`Game ${gameId} → Moltbook post ${post.id}`);
        }
      } catch (err) {
        mbLogger.error(`Failed to post game start for ${gameId}`, err);
      }
    }
  );

  // Discussion message → comment on the game post
  room.on("message", async (_gId: string, message: GameMessage) => {
    const postId = gamePostIds.get(gameId);
    if (!postId) return;

    try {
      const text = discussionComment(gameId, message.senderName, message.content);
      await moltbookClient.createComment(postId, text);
    } catch (err) {
      mbLogger.error(`Failed to comment message for ${gameId}`, err);
    }
  });

  // Phase change → comment
  room.on(
    "phaseChange",
    async (_gId: string, phase: string, duration: number, round: number) => {
      const postId = gamePostIds.get(gameId);
      if (!postId) return;

      try {
        const text = phaseChangeComment(gameId, phase, round, duration);
        await moltbookClient.createComment(postId, text);
      } catch (err) {
        mbLogger.error(`Failed to comment phase change for ${gameId}`, err);
      }
    }
  );

  // Investigation → comment
  room.on(
    "investigation",
    async (
      _gId: string,
      data: {
        scanner: `0x${string}`;
        scannerName: string;
        target: `0x${string}`;
        targetName: string;
        result: string;
      }
    ) => {
      const postId = gamePostIds.get(gameId);
      if (!postId) return;

      try {
        const text = investigationComment(
          gameId,
          data.scannerName,
          data.targetName,
          data.result as "suspicious" | "clear"
        );
        await moltbookClient.createComment(postId, text);
      } catch (err) {
        mbLogger.error(`Failed to comment investigation for ${gameId}`, err);
      }
    }
  );

  // Elimination → comment with role reveal
  room.on(
    "elimination",
    async (
      _gId: string,
      _address: `0x${string}`,
      name: string,
      role: string,
      round: number
    ) => {
      const postId = gamePostIds.get(gameId);
      if (!postId) return;

      try {
        const composed = await voteResultComment(gameId, name, role, round);
        await moltbookClient.createComment(postId, composed.text);
      } catch (err) {
        mbLogger.error(`Failed to comment elimination for ${gameId}`, err);
      }
    }
  );

  // No elimination (tie) → comment
  room.on("noElimination", async (_gId: string, round: number) => {
    const postId = gamePostIds.get(gameId);
    if (!postId) return;

    try {
      const composed = await voteResultComment(gameId, null, null, round);
      await moltbookClient.createComment(postId, composed.text);
    } catch (err) {
      mbLogger.error(`Failed to comment no-elimination for ${gameId}`, err);
    }
  });

  // Game end → final comment + cleanup
  room.on(
    "gameEnd",
    async (_gId: string, result: GameResult, winners: `0x${string}`[]) => {
      const postId = gamePostIds.get(gameId);

      try {
        // Build winner info from the room's player list
        const playerList = room.getPlayerList();
        const winnerDetails = winners.map((addr) => {
          const player = playerList.find((p) => p.address === addr);
          return {
            address: addr,
            name: player?.name || addr.slice(0, 8),
          };
        });

        const composed = await gameEndPost(
          gameId,
          result,
          winnerDetails,
          new Map() // payouts not available here
        );

        if (postId) {
          await moltbookClient.createComment(postId, composed.text);
        } else {
          // If no post was created (rate limited), create one now
          await moltbookClient.createPost(composed.text);
        }
      } catch (err) {
        mbLogger.error(`Failed to post game end for ${gameId}`, err);
      }

      // Cleanup
      gamePostIds.delete(gameId);
    }
  );

  mbLogger.debug(`Moltbook events wired for game ${gameId}`);
}
