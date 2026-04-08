import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { afterEach, describe, expect, it } from "vitest";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { startHttpMcpServer } from "../http-server";
import { StudioApiClient } from "../studio-api-client";

type Closable = { close: () => Promise<void> };

const cleanupStack: Closable[] = [];

afterEach(async () => {
  while (cleanupStack.length > 0) {
    const entry = cleanupStack.pop();
    if (!entry) continue;
    await entry.close();
  }
});

describe("MCP server transports", () => {
  it("serves project tools over Streamable HTTP against the configured backend", async () => {
    const studio = await startFakeStudioBackend();
    cleanupStack.push(studio);

    const mcp = await startHttpMcpServer(
      {
        studioApi: new StudioApiClient(studio.baseUrl),
        previewBaseUrl: "http://localhost:3000",
      },
      { host: "127.0.0.1", port: 0 },
    );
    cleanupStack.push(mcp);

    const client = new Client({ name: "mcp-http-test", version: "1.0.0" });
    const transport = new StreamableHTTPClientTransport(new URL(`${mcp.url}/mcp`));
    cleanupStack.push({
      close: async () => {
        await client.close();
      },
    });

    await client.connect(transport);

    const createProjectResult = await client.callTool({
      name: "create_project",
      arguments: {
        templateId: "history-storyline",
        name: "HTTP MCP Project",
      },
    });
    const project = parseToolJson(createProjectResult);
    expect(project.name).toBe("HTTP MCP Project");
    expect(project.templateId).toBe("history-storyline");

    const listProjectsResult = await client.callTool({
      name: "list_projects",
      arguments: {},
    });
    const projects = parseToolJson(listProjectsResult);
    expect(projects.some((entry: { id: string }) => entry.id === project.id)).toBe(true);

    const renderProjectResult = await client.callTool({
      name: "render_project",
      arguments: {
        projectId: project.id,
        codec: "h264",
      },
    });
    const job = parseToolJson(renderProjectResult);
    expect(job.projectId).toBe(project.id);
    expect(job.status).toBe("queued");

    const renderStatusResult = await client.callTool({
      name: "get_render_status",
      arguments: { jobId: job.id },
    });
    const renderStatus = parseToolJson(renderStatusResult);
    expect(renderStatus.id).toBe(job.id);
    expect(renderStatus.status).toBe("queued");
  });

  it("preserves session state for create_video over Streamable HTTP", async () => {
    const mcp = await startHttpMcpServer(
      {
        previewBaseUrl: "http://localhost:3000",
      },
      { host: "127.0.0.1", port: 0 },
    );
    cleanupStack.push(mcp);

    const client = new Client({ name: "mcp-http-create-video-test", version: "1.0.0" });
    const transport = new StreamableHTTPClientTransport(new URL(`${mcp.url}/mcp`));
    cleanupStack.push({
      close: async () => {
        await client.close();
      },
    });

    await client.connect(transport);

    const firstResult = await client.callTool({
      name: "create_video",
      arguments: {
        files: JSON.stringify({
          "/src/Video.tsx": `import {AbsoluteFill} from "remotion";\nimport {Title} from "./components/Title";\nexport default function Video(){return <AbsoluteFill><Title /></AbsoluteFill>;}`,
          "/src/components/Title.tsx": `export function Title(){return <div>Original</div>;}`,
        }),
      },
    });

    const firstProject = parseStructuredVideoProject(firstResult);
    expect(firstProject.compileError).toBeUndefined();

    const secondResult = await client.callTool({
      name: "create_video",
      arguments: {
        files: JSON.stringify({
          "/src/components/Title.tsx": `export function Title(){return <div>Updated</div>;}`,
        }),
      },
    });

    const secondProject = parseStructuredVideoProject(secondResult);
    const summary = extractToolText(secondResult);

    expect(summary).toContain("Merged with previous project.");
    expect(secondProject.compileError).toBeUndefined();
  });
});

