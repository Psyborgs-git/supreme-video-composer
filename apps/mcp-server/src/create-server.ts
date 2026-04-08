import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import {
  CANONICAL_ASPECT_RATIO_PRESET_IDS,
  LEGACY_ASPECT_RATIO_PRESET_IDS,
} from "@studio/shared-types";
import type { McpToolRuntime } from "./runtime.js";
import { StudioApiError } from "./studio-api-client.js";
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
  // AI generation handlers
  handleGenerateScript,
  handleGenerateImages,
  handleGenerateAudio,
  handleGenerateVideoAssets,
  handleGenerateProjectFromPrompt,
  handleGetGenerationStatus,
  handleListGenerationJobs,
  handleApproveGeneratedAssets,
  handleRegenerateSceneAsset,
  type ToolResult,
} from "./handlers.js";
import {
  buildCreateVideoDescription,
  createVideoInputSchema,
  handleCreateVideo,
  handleReadMe,
  handleRuleReactCode,
  handleRuleRemotionAnimations,
  handleRuleRemotionSequencing,
  handleRuleRemotionTextAnimations,
  handleRuleRemotionTiming,
  handleRuleRemotionTransitions,
  handleRuleRemotionTrimming,
} from "./remotion-app/tools.js";
import {
  registerRemotionWidgetResource,
  REMOTION_WIDGET_URI,
} from "./remotion-widget/resource.js";
import {
  RULE_AI_GENERATION_OVERVIEW,
  RULE_AI_ASSET_CONSTRAINTS,
  RULE_AI_PROMPTING,
  RULE_AI_PROJECT_ASSEMBLY,
  RULE_AI_SAFETY,
} from "./ai-rules.js";

const aspectRatioEnum = z.enum([
  ...CANONICAL_ASPECT_RATIO_PRESET_IDS,
  ...LEGACY_ASPECT_RATIO_PRESET_IDS,
]);

