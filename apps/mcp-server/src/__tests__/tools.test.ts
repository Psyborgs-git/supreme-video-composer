import { describe, it, expect, beforeEach } from "vitest";
import {
  handleListTemplates,
  handleGetTemplate,
  handleCreateProject,
  handleUpdateProject,
  handleGetProject,
  handleListProjects,
  handleDeleteProject,
  handleDuplicateProject,
  handleRenderProject,
  handleGetRenderStatus,
  handleCancelRender,
  handleListRenders,
  handleListAspectRatios,
  handlePreviewUrl,
  handleExportFormats,
  handleListAssets,
  handleGetAsset,
  handleDeleteAsset,
  handleRegisterAsset,
  clearStores,
  projectStore,
  renderJobStore,
  assetStore,
} from "../handlers";
import {
  handleCreateVideo,
  handleReadMe,
  handleRuleReactCode,
  handleRuleRemotionAnimations,
  handleRuleRemotionSequencing,
  handleRuleRemotionTextAnimations,
  handleRuleRemotionTiming,
  handleRuleRemotionTransitions,
  handleRuleRemotionTrimming,
} from "../remotion-app/tools";

// Clear stores between tests to prevent state leakage
beforeEach(() => clearStores());

// ─── Helper ───────────────────────────────────────────────────────

function parseText(result: { content: { type: string; text: string }[] }) {
  return JSON.parse(result.content[0].text);
}

function parseVideoProject(result: { structuredContent?: Record<string, unknown> }) {
  const videoProject = result.structuredContent?.videoProject;
  if (typeof videoProject !== "string") {
    throw new Error(`Expected structuredContent.videoProject string, received ${JSON.stringify(result.structuredContent)}`);
  }

  return JSON.parse(videoProject);
}

// ─── list_templates ───────────────────────────────────────────────

describe("MCP: list_templates", () => {
  it("returns an array of 6 templates", async () => {
    const result = await handleListTemplates();
    expect(result.isError).toBeUndefined();
    const templates = parseText(result);
    expect(Array.isArray(templates)).toBe(true);
    expect(templates).toHaveLength(8);
  });

  it("each template has required fields", async () => {
    const result = await handleListTemplates();
    const templates = parseText(result);
    for (const t of templates) {
      expect(t.id).toBeTruthy();
      expect(t.name).toBeTruthy();
      expect(t.description).toBeTruthy();
      expect(t.category).toBeTruthy();
      expect(Array.isArray(t.tags)).toBe(true);
      expect(Array.isArray(t.supportedAspectRatios)).toBe(true);
    }
  });

  it("contains the history-storyline template", async () => {
    const result = await handleListTemplates();
    const templates = parseText(result);
    const hs = templates.find((t: any) => t.id === "history-storyline");
    expect(hs).toBeDefined();
    expect(hs.category).toBe("educational");
  });
});

// ─── create_project ────────────────────────────────────────────────

describe("MCP: create_project", () => {
  it("creates a project with default props", async () => {
    const result = await handleCreateProject({
      templateId: "history-storyline",
      name: "My Timeline",
    });
    expect(result.isError).toBeUndefined();
    const project = parseText(result);
    expect(project.id).toBeTruthy();
    expect(project.name).toBe("My Timeline");
    expect(project.templateId).toBe("history-storyline");
    expect(project.version).toBe(1);
    expect(project.aspectRatio.preset).toBe("youtube");
    expect(project.aspectRatio.width).toBe(1920);
    expect(project.aspectRatio.height).toBe(1080);
    expect(project.exportFormat.codec).toBe("h264");
  });

  it("stores the project in the project store", async () => {
    const result = await handleCreateProject({
      templateId: "quote-card-sequence",
      name: "Quote Reel",
    });
    const project = parseText(result);
    expect(projectStore.has(project.id)).toBe(true);
  });

  it("respects specified aspect ratio", async () => {
    const result = await handleCreateProject({
      templateId: "social-media-reel",
      name: "Reel",
      aspectRatio: "instagram-reel",
    });
    const project = parseText(result);
    expect(project.aspectRatio.preset).toBe("instagram-reel");
    expect(project.aspectRatio.width).toBe(1080);
    expect(project.aspectRatio.height).toBe(1920);
  });

  it("accepts custom inputProps", async () => {
    const result = await handleCreateProject({
      templateId: "quote-card-sequence",
      name: "Custom Quotes",
      inputProps: {
        quotes: [{ text: "Hello world", author: "Tester" }],
        durationPerQuoteInFrames: 90,
      },
    });
    expect(result.isError).toBeUndefined();
    const project = parseText(result);
    expect((project.inputProps as any).quotes[0].text).toBe("Hello world");
  });

  it("returns isError for unknown templateId", async () => {
    const result = await handleCreateProject({
      templateId: "not-a-template",
      name: "Bad",
    });
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("not found");
  });

  it("returns isError for invalid props", async () => {
    const result = await handleCreateProject({
      templateId: "history-storyline",
      name: "Bad Props",
      inputProps: { events: [] }, // min(1) error
    });
    expect(result.isError).toBe(true);
  });
});

// ─── get_project ────────────────────────────────────────────────────

describe("MCP: get_project", () => {
  it("retrieves an existing project", async () => {
    const created = parseText(
      await handleCreateProject({ templateId: "product-showcase", name: "Showcase" }),
    );
    const result = await handleGetProject({ projectId: created.id });
    const fetched = parseText(result);
    expect(fetched.id).toBe(created.id);
    expect(fetched.name).toBe("Showcase");
  });

  it("returns isError for unknown project", async () => {
    const result = await handleGetProject({ projectId: "ghost-id" });
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("not found");
  });
});

