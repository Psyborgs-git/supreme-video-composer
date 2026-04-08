import { z } from "zod";
import {
  ASPECT_RATIO_DIMENSIONS,
  type AspectRatioPreset,
  type Project,
} from "@studio/shared-types";
import {
  RULE_INDEX,
  RULE_REACT_CODE,
  RULE_REMOTION_ANIMATIONS,
  RULE_REMOTION_SEQUENCING,
  RULE_REMOTION_TEXT_ANIMATIONS,
  RULE_REMOTION_TIMING,
  RULE_REMOTION_TRANSITIONS,
  RULE_REMOTION_TRIMMING,
} from "./rules.js";
import {
  compileSessionProject,
  DEFAULT_META,
  formatZodIssues,
  getSessionProject,
  projectVideoSchema,
} from "./utils.js";
import type { VideoMeta, VideoProjectData } from "./types.js";
import type { McpToolRuntime } from "../runtime.js";
import { StudioApiError } from "../studio-api-client.js";

export interface ToolResult {
  [key: string]: unknown;
  content: { type: "text"; text: string }[];
  structuredContent?: Record<string, unknown>;
  isError?: boolean;
}

export interface CreateVideoArgs {
  files: string;
  entryFile?: string;
  projectId?: string;
  persistAsNew?: boolean;
  title?: string;
  compositionId?: string;
  durationInFrames?: number;
  fps?: number;
  width?: number;
  height?: number;
  defaultProps?: Record<string, unknown>;
  inputProps?: Record<string, unknown>;
}

interface ToolExtraLike {
  sessionId?: string;
}

const DYNAMIC_VIDEO_TEMPLATE_ID = "dynamic-video";
const MAX_PERSISTED_SESSION_PROJECTS = 250;
const sessionProjectIds = new Map<string, string>();

export function clearCreateVideoProjectSessions(): void {
  sessionProjectIds.clear();
}

function textResult(text: string): ToolResult {
  return {
    content: [{ type: "text", text }],
  };
}

function errorResult(code: string, message: string, details?: Record<string, unknown>): ToolResult {
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

function projectResult(
  text: string,
  videoProjectJson: string,
  extraStructuredContent: Record<string, unknown> = {},
): ToolResult {
  return {
    content: [{ type: "text", text }],
    structuredContent: {
      videoProject: videoProjectJson,
      ...extraStructuredContent,
    },
  };
}

function rememberProjectId(sessionId: string, projectId: string): void {
  if (!sessionId || !projectId) {
    return;
  }

  if (sessionProjectIds.has(sessionId)) {
    sessionProjectIds.delete(sessionId);
  }

  sessionProjectIds.set(sessionId, projectId);

  while (sessionProjectIds.size > MAX_PERSISTED_SESSION_PROJECTS) {
    const oldestKey = sessionProjectIds.keys().next().value;
    if (typeof oldestKey !== "string") {
      break;
    }
    sessionProjectIds.delete(oldestKey);
  }
}

function inferAspectRatioPreset(meta: VideoMeta): AspectRatioPreset {
  for (const [preset, dims] of Object.entries(ASPECT_RATIO_DIMENSIONS)) {
    if (dims.width === meta.width && dims.height === meta.height) {
      return preset as AspectRatioPreset;
    }
  }

  if (meta.width === meta.height) {
    return "instagram-post";
  }

  if (meta.height > meta.width) {
    return "tiktok";
  }

  return "youtube";
}

function buildDynamicVideoInput(projectData: VideoProjectData): Record<string, unknown> {
  return {
    meta: projectData.meta,
    bundle: projectData.bundle,
    defaultProps: projectData.defaultProps,
    inputProps: projectData.inputProps,
    ...(projectData.compileError ? { compileError: projectData.compileError } : {}),
    ...(projectData.sourceProject ? { sourceProject: projectData.sourceProject } : {}),
  };
}

function buildProjectPreviewUrl(runtime: McpToolRuntime, project: Project): string {
  return `${runtime.previewBaseUrl}/editor/${project.templateId}/${project.id}`;
}

async function persistGeneratedVideoProject(
  runtime: McpToolRuntime | undefined,
  sessionId: string,
  requestedProjectId: string | undefined,
  persistAsNew: boolean | undefined,
  projectData: VideoProjectData,
): Promise<
  | {
      project: Project;
      previewUrl: string;
    }
  | {
      warning: string;
    }
  | null
> {
  if (!runtime?.studioApi) {
    return {
      warning:
        "Studio persistence is unavailable because STUDIO_API_BASE_URL is not configured.",
    };
  }

  const inputProps = buildDynamicVideoInput(projectData);
  const projectName = projectData.meta.title;
  const targetProjectId = persistAsNew
    ? undefined
    : requestedProjectId?.trim() || sessionProjectIds.get(sessionId);
  const aspectRatio = inferAspectRatioPreset(projectData.meta);

  try {
    let project: Project;
    if (targetProjectId) {
      try {
        project = await runtime.studioApi.updateProject(targetProjectId, {
          name: projectName,
          inputProps,
          aspectRatio,
        });
      } catch (error) {
        if (!(error instanceof StudioApiError) || error.status !== 404) {
          throw error;
        }

        project = await runtime.studioApi.createProject({
          templateId: DYNAMIC_VIDEO_TEMPLATE_ID,
          name: projectName,
          inputProps,
          aspectRatio,
        });
      }
    } else {
      project = await runtime.studioApi.createProject({
        templateId: DYNAMIC_VIDEO_TEMPLATE_ID,
        name: projectName,
        inputProps,
        aspectRatio,
      });
    }

    rememberProjectId(sessionId, project.id);
    return {
      project,
      previewUrl: buildProjectPreviewUrl(runtime, project),
    };
  } catch (error) {
    return {
      warning: `Studio persistence failed: ${(error as Error).message}`,
    };
  }
}

function mergeProps(
  previous: Record<string, unknown> | undefined,
  next: Record<string, unknown> | undefined,
): Record<string, unknown> {
  return {
    ...(previous ?? {}),
    ...(next ?? {}),
  };
}

function parseFiles(raw: string): Record<string, string> | null {
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return null;
    }

    const fileMap = parsed as Record<string, unknown>;
    const normalizedEntries = Object.entries(fileMap).map(([key, value]) => [key, typeof value === "string" ? value : null] as const);
    if (normalizedEntries.some(([, value]) => value === null)) {
      return null;
    }

    return Object.fromEntries(normalizedEntries as Array<[string, string]>);
  } catch {
    return null;
  }
}

