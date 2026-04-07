/**
 * Hono app factory — accepts a RenderQueue so the server can be tested without
 * starting an HTTP listener and without needing a real Remotion renderer.
 *
 * Usage:
 *   import { createApp } from "./src/api";
 *   const { app } = createApp(renderQueue);
 *   serve({ fetch: app.fetch, port: 3001 });
 */

import fs from "node:fs";
import { Hono } from "hono";
import { cors } from "hono/cors";
import {
  getTemplate,
  getTemplateManifests,
  validateInputProps,
} from "@studio/template-registry";
import type { RenderQueue } from "@studio/renderer";
import type {
  Project,
  RenderJob,
  ExportFormat,
  AspectRatioPreset,
} from "@studio/shared-types";
import {
  DEFAULT_ASPECT_RATIO_PRESET,
  QUALITY_CRF,
  VideoCodecSchema,
  QualityPresetSchema,
  AssetTypeSchema,
  normalizeAspectRatioConfig,
} from "@studio/shared-types";
import type { StorageConfig } from "./storage";
import {
  deleteAssetFromDisk,
  deletePersistedProject,
  findProjectsUsingAsset,
  getAssetContentPath,
  loadAssetsFromDisk,
  loadProjectsFromDisk,
  persistProject,
  registerExistingAsset,
  renameAsset,
  saveUploadedAssets,
} from "./storage";

export function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Build the Hono API application.
 * @param renderQueue  The render queue that will execute jobs. Use a real
 *                     `RenderQueue` (with `executeRender` as the render
 *                     function) in production; inject a mock queue in tests.
 * @param corsOrigin   Allowed CORS origin. Defaults to "*" (open) for tests;
 *                     pass "http://localhost:3000" in production.
 */
