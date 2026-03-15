import { EventEmitter } from "node:events";
import { logger } from "../utils/logger.js";

const phaseLogger = logger.child("PhaseManager");

export enum GamePhase {
  Lobby = 0,
  Discussion = 1,
  Voting = 2,
  Resolution = 3,
  End = 4,
}

export const PHASE_NAMES: Record<GamePhase, string> = {
  [GamePhase.Lobby]: "Lobby",
  [GamePhase.Discussion]: "Discussion",
  [GamePhase.Voting]: "Voting",
  [GamePhase.Resolution]: "Resolution",
  [GamePhase.End]: "End",
};

interface PhaseState {
  phase: GamePhase;
  startTime: number;
  duration: number; // seconds
  timer: NodeJS.Timeout | null;
}

type PhaseEndCallback = (gameId: string, phase: GamePhase) => void;

class PhaseManager extends EventEmitter {
  private phases = new Map<string, PhaseState>();
  private phaseEndCallbacks: PhaseEndCallback[] = [];

  startPhase(gameId: string, phase: GamePhase, duration: number): void {
    // Clear any existing timer for this game
    this.clearTimer(gameId);

    const state: PhaseState = {
      phase,
      startTime: Date.now(),
      duration,
      timer: null,
    };

    phaseLogger.info(
      `Game ${gameId}: Starting phase ${PHASE_NAMES[phase]} (${duration}s)`
    );

    // Set timer for auto-transition (skip for Lobby and End)
    if (phase !== GamePhase.Lobby && phase !== GamePhase.End && duration > 0) {
      state.timer = setTimeout(() => {
        phaseLogger.info(
          `Game ${gameId}: Phase ${PHASE_NAMES[phase]} ended (timer expired)`
        );
        this.emit("phaseEnd", gameId, phase);
        for (const cb of this.phaseEndCallbacks) {
          cb(gameId, phase);
        }
      }, duration * 1000);
    }

    this.phases.set(gameId, state);

    this.emit("phaseChange", gameId, phase, duration);
  }

  onPhaseEnd(callback: PhaseEndCallback): void {
    this.phaseEndCallbacks.push(callback);
  }

  getCurrentPhase(gameId: string): GamePhase | null {
    const state = this.phases.get(gameId);
    return state ? state.phase : null;
  }

  getRemainingTime(gameId: string): number {
    const state = this.phases.get(gameId);
    if (!state) return 0;

    if (state.phase === GamePhase.Lobby || state.phase === GamePhase.End) {
      return 0;
    }

    const elapsed = (Date.now() - state.startTime) / 1000;
    const remaining = Math.max(0, state.duration - elapsed);
    return Math.ceil(remaining);
  }

  forceEndPhase(gameId: string): void {
    const state = this.phases.get(gameId);
    if (!state) return;

    this.clearTimer(gameId);

    phaseLogger.info(
      `Game ${gameId}: Phase ${PHASE_NAMES[state.phase]} force-ended`
    );

    this.emit("phaseEnd", gameId, state.phase);
    for (const cb of this.phaseEndCallbacks) {
      cb(gameId, state.phase);
    }
  }

  private clearTimer(gameId: string): void {
    const existing = this.phases.get(gameId);
    if (existing?.timer) {
      clearTimeout(existing.timer);
      existing.timer = null;
    }
  }

  cleanup(gameId: string): void {
    this.clearTimer(gameId);
    this.phases.delete(gameId);
  }
}

export const phaseManager = new PhaseManager();