export async function handleReadMe(): Promise<ToolResult> {
  return textResult(RULE_INDEX);
}

export async function handleRuleReactCode(): Promise<ToolResult> {
  return textResult(RULE_REACT_CODE);
}

export async function handleRuleRemotionAnimations(): Promise<ToolResult> {
  return textResult(RULE_REMOTION_ANIMATIONS);
}

export async function handleRuleRemotionTiming(): Promise<ToolResult> {
  return textResult(RULE_REMOTION_TIMING);
}

export async function handleRuleRemotionSequencing(): Promise<ToolResult> {
  return textResult(RULE_REMOTION_SEQUENCING);
}

export async function handleRuleRemotionTransitions(): Promise<ToolResult> {
  return textResult(RULE_REMOTION_TRANSITIONS);
}

export async function handleRuleRemotionTextAnimations(): Promise<ToolResult> {
  return textResult(RULE_REMOTION_TEXT_ANIMATIONS);
}

export async function handleRuleRemotionTrimming(): Promise<ToolResult> {
  return textResult(RULE_REMOTION_TRIMMING);
}

export async function handleCreateVideo(
  rawParams: CreateVideoArgs,
  extra?: ToolExtraLike,
  runtime?: McpToolRuntime,
): Promise<ToolResult> {
  const sessionId = extra?.sessionId ?? "default";

  const files = parseFiles(rawParams.files);
  if (!files) {
    return errorResult(
      "INVALID_FILES_JSON",
      'files must be a valid JSON string mapping file paths to source code, for example: {"/src/Video.tsx":"...code..."}.',
    );
  }

  if (Object.keys(files).length === 0) {
    return errorResult("EMPTY_FILE_MAP", "files must contain at least one file entry.");
  }

  const previous = getSessionProject(sessionId);
  const mergedFiles = previous ? { ...previous.files, ...files } : files;
  const mergedDefaultProps = mergeProps(previous?.defaultProps, rawParams.defaultProps);
  const mergedInputProps = mergeProps(previous?.inputProps, rawParams.inputProps);

  const projectCandidate = {
    title: rawParams.title ?? previous?.title,
    compositionId: rawParams.compositionId ?? previous?.compositionId,
    width: rawParams.width ?? previous?.width,
    height: rawParams.height ?? previous?.height,
    fps: rawParams.fps ?? previous?.fps,
    durationInFrames: rawParams.durationInFrames ?? previous?.durationInFrames,
    entryFile: rawParams.entryFile ?? previous?.entryFile,
    files: mergedFiles,
    defaultProps: mergedDefaultProps,
    inputProps: mergedInputProps,
  };

  const parseResult = projectVideoSchema.safeParse(projectCandidate);
  if (!parseResult.success) {
    return errorResult("INVALID_VIDEO_PROJECT", `Invalid input: ${formatZodIssues(parseResult.error)}`);
  }

  const statusPrefixLines: string[] = [];
  if (previous) {
    statusPrefixLines.push("Merged with previous project.");
  }
  if (rawParams.defaultProps || rawParams.inputProps) {
    statusPrefixLines.push("Merged slot props into the previous project state.");
  }

  const compileResult = await compileSessionProject(parseResult.data, sessionId, statusPrefixLines);
  const persistence = await persistGeneratedVideoProject(
    runtime,
    sessionId,
    rawParams.projectId,
    rawParams.persistAsNew,
    compileResult.projectData,
  );

  const persistenceLines: string[] = [];
  const persistenceStructured: Record<string, unknown> = {};
  if (persistence && "warning" in persistence) {
    persistenceLines.push(persistence.warning);
    persistenceStructured.saveError = persistence.warning;
  }
  if (persistence && "project" in persistence) {
    persistenceLines.push(
      `${"error" in compileResult ? "Updated" : "Saved"} Studio project "${persistence.project.name}" (${persistence.project.id}).`,
    );
    persistenceLines.push(`Preview: ${persistence.previewUrl}`);
    persistenceStructured.projectId = persistence.project.id;
    persistenceStructured.previewUrl = persistence.previewUrl;
    persistenceStructured.savedProject = persistence.project;
  }

  if ("error" in compileResult) {
    return projectResult(
      [`Project error: ${compileResult.error}`, ...persistenceLines].join("\n"),
      JSON.stringify(compileResult.projectData),
      persistenceStructured,
    );
  }

  return projectResult(
    [...compileResult.statusLines, ...persistenceLines].join("\n"),
    JSON.stringify(compileResult.projectData),
    persistenceStructured,
  );
}

