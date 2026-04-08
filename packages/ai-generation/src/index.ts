/**
 * @studio/ai-generation
 *
 * DSTsx-powered AI generation layer for supreme-video-composer.
 *
 * Exports:
 *   - Pipelines: runScriptPipeline, runImagePipeline, runAudioPipeline,
 *               runSceneClipsPipeline, runVideoFromPlanPipeline, runFullGenerationPipeline
 *   - Providers: createTextProvider, createImageProvider, createAudioProvider,
 *               createVideoProvider, createProviderAdapters, mock adapters
 *   - Job store: generationJobStore helpers
 */

export * from "./pipelines/index.js";
export * from "./providers/index.js";
export * from "./utils/index.js";
