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
import { GoogleVertexTextProvider, GoogleVertexImageProvider } from "./google-vertex.js";
import { GeminiTextProvider } from "./gemini.js";
import { HiggsFieldVideoProvider } from "./higgsfield.js";
import { RunwayVideoProvider } from "./runway.js";
import { LumaVideoProvider } from "./luma.js";
import { SynthesiaVideoProvider } from "./synthesia.js";
import { AWSImageProvider, AWSVideoProvider } from "./aws.js";
import { ElevenLabsAudioProvider } from "./elevenlabs.js";
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
    case "google-vertex":
      return new GoogleVertexTextProvider(model || "gemini-1.5-pro");
    case "gemini":
      return new GeminiTextProvider(model || "gemini-1.5-flash");
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
    case "google-vertex":
      return new GoogleVertexImageProvider(model || "imagegeneration@006");
    case "aws":
      return new AWSImageProvider(model || "amazon.titan-image-generator-v2:0");
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
    case "elevenlabs":
      return new ElevenLabsAudioProvider(
        override?.options?.voiceId as string | undefined,
        model || "eleven_multilingual_v2",
      );
    case "mock":
    default:
      return new MockAudioProvider();
  }
}

// ─── Video provider factory ──────────────────────────────────────

export function createVideoProvider(override?: ProviderConfig): VideoProviderAdapter {
  const name = (override?.provider ?? envStr("AI_VIDEO_PROVIDER", "mock")).toLowerCase();

  switch (name) {
    case "higgsfield":
      return new HiggsFieldVideoProvider();
    case "runway":
      return new RunwayVideoProvider();
    case "luma":
      return new LumaVideoProvider();
    case "synthesia":
      return new SynthesiaVideoProvider(
        override?.options?.avatarId as string | undefined,
        override?.options?.voiceId as string | undefined,
      );
    case "aws":
      return new AWSVideoProvider(model || "amazon.nova-reel-v1:0");
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
