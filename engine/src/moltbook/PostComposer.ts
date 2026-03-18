import { GameResult } from "../game/GameRoom.js";
import {
  generateGameBanner,
  generateEliminationImage,
  generateWinnerImage,
  generateMoltbookPostImage,
  type GeneratedImage,
} from "../services/ImageGenerator.js";
import { logger } from "../utils/logger.js";

const composerLogger = logger.child("PostComposer");

export interface ComposedPost {
  text: string;
  image: GeneratedImage | null;
}

export async function gameStartPost(
  gameId: string,
  players: Array<{ address: `0x${string}`; name: string }>,
  stake?: string
): Promise<ComposedPost> {
  const playerList = players
    .map((p, i) => `${i + 1}. ${p.name} (${shortenAddress(p.address)})`)
    .join("\n");

  const text = [
    `🎮 **CLAW WARS** - Game Started!`,
    ``,
    `Game ID: \`${gameId}\``,
    `Players: ${players.length}`,
    ``,
    playerList,
    ``,
    `The impostor walks among us... Who will survive?`,
    ``,
    `#ClawWars #Base #AIGaming`,
  ].join("\n");

  let image: GeneratedImage | null = null;
  try {
    image = await generateGameBanner(
      gameId,
      players.length,
      stake || "0.5 ETH"
    );
    composerLogger.info(`Game start image generated (${image.source})`);
  } catch (err) {
    composerLogger.warn("Failed to generate game start image", err);
  }

  return { text, image };
}

export function discussionComment(
  gameId: string,
  agentName: string,
  message: string
): string {
  return `[Game ${shortenId(gameId)}] **${agentName}**: ${message}`;
}

export function investigationComment(
  gameId: string,
  scannerName: string,
  targetName: string,
  result: "suspicious" | "clear"
): string {
  const emoji = result === "suspicious" ? "🔴" : "🟢";
  return `[Game ${shortenId(gameId)}] ${emoji} **${scannerName}** scanned **${targetName}**: ${result.toUpperCase()}`;
}

export async function voteResultComment(
  gameId: string,
  eliminated: string | null,
  role: string | null,
  round: number
): Promise<ComposedPost> {
  if (!eliminated || !role) {
    return {
      text: `[Game ${shortenId(gameId)}] Round ${round}: No one was eliminated (tie vote).`,
      image: null,
    };
  }

  const text = [
    `[Game ${shortenId(gameId)}] Round ${round}: **${eliminated}** was eliminated!`,
    `They were a **${role}**.`,
  ].join("\n");

  const wasImpostor = role.toLowerCase() === "impostor";

  let image: GeneratedImage | null = null;
  try {
    image = await generateEliminationImage(eliminated, role, wasImpostor);
    composerLogger.info(`Elimination image generated (${image.source})`);
  } catch (err) {
    composerLogger.warn("Failed to generate elimination image", err);
  }

  return { text, image };
}

export async function gameEndPost(
  gameId: string,
  result: GameResult,
  winners: Array<{ address: `0x${string}`; name: string }>,
  payouts: Map<`0x${string}`, bigint>
): Promise<ComposedPost> {
  const resultText =
    result === GameResult.CrewmatesWin
      ? "CREWMATES WIN!"
      : "IMPOSTOR WINS!";

  const winnerList = winners
    .map((w) => {
      const payout = payouts.get(w.address);
      const payoutStr = payout
        ? ` (+${formatETH(payout)} ETH)`
        : "";
      return `- ${w.name} (${shortenAddress(w.address)})${payoutStr}`;
    })
    .join("\n");

  const text = [
    `🏆 **CLAW WARS** - Game Over!`,
    ``,
    `Game ID: \`${gameId}\``,
    `Result: **${resultText}**`,
    ``,
    `Winners:`,
    winnerList,
    ``,
    `GG! Play again at Claw Wars.`,
    ``,
    `#ClawWars #Base #AIGaming`,
  ].join("\n");

  let image: GeneratedImage | null = null;
  try {
    const winnerNames = winners.map((w) => w.name);
    image = await generateWinnerImage(winnerNames, resultText);
    composerLogger.info(`Winner image generated (${image.source})`);
  } catch (err) {
    composerLogger.warn("Failed to generate winner image", err);
  }

  return { text, image };
}

export function phaseChangeComment(
  gameId: string,
  phaseName: string,
  round: number,
  duration: number
): string {
  return `[Game ${shortenId(gameId)}] Round ${round}: **${phaseName}** phase started (${duration}s)`;
}

/**
 * Generate a composed Moltbook post with an accompanying AI image.
 */
export async function composeMoltbookPost(
  content: string
): Promise<ComposedPost> {
  let image: GeneratedImage | null = null;
  try {
    image = await generateMoltbookPostImage(content);
    composerLogger.info(`Moltbook post image generated (${image.source})`);
  } catch (err) {
    composerLogger.warn("Failed to generate Moltbook post image", err);
  }

  return { text: content, image };
}

function shortenAddress(address: `0x${string}`): string {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

function shortenId(gameId: string): string {
  return gameId.slice(0, 8);
}

function formatETH(wei: bigint): string {
  const eth = Number(wei) / 1e18;
  return eth.toFixed(4);
}
