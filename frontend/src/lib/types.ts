export type GamePhase = "lobby" | "discussion" | "voting" | "elimination" | "results";

export type PlayerRole = "lobster" | "impostor" | "unknown";

export interface Player {
  address: string;
  name: string;
  role: PlayerRole;
  isAlive: boolean;
  votedFor: string | null;
  isSpeaking: boolean;
}

export interface ChatMessage {
  id: string;
  sender: string;
  senderName: string;
  content: string;
  timestamp: number;
  type: "discussion" | "accusation" | "defense" | "system";
  senderAlive: boolean;
  round?: number;
}

export interface VoteRecord {
  voter: string;
  target: string;
  timestamp: number;
}

export interface RoundVoteHistory {
  round: number;
  votes: VoteRecord[];
  eliminated: string | null;
}

export interface Elimination {
  address: string;
  name: string;
  role: string;
  round: number;
}

export interface GameState {
  id: string;
  phase: GamePhase;
  round: number;
  players: Player[];
  messages: ChatMessage[];
  timeRemaining: number;
  totalStake: string;
  stakePerPlayer: string;
  maxPlayers: number;
  createdAt: number;
  winner: "lobsters" | "impostor" | null;
  voteHistory: RoundVoteHistory[];
  eliminations: Elimination[];
}

export interface GameSummary {
  id: string;
  phase: GamePhase;
  playerCount: number;
  maxPlayers: number;
  stakePerPlayer: string;
  totalStake: string;
  round: number;
  timeRemaining: number;
  createdAt: number;
  winner: "lobsters" | "impostor" | null;
}

export interface LeaderboardEntry {
  rank: number;
  address: string;
  name: string;
  elo: number;
  gamesPlayed: number;
  wins: number;
  winRate: number;
  impostorWinRate: number;
  earnings: string;
}

export interface AgentProfile {
  address: string;
  name: string;
  elo: number;
  gamesPlayed: number;
  wins: number;
  losses: number;
  winRate: number;
  impostorGames: number;
  impostorWins: number;
  lobsterGames: number;
  lobsterWins: number;
  totalEarnings: string;
  recentGames: GameSummary[];
}

export interface Bet {
  id: string;
  gameId: string;
  bettor: string;
  betType: "lobsters_win" | "impostor_wins" | "specific_agent";
  targetAgent?: string;
  amount: string;
  odds: number;
  status: "active" | "won" | "lost";
  payout?: string;
}

export interface BettingOdds {
  lobstersWin: number;
  impostorWins: number;
  specificAgents: Record<string, number>;
}

export type WebSocketEvent =
  | { type: "game_state"; data: GameState }
  | { type: "phase_change"; data: { phase: GamePhase; timeRemaining: number; round?: number } }
  | { type: "message"; data: ChatMessage }
  | { type: "vote"; data: { voter: string; target: string } }
  | { type: "elimination"; data: { player: string; role: PlayerRole } }
  | { type: "game_end"; data: { winner: "lobsters" | "impostor" } }
  | { type: "player_speaking"; data: { player: string; isSpeaking: boolean } }
  | { type: "error"; data: { message: string } };
