import { describe, it, expect, vi } from "vitest";
import { RenderQueue } from "../queue";
import type { RenderJob, RenderProgress } from "@studio/shared-types";

// ─── Helpers ─────────────────────────────────────────────────────

function makeJob(overrides: Partial<RenderJob> = {}): RenderJob {
  return {
    id: `job-${Math.random().toString(36).slice(2, 8)}`,
    projectId: "proj-1",
    templateId: "history-storyline",
    inputProps: {},
    exportFormat: {
      codec: "h264",
      fileExtension: ".mp4",
      crf: 18,
      fps: 30,
      scale: 1,
    },
    aspectRatio: { preset: "16:9", width: 1920, height: 1080 },
    status: "queued",
    progress: null,
    outputPath: null,
    error: null,
    createdAt: new Date().toISOString(),
    startedAt: null,
    completedAt: null,
    ...overrides,
  } satisfies RenderJob;
}

function makeSuccessRenderFn(output = "/tmp/test.mp4") {
  return async (
    job: RenderJob,
    onProgress: (p: RenderProgress) => void,
  ): Promise<string> => {
    onProgress({ progress: 0.5, renderedFrames: 30, encodedFrames: 0, totalFrames: 60, stage: "rendering" });
    onProgress({ progress: 1.0, renderedFrames: 60, encodedFrames: 60, totalFrames: 60, stage: "encoding" });
    return output;
  };
}

// ─── Tests ───────────────────────────────────────────────────────

describe("RenderQueue — initial state", () => {
  it("starts empty with no jobs", () => {
    const q = new RenderQueue();
    expect(q.getAllJobs()).toHaveLength(0);
  });

  it("getJob returns undefined for unknown id", () => {
    const q = new RenderQueue();
    expect(q.getJob("doesnt-exist")).toBeUndefined();
  });
});

describe("RenderQueue — enqueue + successful completion", () => {
  it("resolves the promise with a completed job", async () => {
    const q = new RenderQueue();
    q.setRenderFunction(makeSuccessRenderFn("/output/video.mp4"));
    const job = makeJob();
    const result = await q.enqueue(job);
    expect(result.status).toBe("complete");
    expect(result.outputPath).toBe("/output/video.mp4");
    expect(result.completedAt).toBeTruthy();
    expect(result.startedAt).toBeTruthy();
    expect(result.error).toBeNull();
  });

  it("stores the completed job in getJob()", async () => {
    const q = new RenderQueue();
    q.setRenderFunction(makeSuccessRenderFn());
    const job = makeJob();
    await q.enqueue(job);
    const stored = q.getJob(job.id);
    expect(stored?.status).toBe("complete");
  });

  it("emits job:queued and job:complete events", async () => {
    const q = new RenderQueue();
    q.setRenderFunction(makeSuccessRenderFn());
    const events: string[] = [];
    q.on("job:queued", () => events.push("queued"));
    q.on("job:started", () => events.push("started"));
    q.on("job:complete", () => events.push("complete"));
    await q.enqueue(makeJob());
    expect(events).toEqual(["queued", "started", "complete"]);
  });

  it("calls onProgress with intermediate updates", async () => {
    const q = new RenderQueue();
    const progressValues: number[] = [];
    q.setRenderFunction(async (job, onProgress) => {
      onProgress({ progress: 0.25, renderedFrames: 15, encodedFrames: 0, totalFrames: 60, stage: "rendering" });
      onProgress({ progress: 0.75, renderedFrames: 45, encodedFrames: 15, totalFrames: 60, stage: "rendering" });
      onProgress({ progress: 1.0, renderedFrames: 60, encodedFrames: 60, totalFrames: 60, stage: "encoding" });
      return "/out.mp4";
    });
    q.on("job:progress", (j: RenderJob) => progressValues.push(j.progress!.progress));
    await q.enqueue(makeJob());
    expect(progressValues).toEqual([0.25, 0.75, 1.0]);
  });
});