export function createMcpServer(runtime: McpToolRuntime): McpServer {
  const server = new McpServer({
    name: "media-studio",
    version: "0.3.0",
  });

  registerRemotionWidgetResource(server, runtime);

  // ─── Remotion MCP parity tools ────────────────────────────────────────────

  server.tool(
    "read_me",
    "IMPORTANT: Call this first to learn the create_video contract and discover the available rule tools",
    {},
    () => handleReadMe(),
  );

  server.tool(
    "rule_react_code",
    "Project code reference: file structure, supported imports, entry-file contract, and props-first composition design",
    {},
    () => handleRuleReactCode(),
  );

  server.tool(
    "rule_remotion_animations",
    "Remotion animations: useCurrentFrame, frame-driven animation fundamentals",
    {},
    () => handleRuleRemotionAnimations(),
  );

  server.tool(
    "rule_remotion_timing",
    "Remotion timing: interpolate, spring, Easing, spring configs, delay, duration",
    {},
    () => handleRuleRemotionTiming(),
  );

  server.tool(
    "rule_remotion_sequencing",
    "Remotion sequencing: Sequence, durationInFrames, scene management, and local frame behavior",
    {},
    () => handleRuleRemotionSequencing(),
  );

  server.tool(
    "rule_remotion_transitions",
    "Remotion transitions: TransitionSeries, fade, slide, wipe, flip, and duration calculation",
    {},
    () => handleRuleRemotionTransitions(),
  );

  server.tool(
    "rule_remotion_text_animations",
    "Remotion text: typewriter effects, word highlighting, and string-slicing patterns",
    {},
    () => handleRuleRemotionTextAnimations(),
  );

  server.tool(
    "rule_remotion_trimming",
    "Remotion trimming: cut the start or end of animations with negative Sequence offsets and nested delays",
    {},
    () => handleRuleRemotionTrimming(),
  );

  server.registerTool(
    "create_video",
    {
      title: "Create video",
      description: buildCreateVideoDescription(),
      inputSchema: createVideoInputSchema,
      _meta: {
        ui: { resourceUri: REMOTION_WIDGET_URI },
        "openai/outputTemplate": REMOTION_WIDGET_URI,
        "openai/toolInvocation/invoking": "Compiling project...",
        "openai/toolInvocation/invoked": "Video ready",
      },
    },
    (args, extra) => handleCreateVideo(args, extra, runtime),
  );

  // ─── Template tools ────────────────────────────────────────────────────────

  server.tool("list_templates", "List all available video templates with their metadata", {}, () =>
    handleListTemplates(),
  );

  server.tool(
    "get_template",
    "Get details of a specific template",
    { templateId: z.string().describe("The template ID") },
    (args) => handleGetTemplate(args),
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
    (args) => handleCreateProjectWithRuntime(args, runtime),
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
    (args) => handleUpdateProjectWithRuntime(args, runtime),
  );

  server.tool(
    "get_project",
    "Get details of a specific project",
    { projectId: z.string().describe("The project ID") },
    (args) => handleGetProjectWithRuntime(args, runtime),
  );

  server.tool(
    "list_projects",
    "List all projects, optionally filtered by template",
    {
      templateId: z.string().optional().describe("Filter by template ID"),
    },
    (args) => handleListProjectsWithRuntime(args, runtime),
  );

  server.tool(
    "delete_project",
    "Delete a project (blocked if there is an active render)",
    { projectId: z.string().describe("The project ID to delete") },
    (args) => handleDeleteProjectWithRuntime(args, runtime),
  );

  server.tool(
    "duplicate_project",
    "Create an independent copy of a project",
    {
      projectId: z.string().describe("The project ID to duplicate"),
      newName: z.string().optional().describe("Name for the new copy"),
    },
    (args) => handleDuplicateProjectWithRuntime(args, runtime),
  );

  server.tool(
    "preview_url",
    "Get the editor URL to preview a project in the browser",
    { projectId: z.string().describe("The project ID") },
    (args) => handlePreviewUrlWithRuntime(args, runtime),
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
    (args) => handleRenderProjectWithRuntime(args, runtime),
  );

  server.tool(
    "get_render_status",
    "Check the status of a render job",
    { jobId: z.string().describe("The render job ID") },
    (args) => handleGetRenderStatusWithRuntime(args, runtime),
  );

  server.tool(
    "cancel_render",
    "Cancel a queued or active render job",
    { jobId: z.string().describe("The render job ID to cancel") },
    (args) => handleCancelRenderWithRuntime(args, runtime),
  );

  server.tool(
    "list_renders",
    "List render jobs, optionally filtered by project or status",
    {
      projectId: z.string().optional().describe("Filter by project ID"),
      status: z.enum(["queued", "bundling", "rendering", "encoding", "complete", "error", "cancelled"]).optional().describe("Filter by status"),
    },
    (args) => handleListRendersWithRuntime(args, runtime),
  );

  // ─── Utility tools ─────────────────────────────────────────────────────────

  server.tool("list_aspect_ratios", "List all supported aspect ratio presets with dimensions", {}, () =>
    handleListAspectRatios(),
  );

  server.tool("export_formats", "List all supported export formats and their settings", {}, () =>
    handleExportFormats(),
  );

  // ─── Asset tools ───────────────────────────────────────────────────────────

  server.tool(
    "list_assets",
    "List assets registered in the MCP server, optionally filtered by type or search query",
    {
      type: z.enum(["image", "video", "audio", "font"]).optional().describe("Filter by asset type"),
      search: z.string().optional().describe("Search assets by name (case-insensitive)"),
    },
    (args) => handleListAssetsWithRuntime(args, runtime),
  );

  server.tool(
    "get_asset",
    "Get details of a specific asset",
    { assetId: z.string().describe("The asset ID") },
    (args) => handleGetAssetWithRuntime(args, runtime),
  );

  server.tool(
    "delete_asset",
    "Delete an asset from the registry (blocked if referenced by a project)",
    { assetId: z.string().describe("The asset ID to delete") },
    (args) => handleDeleteAssetWithRuntime(args, runtime),
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
    (args) => handleRegisterAssetWithRuntime(args, runtime),
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
    (args) => handleSplitTranscriptToCaptions(args),
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
    (args) => handleGenerateVideoScript(args),
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
    (args) => handleCreateSceneSequenceWithRuntime(args, runtime),
  );

  server.tool(
    "update_scene",
    "Update a single scene in a Prompt-to-Video project",
    {
      projectId: z.string().describe("The project ID"),
      sceneIndex: z.number().int().min(0).describe("Zero-based scene index"),
      sceneUpdates: z.record(z.unknown()).describe("Partial scene updates to merge"),
    },
    (args) => handleUpdateSceneWithRuntime(args, runtime),
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
    (args) => handleCreateTemplate(args),
  );

  server.tool(
    "update_template_schema",
    "Add or remove fields from a template schema",
    {
      templateId: z.string().describe("The template ID"),
      addFields: z.array(fieldSchemaZ).optional().describe("Fields to add"),
      removeFieldKeys: z.array(z.string()).optional().describe("Field keys to remove"),
    },
    (args) => handleUpdateTemplateSchema(args),
  );

  server.tool(
    "get_template_scaffold",
    "Get the generated composition and schema code for a template",
    {
      templateId: z.string().describe("The template ID"),
    },
    (args) => handleGetTemplateScaffold(args),
  );

  server.tool(
    "update_template_composition",
    "Write new composition code for a template",
    {
      templateId: z.string().describe("The template ID"),
      compositionCode: z.string().describe("The new composition TypeScript code"),
    },
    (args) => handleUpdateTemplateComposition(args),
  );

  server.tool(
    "validate_template",
    "Validate a template by checking its schema against sample props",
    {
      templateId: z.string().describe("The template ID"),
      sampleInputProps: z.record(z.unknown()).optional().describe("Sample input props to validate"),
    },
    (args) => handleValidateTemplate(args),
  );

  // ─── AI Generation rule tools ─────────────────────────────────────────────

  server.tool(
    "rule_ai_generation_overview",
    "IMPORTANT: Call this first to understand AI generation capabilities, tool map, workflow, and provider configuration",
    {},
    () => ({ content: [{ type: "text" as const, text: RULE_AI_GENERATION_OVERVIEW }] }),
  );

  server.tool(
    "rule_ai_asset_constraints",
    "AI generation asset constraints: image/audio/video file limits, resolution requirements, Remotion compatibility",
    {},
    () => ({ content: [{ type: "text" as const, text: RULE_AI_ASSET_CONSTRAINTS }] }),
  );

  server.tool(
    "rule_ai_prompting",
    "How to write effective prompts for script, image, audio, and video generation",
    {},
    () => ({ content: [{ type: "text" as const, text: RULE_AI_PROMPTING }] }),
  );

  server.tool(
    "rule_ai_project_assembly",
    "How to map AI-generated assets into Remotion projects and templates",
    {},
    () => ({ content: [{ type: "text" as const, text: RULE_AI_PROJECT_ASSEMBLY }] }),
  );

  server.tool(
    "rule_ai_safety",
    "AI generation content policy, error handling, provider failures, and idempotency guidance",
    {},
    () => ({ content: [{ type: "text" as const, text: RULE_AI_SAFETY }] }),
  );

  // ─── AI Generation tools ──────────────────────────────────────────────────

  server.tool(
    "generate_script",
    "Generate a structured video scene plan (title, body, imagePrompt per scene) from a text prompt using an LM",
    {
      prompt: z.string().min(1).describe("The topic or concept to generate a video script for"),
      sceneCount: z.number().int().min(1).max(20).optional().default(5).describe("Number of scenes to generate"),
      style: z.string().optional().describe("Pacing/tone: 'fast', 'slow', 'dramatic', 'playful'"),
      genre: z.string().optional().describe("Video genre: 'documentary', 'product', 'educational', 'social'"),
    },
    (args) => handleGenerateScript(args),
  );

  server.tool(
    "generate_images",
    "Generate one image per scene using an image diffusion model. Returns image URLs for each scene",
    {
      scenes: z
        .array(
          z.object({
            body: z.string().describe("Scene description (fallback if imagePrompt is missing)"),
            imagePrompt: z.string().optional().describe("Explicit image generation prompt"),
          }),
        )
        .min(1)
        .describe("List of scenes to generate images for"),
      width: z.number().int().optional().describe("Image width in pixels"),
      height: z.number().int().optional().describe("Image height in pixels"),
    },
    (args) => handleGenerateImages(args),
  );

  server.tool(
    "generate_audio",
    "Synthesise narration audio from text using a TTS provider. Returns a data URI (audio/mpeg or audio/wav)",
    {
      text: z.string().min(1).describe("The narration text to convert to speech"),
      voiceId: z.string().optional().describe("Provider-specific voice ID"),
      speed: z.number().min(0.25).max(4.0).optional().describe("Speaking speed multiplier (1.0 = normal)"),
      format: z.enum(["mp3", "wav"]).optional().default("mp3").describe("Output audio format"),
    },
    (args) => handleGenerateAudio(args),
  );

  server.tool(
    "generate_video_assets",
    "Generate short video clips for each scene using a video generation model (Mode A: assets per scene)",
    {
      scenes: z
        .array(
          z.object({
            prompt: z.string().describe("Scene prompt for video generation"),
            imageUrl: z.string().optional().describe("Optional source image for img2video"),
            durationSeconds: z.number().optional().describe("Desired clip duration in seconds"),
          }),
        )
        .min(1)
        .describe("Scenes to generate video clips for"),
      width: z.number().int().optional().describe("Output width in pixels"),
      height: z.number().int().optional().describe("Output height in pixels"),
    },
    (args) => handleGenerateVideoAssets(args),
  );

  server.tool(
    "generate_project_from_prompt",
    "Full pipeline: prompt → scene plan → (optional) images → (optional) audio → create a prompt-to-video project",
    {
      prompt: z.string().min(1).describe("The prompt describing the video to create"),
      name: z.string().optional().describe("Project name (defaults to generated title)"),
      sceneCount: z.number().int().min(1).max(20).optional().default(5).describe("Number of scenes"),
      style: z.string().optional().describe("Pacing/tone style"),
      generateImages: z.boolean().optional().default(false).describe("Whether to generate scene images"),
      generateAudio: z.boolean().optional().default(false).describe("Whether to generate narration audio"),
      aspectRatio: aspectRatioEnum.optional().describe("Project aspect ratio preset"),
    },
    (args) => handleGenerateProjectFromPrompt(args),
  );

  server.tool(
    "get_generation_status",
    "Get the current status and outputs of an AI generation job",
    {
      jobId: z.string().describe("The generation job ID returned by a generation tool"),
    },
    (args) => handleGetGenerationStatus(args),
  );

  server.tool(
    "list_generation_jobs",
    "List AI generation jobs with optional filters by modality and status",
    {
      modality: z.enum(["script", "image", "audio", "video"]).optional().describe("Filter by generation modality"),
      status: z.enum(["queued", "running", "completed", "failed", "cancelled"]).optional().describe("Filter by job status"),
    },
    (args) => handleListGenerationJobs(args),
  );

  server.tool(
    "approve_generated_assets",
    "Mark a completed generation job's outputs as approved for use in projects",
    {
      jobId: z.string().describe("The generation job ID to approve"),
    },
    (args) => handleApproveGeneratedAssets(args),
  );

  server.tool(
    "regenerate_scene_asset",
    "Regenerate the image or audio for a specific scene in an existing project",
    {
      projectId: z.string().describe("The project ID"),
      sceneIndex: z.number().int().min(0).describe("Zero-based index of the scene to regenerate"),
      assetType: z.enum(["image", "audio"]).describe("Whether to regenerate the image or audio for this scene"),
      prompt: z.string().optional().describe("Optional explicit prompt (falls back to scene body/voiceoverText)"),
    },
    (args) => handleRegenerateSceneAsset(args),
  );

  return server;
}

