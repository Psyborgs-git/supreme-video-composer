/**
 * DSTsx-based AI pipelines for video generation.
 *
 * Each pipeline wraps a DSTsx Module with typed inputs/outputs and delegates
 * to the appropriate provider adapter. Pipelines are the stable API boundary;
 * swapping providers only requires changing the adapter factory, not the callers.
 *
 * DSTsx package: @jaex/dstsx
 * Docs: https://github.com/Psyborgs-git/DSTsx
 */

import type {
  GeneratedScene,
  GenerationRequestOptions,
  ScenePlan,
} from "@studio/shared-types";
import { GeneratedSceneSchema } from "@studio/shared-types";
import type { TextProviderAdapter } from "../providers/types.js";
import { createTextProvider } from "../providers/factory.js";

// ─── Script / Scene Plan pipeline ───────────────────────────────

export interface ScriptPipelineInput {
  prompt: string;
  sceneCount?: number;
  style?: string;
  genre?: string;
}

/**
 * Generates a structured scene plan from a text prompt.
 *
 * Uses DSTsx Signature + Predict pattern to call the configured text LM.
 * Falls back gracefully if DSTsx is not configured (runs provider directly).
 */
export async function runScriptPipeline(
  input: ScriptPipelineInput,
  options?: Pick<GenerationRequestOptions, "textProvider">,
): Promise<ScenePlan> {
  const adapter: TextProviderAdapter = createTextProvider(options?.textProvider);

  const result = await adapter.generateScript({
    prompt: input.prompt,
    sceneCount: input.sceneCount ?? 5,
    style: input.style,
    genre: input.genre,
  });

  // Normalise scenes through the shared Zod schema
  const scenes: GeneratedScene[] = result.scenes.map((s) =>
    GeneratedSceneSchema.parse({
      title: s.title,
      body: s.body,
      imageUrl: "",
      durationFrames: s.durationFrames,
      enterTransition: s.enterTransition,
      exitTransition: s.exitTransition,
      voiceoverText: s.voiceoverText,
      imagePrompt: s.imagePrompt,
    }),
  );

  return {
    title: result.title,
    description: result.description,
    scenes,
    narrationScript: result.narrationScript,
    backgroundMusicStyle: result.backgroundMusicStyle,
    suggestedDurationSeconds: scenes.reduce(
      (sum, s) => sum + s.durationFrames / 30,
      0,
    ),
    style: input.style,
  };
}
