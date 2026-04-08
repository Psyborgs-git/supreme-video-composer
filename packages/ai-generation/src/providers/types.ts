/**
 * Provider adapter interfaces for AI generation.
 *
 * Each interface defines the contract for a generation capability.
 * Concrete implementations live in adapters/ and are selected at
 * runtime based on env configuration or explicit provider options.
 */

import type { ProviderConfig } from "@studio/shared-types";

// ─── Text / Script provider ─────────────────────────────────────

export interface ScriptGenerationRequest {
  prompt: string;
  sceneCount: number;
  style?: string;
  /** Example: "cinematic", "educational", "product", "social" */
  genre?: string;
}

export interface GeneratedSceneData {
  title: string;
  body: string;
  imagePrompt: string;
  voiceoverText: string;
  durationFrames: number;
  enterTransition: "fade" | "blur" | "swipe" | "zoom" | "none";
  exitTransition: "fade" | "blur" | "swipe" | "zoom" | "none";
}

export interface ScriptGenerationResult {
  title: string;
  description: string;
  narrationScript: string;
  backgroundMusicStyle: string;
  scenes: GeneratedSceneData[];
}

export interface TextProviderAdapter {
  readonly provider: string;
  generateScript(req: ScriptGenerationRequest): Promise<ScriptGenerationResult>;
}

// ─── Image provider ─────────────────────────────────────────────

export interface ImageGenerationRequest {
  prompt: string;
  negativePrompt?: string;
  width?: number;
  height?: number;
  style?: string;
  /** Number of images to generate (default: 1) */
  count?: number;
}

export interface ImageGenerationResult {
  /** Array of HTTP URLs or data URIs for generated images */
  urls: string[];
}

export interface ImageProviderAdapter {
  readonly provider: string;
  generateImage(req: ImageGenerationRequest): Promise<ImageGenerationResult>;
}

// ─── Audio / TTS provider ───────────────────────────────────────

export interface AudioGenerationRequest {
  text: string;
  voiceId?: string;
  speed?: number;
  /** "mp3" | "wav" | "ogg" */
  format?: string;
}

export interface AudioGenerationResult {
  /** Base64-encoded audio data or URL */
  url: string;
  /** MIME type of the result */
  mimeType: string;
  /** Duration in seconds if known */
  durationSeconds?: number;
}

export interface AudioProviderAdapter {
  readonly provider: string;
  generateAudio(req: AudioGenerationRequest): Promise<AudioGenerationResult>;
}

// ─── Video generation provider ──────────────────────────────────

export interface VideoGenerationRequest {
  prompt: string;
  /** Image to animate (optional, for img2video) */
  imageUrl?: string;
  durationSeconds?: number;
  width?: number;
  height?: number;
}

export interface VideoGenerationResult {
  /** URL of the generated video */
  url: string;
  /** MIME type */
  mimeType: string;
  durationSeconds?: number;
}

export interface VideoProviderAdapter {
  readonly provider: string;
  generateVideo(req: VideoGenerationRequest): Promise<VideoGenerationResult>;
}

// ─── Provider registry helpers ───────────────────────────────────

export interface ProviderAdapters {
  text?: TextProviderAdapter;
  image?: ImageProviderAdapter;
  audio?: AudioProviderAdapter;
  video?: VideoProviderAdapter;
}

/**
 * Merges an optional ProviderConfig into an adapter factory's default config.
 * Returns merged record (caller picks whichever fields matter).
 */
export function mergeProviderConfig(
  defaults: Record<string, unknown>,
  override?: ProviderConfig,
): Record<string, unknown> {
  if (!override) return defaults;
  return { ...defaults, ...override.options, model: override.model ?? defaults.model };
}
