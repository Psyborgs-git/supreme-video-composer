# MCP Server API Reference

The Media Studio MCP (Model Context Protocol) server enables AI assistants like Claude and GPT to interact with the video creation platform programmatically.

## Overview

**Transport**: stdio or Streamable HTTP (`/mcp`)

**Usage**: Connect via Claude, Cursor, or any MCP-compatible client

**Available Tools**: Template, project, asset, render, caption, prompt, and template-authoring tools

### Starting the Server

```bash
# Local client-spawned stdio transport
npm run mcp:stdio

# Long-running HTTP transport
npm run mcp:http

# Full Studio + MCP stack
docker compose up --build studio mcp

# Override published host ports when needed
HOST_STUDIO_PORT=3001 HOST_MCP_PORT=19090 docker compose up --build studio mcp
```

The HTTP server listens on `http://localhost:9090/mcp` by default and exposes `GET /health` for readiness checks. In Docker Compose, `HOST_STUDIO_PORT` and `HOST_MCP_PORT` override the published host ports without changing the container-to-container URLs.

When `STUDIO_API_BASE_URL` is set, project, asset, and render tools proxy to the real Studio backend. Without it, the MCP package falls back to its local in-memory handlers for standalone usage.

---

## Tool Reference

### 1. list_templates

**Description**: Get all available templates with metadata.

**Input**: None (`{}`)

**Output**:
```json
[
  {
    "id": "history-storyline",
    "name": "History Storyline",
    "description": "Historical events with Ken Burns effect and narration",
    "category": "educational",
    "tags": ["timeline", "narrative", "photography"],
    "supportedAspectRatios": ["16:9", "9:16", "1:1", "4:5"]
  },
  {
    "id": "beat-synced-visualizer",
    "name": "Beat-Synced Visualizer",
    ...
  }
  // ... remaining registered templates
]
```

**Use Cases**:
- Discover available templates
- Build a template selector UI
- Check if specific template exists

**Example**:
```
Claude: "What templates do you have for music videos?"
→ list_templates() → Beat-Synced Visualizer returned
```

---

### 2. create_project

**Description**: Create a new project from a template.

**Input**:
```json
{
  "templateId": "history-storyline" | string,
  "name": "My Project" | string,
  "inputProps"?: { [key: string]: any },
  "aspectRatio"?: "16:9" | "9:16" | "1:1" | "4:5" | "4:3" | "2:3" | "21:9"
}
```

- **templateId** (required): ID from `list_templates()`
- **name** (required): Project display name
- **inputProps** (optional): Initial properties. If omitted, uses template defaults
- **aspectRatio** (optional): Preset or custom dims. Default: "16:9"

**Output**:
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "name": "My Project",
  "templateId": "history-storyline",
  "inputProps": { /* validated props */ },
  "aspectRatio": {
    "preset": "16:9",
    "width": 1920,
    "height": 1080
  },
  "exportFormat": {
    "codec": "h264",
    "fileExtension": ".mp4",
    "crf": 18,
    "fps": 30,
    "scale": 1
  },
  "createdAt": "2026-04-05T10:30:00Z",
  "updatedAt": "2026-04-05T10:30:00Z",
  "version": 1
}
```

**Error Response**:
```json
{
  "isError": true,
  "content": [
    {
      "type": "text",
      "text": "Error: Template \"invalid-id\" not found"
    }
  ]
}
```

**Validation**:
- templateId must exist
- inputProps must pass template's Zod schema
- name cannot be empty

**Example**:
```
Claude: "Create a social media reel project with 3 slides"
→ create_project({
    "templateId": "social-media-reel",
    "name": "Product Launch Reel",
    "inputProps": {
      "slides": [
        { "mediaUrl": "/assets/images/p1.jpg", "mediaType": "image" },
        ...
      ]
    },
    "aspectRatio": "9:16"
  })
