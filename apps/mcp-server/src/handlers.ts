import { z } from "zod";
import {
  getTemplate,
  getTemplateManifests,
  validateInputProps,
} from "@studio/template-registry";
import type {
  AspectRatioPreset,
  Project,
  RenderJob,
  ExportFormat,
  Asset,
  AssetType,
} from "@studio/shared-types";
import {
  ASPECT_RATIO_PRESETS,
  DEFAULT_ASPECT_RATIO_PRESET,
  normalizeAspectRatioConfig,
  QUALITY_CRF,
  AssetTypeSchema,
} from "@studio/shared-types";

// ─── Types ───────────────────────────────────────────────────────

export interface ToolResult {
  [key: string]: unknown;
  content: { type: "text"; text: string }[];
  isError?: boolean;
}

// ─── Shared in-memory stores ─────────────────────────────────────

export const projectStore = new Map<string, Project>();
export const renderJobStore = new Map<string, RenderJob>();
export const assetStore = new Map<string, Asset>();

export function clearStores() {
  projectStore.clear();
  renderJobStore.clear();
  assetStore.clear();
}

/** Pseudo-UUID generator (no external dependency) */
export function generateId(): string {
  const hex = () => Math.floor(Math.random() * 0xffff).toString(16).padStart(4, "0");
  return `${hex()}${hex()}-${hex()}-4${hex().slice(1)}-a${hex().slice(1)}-${hex()}${hex()}${hex()}`;
}

// ─── Error helpers ───────────────────────────────────────────────

function errorResult(
  code: string,
  message: string,
  details?: Record<string, unknown>,
): ToolResult {
  return {
    content: [
      {
        type: "text" as const,
        text: JSON.stringify({ error: { code, message, ...(details ? { details } : {}) } }),
      },
    ],
    isError: true,
  };
}

function okResult(data: unknown): ToolResult {
  return {
    content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }],
  };
}

// ─── Tool handlers ───────────────────────────────────────────────

export async function handleListTemplates(): Promise<ToolResult> {
  const manifests = getTemplateManifests();
  return okResult(
    manifests.map((m) => ({
      id: m.id,
      name: m.name,
      description: m.description,
      category: m.category,
      tags: m.tags,
      supportedAspectRatios: m.supportedAspectRatios,
      defaultDurationInFrames: m.defaultDurationInFrames,
      defaultFps: m.defaultFps,
    })),
  );
}

export async function handleGetTemplate(args: { templateId: string }): Promise<ToolResult> {
  const template = getTemplate(args.templateId);
  if (!template) {
    return errorResult("TEMPLATE_NOT_FOUND", `Template "${args.templateId}" not found`);
  }
  const m = template.manifest;
  return okResult({
    id: m.id,
    name: m.name,
    description: m.description,
    category: m.category,
    tags: m.tags,
    supportedAspectRatios: m.supportedAspectRatios,
    defaultDurationInFrames: m.defaultDurationInFrames,
    defaultFps: m.defaultFps,
    thumbnailFrame: m.thumbnailFrame,
    compositionId: m.compositionId,
  });
}

export async function handleCreateProject(args: {
  templateId: string;
  name: string;
  inputProps?: Record<string, unknown>;
  aspectRatio?: string;
}): Promise<ToolResult> {
  const { templateId, name, inputProps, aspectRatio } = args;

  const template = getTemplate(templateId);
  if (!template) {
    return errorResult("TEMPLATE_NOT_FOUND", `Template "${templateId}" not found`);
  }

  const props = inputProps ?? template.manifest.defaultProps;
  const validation = validateInputProps(templateId, props as Record<string, unknown>);
  if (!validation.success) {
    return errorResult("VALIDATION_ERROR", `Validation failed: ${validation.error}`);
  }

  const fallbackPreset =
    (template.manifest.supportedAspectRatios[0] ?? DEFAULT_ASPECT_RATIO_PRESET) as Exclude<
      AspectRatioPreset,
      "custom"
    >;
  const resolvedAspectRatio = normalizeAspectRatioConfig(aspectRatio, undefined, fallbackPreset);

  const project: Project = {
    id: generateId(),
    name,
    templateId,
    inputProps: validation.data,
    aspectRatio: resolvedAspectRatio,
    exportFormat: {
      codec: "h264",
      fileExtension: ".mp4",
      crf: QUALITY_CRF.standard,
      fps: template.manifest.defaultFps,
      scale: 1,
    },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    version: 1,
  };

  projectStore.set(project.id, project);
  return okResult(project);
}

