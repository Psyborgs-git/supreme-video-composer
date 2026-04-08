#!/usr/bin/env node
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createMcpServer } from "./create-server.js";
import { startHttpMcpServer } from "./http-server.js";
import {
  createRuntimeFromEnv,
  getHttpServerOptionsFromEnv,
  resolveTransportMode,
} from "./runtime.js";

async function main() {
  const runtime = createRuntimeFromEnv();
  const transportMode = resolveTransportMode();

  if (transportMode === "http") {
    const options = getHttpServerOptionsFromEnv();
    const httpServer = await startHttpMcpServer(runtime, options);

    console.log(`[mcp] listening on ${httpServer.url}/mcp`);
    console.log(`[mcp] health endpoint: ${httpServer.url}/health`);
    console.log(`[mcp] backend: ${runtime.studioApi ? "studio-api" : "local"}`);

    const shutdown = async (signal: string) => {
      console.log(`\n[mcp] received ${signal}, shutting down...`);
      await httpServer.close();
      process.exit(0);
    };

    process.on("SIGINT", () => {
      void shutdown("SIGINT");
    });
    process.on("SIGTERM", () => {
      void shutdown("SIGTERM");
    });
    return;
  }

  const server = createMcpServer(runtime);
  const transport = new StdioServerTransport();
  await server.connect(transport);

  const shutdown = async (signal: string) => {
    console.error(`\n[mcp] received ${signal}, shutting down stdio transport...`);
    await server.close();
    process.exit(0);
  };

  process.on("SIGINT", () => {
    void shutdown("SIGINT");
  });
  process.on("SIGTERM", () => {
    void shutdown("SIGTERM");
  });
}

main().catch((error) => {
  console.error("[mcp] fatal error", error);
  process.exit(1);
});
