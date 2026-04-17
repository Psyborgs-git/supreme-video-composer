/**
 * ElevenLabs provider adapter — audio (TTS + voice clone).
 *
 * Env: ELEVENLABS_API_KEY
 *
 * Reference: https://elevenlabs.io/docs/api-reference/text-to-speech
 * The TTS endpoint returns a streaming audio binary. We collect it and
 * return as a base64 data URI.
 */

import type {
  AudioGenerationRequest,
  AudioGenerationResult,
  AudioProviderAdapter,
} from "./types.js";

const BASE = "https://api.elevenlabs.io/v1";

/** Default voice ID — Rachel (multilingual, available on all plans) */
const DEFAULT_VOICE_ID = "21m00Tcm4TlvDq8ikWAM";

function getKey(): string {
  const key = process.env.ELEVENLABS_API_KEY;
  if (!key) throw new Error("ELEVENLABS_API_KEY is not set");
  return key;
}

export class ElevenLabsAudioProvider implements AudioProviderAdapter {
  readonly provider = "elevenlabs";

  constructor(
    private readonly defaultVoiceId = DEFAULT_VOICE_ID,
    private readonly modelId = "eleven_multilingual_v2",
  ) {}

  async generateAudio(req: AudioGenerationRequest): Promise<AudioGenerationResult> {
    const voiceId = req.voiceId ?? this.defaultVoiceId;
    const outputFormat = req.format === "wav" ? "pcm_44100" : "mp3_44100_128";

    const res = await fetch(
      `${BASE}/text-to-speech/${voiceId}?output_format=${outputFormat}`,
      {
        method: "POST",
        headers: {
          "xi-api-key": getKey(),
          "Content-Type": "application/json",
          Accept: req.format === "wav" ? "audio/wav" : "audio/mpeg",
        },
        body: JSON.stringify({
          text: req.text,
          model_id: this.modelId,
          voice_settings: {
            stability: 0.5,
            similarity_boost: 0.75,
            speed: req.speed ?? 1.0,
          },
        }),
      },
    );

    if (!res.ok) {
      const text = await res.text().catch(() => res.statusText);
      throw new Error(`ElevenLabs TTS error ${res.status}: ${text}`);
    }

    const buffer = await res.arrayBuffer();
    const base64 = Buffer.from(buffer).toString("base64");
    const mimeType = req.format === "wav" ? "audio/wav" : "audio/mpeg";
    return {
      url: `data:${mimeType};base64,${base64}`,
      mimeType,
    };
  }
}