// ─── update_project ─────────────────────────────────────────────────

describe("MCP: update_project", () => {
  it("updates project name and increments version", async () => {
    const created = parseText(
      await handleCreateProject({ templateId: "history-storyline", name: "Old Name" }),
    );
    const updated = parseText(
      await handleUpdateProject({ projectId: created.id, name: "New Name" }),
    );
    expect(updated.name).toBe("New Name");
    expect(updated.version).toBe(2);
  });

  it("updates aspect ratio correctly", async () => {
    const created = parseText(
      await handleCreateProject({ templateId: "social-media-reel", name: "Reel" }),
    );
    const updated = parseText(
      await handleUpdateProject({ projectId: created.id, aspectRatio: "instagram-post" }),
    );
    expect(updated.aspectRatio.preset).toBe("instagram-post");
    expect(updated.aspectRatio.width).toBe(1080);
    expect(updated.aspectRatio.height).toBe(1080);
  });

  it("updates inputProps with validation", async () => {
    const created = parseText(
      await handleCreateProject({ templateId: "quote-card-sequence", name: "Quotes" }),
    );
    const updated = parseText(
      await handleUpdateProject({
        projectId: created.id,
        inputProps: {
          quotes: [{ text: "Updated quote", author: "Author" }],
          durationPerQuoteInFrames: 100,
        },
      }),
    );
    expect((updated.inputProps as any).quotes[0].text).toBe("Updated quote");
  });

  it("returns isError for invalid inputProps update", async () => {
    const created = parseText(
      await handleCreateProject({ templateId: "history-storyline", name: "TL" }),
    );
    const result = await handleUpdateProject({
      projectId: created.id,
      inputProps: { events: [] }, // min(1) violation
    });
    expect(result.isError).toBe(true);
  });

  it("returns isError for unknown projectId", async () => {
    const result = await handleUpdateProject({ projectId: "nope", name: "X" });
    expect(result.isError).toBe(true);
  });

  it("updatedAt is later than createdAt after update", async () => {
    const created = parseText(
      await handleCreateProject({ templateId: "product-showcase", name: "P" }),
    );
    // Wait a tick to ensure timestamp differs
    await new Promise((r) => setTimeout(r, 5));
    const updated = parseText(
      await handleUpdateProject({ projectId: created.id, name: "P2" }),
    );
    expect(new Date(updated.updatedAt).getTime()).toBeGreaterThanOrEqual(
      new Date(created.createdAt).getTime(),
    );
  });
});

// ─── list_projects ────────────────────────────────────────────────────

describe("MCP: list_projects", () => {
  it("returns empty array when no projects", async () => {
    const result = await handleListProjects();
    const list = parseText(result);
    expect(list).toHaveLength(0);
  });

  it("lists all created projects", async () => {
    await handleCreateProject({ templateId: "history-storyline", name: "P1" });
    await handleCreateProject({ templateId: "quote-card-sequence", name: "P2" });
    await handleCreateProject({ templateId: "product-showcase", name: "P3" });

    const result = await handleListProjects();
    const list = parseText(result);
    expect(list).toHaveLength(3);
    const names = list.map((p: any) => p.name);
    expect(names).toContain("P1");
    expect(names).toContain("P2");
    expect(names).toContain("P3");
  });

  it("summary items contain id, name, templateId, aspectRatio, updatedAt", async () => {
    await handleCreateProject({ templateId: "history-storyline", name: "P" });
    const result = await handleListProjects();
    const list = parseText(result);
    const item = list[0];
    expect(item.id).toBeTruthy();
    expect(item.name).toBe("P");
    expect(item.templateId).toBe("history-storyline");
    expect(item.aspectRatio).toBeTruthy();
    expect(item.updatedAt).toBeTruthy();
  });
});

// ─── render_project ────────────────────────────────────────────────────

describe("MCP: render_project", () => {
  it("queues a render job with status=queued", async () => {
    const created = parseText(
      await handleCreateProject({ templateId: "history-storyline", name: "R" }),
    );
    const result = await handleRenderProject({ projectId: created.id });
    expect(result.isError).toBeUndefined();
    const job = parseText(result);
    expect(job.id).toBeTruthy();
    expect(job.status).toBe("queued");
    expect(job.projectId).toBe(created.id);
    expect(job.templateId).toBe("HistoryStoryline"); // compositionId, not template slug
    expect(job.outputPath).toBeNull();
    expect(job.error).toBeNull();
  });

  it("stores the render job", async () => {
    const created = parseText(
      await handleCreateProject({ templateId: "history-storyline", name: "R" }),
    );
    const job = parseText(await handleRenderProject({ projectId: created.id }));
    expect(renderJobStore.has(job.id)).toBe(true);
  });

  it("respects codec override", async () => {
    const created = parseText(
      await handleCreateProject({ templateId: "history-storyline", name: "R" }),
    );
    const job = parseText(await handleRenderProject({ projectId: created.id, codec: "h265" }));
    expect(job.exportFormat.codec).toBe("h265");
  });

  it("respects quality override (draft = high CRF)", async () => {
    const created = parseText(
      await handleCreateProject({ templateId: "history-storyline", name: "R" }),
    );
    const job = parseText(await handleRenderProject({ projectId: created.id, quality: "draft" }));
    expect(job.exportFormat.crf).toBe(28);
  });

  it("respects quality override (max = low CRF)", async () => {
    const created = parseText(
      await handleCreateProject({ templateId: "history-storyline", name: "R" }),
    );
    const job = parseText(await handleRenderProject({ projectId: created.id, quality: "max" }));
    expect(job.exportFormat.crf).toBe(1);
  });

  it("returns isError for unknown project", async () => {
    const result = await handleRenderProject({ projectId: "ghost" });
    expect(result.isError).toBe(true);
  });

  it("can queue multiple render jobs for the same project", async () => {
    const created = parseText(
      await handleCreateProject({ templateId: "product-showcase", name: "Multi" }),
    );
    const job1 = parseText(await handleRenderProject({ projectId: created.id }));
    const job2 = parseText(await handleRenderProject({ projectId: created.id }));
    expect(job1.id).not.toBe(job2.id);
    expect(renderJobStore.size).toBe(2);
  });
});

