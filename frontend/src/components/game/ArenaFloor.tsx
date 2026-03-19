"use client";

import { useCallback } from "react";
import type { Graphics } from "pixi.js";
import { GRID_COLOR, GRID_ALPHA } from "./pixiSetup";

interface ArenaFloorProps {
  width: number;
  height: number;
  phaseColor: number;
}

export default function ArenaFloor({ width, height, phaseColor }: ArenaFloorProps) {
  const draw = useCallback(
    (g: Graphics) => {
      g.clear();
      const cx = width / 2;
      const cy = height / 2;
      const radius = Math.min(width, height) * 0.44;

      // Outer glow
      g.circle(cx, cy, radius + 6);
      g.fill({ color: phaseColor, alpha: 0.06 });

      // Main floor disc
      g.circle(cx, cy, radius);
      g.fill({ color: 0x0f172a, alpha: 0.5 });

      // Concentric rings
      for (let i = 1; i <= 3; i++) {
        g.circle(cx, cy, radius * (i / 4));
        g.stroke({ color: GRID_COLOR, width: 1, alpha: GRID_ALPHA });
      }

      // Radial lines
      for (let i = 0; i < 8; i++) {
        const angle = (Math.PI * 2 * i) / 8;
        g.moveTo(cx, cy);
        g.lineTo(cx + Math.cos(angle) * radius, cy + Math.sin(angle) * radius);
        g.stroke({ color: GRID_COLOR, width: 1, alpha: GRID_ALPHA * 0.5 });
      }

      // Outer ring (phase colored)
      g.circle(cx, cy, radius);
      g.stroke({ color: phaseColor, width: 2, alpha: 0.35 });

      // Inner accent ring
      g.circle(cx, cy, radius * 0.25);
      g.stroke({ color: phaseColor, width: 1, alpha: 0.15 });
    },
    [width, height, phaseColor]
  );

  return <pixiGraphics draw={draw} />;
}
