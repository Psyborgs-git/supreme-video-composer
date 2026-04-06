#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import {
  CANONICAL_ASPECT_RATIO_PRESET_IDS,
  LEGACY_ASPECT_RATIO_PRESET_IDS,
} from "@studio/shared-types";
import {
  handleListTemplates,
  handleGetTemplate,
  handleCreateProject,
  handleUpdateProject,
  handleGetProject,
  handleListProjects,
  handleDeleteProject,
  handleDuplicateProject,
  handleRenderProject,
  handleGetRenderStatus,
  handleCancelRender,
  handleListRenders,
  handleListAspectRatios,
  handlePreviewUrl,
  handleExportFormats,
} from "./handlers.js";

const aspectRatioEnum = z.enum([
  ...CANONICAL_ASPECT_RATIO_PRESET_IDS,
  ...LEGACY_ASPECT_RATIO_PRESET_IDS,
]);

const server = new McpServer({
  name: "media-studio",
  version: "0.2.0",
});

// ─── Template tools ────────────────────────────────────────────────────────

server.tool("list_templates", "List all available video templates with their metadata", {}, handleListTemplates);

server.tool(
  "get_template",
  "Get details of a specific template",
  { templateId: z.string().describe("The template ID") },
  handleGetTemplate,
);

// ─── Project tools ─────────────────────────────────────────────────────────

server.tool(
  "create_project",
  "Create a new project from a template",
  {
    templateId: z.string().describe("The template ID to use"),
    name: z.string().describe("Project name"),
    inputProps: z.record(z.unknown()).optional().describe("Initial props for the template"),
    aspectRatio: aspectRatioEnum.optional().describe("Aspect ratio preset"),
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
    aspectRatio: aspectRatioEnum.optional().describe("New aspect ratio"),
  },
  handleUpdateProject,
);

server.tool(
  "get_project",
  "Get details of a specific project",
  { projectId: z.string().describe("The project ID") },
  handleGetProject,
);

server.tool(
  "list_projects",
  "List all projects, optionally filtered by template",
  {
    templateId: z.string().optional().describe("Filter by template ID"),
  },
  handleListProjects,
);

server.tool(
  "delete_project",
  "Delete a project (blocked if there is an active render)",
  { projectId: z.string().describe("The project ID to delete") },
  handleDeleteProject,
);

server.tool(
  "duplicate_project",
  "Create an independent copy of a project",
  {
    projectId: z.string().describe("The project ID to duplicate"),
    newName: z.string().optional().describe("Name for the new copy"),
  },
  handleDuplicateProject,
);

server.tool(
  "preview_url",
  "Get the editor URL to preview a project in the browser",
  { projectId: z.string().describe("The project ID") },
  handlePreviewUrl,
);

// ─── Render tools ──────────────────────────────────────────────────────────

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

server.tool(
  "cancel_render",
  "Cancel a queued or active render job",
  { jobId: z.string().describe("The render job ID to cancel") },
  handleCancelRender,
);

server.tool(
  "list_renders",
  "List render jobs, optionally filtered by project or status",
  {
    projectId: z.string().optional().describe("Filter by project ID"),
    status: z.enum(["queued", "bundling", "rendering", "encoding", "complete", "error", "cancelled"]).optional().describe("Filter by status"),
  },
  handleListRenders,
);

// ─── Utility tools ─────────────────────────────────────────────────────────

server.tool("list_aspect_ratios", "List all supported aspect ratio presets with dimensions", {}, handleListAspectRatios);

server.tool("export_formats", "List all supported export formats and their settings", {}, handleExportFormats);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch(console.error);
