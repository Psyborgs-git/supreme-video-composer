#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import {
  handleListTemplates,
  handleCreateProject,
  handleUpdateProject,
  handleGetProject,
  handleListProjects,
  handleRenderProject,
  handleGetRenderStatus,
  handleExportFormats,
} from "./handlers.js";

const server = new McpServer({
  name: "media-studio",
  version: "0.1.0",
});

server.tool("list_templates", "List all available video templates with their metadata", {}, handleListTemplates);

server.tool(
  "create_project",
  "Create a new project from a template",
  {
    templateId: z.string().describe("The template ID to use"),
    name: z.string().describe("Project name"),
    inputProps: z.record(z.unknown()).optional().describe("Initial props for the template"),
    aspectRatio: z.enum(["16:9", "9:16", "1:1", "4:5", "4:3", "2:3", "21:9"]).optional().describe("Aspect ratio preset"),
  },
  handleCreateProject,
);

server.tool(
  "update_project",
  "Update an existing project's properties",
  {
    projectId: z.string().describe("The project ID"),
    name: z.string().optional().describe("New project name"),
    inputProps: z.record(z.unknown()).optional().describe("Updated template props"),
    aspectRatio: z.enum(["16:9", "9:16", "1:1", "4:5", "4:3", "2:3", "21:9"]).optional().describe("New aspect ratio"),
  },
  handleUpdateProject,
);

server.tool(
  "get_project",
  "Get details of a specific project",
  { projectId: z.string().describe("The project ID") },
  handleGetProject,
);

server.tool("list_projects", "List all projects", {}, handleListProjects);

server.tool(
  "render_project",
  "Queue a project for rendering",
  {
    projectId: z.string().describe("The project ID to render"),
    codec: z.enum(["h264", "h265", "vp8", "vp9", "av1", "prores", "gif"]).optional().describe("Video codec"),
    quality: z.enum(["draft", "standard", "high", "max"]).optional().describe("Quality preset"),
  },
  handleRenderProject,
);

server.tool(
  "get_render_status",
  "Check the status of a render job",
  { jobId: z.string().describe("The render job ID") },
  handleGetRenderStatus,
);

server.tool("export_formats", "List all supported export formats and their settings", {}, handleExportFormats);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch(console.error);
