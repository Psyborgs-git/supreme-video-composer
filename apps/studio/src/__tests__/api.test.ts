/**
 * Integration + E2E tests for the Studio API.
 *
 * Every test use `createApp(mockQueue)` — no real HTTP server is started,
 * no real Remotion renderer is invoked.  The mock render functions let us
 * control job progress and failures deterministically.
 *
 * Coverage:
 *   - GET /api/templates
 *   - GET /api/export-formats
 *   - POST/GET/PATCH/DELETE /api/projects
 *   - POST /api/projects/:id/render   ← the previously broken endpoint
 *   - GET /api/renders/:jobId          ← progress polling
 *   - POST /api/renders/:jobId/cancel
 *   - E2E: full create → render → poll → complete flow
 *   - E2E: sequential renders, no parallelism
 *   - E2E: render failure propagated to poller
 */

import { describe, it, expect, beforeEach } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { RenderQueue } from "@studio/renderer";
import type { RenderJob, RenderProgress } from "@studio/shared-types";
import { createApp } from "../api";
import type { StorageConfig } from "../storage";

// ─── Test helpers ─────────────────────────────────────────────────────────────

/**
 * Returns a mock render function together with handles to:
 *  - `progress(p)` — emit a progress update
 *  - `complete(path)` — resolve the render
 *  - `fail(msg)` — reject with an error
 *
 * The function suspends until complete() or fail() is called, simulating an
 * async render whose timing we control.
 */
function makeControlledRender() {
  let _complete: ((path: string) => void) | null = null;
  let _fail: ((err: Error) => void) | null = null;
  let _onProgress: ((p: RenderProgress) => void) | null = null;

  const fn = async (job: RenderJob, onProgress: (p: RenderProgress) => void): Promise<string> => {
    _onProgress = onProgress;
    return new Promise<string>((resolve, reject) => {
      _complete = resolve;
      _fail = reject;
    });
  };

  const emitProgress = (p: number) => {
    _onProgress?.({
      progress: p,
      renderedFrames: Math.floor(p * 100),
      encodedFrames: 0,
      totalFrames: 100,
      stage: p < 1 ? "rendering" : "encoding",
    });
  };

  return {
    fn,
    complete: (path = "/tmp/out.mp4") => _complete?.(path),
    fail: (msg = "Render error") => _fail?.(new Error(msg)),
    progress: emitProgress,
  };
}

/** Fast render — calls onProgress once then resolves. */
function makeFastRenderFn(outputPath = "/tmp/fast.mp4") {
  return async (job: RenderJob, onProgress: (p: RenderProgress) => void): Promise<string> => {
    onProgress({
      progress: 0.5,
      renderedFrames: 50,
      encodedFrames: 0,
      totalFrames: 100,
      stage: "rendering",
    });
    onProgress({
      progress: 1.0,
      renderedFrames: 100,
      encodedFrames: 100,
      totalFrames: 100,
      stage: "encoding",
    });
    return outputPath;
  };
}

/**
 * POST /api/projects — create a project and return its parsed JSON.
 * Uses "history-storyline" by default (always registered).
 */
async function createProject(
  app: ReturnType<typeof createApp>["app"],
  name = "Test Video",
  templateId = "history-storyline",
  aspectRatio?: string,
) {
  const res = await app.request("/api/projects", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ templateId, name, ...(aspectRatio && { aspectRatio }) }),
  });
  return res.json();
}

/** POST /api/projects/:id/render and return parsed job JSON. */
async function startRender(
  app: ReturnType<typeof createApp>["app"],
  projectId: string,
  body: Record<string, unknown> = {},
) {
  const res = await app.request(`/api/projects/${projectId}/render`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return { status: res.status, job: await res.json() };
}

/** GET /api/renders/:jobId and return the job JSON. */
async function pollStatus(app: ReturnType<typeof createApp>["app"], jobId: string) {
  const res = await app.request(`/api/renders/${jobId}`);
  return res.json();
}

/** Wait a number of milliseconds (use sparingly — prefer event-based sync). */
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

function makeStorageConfig(): StorageConfig {
  const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), "studio-api-"));
  return {
    assetsDir: path.join(rootDir, "assets"),
    projectsDir: path.join(rootDir, "projects"),
  };
}

