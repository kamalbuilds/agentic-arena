import { extend } from "@pixi/react";
import { Container, Graphics, Text } from "pixi.js";

// Register PixiJS components for JSX usage
extend({ Container, Graphics, Text });

// Phase colors as PixiJS numeric hex
export const PHASE_COLORS: Record<string, number> = {
  lobby: 0x64748b,
  discussion: 0x22c55e,
  voting: 0xfb923c,
  elimination: 0xef4444,
  results: 0xa855f7,
};

export const ARENA_BG = 0x0a0f1e;
export const GRID_COLOR = 0x1e293b;
export const GRID_ALPHA = 0.3;

export function hexToPixi(hex: string): number {
  return parseInt(hex.replace("#", ""), 16);
}

export function darkenColor(color: number, factor: number): number {
  const r = Math.floor(((color >> 16) & 0xff) * factor);
  const g = Math.floor(((color >> 8) & 0xff) * factor);
  const b = Math.floor((color & 0xff) * factor);
  return (r << 16) | (g << 8) | b;
}

export function lightenColor(color: number, factor: number): number {
  const r = Math.min(255, Math.floor(((color >> 16) & 0xff) * factor));
  const g = Math.min(255, Math.floor(((color >> 8) & 0xff) * factor));
  const b = Math.min(255, Math.floor((color & 0xff) * factor));
  return (r << 16) | (g << 8) | b;
}

// Confetti colors for winner celebrations
export const CONFETTI_LOBSTER = [0x22c55e, 0x4ade80, 0x86efac, 0x16a34a, 0x34d399];
export const CONFETTI_IMPOSTOR = [0xa855f7, 0xc084fc, 0xd8b4fe, 0x7c3aed, 0xe879f9];
