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
} from "@studio/shared-types";
import {
  ASPECT_RATIO_PRESETS,
  DEFAULT_ASPECT_RATIO_PRESET,
  normalizeAspectRatioConfig,
  QUALITY_CRF,
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

export function clearStores() {
  projectStore.clear();
  renderJobStore.clear();
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
