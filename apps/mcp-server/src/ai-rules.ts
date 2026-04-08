/**
 * Rule constants for AI generation MCP tools.
 *
 * These follow the same pattern as the Remotion rule tools in
 * apps/mcp-server/src/remotion-app/rules.ts.
 *
 * Call the corresponding rule_ai_* tools to understand how to use the AI
 * generation features correctly and safely.
 */

export const RULE_AI_GENERATION_OVERVIEW = `# AI Generation — Overview

The AI generation tools let you create images, audio, and video assets using LM/diffusion providers,
then assemble them into Remotion projects through the standard template and project workflow.

## Available Rule Tools

- **rule_ai_generation_overview** (this page) — capabilities, tool map, workflow
- **rule_ai_asset_constraints** — file size, type, resolution, duration limits
- **rule_ai_prompting** — how to write effective prompts for each modality
- **rule_ai_project_assembly** — how to map generated assets into projects/templates
- **rule_ai_safety** — content policy, provider failures, moderation handling

## Generation Tools

| Tool | Modality | Description |
|------|----------|-------------|
| generate_script | script | Prompt → structured scene plan (title, body, imagePrompt per scene) |
| generate_images | image | Scene descriptions → image URLs (one per scene) |
| generate_audio | audio | Narration text → audio data URI |
| generate_video_assets | video | Scene prompts → short video clips (Mode A) |
| generate_project_from_prompt | all | One call runs script→image→audio→project (quick start) |
| get_generation_status | — | Poll a generation job by ID |
| list_generation_jobs | — | List all generation jobs with optional filters |
| approve_generated_assets | — | Mark a completed job's outputs as approved |
| regenerate_scene_asset | image/audio | Regenerate image or audio for one scene in a project |

## Standard Workflow (scene-by-scene control)

1. **generate_script** — get a scene plan from your prompt
2. Review and adjust scene bodies/imagePrompts
3. **generate_images** — pass scene list, get image URLs back
4. **generate_audio** — pass narrationScript, get audio URL back
5. **create_scene_sequence** or **create_project** — build a project with the generated assets
6. **render_project** — render to MP4/WebM

## Quick Workflow (single call)

\`\`\`json
{
  "tool": "generate_project_from_prompt",
  "prompt": "A 3-scene product launch for AcmePro",
  "sceneCount": 3,
  "generateImages": true,
  "generateAudio": false
}
\`\`\`
Returns: \`{ jobId, project, scenePlan }\`

## Provider Selection (environment variables)

| Variable | Options | Default |
|---|---|---|
| AI_TEXT_PROVIDER | openai, mock | mock |
| AI_IMAGE_PROVIDER | openai, stability, mock | mock |
| AI_AUDIO_PROVIDER | openai, elevenlabs, mock | mock |
| AI_VIDEO_PROVIDER | runway, replicate, mock | mock |
| AI_TEXT_MODEL | e.g. gpt-4o-mini | provider default |
| AI_IMAGE_MODEL | e.g. dall-e-3 | provider default |
| OPENAI_API_KEY | your key | — |

The mock provider always succeeds without network calls (returns placehold.co images, silent audio).
Use it for development and testing.

## Async Job Lifecycle

All generation tools create a job record and execute the pipeline:
  queued → running → completed | failed | cancelled

Poll with **get_generation_status** if you need to check progress.
For most tools the pipeline runs synchronously and the result is returned inline.
`;

export const RULE_AI_ASSET_CONSTRAINTS = `# AI Generation — Asset Constraints

## Image Constraints

| Property | Requirement |
|---|---|
| Formats | JPEG, PNG, WebP |
| Max dimensions | 4096 × 4096 px |
| Recommended | 1024×1024, 1792×1024, 1024×1792 (DALL-E 3 native) |
| Min dimensions | 256 × 256 px |

## Audio Constraints

| Property | Requirement |
|---|---|
| Formats | MP3, WAV |
| Max file size | 25 MB |
| Max duration | No hard limit (TTS is sentence-chunked) |
| Recommended sample rate | 44.1 kHz |

## Video Constraints

| Property | Requirement |
|---|---|
| Formats | MP4 (H.264), WebM |
| Max duration per clip | 30 s (provider dependent) |
| Recommended resolution | 1920×1080 or 1080×1920 |
| Note | Width and height must be even numbers |

## Remotion Compatibility

- All images referenced in a Remotion composition must be available at render time
  (remote URLs must support CORS; prefer registering generated assets via the Asset API)
- Audio files must be compatible browser audio formats
- Video clips used as Sequence assets must have consistent frame rates

## Asset Registration

Generated assets (images, audio, video) should be registered in the Studio asset store
using **POST /api/assets** (file upload) or **POST /api/assets/register** (path reference)
before referencing them in project inputProps.

This ensures:
- Asset is persisted across Studio restarts
- Asset is accessible via /api/assets/:id/content
- Asset appears in the UI Assets panel
`;

