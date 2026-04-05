/**
 * Hono HTTP backend for Media Studio — runs on port 3001.
 * Vite dev server (port 3000) proxies /api/* requests here.
 *
 * Endpoints
 *   GET    /api/templates            — list all registered templates
 *   GET    /api/projects             — list all in-memory projects
 *   POST   /api/projects             — create a project
 *   GET    /api/projects/:id         — get a project
 *   PATCH  /api/projects/:id         — update a project
 *   POST   /api/projects/:id/render  — queue a render job
 *   GET    /api/renders/:jobId       — poll render job status
 *   GET    /api/export-formats       — list supported codecs / presets
 */

import { Hono } from "hono";
import { cors } from "hono/cors";
import { serve } from "@hono/node-server";
import { getTemplate, getTemplateManifests, validateInputProps } from "@studio/template-registry";
import type {
  Project,
  RenderJob,
  ExportFormat,
  AspectRatioPreset,
} from "@studio/shared-types";
import {
  ASPECT_RATIO_DIMENSIONS,
  QUALITY_CRF,
  VideoCodecSchema,
  QualityPresetSchema,
} from "@studio/shared-types";

// ─── In-memory stores ────────────────────────────────────────────

const projectStore = new Map<string, Project>();
const renderJobStore = new Map<string, RenderJob>();

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

const app = new Hono();

// Allow cross-origin requests from the Vite dev server
app.use("*", cors({ origin: "http://localhost:3000" }));

// ─── Templates ───────────────────────────────────────────────────

app.get("/api/templates", (c) => {
  const manifests = getTemplateManifests().map((m) => ({
    id: m.id,
    name: m.name,
    description: m.description,
    category: m.category,
    tags: m.tags,
    supportedAspectRatios: m.supportedAspectRatios,
    defaultDurationInFrames: m.defaultDurationInFrames,
    defaultFps: m.defaultFps,
    thumbnailFrame: m.thumbnailFrame,
    compositionId: m.compositionId,
  }));
  return c.json(manifests);
});

// ─── Export formats ──────────────────────────────────────────────

app.get("/api/export-formats", (c) => {
  return c.json({
    codecs: {
      h264: { extension: ".mp4", description: "Most compatible" },
      h265: { extension: ".mp4", description: "Better compression" },
      vp8: { extension: ".webm", description: "WebM legacy" },
      vp9: { extension: ".webm", description: "WebM modern" },
      av1: { extension: ".webm", description: "Best compression" },
      prores: { extension: ".mov", description: "Professional, lossless" },
      gif: { extension: ".gif", description: "Animated GIF" },
    },
    qualityPresets: QUALITY_CRF,
    fpsOptions: [24, 25, 30, 50, 60],
  });
});

// ─── Projects ────────────────────────────────────────────────────

app.get("/api/projects", (c) => {
  const projects = Array.from(projectStore.values());
  return c.json(projects);
});

app.post("/api/projects", async (c) => {
  const body = await c.req.json<{
    templateId: string;
    name: string;
    inputProps?: Record<string, unknown>;
    aspectRatio?: AspectRatioPreset;
  }>();

  const { templateId, name, inputProps, aspectRatio } = body;

  if (!templateId || !name) {
    return c.json({ error: "templateId and name are required" }, 400);
  }

  const template = getTemplate(templateId);
  if (!template) {
    return c.json({ error: `Template "${templateId}" not found` }, 404);
  }

  const props = inputProps ?? template.manifest.defaultProps;
  const validation = validateInputProps(templateId, props as Record<string, unknown>);
  if (!validation.success) {
    return c.json({ error: validation.error }, 400);
  }

  const arPreset = (aspectRatio ?? "16:9") as Exclude<AspectRatioPreset, "custom">;
  const dims = ASPECT_RATIO_DIMENSIONS[arPreset] ?? ASPECT_RATIO_DIMENSIONS["16:9"];

  const project: Project = {
    id: generateId(),
    name,
    templateId,
    inputProps: validation.data,
    aspectRatio: { preset: arPreset, ...dims },
    exportFormat: {
      codec: "h264",
      fileExtension: ".mp4",
      crf: QUALITY_CRF.standard,
      fps: template.manifest.defaultFps,
      scale: 1,
    },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    version: 1,
  };

  projectStore.set(project.id, project);
  return c.json(project, 201);
});

