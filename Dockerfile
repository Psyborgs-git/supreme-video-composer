# syntax=docker/dockerfile:1.7

# ─── Stage 1: Bun toolchain ───────────────────────────────────────
# Copy the Bun binary into Node-based stages so installs/builds are fast while
# the final runtime still has full Node compatibility available if needed.
FROM oven/bun:1.3.11 AS bun

FROM node:22-bookworm-slim AS toolchain

WORKDIR /app

COPY --from=bun /usr/local/bin/bun /usr/local/bin/bun

ENV BUN_INSTALL=/root/.bun

# ─── Stage 2: Dependencies ───────────────────────────────────────
FROM toolchain AS deps

WORKDIR /app

# Copy only package manifests first (layer caching)
COPY package.json bun.lock ./
COPY apps/studio/package.json apps/studio/
COPY apps/mcp-server/package.json apps/mcp-server/
COPY packages/shared-types/package.json packages/shared-types/
COPY packages/remotion-compositions/package.json packages/remotion-compositions/
COPY packages/template-registry/package.json packages/template-registry/
COPY packages/renderer/package.json packages/renderer/

RUN --mount=type=cache,target=/root/.bun/install/cache \
    bun install --frozen-lockfile --ignore-scripts

# ─── Stage 3: Builder ────────────────────────────────────────────
FROM deps AS builder

WORKDIR /app

# Copy and build workspaces in dependency order so unrelated source edits do
# not invalidate cached build layers.
COPY tsconfig.base.json ./

COPY packages/shared-types/ packages/shared-types/
RUN cd packages/shared-types && bun run build

COPY packages/renderer/ packages/renderer/
RUN cd packages/renderer && bun run build

COPY packages/template-registry/ packages/template-registry/
COPY packages/remotion-compositions/ packages/remotion-compositions/

COPY apps/mcp-server/ apps/mcp-server/
RUN cd apps/mcp-server && bun run build

COPY apps/studio/ apps/studio/
RUN cd apps/studio && bun run build

# ─── Stage 4: Runner (production image) ──────────────────────────
FROM node:22-bookworm-slim AS runner

WORKDIR /app

COPY --from=bun /usr/local/bin/bun /usr/local/bin/bun

# System dependencies required for Remotion rendering (Chromium + FFmpeg)
RUN apt-get update && apt-get install -y --no-install-recommends \
    chromium \
    ffmpeg \
    fonts-noto-color-emoji \
    fonts-freefont-ttf \
    fonts-liberation \
    ca-certificates \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Tell Remotion / Puppeteer to use the system Chromium
ENV PUPPETEER_SKIP_DOWNLOAD=true
ENV REMOTION_CHROME_EXECUTABLE=/usr/bin/chromium
ENV CHROME_PATH=/usr/bin/chromium

# Create non-root user
RUN groupadd --system studio && useradd --system --create-home --gid studio studio

# Copy all node_modules (root hoisted + workspace-local) from deps stage,
# then copy built source from builder stage.
COPY --from=deps /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./
COPY --from=builder /app/tsconfig.base.json ./
COPY --from=builder /app/packages/ ./packages/
COPY --from=builder /app/apps/ ./apps/

# Create writable directories for runtime data
RUN mkdir -p /data/assets /data/projects /data/exports \
    && chown -R studio:studio /data /home/studio

# Expose ports
# 3000 — Studio UI + API (production mode serves both)
EXPOSE 3000

# Environment
ENV NODE_ENV=production
ENV PORT=3000
ENV ASSETS_DIR=/data/assets
ENV PROJECTS_DIR=/data/projects
ENV EXPORTS_DIR=/data/exports
ENV HOME=/home/studio

# Run as non-root user
USER studio

# Run the production server with Bun, which natively handles the workspace's
# TypeScript / TSX import graph.
CMD ["bun", "apps/studio/server.ts"]