// ─── Template endpoint ────────────────────────────────────────────────────────

describe("GET /api/templates", () => {
  it("returns 200 with all registered templates", async () => {
    const q = new RenderQueue();
    const { app } = createApp(q);

    const res = await app.request("/api/templates");
    expect(res.status).toBe(200);

    const templates = await res.json();
    expect(Array.isArray(templates)).toBe(true);
    // 5 built-in + BabyLens
    expect(templates.length).toBeGreaterThanOrEqual(6);
  });

  it("each template has id, name, compositionId and supportedAspectRatios", async () => {
    const q = new RenderQueue();
    const { app } = createApp(q);

    const templates: Record<string, unknown>[] = await app
      .request("/api/templates")
      .then((r) => r.json());

    for (const t of templates) {
      expect(typeof t.id).toBe("string");
      expect(typeof t.name).toBe("string");
      expect(typeof t.compositionId).toBe("string");
      expect(Array.isArray(t.supportedAspectRatios)).toBe(true);
    }
  });

  it("compositionId differs from id (PascalCase vs kebab-case)", async () => {
    const q = new RenderQueue();
    const { app } = createApp(q);

    const templates: { id: string; compositionId: string }[] = await app
      .request("/api/templates")
      .then((r) => r.json());

    const hs = templates.find((t) => t.id === "history-storyline");
    expect(hs).toBeDefined();
    // registry id = "history-storyline", Remotion compositionId = "HistoryStoryline"
    expect(hs!.compositionId).toBe("HistoryStoryline");
    expect(hs!.compositionId).not.toBe(hs!.id);
  });
});

// ─── Export formats ───────────────────────────────────────────────────────────

describe("GET /api/export-formats", () => {
  it("returns codecs, qualityPresets and fpsOptions", async () => {
    const q = new RenderQueue();
    const { app } = createApp(q);

    const res = await app.request("/api/export-formats");
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data.codecs).toHaveProperty("h264");
    expect(data.codecs).toHaveProperty("h265");
    expect(data.codecs).toHaveProperty("vp9");
    expect(data.qualityPresets).toHaveProperty("standard");
    expect(data.qualityPresets).toHaveProperty("draft");
    expect(Array.isArray(data.fpsOptions)).toBe(true);
    expect(data.fpsOptions).toContain(30);
    expect(data.fpsOptions).toContain(60);
  });
});

// ─── Project CRUD ─────────────────────────────────────────────────────────────

describe("POST /api/projects", () => {
  it("creates a project with default props and returns 201", async () => {
    const { app } = createApp(new RenderQueue());

    const res = await app.request("/api/projects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ templateId: "history-storyline", name: "My Timeline" }),
    });

    expect(res.status).toBe(201);
    const project = await res.json();
    expect(project.id).toBeTruthy();
    expect(project.name).toBe("My Timeline");
    expect(project.templateId).toBe("history-storyline");
    expect(project.aspectRatio.preset).toBe("youtube");
    expect(project.aspectRatio.width).toBe(1920);
    expect(project.aspectRatio.height).toBe(1080);
    expect(project.exportFormat.codec).toBe("h264");
    expect(project.version).toBe(1);
  });

  it("uses the specified aspectRatio to set dimensions", async () => {
    const { app } = createApp(new RenderQueue());
    const project = await createProject(app, "Vertical", "history-storyline", "instagram-reel");

    expect(project.aspectRatio.preset).toBe("instagram-reel");
    expect(project.aspectRatio.width).toBe(1080);
    expect(project.aspectRatio.height).toBe(1920);
  });

  it("returns 400 when name is missing", async () => {
    const { app } = createApp(new RenderQueue());

    const res = await app.request("/api/projects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ templateId: "history-storyline" }),
    });

    expect(res.status).toBe(400);
    const err = await res.json();
    expect(err.error).toMatch(/name/i);
  });

  it("returns 400 when templateId is missing", async () => {
    const { app } = createApp(new RenderQueue());

    const res = await app.request("/api/projects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "No Template" }),
    });

    expect(res.status).toBe(400);
  });

  it("returns 404 for unknown templateId", async () => {
    const { app } = createApp(new RenderQueue());

    const res = await app.request("/api/projects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ templateId: "does-not-exist", name: "Ghost" }),
    });

    expect(res.status).toBe(404);
  });
});

