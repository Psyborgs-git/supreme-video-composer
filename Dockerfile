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

RUN bun install --ignore-scripts

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

# ─── Stage 4: Runtime base ───────────────────────────────────────
FROM node:22-bookworm-slim AS runtime-base

WORKDIR /app

COPY --from=bun /usr/local/bin/bun /usr/local/bin/bun

RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Create non-root user
RUN groupadd --system studio && useradd --system --create-home --gid studio studio

ENV NODE_ENV=production
ENV ASSETS_DIR=/data/assets
ENV PROJECTS_DIR=/data/projects
ENV EXPORTS_DIR=/data/exports
ENV HOME=/home/studio

# ─── Stage 5: Studio runner ──────────────────────────────────────
FROM runtime-base AS studio-runner

# System dependencies required for Remotion rendering.
RUN apt-get update && apt-get install -y --no-install-recommends \
    chromium \
    ffmpeg \
    fonts-noto-color-emoji \
    fonts-freefont-ttf \
    fonts-liberation \
    && rm -rf /var/lib/apt/lists/*

# Tell Remotion / Puppeteer to use the system Chromium.
ENV PUPPETEER_SKIP_DOWNLOAD=true
ENV REMOTION_CHROME_EXECUTABLE=/usr/bin/chromium
ENV CHROME_PATH=/usr/bin/chromium
ENV PORT=3000

COPY --from=deps --chown=studio:studio /app/node_modules ./node_modules
COPY --from=builder --chown=studio:studio /app/package.json ./
COPY --from=builder --chown=studio:studio /app/tsconfig.base.json ./
COPY --from=builder --chown=studio:studio /app/packages/ ./packages/
COPY --from=builder --chown=studio:studio /app/apps/ ./apps/

RUN mkdir -p /data/assets /data/projects /data/exports \
    && chown -R studio:studio /data /home/studio

EXPOSE 3000

USER studio
CMD ["bun", "apps/studio/server.ts"]

# ─── Stage 6: MCP runner ─────────────────────────────────────────
FROM runtime-base AS mcp-runner

ENV MCP_HOST=0.0.0.0
ENV MCP_PORT=9090

COPY --from=deps --chown=studio:studio /app/node_modules ./node_modules
COPY --from=builder --chown=studio:studio /app/package.json ./
COPY --from=builder --chown=studio:studio /app/tsconfig.base.json ./
COPY --from=builder --chown=studio:studio /app/packages/ ./packages/
COPY --from=builder --chown=studio:studio /app/apps/ ./apps/

RUN mkdir -p /data/assets /data/projects /data/exports \
    && chown -R studio:studio /data /home/studio

EXPOSE 9090

USER studio
CMD ["bun", "apps/mcp-server/src/index.ts", "--transport=http"]