async function handleCreateProjectWithRuntime(
  args: Parameters<typeof handleCreateProject>[0],
  runtime: McpToolRuntime,
): Promise<ToolResult> {
  if (!runtime.studioApi) return handleCreateProject(args);

  try {
    return okResult(await runtime.studioApi.createProject(args));
  } catch (error) {
    return toStudioToolError(error, {
      400: "VALIDATION_ERROR",
      404: "TEMPLATE_NOT_FOUND",
    });
  }
}

async function handleUpdateProjectWithRuntime(
  args: Parameters<typeof handleUpdateProject>[0],
  runtime: McpToolRuntime,
): Promise<ToolResult> {
  if (!runtime.studioApi) return handleUpdateProject(args);

  try {
    return okResult(
      await runtime.studioApi.updateProject(args.projectId, {
        name: args.name,
        inputProps: args.inputProps,
        aspectRatio: args.aspectRatio,
      }),
    );
  } catch (error) {
    return toStudioToolError(error, {
      400: "VALIDATION_ERROR",
      404: "PROJECT_NOT_FOUND",
    });
  }
}

async function handleGetProjectWithRuntime(
  args: Parameters<typeof handleGetProject>[0],
  runtime: McpToolRuntime,
): Promise<ToolResult> {
  if (!runtime.studioApi) return handleGetProject(args);

  try {
    return okResult(await runtime.studioApi.getProject(args.projectId));
  } catch (error) {
    return toStudioToolError(error, { 404: "PROJECT_NOT_FOUND" });
  }
}