```

---

### 3. update_project

**Description**: Update an existing project's properties.

**Input**:
```json
{
  "projectId": "550e8400-e29b-41d4-a716-446655440000",
  "name"?: "Updated Name",
  "inputProps"?: { /* new props */ },
  "aspectRatio"?: "9:16"
}
```

**Output**: Updated Project object (same shape as `create_project`)

**Changes**:
- `version` incremented (1 → 2)
- `updatedAt` timestamp updated
- Only provided fields are modified

**Example**:
```
→ update_project({
    "projectId": "550e8400...",
    "inputProps": {
      "musicUrl": "/assets/audio/new-track.mp3",
      "musicVolume": 0.5
    }
  })
```

---

### 4. get_project

**Description**: Retrieve full project data.

**Input**:
```json
{
  "projectId": "550e8400-e29b-41d4-a716-446655440000"
}
```

**Output**: Full Project object

**Error**: Returns error if projectId doesn't exist

**Example**:
```
→ get_project({ "projectId": "550e8400..." })
```

---

### 5. list_projects

**Description**: Get summary of all saved projects.

**Input**: None

**Output**:
```json
[
  {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "name": "My Project",
    "templateId": "history-storyline",
    "aspectRatio": "16:9",
    "updatedAt": "2026-04-05T10:30:00Z"
  }
  // ... all projects (lightweight summary)
]
```

**Use Cases**:
- List recent projects
- Check if project exists before creating
- Show project inventory

**Example**:
```
Claude: "Show me all my projects"
→ list_projects()
```

---

### 6. render_project

**Description**: Queue a project for rendering.

**Input**:
```json
{
  "projectId": "550e8400-e29b-41d4-a716-446655440000",
  "codec"?: "h264" | "h265" | "vp8" | "vp9" | "av1" | "prores" | "gif",
  "quality"?: "draft" | "standard" | "high" | "max"
}
```

- **projectId** (required): Project to render
- **codec** (optional): Override project codec. Default: h264
- **quality** (optional): Quality preset. Default: standard

**Output**:
```json
{
  "id": "0a1b2c3d-4e5f-6g7h-8i9j-0k1l2m3n4o5p",
  "projectId": "550e8400-...",
  "templateId": "history-storyline",
  "status": "queued",
  "exportFormat": {
    "codec": "h264",
    "fileExtension": ".mp4",
    "crf": 18,
    "scale": 1
  },
  "outputPath": null,
  "error": null,
  "progress": 0.0,
  "createdAt": "2026-04-05T10:35:00Z",
  "startedAt": null,
  "completedAt": null
}
```

**Status Flow**:
1. `queued` — Waiting in queue
2. `bundling` — Webpack bundling composition
3. `rendering` — FFmpeg rendering frames
4. `encoding` — FFmpeg encoding to codec
5. `complete` — Finished, output available
6. `error` — Failed with error message
7. `cancelled` — User cancelled

**Timing**:
- History Storyline (30s): ~3 min
- Beat Visualizer (30s): ~5 min
- Quote Cards (30s): ~2 min
- Social Reel (30s): ~4 min
- Product Showcase (30s): ~2 min

**Example**:
```
→ render_project({
    "projectId": "550e8400-...",
    "codec": "h264",
    "quality": "high"
  })
→ Returns jobId to poll with get_render_status()
```

---

### 7. get_render_status

**Description**: Check render job status and progress.

**Input**:
```json
{
  "jobId": "0a1b2c3d-4e5f-6g7h-8i9j-0k1l2m3n4o5p"
}
```

**Output**:
```json
{
  "id": "0a1b2c3d-4e5f-6g7h-8i9j-0k1l2m3n4o5p",
  "projectId": "550e8400-...",
  "templateId": "history-storyline",
  "status": "rendering",
  "progress": {
    "progress": 0.45,
    "renderedFrames": 27,
    "encodedFrames": 24,
    "totalFrames": 60,
    "stage": "rendering"
  },
  "outputPath": null,
  "error": null,
  "createdAt": "2026-04-05T10:35:00Z",
  "startedAt": "2026-04-05T10:35:30Z",
  "completedAt": null
}
```

**Progress Object**:
- **progress**: 0.0–1.0 (0% to 100%)
- **renderedFrames**: Frames generated so far
- **encodedFrames**: Frames compressed to target codec
- **totalFrames**: Total frames in composition
- **stage**: "bundling" | "rendering" | "encoding"

**Polling Pattern**:
```
1. Call render_project() → get jobId
2. Loop:
   - Call get_render_status(jobId)
   - If status == "complete": break
   - If status == "error": handle error
   - Wait 1-2 seconds
   - Display progress bar
