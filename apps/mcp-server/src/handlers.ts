import { z } from "zod";
import {
  getTemplate,
  getTemplateManifests,
  validateInputProps,
} from "@studio/template-registry";
import type { Project, RenderJob, ExportFormat } from "@studio/shared-types";
import { ASPECT_RATIO_DIMENSIONS, QUALITY_CRF } from "@studio/shared-types";

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

export function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

// ─── Tool handlers ───────────────────────────────────────────────

export async function handleListTemplates(): Promise<ToolResult> {
  const manifests = getTemplateManifests();
  return {
    content: [
      {
        type: "text" as const,
        text: JSON.stringify(
          manifests.map((m) => ({
            id: m.id,
            name: m.name,
            description: m.description,
            category: m.category,
            tags: m.tags,
            supportedAspectRatios: m.supportedAspectRatios,
          })),
          null,
          2,
        ),
      },
    ],
  };
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
    return {
      content: [{ type: "text" as const, text: `Error: Template "${templateId}" not found` }],
      isError: true,
    };
  }

  const props = inputProps ?? template.manifest.defaultProps;
  const validation = validateInputProps(templateId, props as Record<string, unknown>);
  if (!validation.success) {
    return {
      content: [{ type: "text" as const, text: `Validation error: ${validation.error}` }],
      isError: true,
    };
  }

  const arPreset = (aspectRatio ?? "16:9") as keyof typeof ASPECT_RATIO_DIMENSIONS;
  const dims = ASPECT_RATIO_DIMENSIONS[arPreset];

  const project: Project = {
    id: generateId(),
    name,
    templateId,
    inputProps: validation.data,
    aspectRatio: { preset: arPreset, ...dims },
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

  return {
    content: [{ type: "text" as const, text: JSON.stringify(project, null, 2) }],
  };
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
    return {
      content: [{ type: "text" as const, text: `Error: Project "${projectId}" not found` }],
      isError: true,
    };
  }

  if (name) project.name = name;

  if (inputProps) {
    const validation = validateInputProps(project.templateId, inputProps);
    if (!validation.success) {
      return {
        content: [{ type: "text" as const, text: `Validation error: ${validation.error}` }],
        isError: true,
      };
    }
    project.inputProps = validation.data;
  }

  if (aspectRatio) {
    const preset = aspectRatio as keyof typeof ASPECT_RATIO_DIMENSIONS;
    const dims = ASPECT_RATIO_DIMENSIONS[preset];
    project.aspectRatio = { preset, ...dims };
  }

  project.updatedAt = new Date().toISOString();
  project.version++;
  projectStore.set(projectId, project);

  return {
    content: [{ type: "text" as const, text: JSON.stringify(project, null, 2) }],
  };
}

export async function handleGetProject(args: { projectId: string }): Promise<ToolResult> {
  const project = projectStore.get(args.projectId);
  if (!project) {
    return {
      content: [{ type: "text" as const, text: `Error: Project "${args.projectId}" not found` }],
      isError: true,
    };
  }
  return { content: [{ type: "text" as const, text: JSON.stringify(project, null, 2) }] };
}

export async function handleListProjects(): Promise<ToolResult> {
  const allProjects = Array.from(projectStore.values());
  return {
    content: [
      {
        type: "text" as const,
        text: JSON.stringify(
          allProjects.map((p) => ({
            id: p.id,
            name: p.name,
            templateId: p.templateId,
            aspectRatio: p.aspectRatio.preset,
            updatedAt: p.updatedAt,
          })),
          null,
          2,
        ),
      },
    ],
  };
}

export async function handleRenderProject(args: {
  projectId: string;
  codec?: string;
  quality?: string;
}): Promise<ToolResult> {
  const { projectId, codec, quality } = args;

  const project = projectStore.get(projectId);
  if (!project) {
    return {
      content: [{ type: "text" as const, text: `Error: Project "${projectId}" not found` }],
      isError: true,
    };
  }

  const exportFormat: ExportFormat = {
    ...project.exportFormat,
    ...(codec && { codec: codec as ExportFormat["codec"] }),
    ...(quality && { crf: QUALITY_CRF[quality as keyof typeof QUALITY_CRF] }),
  };

  const job: RenderJob = {
    id: generateId(),
    projectId,
    templateId: project.templateId,
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

  return { content: [{ type: "text" as const, text: JSON.stringify(job, null, 2) }] };
}

export async function handleGetRenderStatus(args: { jobId: string }): Promise<ToolResult> {
  const job = renderJobStore.get(args.jobId);
  if (!job) {
    return {
      content: [{ type: "text" as const, text: `Error: Render job "${args.jobId}" not found` }],
      isError: true,
    };
  }
  return { content: [{ type: "text" as const, text: JSON.stringify(job, null, 2) }] };
}

export async function handleExportFormats(): Promise<ToolResult> {
  const formats = {
    codecs: {
      h264: { extension: ".mp4", crfRange: "1-51", description: "Most compatible" },
      h265: { extension: ".mp4", crfRange: "0-51", description: "Better compression" },
      vp8: { extension: ".webm", crfRange: "4-63", description: "WebM legacy" },
      vp9: { extension: ".webm", crfRange: "0-63", description: "WebM modern" },
      av1: { extension: ".webm", crfRange: "0-63", description: "Best compression" },
      prores: { extension: ".mov", description: "Professional, lossless" },
      gif: { extension: ".gif", description: "Animated GIF" },
    },
    qualityPresets: QUALITY_CRF,
    fpsOptions: [24, 25, 30, 50, 60],
  };
  return { content: [{ type: "text" as const, text: JSON.stringify(formats, null, 2) }] };
}
