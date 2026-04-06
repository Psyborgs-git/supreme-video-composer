import { afterEach, describe, expect, it, vi } from "vitest";
import { resolveBrowserExecutable } from "../render";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("resolveBrowserExecutable", () => {
  it("prefers an explicitly configured browser executable", () => {
    expect(
      resolveBrowserExecutable({
        compositionsEntryPoint: "/app/packages/remotion-compositions/src/index.ts",
        outputDir: "/data/exports",
        browserExecutable: "/custom/chrome",
      }),
    ).toBe("/custom/chrome");
  });

  it("falls back to the runtime Chromium environment variables", () => {
    vi.stubEnv("REMOTION_CHROME_EXECUTABLE", "/usr/bin/chromium");
    expect(
      resolveBrowserExecutable({
        compositionsEntryPoint: "/app/packages/remotion-compositions/src/index.ts",
        outputDir: "/data/exports",
      }),
    ).toBe("/usr/bin/chromium");
  });

  it("returns null when no browser override is available", () => {
    expect(
      resolveBrowserExecutable({
        compositionsEntryPoint: "/app/packages/remotion-compositions/src/index.ts",
        outputDir: "/data/exports",
      }),
    ).toBeNull();
  });
});