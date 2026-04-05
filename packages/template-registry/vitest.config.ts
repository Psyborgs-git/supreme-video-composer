import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: false,
    environment: "node",
    // Register tests only in __tests__ folders
    include: ["src/__tests__/**/*.test.ts"],
  },
});
