/**
 * AI generation service for the Prompt-to-Video template.
 *
 * These functions are optional — the UI and MCP tools work without them.
 * They provide AI-assisted scene generation when API keys are configured.
 *
 * Backed by @studio/ai-generation which uses DSTsx for composable pipelines
 * and provider adapters for text, image, audio, and video generation.
 *
 * Provider selection is controlled by environment variables:
 *   AI_TEXT_PROVIDER   = "openai" | "anthropic" | "mock"   (default: mock)
 *   AI_IMAGE_PROVIDER  = "openai" | "stability" | "mock"   (default: mock)
 *   AI_AUDIO_PROVIDER  = "openai" | "elevenlabs" | "mock"  (default: mock)
 *   OPENAI_API_KEY, ANTHROPIC_API_KEY, etc. must be set for non-mock providers.
 */

import {
  runScriptPipeline,
  runImagePipeline,
  runAudioPipeline,
} from "@studio/ai-generation";
import type { GeneratedScene } from "@studio/shared-types";

export type { GeneratedScene };

/**
 * Generate a structured scene script from a text prompt.
 *
 * Uses the configured text/LM provider (default: mock rule-based splitter).
 * Set AI_TEXT_PROVIDER=openai and OPENAI_API_KEY to use GPT.
 */
export async function generateSceneScript(
  prompt: string,
  options: { sceneCount?: number; style?: string } = {},
): Promise<GeneratedScene[]> {
  const plan = await runScriptPipeline({
    prompt,
    sceneCount: options.sceneCount ?? 5,
    style: options.style,
  });
  return plan.scenes;
}

/**
 * Generate an image for a scene description.
 *
 * Uses the configured image provider (default: mock placeholder image).
 * Set AI_IMAGE_PROVIDER=openai and OPENAI_API_KEY to use DALL-E.
 *
 * @param sceneDescription - Text describing what the image should show
 * @returns URL of the generated image, or empty string if not configured
 */
export async function generateSceneImage(
  sceneDescription: string,
): Promise<string> {
  const results = await runImagePipeline([{ body: sceneDescription }]);
  return results[0]?.imageUrl ?? "";
}

/**
 * Generate narration audio for a voiceover script.
 *
 * Uses the configured TTS provider (default: mock silent audio).
 * Set AI_AUDIO_PROVIDER=openai and OPENAI_API_KEY to use OpenAI TTS.
 *
 * @param text - The narration text to synthesise
 * @returns Data URI of the generated audio
 */
export async function generateNarrationAudio(text: string): Promise<string> {
  const result = await runAudioPipeline({ text });
  return result.url;
}