3. Output file path available in outputPath
```

**Example**:
```
→ get_render_status({ "jobId": "0a1b2c3d-..." })
→ { status: "rendering", progress: 0.45 }
```

---

### 8. export_formats

**Description**: Get available export format options.

**Input**: None

**Output**:
```json
{
  "codecs": {
    "h264": {
      "extension": ".mp4",
      "crfRange": "1-51",
      "description": "Most compatible"
    },
    "h265": { "extension": ".mp4", "crfRange": "0-51", "description": "Better compression" },
    "vp8": { "extension": ".webm", "crfRange": "4-63", "description": "WebM legacy" },
    "vp9": { "extension": ".webm", "crfRange": "0-63", "description": "WebM modern" },
    "av1": { "extension": ".webm", "crfRange": "0-63", "description": "Best compression" },
    "prores": { "extension": ".mov", "description": "Professional, lossless" },
    "gif": { "extension": ".gif", "description": "Animated GIF" }
  },
  "qualityPresets": {
    "draft": 28,
    "standard": 18,
    "high": 12,
    "max": 1
  },
  "fpsOptions": [24, 25, 30, 50, 60]
}
```

**Interpretation**:
- **CRF** (Constant Rate Factor): 0-51 for H.264. Lower = better quality, larger file
  - draft (28): Fast, lower quality
  - standard (18): Balanced (default)
  - high (12): High quality, medium size
  - max (1): Best quality, largest file
- **FPS**: Frames per second (24 for film, 30 for web, 60 for motion)

**Example**:
```
Claude: "What formats can I export to?"
→ export_formats()
→ Returns all codecs and quality options
```

---

## Integration Examples

### Claude Integration

**System Prompt**:
```
You are a video creation assistant. Help users create and render videos
using the Media Studio platform. Use the available tools to:
1. List templates
2. Create projects
3. Update properties
4. Render to outputs
```

**Example Conversation**:
```
User: "Create a quote video with these quotes: [list]"

Claude:
1. list_templates() → Find "quote-card-sequence"
2. create_project({
     templateId: "quote-card-sequence",
     name: "Quote Collection",
     inputProps: { quotes: [...] }
   })
3. render_project({ projectId: ... })
4. Poll get_render_status() until complete
→ User: "Your video is ready at /exports/..."
```

### Batch Rendering

```
Loop over 10 projects:
1. render_project(projectId1, codec: "h264")
2. render_project(projectId2, codec: "h264")
3. ...
4. Poll all with get_render_status()
→ Sequential rendering (one at a time)
```

### Format Comparison

```
Same project, multiple exports:
1. render_project(id, codec: "h264", quality: "standard")
2. render_project(id, codec: "h265", quality: "high")
3. render_project(id, codec: "vp9", quality: "standard")
→ Compare file sizes and playback quality
```

---

## Error Handling

All tools return structured errors:

```json
{
  "isError": true,
  "content": [
    {
      "type": "text",
      "text": "Validation error: inputProps.events must have at least 1 item"
    }
  ]
}
```

**Common Errors**:
- Template not found
- Invalid aspect ratio
- Missing required inputProps
- Invalid JSON in inputProps
- Project ID doesn't exist
- Codec not supported

**Retry Strategy**:
1. Validate input before calling
2. If tool returns error, log and retry
3. For render jobs: poll get_render_status() frequently (1-2s interval)

---

## Rate Limiting & Concurrency

- **Rendering**: Sequential (one job at a time)
- **Tool calls**: No limit (instant for non-render tools)
- **Concurrent creations**: OK (in-memory stores)
- **Max queue**: Unlimited (rendered sequentially)

**Practical Limits**:
- 1-2 renders can run in parallel without OOM
- Recommend sequential for stability
- Monitor Memory: ~1-2GB peak per render

---

## Persistence

- **Projects**: Saved to `/projects/{id}.json`
- **Render jobs**: In-memory (lost on server restart)
- **Assets**: Stored in `/assets/` directory
- **Outputs**: Saved to `/exports/` directory

For production, consider:
- Database storage instead of files
- Permanent job queue (Redis, etc.)
- Webhook callbacks on render completion

---

## Future Extensions

- `upload_asset_content` — Stream binary asset uploads directly through MCP
- `batch_render` — Queue multiple projects in one call
- `template_versions` — Inspect and roll back generated template variants

---

## Configuration

Common environment variables:

- `MCP_TRANSPORT` / `--transport` — `stdio`, `http`, or `auto`
- `MCP_HOST` / `MCP_PORT` — bind address for the HTTP MCP server
- `STUDIO_API_BASE_URL` — Studio API base URL used for project/asset/render tools
- `STUDIO_PUBLIC_URL` — public browser URL used when returning preview links

If `STUDIO_API_BASE_URL` is omitted, the MCP server keeps using its local fallback state instead of the Studio backend.

---

## Support & Troubleshooting

**Server won't start**:
```bash
# Check dependencies
npm install