// ─── get_render_status ──────────────────────────────────────────────────

describe("MCP: get_render_status", () => {
  it("returns the queued job status", async () => {
    const created = parseText(
      await handleCreateProject({ templateId: "history-storyline", name: "R" }),
    );
    const job = parseText(await handleRenderProject({ projectId: created.id }));
    const status = parseText(await handleGetRenderStatus({ jobId: job.id }));
    expect(status.status).toBe("queued");
    expect(status.id).toBe(job.id);
  });

  it("returns isError for unknown job id", async () => {
    const result = await handleGetRenderStatus({ jobId: "no-such-job" });
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("not found");
  });
});

// ─── export_formats ──────────────────────────────────────────────────────

describe("MCP: export_formats", () => {
  it("returns codecs, qualityPresets, fpsOptions", async () => {
    const result = await handleExportFormats();
    const formats = parseText(result);
    expect(formats.codecs).toBeDefined();
    expect(formats.qualityPresets).toBeDefined();
    expect(formats.fpsOptions).toBeDefined();
  });

  it("contains all 7 codecs", async () => {
    const result = await handleExportFormats();
    const formats = parseText(result);
    const codecs = Object.keys(formats.codecs);
    expect(codecs).toContain("h264");
    expect(codecs).toContain("h265");
    expect(codecs).toContain("vp8");
    expect(codecs).toContain("vp9");
    expect(codecs).toContain("av1");
    expect(codecs).toContain("prores");
    expect(codecs).toContain("gif");
  });

  it("h264 has .mp4 extension", async () => {
    const result = await handleExportFormats();
    const formats = parseText(result);
    expect(formats.codecs.h264.extension).toBe(".mp4");
  });

  it("prores has .mov extension", async () => {
    const result = await handleExportFormats();
    const formats = parseText(result);
    expect(formats.codecs.prores.extension).toBe(".mov");
  });

  it("fpsOptions includes 30", async () => {
    const result = await handleExportFormats();
    const formats = parseText(result);
    expect(formats.fpsOptions).toContain(30);
  });

  it("qualityPresets draft has higher CRF than max", async () => {
    const result = await handleExportFormats();
    const formats = parseText(result);
    expect(formats.qualityPresets.draft).toBeGreaterThan(formats.qualityPresets.max);
  });
});

// ─── Full workflow: create → update → render → status ─────────────────────

describe("MCP: full project lifecycle", () => {
  it("create → update → render → get status", async () => {
    // 1. Create
    const createResult = await handleCreateProject({
      templateId: "product-showcase",
      name: "iPhone Launch",
      aspectRatio: "pinterest",
    });
    expect(createResult.isError).toBeUndefined();
    const project = parseText(createResult);
    expect(project.aspectRatio.preset).toBe("pinterest");

    // 2. Update
    const updateResult = await handleUpdateProject({
      projectId: project.id,
      name: "iPhone 17 Launch",
      inputProps: {
        products: [
          { name: "iPhone 17", price: "$999", imageUrl: "https://example.com/img.jpg" },
        ],
      },
    });
    expect(updateResult.isError).toBeUndefined();
    const updated = parseText(updateResult);
    expect(updated.version).toBe(2);
    expect(updated.name).toBe("iPhone 17 Launch");

    // 3. List to confirm it's there
    const listResult = await handleListProjects();
    const list = parseText(listResult);
    expect(list.some((p: any) => p.id === project.id)).toBe(true);

    // 4. Render with specific format
    const renderResult = await handleRenderProject({
      projectId: project.id,
      codec: "h264",
      quality: "high",
    });
    expect(renderResult.isError).toBeUndefined();
    const job = parseText(renderResult);
    expect(job.status).toBe("queued");
    expect(job.exportFormat.crf).toBe(12); // QUALITY_CRF.high = 12

    // 5. Check render status
    const statusResult = await handleGetRenderStatus({ jobId: job.id });
    expect(statusResult.isError).toBeUndefined();
    const status = parseText(statusResult);
    expect(status.id).toBe(job.id);
    expect(status.projectId).toBe(project.id);
  });
});

// ─── get_template ────────────────────────────────────────────────────

describe("MCP: get_template", () => {
  it("returns a known template", async () => {
    const result = await handleGetTemplate({ templateId: "history-storyline" });
    expect(result.isError).toBeUndefined();
    const t = parseText(result);
    expect(t.id).toBe("history-storyline");
    expect(t.compositionId).toBeTruthy();
  });

  it("returns structured error for unknown template", async () => {
    const result = await handleGetTemplate({ templateId: "ghost" });
    expect(result.isError).toBe(true);
    const err = parseText(result);
    expect(err.error.code).toBe("TEMPLATE_NOT_FOUND");
    expect(err.error.message).toContain("ghost");
  });
});

