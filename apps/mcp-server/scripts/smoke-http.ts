import process from "node:process";
import { randomUUID } from "node:crypto";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";

const mcpUrl = new URL(process.env.MCP_URL ?? "http://127.0.0.1:9090/mcp");
const studioApiBaseUrl = normalizeUrl(
  process.env.STUDIO_API_BASE_URL ?? "http://127.0.0.1:3000",
);
const templateId = process.env.SMOKE_TEMPLATE_ID ?? "history-storyline";
const projectName =
  process.env.SMOKE_PROJECT_NAME ?? `mcp-http-smoke-${randomUUID().slice(0, 8)}`;

const client = new Client({
  name: "mcp-http-smoke",
  version: "1.0.0",
});

try {
  await client.connect(new StreamableHTTPClientTransport(mcpUrl));

  const templates = parseToolJson(
    await client.callTool({
      name: "list_templates",
      arguments: {},
    }),
  );

  if (!Array.isArray(templates) || !templates.some((entry) => entry?.id === templateId)) {
    throw new Error(`Template "${templateId}" was not returned by list_templates`);
  }

  const project = parseToolJson(
    await client.callTool({
      name: "create_project",
      arguments: {
        templateId,
        name: projectName,
      },
    }),
  );

  if (!project?.id) {
    throw new Error(`Expected create_project to return a project id: ${JSON.stringify(project)}`);
  }

  const studioProjectResponse = await fetch(
    `${studioApiBaseUrl}/api/projects/${encodeURIComponent(project.id)}`,
    {
      headers: { Accept: "application/json" },
    },
  );

  if (!studioProjectResponse.ok) {
    throw new Error(
      `Studio API did not return the created project (${studioProjectResponse.status})`,
    );
  }

  const studioProject = await studioProjectResponse.json();
  if (studioProject.name !== projectName || studioProject.templateId !== templateId) {
    throw new Error(
      `Studio API project mismatch: ${JSON.stringify({
        expected: { projectName, templateId },
        actual: studioProject,
      })}`,
    );
  }

  const projects = parseToolJson(
    await client.callTool({
      name: "list_projects",
      arguments: {},
    }),
  );

  if (!Array.isArray(projects) || !projects.some((entry) => entry?.id === project.id)) {
    throw new Error("Created project was not returned by list_projects");
  }

  await client.callTool({
    name: "delete_project",
    arguments: { projectId: project.id },
  });

  console.log(
    `[mcp-smoke] OK: connected to ${mcpUrl.toString()} and verified project ${project.id} via ${studioApiBaseUrl}`,
  );
} finally {
  await client.close();
}

function parseToolJson(result: {
  isError?: boolean;
  content?: Array<{ type?: string; text?: string }>;
}) {
  const text = result.content?.find((entry) => entry.type === "text")?.text;
  if (!text) {
    throw new Error(`Expected text content in tool result: ${JSON.stringify(result)}`);
  }

  if (result.isError) {
    throw new Error(text);
  }

  return JSON.parse(text) as Array<{ id?: string }> | Record<string, unknown>;
}

function normalizeUrl(value: string): string {
  return value.replace(/\/+$/, "");
}