export async function handleUpdateProject(args: {
  projectId: string;
  name?: string;
  inputProps?: Record<string, unknown>;
  aspectRatio?: string;
}): Promise<ToolResult> {
  const { projectId, name, inputProps, aspectRatio } = args;

  const project = projectStore.get(projectId);
  if (!project) {
    return errorResult("PROJECT_NOT_FOUND", `Project "${projectId}" not found`);
  }

  if (name) project.name = name;

  if (inputProps) {
    const validation = validateInputProps(project.templateId, inputProps);
    if (!validation.success) {
      return errorResult("VALIDATION_ERROR", `Validation failed: ${validation.error}`);
    }
    project.inputProps = validation.data;
  }

  if (aspectRatio) {
    const fallbackPreset =
      (getTemplate(project.templateId)?.manifest.supportedAspectRatios[0] ??
        DEFAULT_ASPECT_RATIO_PRESET) as Exclude<AspectRatioPreset, "custom">;
    project.aspectRatio = normalizeAspectRatioConfig(aspectRatio, project.aspectRatio, fallbackPreset);
  }

  project.updatedAt = new Date().toISOString();
  project.version++;
  projectStore.set(projectId, project);
  return okResult(project);
}

export async function handleGetProject(args: { projectId: string }): Promise<ToolResult> {
  const project = projectStore.get(args.projectId);
  if (!project) {
    return errorResult("PROJECT_NOT_FOUND", `Project "${args.projectId}" not found`);
  }
  return okResult(project);
}

export async function handleListProjects(args: { templateId?: string } = {}): Promise<ToolResult> {
  let projects = Array.from(projectStore.values());
  if (args.templateId) {
    projects = projects.filter((p) => p.templateId === args.templateId);
  }
  return okResult(
    projects.map((p) => ({
      id: p.id,
      name: p.name,
      templateId: p.templateId,
      aspectRatio: p.aspectRatio.preset,
      updatedAt: p.updatedAt,
    })),
  );
}

export async function handleDeleteProject(args: { projectId: string }): Promise<ToolResult> {
  if (!projectStore.has(args.projectId)) {
    return errorResult("PROJECT_NOT_FOUND", `Project "${args.projectId}" not found`);
  }
  // Check for active renders
  const activeRender = Array.from(renderJobStore.values()).find(
    (j) =>
      j.projectId === args.projectId &&
      (j.status === "queued" || j.status === "bundling" || j.status === "rendering" || j.status === "encoding"),
  );
  if (activeRender) {
    return errorResult(
      "PROJECT_HAS_ACTIVE_RENDER",
      `Project has an active render job: ${activeRender.id}`,
      { jobId: activeRender.id },
    );
  }
  projectStore.delete(args.projectId);
  return okResult({ deleted: true });
}

export async function handleDuplicateProject(args: {
  projectId: string;
  newName?: string;
}): Promise<ToolResult> {
  const original = projectStore.get(args.projectId);
  if (!original) {
    return errorResult("PROJECT_NOT_FOUND", `Project "${args.projectId}" not found`);
  }
  const copy: Project = {
    ...original,
    id: generateId(),
    name: args.newName ?? `${original.name} (copy)`,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    version: 1,
  };
  projectStore.set(copy.id, copy);
  return okResult(copy);
}

export async function handleRenderProject(args: {
  projectId: string;
  codec?: string;
  quality?: string;
}): Promise<ToolResult> {
  const { projectId, codec, quality } = args;

  const project = projectStore.get(projectId);
  if (!project) {
    return errorResult("PROJECT_NOT_FOUND", `Project "${projectId}" not found`);
  }

  const exportFormat: ExportFormat = {
    ...project.exportFormat,
    ...(codec && { codec: codec as ExportFormat["codec"] }),
    ...(quality && { crf: QUALITY_CRF[quality as keyof typeof QUALITY_CRF] }),
  };

  const template = getTemplate(project.templateId);
  const compositionId = template?.manifest.compositionId ?? project.templateId;

  const job: RenderJob = {
    id: generateId(),
    projectId,
    templateId: compositionId,
    inputProps: project.inputProps,
    exportFormat,
    aspectRatio: project.aspectRatio,
    status: "queued",
    progress: null,
    outputPath: null,
    error: null,
    createdAt: new Date().toISOString(),
    startedAt: null,
    completedAt: null,
  };

  renderJobStore.set(job.id, job);
  return okResult(job);
}