async function handleListProjectsWithRuntime(
  args: Parameters<typeof handleListProjects>[0],
  runtime: McpToolRuntime,
): Promise<ToolResult> {
  if (!runtime.studioApi) return handleListProjects(args);

  try {
    let projects = await runtime.studioApi.listProjects();
    if (args?.templateId) {
      projects = projects.filter((project) => project.templateId === args.templateId);
    }

    return okResult(
      projects.map((project) => ({
        id: project.id,
        name: project.name,
        templateId: project.templateId,
        aspectRatio: project.aspectRatio.preset,
        updatedAt: project.updatedAt,
      })),
    );
  } catch (error) {
    return toStudioToolError(error);
  }
}

async function handleDeleteProjectWithRuntime(
  args: Parameters<typeof handleDeleteProject>[0],
  runtime: McpToolRuntime,
): Promise<ToolResult> {
  if (!runtime.studioApi) return handleDeleteProject(args);

  try {
    await runtime.studioApi.deleteProject(args.projectId);
    return okResult({ deleted: true });
  } catch (error) {
    return toStudioToolError(error, {
      404: "PROJECT_NOT_FOUND",
      409: "PROJECT_HAS_ACTIVE_RENDER",
    });
  }
}

async function handleDuplicateProjectWithRuntime(
  args: Parameters<typeof handleDuplicateProject>[0],
  runtime: McpToolRuntime,
): Promise<ToolResult> {
  if (!runtime.studioApi) return handleDuplicateProject(args);

  try {
    return okResult(
      await runtime.studioApi.duplicateProject(args.projectId, { name: args.newName }),
    );
  } catch (error) {
    return toStudioToolError(error, { 404: "PROJECT_NOT_FOUND" });
  }
}

