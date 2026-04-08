/**
 * Factory that selects the correct provider adapter based on
 * environment variables and optional per-request ProviderConfig.
 *
 * Precedence: explicit ProviderConfig > env vars > mock fallback.
 *
 * Environment variables:
 *   AI_TEXT_PROVIDER    = "openai" | "anthropic" | "mock"  (default: "mock")
 *   AI_TEXT_MODEL       = model name for text provider
 *   AI_IMAGE_PROVIDER   = "openai" | "stability" | "mock"  (default: "mock")
 *   AI_IMAGE_MODEL      = model name for image provider
 *   AI_AUDIO_PROVIDER   = "openai" | "elevenlabs" | "mock" (default: "mock")
 *   AI_AUDIO_MODEL      = model name for audio provider
 *   AI_VIDEO_PROVIDER   = "runway" | "replicate" | "mock"  (default: "mock")
 *
 *   OPENAI_API_KEY, ANTHROPIC_API_KEY, ELEVENLABS_API_KEY etc. are
 *   required only for the respective non-mock providers.
 */

import type { ProviderConfig } from "@studio/shared-types";
import { MockAudioProvider, MockImageProvider, MockTextProvider, MockVideoProvider } from "./mock.js";
import { OpenAIAudioProvider, OpenAIImageProvider, OpenAITextProvider } from "./openai.js";
import type {
  AudioProviderAdapter,
  ImageProviderAdapter,
  ProviderAdapters,
  TextProviderAdapter,
  VideoProviderAdapter,
} from "./types.js";

function envStr(key: string, fallback = ""): string {
  return (process.env[key] ?? fallback).trim();
}

// ─── Text provider factory ───────────────────────────────────────

export function createTextProvider(override?: ProviderConfig): TextProviderAdapter {
  const name = (override?.provider ?? envStr("AI_TEXT_PROVIDER", "mock")).toLowerCase();
  const model = override?.model ?? envStr("AI_TEXT_MODEL");

  switch (name) {
    case "openai":
      return new OpenAITextProvider(model || "gpt-4o-mini");
    case "mock":
    default:
      return new MockTextProvider();
  }
}

// ─── Image provider factory ───────────────────────────────────────

export function createImageProvider(override?: ProviderConfig): ImageProviderAdapter {
  const name = (override?.provider ?? envStr("AI_IMAGE_PROVIDER", "mock")).toLowerCase();
  const model = override?.model ?? envStr("AI_IMAGE_MODEL");

  switch (name) {
    case "openai":
      return new OpenAIImageProvider(model || "dall-e-3");
    case "mock":
    default:
      return new MockImageProvider();
  }
}

// ─── Audio provider factory ──────────────────────────────────────

export function createAudioProvider(override?: ProviderConfig): AudioProviderAdapter {
  const name = (override?.provider ?? envStr("AI_AUDIO_PROVIDER", "mock")).toLowerCase();
  const model = override?.model ?? envStr("AI_AUDIO_MODEL");

  switch (name) {
    case "openai":
      return new OpenAIAudioProvider(model || "tts-1");
    case "mock":
    default:
      return new MockAudioProvider();
  }
}

// ─── Video provider factory ──────────────────────────────────────

export function createVideoProvider(override?: ProviderConfig): VideoProviderAdapter {
  const name = (override?.provider ?? envStr("AI_VIDEO_PROVIDER", "mock")).toLowerCase();

  switch (name) {
    case "mock":
    default:
      return new MockVideoProvider();
  }
}

// ─── Combined adapters factory ───────────────────────────────────

export function createProviderAdapters(overrides?: {
  text?: ProviderConfig;
  image?: ProviderConfig;
  audio?: ProviderConfig;
  video?: ProviderConfig;
}): Required<ProviderAdapters> {
  return {
    text: createTextProvider(overrides?.text),
    image: createImageProvider(overrides?.image),
    audio: createAudioProvider(overrides?.audio),
    video: createVideoProvider(overrides?.video),
  };
}