export async function handleGetRenderStatus(args: { jobId: string }): Promise<ToolResult> {
  const job = renderJobStore.get(args.jobId);
  if (!job) {
    return errorResult("JOB_NOT_FOUND", `Render job "${args.jobId}" not found`);
  }
  return okResult(job);
}

export async function handleCancelRender(args: { jobId: string }): Promise<ToolResult> {
  const job = renderJobStore.get(args.jobId);
  if (!job) {
    return errorResult("JOB_NOT_FOUND", `Render job "${args.jobId}" not found`);
  }
  if (job.status === "complete" || job.status === "error" || job.status === "cancelled") {
    return errorResult(
      "JOB_NOT_CANCELLABLE",
      `Job "${args.jobId}" is already in terminal state: ${job.status}`,
    );
  }
  job.status = "cancelled";
  job.completedAt = new Date().toISOString();
  renderJobStore.set(args.jobId, job);
  return okResult({ cancelled: true });
}

export async function handleListRenders(
  args: { projectId?: string; status?: string } = {},
): Promise<ToolResult> {
  let jobs = Array.from(renderJobStore.values());
  if (args.projectId) jobs = jobs.filter((j) => j.projectId === args.projectId);
  if (args.status) jobs = jobs.filter((j) => j.status === args.status);
  return okResult({ jobs });
}

export async function handleListAspectRatios(): Promise<ToolResult> {
  const presets = Object.entries(ASPECT_RATIO_PRESETS).map(([id, preset]) => ({
    id,
    label: preset.label,
    width: preset.width,
    height: preset.height,
    platform: preset.platform,
    description: preset.description,
    ratio: preset.ratio,
  }));
  return okResult({ presets });
}

export async function handlePreviewUrl(args: { projectId: string }): Promise<ToolResult> {
  const project = projectStore.get(args.projectId);
  if (!project) {
    return errorResult("PROJECT_NOT_FOUND", `Project "${args.projectId}" not found`);
  }
  // Return the editor URL for the project
  const url = `http://localhost:3000/editor/${project.templateId}/${project.id}`;
  return okResult({ url });
}

export async function handleExportFormats(): Promise<ToolResult> {
  const formats = {
    // Legacy flat codecs map (kept for backwards compatibility)
    codecs: {
      h264: { extension: ".mp4", crfRange: "1-51", description: "Most compatible" },
      h265: { extension: ".mp4", crfRange: "0-51", description: "Better compression" },
      vp8: { extension: ".webm", crfRange: "4-63", description: "WebM legacy" },
      vp9: { extension: ".webm", crfRange: "0-63", description: "WebM modern" },
      av1: { extension: ".webm", crfRange: "0-63", description: "Best compression" },
      prores: { extension: ".mov", description: "Professional, lossless" },
      gif: { extension: ".gif", description: "Animated GIF" },
    },
    // Spec-compliant formats array
    formats: [
      { id: "mp4-h264", label: "MP4 H.264", codec: "h264", container: "mp4", qualityOptions: ["draft", "standard", "high", "max"] },
      { id: "mp4-h265", label: "MP4 H.265", codec: "h265", container: "mp4", qualityOptions: ["draft", "standard", "high", "max"] },
      { id: "webm-vp8", label: "WebM VP8", codec: "vp8", container: "webm", qualityOptions: ["draft", "standard", "high", "max"] },
      { id: "webm-vp9", label: "WebM VP9", codec: "vp9", container: "webm", qualityOptions: ["draft", "standard", "high", "max"] },
      { id: "prores", label: "ProRes", codec: "prores", container: "mov", qualityOptions: ["standard", "high", "max"] },
      { id: "gif", label: "Animated GIF", codec: "gif", container: "gif", qualityOptions: ["draft", "standard"] },
    ],
    qualityPresets: QUALITY_CRF,
    fpsOptions: [24, 25, 30, 60],
  };
  return okResult(formats);
}