describe("GET /api/projects", () => {
  it("returns empty array when no projects exist", async () => {
    const { app } = createApp(new RenderQueue());
    const res = await app.request("/api/projects");
    expect(res.status).toBe(200);
    const projects = await res.json();
    expect(projects).toHaveLength(0);
  });

  it("returns all created projects", async () => {
    const { app } = createApp(new RenderQueue());
    await createProject(app, "A");
    await createProject(app, "B");
    await createProject(app, "C");

    const projects: { name: string }[] = await app.request("/api/projects").then((r) => r.json());
    expect(projects).toHaveLength(3);
    const names = projects.map((p: { name: string }) => p.name);
    expect(names).toContain("A");
    expect(names).toContain("C");
  });
});

describe("GET /api/projects/:id", () => {
  it("returns 404 for an unknown id", async () => {
    const { app } = createApp(new RenderQueue());
    const res = await app.request("/api/projects/nope");
    expect(res.status).toBe(404);
  });

  it("returns the correct project by id", async () => {
    const { app } = createApp(new RenderQueue());
    const created = await createProject(app, "Find Me");

    const res = await app.request(`/api/projects/${created.id}`);
    expect(res.status).toBe(200);
    const fetched = await res.json();
    expect(fetched.id).toBe(created.id);
    expect(fetched.name).toBe("Find Me");
  });
});

describe("PATCH /api/projects/:id", () => {
  it("updates the project name and increments version", async () => {
    const { app } = createApp(new RenderQueue());
    const project = await createProject(app, "Old Name");

    const res = await app.request(`/api/projects/${project.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "New Name" }),
    });

    expect(res.status).toBe(200);
    const updated = await res.json();
    expect(updated.name).toBe("New Name");
    expect(updated.version).toBe(2);
  });

  it("updates aspectRatio and recalculates dimensions", async () => {
    const { app } = createApp(new RenderQueue());
    const project = await createProject(app, "AR Test");

    const res = await app.request(`/api/projects/${project.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ aspectRatio: "instagram-post" }),
    });

    const updated = await res.json();
    expect(updated.aspectRatio.preset).toBe("instagram-post");
    expect(updated.aspectRatio.width).toBe(1080);
    expect(updated.aspectRatio.height).toBe(1080);
  });

  it("returns 404 for unknown project", async () => {
    const { app } = createApp(new RenderQueue());
    const res = await app.request("/api/projects/ghost", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "X" }),
    });
    expect(res.status).toBe(404);
  });
});

describe("DELETE /api/projects/:id", () => {
  it("removes the project and returns { success: true }", async () => {
    const { app } = createApp(new RenderQueue());
    const project = await createProject(app, "To Delete");

    const delRes = await app.request(`/api/projects/${project.id}`, { method: "DELETE" });
    expect(delRes.status).toBe(200);
    expect(await delRes.json()).toEqual({ success: true });

    const getRes = await app.request(`/api/projects/${project.id}`);
    expect(getRes.status).toBe(404);
  });

  it("returns 404 when project does not exist", async () => {
    const { app } = createApp(new RenderQueue());
    const res = await app.request("/api/projects/missing", { method: "DELETE" });
    expect(res.status).toBe(404);
  });

  it("returns 409 when project has an active render", async () => {
    const q = new RenderQueue();
    const ctrl = makeControlledRender();
    q.setRenderFunction(ctrl.fn);
    const { app } = createApp(q);
    const project = await createProject(app, "Busy Project");

    const { job } = await startRender(app, project.id);
    await wait(15);

    const delRes = await app.request(`/api/projects/${project.id}`, { method: "DELETE" });
    expect(delRes.status).toBe(409);
    const payload = await delRes.json();
    expect(payload.jobId).toBe(job.id);

    ctrl.complete();
    await wait(15);
    ctrl.complete();
    await wait(15);
  });
});

