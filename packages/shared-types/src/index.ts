import { z } from "zod";

// ─── Aspect Ratio ────────────────────────────────────────────────

export const CANONICAL_ASPECT_RATIO_PRESET_IDS = [
  "instagram-post",
  "instagram-reel",
  "youtube",
  "youtube-shorts",
  "twitter-post",
  "tiktok",
  "linkedin-post",
  "linkedin-landscape",
  "facebook-post",
  "pinterest",
  "square-hd",
  "landscape-hd",
] as const;

export const LEGACY_ASPECT_RATIO_PRESET_IDS = [
  "16:9",
  "9:16",
  "1:1",
  "4:5",
  "4:3",
  "2:3",
  "21:9",
] as const;

export const AspectRatioPresetSchema = z.enum([
  ...CANONICAL_ASPECT_RATIO_PRESET_IDS,
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

export const DEFAULT_ASPECT_RATIO_PRESET = "youtube" as const;

export interface AspectRatioPresetDefinition {
  label: string;
  width: number;
  height: number;
  platform: string;
  description: string;
  ratio: string;
}

export const ASPECT_RATIO_PRESETS: Record<
  (typeof CANONICAL_ASPECT_RATIO_PRESET_IDS)[number],
  AspectRatioPresetDefinition
> = {
  "instagram-post": {
    label: "Instagram Post",
    width: 1080,
    height: 1080,
    platform: "Instagram",
    description: "Square post optimized for the Instagram feed.",
    ratio: "1:1",
  },
  "instagram-reel": {
    label: "Instagram Reel",
    width: 1080,
    height: 1920,
    platform: "Instagram",
    description: "Vertical full-screen format for Reels and Stories.",
    ratio: "9:16",
  },
  youtube: {
    label: "YouTube",
    width: 1920,
    height: 1080,
    platform: "YouTube",
    description: "Standard widescreen video for YouTube.",
    ratio: "16:9",
  },
  "youtube-shorts": {
    label: "YouTube Shorts",
    width: 1080,
    height: 1920,
    platform: "YouTube",
    description: "Vertical Shorts format for mobile-first video.",
    ratio: "9:16",
  },
  "twitter-post": {
    label: "Twitter / X Post",
    width: 1280,
    height: 720,
    platform: "X / Twitter",
    description: "Landscape format for social posts on X.",
    ratio: "16:9",
  },
  tiktok: {
    label: "TikTok",
    width: 1080,
    height: 1920,
    platform: "TikTok",
    description: "Full-screen vertical format for TikTok videos.",
    ratio: "9:16",
  },
  "linkedin-post": {
    label: "LinkedIn Post",
    width: 1080,
    height: 1080,
    platform: "LinkedIn",
    description: "Square post format for LinkedIn feeds.",
    ratio: "1:1",
  },
  "linkedin-landscape": {
    label: "LinkedIn Landscape",
    width: 1200,
    height: 628,
    platform: "LinkedIn",
    description: "Landscape post format for link shares and wide banners.",
    ratio: "~16:9",
  },
  "facebook-post": {
    label: "Facebook Post",
    width: 1200,
    height: 630,
    platform: "Facebook",
    description: "Optimized landscape format for Facebook posts.",
    ratio: "~16:9",
  },
  pinterest: {
    label: "Pinterest Pin",
    width: 1000,
    height: 1500,
    platform: "Pinterest",
    description: "Tall portrait format for Pinterest pins.",
    ratio: "2:3",
  },
  "square-hd": {
    label: "Square HD",
    width: 2160,
    height: 2160,
    platform: "Generic",
    description: "High-resolution square format.",
    ratio: "1:1",
  },
  "landscape-hd": {
    label: "Landscape HD",
    width: 2560,
    height: 1440,
    platform: "Generic",
    description: "High-resolution 1440p landscape format.",
    ratio: "16:9",
  },
};

export interface AspectRatioConfig {
  preset: AspectRatioPreset;
  width: number;
  height: number;
}

export const ASPECT_RATIO_DIMENSIONS: Record<
  Exclude<AspectRatioPreset, "custom">,
  { width: number; height: number }
> = {
  "instagram-post": { width: 1080, height: 1080 },
  "instagram-reel": { width: 1080, height: 1920 },
  youtube: { width: 1920, height: 1080 },
  "youtube-shorts": { width: 1080, height: 1920 },
  "twitter-post": { width: 1280, height: 720 },
  tiktok: { width: 1080, height: 1920 },
  "linkedin-post": { width: 1080, height: 1080 },
  "linkedin-landscape": { width: 1200, height: 628 },
  "facebook-post": { width: 1200, height: 630 },
  pinterest: { width: 1000, height: 1500 },
  "square-hd": { width: 2160, height: 2160 },
  "landscape-hd": { width: 2560, height: 1440 },
  "16:9": { width: 1920, height: 1080 },
  "9:16": { width: 1080, height: 1920 },
  "1:1": { width: 1080, height: 1080 },
  "4:5": { width: 1080, height: 1350 },
  "4:3": { width: 1440, height: 1080 },
  "2:3": { width: 1080, height: 1620 },
  "21:9": { width: 2560, height: 1080 },
};

export function normalizeAspectRatioConfig(
  preset?: string | null,
  custom?: { width?: number; height?: number },
  fallbackPreset: Exclude<AspectRatioPreset, "custom"> = DEFAULT_ASPECT_RATIO_PRESET,
): AspectRatioConfig {
  if (
    preset === "custom" &&
    typeof custom?.width === "number" &&
    typeof custom?.height === "number"
  ) {
    return { preset: "custom", width: custom.width, height: custom.height };
  }

  if (preset && preset !== "custom" && preset in ASPECT_RATIO_DIMENSIONS) {
    const dims = ASPECT_RATIO_DIMENSIONS[preset as keyof typeof ASPECT_RATIO_DIMENSIONS];
    return { preset: preset as AspectRatioPreset, ...dims };
  }

  if (typeof custom?.width === "number" && typeof custom?.height === "number") {
    return { preset: "custom", width: custom.width, height: custom.height };
  }

  return { preset: fallbackPreset, ...ASPECT_RATIO_DIMENSIONS[fallbackPreset] };
}

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
  sizeBytes?: number;
  extension?: string;
  url?: string;
  mimeType: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
}