export function createApp(
  renderQueue: RenderQueue,
  corsOrigin = "*",
  storageConfig: StorageConfig = {},
) {
  const projectStore = loadProjectsFromDisk(storageConfig.projectsDir);
  const renderJobStore = new Map<string, RenderJob>();
  const assetStore = loadAssetsFromDisk(storageConfig.assetsDir);

  // ─── Sync queue events → renderJobStore ───────────────────────────────────
  // This ensures GET /api/renders/:id always returns live state even if the
  // caller only has the store reference (no direct queue access).
  const syncJob = (job: RenderJob) => renderJobStore.set(job.id, { ...job });
  renderQueue.on("job:queued", syncJob);
  renderQueue.on("job:started", syncJob);
  renderQueue.on("job:progress", syncJob);
  renderQueue.on("job:complete", syncJob);
  renderQueue.on("job:error", syncJob);
  renderQueue.on("job:cancelled", syncJob);

  const app = new Hono();
  app.use("*", cors({ origin: corsOrigin }));

  // ─── Templates ────────────────────────────────────────────────────────────

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

  // ─── Export formats ───────────────────────────────────────────────────────

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
      fpsOptions: [24, 25, 30, 60],
    });
  });

  // ─── Assets ───────────────────────────────────────────────────────────────

  app.get("/api/assets", (c) => {
    const type = c.req.query("type");
    const search = c.req.query("search")?.trim().toLowerCase();

    let assets = Array.from(assetStore.values());
    if (type) {
      assets = assets.filter((asset) => asset.type === type);
    }
    if (search) {
      assets = assets.filter((asset) => asset.name.toLowerCase().includes(search));
    }

    assets.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    return c.json({ assets });
  });

  app.get("/api/assets/:id", (c) => {
    const asset = assetStore.get(c.req.param("id"));
    if (!asset) return c.json({ error: "Asset not found" }, 404);
    return c.json(asset);
  });

  app.post("/api/assets", async (c) => {
    const formData = await c.req.formData();
    const rawFiles = formData
      .getAll("files")
      .filter((value): value is File => value instanceof File);
    const singleFile = formData.get("file");
    const files = rawFiles.length > 0
      ? rawFiles
      : singleFile instanceof File
        ? [singleFile]
        : [];

    if (files.length === 0) {
      return c.json({ error: "At least one file is required" }, 400);
    }

    try {
      const assets = await saveUploadedAssets(storageConfig.assetsDir, files, assetStore);
      return c.json({ assets }, 201);
    } catch (error) {
      return c.json(
        { error: error instanceof Error ? error.message : "Failed to upload assets" },
        400,
      );
    }
  });

  app.post("/api/assets/register", async (c) => {
    const body = await c.req.json<{
      id: string;
      name: string;
      type: string;
      path: string;
      mimeType: string;
      sizeBytes: number;
    }>().catch(() => null);

    if (!body) {
      return c.json({ error: "Invalid JSON body" }, 400);
    }

    const parsedType = AssetTypeSchema.safeParse(body.type);
    if (!parsedType.success) {
      return c.json({ error: "Invalid asset type" }, 400);
    }

    if (!body.id || !body.name?.trim() || !body.path || !body.mimeType || body.sizeBytes < 0) {
      return c.json({ error: "id, name, type, path, mimeType, and sizeBytes are required" }, 400);
    }

    try {
      const asset = registerExistingAsset(storageConfig.assetsDir, assetStore, {
        id: body.id,
        name: body.name,
        type: parsedType.data,
        path: body.path,
        mimeType: body.mimeType,
        sizeBytes: body.sizeBytes,
      });
      return c.json(asset, 201);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to register asset";
      const status = message.includes("already exists")
        ? 409
        : message.includes("not found")
          ? 404
          : 400;
      return c.json({ error: message }, status as 400 | 404 | 409);
    }
  });

  app.get("/api/assets/:id/content", (c) => {
    const asset = assetStore.get(c.req.param("id"));
    if (!asset) return c.json({ error: "Asset not found" }, 404);

    const contentPath = getAssetContentPath(assetStore, asset.id);
    if (!contentPath || !fs.existsSync(contentPath)) {
      return c.json({ error: "Asset content not found" }, 404);
    }

    return new Response(fs.readFileSync(contentPath), {
      status: 200,
      headers: {
        "Content-Type": asset.mimeType,
        "Cache-Control": "public, max-age=3600",
      },
    });
  });

  app.patch("/api/assets/:id", async (c) => {
    const body = (await c.req.json<{ name?: string }>().catch(() => ({}))) as {
      name?: string;
    };
    if (!body.name?.trim()) {
      return c.json({ error: "Asset name is required" }, 400);
    }

    const asset = renameAsset(storageConfig.assetsDir, assetStore, c.req.param("id"), body.name);
    if (!asset) return c.json({ error: "Asset not found" }, 404);
    return c.json(asset);
  });

  app.delete("/api/assets/:id", (c) => {
    const assetId = c.req.param("id");
    if (!assetStore.has(assetId)) return c.json({ error: "Asset not found" }, 404);

    const projectIds = findProjectsUsingAsset(projectStore, assetId);
    if (projectIds.length > 0) {
      return c.json(
        {
          error: "Asset is still referenced by one or more projects",
          projectIds,
        },
        409,
      );
    }

    deleteAssetFromDisk(storageConfig.assetsDir, assetStore, assetId);
    return c.json({ success: true });
  });

  // ─── Projects ─────────────────────────────────────────────────────────────

  app.get("/api/projects", (c) => {
    return c.json(
      Array.from(projectStore.values()).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
    );
  });

  app.post("/api/projects", async (c) => {
    const body = await c.req.json<{
      templateId: string;
      name: string;
      inputProps?: Record<string, unknown>;
      aspectRatio?: AspectRatioPreset;
      exportFormat?: Partial<ExportFormat>;
    }>();

    const { templateId, name, inputProps, aspectRatio, exportFormat } = body;

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

    const fallbackPreset =
      (template.manifest.supportedAspectRatios[0] ?? DEFAULT_ASPECT_RATIO_PRESET) as Exclude<
        AspectRatioPreset,
        "custom"
      >;
    const resolvedAspectRatio = normalizeAspectRatioConfig(aspectRatio, undefined, fallbackPreset);

    const project: Project = {
      id: generateId(),
      name,
      templateId,
      inputProps: validation.data,
      aspectRatio: resolvedAspectRatio,
      exportFormat: {
        codec: "h264",
        fileExtension: ".mp4",
        crf: QUALITY_CRF.standard,
        fps: template.manifest.defaultFps,
        scale: 1,
        ...exportFormat,
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      version: 1,
    };

    projectStore.set(project.id, project);
    persistProject(storageConfig.projectsDir, project);
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
    const template = getTemplate(project.templateId);

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

    if (body.aspectRatio) {
      project.aspectRatio = normalizeAspectRatioConfig(
        body.aspectRatio,
        project.aspectRatio,
        (template?.manifest.supportedAspectRatios[0] ?? DEFAULT_ASPECT_RATIO_PRESET) as Exclude<
          AspectRatioPreset,
          "custom"
        >,
      );
    }

    if (body.exportFormat) {
      project.exportFormat = { ...project.exportFormat, ...body.exportFormat };
    }

    project.updatedAt = new Date().toISOString();
    project.version++;
    projectStore.set(project.id, project);
    persistProject(storageConfig.projectsDir, project);
    return c.json(project);
  });

  app.delete("/api/projects/:id", (c) => {
    const id = c.req.param("id");
    if (!projectStore.has(id)) return c.json({ error: "Project not found" }, 404);

    const activeRender = Array.from(renderJobStore.values()).find(
      (job) =>
        job.projectId === id &&
        ["queued", "bundling", "rendering", "encoding"].includes(job.status),
    );
    if (activeRender) {
      return c.json(
        { error: "Project has an active render job", jobId: activeRender.id },
        409,
      );
    }

    projectStore.delete(id);
    deletePersistedProject(storageConfig.projectsDir, id);
    return c.json({ success: true });
  });

  app.post("/api/projects/:id/duplicate", async (c) => {
    const project = projectStore.get(c.req.param("id"));
    if (!project) return c.json({ error: "Project not found" }, 404);

    const body = (await c.req.json<{ name?: string }>().catch(() => ({}))) as {
      name?: string;
    };
    const duplicate: Project = {
      ...project,
      id: generateId(),
      name: body.name?.trim() || `${project.name} Copy`,
      inputProps: JSON.parse(JSON.stringify(project.inputProps)),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      version: 1,
    };

    projectStore.set(duplicate.id, duplicate);
    persistProject(storageConfig.projectsDir, duplicate);
    return c.json(duplicate, 201);
  });

  // ─── Render ───────────────────────────────────────────────────────────────

  app.post("/api/projects/:id/render", async (c) => {
    const project = projectStore.get(c.req.param("id"));
    if (!project) return c.json({ error: "Project not found" }, 404);

    const body = await c.req
      .json<{ codec?: string; quality?: string; fps?: number }>()
      .catch(() => ({}) as { codec?: string; quality?: string; fps?: number });

    const codecParse = VideoCodecSchema.safeParse(body.codec ?? project.exportFormat.codec);
    const codec = codecParse.success ? codecParse.data : "h264";

    const qualityParse = QualityPresetSchema.safeParse(body.quality);
    const crf = qualityParse.success
      ? QUALITY_CRF[qualityParse.data]
      : project.exportFormat.crf;

    const codecExtMap: Record<string, string> = {
      h264: ".mp4",
      h265: ".mp4",
      vp8: ".webm",
      vp9: ".webm",
      av1: ".webm",
      prores: ".mov",
      gif: ".gif",
    };

    const exportFormat: ExportFormat = {
      ...project.exportFormat,
      codec,
      fileExtension: codecExtMap[codec] ?? ".mp4",
      crf,
      fps: body.fps ?? project.exportFormat.fps,
    };

    // ⚠️  Critical: use the Remotion compositionId (e.g. "HistoryStoryline"),
    // NOT the registry id (e.g. "history-storyline"). The renderer calls
    // selectComposition({ id }) against the Remotion bundle, which only knows
    // about its registered composition IDs.
    const template = getTemplate(project.templateId);
    const compositionId = template?.manifest.compositionId ?? project.templateId;

    const job: RenderJob = {
      id: generateId(),
      projectId: project.id,
      templateId: compositionId,
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

    // Persist immediately so GET /api/renders/:id works even before the queue
    // processes the job (job:queued event fires synchronously inside enqueue).
    renderJobStore.set(job.id, job);

    // Snapshot the initial "queued" state for the 202 response.
    // The queue may mutate job.status synchronously (before our return) when
    // the render function has no real await (e.g. in tests). Returning a
    // snapshot guarantees the caller always sees status:"queued" in the 202.
    const jobSnapshot = { ...job };

    // Fire-and-forget — the queue processes the job asynchronously.
    renderQueue.enqueue(job).catch((err: Error) => {
      console.error(`[render] job ${job.id} failed: ${err.message}`);
    });

    return c.json(jobSnapshot, 202);
  });

  app.get("/api/renders", (c) => {
    const projectId = c.req.query("projectId");
    const status = c.req.query("status");

    let jobs = Array.from(renderJobStore.values());
    if (projectId) jobs = jobs.filter((job) => job.projectId === projectId);
    if (status) jobs = jobs.filter((job) => job.status === status);

    jobs.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    return c.json({ jobs });
  });

  app.get("/api/renders/:jobId", (c) => {
    const jobId = c.req.param("jobId");
    // Prefer the live queue state (always most up-to-date internal reference),
    // fall back to the snapshot store.
    const job = renderQueue.getJob(jobId) ?? renderJobStore.get(jobId);
    if (!job) return c.json({ error: "Render job not found" }, 404);
    return c.json(job);
  });

  app.post("/api/renders/:jobId/cancel", (c) => {
    const jobId = c.req.param("jobId");
    const job = renderQueue.getJob(jobId) ?? renderJobStore.get(jobId);
    if (!job) return c.json({ error: "Render job not found" }, 404);
    const success = renderQueue.cancelJob(jobId);
    return c.json({ success, jobId });
  });

  return { app, projectStore, renderJobStore, assetStore };
}