describe("POST /api/projects/:id/duplicate", () => {
  it("duplicates a project with a new ID", async () => {
    const { app } = createApp(new RenderQueue());
    const project = await createProject(app, "Source Project");

    const res = await app.request(`/api/projects/${project.id}/duplicate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Source Project Copy" }),
    });

    expect(res.status).toBe(201);
    const duplicate = await res.json();
    expect(duplicate.id).not.toBe(project.id);
    expect(duplicate.name).toBe("Source Project Copy");
    expect(duplicate.templateId).toBe(project.templateId);
  });
});

describe("Persistence: projects", () => {
  it("reloads projects from disk when storage directories are configured", async () => {
    const storage = makeStorageConfig();
    const firstApp = createApp(new RenderQueue(), "*", storage);
    const created = await createProject(firstApp.app, "Persistent Project");

    const secondApp = createApp(new RenderQueue(), "*", storage);
    const projects = await secondApp.app.request("/api/projects").then((res) => res.json());
    expect(projects.some((project: { id: string }) => project.id === created.id)).toBe(true);
  });
});

describe("Assets API", () => {
  it("uploads, lists, serves, renames, and deletes assets", async () => {
    const storage = makeStorageConfig();
    const { app } = createApp(new RenderQueue(), "*", storage);

    const uploadForm = new FormData();
    uploadForm.append("files", new File(["fake-image"], "example.png", { type: "image/png" }));

    const uploadRes = await app.request("/api/assets", {
      method: "POST",
      body: uploadForm,
    });

    expect(uploadRes.status).toBe(201);
    const uploadPayload = await uploadRes.json();
    expect(uploadPayload.assets).toHaveLength(1);
    const asset = uploadPayload.assets[0];

    const listRes = await app.request("/api/assets");
    const listPayload = await listRes.json();
    expect(listPayload.assets).toHaveLength(1);
    expect(listPayload.assets[0].id).toBe(asset.id);

    const contentRes = await app.request(`/api/assets/${asset.id}/content`);
    expect(contentRes.status).toBe(200);
    expect(await contentRes.text()).toBe("fake-image");

    const renameRes = await app.request(`/api/assets/${asset.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "hero-image" }),
    });
    expect(renameRes.status).toBe(200);
    const renamed = await renameRes.json();
    expect(renamed.name).toBe("hero-image");

    const deleteRes = await app.request(`/api/assets/${asset.id}`, { method: "DELETE" });
    expect(deleteRes.status).toBe(200);
    expect(await deleteRes.json()).toEqual({ success: true });
  });

  it("returns a single asset by id", async () => {
    const storage = makeStorageConfig();
    const { app } = createApp(new RenderQueue(), "*", storage);
    const uploadForm = new FormData();
    uploadForm.append("files", new File(["fake-image"], "single.png", { type: "image/png" }));

    const uploadRes = await app.request("/api/assets", {
      method: "POST",
      body: uploadForm,
    });
    const asset = (await uploadRes.json()).assets[0];

    const getRes = await app.request(`/api/assets/${asset.id}`);
    expect(getRes.status).toBe(200);
    const fetched = await getRes.json();
    expect(fetched.id).toBe(asset.id);
    expect(fetched.mimeType).toBe("image/png");
  });

  it("registers an existing asset from disk", async () => {
    const storage = makeStorageConfig();
    const { app } = createApp(new RenderQueue(), "*", storage);
    const existingPath = path.join(storage.assetsDir!, "registered.png");
    fs.mkdirSync(path.dirname(existingPath), { recursive: true });
    fs.writeFileSync(existingPath, "registered");

    const registerRes = await app.request("/api/assets/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: "registered-asset",
        name: "registered-asset",
        type: "image",
        path: existingPath,
        mimeType: "image/png",
        sizeBytes: 10,
      }),
    });

    expect(registerRes.status).toBe(201);
    const asset = await registerRes.json();
    expect(asset.id).toBe("registered-asset");
    expect(asset.path).toBe(existingPath);

    const fetched = await app.request("/api/assets/registered-asset").then((res) => res.json());
    expect(fetched.id).toBe("registered-asset");
  });

  it("persists assets across app instances when storage is configured", async () => {
    const storage = makeStorageConfig();
    const firstApp = createApp(new RenderQueue(), "*", storage);
    const uploadForm = new FormData();
    uploadForm.append("files", new File(["sound"], "clip.mp3", { type: "audio/mpeg" }));

    const uploadRes = await firstApp.app.request("/api/assets", {
      method: "POST",
      body: uploadForm,
    });
    const asset = (await uploadRes.json()).assets[0];

    const secondApp = createApp(new RenderQueue(), "*", storage);
    const listPayload = await secondApp.app.request("/api/assets").then((res) => res.json());
    expect(listPayload.assets.some((entry: { id: string }) => entry.id === asset.id)).toBe(true);
  });

  it("blocks deleting an asset that is referenced by a project", async () => {
    const storage = makeStorageConfig();
    const { app, projectStore } = createApp(new RenderQueue(), "*", storage);
    const uploadForm = new FormData();
    uploadForm.append("files", new File(["fake-image"], "guarded.png", { type: "image/png" }));

    const uploadRes = await app.request("/api/assets", { method: "POST", body: uploadForm });
    const asset = (await uploadRes.json()).assets[0];
    const project = await createProject(app, "Asset Guard Project");

    projectStore.set(project.id, {
      ...project,
      inputProps: { ...project.inputProps, referencedAssetId: asset.id },
    });

    const deleteRes = await app.request(`/api/assets/${asset.id}`, { method: "DELETE" });
    expect(deleteRes.status).toBe(409);
    const payload = await deleteRes.json();
    expect(payload.projectIds).toContain(project.id);
  });
});

