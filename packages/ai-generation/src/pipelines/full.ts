/**
 * End-to-end prompt-to-project pipeline.
 *
 * Orchestrates all sub-pipelines in sequence:
 *   1. script — generate structured scene plan
 *   2. images — generate one image per scene (optional)
 *   3. audio  — synthesise narration (optional)
 *
 * Returns all intermediate outputs so the caller can track progress
 * and register assets individually.
 */

import type {
  GenerationRequestOptions,
  ScenePlan,
} from "@studio/shared-types";
import { runAudioPipeline } from "./audio.js";
import type { AudioPipelineResult } from "./audio.js";
import { runImagePipeline } from "./image.js";
import type { SceneImageResult } from "./image.js";
import { runScriptPipeline } from "./script.js";

export interface FullGenerationInput {
  prompt: string;
  sceneCount?: number;
  style?: string;
  genre?: string;
  /** Whether to also generate scene images */
  generateImages?: boolean;
  /** Whether to also generate narration audio */
  generateAudio?: boolean;
  /** Target frame width (used for image sizing) */
  width?: number;
  /** Target frame height (used for image sizing) */
  height?: number;
}

export interface FullGenerationOutput {
  scenePlan: ScenePlan;
  /** Images indexed by scene index (present when generateImages=true) */
  sceneImages?: SceneImageResult[];
  /** Narration audio (present when generateAudio=true and plan has a script) */
  narrationAudio?: AudioPipelineResult;
}

/**
 * Run the full prompt-to-project pipeline.
 * Each step is only executed if requested to keep generation fast by default.
 */
export async function runFullGenerationPipeline(
  input: FullGenerationInput,
  options?: GenerationRequestOptions,
): Promise<FullGenerationOutput> {
  // Step 1: Generate scene plan
  const scenePlan = await runScriptPipeline(
    {
      prompt: input.prompt,
      sceneCount: input.sceneCount ?? 5,
      style: input.style,
      genre: input.genre,
    },
    options,
  );

  let sceneImages: SceneImageResult[] | undefined;
  let narrationAudio: AudioPipelineResult | undefined;

  // Step 2: Generate images (optional, sequential)
  if (input.generateImages) {
    sceneImages = await runImagePipeline(
      scenePlan.scenes.map((s) => ({
        body: s.body,
        imagePrompt: s.imagePrompt,
        width: input.width,
        height: input.height,
      })),
      options,
    );

    // Back-fill imageUrl on each scene in the plan
    sceneImages.forEach((img, i) => {
      if (scenePlan.scenes[i]) {
        scenePlan.scenes[i] = { ...scenePlan.scenes[i], imageUrl: img.imageUrl };
      }
    });
  }

  // Step 3: Generate narration (optional)
  if (input.generateAudio && scenePlan.narrationScript) {
    narrationAudio = await runAudioPipeline(
      { text: scenePlan.narrationScript },
      options,
    );
  }

  return { scenePlan, sceneImages, narrationAudio };
}