async function startFakeStudioBackend(): Promise<{ baseUrl: string; close: () => Promise<void> }> {
  const projects = new Map<string, Record<string, unknown>>();
  const renders = new Map<string, Record<string, unknown>>();

  let projectCounter = 0;
  let renderCounter = 0;

  const server = createServer(async (req, res) => {
    try {
      const url = new URL(req.url ?? "/", `http://${req.headers.host ?? "localhost"}`);

      if (req.method === "POST" && url.pathname === "/api/projects") {
        const body = (await readJsonBody(req)) as {
          templateId: string;
          name: string;
          inputProps?: Record<string, unknown>;
        };
        const projectId = `project-${++projectCounter}`;
        const project = {
          id: projectId,
          name: body.name,
          templateId: body.templateId,
          inputProps: body.inputProps ?? {},
          aspectRatio: { preset: "youtube", width: 1920, height: 1080 },
          exportFormat: {
            codec: "h264",
            fileExtension: ".mp4",
            crf: 18,
            fps: 30,
            scale: 1,
          },
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          version: 1,
        };
        projects.set(projectId, project);
        return writeJson(res, 201, project);
      }

      if (req.method === "GET" && url.pathname === "/api/projects") {
        return writeJson(res, 200, Array.from(projects.values()));
      }

      if (req.method === "GET" && url.pathname.startsWith("/api/projects/")) {
        const projectId = url.pathname.split("/")[3];
        const project = projects.get(projectId);
        if (!project) {
          return writeJson(res, 404, { error: "Project not found" });
        }
        return writeJson(res, 200, project);
      }

      if (req.method === "POST" && url.pathname.match(/^\/api\/projects\/[^/]+\/render$/)) {
        const projectId = url.pathname.split("/")[3];
        const project = projects.get(projectId);
        if (!project) {
          return writeJson(res, 404, { error: "Project not found" });
        }

        const body = (await readJsonBody(req)) as { codec?: string };
        const jobId = `job-${++renderCounter}`;
        const job = {
          id: jobId,
          projectId,
          templateId: "HistoryStoryline",
          inputProps: project.inputProps,
          exportFormat: {
            codec: body.codec ?? "h264",
            fileExtension: ".mp4",
            crf: 18,
            fps: 30,
            scale: 1,
          },
          aspectRatio: project.aspectRatio,
          status: "queued",
          progress: null,
          outputPath: null,
          error: null,
          createdAt: new Date().toISOString(),
          startedAt: null,
          completedAt: null,
        };
        renders.set(jobId, job);
        return writeJson(res, 202, job);
      }

      if (req.method === "GET" && url.pathname.match(/^\/api\/renders\/[^/]+$/)) {
        const jobId = url.pathname.split("/")[3];
        const job = renders.get(jobId);
        if (!job) {
          return writeJson(res, 404, { error: "Render job not found" });
        }
        return writeJson(res, 200, job);
      }

      return writeJson(res, 404, { error: "Not found" });
    } catch (error) {
      return writeJson(res, 500, {
        error: error instanceof Error ? error.message : "Internal server error",
      });
    }
  });

  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      server.off("error", reject);
      resolve();
    });
  });

  const address = server.address();
  if (!address || typeof address === "string") {
    throw new Error("Expected fake Studio backend to bind to a TCP address");
  }

  return {
    baseUrl: `http://127.0.0.1:${address.port}`,
    close: async () => {
      await new Promise<void>((resolve, reject) => {
        server.close((error?: Error | null) => {
          if (error) {
            reject(error);
            return;
          }
          resolve();
        });
      });
    },
  };
}

async function readJsonBody(req: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];

  for await (const chunk of req) {
    chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
  }

  if (chunks.length === 0) {
    return {};
  }

  return JSON.parse(Buffer.concat(chunks).toString("utf-8"));
}

function writeJson(res: ServerResponse, status: number, payload: unknown): void {
  const body = JSON.stringify(payload);
  res.writeHead(status, {
    "Content-Type": "application/json",
    "Content-Length": Buffer.byteLength(body),
  });
  res.end(body);
}

function parseToolJson(result: any) {
  const text = extractToolText(result);
  if (!text) {
    throw new Error(`Expected text content in tool result: ${JSON.stringify(result)}`);
  }

  return JSON.parse(text);
}

function extractToolText(result: any) {
  return result.content?.find((entry: { type?: string }) => entry.type === "text")?.text;
}

function parseStructuredVideoProject(result: any) {
  const videoProject = result.structuredContent?.videoProject;
  if (typeof videoProject !== "string") {
    throw new Error(`Expected structuredContent.videoProject string, received ${JSON.stringify(result)}`);
  }

  return JSON.parse(videoProject);
}
