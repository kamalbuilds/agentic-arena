"use client";

import { useCallback } from "react";
import type { Graphics } from "pixi.js";
import { darkenColor, lightenColor } from "./pixiSetup";

interface CrabCharacterProps {
  x: number;
  y: number;
  color: number;
  isAlive: boolean;
  isSpeaking: boolean;
  scale: number;
  bobOffset: number;
  clawAngle: number;
  glowIntensity: number;
  facingAngle: number;
}

export default function CrabCharacter({
  x,
  y,
  color,
  isAlive,
  isSpeaking,
  scale,
  bobOffset,
  clawAngle,
  glowIntensity,
  facingAngle,
}: CrabCharacterProps) {
  const darker = darkenColor(color, 0.6);
  const darkest = darkenColor(color, 0.4);
  const lighter = lightenColor(color, 1.3);
  const lightest = lightenColor(color, 1.6);
  const alpha = isAlive ? 1.0 : 0.3;

  const draw = useCallback(
    (g: Graphics) => {
      g.clear();

      // ═══ Speaking glow ring ═══
      if (isSpeaking && glowIntensity > 0) {
        g.circle(0, 2, 38);
        g.fill({ color: 0x22c55e, alpha: glowIntensity * 0.12 });
        g.circle(0, 2, 32);
        g.fill({ color: 0x22c55e, alpha: glowIntensity * 0.08 });
      }

      // ═══ SHADOW ═══
      if (isAlive) {
        g.ellipse(0, 22, 20, 5);
        g.fill({ color: 0x000000, alpha: 0.2 });
      }

      // ═══ LEGS (4 pairs with segments) ═══
      const legPairs = [
        { xOff: -10, yOff: 8, outX: -22, outY: 16, tipX: -26, tipY: 22 },
        { xOff: -7, yOff: 11, outX: -18, outY: 20, tipX: -20, tipY: 26 },
        { xOff: -4, yOff: 13, outX: -13, outY: 23, tipX: -14, tipY: 28 },
        { xOff: -1, yOff: 14, outX: -8, outY: 24, tipX: -6, tipY: 28 },
      ];
      for (const leg of legPairs) {
        // Left side
        g.moveTo(leg.xOff, leg.yOff);
        g.lineTo(leg.outX, leg.outY);
        g.stroke({ color: darker, width: 2.5, alpha });
        g.moveTo(leg.outX, leg.outY);
        g.lineTo(leg.tipX, leg.tipY);
        g.stroke({ color: darkest, width: 2, alpha });
        // Leg joint dot
        g.circle(leg.outX, leg.outY, 1.5);
        g.fill({ color: darker, alpha });
        // Right side (mirrored)
        g.moveTo(-leg.xOff, leg.yOff);
        g.lineTo(-leg.outX, leg.outY);
        g.stroke({ color: darker, width: 2.5, alpha });
        g.moveTo(-leg.outX, leg.outY);
        g.lineTo(-leg.tipX, leg.tipY);
        g.stroke({ color: darkest, width: 2, alpha });
        g.circle(-leg.outX, leg.outY, 1.5);
        g.fill({ color: darker, alpha });
      }

      // ═══ CLAW ARMS ═══
      const clawOpen = Math.sin(clawAngle) * 6;

      // --- Left arm segment ---
      g.moveTo(-14, 0);
      g.lineTo(-22, -4);
      g.lineTo(-24, -2);
      g.lineTo(-16, 2);
      g.closePath();
      g.fill({ color: darker, alpha });
      // Left claw joint
      g.circle(-23, -3, 3.5);
      g.fill({ color: darker, alpha });
      // Left upper pincer
      g.moveTo(-23, -5);
      g.lineTo(-38, -10 - clawOpen);
      g.lineTo(-34, -5);
      g.lineTo(-25, -3);
      g.closePath();
      g.fill({ color, alpha });
      g.moveTo(-23, -5);
      g.lineTo(-38, -10 - clawOpen);
      g.stroke({ color: darker, width: 1, alpha });
      // Left lower pincer
      g.moveTo(-23, -1);
      g.lineTo(-38, 4 + clawOpen);
      g.lineTo(-34, -1);
      g.lineTo(-25, -2);
      g.closePath();
      g.fill({ color: lighter, alpha });
      g.moveTo(-23, -1);
      g.lineTo(-38, 4 + clawOpen);
      g.stroke({ color: darker, width: 1, alpha });
      // Inner claw dot (the pointy tip highlight)
      g.circle(-35, -3, 1.5);
      g.fill({ color: lightest, alpha: alpha * 0.5 });

      // --- Right arm segment ---
      g.moveTo(14, 0);
      g.lineTo(22, -4);
      g.lineTo(24, -2);
      g.lineTo(16, 2);
      g.closePath();
      g.fill({ color: darker, alpha });
      // Right claw joint
      g.circle(23, -3, 3.5);
      g.fill({ color: darker, alpha });
      // Right upper pincer
      g.moveTo(23, -5);
      g.lineTo(38, -10 - clawOpen);
      g.lineTo(34, -5);
      g.lineTo(25, -3);
      g.closePath();
      g.fill({ color, alpha });
      g.moveTo(23, -5);
      g.lineTo(38, -10 - clawOpen);
      g.stroke({ color: darker, width: 1, alpha });
      // Right lower pincer
      g.moveTo(23, -1);
      g.lineTo(38, 4 + clawOpen);
      g.lineTo(34, -1);
      g.lineTo(25, -2);
      g.closePath();
      g.fill({ color: lighter, alpha });
      g.moveTo(23, -1);
      g.lineTo(38, 4 + clawOpen);
      g.stroke({ color: darker, width: 1, alpha });
      // Inner claw dot
      g.circle(35, -3, 1.5);
      g.fill({ color: lightest, alpha: alpha * 0.5 });

      // ═══ BODY / SHELL ═══
      // Main shell (larger rounded shape)
      g.ellipse(0, 2, 18, 15);
      g.fill({ color, alpha });

      // Shell border/outline
      g.ellipse(0, 2, 18, 15);
      g.stroke({ color: darker, width: 1.5, alpha });

      // Shell texture: central ridge line
      g.moveTo(0, -10);
      g.quadraticCurveTo(0, 2, 0, 16);
      g.stroke({ color: darker, width: 1, alpha: alpha * 0.4 });

      // Shell texture: left curve
      g.moveTo(-3, -9);
      g.quadraticCurveTo(-8, 2, -5, 14);
      g.stroke({ color: darker, width: 0.8, alpha: alpha * 0.25 });

      // Shell texture: right curve
      g.moveTo(3, -9);
      g.quadraticCurveTo(8, 2, 5, 14);
      g.stroke({ color: darker, width: 0.8, alpha: alpha * 0.25 });

      // Shell highlight (top-left sheen)
      g.ellipse(-5, -3, 8, 6);
      g.fill({ color: 0xffffff, alpha: 0.15 * (isAlive ? 1 : 0.3) });

      // Small highlight spot
      g.circle(-8, -5, 3);
      g.fill({ color: 0xffffff, alpha: 0.2 * (isAlive ? 1 : 0.3) });

      // Shell bottom edge (darker belly area)
      g.ellipse(0, 12, 14, 5);
      g.fill({ color: darkest, alpha: alpha * 0.3 });

      // ═══ EYE STALKS ═══
      // Left stalk
      g.moveTo(-6, -8);
      g.lineTo(-8, -18);
      g.stroke({ color: darker, width: 3, alpha });
      // Left stalk tip (eye socket)
      g.circle(-8, -18, 5.5);
      g.fill({ color: 0xffffff, alpha });
      g.circle(-8, -18, 5.5);
      g.stroke({ color: darker, width: 1, alpha });
      // Left pupil
      g.circle(-7, -18, 3);
      g.fill({ color: 0x111827, alpha });
      // Left pupil highlight
      g.circle(-6, -19.5, 1.2);
      g.fill({ color: 0xffffff, alpha: alpha * 0.9 });

      // Right stalk
      g.moveTo(6, -8);
      g.lineTo(8, -18);
      g.stroke({ color: darker, width: 3, alpha });
      // Right stalk tip (eye socket)
      g.circle(8, -18, 5.5);
      g.fill({ color: 0xffffff, alpha });
      g.circle(8, -18, 5.5);
      g.stroke({ color: darker, width: 1, alpha });
      // Right pupil
      g.circle(9, -18, 3);
      g.fill({ color: 0x111827, alpha });
      // Right pupil highlight
      g.circle(10, -19.5, 1.2);
      g.fill({ color: 0xffffff, alpha: alpha * 0.9 });

      // ═══ MOUTH ═══
      g.moveTo(-4, 6);
      g.quadraticCurveTo(0, 9, 4, 6);
      g.stroke({ color: darkest, width: 1.5, alpha: alpha * 0.6 });

      // ═══ SHELL SPOTS (personality markings) ═══
      // Derive spot positions from color to give each crab unique spots
      const spotSeed = (color >> 4) & 0xf;
      if (spotSeed > 5) {
        g.circle(-7 + (spotSeed % 3), 4, 2.5);
        g.fill({ color: lighter, alpha: alpha * 0.3 });
        g.circle(5, 1 + (spotSeed % 4), 2);
        g.fill({ color: lighter, alpha: alpha * 0.25 });
      }
      if (spotSeed > 9) {
        g.circle(9, 7, 1.8);
        g.fill({ color: lighter, alpha: alpha * 0.2 });
      }

      // ═══ Elimination X ═══
      if (!isAlive) {
        // Bigger X across the body
        g.moveTo(-12, -12);
        g.lineTo(12, 12);
        g.stroke({ color: 0xef4444, width: 3.5, alpha: 0.8 });
        g.moveTo(12, -12);
        g.lineTo(-12, 12);
        g.stroke({ color: 0xef4444, width: 3.5, alpha: 0.8 });
        // Red tint overlay
        g.ellipse(0, 2, 18, 15);
        g.fill({ color: 0xef4444, alpha: 0.15 });
      }
    },
    [color, darker, darkest, lighter, lightest, isAlive, isSpeaking, clawAngle, glowIntensity, alpha]
  );

  return (
    <pixiContainer x={x} y={y + bobOffset} rotation={facingAngle} scale={scale} alpha={alpha}>
      <pixiGraphics draw={draw} />
    </pixiContainer>
  );
}