export const createVideoInputSchema = {
  files: z.string().describe(
    'REQUIRED. A JSON string of {path: code} mapping file paths to source code. Example: JSON.stringify({"/src/Video.tsx":"import {AbsoluteFill} from \\\"remotion\\\"; export default function Video(){return <AbsoluteFill/>;}"}). For edits, only include changed files — unchanged files are kept from the previous call.',
  ),
  entryFile: z.string().optional().describe('Entry file path (default: "/src/Video.tsx"). Must match a key in files or a previously supplied file.'),
  projectId: z.string().optional().describe("Optional persisted Studio project ID to update. If omitted, create_video updates the session's last saved generated project when available."),
  persistAsNew: z.boolean().optional().describe("When true, create_video always creates a new saved generated project instead of updating the session's most recent one. Use this to branch multiple videos from the same template code with different slot props."),
  title: z.string().optional().describe("Title shown in the video player"),
  compositionId: z.string().optional().describe("Composition ID exported by the entry module (default: Main)"),
  durationInFrames: z.number().optional().describe("Total duration in frames (default: 150)"),
  fps: z.number().optional().describe("Frames per second (default: 30)"),
  width: z.number().optional().describe("Width in pixels (default: 1920)"),
  height: z.number().optional().describe("Height in pixels (default: 1080)"),
  defaultProps: z.record(z.unknown()).optional().describe("Reusable slot defaults merged beneath inputProps"),
  inputProps: z.record(z.unknown()).optional().describe("Instance-specific props merged over defaultProps"),
};

export function buildCreateVideoDescription(): string {
  return [
    "Create or update a Remotion video from a multi-file React project.",
    "The files param is a JSON string mapping virtual file paths to source code.",
    'Pass it as: files: JSON.stringify({"/src/Video.tsx": "...your code..."}).',
    "For edits, only include changed files — previous files are preserved automatically.",
    "Set persistAsNew=true to save a fresh project variant instead of overwriting the current session project.",
    "When the Studio API is configured, the generated result is also persisted as a reusable Studio project and returned with a preview URL.",
    `Default fallback metadata is ${DEFAULT_META.width}x${DEFAULT_META.height}, ${DEFAULT_META.fps}fps, ${DEFAULT_META.durationInFrames} frames, compositionId=${DEFAULT_META.compositionId}.`,
  ].join(" ");
}
