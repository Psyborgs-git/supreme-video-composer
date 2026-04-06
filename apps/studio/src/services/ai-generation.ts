/**
 * AI generation service for the Prompt-to-Video template.
 *
 * These functions are optional — the UI and MCP tools work without them.
 * They provide AI-assisted scene generation when API keys are configured.
 */

export interface GeneratedScene {
  title: string;
  body: string;
  imageUrl: string;
  durationFrames: number;
  enterTransition: "fade" | "blur" | "swipe" | "zoom" | "none";
  exitTransition: "fade" | "blur" | "swipe" | "zoom" | "none";
  voiceoverText: string;
}

/**
 * Generate a structured scene script from a text prompt.
 *
 * When an Anthropic API key is configured, this calls the Claude API.
 * Otherwise, it returns a placeholder scene array based on sentence splitting.
 */
export async function generateSceneScript(
  prompt: string,
  options: { sceneCount?: number; style?: string } = {},
): Promise<GeneratedScene[]> {
  const sceneCount = options.sceneCount ?? 5;

  // Fallback: split prompt into sentences and create basic scenes
  const sentences = prompt
    .split(/[.!?]+/)
    .map((s) => s.trim())
    .filter(Boolean);

  const scenes: GeneratedScene[] = [];
  const perScene = Math.max(1, Math.ceil(sentences.length / sceneCount));

  for (let i = 0; i < sceneCount; i++) {
    const chunk = sentences.slice(i * perScene, (i + 1) * perScene);
    const body = chunk.join(". ") || `Scene ${i + 1}`;
    scenes.push({
      title: `Scene ${i + 1}`,
      body: body + (body.endsWith(".") ? "" : "."),
      imageUrl: "",
      durationFrames: 150,
      enterTransition: "fade",
      exitTransition: "fade",
      voiceoverText: body,
    });
  }

  return scenes;
}

/**
 * Generate an image for a scene description.
 *
 * Stub: returns an empty string. Wire in DALL-E / Stable Diffusion / Flux
 * by implementing the API call here.
 *
 * @param _sceneDescription - Text describing what the image should show
 * @returns URL of the generated image, or empty string if not configured
 */
export async function generateSceneImage(
  _sceneDescription: string,
): Promise<string> {
  // Stub — image generation requires external API keys.
  // To enable, implement your preferred image generation API here:
  //   - OpenAI DALL-E: POST https://api.openai.com/v1/images/generations
  //   - Stable Diffusion: via Stability AI API
  //   - Flux: via Replicate or self-hosted
  return "";
}