// ─── Asset tools ─────────────────────────────────────────────────

export async function handleListAssets(
  args: { type?: string; search?: string } = {},
): Promise<ToolResult> {
  let assets = Array.from(assetStore.values());

  if (args.type) {
    const parsed = AssetTypeSchema.safeParse(args.type);
    if (!parsed.success) {
      return errorResult(
        "INVALID_ASSET_TYPE",
        `Invalid asset type "${args.type}". Must be one of: image, video, audio, font`,
      );
    }
    assets = assets.filter((a) => a.type === parsed.data);
  }

  if (args.search) {
    const q = args.search.trim().toLowerCase();
    assets = assets.filter((a) => a.name.toLowerCase().includes(q));
  }

  assets.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return okResult({ assets });
}

export async function handleGetAsset(args: { assetId: string }): Promise<ToolResult> {
  const asset = assetStore.get(args.assetId);
  if (!asset) {
    return errorResult("ASSET_NOT_FOUND", `Asset "${args.assetId}" not found`);
  }
  return okResult(asset);
}

export async function handleDeleteAsset(args: { assetId: string }): Promise<ToolResult> {
  const asset = assetStore.get(args.assetId);
  if (!asset) {
    return errorResult("ASSET_NOT_FOUND", `Asset "${args.assetId}" not found`);
  }

  // Prevent deletion if any project references this asset
  const referencingProjects = Array.from(projectStore.values()).filter((project) =>
    hasAssetReference(project.inputProps, args.assetId),
  );

  if (referencingProjects.length > 0) {
    return errorResult(
      "ASSET_IN_USE",
      `Asset "${args.assetId}" is referenced by ${referencingProjects.length} project(s)`,
      { projectIds: referencingProjects.map((p) => p.id) },
    );
  }

  assetStore.delete(args.assetId);
  return okResult({ deleted: true, assetId: args.assetId });
}

/** Register an asset record in the MCP server's in-memory store.
 *  The actual file must already exist on disk (e.g. uploaded via the HTTP API).
 */
export async function handleRegisterAsset(args: {
  id: string;
  name: string;
  type: string;
  path: string;
  mimeType: string;
  sizeBytes: number;
}): Promise<ToolResult> {
  const typeResult = AssetTypeSchema.safeParse(args.type);
  if (!typeResult.success) {
    return errorResult(
      "INVALID_ASSET_TYPE",
      `Invalid asset type "${args.type}". Must be one of: image, video, audio, font`,
    );
  }

  if (!args.id || !args.name || !args.path || !args.mimeType) {
    return errorResult("VALIDATION_ERROR", "id, name, path, and mimeType are required");
  }

  if (assetStore.has(args.id)) {
    return errorResult("ASSET_ALREADY_EXISTS", `Asset with id "${args.id}" already exists`);
  }

  const asset: Asset = {
    id: args.id,
    name: args.name,
    type: typeResult.data,
    path: args.path,
    mimeType: args.mimeType,
    size: args.sizeBytes,
    sizeBytes: args.sizeBytes,
    createdAt: new Date().toISOString(),
  };

  assetStore.set(asset.id, asset);
  return okResult(asset);
}

// ─── Recursive asset reference checker ──────────────────────────

function hasAssetReference(value: unknown, assetId: string): boolean {
  if (typeof value === "string") return value === assetId;
  if (Array.isArray(value)) return value.some((v) => hasAssetReference(v, assetId));
  if (value !== null && typeof value === "object") {
    return Object.values(value as Record<string, unknown>).some((v) =>
      hasAssetReference(v, assetId),
    );
  }
  return false;
}

// ─── TikTok Caption tool: split transcript to captions ──────────

