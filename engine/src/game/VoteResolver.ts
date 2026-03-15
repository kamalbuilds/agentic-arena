import { logger } from "../utils/logger.js";

const voteLogger = logger.child("VoteResolver");

export interface VoteRecord {
  voter: `0x${string}`;
  target: `0x${string}`;
  timestamp: number;
}

export interface RoundVoteHistory {
  round: number;
  votes: VoteRecord[];
  eliminated: `0x${string}` | null;
}

// gameId -> list of votes (current round)
const voteStorage = new Map<string, VoteRecord[]>();
// gameId -> archived vote history per round
const voteHistory = new Map<string, RoundVoteHistory[]>();

export function recordVote(
  gameId: string,
  voter: `0x${string}`,
  target: `0x${string}`
): void {
  if (!voteStorage.has(gameId)) {
    voteStorage.set(gameId, []);
  }

  const votes = voteStorage.get(gameId)!;

  // Check if voter already voted this round, replace if so
  const existingIdx = votes.findIndex(
    (v) => v.voter.toLowerCase() === voter.toLowerCase()
  );
  if (existingIdx >= 0) {
    voteLogger.info(
      `Player ${voter} changed vote from ${votes[existingIdx].target} to ${target} in game ${gameId}`
    );
    votes[existingIdx] = { voter, target, timestamp: Date.now() };
  } else {
    votes.push({ voter, target, timestamp: Date.now() });
    voteLogger.info(
      `Player ${voter} voted for ${target} in game ${gameId}`
    );
  }
}

export function resolveVotes(gameId: string): `0x${string}` | null {
  const tally = getVoteTally(gameId);

  if (tally.size === 0) {
    voteLogger.info(`No votes cast in game ${gameId}`);
    return null;
  }

  // Find the maximum vote count
  let maxVotes = 0;
  let maxTargets: `0x${string}`[] = [];

  for (const [target, count] of tally) {
    if (count > maxVotes) {
      maxVotes = count;
      maxTargets = [target];
    } else if (count === maxVotes) {
      maxTargets.push(target);
    }
  }

  // If tie, randomly pick one of the tied leaders (tiebreaker)
  if (maxTargets.length > 1) {
    const picked = maxTargets[Math.floor(Math.random() * maxTargets.length)];
    voteLogger.info(
      `Vote tie in game ${gameId} between ${maxTargets.length} players with ${maxVotes} votes each — tiebreaker eliminates ${picked}`
    );
    return picked;
  }

  const eliminated = maxTargets[0];
  voteLogger.info(
    `Player ${eliminated} eliminated in game ${gameId} with ${maxVotes} votes`
  );
  return eliminated;
}

export function getVoteTally(gameId: string): Map<`0x${string}`, number> {
  const votes = voteStorage.get(gameId) || [];
  const tally = new Map<`0x${string}`, number>();

  for (const vote of votes) {
    const normalizedTarget = vote.target.toLowerCase() as `0x${string}`;
    const current = tally.get(normalizedTarget) || 0;
    tally.set(normalizedTarget, current + 1);
  }

  return tally;
}

export function getVoteRecords(gameId: string): VoteRecord[] {
  return voteStorage.get(gameId) || [];
}

/** Archive current round's votes before resetting. Call this after resolveVotes. */
export function archiveRoundVotes(
  gameId: string,
  round: number,
  eliminated: `0x${string}` | null
): void {
  const currentVotes = voteStorage.get(gameId) || [];
  if (!voteHistory.has(gameId)) {
    voteHistory.set(gameId, []);
  }
  voteHistory.get(gameId)!.push({
    round,
    votes: [...currentVotes],
    eliminated,
  });
  voteLogger.info(`Archived ${currentVotes.length} votes for game ${gameId} round ${round}`);
}

/** Get full vote history for all completed rounds */
export function getVoteHistory(gameId: string): RoundVoteHistory[] {
  return voteHistory.get(gameId) || [];
}

export function resetVotes(gameId: string): void {
  voteStorage.set(gameId, []);
  voteLogger.info(`Votes reset for game ${gameId}`);
}

export function cleanupVotes(gameId: string): void {
  voteStorage.delete(gameId);
  // Keep vote history - don't delete it so spectators can review after game ends
}