# Verify imports
npm run --workspace @studio/mcp-server type-check
```

- For HTTP mode, check `http://localhost:9090/health` or the alternate host port you published with `HOST_MCP_PORT`
- For Docker Compose, confirm `STUDIO_API_BASE_URL=http://studio:3000`

**Tool returns error**:
1. Check inputProps schema matches template
2. Validate aspect ratio is from preset list
3. Review error message for specific field
4. If the tool hits app state, verify the Studio backend is reachable

**Renders hang**:
- Server processes renders sequentially
- Check CPU/memory availability
- Review FFmpeg logs if available
- Confirm the MCP server is configured to reach the Studio API in HTTP mode

---

## See Also

- [ARCHITECTURE.md](ARCHITECTURE.md) — System design
- [EXPORT_FORMATS.md](EXPORT_FORMATS.md) — Codec details
- [TEMPLATES.md](TEMPLATES.md) — Template inputProps schemas

---

## AI Generation Tools

These tools call LM and diffusion model providers to create images, audio narration, and video assets, then assemble them into Remotion projects.

### Rule Tools (read first)

| Tool | Description |
|------|-------------|
| `rule_ai_generation_overview` | Capabilities, tool map, workflow, provider configuration |
| `rule_ai_asset_constraints` | Image/audio/video file limits, Remotion compatibility |
| `rule_ai_prompting` | How to write effective prompts for each modality |
| `rule_ai_project_assembly` | Mapping generated assets into projects and templates |
| `rule_ai_safety` | Content policy, error handling, provider failures |

### Generation Tools

#### `generate_script`

Generate a structured video scene plan from a text prompt.

**Parameters:**
- `prompt` (string, required) — The topic or concept
- `sceneCount` (integer, 1–20, default: 5) — Number of scenes to generate
- `style` (string, optional) — Pacing: `"fast"`, `"slow"`, `"dramatic"`, `"playful"`
- `genre` (string, optional) — Type: `"documentary"`, `"product"`, `"educational"`, `"social"`

**Returns:**
```json
{
  "jobId": "gen-xxxx",
  "scenePlan": {
    "title": "string",
    "description": "string",
    "narrationScript": "string",
    "backgroundMusicStyle": "string",
    "scenes": [
      {
        "title": "string",
        "body": "string",
        "imagePrompt": "string",
        "voiceoverText": "string",
        "durationFrames": 150,
        "enterTransition": "fade",
        "exitTransition": "fade",
        "imageUrl": ""
      }
    ]
  }
}
```

---

#### `generate_images`

Generate images for a list of scene descriptions using a diffusion model.

**Parameters:**
- `scenes` (array, required) — Each item: `{ body: string, imagePrompt?: string }`
- `width` (integer, optional) — Output image width in pixels
- `height` (integer, optional) — Output image height in pixels

**Returns:**
```json
{
  "jobId": "gen-xxxx",
  "images": [
    { "imageUrl": "https://...", "usedPrompt": "string" }
  ]
}
```

---

#### `generate_audio`

Synthesise narration audio from text using a TTS provider.

