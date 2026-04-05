import { describe, it, expect, beforeEach } from "vitest";
import {
  handleListTemplates,
  handleCreateProject,
  handleUpdateProject,
  handleGetProject,
  handleListProjects,
  handleRenderProject,
  handleGetRenderStatus,
  handleExportFormats,
  clearStores,
  projectStore,
  renderJobStore,
} from "../handlers";

// Clear stores between tests to prevent state leakage
beforeEach(() => clearStores());

// ─── Helper ───────────────────────────────────────────────────────

function parseText(result: { content: { type: string; text: string }[] }) {
  return JSON.parse(result.content[0].text);
}

// ─── list_templates ───────────────────────────────────────────────

describe("MCP: list_templates", () => {
  it("returns an array of 5 templates", async () => {
    const result = await handleListTemplates();
    expect(result.isError).toBeUndefined();
    const templates = parseText(result);
    expect(Array.isArray(templates)).toBe(true);
    expect(templates).toHaveLength(5);
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
    expect(project.aspectRatio.preset).toBe("16:9");
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
      aspectRatio: "9:16",
    });
    const project = parseText(result);
    expect(project.aspectRatio.preset).toBe("9:16");
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
      await handleUpdateProject({ projectId: created.id, aspectRatio: "1:1" }),
    );
    expect(updated.aspectRatio.preset).toBe("1:1");
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
    expect(job.templateId).toBe("history-storyline");
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
      aspectRatio: "4:5",
    });
    expect(createResult.isError).toBeUndefined();
    const project = parseText(createResult);
    expect(project.aspectRatio.preset).toBe("4:5");

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
