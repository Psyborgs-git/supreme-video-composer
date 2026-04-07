import { spawn } from "node:child_process";
import { createServer } from "node:http";
import { mkdtemp, mkdir, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";

type Closable = { close: () => Promise<void> };
type SpawnedProcess = ReturnType<typeof spawn>;
type ToolCallResult = Awaited<ReturnType<Client["callTool"]>>;

interface RunningProcess extends Closable {
  name: string;
  child: SpawnedProcess;
  stdout: string[];
  stderr: string[];
}

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../..");
const cleanupStack: Closable[] = [];

afterEach(async () => {
  while (cleanupStack.length > 0) {
    const entry = cleanupStack.pop();
    if (!entry) continue;
    await entry.close();
  }
});

describe("MCP server end-to-end", () => {
  it(
    "serves HTTP MCP against the real Studio API process",
    async () => {
      const tempRoot = await mkdtemp(path.join(os.tmpdir(), "mcp-process-e2e-"));
      cleanupStack.push({
        close: async () => {
          await rm(tempRoot, { recursive: true, force: true });
        },
      });

      const assetsDir = path.join(tempRoot, "assets");
      const projectsDir = path.join(tempRoot, "projects");
      const exportsDir = path.join(tempRoot, "exports");
      await Promise.all([
        mkdir(assetsDir, { recursive: true }),
        mkdir(projectsDir, { recursive: true }),
        mkdir(exportsDir, { recursive: true }),
      ]);

      const studioPort = await getFreePort();
      const mcpPort = await getFreePort();

      const studio = startProcess("studio", ["apps/studio/server.ts"], {
        NODE_ENV: "production",
        HOST: "127.0.0.1",
        PORT: String(studioPort),
        ASSETS_DIR: assetsDir,
        PROJECTS_DIR: projectsDir,
        EXPORTS_DIR: exportsDir,
      });
      cleanupStack.push(studio);
      await waitForHttpOk(`http://127.0.0.1:${studioPort}/api/templates`, studio);

      const mcp = startProcess("mcp", ["apps/mcp-server/src/index.ts", "--transport=http"], {
        NODE_ENV: "production",
        MCP_HOST: "127.0.0.1",
        MCP_PORT: String(mcpPort),
        STUDIO_API_BASE_URL: `http://127.0.0.1:${studioPort}`,
        STUDIO_PUBLIC_URL: `http://127.0.0.1:${studioPort}`,
      });
      cleanupStack.push(mcp);
      await waitForHttpOk(`http://127.0.0.1:${mcpPort}/health`, mcp);

      const client = new Client({ name: "mcp-process-e2e", version: "1.0.0" });
      cleanupStack.push({
        close: async () => {
          await client.close();
        },
      });

      await client.connect(
        new StreamableHTTPClientTransport(new URL(`http://127.0.0.1:${mcpPort}/mcp`)),
      );

      const templates = parseToolJson<Array<{ id?: string }>>(
        await client.callTool({
          name: "list_templates",
          arguments: {},
        }),
      );
      expect(Array.isArray(templates)).toBe(true);
      expect(templates.some((entry: { id?: string }) => entry.id === "history-storyline")).toBe(
        true,
      );

      const project = parseToolJson<{ id: string; name: string; templateId: string }>(
        await client.callTool({
          name: "create_project",
          arguments: {
            templateId: "history-storyline",
            name: "HTTP MCP E2E",
          },
        }),
      );

      expect(project.name).toBe("HTTP MCP E2E");
      expect(project.templateId).toBe("history-storyline");

      const studioProjectResponse = await fetch(
        `http://127.0.0.1:${studioPort}/api/projects/${encodeURIComponent(project.id)}`,
      );
      expect(studioProjectResponse.ok).toBe(true);
      const studioProject = await studioProjectResponse.json();
      expect(studioProject.name).toBe("HTTP MCP E2E");
      expect(studioProject.templateId).toBe("history-storyline");

      const projects = parseToolJson<Array<{ id?: string }>>(
        await client.callTool({
          name: "list_projects",
          arguments: {},
        }),
      );
      expect(projects.some((entry: { id?: string }) => entry.id === project.id)).toBe(true);

      const preview = parseToolJson<{ url: string }>(
        await client.callTool({
          name: "preview_url",
          arguments: { projectId: project.id },
        }),
      );
      expect(preview.url).toBe(
        `http://127.0.0.1:${studioPort}/editor/${project.templateId}/${project.id}`,
      );

      const deletion = parseToolJson<{ deleted: boolean }>(
        await client.callTool({
          name: "delete_project",
          arguments: { projectId: project.id },
        }),
      );
      expect(deletion.deleted).toBe(true);
    },
    60000,
  );
});

function startProcess(
  name: string,
  args: string[],
  extraEnv: Record<string, string>,
): RunningProcess {
  const stdout: string[] = [];
  const stderr: string[] = [];

  const child = spawn("bun", args, {
    cwd: repoRoot,
    env: sanitizeEnv({ ...process.env, ...extraEnv }),
    stdio: ["ignore", "pipe", "pipe"],
  });

  child.stdout.setEncoding("utf8");
  child.stdout.on("data", (chunk) => {
    stdout.push(chunk);
  });

  child.stderr.setEncoding("utf8");
  child.stderr.on("data", (chunk) => {
    stderr.push(chunk);
  });

  return {
    name,
    child,
    stdout,
    stderr,
    close: async () => {
      if (child.exitCode !== null) {
        return;
      }

      child.kill("SIGTERM");
      const exited = await waitForExit(child, 10000);
      if (!exited && child.exitCode === null) {
        child.kill("SIGKILL");
        await waitForExit(child, 5000);
      }
    },
  };
}

async function waitForHttpOk(
  url: string,
  process: RunningProcess,
  timeoutMs = 30000,
): Promise<void> {
  const start = Date.now();

  while (Date.now() - start < timeoutMs) {
    if (process.child.exitCode !== null) {
      throw new Error(formatProcessFailure(process));
    }

    try {
      const response = await fetch(url);
      if (response.ok) {
        return;
      }
    } catch {
      // Server has not started yet.
    }

    await sleep(250);
  }

  throw new Error(
    `Timed out waiting for ${process.name} to serve ${url}\n${formatProcessFailure(process)}`,
  );
}

async function getFreePort(): Promise<number> {
  const server = createServer();

  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      server.off("error", reject);
      resolve();
    });
  });

  const address = server.address();
  if (!address || typeof address === "string") {
    throw new Error("Expected a TCP address when allocating a free port");
  }

  await new Promise<void>((resolve, reject) => {
    server.close((error) => {
      if (error) {
        reject(error);
        return;
      }
      resolve();
    });
  });

  return address.port;
}