// ─── delete_project ──────────────────────────────────────────────────

describe("MCP: delete_project", () => {
  it("deletes an existing project", async () => {
    const { id } = parseText(
      await handleCreateProject({ templateId: "product-showcase", name: "ToDelete" }),
    );
    const result = await handleDeleteProject({ projectId: id });
    expect(result.isError).toBeUndefined();
    expect(parseText(result).deleted).toBe(true);
    expect(projectStore.has(id)).toBe(false);
  });

  it("returns structured error for unknown project", async () => {
    const result = await handleDeleteProject({ projectId: "ghost" });
    expect(result.isError).toBe(true);
    const err = parseText(result);
    expect(err.error.code).toBe("PROJECT_NOT_FOUND");
  });

  it("blocks deletion when there is an active render", async () => {
    const project = parseText(
      await handleCreateProject({ templateId: "product-showcase", name: "Active" }),
    );
    // Queue a render job manually to simulate active render
    const job = parseText(await handleRenderProject({ projectId: project.id }));
    expect(job.status).toBe("queued");

    const result = await handleDeleteProject({ projectId: project.id });
    expect(result.isError).toBe(true);
    const err = parseText(result);
    expect(err.error.code).toBe("PROJECT_HAS_ACTIVE_RENDER");
  });
});

// ─── duplicate_project ────────────────────────────────────────────────

describe("MCP: duplicate_project", () => {
  it("creates an independent copy with a new ID", async () => {
    const original = parseText(
      await handleCreateProject({ templateId: "social-media-reel", name: "Original" }),
    );
    const result = await handleDuplicateProject({ projectId: original.id });
    expect(result.isError).toBeUndefined();
    const copy = parseText(result);
    expect(copy.id).not.toBe(original.id);
    expect(copy.templateId).toBe(original.templateId);
    expect(copy.name).toContain("copy");
  });

  it("respects custom newName", async () => {
    const original = parseText(
      await handleCreateProject({ templateId: "product-showcase", name: "Base" }),
    );
    const copy = parseText(
      await handleDuplicateProject({ projectId: original.id, newName: "Fork" }),
    );
    expect(copy.name).toBe("Fork");
  });

  it("returns structured error for unknown project", async () => {
    const result = await handleDuplicateProject({ projectId: "ghost" });
    expect(result.isError).toBe(true);
    const err = parseText(result);
    expect(err.error.code).toBe("PROJECT_NOT_FOUND");
  });
});

// ─── cancel_render ────────────────────────────────────────────────────

describe("MCP: cancel_render", () => {
  it("cancels a queued job", async () => {
    const project = parseText(
      await handleCreateProject({ templateId: "history-storyline", name: "C" }),
    );
    const job = parseText(await handleRenderProject({ projectId: project.id }));
    const result = await handleCancelRender({ jobId: job.id });
    expect(result.isError).toBeUndefined();
    const cancelled = renderJobStore.get(job.id)!;
    expect(cancelled.status).toBe("cancelled");
  });

  it("returns structured error for unknown job", async () => {
    const result = await handleCancelRender({ jobId: "ghost" });
    expect(result.isError).toBe(true);
    const err = parseText(result);
    expect(err.error.code).toBe("JOB_NOT_FOUND");
  });
});

// ─── list_renders ────────────────────────────────────────────────────

describe("MCP: list_renders", () => {
  it("returns all jobs when no filter", async () => {
    const project = parseText(
      await handleCreateProject({ templateId: "history-storyline", name: "L" }),
    );
    await handleRenderProject({ projectId: project.id });
    await handleRenderProject({ projectId: project.id });
    const result = await handleListRenders();
    const { jobs } = parseText(result);
    expect(jobs).toHaveLength(2);
  });

  it("filters by projectId", async () => {
    const p1 = parseText(
      await handleCreateProject({ templateId: "history-storyline", name: "P1" }),
    );
    const p2 = parseText(
      await handleCreateProject({ templateId: "product-showcase", name: "P2" }),
    );
    await handleRenderProject({ projectId: p1.id });
    await handleRenderProject({ projectId: p2.id });
    const result = await handleListRenders({ projectId: p1.id });
    const { jobs } = parseText(result);
    expect(jobs).toHaveLength(1);
    expect(jobs[0].projectId).toBe(p1.id);
  });

  it("filters by status", async () => {
    const project = parseText(
      await handleCreateProject({ templateId: "history-storyline", name: "L" }),
    );
    const job = parseText(await handleRenderProject({ projectId: project.id }));
    await handleCancelRender({ jobId: job.id });
    const queued = parseText(await handleListRenders({ status: "queued" }));
    const cancelled = parseText(await handleListRenders({ status: "cancelled" }));
    expect(queued.jobs).toHaveLength(0);
    expect(cancelled.jobs).toHaveLength(1);
  });
});

// ─── list_aspect_ratios ──────────────────────────────────────────────

describe("MCP: list_aspect_ratios", () => {
  it("returns a presets array", async () => {
    const result = await handleListAspectRatios();
    expect(result.isError).toBeUndefined();
    const { presets } = parseText(result);
    expect(Array.isArray(presets)).toBe(true);
    expect(presets.length).toBeGreaterThan(0);
  });

  it("contains 16:9 with correct dimensions", async () => {
    const { presets } = parseText(await handleListAspectRatios());
    const widescreen = presets.find((p: any) => p.id === "youtube");
    expect(widescreen).toBeDefined();
    expect(widescreen.width).toBe(1920);
    expect(widescreen.height).toBe(1080);
  });

  it("contains 9:16 vertical format", async () => {
    const { presets } = parseText(await handleListAspectRatios());
    const vertical = presets.find((p: any) => p.id === "instagram-reel");
    expect(vertical).toBeDefined();
    expect(vertical.width).toBe(1080);
    expect(vertical.height).toBe(1920);
  });
});

