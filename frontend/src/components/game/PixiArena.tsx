"use client";

import "./pixiSetup";
import { Application, useTick } from "@pixi/react";
import { useRef, useState, useEffect, useCallback, useMemo } from "react";
import type { Graphics } from "pixi.js";
import type { Player, GamePhase } from "@/lib/types";
import { getAgentColor } from "@/lib/utils";
import {
  hexToPixi,
  PHASE_COLORS,
  darkenColor,
  CONFETTI_LOBSTER,
  CONFETTI_IMPOSTOR,
} from "./pixiSetup";
import { useArenaLayout } from "./useArenaLayout";
import ArenaFloor from "./ArenaFloor";
import CrabCharacter from "./CrabCharacter";

// ─── Types ───

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  color: number;
  size: number;
  type: "explosion" | "confetti";
}

interface CrabState {
  bobOffset: number;
  clawAngle: number;
  facingAngle: number;
  targetFacing: number;
  scale: number;
  glowIntensity: number;
}

// ─── Subcomponents ───

function VoteBeams({
  players,
  positions,
  time,
}: {
  players: Player[];
  positions: { x: number; y: number }[];
  time: number;
}) {
  const draw = useCallback(
    (g: Graphics) => {
      g.clear();
      players.forEach((p, i) => {
        if (!p.votedFor || !p.isAlive) return;
        const targetIdx = players.findIndex((t) => t.address === p.votedFor);
        if (targetIdx < 0 || !positions[i] || !positions[targetIdx]) return;

        const fx = positions[i].x;
        const fy = positions[i].y;
        const tx = positions[targetIdx].x;
        const ty = positions[targetIdx].y;
        const pulseAlpha = 0.4 + Math.sin(time * 4 + i) * 0.2;

        // Glow
        g.moveTo(fx, fy);
        g.lineTo(tx, ty);
        g.stroke({ color: 0xfb923c, width: 6, alpha: pulseAlpha * 0.3 });
        // Core beam
        g.moveTo(fx, fy);
        g.lineTo(tx, ty);
        g.stroke({ color: 0xfb923c, width: 2, alpha: pulseAlpha });

        // Arrowhead
        const angle = Math.atan2(ty - fy, tx - fx);
        const aSize = 10;
        g.moveTo(tx, ty);
        g.lineTo(tx - Math.cos(angle - 0.4) * aSize, ty - Math.sin(angle - 0.4) * aSize);
        g.stroke({ color: 0xfb923c, width: 2, alpha: pulseAlpha * 0.9 });
        g.moveTo(tx, ty);
        g.lineTo(tx - Math.cos(angle + 0.4) * aSize, ty - Math.sin(angle + 0.4) * aSize);
        g.stroke({ color: 0xfb923c, width: 2, alpha: pulseAlpha * 0.9 });
      });
    },
    [players, positions, time]
  );

  return <pixiGraphics draw={draw} />;
}

function SpeechBubbles({
  players,
  positions,
  time,
}: {
  players: Player[];
  positions: { x: number; y: number }[];
  time: number;
}) {
  const draw = useCallback(
    (g: Graphics) => {
      g.clear();
      players.forEach((p, i) => {
        if (!p.isSpeaking || !p.isAlive || !positions[i]) return;
        const bx = positions[i].x;
        const by = positions[i].y - 38;
        const sc = 1 + Math.sin(time * 5) * 0.08;
        const hw = 16 * sc;
        const hh = 10 * sc;

        // Bubble background
        g.roundRect(bx - hw, by - hh, hw * 2, hh * 2, 6);
        g.fill({ color: 0xffffff, alpha: 0.92 });

        // Three dots
        for (let d = 0; d < 3; d++) {
          const dotY = by + Math.sin(time * 4 + d * 0.8) * 2;
          g.circle(bx - 5 + d * 5, dotY, 2);
          g.fill({ color: 0x374151 });
        }

        // Tail
        g.moveTo(bx - 3, by + hh);
        g.lineTo(bx, by + hh + 6 * sc);
        g.lineTo(bx + 3, by + hh);
        g.fill({ color: 0xffffff, alpha: 0.92 });
      });
    },
    [players, positions, time]
  );

  return <pixiGraphics draw={draw} />;
}

function NameTags({
  players,
  positions,
  fontSize,
}: {
  players: Player[];
  positions: { x: number; y: number }[];
  fontSize: number;
}) {
  return (
    <>
      {players.map((p, i) => {
        if (!positions[i]) return null;
        const name = p.name || p.address.slice(0, 8);
        return (
          <pixiText
            key={p.address}
            text={name}
            x={positions[i].x}
            y={positions[i].y + 26}
            anchor={{ x: 0.5, y: 0 }}
            style={{
              fontFamily: "Arial, sans-serif",
              fontSize: Math.max(9, fontSize),
              fill: p.isAlive ? 0xe2e8f0 : 0x4b5563,
              align: "center",
              dropShadow: {
                color: 0x000000,
                blur: 4,
                distance: 0,
                alpha: 0.8,
              },
            }}
          />
        );
      })}
    </>
  );
}

