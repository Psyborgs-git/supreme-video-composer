# Architecture Overview

## System Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                          Browser (http://localhost:5173)                │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │  apps/studio (Vite + React 19)                                   │  │
│  │  ├─ Dashboard: Template grid, recent projects                   │  │
│  │  ├─ Editor: Player preview + form sidebar                       │  │
│  │  ├─ Asset Manager: Image, audio, video browser                 │  │
│  │  └─ Export Panel: Format selector, render progress              │  │
│  │                                                                  │  │
│  │  State (Zustand):                                                │  │
│  │  ├─ editorStore: Current project, inputProps                   │  │
│  │  ├─ renderStore: Render queue, job status                      │  │
│  │  └─ assetStore: Available assets                               │  │
│  └──────────────────────────────────────────────────────────────────┘  │
│         HTTP/SSE ↓                    ↓ import                          │
└─────────────────────────────────────────────────────────────────────────┘
                        ↓                              ↓
        ┌─────────────────────────┐     ┌──────────────────────────────┐
        │  Node.js (Bun runtime)  │     │  Bun Workspace Packages      │
        │                         │     │                              │
        │  apps/mcp-server        │     │  packages/remotion-          │
        │  (MCP SDK + stdio)       │     │  compositions               │
        │  • list_templates       │     │  • Root.tsx (registry)       │
        │  • create_project       │     │  • 5 templates               │
        │  • render_project       │     │  • animations utils          │
        │  • export_formats       │     │  • public/ (assets)          │
        │  • ...8 tools total     │     │                              │
        └─────────────────────────┘     └──────────────────────────────┘
                     ↓                                  ↓
                ┌────────────────────────────────────────────────────┐
                │         Shared Infrastructure                       │
                │  ┌────────────────────────────────────────────┐   │
                │  │ packages/shared-types                      │   │
                │  │ • RenderJob, Project, TemplateManifest    │   │
                │  │ • AspectRatioConfig, ExportFormat        │   │
                │  │ • Zod schemas for validation              │   │
                │  └────────────────────────────────────────────┘   │
                │  ┌────────────────────────────────────────────┐   │
                │  │ packages/template-registry                 │   │
                │  │ • getTemplate(id) / getAllTemplates()      │   │
                │  │ • validateInputProps(id, props)            │   │
                │  │ • Manifest metadata for all 5 templates    │   │
                │  └────────────────────────────────────────────┘   │
                │  ┌────────────────────────────────────────────┐   │
                │  │ packages/renderer                          │   │
                │  │ • RenderQueue (EventEmitter)               │   │
                │  │ • @remotion/renderer wrapper               │   │
                │  │ • Status: queued→bundling→rendering→       │   │
                │  │           encoding→complete/error          │   │
                │  └────────────────────────────────────────────┘   │
                └────────────────────────────────────────────────────┘
                                     ↓
                        ┌──────────────────────────┐
                        │  Node.js File System     │
                        │  ├─ /projects/*.json     │
                        │  ├─ /assets/*            │
                        │  ├─ /exports/*           │
                        │  └─ /public/*            │
                        └──────────────────────────┘
                                     ↓
                        ┌──────────────────────────┐
                        │  FFmpeg + Remotion       │
                        │  • bundle() - webpack    │
                        │  • renderMedia() - h264  │
                        │  • renderStill() - PNG   │
                        └──────────────────────────┘
```

## Component Roles

### Frontend (apps/studio)

**Purpose**: Web UI for creating and managing video projects.

**Stack**: Vite + React 19 + Tailwind CSS 4 + React Router 7 + Zustand

**Key Pages**:
- **Dashboard**: Template grid, recent projects, quick-create flow
- **Editor**: Live preview (Remotion Player), property form (schema-driven), asset browser sidebar
- **Export**: Format selector (codec, quality, aspect ratio), render progress stream, output management

**State Management** (Zustand stores):
- `editorStore`: Current project, inputProps, aspect ratio, FPS
- `renderStore`: Render queue, job status, progress updates
- `assetStore`: Scanned assets, upload queue

**Data Flow**:
1. User selects template on Dashboard
2. New project created via `template-registry.getTemplate()`
3. Editor loads with form generated from Zod schema
4. Form changes update `editorStore.inputProps`
5. Player re-renders with new props (live preview)
6. User clicks Export → `RenderQueue.enqueue()` → progress SSE stream
7. Output appears in exports directory

### Backend - MCP Server (apps/mcp-server)

**Purpose**: AI-native API for programmatic video creation.

**Stack**: Node.js + MCP SDK + transport-aware stdio/Streamable HTTP bootstrap + TypeScript

**Key modules**:
- `src/index.ts` — bootstrap and transport selection
- `src/create-server.ts` — tool registration
- `src/runtime.ts` — env/config resolution
- `src/http-server.ts` — `/mcp` and `/health` HTTP server
- `src/studio-api-client.ts` — Studio backend adapter for app-backed tools

**Tool surface**:
- `list_templates()` — Returns array of TemplateManifest objects
- `create_project(templateId, name, inputProps?, aspectRatio?)` — Creates and saves project
- `update_project(projectId, name?, inputProps?, aspectRatio?)` — Mutates existing project
- `get_project(projectId)` — Retrieves project data
- `list_projects()` — Returns summary of all projects
- `render_project(projectId, codec?, quality?)` — Queues render job
- `get_render_status(jobId)` — Returns job status and progress
- `export_formats()` — Returns available codec/quality options

**State model**:
- Project, asset, and render tools use the Studio API as the source of truth when `STUDIO_API_BASE_URL` is configured
- Local utility tools continue to run inside the MCP package
- Standalone runs without `STUDIO_API_BASE_URL` fall back to the local in-memory handlers

**Error Handling**: All inputs validated with Zod. Invalid input returns `{ isError: true, content: [{ text: "error message" }] }`

### Rendering Engine (packages/renderer)

**Purpose**: Wrapper around Remotion's `@remotion/renderer` API with queue management.

**Classes**:
- `RenderQueue(EventEmitter)`: Manages job sequencing
  - `enqueue(job)`: Add to queue, return Promise
  - `getJob(id)`: Retrieve job status
  - `getAllJobs()`: Return all jobs
  - `cancelJob(id)`: Cancel queued or active job
  - Events: `job:queued`, `job:started`, `job:progress`, `job:complete`, `job:error`, `job:cancelled`

**Render Pipeline** (executeRender):
1. `bundle(entryPoint)` → Webpack bundle with webpack dev server
2. `selectComposition(serveUrl, id, inputProps)` → Get composition config
3. `renderMedia(serveUrl, composition, codec, outputLocation, onProgress)` → Render frames
4. `onProgress` callback → update job status and emit events
5. Return outputPath on success or throw error

**Status Lifecycle**:
```
queued → bundling → rendering → encoding → complete
              ↓                       ↓          ↓
              └──────→ error or cancelled (stop)
```

### Template Registry (packages/template-registry)

**Purpose**: Central registry of all available templates with validation.

**Exports**:
- `getTemplate(id)` — Returns `{ manifest: TemplateManifest, component: React.FC }`
- `getAllTemplates()` — Returns array of all 5 templates
- `getTemplateManifests()` — Manifest info without components
- `validateInputProps(templateId, props)` — Zod validation, returns `{ success, data?, error? }`

**Manifest Structure**:
```ts
{
  id: "history-storyline",
  name: "History Storyline",
  description: "...",
  category: "educational",
  tags: ["timeline", "narrative"],
  supportedAspectRatios: ["16:9", "9:16", "1:1"],
  defaultProps: { /* default values */ },
  defaultFps: 30,
  defaultDurationInFrames: 1800,
  component: HistoryStorylineComponent,
}
```

### Shared Types (packages/shared-types)

**Purpose**: Single source of truth for TypeScript interfaces and Zod schemas.

**Key Exports**:
- `RenderJob` interface and schema
- `Project` interface
- `TemplateManifest` interface
- `AspectRatioConfig` interface
- `ExportFormat` interface
- `ASPECT_RATIO_DIMENSIONS` — Map of preset names to width/height
- `QUALITY_CRF` — Map of quality levels to H.264 CRF values

**Zod Schemas**:
- `AspectRatioPresetSchema` — Validates aspect ratio strings
- `VideoCodecSchema` — Validates codec names
- `RenderStatusSchema` — Validates render job status
- `QualityPresetSchema` — Validates quality levels

### Remotion Compositions (packages/remotion-compositions)

**Purpose**: Remotion project with registered templates + rendering entry point.

**Key Files**:
- `Root.tsx` — Registers all 5 compositions via `<Composition>`
- `src/templates/` — One React component per template
- `src/animations/` — Reusable animation utilities (spring, interpolate helpers)
- `public/` — Static assets loaded via `staticFile()` in components
- `remotion.config.ts` — Remotion configuration (bundler options, default codec)

**Composition Registration**:
```tsx
// Root.tsx dynamically registers from registry
const templates = getAllTemplates();
templates.forEach(({ id, manifest, component }) => {
  <Composition
    id={id}
    component={component}
    durationInFrames={manifest.defaultDurationInFrames}
    fps={manifest.defaultFps}
    width={ASPECT_RATIO_DIMENSIONS["16:9"].width}
    height={ASPECT_RATIO_DIMENSIONS["16:9"].height}
    defaultProps={manifest.defaultProps}
    calculateMetadata={manifest.calculateMetadata}
  />
});
```

## Data Flow Examples

### Creating a Project (UI → MCP)

1. **Dashboard**: User clicks "Create Project" → selects "Quote Card Sequence"
2. **UI State**: `editorStore.selectTemplate("quote-card-sequence")`
3. **API Call**: MCP tool `create_project({ templateId, name, inputProps })`
4. **Handler** (handlers.ts):
   - Call `getTemplate(templateId)` from registry
   - Validate `inputProps` via `validateInputProps()`
   - Create Project object with auto-generated UUID
   - Store in `projectStore.set(id, project)`
   - Return Project JSON
5. **UI Update**: `editorStore.setCurrentProject(project)`
6. **Player**: Re-renders with new inputProps from template defaults

### Rendering a Video (Export → Renderer → Output)

1. **Export Panel**: User selects h264, "High" quality, clicks "Export"
2. **MCP Call**: `render_project({ projectId, codec: "h264", quality: "high" })`
3. **Handler**:
   - Load project via `projectStore.get(projectId)`
   - Create RenderJob with `status: "queued"`
   - Call `renderQueue.enqueue(job)`
4. **RenderQueue**:
   - Checks if job already active → wait
   - Sets job status → "bundling"
   - Calls `renderFn(job, onProgress)`
   - Emit `job:progress` events
5. **Render Function** (render.ts):
   - `bundle(entry)` → webpack dev server
   - `selectComposition({ serveUrl, id, inputProps })`
   - `renderMedia({ serveUrl, composition, codec, outputLocation, onProgress })`
   - FFmpeg encodes frames to MP4
6. **Completion**:
   - Job status → "complete"
   - `outputPath` set to MP4 file location
   - RenderQueue emits `job:complete`
   - SSE stream notifies UI
7. **Output**: File saved to `/exports/quote-card_{projectId}_{timestamp}.mp4`

## Performance Considerations

### Memory
- **Bundling**: ~500MB (Webpack dev server with Remotion)
- **Rendering**: ~1-2GB peak (FFmpeg + frame buffers)
- **Preview**: ~300MB (Player + cached bundle)

### Speed
- **Bundle**: ~30-60s first time, cached on subsequent renders
- **30s Video**:
  - History Storyline: ~3 min
  - Beat-Synced Visualizer: ~5 min (audio processing)
  - Quote Cards: ~2 min
  - Social Reel: ~4 min
  - Product Showcase: ~2 min
- **Preview FPS**: 20-30 (browser rendering, not real-time)

### Optimization Tips
1. **Reduce resolution** for faster preview (use scale: 0.5 in export)
2. **Cache assets** — upload once, reference in multiple projects
3. **Use render queue** — sequential jobs avoid OOM crashes
4. **Close browser tabs** — frees memory for rendering

## Extension Points

### Adding a New Template

1. Create component in `packages/remotion-compositions/src/templates/YourTemplate.tsx`
2. Define Zod schema in same file or `schemas.ts`
3. Create TemplateManifest object
4. Register in `packages/template-registry/src/templates.ts`
5. Add to export in `packages/template-registry/src/index.ts`
6. Manifest automatically appears in `list_templates()` and Dashboard

### Custom Export Format

1. Extend `ExportFormat` interface in `packages/shared-types`
2. Add validation to `VideoCodecSchema`
3. Update `renderMedia()` call in `packages/renderer/src/render.ts`
4. Add UI selector in `apps/studio/src/components/ExportPanel.tsx`

### Additional MCP Tools

1. Add handler logic in `apps/mcp-server/src/handlers.ts` or a runtime-backed wrapper in `apps/mcp-server/src/create-server.ts`
2. Register the tool in `apps/mcp-server/src/create-server.ts`
3. Add Zod schema for inputs
4. Export with `server.tool()` call
5. Write tests in `src/__tests__/tools.test.ts` and `transport.test.ts` if transport behavior changes

## Dependencies Between Packages

```
┌─ shared-types (no deps)
│
├─ remotion-compositions (→ shared-types)
│
├─ template-registry (→ shared-types, remotion-compositions)
│
├─ renderer (→ shared-types)
│
└─ mcp-server (→ shared-types, template-registry, renderer)

studio (→ shared-types, template-registry, renderer, remotion-compositions)
```

No circular dependencies. Rebuild order:
1. shared-types
2. remotion-compositions, template-registry, renderer (parallel)
3. template-registry (depends on remotion-compositions)
4. mcp-server, studio (parallel, depend on all above)
