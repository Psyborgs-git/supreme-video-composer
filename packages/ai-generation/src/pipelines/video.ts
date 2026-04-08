/**
 * Video generation pipeline.
 *
 * Supports two generation modes:
 *   Mode A — generate short video clips per scene (assets mode)
 *   Mode B — generate a single stitched video from a scene plan
 *
 * Results are returned as URLs/data URIs for asset registration.
 */

import type { GenerationRequestOptions, ScenePlan } from "@studio/shared-types";
import type { VideoProviderAdapter } from "../providers/types.js";
import { createVideoProvider } from "../providers/factory.js";

// ─── Mode A: Per-scene clips ─────────────────────────────────────

export interface SceneClipInput {
  prompt: string;
  imageUrl?: string;
  durationSeconds?: number;
  width?: number;
  height?: number;
}

export interface SceneClipResult {
  url: string;
  mimeType: string;
  durationSeconds?: number;
  /** Error message if this clip's generation failed */
  error?: string;
}

/**
 * Generate one video clip per scene (Mode A).
 * Returns results in the same order as inputs.
 */
export async function runSceneClipsPipeline(
  scenes: SceneClipInput[],
  options?: Pick<GenerationRequestOptions, "videoProvider">,
): Promise<SceneClipResult[]> {
  const adapter: VideoProviderAdapter = createVideoProvider(options?.videoProvider);

  return Promise.all(
    scenes.map(async (scene) => {
      try {
        const result = await adapter.generateVideo({
          prompt: scene.prompt,
          imageUrl: scene.imageUrl,
          durationSeconds: scene.durationSeconds,
          width: scene.width,
          height: scene.height,
        });
        return result;
      } catch (err) {
        console.error(
          `[ai-generation] video generation failed for prompt "${scene.prompt.slice(0, 60)}…":`,
          err,
        );
        return {
          url: "",
          mimeType: "video/mp4",
          error: err instanceof Error ? err.message : String(err),
        };
      }
    }),
  );
}

// ─── Mode B: Full video from scene plan ──────────────────────────

export interface VideoFromPlanResult {
  url: string;
  mimeType: string;
  durationSeconds?: number;
}

/**
 * Generate a single video from a full scene plan (Mode B).
 * The provider receives a consolidated prompt built from the scene plan.
 */
export async function runVideoFromPlanPipeline(
  plan: ScenePlan,
  dimensions?: { width: number; height: number },
  options?: Pick<GenerationRequestOptions, "videoProvider">,
): Promise<VideoFromPlanResult> {
  const adapter: VideoProviderAdapter = createVideoProvider(options?.videoProvider);

  const consolidatedPrompt = [
    plan.title,
    plan.description,
    ...plan.scenes.map((s) => `${s.title}: ${s.body}`),
  ]
    .filter(Boolean)
    .join(". ");

  return adapter.generateVideo({
    prompt: consolidatedPrompt,
    durationSeconds: plan.suggestedDurationSeconds,
    width: dimensions?.width,
    height: dimensions?.height,
  });
}
