import { z } from "zod";

// ─── Aspect Ratio ────────────────────────────────────────────────

export const AspectRatioPresetSchema = z.enum([
  "16:9",
  "9:16",
  "1:1",
  "4:5",
  "4:3",
  "2:3",
  "21:9",
  "custom",
]);
export type AspectRatioPreset = z.infer<typeof AspectRatioPresetSchema>;

export interface AspectRatioConfig {
  preset: AspectRatioPreset;
  width: number;
  height: number;
}

export const ASPECT_RATIO_DIMENSIONS: Record<
  Exclude<AspectRatioPreset, "custom">,
  { width: number; height: number }
> = {
  "16:9": { width: 1920, height: 1080 },
  "9:16": { width: 1080, height: 1920 },
  "1:1": { width: 1080, height: 1080 },
  "4:5": { width: 1080, height: 1350 },
  "4:3": { width: 1440, height: 1080 },
  "2:3": { width: 1080, height: 1620 },
  "21:9": { width: 2560, height: 1080 },
};

// ─── Export Formats ──────────────────────────────────────────────

export const VideoCodecSchema = z.enum([
  "h264",
  "h265",
  "vp8",
  "vp9",
  "av1",
  "prores",
  "gif",
]);
export type VideoCodec = z.infer<typeof VideoCodecSchema>;

export const ProResProfileSchema = z.enum([
  "proxy",
  "light",
  "standard",
  "hq",
  "4444",
  "4444-xq",
]);
export type ProResProfile = z.infer<typeof ProResProfileSchema>;

export const QualityPresetSchema = z.enum(["draft", "standard", "high", "max"]);
export type QualityPreset = z.infer<typeof QualityPresetSchema>;

export interface ExportFormat {
  codec: VideoCodec;
  fileExtension: string;
  crf?: number;
  videoBitrate?: string;
  audioBitrate?: string;
  proResProfile?: ProResProfile;
  fps: number;
  scale: number;
}

export const QUALITY_CRF: Record<QualityPreset, number> = {
  draft: 28,
  standard: 18,
  high: 12,
  max: 1,
};

// ─── Template Manifest ───────────────────────────────────────────

export interface TemplateManifest {
  id: string;
  name: string;
  description: string;
  category: string;
  tags: string[];
  defaultDurationInFrames: number;
  defaultFps: number;
  supportedAspectRatios: AspectRatioPreset[];
  /** The Zod schema for inputProps, used for form generation and validation */
  propsSchema: z.ZodType;
  defaultProps: Record<string, unknown>;
  /** Thumbnail frame number for preview generation */
  thumbnailFrame: number;
  /** The React component ID used in Remotion <Composition> */
  compositionId: string;
}

// ─── Content Bundle ──────────────────────────────────────────────

export interface ContentBundle {
  texts: Record<string, string>;
  images: Record<string, string>;
  audio: Record<string, string>;
  videos: Record<string, string>;
  colors: Record<string, string>;
  fonts: Record<string, string>;
  data: Record<string, unknown>;
}

// ─── Render Job ──────────────────────────────────────────────────

export const RenderStatusSchema = z.enum([
  "queued",
  "bundling",
  "rendering",
  "encoding",
  "complete",
  "error",
  "cancelled",
]);
export type RenderStatus = z.infer<typeof RenderStatusSchema>;

export interface RenderProgress {
  progress: number; // 0-1
  renderedFrames: number;
  encodedFrames: number;
  totalFrames: number;
  stage: RenderStatus;
}

export interface RenderJob {
  id: string;
  projectId: string;
  templateId: string;
  inputProps: Record<string, unknown>;
  exportFormat: ExportFormat;
  aspectRatio: AspectRatioConfig;
  status: RenderStatus;
  progress: RenderProgress | null;
  outputPath: string | null;
  error: string | null;
  createdAt: string;
  startedAt: string | null;
  completedAt: string | null;
}

// ─── Project ─────────────────────────────────────────────────────

export interface Project {
  id: string;
  name: string;
  templateId: string;
  inputProps: Record<string, unknown>;
  aspectRatio: AspectRatioConfig;
  exportFormat: ExportFormat;
  createdAt: string;
  updatedAt: string;
  version: number;
}

// ─── Asset ───────────────────────────────────────────────────────

export const AssetTypeSchema = z.enum(["image", "video", "audio", "font"]);
export type AssetType = z.infer<typeof AssetTypeSchema>;

export interface Asset {
  id: string;
  name: string;
  type: AssetType;
  path: string;
  size: number;
  mimeType: string;
  createdAt: string;
}