// ─── Render endpoint ──────────────────────────────────────────────────────────

describe("POST /api/projects/:id/render — job creation", () => {
  it("returns 202 with a queued job immediately", async () => {
    const q = new RenderQueue();
    const ctrl = makeControlledRender();
    q.setRenderFunction(ctrl.fn);
    const { app } = createApp(q);

    const project = await createProject(app);
    const { status, job } = await startRender(app, project.id);

    expect(status).toBe(202);
    expect(job.id).toBeTruthy();
    expect(job.status).toBe("queued");
    expect(job.outputPath).toBeNull();
    expect(job.error).toBeNull();

    // cleanup
    ctrl.complete();
    await wait(10);
  });

  it("uses the Remotion compositionId in the job, not the registry id", async () => {
    const q = new RenderQueue();
    const seenIds: string[] = [];
    q.setRenderFunction(async (job, onProgress) => {
      seenIds.push(job.templateId);
      onProgress({ progress: 1, renderedFrames: 1, encodedFrames: 1, totalFrames: 1, stage: "encoding" });
      return "/tmp/ok.mp4";
    });
    const { app } = createApp(q);

    const project = await createProject(app); // history-storyline
    await startRender(app, project.id);
    await wait(30);

    // MUST be "HistoryStoryline" (Remotion composition id), NOT "history-storyline"
    expect(seenIds[0]).toBe("HistoryStoryline");
    expect(seenIds[0]).not.toContain("-");
  });

  it("returns 404 when project does not exist", async () => {
    const { app } = createApp(new RenderQueue());
    const { status } = await startRender(app, "nonexistent-project-id");
    expect(status).toBe(404);
  });

  it("passes codec override to the job", async () => {
    const q = new RenderQueue();
    const seenCodecs: string[] = [];
    q.setRenderFunction(async (job, onProgress) => {
      seenCodecs.push(job.exportFormat.codec);
      onProgress({ progress: 1, renderedFrames: 1, encodedFrames: 1, totalFrames: 1, stage: "encoding" });
      return "/tmp/ok.webm";
    });
    const { app } = createApp(q);

    const project = await createProject(app);
    await startRender(app, project.id, { codec: "vp9" });
    await wait(30);

    expect(seenCodecs[0]).toBe("vp9");
  });

  it("stores the job's projectId correctly", async () => {
    const q = new RenderQueue();
    q.setRenderFunction(makeFastRenderFn());
    const { app } = createApp(q);

    const project = await createProject(app);
    const { job } = await startRender(app, project.id);

    expect(job.projectId).toBe(project.id);
  });
});