**Parameters:**
- `text` (string, required) — The narration text
- `voiceId` (string, optional) — Provider voice ID
- `speed` (number, 0.25–4.0, optional) — Speaking speed multiplier
- `format` (`"mp3"` | `"wav"`, default: `"mp3"`) — Output format

**Returns:**
```json
{
  "jobId": "gen-xxxx",
  "audio": {
    "url": "data:audio/mpeg;base64,...",
    "mimeType": "audio/mpeg",
    "durationSeconds": 12.5
  }
}
```

---

#### `generate_video_assets`

Generate short video clips per scene (Mode A: assets-per-scene).

**Parameters:**
- `scenes` (array, required) — Each: `{ prompt: string, imageUrl?: string, durationSeconds?: number }`
- `width` (integer, optional)
- `height` (integer, optional)

**Returns:**
```json
{
  "jobId": "gen-xxxx",
  "clips": [
    { "url": "https://...", "mimeType": "video/mp4", "durationSeconds": 5 }
  ]
}
```

---

#### `generate_project_from_prompt`

Full pipeline: prompt → scene plan → (optional) images → (optional) audio → create a `prompt-to-video` project.

**Parameters:**
- `prompt` (string, required) — Describes the video to create
- `name` (string, optional) — Project name (defaults to generated title)
- `sceneCount` (integer, 1–20, default: 5)
- `style` (string, optional)
- `generateImages` (boolean, default: false) — Generate images for each scene
- `generateAudio` (boolean, default: false) — Generate narration audio
- `aspectRatio` (enum, optional) — Aspect ratio preset

**Returns:**
```json
{
  "jobId": "gen-xxxx",
  "project": { /* Project object */ },
  "scenePlan": { /* ScenePlan object */ }
}
```

---

#### `get_generation_status`

Retrieve the current status and outputs of a generation job.

**Parameters:**
- `jobId` (string, required)

**Returns:** `GenerationJob` object with `status`, `outputs`, `assetIds`, `error`.

---

#### `list_generation_jobs`

List all generation jobs with optional filters.

**Parameters:**
- `modality` (`"script"` | `"image"` | `"audio"` | `"video"`, optional)
- `status` (`"queued"` | `"running"` | `"completed"` | `"failed"` | `"cancelled"`, optional)

**Returns:** `{ jobs: GenerationJob[] }`

---

#### `approve_generated_assets`

Mark a completed generation job's outputs as approved.

**Parameters:**
- `jobId` (string, required)

**Returns:** `{ approved: true, jobId, outputs }`

---

#### `regenerate_scene_asset`

Regenerate the image or audio for a specific scene in an existing project.

**Parameters:**
- `projectId` (string, required)
- `sceneIndex` (integer, required) — Zero-based index
- `assetType` (`"image"` | `"audio"`, required)
- `prompt` (string, optional) — Explicit prompt (falls back to scene body/voiceoverText)

**Returns:** `{ project, imageUrl?, audioUrl?, sceneIndex }`

---

### Workflow Examples

#### Prompt → Scenes → Images → Project → Render

```
1. generate_script({ prompt: "Space documentary", sceneCount: 5 })
   → { jobId, scenePlan: { scenes: [...] } }

2. generate_images({ scenes: scenePlan.scenes.map(s => ({ body: s.body, imagePrompt: s.imagePrompt })) })
   → { images: [{ imageUrl, usedPrompt }, ...] }

3. create_scene_sequence({
     templateId: "prompt-to-video",
     name: "Space Documentary",
     scenes: scenePlan.scenes.map((s, i) => ({ ...s, imageUrl: images[i].imageUrl }))
   })
   → { id: "project-xxx", ... }

4. render_project({ projectId: "project-xxx" })
   → { jobId: "render-xxx", status: "queued" }
```

#### Prompt → TTS Narration → prompt-to-video Project

```
1. generate_script({ prompt: "Product launch for AcmePro v2", sceneCount: 4 })
   → { scenePlan }

2. generate_audio({ text: scenePlan.narrationScript })
   → { audio: { url: "data:audio/mpeg;base64,..." } }

3. create_scene_sequence({ templateId: "prompt-to-video", name: "AcmePro Launch", scenes: scenePlan.scenes })
   → { id: "project-yyy" }
```

