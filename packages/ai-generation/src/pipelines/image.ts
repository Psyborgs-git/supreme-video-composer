/**
 * Image generation pipeline.
 *
 * Takes a list of scene descriptions (or explicit image prompts) and
 * generates one image per scene using the configured image provider.
 */

import type { GenerationRequestOptions } from "@studio/shared-types";
import type { ImageProviderAdapter } from "../providers/types.js";
import { createImageProvider } from "../providers/factory.js";

export interface SceneImageInput {
  /** Human-readable scene body used as fallback if imagePrompt is missing */
  body: string;
  /** Explicit image generation prompt (preferred over body if present) */
  imagePrompt?: string;
  /** Target frame width in pixels */
  width?: number;
  /** Target frame height in pixels */
  height?: number;
}

export interface SceneImageResult {
  /** The resolved image URL (may be a data URI or remote URL) */
  imageUrl: string;
  /** The prompt that was used */
  usedPrompt: string;
}

/**
 * Generate one image for every scene in the provided list.
 * Returns results in the same order as inputs.
 */
export async function runImagePipeline(
  scenes: SceneImageInput[],
  options?: Pick<GenerationRequestOptions, "imageProvider">,
): Promise<SceneImageResult[]> {
  const adapter: ImageProviderAdapter = createImageProvider(options?.imageProvider);

  const results = await Promise.all(
    scenes.map(async (scene) => {
      const prompt = scene.imagePrompt ?? scene.body;
      try {
        const result = await adapter.generateImage({
          prompt,
          width: scene.width,
          height: scene.height,
        });
        return {
          imageUrl: result.urls[0] ?? "",
          usedPrompt: prompt,
        };
      } catch {
        // On error, return empty URL so the scene is still usable
        return { imageUrl: "", usedPrompt: prompt };
      }
    }),
  );

  return results;
}