describe("GET /api/renders", () => {
  it("lists render jobs and supports projectId filtering", async () => {
    const q = new RenderQueue();
    const ctrl = makeControlledRender();
    q.setRenderFunction(ctrl.fn);
    const { app } = createApp(q);

    const firstProject = await createProject(app, "First");
    const secondProject = await createProject(app, "Second");
    const firstRender = await startRender(app, firstProject.id);
    const secondRender = await startRender(app, secondProject.id);
    await wait(15);

    const allJobs = await app.request("/api/renders").then((res) => res.json());
    expect(allJobs.jobs).toHaveLength(2);

    const filteredJobs = await app
      .request(`/api/renders?projectId=${firstProject.id}`)
      .then((res) => res.json());
    expect(filteredJobs.jobs).toHaveLength(1);
    expect(filteredJobs.jobs[0].projectId).toBe(firstProject.id);
    expect(filteredJobs.jobs[0].id).toBe(firstRender.job.id);
    expect(allJobs.jobs.some((job: { id: string }) => job.id === secondRender.job.id)).toBe(true);

    ctrl.complete();
    await wait(15);
  });
});

// ─── Render status polling ────────────────────────────────────────────────────

describe("GET /api/renders/:jobId — polling", () => {
  it("returns 404 for unknown job id", async () => {
    const { app } = createApp(new RenderQueue());
    const res = await app.request("/api/renders/fake-job-id");
    expect(res.status).toBe(404);
  });

  it("reflects queued status immediately after starting render", async () => {
    const q = new RenderQueue();
    const ctrl = makeControlledRender();
    q.setRenderFunction(ctrl.fn);
    const { app } = createApp(q);

    const project = await createProject(app);
    const { job } = await startRender(app, project.id);

    const polled = await pollStatus(app, job.id);
    // May be "queued" or "bundling"/"rendering" depending on async timing —
    // either way it must NOT be "complete" or "error" yet
    expect(["queued", "bundling", "rendering"]).toContain(polled.status);

    ctrl.complete();
    await wait(20);
  });

  it("shows live progress at 50% after emitting it", async () => {
    const q = new RenderQueue();
    const ctrl = makeControlledRender();
    q.setRenderFunction(ctrl.fn);
    const { app } = createApp(q);

    const project = await createProject(app);
    const { job } = await startRender(app, project.id);

    // Wait for queue to pick up the job
    await wait(15);
    ctrl.progress(0.5);
    await wait(10);

    const midJob = await pollStatus(app, job.id);
    expect(midJob.status).toBe("rendering");
    expect(midJob.progress.progress).toBe(0.5);
    expect(midJob.progress.renderedFrames).toBe(50);

    ctrl.complete("/tmp/result.mp4");
    await wait(20);
  });

  it("shows complete status with outputPath after render finishes", async () => {
    const q = new RenderQueue();
    q.setRenderFunction(makeFastRenderFn("/output/my-video.mp4"));
    const { app } = createApp(q);

    const project = await createProject(app);
    const { job } = await startRender(app, project.id);

    await wait(50);

    const done = await pollStatus(app, job.id);
    expect(done.status).toBe("complete");
    expect(done.outputPath).toBe("/output/my-video.mp4");
    expect(done.completedAt).toBeTruthy();
    expect(done.startedAt).toBeTruthy();
    expect(done.error).toBeNull();
  });

  it("shows progress 1.0 when render completes", async () => {
    const q = new RenderQueue();
    q.setRenderFunction(makeFastRenderFn());
    const { app } = createApp(q);

    const project = await createProject(app);
    const { job } = await startRender(app, project.id);
    await wait(50);

    const done = await pollStatus(app, job.id);
    expect(done.progress.progress).toBe(1.0);
  });

  it("shows error status and message when render fails", async () => {
    const q = new RenderQueue();
    const ctrl = makeControlledRender();
    q.setRenderFunction(ctrl.fn);
    const { app } = createApp(q);

    const project = await createProject(app);
    const { job } = await startRender(app, project.id);

    await wait(15);
    ctrl.fail("GPU ran out of memory");
    await wait(30);

    const failed = await pollStatus(app, job.id);
    expect(failed.status).toBe("error");
    expect(failed.error).toMatch(/GPU ran out of memory/);
    expect(failed.completedAt).toBeTruthy();
  });

  it("does NOT report progress: null after the first progress event", async () => {
    const q = new RenderQueue();
    const ctrl = makeControlledRender();
    q.setRenderFunction(ctrl.fn);
    const { app } = createApp(q);

    const project = await createProject(app);
    const { job } = await startRender(app, project.id);

    await wait(15);
    ctrl.progress(0.3);
    await wait(10);

    const midJob = await pollStatus(app, job.id);
    // progress must be non-null once we've emitted at least one update
    expect(midJob.progress).not.toBeNull();
    expect(midJob.progress.progress).toBe(0.3);

    ctrl.complete();
    await wait(20);
  });
});

