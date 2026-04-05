import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  test: {
    globals: false,
    environment: "node",
    include: ["src/__tests__/**/*.test.ts"],
    // Apply a reasonable timeout — render mocks resolve asynchronously
    testTimeout: 10000,
  },
  resolve: {
    alias: {
      // Keep the same "@/" alias used by the studio source
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