async function handlePreviewUrlWithRuntime(
  args: Parameters<typeof handlePreviewUrl>[0],
  runtime: McpToolRuntime,
): Promise<ToolResult> {
  if (!runtime.studioApi) return handlePreviewUrl(args);

  try {
    const project = await runtime.studioApi.getProject(args.projectId);
    return okResult({
      url: `${runtime.previewBaseUrl}/editor/${project.templateId}/${project.id}`,
    });
  } catch (error) {
    return toStudioToolError(error, { 404: "PROJECT_NOT_FOUND" });
  }
}

async function handleRenderProjectWithRuntime(
  args: Parameters<typeof handleRenderProject>[0],
  runtime: McpToolRuntime,
): Promise<ToolResult> {
  if (!runtime.studioApi) return handleRenderProject(args);

  try {
    return okResult(
      await runtime.studioApi.renderProject(args.projectId, {
        codec: args.codec,
        quality: args.quality,
      }),
    );
  } catch (error) {
    return toStudioToolError(error, { 404: "PROJECT_NOT_FOUND" });
  }
}

async function handleGetRenderStatusWithRuntime(
  args: Parameters<typeof handleGetRenderStatus>[0],
  runtime: McpToolRuntime,
): Promise<ToolResult> {
  if (!runtime.studioApi) return handleGetRenderStatus(args);

  try {
    return okResult(await runtime.studioApi.getRender(args.jobId));
  } catch (error) {
    return toStudioToolError(error, { 404: "JOB_NOT_FOUND" });
  }
}