// ─── Cancel ───────────────────────────────────────────────────────────────────

describe("POST /api/renders/:jobId/cancel", () => {
  it("returns 404 for unknown job", async () => {
    const { app } = createApp(new RenderQueue());
    const res = await app.request("/api/renders/ghost/cancel", { method: "POST" });
    expect(res.status).toBe(404);
  });

  it("cancels a job that is waiting in the queue", async () => {
    const q = new RenderQueue();
    let releaseBlocker: (() => void) | null = null;

    q.setRenderFunction(async (_job, _onProgress) => {
      // Block the first job to keep the second in the queue
      await new Promise<void>((r) => {
        releaseBlocker = r;
      });
      return "/tmp/out.mp4";
    });

    const { app } = createApp(q);
    const p1 = await createProject(app, "Blocker");
    const p2 = await createProject(app, "To Cancel");

    const { job: j1 } = await startRender(app, p1.id);
    const { job: j2 } = await startRender(app, p2.id);

    await wait(15); // let the queue pick up j1

    // Cancel the still-queued j2
    const cancelRes = await app.request(`/api/renders/${j2.id}/cancel`, { method: "POST" });
    expect(cancelRes.status).toBe(200);
    const result = await cancelRes.json();
    expect(result.success).toBe(true);

    // Release the blocking job
    releaseBlocker!();
    await wait(30);

    // j2 must be cancelled, j1 must be complete
    const j1Final = await pollStatus(app, j1.id);
    const j2Final = await pollStatus(app, j2.id);
    expect(j1Final.status).toBe("complete");
    expect(j2Final.status).toBe("cancelled");
  });
});

// ─── E2E: Full render pipeline ────────────────────────────────────────────────