#### Quick One-Call Generation

```
generate_project_from_prompt({
  prompt: "A 3-scene explainer about renewable energy",
  sceneCount: 3,
  generateImages: true,
  generateAudio: false,
  aspectRatio: "16/9"
})
→ { jobId, project, scenePlan }
```

### Generation Error Handling

| Error Code | Meaning |
|---|---|
| `VALIDATION_ERROR` | Required param missing or invalid |
| `GENERATION_FAILED` | Provider API returned an error |
| `JOB_NOT_FOUND` | jobId does not exist |
| `JOB_NOT_COMPLETED` | Trying to approve a non-completed job |
| `PROJECT_NOT_FOUND` | projectId not found for regeneration |
| `INVALID_SCENE_INDEX` | Scene index out of range |

**Retry pattern:**
1. Check `error` field in the job or error response
2. For `GENERATION_FAILED`: revise prompt or check API key env var
3. For rate limits: wait and retry with the same params
4. Use `regenerate_scene_asset` to re-roll one scene without restarting the full pipeline


---

## Automation Workflow Tools

The following REST endpoints (accessible from MCP tools or direct API calls) power the no-code workflow builder.

### Workflow Step Management

#### `GET /api/orgs/:orgSlug/automations/:id/steps`
Returns all workflow steps for the automation in order.

#### `POST /api/orgs/:orgSlug/automations/:id/steps`
Create a new workflow step.
```json
{ "type": "generate_text", "order": 0, "promptTemplate": "{{topic}} video script", "provider": "gemini", "model": "gemini-1.5-flash", "outputSlotKey": "script" }
```

#### `PATCH /api/orgs/:orgSlug/automations/:id/steps/:stepId`
Update step fields (promptTemplate, provider, model, outputSlotKey, conditionExpr, inputSlotBindings).

#### `DELETE /api/orgs/:orgSlug/automations/:id/steps/:stepId`
Delete a step.

#### `POST /api/orgs/:orgSlug/automations/:id/steps/reorder`
Reorder steps by providing an `orderedIds` array of step IDs.

### Approval Policy

#### `GET /api/orgs/:orgSlug/automations/:id/policy`
Returns the current approval policy.

#### `PUT /api/orgs/:orgSlug/automations/:id/policy`
Update the approval policy.
```json
{ "mode": "require_approval", "approverRole": "admin", "timeoutMinutes": 60, "onTimeout": "pause" }
```

### Run History

#### `GET /api/orgs/:orgSlug/automations/:id/runs`
Returns paginated list of automation runs with step-level status detail.
Query params: `?page=1&limit=20`

#### `GET /api/orgs/:orgSlug/automations/:id/runs/:runId`
Full run detail: steps, outputs, credits used, approval status.

### Approval Actions

#### `POST /api/orgs/:orgSlug/automations/:id/runs/:runId/approve`
Approve a pending run. Requester must have role ≥ `approverRole` from policy.

#### `POST /api/orgs/:orgSlug/automations/:id/runs/:runId/reject`
Reject a pending run. Same role requirement.

---

## Provider Selection in Generation Tools

When calling `generate_video_assets`, `generate_project_from_prompt`, or `POST /api/generation`, you can specify a preferred provider via environment variables:

| Modality | Env variable | Supported values |
|---|---|---|
| Text/Script | `AI_TEXT_PROVIDER` | `openai`, `google-vertex`, `gemini`, `mock` |
| Image | `AI_IMAGE_PROVIDER` | `openai`, `google-vertex`, `aws`, `mock` |
| Audio | `AI_AUDIO_PROVIDER` | `openai`, `elevenlabs`, `mock` |
| Video | `AI_VIDEO_PROVIDER` | `higgsfield`, `runway`, `luma`, `synthesia`, `aws`, `mock` |

The `PROVIDER_CAPABILITY_MAP` in `packages/shared-types` documents available models, modalities, async mode, and approximate credit cost for each provider — use it to build provider-picker UI without importing server-only code.
