# ─── Stage 1: Base ────────────────────────────────────────────────
# System dependencies required for Remotion rendering (Chromium + FFmpeg)
FROM node:22-bookworm-slim AS base

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

# ─── Stage 2: Dependencies ───────────────────────────────────────
FROM base AS deps

WORKDIR /app

# Copy only package manifests first (layer caching)
COPY package.json ./
COPY apps/studio/package.json apps/studio/
COPY apps/mcp-server/package.json apps/mcp-server/
COPY packages/shared-types/package.json packages/shared-types/
COPY packages/remotion-compositions/package.json packages/remotion-compositions/
COPY packages/template-registry/package.json packages/template-registry/
COPY packages/renderer/package.json packages/renderer/

RUN npm install --ignore-scripts

# ─── Stage 3: Builder ────────────────────────────────────────────
FROM deps AS builder

WORKDIR /app

# Copy all source files
COPY tsconfig.base.json ./
COPY packages/ packages/
COPY apps/ apps/

# Build shared-types and renderer (produce dist/)
RUN cd packages/shared-types && npx tsc
RUN cd packages/renderer && npx tsc
RUN cd apps/mcp-server && npx tsc

# Build Vite frontend
RUN cd apps/studio && npx tsc -b && npx vite build

# ─── Stage 4: Runner (production image) ──────────────────────────
FROM base AS runner

WORKDIR /app

# Create non-root user
RUN groupadd --system studio && useradd --system --gid studio studio

# Copy all node_modules (root hoisted + workspace-local) from deps stage,
# then copy built source from builder stage.
COPY --from=deps /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./
COPY --from=builder /app/tsconfig.base.json ./
COPY --from=builder /app/packages/ ./packages/
COPY --from=builder /app/apps/ ./apps/

# Copy workspace-local node_modules that npm may have created
RUN for dir in apps/studio apps/mcp-server packages/shared-types packages/remotion-compositions packages/template-registry packages/renderer; do \
      mkdir -p "$dir/node_modules" 2>/dev/null || true; \
    done

# Create writable directories for runtime data
RUN mkdir -p /data/assets /data/projects /data/exports \
    && chown -R studio:studio /data \
    && chown -R studio:studio /app

# Expose ports
# 3000 — Studio UI + API (production mode serves both)
EXPOSE 3000

# Environment
ENV NODE_ENV=production
ENV PORT=3000
ENV EXPORTS_DIR=/data/exports

# Run as non-root user
USER studio

# Start the production server (serves both API and static UI)
CMD ["node", "--experimental-strip-types", "--no-warnings", "apps/studio/server.ts"]
