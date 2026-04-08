/**
 * Audio generation pipeline.
 *
 * Converts voiceover text (or full narration script) into an audio file
 * using the configured TTS provider.  The raw audio data is returned as
 * a base64 data URI so the caller can save/register it as an asset without
 * needing a separate download step.
 */

import type { GenerationRequestOptions } from "@studio/shared-types";
import type { AudioProviderAdapter } from "../providers/types.js";
import { createAudioProvider } from "../providers/factory.js";

export interface AudioPipelineInput {
  /** The text to synthesise into speech */
  text: string;
  /** Optional voice ID/name for the TTS provider */
  voiceId?: string;
  /** Speaking speed multiplier (1.0 = normal) */
  speed?: number;
  /** Output format: "mp3" (default) | "wav" */
  format?: "mp3" | "wav";
}

export interface AudioPipelineResult {
  /** Data URI or remote URL of the generated audio */
  url: string;
  /** MIME type ("audio/mpeg" or "audio/wav") */
  mimeType: string;
  /** Duration in seconds if the provider reported it */
  durationSeconds?: number;
}

/**
 * Synthesise audio from text.
 */
export async function runAudioPipeline(
  input: AudioPipelineInput,
  options?: Pick<GenerationRequestOptions, "audioProvider">,
): Promise<AudioPipelineResult> {
  const adapter: AudioProviderAdapter = createAudioProvider(options?.audioProvider);

  const result = await adapter.generateAudio({
    text: input.text,
    voiceId: input.voiceId,
    speed: input.speed,
    format: input.format ?? "mp3",
  });

  return {
    url: result.url,
    mimeType: result.mimeType,
    durationSeconds: result.durationSeconds,
  };
}
