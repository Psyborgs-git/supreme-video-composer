# MCP Server API Reference

The Media Studio MCP (Model Context Protocol) server enables AI assistants like Claude and GPT to interact with the video creation platform programmatically.

## Overview

**Transport**: stdio (stdin/stdout)

**Usage**: Connect via Claude, Cursor, or any MCP-compatible client

**Available Tools**: 8 tools for template management, project CRUD, and rendering

### Starting the Server

```bash
bun run --filter '@studio/mcp-server' start
```

The server will listen on stdin/stdout, ready for MCP tool calls.

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
  // ... 5 templates total
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

## Future Tools (Planned)

- `preview_project` — Generate preview URL
- `list_assets` — Scan available assets
- `upload_asset` — Add new asset
- `cancel_render` — Stop in-progress render
- `export_project` — Multi-format batch export
- `template_customization` — Advanced schema modifications

---

## Configuration

No configuration needed. Server starts with:
- In-memory stores
- stdio transport
- Default asset paths (/assets, /projects, /exports)

---

## Support & Troubleshooting

**Server won't start**:
```bash
# Check dependencies
bun install

# Verify imports
bun run --filter '@studio/mcp-server' type-check
```

**Tool returns error**:
1. Check inputProps schema matches template
2. Validate aspect ratio is from preset list
3. Review error message for specific field

**Renders hang**:
- Server processes renders sequentially
- Check CPU/memory availability
- Review FFmpeg logs if available

---

## See Also

- [ARCHITECTURE.md](ARCHITECTURE.md) — System design
- [EXPORT_FORMATS.md](EXPORT_FORMATS.md) — Codec details
- [TEMPLATES.md](TEMPLATES.md) — Template inputProps schemas
