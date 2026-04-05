/**
 * Hono HTTP backend for Media Studio — runs on port 3001 via `bun run server.ts`.
 * Vite dev server (port 3000) proxies /api/* requests here.
 *
 * All route logic lives in `src/api.ts` (see createApp) so it can be tested
 * without starting an HTTP listener and without a real Remotion renderer.
 *
 * Endpoints (defined in src/api.ts)
 *   GET    /api/templates                — list all registered templates
 *   GET    /api/export-formats           — list supported codecs / presets
 *   GET    /api/projects                 — list all in-memory projects
 *   POST   /api/projects                 — create a project
 *   GET    /api/projects/:id             — get a project
 *   PATCH  /api/projects/:id             — update a project
 *   DELETE /api/projects/:id             — delete a project
 *   POST   /api/projects/:id/render      — queue a render job (starts actual render)
 *   GET    /api/renders/:jobId           — poll render job status / progress
 *   POST   /api/renders/:jobId/cancel    — cancel a queued or active render job
 */

import path from "node:path";
import fs from "node:fs";
import { serve } from "@hono/node-server";
import { RenderQueue, executeRender } from "@studio/renderer";
import { createApp } from "./src/api";

// ─── Paths ────────────────────────────────────────────────────────────────────

const STUDIO_DIR: string = import.meta.dir;

/** Rendered video files are written here. */
const OUTPUT_DIR = path.join(STUDIO_DIR, "output");
fs.mkdirSync(OUTPUT_DIR, { recursive: true });

/**
 * Entry-point for the Remotion composition bundle.
 * This is the file that calls `registerRoot(RemotionRoot)`.
 */
const COMPOSITIONS_ENTRY = path.resolve(
  STUDIO_DIR,
  "../../packages/remotion-compositions/src/index.ts",
);

// ─── Render queue ─────────────────────────────────────────────────────────────

const renderQueue = new RenderQueue();

renderQueue.setRenderFunction((job, onProgress) =>
  executeRender(job, onProgress, {
    compositionsEntryPoint: COMPOSITIONS_ENTRY,
    outputDir: OUTPUT_DIR,
  }),
);

// ─── App ──────────────────────────────────────────────────────────────────────

const { app } = createApp(renderQueue, "http://localhost:3000");

// ─── Start ────────────────────────────────────────────────────────────────────

const PORT = 3001;

const server = serve({ fetch: app.fetch, port: PORT }, () => {
  console.log(`[studio-api] listening on http://localhost:${PORT}`);
  console.log(`[studio-api] compositions bundle: ${COMPOSITIONS_ENTRY}`);
  console.log(`[studio-api] render output: ${OUTPUT_DIR}`);
});

// ─── Graceful Shutdown ────────────────────────────────────────────────────────

function gracefulShutdown(signal: string) {
  console.log(`\n[studio-api] received ${signal}, shutting down gracefully...`);
  server.close(() => {
    console.log("[studio-api] server closed");
    process.exit(0);
  });

  // Force exit after 10 seconds if connections don't drain
  setTimeout(() => {
    console.error("[studio-api] forced shutdown after timeout");
    process.exit(1);
  }, 10000);
}

process.on("SIGINT", () => gracefulShutdown("SIGINT"));
process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));

