import { useMemo } from "react";

export interface CrabPosition {
  x: number;
  y: number;
  angleRad: number;
}

export function useArenaLayout(
  playerCount: number,
  centerX: number,
  centerY: number,
  arenaRadius: number
): CrabPosition[] {
  return useMemo(() => {
    if (playerCount === 0) return [];
    const orbitRadius = arenaRadius * 0.62;
    const startAngle = -Math.PI / 2; // first crab at top
    return Array.from({ length: playerCount }, (_, i) => {
      const angle = startAngle + (2 * Math.PI * i) / playerCount;
      return {
        x: centerX + Math.cos(angle) * orbitRadius,
        y: centerY + Math.sin(angle) * orbitRadius,
        angleRad: angle,
      };
    });
  }, [playerCount, centerX, centerY, arenaRadius]);
}