export async function handleSplitTranscriptToCaptions(args: {
  transcript: string;
  wordsPerCaption?: number;
  totalDurationFrames?: number;
  fps?: number;
}): Promise<ToolResult> {
  const { transcript, wordsPerCaption = 4, totalDurationFrames = 300, fps = 30 } = args;

  if (!transcript || !transcript.trim()) {
    return errorResult("VALIDATION_ERROR", "transcript is required and must not be empty");
  }

  const words = transcript.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) {
    return okResult({ captions: [] });
  }

  const captions: Array<{ text: string; startFrame: number; endFrame: number }> = [];
  const totalChars = words.join(" ").length;
  let charIndex = 0;

  for (let i = 0; i < words.length; i += wordsPerCaption) {
    const chunk = words.slice(i, i + wordsPerCaption);
    const text = chunk.join(" ");

    const startFraction = charIndex / totalChars;
    charIndex += text.length + (i + wordsPerCaption < words.length ? 1 : 0);
    const endFraction = charIndex / totalChars;

    const startFrame = Math.round(startFraction * totalDurationFrames);
    const endFrame = Math.round(endFraction * totalDurationFrames);

    captions.push({ text, startFrame, endFrame });
  }

  return okResult({ captions });
}

// ─── Prompt-to-Video tools ──────────────────────────────────────

interface GeneratedScene {
  title: string;
  body: string;
  imageUrl: string;
  durationFrames: number;
  enterTransition: string;
  exitTransition: string;
  voiceoverText: string;
}

export async function handleGenerateVideoScript(args: {
  prompt: string;
  sceneCount?: number;
  style?: string;
}): Promise<ToolResult> {
  const { prompt, sceneCount = 5, style } = args;

  if (!prompt || !prompt.trim()) {
    return errorResult("VALIDATION_ERROR", "prompt is required and must not be empty");
  }

  // Split prompt into sentences and create scenes
  const sentences = prompt
    .split(/[.!?]+/)
    .map((s) => s.trim())
    .filter(Boolean);

  const scenes: GeneratedScene[] = [];
  const perScene = Math.max(1, Math.ceil(sentences.length / sceneCount));

  for (let i = 0; i < sceneCount; i++) {
    const chunk = sentences.slice(i * perScene, (i + 1) * perScene);
    const body = chunk.join(". ") || `Scene ${i + 1}`;
    scenes.push({
      title: `Scene ${i + 1}`,
      body: body + (body.endsWith(".") ? "" : "."),
      imageUrl: "",
      durationFrames: 150,
      enterTransition: style === "fast" ? "swipe" : "fade",
      exitTransition: style === "fast" ? "swipe" : "fade",
      voiceoverText: body,
    });
  }

  return okResult({ scenes });
}

export async function handleCreateSceneSequence(args: {
  templateId: string;
  name: string;
  scenes: Array<{
    title: string;
    body: string;
    imageUrl?: string;
    durationFrames?: number;
    enterTransition?: string;
    exitTransition?: string;
    voiceoverText?: string;
  }>;
  aspectRatio?: string;
}): Promise<ToolResult> {
  const { templateId, name, scenes, aspectRatio } = args;

  if (templateId !== "prompt-to-video") {
    return errorResult(
      "INVALID_TEMPLATE",
      `create_scene_sequence only works with templateId "prompt-to-video", got "${templateId}"`,
    );
  }

  if (!scenes || scenes.length === 0) {
    return errorResult("VALIDATION_ERROR", "scenes array is required and must not be empty");
  }

  // Delegate to create_project with constructed inputProps
  return handleCreateProject({
    templateId,
    name,
    inputProps: { scenes },
    aspectRatio,
  });
}

export async function handleUpdateScene(args: {
  projectId: string;
  sceneIndex: number;
  sceneUpdates: Record<string, unknown>;
}): Promise<ToolResult> {
  const { projectId, sceneIndex, sceneUpdates } = args;

  const project = projectStore.get(projectId);
  if (!project) {
    return errorResult("PROJECT_NOT_FOUND", `Project "${projectId}" not found`);
  }

  const scenes = project.inputProps.scenes as GeneratedScene[] | undefined;
  if (!scenes || !Array.isArray(scenes)) {
    return errorResult("INVALID_PROJECT", "Project does not have a scenes array in inputProps");
  }

  if (sceneIndex < 0 || sceneIndex >= scenes.length) {
    return errorResult(
      "INVALID_SCENE_INDEX",
      `Scene index ${sceneIndex} out of range (0-${scenes.length - 1})`,
    );
  }

  scenes[sceneIndex] = { ...scenes[sceneIndex], ...sceneUpdates } as GeneratedScene;
  project.inputProps.scenes = scenes;
  project.updatedAt = new Date().toISOString();
  project.version++;
  projectStore.set(projectId, project);

  return okResult(project);
}