describe("RenderQueue — error handling", () => {
  it("rejects the promise when render function throws", async () => {
    const q = new RenderQueue();
    q.setRenderFunction(async () => {
      throw new Error("Render failed");
    });
    const job = makeJob();
    await expect(q.enqueue(job)).rejects.toThrow("Render failed");
  });

  it("sets status to error on failure", async () => {
    const q = new RenderQueue();
    q.setRenderFunction(async () => {
      throw new Error("GPU crash");
    });
    const job = makeJob();
    try {
      await q.enqueue(job);
    } catch {
      // expected
    }
    const stored = q.getJob(job.id);
    expect(stored?.status).toBe("error");
    expect(stored?.error).toBe("GPU crash");
    expect(stored?.completedAt).toBeTruthy();
  });

  it("emits job:error event", async () => {
    const q = new RenderQueue();
    q.setRenderFunction(async () => {
      throw new Error("fail");
    });
    const errorJobs: RenderJob[] = [];
    q.on("job:error", (j: RenderJob) => errorJobs.push(j));
    try {
      await q.enqueue(makeJob());
    } catch {
      // expected
    }
    expect(errorJobs).toHaveLength(1);
    expect(errorJobs[0].status).toBe("error");
  });
});

describe("RenderQueue — sequential processing", () => {
  it("processes two jobs in order (no parallel)", async () => {
    const q = new RenderQueue();
    const order: string[] = [];
    q.setRenderFunction(async (job) => {
      order.push(`start:${job.id}`);
      await new Promise((r) => setTimeout(r, 5));
      order.push(`end:${job.id}`);
      return "/out.mp4";
    });
    const job1 = makeJob({ id: "job-1" });
    const job2 = makeJob({ id: "job-2" });
    await Promise.all([q.enqueue(job1), q.enqueue(job2)]);
    // job-1 must fully complete before job-2 starts
    expect(order.indexOf("end:job-1")).toBeLessThan(order.indexOf("start:job-2"));
  });

  it("processes a third job after two have completed", async () => {
    const q = new RenderQueue();
    q.setRenderFunction(makeSuccessRenderFn());
    await q.enqueue(makeJob({ id: "job-a" }));
    await q.enqueue(makeJob({ id: "job-b" }));
    const result = await q.enqueue(makeJob({ id: "job-c" }));
    expect(result.status).toBe("complete");
  });
});

describe("RenderQueue — cancellation", () => {
  it("cancels a queued job before it starts", async () => {
    const q = new RenderQueue();
    // Occupy the queue with a slow job so job-2 sits in the queue
    let releaseBlock: (() => void) | null = null;
    q.setRenderFunction(async (job, onProgress) => {
      if (job.id === "job-blocking") {
        await new Promise<void>((r) => { releaseBlock = r; });
      }
      return "/out.mp4";
    });

    const blockingJob = makeJob({ id: "job-blocking" });
    const queuedJob = makeJob({ id: "job-queued" });

    // Start the blocking job (don't await)
    const blockingPromise = q.enqueue(blockingJob);
    // Add the second job while first is running
    const queuedPromise = q.enqueue(queuedJob);

    // Cancel the queued job
    const cancelled = q.cancelJob("job-queued");
    expect(cancelled).toBe(true);

    // Release the blocking job
    releaseBlock!();
    await blockingPromise;

    const queuedResult = await queuedPromise;
    expect(queuedResult.status).toBe("cancelled");
  });

  it("returns false when cancelling a non-existent job", () => {
    const q = new RenderQueue();
    expect(q.cancelJob("ghost-job")).toBe(false);
  });
});

describe("RenderQueue — getAllJobs()", () => {
  it("returns all jobs including failed and completed", async () => {
    const q = new RenderQueue();
    let callCount = 0;
    q.setRenderFunction(async () => {
      callCount++;
      if (callCount === 2) throw new Error("fail");
      return "/out.mp4";
    });
    const j1 = makeJob({ id: "j1" });
    const j2 = makeJob({ id: "j2" });
    const j3 = makeJob({ id: "j3" });
    await q.enqueue(j1);
    try { await q.enqueue(j2); } catch {}
    await q.enqueue(j3);
    const all = q.getAllJobs();
    expect(all).toHaveLength(3);
    const byId = Object.fromEntries(all.map((j) => [j.id, j.status]));
    expect(byId["j1"]).toBe("complete");
    expect(byId["j2"]).toBe("error");
    expect(byId["j3"]).toBe("complete");
  });
});