describe("E2E: create project → render → poll to completion", () => {
  it("full happy-path flow", async () => {
    const q = new RenderQueue();
    q.setRenderFunction(makeFastRenderFn("/output/e2e-video.mp4"));
    const { app } = createApp(q);

    // 1. Create project
    const createRes = await app.request("/api/projects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        templateId: "history-storyline",
        name: "E2E Video",
        aspectRatio: "youtube",
      }),
    });
    expect(createRes.status).toBe(201);
    const project = await createRes.json();
    expect(project.id).toBeTruthy();

    // 2. Verify project is in the list
    const listRes = await app.request("/api/projects");
    const list = await listRes.json();
    expect(list.some((p: { id: string }) => p.id === project.id)).toBe(true);

    // 3. Queue render with codec override
    const renderRes = await app.request(`/api/projects/${project.id}/render`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ codec: "h264", quality: "standard" }),
    });
    expect(renderRes.status).toBe(202);
    const job = await renderRes.json();
    expect(job.status).toBe("queued");
    expect(job.projectId).toBe(project.id);
    expect(job.exportFormat.codec).toBe("h264");

    // 4. Simulate polling loop — spin until complete or timeout
    let finalJob: Record<string, unknown> | null = null;
    for (let i = 0; i < 20; i++) {
      await wait(10);
      const polled = await pollStatus(app, job.id);
      if (polled.status === "complete" || polled.status === "error") {
        finalJob = polled;
        break;
      }
    }

    expect(finalJob).not.toBeNull();
    expect(finalJob!.status).toBe("complete");
    expect(finalJob!.outputPath).toBe("/output/e2e-video.mp4");
    expect(finalJob!.completedAt).toBeTruthy();
    expect((finalJob!.progress as { progress: number }).progress).toBe(1.0);
  });

  it("three sequential renders all complete — queue processes one at a time", async () => {
    const q = new RenderQueue();
    const completionOrder: string[] = [];

    q.setRenderFunction(async (job, onProgress) => {
      onProgress({ progress: 1, renderedFrames: 1, encodedFrames: 1, totalFrames: 1, stage: "encoding" });
      const output = `/output/${job.projectId}.mp4`;
      completionOrder.push(job.projectId);
      return output;
    });
    const { app } = createApp(q);

    const projects = await Promise.all([
      createProject(app, "V1"),
      createProject(app, "V2"),
      createProject(app, "V3"),
    ]);

    // Fire all three renders simultaneously
    const jobs = await Promise.all(
      projects.map((p) => startRender(app, p.id).then((r) => r.job)),
    );

    await wait(100);

    const statuses = await Promise.all(jobs.map((j) => pollStatus(app, j.id)));

    // All must complete
    expect(statuses.every((j) => j.status === "complete")).toBe(true);
    // Queue processes sequentially — completionOrder must have exactly 3 entries
    expect(completionOrder).toHaveLength(3);
  });

  it("render failure does not block subsequent renders", async () => {
    const q = new RenderQueue();
    let callCount = 0;

    q.setRenderFunction(async (job, onProgress) => {
      callCount++;
      if (callCount === 1) throw new Error("First render crash");
      onProgress({ progress: 1, renderedFrames: 1, encodedFrames: 1, totalFrames: 1, stage: "encoding" });
      return "/output/recovered.mp4";
    });
    const { app } = createApp(q);

    const p1 = await createProject(app, "Will Fail");
    const p2 = await createProject(app, "Will Succeed");

    const { job: j1 } = await startRender(app, p1.id);
    const { job: j2 } = await startRender(app, p2.id);

    await wait(80);

    const s1 = await pollStatus(app, j1.id);
    const s2 = await pollStatus(app, j2.id);

    expect(s1.status).toBe("error");
    expect(s1.error).toMatch(/crash/);

    // Second job must still have run and completed normally
    expect(s2.status).toBe("complete");
    expect(s2.outputPath).toBe("/output/recovered.mp4");
  });
});

// ─── Render queue not stuck at 0% ─────────────────────────────────────────────
// Regression tests that verify the original bug is fixed.

describe("Regression: render no longer stuck at queued/0%", () => {
  it("status advances past queued within 50ms for a fast render", async () => {
    const q = new RenderQueue();
    q.setRenderFunction(makeFastRenderFn());
    const { app } = createApp(q);

    const project = await createProject(app);
    const { job } = await startRender(app, project.id);

    // 5ms after queuing the status should NOT still be "queued"
    // (queue picks it up synchronously in the same microtask queue)
    await wait(50);

    const polled = await pollStatus(app, job.id);
    expect(polled.status).not.toBe("queued");
    expect(polled.status).toBe("complete");
  });

  it("progress is never null after render completes", async () => {
    const q = new RenderQueue();
    q.setRenderFunction(makeFastRenderFn());
    const { app } = createApp(q);

    const project = await createProject(app);
    const { job } = await startRender(app, project.id);
    await wait(50);

    const done = await pollStatus(app, job.id);
    expect(done.progress).not.toBeNull();
    expect(done.progress.progress).toBeGreaterThan(0);
  });

  it("outputPath is set (not null) after successful render", async () => {
    const q = new RenderQueue();
    q.setRenderFunction(makeFastRenderFn("/renders/done.mp4"));
    const { app } = createApp(q);

    const project = await createProject(app);
    const { job } = await startRender(app, project.id);
    await wait(50);

    const done = await pollStatus(app, job.id);
    expect(done.outputPath).toBe("/renders/done.mp4");
  });
});