// ─── Template Creator tools ─────────────────────────────────────

interface FieldSchema {
  key: string;
  type: string;
  label: string;
  description: string;
  required: boolean;
  defaultValue?: unknown;
  validation?: Record<string, unknown>;
}

/** In-memory store for user-created template scaffolds */
export const templateScaffoldStore = new Map<
  string,
  { compositionCode: string; schemaCode: string }
>();

export async function handleCreateTemplate(args: {
  name: string;
  description: string;
  category: string;
  fields: FieldSchema[];
  supportedAspectRatios: string[];
  defaultAspectRatio: string;
  defaultDurationFrames: number;
  defaultFps: number;
}): Promise<ToolResult> {
  const {
    name,
    description,
    category,
    fields,
    supportedAspectRatios,
    defaultAspectRatio,
    defaultDurationFrames,
    defaultFps,
  } = args;

  if (!name || !name.trim()) {
    return errorResult("VALIDATION_ERROR", "name is required");
  }

  const id = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

  // Check if template already exists
  if (getTemplate(id)) {
    return errorResult("TEMPLATE_EXISTS", `Template "${id}" already exists`);
  }

  // Generate Zod schema code from fields
  const schemaLines = fields.map((f) => {
    let zodType: string;
    switch (f.type) {
      case "number":
        zodType = "z.number()";
        if (f.validation?.min !== undefined) zodType += `.min(${f.validation.min})`;
        if (f.validation?.max !== undefined) zodType += `.max(${f.validation.max})`;
        break;
      case "boolean":
        zodType = "z.boolean()";
        break;
      case "color":
        zodType = "z.string()";
        break;
      case "asset-image":
      case "asset-audio":
      case "asset-video":
        zodType = "z.string()";
        break;
      case "string-array":
        zodType = "z.array(z.string())";
        break;
      case "asset-image-array":
        zodType = "z.array(z.string())";
        break;
      default:
        zodType = "z.string()";
        if (f.validation?.maxLength) zodType += `.max(${f.validation.maxLength})`;
        break;
    }
    if (f.defaultValue !== undefined) {
      zodType += `.default(${JSON.stringify(f.defaultValue)})`;
    } else if (!f.required) {
      zodType += `.optional()`;
    }
    return `  ${f.key}: ${zodType},`;
  });

  const schemaCode = [
    `import { z } from "zod";`,
    ``,
    `export const schema = z.object({`,
    ...schemaLines,
    `});`,
    ``,
    `export type Props = z.infer<typeof schema>;`,
  ].join("\n");

  const compositionCode = [
    `import { useCurrentFrame, useVideoConfig, interpolate } from "remotion";`,
    `import type { Props } from "./schema";`,
    ``,
    `export const ${name.replace(/[^a-zA-Z0-9]/g, "")}Template: React.FC<Props> = (props) => {`,
    `  const frame = useCurrentFrame();`,
    `  const { width, height, fps, durationInFrames } = useVideoConfig();`,
    ``,
    `  return (`,
    `    <div style={{ width, height, background: "#000", color: "#fff",`,
    `                  display: "flex", alignItems: "center", justifyContent: "center" }}>`,
    `      <p style={{ fontSize: width * 0.05 }}>`,
    `        {JSON.stringify(props, null, 2)}`,
    `      </p>`,
    `    </div>`,
    `  );`,
    `};`,
  ].join("\n");

  // Store scaffold
  templateScaffoldStore.set(id, { compositionCode, schemaCode });

  // Build a dynamic Zod schema for the template
  const schemaObj: Record<string, z.ZodType> = {};
  for (const f of fields) {
    let zt: z.ZodType;
    switch (f.type) {
      case "number":
        zt = z.number();
        break;
      case "boolean":
        zt = z.boolean();
        break;
      default:
        zt = z.string();
        break;
    }
    schemaObj[f.key] = f.required ? zt : zt.optional();
  }
  const dynamicSchema = z.object(schemaObj);

  // Build default props
  const defaultProps: Record<string, unknown> = {};
  for (const f of fields) {
    if (f.defaultValue !== undefined) defaultProps[f.key] = f.defaultValue;
    else if (!f.required) defaultProps[f.key] = undefined;
    else if (f.type === "number") defaultProps[f.key] = 0;
    else if (f.type === "boolean") defaultProps[f.key] = false;
    else defaultProps[f.key] = "";
  }

  // Register template with a placeholder component
  const PlaceholderComponent: React.FC<Record<string, unknown>> = () => null;

  const { registerTemplate: regT } = await import("@studio/template-registry");
  regT({
    manifest: {
      id,
      name,
      description,
      category,
      tags: [category],
      defaultDurationInFrames: defaultDurationFrames,
      defaultFps: defaultFps,
      supportedAspectRatios: supportedAspectRatios as AspectRatioPreset[],
      propsSchema: dynamicSchema,
      defaultProps,
      thumbnailFrame: 0,
      compositionId: id,
    },
    component: PlaceholderComponent,
  });

  return okResult({
    template: {
      id,
      name,
      description,
      category,
      fields,
      supportedAspectRatios,
      defaultAspectRatio,
      defaultDurationFrames,
      defaultFps,
    },
  });
}

