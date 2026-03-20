# ── Stage 1: Build ──────────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY tsconfig.json ./
COPY src/ ./src/

RUN npm run build

# ── Stage 2: Production ────────────────────────────────────────
FROM node:20-alpine AS production

WORKDIR /app

RUN addgroup -S appgroup && adduser -S appuser -G appgroup

COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY --from=builder /app/dist ./dist

# Copy SKILL.md for reference (agents use the game server API directly)
COPY --from=builder /app/../../../skill/SKILL.md ./SKILL.md 2>/dev/null || true

RUN chown -R appuser:appgroup /app

USER appuser

CMD ["node", "dist/index.js"]
