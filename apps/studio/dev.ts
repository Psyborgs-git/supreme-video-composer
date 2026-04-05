/**
 * Dev script that runs both the Hono server and Vite dev server with proper
 * process management and graceful shutdown.
 */

import { spawn } from "child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

// Compatible with both Bun (import.meta.dir) and Node.js
const STUDIO_DIR: string =
  (import.meta as any).dir ??
  import.meta.dirname ??
  path.dirname(fileURLToPath(import.meta.url));

let serverProcess: ReturnType<typeof spawn> | null = null;
let viteProcess: ReturnType<typeof spawn> | null = null;
let isShuttingDown = false;

function startServer() {
  console.log("[dev] starting studio-api server on :3001...");
  serverProcess = spawn("bun", ["run", "server.ts"], {
    stdio: "inherit",
    cwd: STUDIO_DIR,
  });

  serverProcess.on("exit", (code) => {
    console.log(`[dev] studio-api exited with code ${code}`);
    if (!isShuttingDown) {
      console.log("[dev] server died unexpectedly, shutting down...");
      gracefulShutdown();
    }
  });
}

function startVite() {
  console.log("[dev] starting vite dev server on :3000...");
  viteProcess = spawn("vite", [], {
    stdio: "inherit",
    cwd: STUDIO_DIR,
  });

  viteProcess.on("exit", (code) => {
    console.log(`[dev] vite exited with code ${code}`);
    if (!isShuttingDown) {
      console.log("[dev] vite died unexpectedly, shutting down...");
      gracefulShutdown();
    }
  });
}

function gracefulShutdown() {
  if (isShuttingDown) return;
  isShuttingDown = true;

  console.log("\n[dev] graceful shutdown initiated...");

  let processesExited = 0;
  const totalProcesses = [serverProcess, viteProcess].filter((p) => p).length;

  const cleanup = () => {
    processesExited++;
    if (processesExited >= totalProcesses) {
      console.log("[dev] all processes terminated");
      process.exit(0);
    }
  };

  // Terminate server
  if (serverProcess) {
    console.log("[dev] terminating studio-api...");
    serverProcess.once("exit", cleanup);
    serverProcess.kill("SIGTERM");
  }

  // Terminate vite
  if (viteProcess) {
    console.log("[dev] terminating vite...");
    viteProcess.once("exit", cleanup);
    viteProcess.kill("SIGTERM");
  }

  // Force exit after 5 seconds
  const forceExitTimer = setTimeout(() => {
    console.error("[dev] forcing exit after timeout");
    if (serverProcess && !serverProcess.killed) {
      console.error("[dev] force killing studio-api");
      serverProcess.kill("SIGKILL");
    }
    if (viteProcess && !viteProcess.killed) {
      console.error("[dev] force killing vite");
      viteProcess.kill("SIGKILL");
    }
    process.exit(1);
  }, 5000);

  // Cancel force exit if all processes terminate cleanly
  const checkComplete = () => {
    if (isShuttingDown && processesExited >= totalProcesses) {
      clearTimeout(forceExitTimer);
    }
  };
  if (serverProcess) serverProcess.once("exit", checkComplete);
  if (viteProcess) viteProcess.once("exit", checkComplete);
}

// Handle signals
process.on("SIGINT", () => gracefulShutdown());
process.on("SIGTERM", () => gracefulShutdown());

// Start both servers
startServer();
startVite();