export async function handleUpdateTemplateSchema(args: {
  templateId: string;
  addFields?: FieldSchema[];
  removeFieldKeys?: string[];
}): Promise<ToolResult> {
  const { templateId, addFields, removeFieldKeys } = args;

  const template = getTemplate(templateId);
  if (!template) {
    return errorResult("TEMPLATE_NOT_FOUND", `Template "${templateId}" not found`);
  }

  const warnings: string[] = [];

  // Check for projects using removed fields
  if (removeFieldKeys && removeFieldKeys.length > 0) {
    const projects = Array.from(projectStore.values()).filter(
      (p) => p.templateId === templateId,
    );
    if (projects.length > 0) {
      warnings.push(
        `${projects.length} project(s) use this template. Removing fields may break them.`,
      );
    }
  }

  return okResult({
    template: {
      id: template.manifest.id,
      name: template.manifest.name,
      description: template.manifest.description,
    },
    warnings,
  });
}

export async function handleGetTemplateScaffold(args: {
  templateId: string;
}): Promise<ToolResult> {
  const scaffold = templateScaffoldStore.get(args.templateId);
  if (!scaffold) {
    return errorResult(
      "SCAFFOLD_NOT_FOUND",
      `No scaffold found for template "${args.templateId}". Use create_template first.`,
    );
  }

  return okResult({
    compositionCode: scaffold.compositionCode,
    schemaCode: scaffold.schemaCode,
  });
}

export async function handleUpdateTemplateComposition(args: {
  templateId: string;
  compositionCode: string;
}): Promise<ToolResult> {
  const { templateId, compositionCode } = args;

  const scaffold = templateScaffoldStore.get(templateId);
  if (!scaffold) {
    return errorResult(
      "SCAFFOLD_NOT_FOUND",
      `No scaffold found for template "${templateId}". Use create_template first.`,
    );
  }

  const warnings: string[] = [];

  // Basic heuristic check — not an AST parse, just a quick sanity test
  if (!compositionCode.includes("useCurrentFrame") && !compositionCode.includes("useVideoConfig")) {
    warnings.push("Composition does not use useCurrentFrame or useVideoConfig — is this intentional?");
  }

  // Update stored scaffold
  templateScaffoldStore.set(templateId, {
    ...scaffold,
    compositionCode,
  });

  return okResult({ success: true, warnings });
}

export async function handleValidateTemplate(args: {
  templateId: string;
  sampleInputProps?: Record<string, unknown>;
}): Promise<ToolResult> {
  const { templateId, sampleInputProps } = args;

  const template = getTemplate(templateId);
  if (!template) {
    return errorResult("TEMPLATE_NOT_FOUND", `Template "${templateId}" not found`);
  }

  const props = sampleInputProps ?? template.manifest.defaultProps;
  const validation = validateInputProps(templateId, props);

  if (!validation.success) {
    return okResult({
      valid: false,
      errors: [validation.error],
    });
  }

  return okResult({
    valid: true,
    frameCount: template.manifest.defaultDurationInFrames,
  });
}
