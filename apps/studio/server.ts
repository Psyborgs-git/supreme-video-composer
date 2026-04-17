/**
 * Hono HTTP backend for Media Studio — runs on port 3001 via `bun run server.ts`.
 * Vite dev server (port 3000) proxies /api/* requests here.
 *
 * In production mode (NODE_ENV=production), also serves the built Vite
 * static assets on port 3000 so a single container can host everything.
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
import { fileURLToPath } from "node:url";
import { serve } from "@hono/node-server";
import { serveStatic } from "@hono/node-server/serve-static";
import { RenderQueue, executeRender } from "@studio/renderer";
import { createApp } from "./src/api";
import { automationScheduler } from "./src/services/scheduler";
import type { Context } from "hono";

// ─── Paths ────────────────────────────────────────────────────────────────────

// Compatible with both Bun (import.meta.dir) and Node.js (import.meta.dirname / fileURLToPath)
const STUDIO_DIR: string =
  (import.meta as any).dir ??
  import.meta.dirname ??
  path.dirname(fileURLToPath(import.meta.url));

/** Rendered video files are written here. */
const OUTPUT_DIR = process.env.EXPORTS_DIR ?? path.resolve(STUDIO_DIR, "../../data/exports");
const ASSETS_DIR = process.env.ASSETS_DIR ?? path.resolve(STUDIO_DIR, "../../data/assets");
const PROJECTS_DIR = process.env.PROJECTS_DIR ?? path.resolve(STUDIO_DIR, "../../data/projects");
fs.mkdirSync(OUTPUT_DIR, { recursive: true });
fs.mkdirSync(ASSETS_DIR, { recursive: true });
fs.mkdirSync(PROJECTS_DIR, { recursive: true });

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

const isProduction = process.env.NODE_ENV === "production";
const corsOrigin = isProduction ? "*" : "http://localhost:3000";
const { app } = createApp(renderQueue, corsOrigin, {
  assetsDir: ASSETS_DIR,
  projectsDir: PROJECTS_DIR,
});

// ─── Database & Scheduler ─────────────────────────────────────────────────────

// Initialize the database and apply migrations before any routes or scheduled
// jobs touch SQLite.
try {
  const { migrateDatabase, getDb } = await import("@studio/database");
  migrateDatabase();
  getDb(); // Trigger lazy initialization after migrations are applied.
  console.log("[studio-api] database connected");
} catch (err) {
  console.error("[studio-api] database initialization failed:", err);
  throw err;
}

// Wire render queue into scheduler and load saved automations
automationScheduler.setRenderQueue(renderQueue);
automationScheduler.loadFromDb().catch((err) => {
  console.warn("[studio-api] automation scheduler load skipped (no DB?):", (err as Error).message);
});

// ─── Audio proxy ──────────────────────────────────────────────────────────────
// In dev, Vite proxies /audio-proxy/* → soundhelix.com.
// In production the Hono server handles it here so BeatSyncedVisualizer
// can still fetch audio for @remotion/media-utils analysis (avoids CORS).
app.get("/audio-proxy/*", async (c: Context) => {
  const suffix = c.req.path.replace(/^\/audio-proxy/, "");
  const upstream = `https://www.soundhelix.com${suffix}`;
  try {
    const upstreamRes = await fetch(upstream, {
      headers: { "User-Agent": "remotion-media-studio/1.0" },
    });
    if (!upstreamRes.ok) {
      return c.text("Audio proxy upstream error", upstreamRes.status as 400 | 404 | 500);
    }
    const buf = await upstreamRes.arrayBuffer();
    return new Response(buf, {
      status: 200,
      headers: {
        "Content-Type": upstreamRes.headers.get("Content-Type") ?? "audio/mpeg",
        "Cache-Control": "public, max-age=86400",
        "Access-Control-Allow-Origin": "*",
      },
    });
  } catch {
    return c.text("Audio proxy failed", 502);
  }
});

// ─── Output file download ─────────────────────────────────────────────────────
// Streams a completed render file from the server's output directory.
// The client should call GET /api/renders/:jobId/download after polling
// until status === "complete".
app.get("/api/renders/:jobId/download", (c: Context) => {
  const jobId = c.req.param("jobId");
  const job = renderQueue.getJob(jobId);
  if (!job) return c.json({ error: "Render job not found" }, 404);
  if (job.status !== "complete" || !job.outputPath) {
    return c.json({ error: "Render not yet complete" }, 409);
  }
  if (!fs.existsSync(job.outputPath)) {
    return c.json({ error: "Output file not found on disk" }, 404);
  }
  const filename = path.basename(job.outputPath);
  const stat = fs.statSync(job.outputPath);
  const stream = fs.createReadStream(job.outputPath);
  // Convert Node.js ReadStream to Web ReadableStream for Hono's Response
  const webStream = new ReadableStream({
    start(controller) {
      stream.on("data", (chunk) =>
        controller.enqueue(typeof chunk === "string" ? Buffer.from(chunk) : chunk),
      );
      stream.on("end", () => controller.close());
      stream.on("error", (err) => controller.error(err));
    },
    cancel() {
      stream.destroy();
    },
  });
  return new Response(webStream, {
    status: 200,
    headers: {
      "Content-Type": "application/octet-stream",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Content-Length": String(stat.size),
    },
  });
});

// In production, serve the Vite-built static assets from the same Hono server
if (isProduction) {
  const distDir = path.join(STUDIO_DIR, "dist");
  if (fs.existsSync(distDir)) {
    // root is relative to CWD; compute the relative path from CWD → distDir
    const relDist = path.relative(process.cwd(), distDir);
    app.use("/*", serveStatic({ root: relDist, rewriteRequestPath: (p) => p }));
    // Fallback: serve index.html for client-side routing (SPA)
    app.get("*", (c) => {
      const html = fs.readFileSync(path.join(distDir, "index.html"), "utf-8");
      return c.html(html);
    });
  }
}

// ─── Start ────────────────────────────────────────────────────────────────────

const PORT = isProduction ? Number(process.env.PORT ?? 3000) : 3001;
const HOST = process.env.HOST ?? (isProduction ? "0.0.0.0" : "127.0.0.1");

const server = serve({ fetch: app.fetch, port: PORT, hostname: HOST }, () => {
  console.log(`[studio-api] listening on http://localhost:${PORT}`);
  console.log(`[studio-api] mode: ${isProduction ? "production" : "development"}`);
  console.log(`[studio-api] compositions bundle: ${COMPOSITIONS_ENTRY}`);
  console.log(`[studio-api] render output: ${OUTPUT_DIR}`);
  console.log(`[studio-api] assets dir: ${ASSETS_DIR}`);
  console.log(`[studio-api] projects dir: ${PROJECTS_DIR}`);
});

// ─── Graceful Shutdown ────────────────────────────────────────────────────────

function gracefulShutdown(signal: string) {
  console.log(`\n[studio-api] received ${signal}, shutting down gracefully...`);
  automationScheduler.stopAll();
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