// ─── preview_url ─────────────────────────────────────────────────────

describe("MCP: preview_url", () => {
  it("returns a URL for a known project", async () => {
    const project = parseText(
      await handleCreateProject({ templateId: "history-storyline", name: "Preview" }),
    );
    const result = await handlePreviewUrl({ projectId: project.id });
    expect(result.isError).toBeUndefined();
    const { url } = parseText(result);
    expect(url).toContain(project.id);
    expect(url).toContain("localhost");
  });

  it("returns structured error for unknown project", async () => {
    const result = await handlePreviewUrl({ projectId: "ghost" });
    expect(result.isError).toBe(true);
    const err = parseText(result);
    expect(err.error.code).toBe("PROJECT_NOT_FOUND");
  });
});

// ─── Structured error contract ───────────────────────────────────────

describe("MCP: error contract", () => {
  it("all errors are { error: { code, message } } JSON", async () => {
    const results = await Promise.all([
      handleGetTemplate({ templateId: "nope" }),
      handleGetProject({ projectId: "nope" }),
      handleDeleteProject({ projectId: "nope" }),
      handleDuplicateProject({ projectId: "nope" }),
      handleRenderProject({ projectId: "nope" }),
      handleGetRenderStatus({ jobId: "nope" }),
      handleCancelRender({ jobId: "nope" }),
      handlePreviewUrl({ projectId: "nope" }),
    ]);
    for (const r of results) {
      expect(r.isError).toBe(true);
      const parsed = JSON.parse(r.content[0].text);
      expect(parsed.error).toBeDefined();
      expect(typeof parsed.error.code).toBe("string");
      expect(typeof parsed.error.message).toBe("string");
    }
  });
});

// ─── list_assets ─────────────────────────────────────────────────────

describe("MCP: list_assets", () => {
  it("returns empty array when no assets are registered", async () => {
    const result = await handleListAssets();
    expect(result.isError).toBeUndefined();
    const { assets } = parseText(result);
    expect(Array.isArray(assets)).toBe(true);
    expect(assets).toHaveLength(0);
  });

  it("returns all registered assets", async () => {
    await handleRegisterAsset({
      id: "asset-1",
      name: "photo",
      type: "image",
      path: "/data/assets/images/photo.jpg",
      mimeType: "image/jpeg",
      sizeBytes: 102400,
    });
    await handleRegisterAsset({
      id: "asset-2",
      name: "track",
      type: "audio",
      path: "/data/assets/audio/track.mp3",
      mimeType: "audio/mpeg",
      sizeBytes: 2048000,
    });

    const result = await handleListAssets();
    const { assets } = parseText(result);
    expect(assets).toHaveLength(2);
  });

  it("filters by type", async () => {
    await handleRegisterAsset({
      id: "img-1",
      name: "banner",
      type: "image",
      path: "/data/assets/images/banner.png",
      mimeType: "image/png",
      sizeBytes: 51200,
    });
    await handleRegisterAsset({
      id: "vid-1",
      name: "clip",
      type: "video",
      path: "/data/assets/video/clip.mp4",
      mimeType: "video/mp4",
      sizeBytes: 5120000,
    });

    const images = parseText(await handleListAssets({ type: "image" }));
    expect(images.assets).toHaveLength(1);
    expect(images.assets[0].type).toBe("image");

    const videos = parseText(await handleListAssets({ type: "video" }));
    expect(videos.assets).toHaveLength(1);
    expect(videos.assets[0].type).toBe("video");
  });

  it("filters by search (case-insensitive)", async () => {
    await handleRegisterAsset({
      id: "s-1",
      name: "Hero Banner",
      type: "image",
      path: "/data/assets/images/hero.jpg",
      mimeType: "image/jpeg",
      sizeBytes: 81920,
    });
    await handleRegisterAsset({
      id: "s-2",
      name: "Background Music",
      type: "audio",
      path: "/data/assets/audio/bg.mp3",
      mimeType: "audio/mpeg",
      sizeBytes: 1024000,
    });

    const result = parseText(await handleListAssets({ search: "hero" }));
    expect(result.assets).toHaveLength(1);
    expect(result.assets[0].name).toBe("Hero Banner");
  });

  it("returns structured error for invalid type filter", async () => {
    const result = await handleListAssets({ type: "spreadsheet" });
    expect(result.isError).toBe(true);
    const err = parseText(result);
    expect(err.error.code).toBe("INVALID_ASSET_TYPE");
  });
});

// ─── get_asset ───────────────────────────────────────────────────────

describe("MCP: get_asset", () => {
  it("returns an existing asset", async () => {
    await handleRegisterAsset({
      id: "ga-1",
      name: "logo",
      type: "image",
      path: "/data/assets/images/logo.png",
      mimeType: "image/png",
      sizeBytes: 4096,
    });
    const result = await handleGetAsset({ assetId: "ga-1" });
    expect(result.isError).toBeUndefined();
    const asset = parseText(result);
    expect(asset.id).toBe("ga-1");
    expect(asset.name).toBe("logo");
    expect(asset.type).toBe("image");
  });

  it("returns structured error for unknown asset", async () => {
    const result = await handleGetAsset({ assetId: "ghost-asset" });
    expect(result.isError).toBe(true);
    const err = parseText(result);
    expect(err.error.code).toBe("ASSET_NOT_FOUND");
    expect(err.error.message).toContain("ghost-asset");
  });
});