app.get("/api/projects/:id", (c) => {
  const project = projectStore.get(c.req.param("id"));
  if (!project) return c.json({ error: "Project not found" }, 404);
  return c.json(project);
});

app.patch("/api/projects/:id", async (c) => {
  const project = projectStore.get(c.req.param("id"));
  if (!project) return c.json({ error: "Project not found" }, 404);

  const body = await c.req.json<{
    name?: string;
    inputProps?: Record<string, unknown>;
    aspectRatio?: AspectRatioPreset;
    exportFormat?: Partial<ExportFormat>;
  }>();

  if (body.name) project.name = body.name;

  if (body.inputProps) {
    const validation = validateInputProps(project.templateId, body.inputProps);
    if (!validation.success) {
      return c.json({ error: validation.error }, 400);
    }
    project.inputProps = validation.data;
  }

  if (body.aspectRatio && body.aspectRatio !== "custom") {
    const dims = ASPECT_RATIO_DIMENSIONS[body.aspectRatio];
    project.aspectRatio = { preset: body.aspectRatio, ...dims };
  }

  if (body.exportFormat) {
    project.exportFormat = { ...project.exportFormat, ...body.exportFormat };
  }

  project.updatedAt = new Date().toISOString();
  project.version++;
  projectStore.set(project.id, project);
  return c.json(project);
});

app.delete("/api/projects/:id", (c) => {
  const id = c.req.param("id");
  if (!projectStore.has(id)) return c.json({ error: "Project not found" }, 404);
  projectStore.delete(id);
  return c.json({ success: true });
});

// ─── Render ──────────────────────────────────────────────────────

app.post("/api/projects/:id/render", async (c) => {
  const project = projectStore.get(c.req.param("id"));
  if (!project) return c.json({ error: "Project not found" }, 404);

  const body = await c.req.json<{
    codec?: string;
    quality?: string;
    fps?: number;
  }>().catch(() => ({}));

  const codecParse = VideoCodecSchema.safeParse(body.codec ?? project.exportFormat.codec);
  const codec = codecParse.success ? codecParse.data : "h264";

  const qualityParse = QualityPresetSchema.safeParse(body.quality);
  const crf = qualityParse.success ? QUALITY_CRF[qualityParse.data] : project.exportFormat.crf;

  const codecExtMap: Record<string, string> = {
    h264: ".mp4", h265: ".mp4", vp8: ".webm", vp9: ".webm",
    av1: ".webm", prores: ".mov", gif: ".gif",
  };

  const exportFormat: ExportFormat = {
    ...project.exportFormat,
    codec,
    fileExtension: codecExtMap[codec] ?? ".mp4",
    crf,
    fps: body.fps ?? project.exportFormat.fps,
  };

  const job: RenderJob = {
    id: generateId(),
    projectId: project.id,
    templateId: project.templateId,
    inputProps: project.inputProps,
    exportFormat,
    aspectRatio: project.aspectRatio,
    status: "queued",
    progress: null,
    outputPath: null,
    error: null,
    createdAt: new Date().toISOString(),
    startedAt: null,
    completedAt: null,
  };

  renderJobStore.set(job.id, job);
  return c.json(job, 202);
});

app.get("/api/renders/:jobId", (c) => {
  const job = renderJobStore.get(c.req.param("jobId"));
  if (!job) return c.json({ error: "Render job not found" }, 404);
  return c.json(job);
});

// ─── Start ───────────────────────────────────────────────────────

const PORT = 3001;
serve({ fetch: app.fetch, port: PORT }, () => {
  console.log(`[studio-api] listening on http://localhost:${PORT}`);
});
