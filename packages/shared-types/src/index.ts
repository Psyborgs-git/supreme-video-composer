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

// ─── AI Generation ───────────────────────────────────────────────

/** The type of media to generate */
export const GenerationModalitySchema = z.enum(["script", "image", "audio", "video"]);
export type GenerationModality = z.infer<typeof GenerationModalitySchema>;

/** Status lifecycle for an AI generation job (mirrors RenderStatus pattern) */
export const GenerationStatusSchema = z.enum([
  "queued",
  "running",
  "completed",
  "failed",
  "cancelled",
]);
export type GenerationStatus = z.infer<typeof GenerationStatusSchema>;

/** Known text/script LM providers */
export const TextProviderSchema = z.enum(["openai", "anthropic", "google", "ollama", "mock"]);
export type TextProvider = z.infer<typeof TextProviderSchema>;

/** Known image generation providers */
export const ImageProviderSchema = z.enum(["openai", "stability", "replicate", "fal", "mock"]);
export type ImageProvider = z.infer<typeof ImageProviderSchema>;

/** Known audio/TTS generation providers */
export const AudioProviderSchema = z.enum(["openai", "elevenlabs", "mock"]);
export type AudioProvider = z.infer<typeof AudioProviderSchema>;

/** Known video generation providers */
export const VideoProviderSchema = z.enum(["runway", "replicate", "fal", "mock"]);
export type VideoProvider = z.infer<typeof VideoProviderSchema>;

/** Provider + model selection for any modality */
export const ProviderConfigSchema = z.object({
  /** Provider identifier */
  provider: z.string(),
  /** Model name or version (e.g., "gpt-4o", "dall-e-3") */
  model: z.string().optional(),
  /** Additional provider-specific options */
  options: z.record(z.unknown()).optional(),
});
export type ProviderConfig = z.infer<typeof ProviderConfigSchema>;

/** Provenance metadata stored alongside every AI-generated asset */
export const GenerationProvenanceSchema = z.object({
  /** The human prompt that drove this generation */
  prompt: z.string(),
  /** Provider used */
  provider: z.string(),
  /** Model used */
  model: z.string().optional(),
  /** Parent job ID that produced this asset */
  jobId: z.string().optional(),
  /** ISO timestamp of generation */
  generatedAt: z.string(),
  /** Revision number within the same job (0 = first attempt) */
  revision: z.number().int().min(0).default(0),
  /** Safety check outcome */
  safetyStatus: z.enum(["unchecked", "passed", "flagged", "blocked"]).default("unchecked"),
});
export type GenerationProvenance = z.infer<typeof GenerationProvenanceSchema>;

/** A generated scene returned by the script pipeline */
export const GeneratedSceneSchema = z.object({
  title: z.string(),
  body: z.string(),
  imageUrl: z.string().default(""),
  durationFrames: z.number().int().min(15).default(150),
  enterTransition: z.enum(["fade", "blur", "swipe", "zoom", "none"]).default("fade"),
  exitTransition: z.enum(["fade", "blur", "swipe", "zoom", "none"]).default("fade"),
  voiceoverText: z.string().default(""),
  /** Image generation prompt derived from the scene body */
  imagePrompt: z.string().optional(),
});
export type GeneratedScene = z.infer<typeof GeneratedSceneSchema>;

/** A fully formed scene plan with optional audio metadata */
export const ScenePlanSchema = z.object({
  title: z.string(),
  description: z.string(),
  scenes: z.array(GeneratedSceneSchema),
  narrationScript: z.string().optional(),
  backgroundMusicStyle: z.string().optional(),
  suggestedDurationSeconds: z.number().optional(),
  style: z.string().optional(),
});
export type ScenePlan = z.infer<typeof ScenePlanSchema>;

/** Options shared by all generation requests */
export const GenerationRequestOptionsSchema = z.object({
  /** Override text/LM provider */
  textProvider: ProviderConfigSchema.optional(),
  /** Override image generation provider */
  imageProvider: ProviderConfigSchema.optional(),
  /** Override audio/TTS provider */
  audioProvider: ProviderConfigSchema.optional(),
  /** Override video generation provider */
  videoProvider: ProviderConfigSchema.optional(),
  /** Whether generated assets require explicit approval before being attached */
  requireApproval: z.boolean().default(false),
  /** Maximum time in milliseconds before a provider call is aborted */
  timeoutMs: z.number().int().positive().optional(),
});
export type GenerationRequestOptions = z.infer<typeof GenerationRequestOptionsSchema>;

/** Payload for creating an AI generation job */
export const CreateGenerationJobSchema = z.object({
  /** Human-readable label for this job */
  name: z.string().min(1),
  /** What to generate */
  modality: GenerationModalitySchema,
  /** The driving prompt */
  prompt: z.string().min(1),
  /** Additional structured inputs (e.g., existing scene plan for image jobs) */
  inputs: z.record(z.unknown()).optional(),
  /** Project to attach generated outputs to (if any) */
  projectId: z.string().optional(),
  options: GenerationRequestOptionsSchema.optional(),
});
export type CreateGenerationJob = z.infer<typeof CreateGenerationJobSchema>;

/** Partial output produced during a multi-step generation job */
export const GenerationJobOutputSchema = z.object({
  /** Which step of the pipeline produced this partial */
  step: z.string(),
  /** Generated data (scene plan, asset URLs, etc.) */
  data: z.unknown(),
  /** Timestamp this step completed */
  completedAt: z.string(),
});
export type GenerationJobOutput = z.infer<typeof GenerationJobOutputSchema>;

/** Full generation job record */
export const GenerationJobSchema = z.object({
  id: z.string(),
  name: z.string(),
  modality: GenerationModalitySchema,
  prompt: z.string(),
  inputs: z.record(z.unknown()).optional(),
  projectId: z.string().optional(),
  options: GenerationRequestOptionsSchema.optional(),
  status: GenerationStatusSchema,
  /** Progress 0-1 */
  progress: z.number().min(0).max(1).nullable(),
  /** Partial outputs collected so far */
  outputs: z.array(GenerationJobOutputSchema),
  /** IDs of assets registered as a result of this job */
  assetIds: z.array(z.string()),
  error: z.string().nullable(),
  createdAt: z.string(),
  startedAt: z.string().nullable(),
  completedAt: z.string().nullable(),
});
export type GenerationJob = z.infer<typeof GenerationJobSchema>;