async function waitForExit(
  child: SpawnedProcess,
  timeoutMs: number,
): Promise<boolean> {
  if (child.exitCode !== null) {
    return true;
  }

  return await new Promise<boolean>((resolve) => {
    const timeout = setTimeout(() => {
      cleanup();
      resolve(false);
    }, timeoutMs);

    const handleExit = () => {
      cleanup();
      resolve(true);
    };

    const cleanup = () => {
      clearTimeout(timeout);
      child.off("exit", handleExit);
      child.off("close", handleExit);
    };

    child.once("exit", handleExit);
    child.once("close", handleExit);
  });
}

function sanitizeEnv(env: NodeJS.ProcessEnv): Record<string, string> {
  return Object.fromEntries(
    Object.entries(env).filter((entry): entry is [string, string] => typeof entry[1] === "string"),
  );
}

function parseToolJson<T>(result: ToolCallResult): T {
  const content =
    "content" in result && Array.isArray(result.content) ? result.content : undefined;
  const textEntry = content?.find(isTextEntry);
  const text = textEntry?.text;
  if (!text) {
    throw new Error(`Expected text content in tool result: ${JSON.stringify(result)}`);
  }

  if ("isError" in result && result.isError === true) {
    throw new Error(text);
  }

  return JSON.parse(text) as T;
}

function isTextEntry(entry: unknown): entry is { type: "text"; text: string } {
  if (!entry || typeof entry !== "object") {
    return false;
  }

  const candidate = entry as { type?: unknown; text?: unknown };
  return candidate.type === "text" && typeof candidate.text === "string";
}

function formatProcessFailure(process: RunningProcess): string {
  return [
    `[${process.name}] exitCode=${process.child.exitCode}`,
    `[${process.name}] stdout:\n${process.stdout.join("")}`,
    `[${process.name}] stderr:\n${process.stderr.join("")}`,
  ].join("\n");
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}
