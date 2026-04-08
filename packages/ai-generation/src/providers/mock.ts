/**
 * Mock provider adapters used for testing and when no API keys are configured.
 *
 * Every mock returns deterministic but plausible data so pipelines can
 * be validated end-to-end without external dependencies.
 */

import type {
  AudioGenerationRequest,
  AudioGenerationResult,
  AudioProviderAdapter,
  GeneratedSceneData,
  ImageGenerationRequest,
  ImageGenerationResult,
  ImageProviderAdapter,
  ScriptGenerationRequest,
  ScriptGenerationResult,
  TextProviderAdapter,
  VideoGenerationRequest,
  VideoGenerationResult,
  VideoProviderAdapter,
} from "./types.js";

// ─── Mock Text Provider ─────────────────────────────────────────

export class MockTextProvider implements TextProviderAdapter {
  readonly provider = "mock";

  async generateScript(req: ScriptGenerationRequest): Promise<ScriptGenerationResult> {
    const sceneCount = req.sceneCount ?? 3;
    const sentences = req.prompt
      .split(/[.!?]+/)
      .map((s) => s.trim())
      .filter(Boolean);
    const perScene = Math.max(1, Math.ceil(sentences.length / sceneCount));

    const scenes: GeneratedSceneData[] = Array.from({ length: sceneCount }, (_, i) => {
      const chunk = sentences.slice(i * perScene, (i + 1) * perScene);
      const body = chunk.join(". ") || `Scene ${i + 1}: ${req.prompt.slice(0, 60)}`;
      return {
        title: `Scene ${i + 1}`,
        body: body.endsWith(".") ? body : `${body}.`,
        imagePrompt: `Cinematic still: ${body.slice(0, 80)}`,
        voiceoverText: body,
        durationFrames: 150,
        enterTransition: req.style === "fast" ? ("swipe" as const) : ("fade" as const),
        exitTransition: req.style === "fast" ? ("swipe" as const) : ("fade" as const),
      };
    });

    return {
      title: `Video: ${req.prompt.slice(0, 50)}`,
      description: req.prompt,
      narrationScript: scenes.map((s) => s.voiceoverText).join(" "),
      backgroundMusicStyle: "ambient",
      scenes,
    };
  }
}

// ─── Mock Image Provider ─────────────────────────────────────────

export class MockImageProvider implements ImageProviderAdapter {
  readonly provider = "mock";

  async generateImage(req: ImageGenerationRequest): Promise<ImageGenerationResult> {
    const count = req.count ?? 1;
    const w = req.width ?? 1024;
    const h = req.height ?? 576;
    const urls = Array.from(
      { length: count },
      (_, i) =>
        `https://placehold.co/${w}x${h}/1a1a2e/ffffff?text=${encodeURIComponent(req.prompt.slice(0, 40))}+${i + 1}`,
    );
    return { urls };
  }
}

// ─── Mock Audio Provider ─────────────────────────────────────────

const SILENT_WAV_BASE64 =
  // 44-byte WAV header for a 0-sample 16-bit 44.1kHz mono file
  "UklGRiQAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQAAAAA=";

export class MockAudioProvider implements AudioProviderAdapter {
  readonly provider = "mock";

  async generateAudio(_req: AudioGenerationRequest): Promise<AudioGenerationResult> {
    // Return a tiny valid silent WAV so downstream code can parse headers
    return {
      url: `data:audio/wav;base64,${SILENT_WAV_BASE64}`,
      mimeType: "audio/wav",
      durationSeconds: 0.001,
    };
  }
}

// ─── Mock Video Provider ─────────────────────────────────────────

export class MockVideoProvider implements VideoProviderAdapter {
  readonly provider = "mock";

  async generateVideo(req: VideoGenerationRequest): Promise<VideoGenerationResult> {
    return {
      url: `https://placehold.co/${req.width ?? 1920}x${req.height ?? 1080}/0a0a0a/ffffff?text=Generated+Video`,
      mimeType: "video/mp4",
      durationSeconds: req.durationSeconds ?? 5,
    };
  }
}
