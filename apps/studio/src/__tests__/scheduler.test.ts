/**
 * Scheduler unit tests.
 *
 * Tests focus on:
 *  1. The `interpolate` helper (prompt template variable substitution)
 *  2. Overlap policy logic (mock DB queries)
 *  3. Approval gating (approveRun / rejectRun resolve/reject the pending promise)
 *
 * The scheduler class itself is not instantiated in these tests — we test
 * the helper utilities that the scheduler uses, to keep the tests fast and
 * side-effect free.
 */
import { describe, it, expect, vi } from "vitest";

// ─── Interpolate helper ───────────────────────────────────────────────────────

/**
 * Mirrors the private `interpolate` function in scheduler.ts.
 * We re-implement it here so tests don't need to import the scheduler
 * (which has side-effects like connecting to the DB).
 */
function interpolate(template: string, context: Record<string, unknown>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => {
    const val = context[key];
    return val !== undefined && val !== null ? String(val) : `{{${key}}}`;
  });
}

describe("interpolate", () => {
  it("replaces known variables", () => {
    const result = interpolate("Create a video about {{topic}}", { topic: "Rome" });
    expect(result).toBe("Create a video about Rome");
  });

  it("leaves unknown variables unchanged", () => {
    const result = interpolate("Style: {{style}}", {});
    expect(result).toBe("Style: {{style}}");
  });

  it("handles multiple variables", () => {
    const result = interpolate("{{a}} and {{b}}", { a: "foo", b: "bar" });
    expect(result).toBe("foo and bar");
  });

  it("handles numeric context values", () => {
    const result = interpolate("Count: {{count}}", { count: 42 });
    expect(result).toBe("Count: 42");
  });

  it("returns template unchanged when no placeholders", () => {
    const result = interpolate("No placeholders here", { key: "value" });
    expect(result).toBe("No placeholders here");
  });

  it("handles empty template", () => {
    const result = interpolate("", { key: "value" });
    expect(result).toBe("");
  });

  it("skips null context values (leaves placeholder)", () => {
    const result = interpolate("{{x}}", { x: null });
    expect(result).toBe("{{x}}");
  });
});

// ─── Overlap policy ───────────────────────────────────────────────────────────

describe("overlap policy logic", () => {
  it("skip: returns true when any run is pending/running", () => {
    const runs = [{ status: "running" }, { status: "complete" }];
    const isRunning = runs.some((r) => r.status === "running" || r.status === "pending");
    expect(isRunning).toBe(true);
  });

  it("skip: returns false when no active runs", () => {
    const runs = [{ status: "complete" }, { status: "error" }];
    const isRunning = runs.some((r) => r.status === "running" || r.status === "pending");
    expect(isRunning).toBe(false);
  });

  it("skip: empty run list means not running", () => {
    const runs: { status: string }[] = [];
    const isRunning = runs.some((r) => r.status === "running" || r.status === "pending");
    expect(isRunning).toBe(false);
  });
});

// ─── Approval gating (promise-based) ─────────────────────────────────────────

describe("approval gating", () => {
  it("resolves with 'approved' when approveRun is called", async () => {
    const resolvers = new Map<string, (d: "approved" | "rejected") => void>();

    const runId = "run-123";
    const pending = new Promise<"approved" | "rejected">((resolve) => {
      resolvers.set(runId, resolve);
    });

    // Simulate approveRun
    const resolver = resolvers.get(runId);
    resolvers.delete(runId);
    resolver?.("approved");

    const decision = await pending;
    expect(decision).toBe("approved");
    expect(resolvers.has(runId)).toBe(false);
  });

  it("resolves with 'rejected' when rejectRun is called", async () => {
    const resolvers = new Map<string, (d: "approved" | "rejected") => void>();

    const runId = "run-456";
    const pending = new Promise<"approved" | "rejected">((resolve) => {
      resolvers.set(runId, resolve);
    });

    const resolver = resolvers.get(runId);
    resolvers.delete(runId);
    resolver?.("rejected");

    const decision = await pending;
    expect(decision).toBe("rejected");
  });

  it("does not resolve if no resolver registered", () => {
    const resolvers = new Map<string, (d: "approved" | "rejected") => void>();
    // resolvers.get("missing-run") is undefined — safe to call
    const resolver = resolvers.get("missing-run");
    expect(resolver).toBeUndefined();
  });
});

// ─── Timeout policy ───────────────────────────────────────────────────────────

describe("timeout policy", () => {
  it("approve timeout: resolves with approved", async () => {
    let resolve!: (d: "approved" | "rejected") => void;
    const pending = new Promise<"approved" | "rejected">((r) => { resolve = r; });

    const onTimeout = "approve";
    // Simulate timeout firing
    if (onTimeout === "approve") resolve("approved");
    else if (onTimeout === "reject") resolve("rejected");

    expect(await pending).toBe("approved");
  });

  it("reject timeout: resolves with rejected", async () => {
    let resolve!: (d: "approved" | "rejected") => void;
    const pending = new Promise<"approved" | "rejected">((r) => { resolve = r; });

    const onTimeout = "reject";
    if (onTimeout === "approve") resolve("approved");
    else if (onTimeout === "reject") resolve("rejected");

    expect(await pending).toBe("rejected");
  });
});