// ─── delete_asset ────────────────────────────────────────────────────

describe("MCP: delete_asset", () => {
  it("deletes an existing asset", async () => {
    await handleRegisterAsset({
      id: "del-1",
      name: "old-photo",
      type: "image",
      path: "/data/assets/images/old-photo.jpg",
      mimeType: "image/jpeg",
      sizeBytes: 20480,
    });

    const result = await handleDeleteAsset({ assetId: "del-1" });
    expect(result.isError).toBeUndefined();
    const r = parseText(result);
    expect(r.deleted).toBe(true);
    expect(r.assetId).toBe("del-1");
    expect(assetStore.has("del-1")).toBe(false);
  });

  it("returns structured error for unknown asset", async () => {
    const result = await handleDeleteAsset({ assetId: "ghost-asset" });
    expect(result.isError).toBe(true);
    const err = parseText(result);
    expect(err.error.code).toBe("ASSET_NOT_FOUND");
  });

  it("blocks deletion when asset is referenced by a project", async () => {
    await handleRegisterAsset({
      id: "in-use",
      name: "referenced-image",
      type: "image",
      path: "/data/assets/images/ref.jpg",
      mimeType: "image/jpeg",
      sizeBytes: 40960,
    });

    // Create a project whose inputProps reference the asset id
    await handleCreateProject({
      templateId: "quote-card-sequence",
      name: "Uses Asset",
      inputProps: {
        quotes: [{ text: "Hello", author: "in-use" }],
      },
    });

    const result = await handleDeleteAsset({ assetId: "in-use" });
    expect(result.isError).toBe(true);
    const err = parseText(result);
    expect(err.error.code).toBe("ASSET_IN_USE");
    expect(err.error.details.projectIds).toBeDefined();
    expect(assetStore.has("in-use")).toBe(true); // not deleted
  });
});

// ─── register_asset ───────────────────────────────────────────────────

describe("MCP: register_asset", () => {
  it("registers a new asset and returns it", async () => {
    const result = await handleRegisterAsset({
      id: "reg-1",
      name: "new-image",
      type: "image",
      path: "/data/assets/images/new.jpg",
      mimeType: "image/jpeg",
      sizeBytes: 8192,
    });
    expect(result.isError).toBeUndefined();
    const asset = parseText(result);
    expect(asset.id).toBe("reg-1");
    expect(asset.name).toBe("new-image");
    expect(asset.type).toBe("image");
    expect(asset.sizeBytes).toBe(8192);
    expect(assetStore.has("reg-1")).toBe(true);
  });

  it("returns structured error for duplicate id", async () => {
    await handleRegisterAsset({
      id: "dup-id",
      name: "first",
      type: "image",
      path: "/data/assets/images/first.jpg",
      mimeType: "image/jpeg",
      sizeBytes: 1024,
    });
    const result = await handleRegisterAsset({
      id: "dup-id",
      name: "second",
      type: "image",
      path: "/data/assets/images/second.jpg",
      mimeType: "image/jpeg",
      sizeBytes: 2048,
    });
    expect(result.isError).toBe(true);
    const err = parseText(result);
    expect(err.error.code).toBe("ASSET_ALREADY_EXISTS");
  });

  it("returns structured error for invalid type", async () => {
    const result = await handleRegisterAsset({
      id: "bad-type",
      name: "bad",
      type: "spreadsheet",
      path: "/data/assets/spreadsheet.xlsx",
      mimeType: "application/vnd.ms-excel",
      sizeBytes: 512,
    });
    expect(result.isError).toBe(true);
    const err = parseText(result);
    expect(err.error.code).toBe("INVALID_ASSET_TYPE");
  });
});

// ─── split_transcript_to_captions ─────────────────────────────────

import {
  handleSplitTranscriptToCaptions,
  handleGenerateVideoScript,
  handleCreateSceneSequence,
  handleUpdateScene,
  handleValidateTemplate,
} from "../handlers";

describe("MCP: split_transcript_to_captions", () => {
  it("splits a transcript into caption chunks", async () => {
    const result = await handleSplitTranscriptToCaptions({
      transcript: "Hello world this is a test of caption splitting",
      wordsPerCaption: 3,
      totalDurationFrames: 300,
    });
    expect(result.isError).toBeUndefined();
    const data = parseText(result);
    expect(Array.isArray(data.captions)).toBe(true);
    expect(data.captions.length).toBeGreaterThan(0);
    for (const c of data.captions) {
      expect(c).toHaveProperty("text");
      expect(c).toHaveProperty("startFrame");
      expect(c).toHaveProperty("endFrame");
      expect(c.startFrame).toBeGreaterThanOrEqual(0);
      expect(c.endFrame).toBeGreaterThanOrEqual(c.startFrame);
    }
  });

  it("rejects empty transcript", async () => {
    const result = await handleSplitTranscriptToCaptions({ transcript: "" });
    expect(result.isError).toBe(true);
    const err = parseText(result);
    expect(err.error.code).toBe("VALIDATION_ERROR");
  });
});

// ─── generate_video_script ────────────────────────────────────────

