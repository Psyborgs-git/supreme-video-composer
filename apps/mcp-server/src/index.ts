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
  handleListAssets,
  handleGetAsset,
  handleDeleteAsset,
  handleRegisterAsset,
  handleSplitTranscriptToCaptions,
  handleGenerateVideoScript,
  handleCreateSceneSequence,
  handleUpdateScene,
  handleCreateTemplate,
  handleUpdateTemplateSchema,
  handleGetTemplateScaffold,
  handleUpdateTemplateComposition,
  handleValidateTemplate,
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

// ─── Asset tools ───────────────────────────────────────────────────────────

server.tool(
  "list_assets",
  "List assets registered in the MCP server, optionally filtered by type or search query",
  {
    type: z.enum(["image", "video", "audio", "font"]).optional().describe("Filter by asset type"),
    search: z.string().optional().describe("Search assets by name (case-insensitive)"),
  },
  handleListAssets,
);

server.tool(
  "get_asset",
  "Get details of a specific asset",
  { assetId: z.string().describe("The asset ID") },
  handleGetAsset,
);

server.tool(
  "delete_asset",
  "Delete an asset from the registry (blocked if referenced by a project)",
  { assetId: z.string().describe("The asset ID to delete") },
  handleDeleteAsset,
);

server.tool(
  "register_asset",
  "Register an already-uploaded asset in the MCP server registry",
  {
    id: z.string().describe("Unique asset ID"),
    name: z.string().describe("Human-readable asset name"),
    type: z.enum(["image", "video", "audio", "font"]).describe("Asset type"),
    path: z.string().describe("Absolute path to the asset file on disk"),
    mimeType: z.string().describe("MIME type of the asset"),
    sizeBytes: z.number().int().min(0).describe("File size in bytes"),
  },
  handleRegisterAsset,
);

// ─── TikTok Caption tools ─────────────────────────────────────────────────

server.tool(
  "split_transcript_to_captions",
  "Split raw transcript text into timed caption chunks for the TikTok Caption template",
  {
    transcript: z.string().describe("The raw transcript text to split"),
    wordsPerCaption: z.number().int().min(1).max(20).optional().describe("Max words per caption chunk (default: 4)"),
    totalDurationFrames: z.number().int().min(1).optional().describe("Total video duration in frames (default: 300)"),
    fps: z.number().optional().describe("Frames per second (default: 30)"),
  },
  handleSplitTranscriptToCaptions,
);

// ─── Prompt-to-Video tools ────────────────────────────────────────────────

server.tool(
  "generate_video_script",
  "Generate a structured scene array from a text prompt for the Prompt-to-Video template",
  {
    prompt: z.string().describe("Describe your video in plain English"),
    sceneCount: z.number().int().min(1).max(20).optional().describe("Number of scenes to generate (default: 5)"),
    style: z.string().optional().describe("Visual style hint (e.g. 'fast', 'cinematic', 'minimal')"),
  },
  handleGenerateVideoScript,
);

server.tool(
  "create_scene_sequence",
  "Create a project from a scene array for the Prompt-to-Video template",
  {
    templateId: z.literal("prompt-to-video").describe("Must be 'prompt-to-video'"),
    name: z.string().describe("Project name"),
    scenes: z.array(z.object({
      title: z.string(),
      body: z.string(),
      imageUrl: z.string().optional(),
      durationFrames: z.number().optional(),
      enterTransition: z.string().optional(),
      exitTransition: z.string().optional(),
      voiceoverText: z.string().optional(),
    })).describe("Array of scene objects"),
    aspectRatio: aspectRatioEnum.optional().describe("Aspect ratio preset"),
  },
  handleCreateSceneSequence,
);

server.tool(
  "update_scene",
  "Update a single scene in a Prompt-to-Video project",
  {
    projectId: z.string().describe("The project ID"),
    sceneIndex: z.number().int().min(0).describe("Zero-based scene index"),
    sceneUpdates: z.record(z.unknown()).describe("Partial scene updates to merge"),
  },
  handleUpdateScene,
);

// ─── Template Creator tools ───────────────────────────────────────────────

const fieldSchemaZ = z.object({
  key: z.string().describe("camelCase field identifier"),
  type: z.enum([
    "string", "number", "boolean", "color",
    "asset-image", "asset-audio", "asset-video",
    "string-array", "asset-image-array", "scene-array",
  ]).describe("Field type"),
  label: z.string().describe("Human-readable label"),
  description: z.string().describe("Helper text"),
  required: z.boolean().describe("Whether the field is required"),
  defaultValue: z.unknown().optional().describe("Default value"),
  validation: z.record(z.unknown()).optional().describe("Validation rules (min, max, etc.)"),
});

server.tool(
  "create_template",
  "Create a new template with scaffold composition and register it",
  {
    name: z.string().describe("Template name"),
    description: z.string().describe("Template description"),
    category: z.string().describe("Category (storytelling, music-reactive, social, product, typography, custom)"),
    fields: z.array(fieldSchemaZ).describe("Field definitions for the template"),
    supportedAspectRatios: z.array(z.string()).describe("Supported aspect ratios"),
    defaultAspectRatio: z.string().describe("Default aspect ratio"),
    defaultDurationFrames: z.number().int().min(1).describe("Default duration in frames"),
    defaultFps: z.number().describe("Default FPS (24, 25, 30, or 60)"),
  },
  handleCreateTemplate,
);

server.tool(
  "update_template_schema",
  "Add or remove fields from a template schema",
  {
    templateId: z.string().describe("The template ID"),
    addFields: z.array(fieldSchemaZ).optional().describe("Fields to add"),
    removeFieldKeys: z.array(z.string()).optional().describe("Field keys to remove"),
  },
  handleUpdateTemplateSchema,
);

server.tool(
  "get_template_scaffold",
  "Get the generated composition and schema code for a template",
  {
    templateId: z.string().describe("The template ID"),
  },
  handleGetTemplateScaffold,
);

server.tool(
  "update_template_composition",
  "Write new composition code for a template",
  {
    templateId: z.string().describe("The template ID"),
    compositionCode: z.string().describe("The new composition TypeScript code"),
  },
  handleUpdateTemplateComposition,
);

server.tool(
  "validate_template",
  "Validate a template by checking its schema against sample props",
  {
    templateId: z.string().describe("The template ID"),
    sampleInputProps: z.record(z.unknown()).optional().describe("Sample input props to validate"),
  },
  handleValidateTemplate,
);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch(console.error);