async function handleCancelRenderWithRuntime(
  args: Parameters<typeof handleCancelRender>[0],
  runtime: McpToolRuntime,
): Promise<ToolResult> {
  if (!runtime.studioApi) return handleCancelRender(args);

  try {
    const result = await runtime.studioApi.cancelRender(args.jobId);
    return okResult({ cancelled: result.success });
  } catch (error) {
    return toStudioToolError(error, { 404: "JOB_NOT_FOUND" });
  }
}

async function handleListRendersWithRuntime(
  args: Parameters<typeof handleListRenders>[0],
  runtime: McpToolRuntime,
): Promise<ToolResult> {
  if (!runtime.studioApi) return handleListRenders(args);

  try {
    return okResult(await runtime.studioApi.listRenders(args));
  } catch (error) {
    return toStudioToolError(error);
  }
}

async function handleListAssetsWithRuntime(
  args: Parameters<typeof handleListAssets>[0],
  runtime: McpToolRuntime,
): Promise<ToolResult> {
  if (!runtime.studioApi) return handleListAssets(args);

  try {
    return okResult(await runtime.studioApi.listAssets(args));
  } catch (error) {
    return toStudioToolError(error, {
      400: "INVALID_ASSET_TYPE",
    });
  }
}

async function handleGetAssetWithRuntime(
  args: Parameters<typeof handleGetAsset>[0],
  runtime: McpToolRuntime,
): Promise<ToolResult> {
  if (!runtime.studioApi) return handleGetAsset(args);

  try {
    return okResult(await runtime.studioApi.getAsset(args.assetId));
  } catch (error) {
    return toStudioToolError(error, { 404: "ASSET_NOT_FOUND" });
  }
}

async function handleDeleteAssetWithRuntime(
  args: Parameters<typeof handleDeleteAsset>[0],
  runtime: McpToolRuntime,
): Promise<ToolResult> {
  if (!runtime.studioApi) return handleDeleteAsset(args);

  try {
    await runtime.studioApi.deleteAsset(args.assetId);
    return okResult({ deleted: true, assetId: args.assetId });
  } catch (error) {
    return toStudioToolError(error, {
      404: "ASSET_NOT_FOUND",
      409: "ASSET_IN_USE",
    });
  }
}