describe("MCP: generate_video_script", () => {
  it("generates scenes from a prompt", async () => {
    const result = await handleGenerateVideoScript({
      prompt: "A dog runs through a park. It finds a ball. It brings the ball back.",
      sceneCount: 3,
    });
    expect(result.isError).toBeUndefined();
    const data = parseText(result);
    expect(data.scenes).toHaveLength(3);
    for (const s of data.scenes) {
      expect(s).toHaveProperty("title");
      expect(s).toHaveProperty("body");
      expect(s).toHaveProperty("durationFrames");
    }
  });

  it("rejects empty prompt", async () => {
    const result = await handleGenerateVideoScript({ prompt: "" });
    expect(result.isError).toBe(true);
  });
});

// ─── create_scene_sequence ────────────────────────────────────────

describe("MCP: create_scene_sequence", () => {
  it("creates a project from scenes", async () => {
    const result = await handleCreateSceneSequence({
      templateId: "prompt-to-video",
      name: "Test Scene Sequence",
      scenes: [
        { title: "Scene 1", body: "First scene" },
        { title: "Scene 2", body: "Second scene" },
      ],
    });
    expect(result.isError).toBeUndefined();
    const project = parseText(result);
    expect(project.templateId).toBe("prompt-to-video");
    expect(project.name).toBe("Test Scene Sequence");
  });

  it("rejects wrong template ID", async () => {
    const result = await handleCreateSceneSequence({
      templateId: "wrong-template",
      name: "Test",
      scenes: [{ title: "S1", body: "text" }],
    });
    expect(result.isError).toBe(true);
    const err = parseText(result);
    expect(err.error.code).toBe("INVALID_TEMPLATE");
  });
});

// ─── update_scene ─────────────────────────────────────────────────

describe("MCP: update_scene", () => {
  it("updates a specific scene in a project", async () => {
    const createResult = await handleCreateSceneSequence({
      templateId: "prompt-to-video",
      name: "Update Test",
      scenes: [
        { title: "Scene 1", body: "Original text" },
        { title: "Scene 2", body: "Second scene" },
      ],
    });
    const project = parseText(createResult);

    const updateResult = await handleUpdateScene({
      projectId: project.id,
      sceneIndex: 0,
      sceneUpdates: { body: "Updated text" },
    });
    expect(updateResult.isError).toBeUndefined();
    const updated = parseText(updateResult);
    expect((updated.inputProps.scenes as any[])[0].body).toBe("Updated text");
  });

  it("rejects invalid scene index", async () => {
    const createResult = await handleCreateSceneSequence({
      templateId: "prompt-to-video",
      name: "Index Test",
      scenes: [{ title: "S1", body: "text" }],
    });
    const project = parseText(createResult);

    const result = await handleUpdateScene({
      projectId: project.id,
      sceneIndex: 99,
      sceneUpdates: { body: "nope" },
    });
    expect(result.isError).toBe(true);
    const err = parseText(result);
    expect(err.error.code).toBe("INVALID_SCENE_INDEX");
  });
});

// ─── validate_template ────────────────────────────────────────────

describe("MCP: validate_template", () => {
  it("validates a built-in template with defaults", async () => {
    const result = await handleValidateTemplate({
      templateId: "tiktok-caption",
    });
    expect(result.isError).toBeUndefined();
    const data = parseText(result);
    expect(data.valid).toBe(true);
    expect(data.frameCount).toBeGreaterThan(0);
  });

  it("returns error for unknown template", async () => {
    const result = await handleValidateTemplate({ templateId: "no-such-template" });
    expect(result.isError).toBe(true);
  });
});

// ─── Remotion MCP parity rule tools ───────────────────────────────────────

describe("MCP: Remotion rule tools", () => {
  it("read_me describes create_video and the rule tools", async () => {
    const result = await handleReadMe();
    expect(result.isError).toBeUndefined();
    expect(result.content[0].text).toContain("create_video");
    expect(result.content[0].text).toContain("rule_react_code");
  });

  it("rule tools return focused Remotion guidance", async () => {
    const results = await Promise.all([
      handleRuleReactCode(),
      handleRuleRemotionAnimations(),
      handleRuleRemotionTiming(),
      handleRuleRemotionSequencing(),
      handleRuleRemotionTransitions(),
      handleRuleRemotionTextAnimations(),
      handleRuleRemotionTrimming(),
    ]);

    const combined = results.map((result) => result.content[0].text).join("\n\n");
    expect(combined).toContain("useCurrentFrame");
    expect(combined).toContain("TransitionSeries");
    expect(combined).toContain("durationInFrames");
  });
});

// ─── create_video ─────────────────────────────────────────────────────────