function ParticleLayer({
  particles,
  time,
}: {
  particles: Particle[];
  time: number;
}) {
  const draw = useCallback(
    (g: Graphics) => {
      g.clear();
      for (const p of particles) {
        const lifeRatio = p.life / p.maxLife;
        if (p.type === "confetti") {
          const hw = p.size * 0.6;
          const hh = p.size;
          g.rect(p.x - hw, p.y - hh, hw * 2, hh * 2);
          g.fill({ color: p.color, alpha: lifeRatio * 0.8 });
        } else {
          g.circle(p.x, p.y, p.size * lifeRatio);
          g.fill({ color: p.color, alpha: lifeRatio });
        }
      }
    },
    [particles, time]
  );

  return <pixiGraphics draw={draw} />;
}

// ─── Main Arena Scene (inside Application) ───

function ArenaScene({
  players,
  phase,
  winner,
  width,
  height,
}: {
  players: Player[];
  phase: string;
  winner: string | null;
  width: number;
  height: number;
}) {
  const cx = width / 2;
  const cy = height / 2;
  const arenaRadius = Math.min(width, height) * 0.44;
  const positions = useArenaLayout(players.length, cx, cy, arenaRadius);
  const phaseColor = PHASE_COLORS[phase] ?? 0x64748b;
  const timeRef = useRef(0);
  const [time, setTime] = useState(0);
  const particlesRef = useRef<Particle[]>([]);
  const [particlesSnapshot, setParticlesSnapshot] = useState<Particle[]>([]);
  const prevPhaseRef = useRef(phase);
  const prevAliveRef = useRef<Record<string, boolean>>({});
  const confettiSpawnRef = useRef(0);

  // Initialize crab states - preserve existing by player address
  const crabStatesMap = useRef<Record<string, CrabState>>({});
  const crabStates = useRef<CrabState[]>([]);
  const defaultCrab = (): CrabState => ({
    bobOffset: 0,
    clawAngle: 0,
    facingAngle: 0,
    targetFacing: 0,
    scale: 1,
    glowIntensity: 0,
  });
  crabStates.current = players.map((p) => {
    if (!crabStatesMap.current[p.address]) {
      crabStatesMap.current[p.address] = defaultCrab();
    }
    return crabStatesMap.current[p.address];
  });

  // Trigger elimination explosion
  const triggerExplosion = useCallback(
    (px: number, py: number, color: number) => {
      const newParticles: Particle[] = [];
      for (let i = 0; i < 35; i++) {
        const angle = (Math.PI * 2 * i) / 35 + Math.random() * 0.3;
        const speed = 60 + Math.random() * 140;
        newParticles.push({
          x: px,
          y: py,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          life: 0.8 + Math.random() * 0.7,
          maxLife: 1.5,
          color: Math.random() > 0.5 ? color : darkenColor(color, 0.6),
          size: 2 + Math.random() * 4,
          type: "explosion",
        });
      }
      particlesRef.current.push(...newParticles);
    },
    []
  );

  // Phase transition effects
  useEffect(() => {
    if (prevPhaseRef.current === phase) {
      // Check for newly eliminated players even without phase change
      players.forEach((p, i) => {
        if (!p.isAlive && prevAliveRef.current[p.address] && positions[i]) {
          triggerExplosion(positions[i].x, positions[i].y, hexToPixi(getAgentColor(p.address)));
        }
      });
    }
    prevPhaseRef.current = phase;

    // Update alive tracking
    const aliveMap: Record<string, boolean> = {};
    players.forEach((p) => {
      aliveMap[p.address] = p.isAlive;
    });
    prevAliveRef.current = aliveMap;

    // Phase-specific facing
    if (phase === "discussion") {
      crabStates.current.forEach((state, i) => {
        if (positions[i]) {
          state.targetFacing = Math.atan2(cy - positions[i].y, cx - positions[i].x);
        }
      });
    } else if (phase === "voting") {
      players.forEach((p, i) => {
        if (p.votedFor) {
          const targetIdx = players.findIndex((t) => t.address === p.votedFor);
          if (targetIdx >= 0 && positions[i] && positions[targetIdx]) {
            const dx = positions[targetIdx].x - positions[i].x;
            const dy = positions[targetIdx].y - positions[i].y;
            crabStates.current[i].targetFacing = Math.atan2(dy, dx);
          }
        }
      });
    }
  }, [phase, players, positions, cx, cy, triggerExplosion]);

  // Animation loop
  const animate = useCallback(
    (ticker: { deltaTime: number }) => {
      const dt = ticker.deltaTime / 60;
      timeRef.current += dt;
      const t = timeRef.current;

      // Update crab states
      crabStates.current.forEach((state, i) => {
        const player = players[i];
        if (!player) return;

        // Bob
        state.bobOffset = Math.sin(t * 2 + i * 0.7) * 3;

        // Claws
        if (player.isSpeaking) {
          state.clawAngle = Math.sin(t * 6) * 0.35;
          state.glowIntensity = 0.5 + Math.sin(t * 4) * 0.5;
        } else {
          state.clawAngle = Math.sin(t * 1.5 + i * 0.5) * 0.1;
          state.glowIntensity = Math.max(0, state.glowIntensity - dt * 3);
        }

        // Facing lerp
        let angleDiff = state.targetFacing - state.facingAngle;
        // Normalize angle difference to [-PI, PI]
        while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
        while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
        state.facingAngle += angleDiff * dt * 3;

        // Winner bounce
        if (winner && player.isAlive) {
          state.scale = 1.0 + Math.abs(Math.sin(t * 3 + i)) * 0.15;
        } else {
          state.scale += (1.0 - state.scale) * dt * 4;
        }
      });

      // Confetti during results
      if (phase === "results" && winner) {
        confettiSpawnRef.current += dt;
        if (confettiSpawnRef.current > 0.05 && particlesRef.current.length < 80) {
          confettiSpawnRef.current = 0;
          const colors = winner === "lobsters" ? CONFETTI_LOBSTER : CONFETTI_IMPOSTOR;
          particlesRef.current.push({
            x: Math.random() * width,
            y: -10,
            vx: (Math.random() - 0.5) * 40,
            vy: 30 + Math.random() * 50,
            life: 2 + Math.random() * 2,
            maxLife: 4,
            color: colors[Math.floor(Math.random() * colors.length)],
            size: 3 + Math.random() * 3,
            type: "confetti",
          });
        }
      }

      // Update particles
      particlesRef.current = particlesRef.current.filter((p) => {
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        if (p.type === "explosion") {
          p.vy += 200 * dt; // gravity
          p.vx *= 0.98;
        } else {
          p.vx += (Math.random() - 0.5) * 10 * dt; // confetti drift
        }
        p.life -= dt;
        return p.life > 0;
      });

      setTime(t);
      setParticlesSnapshot([...particlesRef.current]);
    },
    [players, phase, winner, width]
  );

  useTick(animate);

  // Compute crab colors once
  const crabColors = useMemo(
    () => players.map((p) => hexToPixi(getAgentColor(p.address))),
    [players]
  );

  return (
    <>
      <ArenaFloor width={width} height={height} phaseColor={phaseColor} />

      {/* Vote beams (voting phase) */}
      {phase === "voting" && (
        <VoteBeams players={players} positions={positions} time={time} />
      )}

      {/* Crab characters */}
      {players.map((player, i) => {
        if (!positions[i]) return null;
        const state = crabStates.current[i] ?? {
          bobOffset: 0,
          clawAngle: 0,
          facingAngle: 0,
          scale: 1,
          glowIntensity: 0,
        };
        return (
          <CrabCharacter
            key={player.address}
            x={positions[i].x}
            y={positions[i].y}
            color={crabColors[i]}
            isAlive={player.isAlive}
            isSpeaking={player.isSpeaking}
            scale={state.scale}
            bobOffset={state.bobOffset}
            clawAngle={state.clawAngle}
            glowIntensity={state.glowIntensity}
            facingAngle={0} // don't rotate container, crab faces "up" naturally
          />
        );
      })}

      {/* Name tags */}
      <NameTags
        players={players}
        positions={positions}
        fontSize={arenaRadius * 0.055}
      />

      {/* Speech bubbles */}
      <SpeechBubbles players={players} positions={positions} time={time} />

      {/* Particles */}
      <ParticleLayer particles={particlesSnapshot} time={time} />
    </>
  );
}

// ─── PixiArena wrapper ───

interface PixiArenaProps {
  players: Player[];
  phase: GamePhase | null;
  winner: "lobsters" | "impostor" | null;
}

export default function PixiArena({ players, phase, winner }: PixiArenaProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 600, height: 420 });

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const observer = new ResizeObserver((entries) => {
      const { width } = entries[0].contentRect;
      const h = Math.min(width * 0.7, 480);
      setDimensions({ width: Math.floor(width), height: Math.floor(h) });
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={containerRef} className="w-full" style={{ height: dimensions.height }}>
      <Application
        width={dimensions.width}
        height={dimensions.height}
        backgroundAlpha={0}
        antialias
        autoDensity
        resolution={typeof window !== "undefined" ? Math.min(window.devicePixelRatio, 2) : 1}
      >
        <ArenaScene
          players={players}
          phase={phase ?? "lobby"}
          winner={winner}
          width={dimensions.width}
          height={dimensions.height}
        />
      </Application>
    </div>
  );
}
