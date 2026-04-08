import { describe, it, expect, beforeEach } from "vitest";
import {
  generationJobStore,
  clearGenerationJobStore,
  generateJobId,
  createJobRecord,
  updateJobStatus,
  addJobOutput,
  addJobAsset,
} from "../utils/job-store.js";
import { runScriptPipeline } from "../pipelines/script.js";
import { runImagePipeline } from "../pipelines/image.js";
import { runAudioPipeline } from "../pipelines/audio.js";
import { runFullGenerationPipeline } from "../pipelines/full.js";

beforeEach(() => clearGenerationJobStore());

// ─── Job store tests ─────────────────────────────────────────────

describe("generationJobStore", () => {
  it("creates a queued job record", () => {
    const id = generateJobId();
    const job = createJobRecord(id, {
      name: "Test Job",
      modality: "script",
      prompt: "A dog runs through a park",
    });
    expect(job.id).toBe(id);
    expect(job.status).toBe("queued");
    expect(job.progress).toBeNull();
    expect(job.outputs).toHaveLength(0);
    expect(job.assetIds).toHaveLength(0);
    expect(generationJobStore.has(id)).toBe(true);
  });

  it("transitions job to running", () => {
    const id = generateJobId();
    createJobRecord(id, { name: "T", modality: "image", prompt: "p" });
    const updated = updateJobStatus(id, "running", { progress: 0.1 });
    expect(updated?.status).toBe("running");
    expect(updated?.startedAt).toBeTruthy();
    expect(updated?.progress).toBe(0.1);
  });

  it("transitions job to completed", () => {
    const id = generateJobId();
    createJobRecord(id, { name: "T", modality: "audio", prompt: "p" });
    updateJobStatus(id, "running");
    const done = updateJobStatus(id, "completed", { progress: 1 });
    expect(done?.status).toBe("completed");
    expect(done?.completedAt).toBeTruthy();
  });

  it("transitions job to failed with error", () => {
    const id = generateJobId();
    createJobRecord(id, { name: "T", modality: "video", prompt: "p" });
    const failed = updateJobStatus(id, "failed", { error: "timeout" } as any);
    // error is not part of the update signature but we still want status=failed
    expect(failed?.status).toBe("failed");
  });

  it("appends step outputs", () => {
    const id = generateJobId();
    createJobRecord(id, { name: "T", modality: "script", prompt: "p" });
    addJobOutput(id, "script", { title: "My Video" });
    const job = generationJobStore.get(id);
    expect(job?.outputs).toHaveLength(1);
    expect((job?.outputs[0].data as { title: string }).title).toBe("My Video");
  });

  it("registers asset IDs and deduplicates", () => {
    const id = generateJobId();
    createJobRecord(id, { name: "T", modality: "image", prompt: "p" });
    addJobAsset(id, "asset-1");
    addJobAsset(id, "asset-1"); // duplicate
    addJobAsset(id, "asset-2");
    const job = generationJobStore.get(id);
    expect(job?.assetIds).toEqual(["asset-1", "asset-2"]);
  });

  it("cancels a job", () => {
    const id = generateJobId();
    createJobRecord(id, { name: "T", modality: "script", prompt: "p" });
    const cancelled = updateJobStatus(id, "cancelled");
    expect(cancelled?.status).toBe("cancelled");
    expect(cancelled?.completedAt).toBeTruthy();
  });

  it("clears all jobs", () => {
    const id1 = generateJobId();
    const id2 = generateJobId();
    createJobRecord(id1, { name: "A", modality: "script", prompt: "p" });
    createJobRecord(id2, { name: "B", modality: "image", prompt: "p" });
    clearGenerationJobStore();
    expect(generationJobStore.size).toBe(0);
  });
});

// ─── Script pipeline (mock provider) ─────────────────────────────

describe("runScriptPipeline", () => {
  it("returns a scene plan from a prompt", async () => {
    const plan = await runScriptPipeline({ prompt: "A dog runs through a park", sceneCount: 3 });
    expect(plan.title).toBeTruthy();
    expect(plan.scenes).toHaveLength(3);
    for (const scene of plan.scenes) {
      expect(scene.title).toBeTruthy();
      expect(scene.body).toBeTruthy();
      expect(typeof scene.durationFrames).toBe("number");
    }
  });

  it("includes suggestedDurationSeconds", async () => {
    const plan = await runScriptPipeline({ prompt: "Test video", sceneCount: 2 });
    expect(plan.suggestedDurationSeconds).toBeGreaterThan(0);
  });

  it("propagates style to scene transitions", async () => {
    const plan = await runScriptPipeline({ prompt: "Fast video", sceneCount: 2, style: "fast" });
    expect(plan.style).toBe("fast");
    for (const scene of plan.scenes) {
      expect(scene.enterTransition).toBe("swipe");
    }
  });
});

// ─── Image pipeline (mock provider) ──────────────────────────────

describe("runImagePipeline", () => {
  it("returns one result per scene", async () => {
    const scenes = [
      { body: "A sunset over mountains", imagePrompt: "Epic sunset, 4K" },
      { body: "A dog in a park" },
    ];
    const results = await runImagePipeline(scenes);
    expect(results).toHaveLength(2);
    for (const r of results) {
      expect(r.imageUrl).toBeTruthy();
      expect(r.usedPrompt).toBeTruthy();
    }
  });

  it("uses imagePrompt over body when available", async () => {
    const results = await runImagePipeline([
      { body: "body text", imagePrompt: "explicit prompt" },
    ]);
    expect(results[0].usedPrompt).toBe("explicit prompt");
  });
});

// ─── Audio pipeline (mock provider) ──────────────────────────────

describe("runAudioPipeline", () => {
  it("returns audio result with url and mimeType", async () => {
    const result = await runAudioPipeline({ text: "Hello, this is a test narration." });
    expect(result.url).toBeTruthy();
    expect(result.mimeType).toMatch(/audio/);
  });
});

// ─── Full generation pipeline (mock providers) ───────────────────

describe("runFullGenerationPipeline", () => {
  it("returns scenePlan with correct scene count", async () => {
    const output = await runFullGenerationPipeline({
      prompt: "A product launch video",
      sceneCount: 4,
    });
    expect(output.scenePlan.scenes).toHaveLength(4);
    expect(output.sceneImages).toBeUndefined();
    expect(output.narrationAudio).toBeUndefined();
  });

  it("generates images when requested", async () => {
    const output = await runFullGenerationPipeline({
      prompt: "Test video",
      sceneCount: 2,
      generateImages: true,
    });
    expect(output.sceneImages).toHaveLength(2);
    // Images should be back-filled onto the scene plan
    for (const scene of output.scenePlan.scenes) {
      expect(scene.imageUrl).toBeTruthy();
    }
  });

  it("generates audio when requested and narrationScript exists", async () => {
    const output = await runFullGenerationPipeline({
      prompt: "Documentary about space",
      sceneCount: 3,
      generateAudio: true,
    });
    // Mock text provider always returns a narrationScript
    expect(output.narrationAudio).toBeDefined();
    expect(output.narrationAudio?.url).toBeTruthy();
  });
});