export const RULE_AI_PROMPTING = `# AI Generation — Prompting Guide

## Script (text/scene plan) Prompts

Effective prompts:
- State the subject and context clearly: "A 5-scene documentary about deep-sea creatures"
- Include tone: "cinematic", "educational", "upbeat product promo"
- Mention target platform if relevant: "vertical short-form video for TikTok"
- Specify audience: "for children aged 6-10"

Use the \`style\` parameter for pacing: "fast", "slow", "dramatic", "playful"
Use the \`genre\` parameter for type: "documentary", "product", "educational", "social"

Example:
\`\`\`json
{
  "prompt": "A 4-scene product launch video for a new AI code editor targeting developers",
  "sceneCount": 4,
  "style": "fast",
  "genre": "product"
}
\`\`\`

## Image Prompts

Each scene has an \`imagePrompt\` field optimised for image generation.
Supplement with:
- Art style: "photorealistic", "flat illustration", "watercolor"
- Lighting: "golden hour", "studio lighting", "cinematic"
- Camera: "wide angle", "close-up", "aerial"
- Mood: "dramatic", "serene", "energetic"

Avoid:
- Prompts > 400 characters (most providers truncate)
- Vague nouns without modifiers ("a thing", "something")
- Multiple competing subjects in one prompt

## Audio / TTS Prompts

- Narration should be natural speech, not bullet points
- Keep sentences < 40 words for natural pacing
- Include pauses with commas and full stops
- Avoid URLs, code snippets, or HTML in TTS text

## Video Prompts

- Describe motion explicitly: "camera slowly zooms in", "quick cut to"
- State duration expectation: "5 second clip"
- Mention environment/setting first, then action
`;

export const RULE_AI_PROJECT_ASSEMBLY = `# AI Generation — Project Assembly

## Mapping Generated Outputs to prompt-to-video

After generation, scenes have the following shape:
\`\`\`json
{
  "title": "string",
  "body": "string",
  "imageUrl": "https://... or data:image/...",
  "durationFrames": 150,
  "enterTransition": "fade",
  "exitTransition": "fade",
  "voiceoverText": "string"
}
\`\`\`

Pass this array as \`scenes\` to **create_scene_sequence** with \`templateId: "prompt-to-video"\`.

## Mapping Generated Audio

The narration audio URL (data URI) should be:
1. Uploaded/registered as a Studio asset first
2. Then referenced in the project inputProps as \`narrationUrl\`

## Template Slot Filling (other templates)

For templates that accept image/audio assetIds:
1. Upload generated image/audio via POST /api/assets
2. Use the returned \`id\` in inputProps

Example for history-storyline:
\`\`\`json
{
  "events": [
    { "title": "...", "date": "...", "imageUrl": "https://generated-image-url" }
  ]
}
\`\`\`

## Mode A vs Mode B for Video

**Mode A** (recommended): Generate per-scene clips → use as assets in templates
- generate_video_assets → list of clip URLs
- Register clips as video assets
- Pass to template (social-media-reel, etc.)

**Mode B**: Generate Remotion source code via create_video
- Use generate_script to plan
- Write Remotion TSX that references the generated asset URLs
- Call create_video with the TSX code

## generate_project_from_prompt (combined)

This tool runs the full pipeline in one call:
1. Calls generate_script internally
2. Optionally calls generate_images (set generateImages: true)
3. Optionally calls generate_audio (set generateAudio: true)
4. Calls create_scene_sequence to make the project

Returns: \`{ jobId, project, scenePlan }\`
`;

export const RULE_AI_SAFETY = `# AI Generation — Safety & Content Policy

## Content Policy

All generation requests must comply with provider content policies.
The following content categories are blocked by default:

- Hate speech or discrimination targeting any group
- Violence or graphic content
- Sexually explicit content
- Personal information or likeness of real people without consent
- Misinformation presented as fact
- Content promoting illegal activity

Violating content policy will result in the provider returning an error.
The generation job will transition to \`status: "failed"\` with an error message.

## Safety Status on Generated Assets

Generated assets carry a \`safetyStatus\` field in their provenance metadata:
- \`unchecked\` — no moderation check performed
- \`passed\` — provider moderation passed
- \`flagged\` — provider flagged for review (not blocked)
- \`blocked\` — provider refused to generate

Always check \`safetyStatus\` before using generated content in public-facing projects.

## Error Handling

If a generation fails:
1. The job transitions to \`status: "failed"\`
2. The \`error\` field contains the provider error message
3. Call **regenerate_scene_asset** to retry a specific scene
4. Or call the generation tool again with a refined prompt

Common failure reasons:
- Missing API key: set the appropriate env var (OPENAI_API_KEY etc.)
- Rate limit: wait and retry
- Content policy violation: revise the prompt
- Network timeout: retry with a shorter prompt or fewer scenes

## Provider Credentials

Credentials are server-side only. Clients never receive or need to provide API keys.
The Studio API and MCP server use environment variables to resolve providers at runtime.

## Idempotency

Each generation call creates a new job with a unique \`jobId\`.
Re-running the same prompt may produce different results (LM/diffusion are stochastic).
Use \`regenerate_scene_asset\` to re-roll a specific scene's image or audio while keeping the rest.
`;