describe("MCP: create_video", () => {
  it("creates a compiled project with structuredContent", async () => {
    const result = await handleCreateVideo({
      files: JSON.stringify({
        "/src/Video.tsx": `import {AbsoluteFill} from "remotion";\nexport default function Video(){return <AbsoluteFill style={{backgroundColor:"black"}} />;}`,
      }),
      title: "Hello Video",
    });

    expect(result.isError).toBeUndefined();
    expect(result.content[0].text).toContain('Created video project "Hello Video".');

    const project = parseVideoProject(result);
    expect(project.meta.title).toBe("Hello Video");
    expect(project.meta.compositionId).toBe("Main");
    expect(project.bundle).toContain("__REMOTION_MCP_BUNDLE");
    expect(project.compileError).toBeUndefined();
  });

  it("merges changed files with the previous session project", async () => {
    const sessionId = "session-merge-test";

    const initial = await handleCreateVideo(
      {
        files: JSON.stringify({
          "/src/Video.tsx": `import {AbsoluteFill} from "remotion";\nimport {Title} from "./components/Title";\nexport default function Video(){return <AbsoluteFill><Title /></AbsoluteFill>;}`,
          "/src/components/Title.tsx": `export function Title(){return <div>Original</div>;}`,
        }),
      },
      { sessionId },
    );
    expect(initial.isError).toBeUndefined();

    const update = await handleCreateVideo(
      {
        files: JSON.stringify({
          "/src/components/Title.tsx": `export function Title(){return <div>Updated</div>;}`,
        }),
      },
      { sessionId },
    );

    expect(update.isError).toBeUndefined();
    expect(update.content[0].text).toContain("Merged with previous project.");

    const project = parseVideoProject(update);
    expect(project.compileError).toBeUndefined();
  });

  it("merges slot props across calls", async () => {
    const sessionId = "session-props-test";

    await handleCreateVideo(
      {
        files: JSON.stringify({
          "/src/Video.tsx": `import {AbsoluteFill} from "remotion";\nexport default function Video(props){return <AbsoluteFill>{props.title} {props.subtitle}</AbsoluteFill>;}`,
        }),
        defaultProps: { title: "Hello" },
      },
      { sessionId },
    );

    const result = await handleCreateVideo(
      {
        files: JSON.stringify({
          "/src/Video.tsx": `import {AbsoluteFill} from "remotion";\nexport default function Video(props){return <AbsoluteFill>{props.title} {props.subtitle}</AbsoluteFill>;}`,
        }),
        inputProps: { subtitle: "World" },
      },
      { sessionId },
    );

    expect(result.isError).toBeUndefined();
    const project = parseVideoProject(result);
    expect(project.defaultProps.title).toBe("Hello");
    expect(project.inputProps.subtitle).toBe("World");
  });

  it("returns a structured error for invalid files JSON", async () => {
    const result = await handleCreateVideo({ files: "not-json" });
    expect(result.isError).toBe(true);
    const err = parseText(result);
    expect(err.error.code).toBe("INVALID_FILES_JSON");
  });

  it("persists generated videos into Studio projects when the runtime has a Studio API", async () => {
    const savedProjects = new Map<string, Record<string, unknown>>();
    let projectCounter = 0;

    const runtime = {
      previewBaseUrl: "http://localhost:3000",
      studioApi: {
        async createProject(input: Record<string, unknown>) {
          const projectId = `project-${++projectCounter}`;
          const project = {
            id: projectId,
            name: input.name,
            templateId: input.templateId,
            inputProps: input.inputProps,
            aspectRatio: { preset: input.aspectRatio, width: 1920, height: 1080 },
            exportFormat: {
              codec: "h264",
              fileExtension: ".mp4",
              crf: 18,
              fps: 30,
              scale: 1,
            },
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            version: 1,
          };
          savedProjects.set(projectId, project);
          return project;
        },
        async updateProject(projectId: string, input: Record<string, unknown>) {
          const existing = savedProjects.get(projectId);
          if (!existing) {
            const error = new Error("Project not found") as Error & { status: number };
            error.status = 404;
            throw error;
          }

          const updated = {
            ...existing,
            name: input.name ?? existing.name,
            inputProps: input.inputProps ?? existing.inputProps,
            updatedAt: new Date().toISOString(),
            version: ((existing.version as number | undefined) ?? 1) + 1,
          };
          savedProjects.set(projectId, updated);
          return updated;
        },
      },
    } as any;

    const sessionId = "create-video-persist-test";
    const firstResult = await handleCreateVideo(
      {
        files: JSON.stringify({
          "/src/Video.tsx": `import {AbsoluteFill} from "remotion";\nexport default function Video(props){return <AbsoluteFill>{props.title}</AbsoluteFill>;}`,
        }),
        title: "Persisted Video",
        defaultProps: { title: "Hello" },
      },
      { sessionId },
      runtime,
    );

    expect(firstResult.isError).toBeUndefined();
    expect(firstResult.content[0].text).toContain("Saved Studio project");
    expect(firstResult.structuredContent?.projectId).toBe("project-1");
    expect(firstResult.structuredContent?.previewUrl).toBe(
      "http://localhost:3000/editor/dynamic-video/project-1",
    );

    const firstProject = parseVideoProject(firstResult);
    expect(firstProject.sourceProject.entryFile).toBe("/src/Video.tsx");
    expect(
      (savedProjects.get("project-1")?.inputProps as Record<string, any>).meta.title,
    ).toBe("Persisted Video");

    const secondResult = await handleCreateVideo(
      {
        files: JSON.stringify({
          "/src/Video.tsx": `import {AbsoluteFill} from "remotion";\nexport default function Video(props){return <AbsoluteFill>{props.title} again</AbsoluteFill>;}`,
        }),
      },
      { sessionId },
      runtime,
    );

    expect(secondResult.isError).toBeUndefined();
    expect(secondResult.structuredContent?.projectId).toBe("project-1");
    expect(secondResult.content[0].text).toContain("Saved Studio project");
    expect((savedProjects.get("project-1")?.version as number | undefined) ?? 0).toBe(2);

    const branchedResult = await handleCreateVideo(
      {
        files: JSON.stringify({
          "/src/Video.tsx": `import {AbsoluteFill} from "remotion";\nexport default function Video(props){return <AbsoluteFill>{props.title} branch</AbsoluteFill>;}`,
        }),
        inputProps: { title: "Variant" },
        persistAsNew: true,
      },
      { sessionId },
      runtime,
    );

    expect(branchedResult.isError).toBeUndefined();
    expect(branchedResult.structuredContent?.projectId).toBe("project-2");
    expect(savedProjects.size).toBe(2);
  });
});