async function handleRegisterAssetWithRuntime(
  args: Parameters<typeof handleRegisterAsset>[0],
  runtime: McpToolRuntime,
): Promise<ToolResult> {
  if (!runtime.studioApi) return handleRegisterAsset(args);

  try {
    return okResult(await runtime.studioApi.registerAsset(args));
  } catch (error) {
    return toStudioToolError(error, {
      400: "VALIDATION_ERROR",
      404: "ASSET_NOT_FOUND",
      409: "ASSET_ALREADY_EXISTS",
    });
  }
}

async function handleCreateSceneSequenceWithRuntime(
  args: Parameters<typeof handleCreateSceneSequence>[0],
  runtime: McpToolRuntime,
): Promise<ToolResult> {
  if (!runtime.studioApi) return handleCreateSceneSequence(args);

  if (args.templateId !== "prompt-to-video") {
    return errorResult(
      "INVALID_TEMPLATE",
      `create_scene_sequence only works with templateId "prompt-to-video", got "${args.templateId}"`,
    );
  }

  if (!args.scenes?.length) {
    return errorResult("VALIDATION_ERROR", "scenes array is required and must not be empty");
  }

  return handleCreateProjectWithRuntime(
    {
      templateId: args.templateId,
      name: args.name,
      inputProps: { scenes: args.scenes },
      aspectRatio: args.aspectRatio,
    },
    runtime,
  );
}

async function handleUpdateSceneWithRuntime(
  args: Parameters<typeof handleUpdateScene>[0],
  runtime: McpToolRuntime,
): Promise<ToolResult> {
  if (!runtime.studioApi) return handleUpdateScene(args);

  try {
    const project = await runtime.studioApi.getProject(args.projectId);
    const scenes = project.inputProps.scenes;

    if (!Array.isArray(scenes)) {
      return errorResult("INVALID_PROJECT", "Project does not have a scenes array in inputProps");
    }

    if (args.sceneIndex < 0 || args.sceneIndex >= scenes.length) {
      return errorResult(
        "INVALID_SCENE_INDEX",
        `Scene index ${args.sceneIndex} out of range (0-${scenes.length - 1})`,
      );
    }

    const nextScenes = scenes.map((scene, index) =>
      index === args.sceneIndex
        ? { ...(scene as Record<string, unknown>), ...args.sceneUpdates }
        : scene,
    );

    return okResult(
      await runtime.studioApi.updateProject(args.projectId, {
        inputProps: { ...project.inputProps, scenes: nextScenes },
      }),
    );
  } catch (error) {
    return toStudioToolError(error, { 404: "PROJECT_NOT_FOUND" });
  }
}

function okResult(data: unknown): ToolResult {
  return {
    content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
  };
}

function errorResult(
  code: string,
  message: string,
  details?: Record<string, unknown>,
): ToolResult {
  return {
    content: [
      {
        type: "text",
        text: JSON.stringify({ error: { code, message, ...(details ? { details } : {}) } }),
      },
    ],
    isError: true,
  };
}

function toStudioToolError(
  error: unknown,
  statusCodeMap: Partial<Record<number, string>> = {},
): ToolResult {
  if (error instanceof StudioApiError) {
    const message = getStudioErrorMessage(error.body) ?? error.message;
    const details = getStudioErrorDetails(error.body);
    return errorResult(statusCodeMap[error.status] ?? "STUDIO_API_ERROR", message, details);
  }

  return errorResult(
    "STUDIO_API_ERROR",
    error instanceof Error ? error.message : String(error),
  );
}

function getStudioErrorMessage(body: unknown): string | undefined {
  if (body && typeof body === "object") {
    const record = body as Record<string, unknown>;
    if (typeof record.error === "string") return record.error;
  }

  return typeof body === "string" ? body : undefined;
}

function getStudioErrorDetails(body: unknown): Record<string, unknown> | undefined {
  if (!body || typeof body !== "object" || Array.isArray(body)) return undefined;
  const record = body as Record<string, unknown>;
  return Object.keys(record).length > 0 ? record : undefined;
}
