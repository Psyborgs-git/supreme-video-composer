# MEDIA STUDIO — MASTER SOFTWARE PLAN
## Architecture · Features · Tests · Validations · Evals · Fixes

> **How to use this document**
> Feed this entire file to your LLM as the system prompt (or first user message).
> The LLM will read the codebase, cross-reference it against every spec defined here,
> identify every gap and defect, then fix them one by one — validating each fix before
> moving to the next. Nothing is assumed to work. Everything must be proven.

---

## MISSION STATEMENT

You are a senior full-stack engineer, QA lead, and DevOps engineer simultaneously.
Your job is to take an existing codebase for a local Media Studio application built on
Remotion and bring it to 100% spec compliance.

You will:
1. Read all architectural documentation in `docs/` thoroughly before touching any code
2. Read the entire codebase and map what exists against what is specified here
3. Run the application and validate every feature with Playwright MCP in a real browser
4. Validate the MCP server and every one of its tools programmatically
5. Fix every defect, gap, or regression you find — never suppress, never skip
6. Dockerize the complete application for zero-config startup
7. Produce a final evidence-backed validation report

**Rules that cannot be broken:**
- Never mark a test PASS without actually running it
- Never use `@ts-ignore`, `eslint-disable`, or swallowed `catch` blocks as fixes
- Never proceed past a known failure — fix it, re-test, then continue
- Every fix must have a root-cause explanation and a commit message
- All architectural changes must align with `docs/` — deviations must be documented

---

## PART 1 — ORIENTATION

### 1.1 Read All Documentation First

Before reading the codebase or running anything, read every file in `docs/`.
Extract and write a structured summary covering:

- System architecture and how all packages/services interconnect
- Template system design: how inputProps, Zod schemas, and React compositions relate
- Render pipeline: job creation, queue, progress reporting, output
- MCP server: all registered tools, expected inputs, expected outputs, transport type
- Asset management: storage layout, registry format, how assets are served during preview vs render
- Project persistence: file format, storage location, versioning strategy
- All environment variables required at startup
- Any documented constraints or known limitations

Do not proceed until this documentation summary is written in full.

### 1.2 Read the Codebase

Traverse the full directory tree. For every package and app, read:

- Root `package.json` and all workspace `package.json` files — scripts, deps, versions
- All TypeScript interfaces and Zod schemas
- All MCP tool definitions
- All Remotion compositions and the `Root.tsx` registration
- All UI routes and page components
- The renderer package's programmatic API surface
- Any `.env.example` or config files

Produce a **Codebase State Report** covering:
- Implemented vs stubbed/incomplete features (be explicit — "X exists but Y is hardcoded")
- Dependency version conflicts or mismatches with documented requirements
- Missing env vars or directories that will block startup
- TypeScript errors visible without running compilation
- Obvious dead code, unused exports, or broken imports

Do not proceed until this report is written.

### 1.3 Run Build & Typecheck

```bash
# Use whichever package manager the project uses (npm/pnpm/yarn)
install all dependencies
npm run build        # must exit 0
npm run typecheck    # zero errors — fix all before proceeding
npm run lint         # zero errors — fix root cause, never suppress
```

For every error: diagnose → fix → re-run → log what was broken and what changed.
Proceed to Phase 2 only when all three commands exit clean.

---

## PART 2 — SYSTEM ARCHITECTURE SPECIFICATION

> This section defines what the system MUST be. Use it to evaluate the codebase.
> Any deviation is a defect unless `docs/` explicitly documents the change with rationale.

### 2.1 Monorepo Layout

```
/
├── apps/
│   ├── studio/                  # UI — Next.js App Router OR Vite+React (match docs/)
│   └── mcp-server/              # MCP server — stdio or HTTP+SSE (match docs/)
├── packages/
│   ├── remotion-compositions/   # All Remotion templates & Root.tsx
│   ├── template-registry/       # Template manifest + Zod schemas
│   ├── renderer/                # Programmatic render pipeline wrapper
│   └── shared-types/            # All shared TypeScript interfaces
├── data/
│   ├── assets/                  # images/, audio/, video/, fonts/
│   ├── projects/                # .json project files
│   └── exports/                 # rendered output files
├── docs/                        # Architectural documentation (source of truth)
├── Dockerfile
├── docker-compose.yml
├── .dockerignore
└── scripts/
    └── docker-build.sh
```

Validate that the actual directory structure matches. Document every deviation.

### 2.2 Core Data Contracts

These TypeScript interfaces define the system's data layer.
Validate that the codebase implements each of these exactly.
If missing or diverged, implement the canonical version.

```typescript
// packages/shared-types/src/index.ts

// ── Assets ──────────────────────────────────────────────────────────────────

type AssetType = 'image' | 'audio' | 'video' | 'font';

interface Asset {
  id: string;                  // uuid
  name: string;                // original filename without extension
  type: AssetType;
  extension: string;           // e.g. 'png', 'mp3', 'mp4'
  path: string;                // absolute path on disk
  url: string;                 // localhost URL for Player preview
  sizeBytes: number;
  metadata: ImageMeta | AudioMeta | VideoMeta | FontMeta;
  createdAt: string;           // ISO 8601
}

interface ImageMeta  { width: number; height: number; }
interface AudioMeta  { durationSeconds: number; sampleRate: number; channels: number; }
interface VideoMeta  { durationSeconds: number; width: number; height: number; fps: number; }
interface FontMeta   { family: string; }

// ── Templates ────────────────────────────────────────────────────────────────

interface FieldSchema {
  key: string;
  type: 'string' | 'number' | 'boolean' | 'color' | 'asset-image' |
        'asset-audio' | 'asset-video' | 'string-array' | 'asset-image-array';
  label: string;
  description?: string;
  required: boolean;
  default?: unknown;
  validation?: {
    min?: number;       // for number
    max?: number;       // for number
    minLength?: number; // for string
    maxLength?: number; // for string
    pattern?: string;   // regex for string
  };
}

interface TemplateManifest {
  id: string;                        // kebab-case slug, stable across versions
  name: string;
  description: string;
  version: string;                   // semver
  category: TemplateCategory;
  supportedAspectRatios: AspectRatioId[];
  defaultAspectRatio: AspectRatioId;
  defaultDurationFrames: number;
  defaultFps: 24 | 25 | 30 | 60;
  fields: FieldSchema[];             // drives UI form AND MCP input validation
  thumbnailFrame: number;            // which frame to render for preview thumbnail
  createdAt: string;
  updatedAt: string;
  isBuiltIn: boolean;                // false for user-created templates
}

type TemplateCategory =
  | 'storytelling'
  | 'music-reactive'
  | 'social'
  | 'product'
  | 'typography'
  | 'custom';

// ── Aspect Ratios ────────────────────────────────────────────────────────────

type AspectRatioId =
  | 'instagram-post'      // 1:1    1080×1080
  | 'instagram-reel'      // 9:16   1080×1920
  | 'youtube'             // 16:9   1920×1080
  | 'youtube-shorts'      // 9:16   1080×1920
  | 'twitter-post'        // 16:9   1280×720
  | 'tiktok'              // 9:16   1080×1920
  | 'linkedin-post'       // 1:1    1080×1080
  | 'linkedin-landscape'  // 16:9   1200×627  (rounded to 1200×628 for even dims)
  | 'facebook-post'       // 16:9   1200×630
  | 'pinterest'           // 2:3    1000×1500
  | 'square-hd'           // 1:1    2160×2160
  | 'landscape-hd'        // 16:9   2560×1440
  | 'custom';             // user-defined width×height

interface AspectRatioPreset {
  id: AspectRatioId;
  label: string;
  width: number;
  height: number;
  platform: string;
  description: string;
}

// ── Projects ─────────────────────────────────────────────────────────────────

interface Project {
  id: string;                       // uuid
  name: string;
  templateId: string;
  templateVersion: string;          // snapshot of template version at creation
  inputProps: Record<string, unknown>; // validated against template schema
  aspectRatioId: AspectRatioId;
  fps: 24 | 25 | 30 | 60;
  durationFrames: number;
  outputDir?: string;               // override default export directory
  createdAt: string;
  updatedAt: string;
  version: number;                  // project file format version (for migration)
}

// ── Render Jobs ───────────────────────────────────────────────────────────────

type RenderStatus = 'queued' | 'rendering' | 'complete' | 'failed' | 'cancelled';

type OutputFormat =
  | 'mp4-h264'
  | 'mp4-h265'
  | 'webm-vp9'
  | 'gif'
  | 'prores'
  | 'png-sequence'
  | 'jpeg-sequence';

type QualityPreset = 'draft' | 'standard' | 'high' | 'lossless';

type ResolutionScale = 0.5 | 1 | 2;

interface RenderJob {
  jobId: string;                    // uuid
  projectId: string;
  format: OutputFormat;
  quality: QualityPreset;
  resolutionScale: ResolutionScale;
  fps: 24 | 25 | 30 | 60;
  frameRange?: [number, number];    // null = full video
  outputPath: string;               // absolute path when complete
  status: RenderStatus;
  progress: number;                 // 0–100
  startedAt?: string;
  completedAt?: string;
  error?: string;
  fileSizeBytes?: number;
  createdAt: string;
}

// ── Content Bundle (the unit that flows: UI → renderer, MCP → renderer) ──────

interface ContentBundle {
  templateId: string;
  inputProps: Record<string, unknown>;
  aspectRatioId: AspectRatioId;
  fps: 24 | 25 | 30 | 60;
  durationFrames: number;
  format: OutputFormat;
  quality: QualityPreset;
  resolutionScale: ResolutionScale;
}
```

### 2.3 Aspect Ratio Preset Registry

Validate this exact registry exists and all values are correct:

| ID | Width | Height | Ratio | Platform |
|---|---|---|---|---|
| `instagram-post` | 1080 | 1080 | 1:1 | Instagram |
| `instagram-reel` | 1080 | 1920 | 9:16 | Instagram |
| `youtube` | 1920 | 1080 | 16:9 | YouTube |
| `youtube-shorts` | 1080 | 1920 | 9:16 | YouTube |
| `twitter-post` | 1280 | 720 | 16:9 | X / Twitter |
| `tiktok` | 1080 | 1920 | 9:16 | TikTok |
| `linkedin-post` | 1080 | 1080 | 1:1 | LinkedIn |
| `linkedin-landscape` | 1200 | 628 | ~16:9 | LinkedIn |
| `facebook-post` | 1200 | 630 | ~16:9 | Facebook |
| `pinterest` | 1000 | 1500 | 2:3 | Pinterest |
| `square-hd` | 2160 | 2160 | 1:1 | Generic |
| `landscape-hd` | 2560 | 1440 | 16:9 | Generic |

### 2.4 Template Composition Contract

Every Remotion template must follow this pattern exactly.
Validate all existing templates conform. Fix any that do not.

```typescript
// packages/remotion-compositions/src/templates/{template-id}/index.tsx

import { z } from 'zod';
import { TemplateManifest } from '@media-studio/shared-types';

// 1. Zod schema — single source of truth for inputProps shape & validation
export const schema = z.object({
  // template-specific fields
});

export type Props = z.infer<typeof schema>;

// 2. Manifest — consumed by template registry and MCP tool list_templates
export const manifest: TemplateManifest = {
  id: 'template-id',
  // ... all required fields
};

// 3. React component — must use useCurrentFrame, useVideoConfig
//    Must be resolution-agnostic (derive all sizing from useVideoConfig())
export const TemplateComponent: React.FC<Props> = (props) => {
  const frame = useCurrentFrame();
  const { width, height, fps, durationInFrames } = useVideoConfig();
  // all positioning uses width/height fractions — never hardcoded pixels
  return (/* ... */);
};

// 4. Default export consumed by Root.tsx
export default TemplateComponent;
```

**Resolution-agnostic rule:** Every positional value, font size, and dimension in a
template must be derived from `useVideoConfig().width` and `useVideoConfig().height`,
never from hardcoded pixel values. This is what makes aspect ratio switching work.
Any template that hardcodes pixel values is a defect — fix it.

### 2.5 Renderer Package API

```typescript
// packages/renderer/src/index.ts

interface RendererService {
  // Queue a render job
  enqueue(bundle: ContentBundle, projectId: string): Promise<RenderJob>;

  // Get current job state
  getJob(jobId: string): Promise<RenderJob | null>;

  // Get all jobs
  listJobs(filter?: { status?: RenderStatus }): Promise<RenderJob[]>;

  // Cancel a queued or in-progress job
  cancelJob(jobId: string): Promise<void>;

  // Render a single frame — used for thumbnails
  renderFrame(
    templateId: string,
    inputProps: Record<string, unknown>,
    frame: number,
    outputPath: string,
    aspectRatioId: AspectRatioId
  ): Promise<string>; // returns output path

  // SSE or WebSocket event stream for progress updates
  // UI subscribes to this for real-time progress bars
  subscribeToJob(jobId: string, callback: (job: RenderJob) => void): () => void;
}
```

### 2.6 MCP Server Tool Contracts

Every tool must conform to this specification exactly.
Validate each tool exists, handles all cases, and returns the documented shape.

```typescript
// Tool: list_templates
// Input:  {} (no params) | { category?: TemplateCategory }
// Output: { templates: TemplateManifest[] }

// Tool: get_template
// Input:  { templateId: string }
// Output: { template: TemplateManifest }
// Errors: TEMPLATE_NOT_FOUND

// Tool: create_template
// Input:  { name, description, category, fields: FieldSchema[],
//           supportedAspectRatios, defaultAspectRatio,
//           defaultDurationFrames, defaultFps }
// Output: { template: TemplateManifest }
// Errors: DUPLICATE_TEMPLATE_ID, INVALID_SCHEMA

// Tool: update_template
// Input:  { templateId, updates: Partial<TemplateManifest> }
// Output: { template: TemplateManifest }
// Errors: TEMPLATE_NOT_FOUND, INVALID_SCHEMA

// Tool: delete_template
// Input:  { templateId }
// Output: { deleted: true }
// Errors: TEMPLATE_NOT_FOUND, TEMPLATE_HAS_PROJECTS (lists affected projectIds)

// Tool: list_projects
// Input:  {} | { templateId?: string }
// Output: { projects: Project[] }

// Tool: get_project
// Input:  { projectId: string }
// Output: { project: Project }
// Errors: PROJECT_NOT_FOUND

// Tool: create_project
// Input:  { name, templateId, inputProps, aspectRatioId, fps?, durationFrames? }
// Output: { project: Project }
// Errors: TEMPLATE_NOT_FOUND, VALIDATION_ERROR (with per-field errors)

// Tool: update_project
// Input:  { projectId, updates: Partial<Pick<Project,
//           'name'|'inputProps'|'aspectRatioId'|'fps'|'durationFrames'>> }
// Output: { project: Project }
// Errors: PROJECT_NOT_FOUND, VALIDATION_ERROR

// Tool: delete_project
// Input:  { projectId }
// Output: { deleted: true }
// Errors: PROJECT_NOT_FOUND, PROJECT_HAS_ACTIVE_RENDER

// Tool: duplicate_project
// Input:  { projectId, newName?: string }
// Output: { project: Project }
// Errors: PROJECT_NOT_FOUND

// Tool: list_assets
// Input:  {} | { type?: AssetType }
// Output: { assets: Asset[] }

// Tool: upload_asset
// Input:  { filePath: string } | { base64: string, filename: string }
// Output: { asset: Asset }
// Errors: FILE_NOT_FOUND, UNSUPPORTED_TYPE, DUPLICATE_ASSET

// Tool: delete_asset
// Input:  { assetId: string }
// Output: { deleted: true }
// Errors: ASSET_NOT_FOUND, ASSET_IN_USE (lists affected projectIds)

// Tool: render_project
// Input:  { projectId, format: OutputFormat, quality?: QualityPreset,
//           resolutionScale?: ResolutionScale, fps?: number,
//           frameRange?: [number, number] }
// Output: { job: RenderJob }
// Errors: PROJECT_NOT_FOUND, INVALID_FORMAT

// Tool: get_render_status
// Input:  { jobId: string }
// Output: { job: RenderJob }
// Errors: JOB_NOT_FOUND

// Tool: cancel_render
// Input:  { jobId: string }
// Output: { cancelled: true }
// Errors: JOB_NOT_FOUND, JOB_NOT_CANCELLABLE

// Tool: list_renders
// Input:  {} | { projectId?: string, status?: RenderStatus }
// Output: { jobs: RenderJob[] }

// Tool: list_aspect_ratios
// Input:  {}
// Output: { presets: AspectRatioPreset[] }

// Tool: export_formats
// Input:  {}
// Output: { formats: Array<{ id: OutputFormat, label, codec, container, qualityOptions }> }

// Tool: preview_url
// Input:  { projectId: string }
// Output: { url: string }   // localhost URL that opens the Player
// Errors: PROJECT_NOT_FOUND

// Error shape for ALL tools:
// { error: { code: string, message: string, details?: Record<string, unknown> } }
```

---

## PART 3 — TEMPLATE SPECIFICATIONS

Validate each template against its full specification.
A template is only complete when all 6 dimensions are met.

### Template 1 — History Storyline (`history-storyline`)

**Purpose:** Narrate a sequence of historical events with images, dates, and text,
animated in the style of a documentary.

**inputProps schema:**
```typescript
z.object({
  title: z.string().min(1).max(80),
  subtitle: z.string().max(120).optional(),
  events: z.array(z.object({
    date: z.string(),           // displayed as-is, e.g. "March 4, 1776"
    headline: z.string().max(80),
    body: z.string().max(300).optional(),
    imageAssetId: z.string(),   // required — assetId of an image
    imageFit: z.enum(['cover', 'contain']).default('cover'),
  })).min(1).max(20),
  audioAssetId: z.string().optional(),  // background music/narration
  audioVolume: z.number().min(0).max(1).default(0.4),
  colorAccent: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  fontStyle: z.enum(['serif', 'sans', 'mono']).default('serif'),
  transitionStyle: z.enum(['crossfade', 'wipe', 'zoom']).default('crossfade'),
  eventDurationSeconds: z.number().min(2).max(15).default(5),
})
```

**Animation logic:**
- Each event occupies `eventDurationSeconds * fps` frames
- Frames 0–15: image fades in + Ken Burns starts (slow pan/zoom outward, 110%→100% scale)
- Frames 0–20: date text slides up from `translateY(30px)` → 0, opacity 0→1
- Frames 5–25: headline fades in word by word (split by space, staggered 3 frames apart)
- Frames 10–30: body text fades in as a block
- Last 15 frames of each event: crossfade/wipe/zoom transition to next event begins
- Audio starts at frame 0, fades in over 30 frames, fades out over last 30 frames
- Ken Burns: each image gets a unique pan direction (alternating: top-left→center, center→bottom-right, etc.)

**Remotion APIs required:**
`useCurrentFrame`, `useVideoConfig`, `interpolate`, `spring`, `Sequence`, `Series`,
`Audio`, `Img`, `staticFile`, `useAudioData` (for waveform display if desired)

**Aspect ratio handling:**
- Text zones use percentage-based positioning (bottom 30% of frame for overlay)
- Ken Burns scale and pan are relative to `width` and `height`
- No hardcoded pixel values anywhere

**Performance:** Ken Burns on many high-res images can be slow in preview.
Implement: cap preview resolution to 720p in Player, full resolution only during render.

---

### Template 2 — Beat-Synced Visualizer (`beat-sync-visualizer`)

**Purpose:** Audio-reactive psychedelic visuals that pulse, morph, and flash in sync
with music beats. Core creative template for music content.

**inputProps schema:**
```typescript
z.object({
  audioAssetId: z.string(),         // required
  title: z.string().max(80).optional(),
  artist: z.string().max(80).optional(),
  visualStyle: z.enum([
    'noise-field',       // Perlin noise color field shifting with bass
    'waveform-bars',     // classic EQ bar visualizer
    'particle-burst',    // radial particles on beat
    'color-pulse',       // full-screen color pulses on kick
    'geometric',         // rotating geometric shapes scaling to amplitude
  ]),
  colorPalette: z.array(
    z.string().regex(/^#[0-9a-fA-F]{6}$/)
  ).min(2).max(8),
  backgroundStyle: z.enum(['dark', 'light', 'gradient', 'black']).default('black'),
  sensitivity: z.number().min(0.1).max(3.0).default(1.0), // amplitude multiplier
  showTitle: z.boolean().default(true),
  showWaveformBar: z.boolean().default(false), // persistent bottom waveform
})
```

**Animation logic:**
- `useAudioData(audioSrc)` loads audio waveform data
- `visualizeAudio({ fps, frame, audioData, numberOfSamples: 256 })` per frame
- Bass band: samples 0–20, mapped to scale/brightness pulses
- Mid band: samples 20–80, mapped to color hue rotation
- High band: samples 80–256, mapped to particle count or noise frequency
- `noise-field`: uses `@remotion/noise` `noise3D(x, y, frame/50)` per pixel via canvas
- Beat detection: track peaks in bass band > threshold; trigger `spring()` burst on beat
- All visual parameters are interpolated from audio data, never random (deterministic rendering)
- Title/artist text: persistent overlay, subtle breathing scale animation

**Critical constraint:** All randomness must use `random(seed)` from Remotion — never
`Math.random()`. Rendering must be deterministic: same frame = same output always.

**Remotion APIs:** `useAudioData`, `visualizeAudio`, `useCurrentFrame`,
`interpolate`, `spring`, `noise3D`, `random`, `Audio`, `staticFile`

---

### Template 3 — Quote Card Sequence (`quote-cards`)

**Purpose:** Animate a sequence of quotes with attribution, designed for Twitter/LinkedIn
thought leadership content or Instagram carousel-style video.

**inputProps schema:**
```typescript
z.object({
  quotes: z.array(z.object({
    text: z.string().min(1).max(400),
    attribution: z.string().max(100).optional(),
    backgroundImageAssetId: z.string().optional(),
  })).min(1).max(10),
  brandName: z.string().max(60).optional(),
  brandLogoAssetId: z.string().optional(),
  primaryColor: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  secondaryColor: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  fontStyle: z.enum(['serif', 'sans', 'display']).default('serif'),
  animationStyle: z.enum(['typewriter', 'fade-word', 'slide-up', 'scale-in']).default('fade-word'),
  quoteDurationSeconds: z.number().min(3).max(20).default(6),
  audioAssetId: z.string().optional(),
  audioVolume: z.number().min(0).max(1).default(0.3),
  showQuoteMarks: z.boolean().default(true),
})
```

**Animation logic:**
- Each quote: `quoteDurationSeconds * fps` frames, composed with `<Series>`
- `typewriter`: characters appear one by one, 2 frames per character
- `fade-word`: words fade in with staggered `spring()`, 4 frames between words
- `slide-up`: text block slides from `translateY(40)` → 0 as a unit
- `scale-in`: text scales from 0.8 → 1.0 with opacity 0 → 1 over 20 frames
- Attribution: smaller text, fades in after main quote text completes + 10 frames
- Background image: Ken Burns if provided, else gradient from primary/secondary colors
- Brand logo: corner placement, persistent, subtle pulse on transitions

---

### Template 4 — Social Media Reel (`social-reel`)

**Purpose:** Fast-cut vertical video reel (9:16 native) for Reels, TikTok, Shorts.
Images or video clips with text overlays, transitions, and a music track.

**inputProps schema:**
```typescript
z.object({
  clips: z.array(z.object({
    assetId: z.string(),             // image or video asset
    durationSeconds: z.number().min(0.5).max(10).default(2),
    textOverlay: z.string().max(80).optional(),
    textPosition: z.enum(['top', 'center', 'bottom']).default('bottom'),
    transition: z.enum(['cut', 'fade', 'slide-left', 'slide-up', 'zoom-out']).default('cut'),
  })).min(1).max(30),
  audioAssetId: z.string().optional(),
  audioVolume: z.number().min(0).max(1).default(0.8),
  globalTextStyle: z.object({
    fontStyle: z.enum(['sans', 'bold-sans', 'serif', 'mono']),
    color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
    shadowColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).default('#000000'),
    size: z.enum(['small', 'medium', 'large']).default('medium'),
  }),
  openingCard: z.object({
    title: z.string().max(60).optional(),
    subtitle: z.string().max(100).optional(),
    durationSeconds: z.number().default(1.5),
  }).optional(),
  closingCard: z.object({
    cta: z.string().max(80).optional(),
    handle: z.string().max(60).optional(),
    durationSeconds: z.number().default(2),
  }).optional(),
})
```

**Default aspect ratio:** `instagram-reel` (9:16). Must support all other presets
with adaptive layout (text zones remain proportional).

---

### Template 5 — Product Showcase (`product-showcase`)

**Purpose:** E-commerce/marketing video showing products with animated entry,
pricing, and a call to action. Reusable across product lines.

**inputProps schema:**
```typescript
z.object({
  products: z.array(z.object({
    name: z.string().max(80),
    tagline: z.string().max(120).optional(),
    price: z.string().max(30).optional(),         // formatted string: "₹2,499"
    imageAssetIds: z.array(z.string()).min(1).max(5), // multiple product images
    accentColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  })).min(1).max(8),
  brandName: z.string().max(60).optional(),
  brandLogoAssetId: z.string().optional(),
  globalAccentColor: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  backgroundStyle: z.enum(['white', 'dark', 'gradient', 'image']).default('white'),
  backgroundImageAssetId: z.string().optional(),
  ctaText: z.string().max(60).optional(),
  ctaUrl: z.string().url().optional(),
  audioAssetId: z.string().optional(),
  audioVolume: z.number().min(0).max(1).default(0.3),
  animationStyle: z.enum(['slide-in', 'pop', 'reveal', 'float']).default('slide-in'),
  productDurationSeconds: z.number().min(3).max(15).default(5),
})
```

---

### Template 6 — Custom Template (User-Created)

This is not a fixed template — it is the **template creation system** itself.
Validate that users can create new templates through the UI and MCP with:

- A user-defined name, description, and category
- A user-defined set of `FieldSchema` entries (the typed placeholders)
- A generated Remotion composition scaffold with the correct TypeScript type
- The generated composition must be immediately usable in the Player
- The template must be re-composable: fill in different content → different output

**What "typed configuration placeholders" means:**
When a user creates a template and defines fields (e.g., `images: asset-image-array`,
`headline: string`, `accentColor: color`), the system must:

1. Generate a Zod schema from those field definitions
2. Generate a TypeScript type (`Props`) from that schema
3. Scaffold a minimal but working Remotion composition that uses those props
4. Register the template in the registry so it appears in the browser and MCP tools
5. Allow the user to open the generated composition file and customize the animation logic
6. After customization, the template continues to use the same schema — only the visual
   logic changes, not the data contract

---

## PART 4 — UI FEATURE SPECIFICATIONS

### 4.1 Application Shell

| Requirement | Validation method |
|---|---|
| Loads at root URL with zero console errors | Playwright: check `page.on('console')` for errors |
| All navigation routes render without 404 or React error | Playwright: visit every route |
| No hydration errors | Playwright: check console for hydration warnings |
| Responsive at 1440×900 and 1280×800 | Playwright: `page.setViewportSize` both sizes |
| Dark/light theme (if documented) | Toggle and verify |

### 4.2 Asset Manager

**Create:**
- Upload PNG/JPG/WebP image → appears with thumbnail, dimensions in metadata
- Upload MP3/WAV/M4A → appears with duration, waveform thumbnail (if implemented)
- Upload MP4/WebM video → appears with duration and first-frame thumbnail
- Upload TTF/OTF font → registered with font family name
- Upload duplicate filename → auto-renamed (`name-1.png`) or rejected with clear error
- Upload unsupported type → error toast, no crash, no partial state

**Read:**
- All assets listed with name, type icon, size, metadata
- Filter by type (image / audio / video / font) using tabs or dropdown
- Search by name (substring match)
- Click asset → detail panel: full metadata, preview (image rendered, audio playable, video playable)
- Pagination or virtual scroll if >50 assets

**Update:**
- Rename asset → updates name in registry, existing project references still resolve
- Replace asset (re-upload same ID) → metadata updated, references intact

**Delete:**
- Single delete → confirmation dialog → file removed from disk and registry
- Bulk delete (select multiple) → confirmation → all removed
- Delete asset referenced by projects → warning lists affected projects, requires confirm

### 4.3 Template Browser

**Read:**
- Grid/list of all templates showing: name, category badge, supported aspect ratio icons, thumbnail image
- Filter by category
- Search by name
- Click → detail view: description, full schema field list, sample preview

**Create (New Template UI):**
- Accessible via "New Template" button
- Form: name, description, category selector
- Field builder: add/remove/reorder fields; for each field set key, type, label, description, required, default, validation
- Aspect ratio multi-select: which presets this template supports
- Default aspect ratio, default duration, default FPS
- Submit → template appears in browser, composition scaffold generated
- Validation: duplicate ID → error; missing required meta → error

**Update:**
- Edit name, description, category → persists
- Add optional field → backward compatible with existing projects
- Remove field → warning if in use, confirm required

**Delete:**
- No projects → clean delete
- Has projects → lists them, requires explicit confirm, optionally cascade-delete projects

### 4.4 Project Manager

**Create:**
- "New Project" → select template from dropdown/search
- Form auto-generated from template's `FieldSchema[]`
- Image fields: open asset picker modal filtered to images
- Audio fields: open asset picker filtered to audio
- Color fields: color picker (hex input + visual picker)
- Number fields: slider with min/max from schema + numeric input
- String fields: single-line or textarea based on `maxLength`
- Array fields: add/remove items, drag to reorder
- Real-time field-level validation with error messages per field
- Save → project created, navigated to editor

**Read:**
- List: name, template used, aspect ratio badge, last modified, thumbnail
- Sort by: last modified, created, name
- Filter by template
- Search by name
- "Recent" section (last 5 opened)

**Update:**
- Editor: all fields editable, changes reflect in Player in ≤1s
- Change aspect ratio → Player resizes, composition adapts
- Change duration → timeline updates
- Duplicate project: creates independent copy, both persist independently

**Delete:**
- Single: confirmation → JSON deleted
- Bulk: confirmation → all deleted
- Active render: blocked with explanation

### 4.5 Composition Editor & Live Preview

| Requirement | Validation |
|---|---|
| `@remotion/player` renders in editor without error | Playwright: no console errors, player visible |
| Play/pause works | Click play → `currentTime` increments |
| Scrub timeline | Drag scrubber → frame updates |
| Loop toggle | Enable loop → video restarts automatically |
| inputProps changes → Player updates ≤1s | Change a text field → visual updates |
| Aspect ratio change → Player resizes | Switch preset → Player dimensions change |
| Audio plays during preview | Audio element has `src` and plays |
| Loading state shown before composition ready | Spinner visible before first frame |
| No crash on scrub to any frame | Scrub to frame 0, last frame, random frames |

### 4.6 Export / Download Panel

| Requirement | Validation |
|---|---|
| Format selector: all 7 formats present | Playwright: check all `<option>` values |
| Quality presets: Draft / Standard / High / Lossless | All 4 present |
| Resolution scale: 0.5× / 1× / 2× | All 3 present |
| FPS: 24 / 25 / 30 / 60 | All 4 present |
| Frame range: full / custom | Both modes work |
| Export triggers render job | Network request to render endpoint |
| Progress bar appears and increments | Not stuck at 0% |
| Completion: success state + download button | File downloads on click |
| File is valid: correct duration, dims, format | ffprobe verification |
| Each of 5 templates exports successfully | One render each, ffprobe each |

### 4.7 Render Queue

| Requirement | Validation |
|---|---|
| Queue lists queued / in-progress / complete / failed jobs | All 4 states visible |
| In-progress shows live progress % | Playwright: value increments |
| Complete shows output file info + download link | Link works |
| Failed shows error message | Inject an error, verify display |
| Cancel in-progress → removed from queue | Cancel button works |
| Queue persists across page refresh | Reload → jobs still there |
| Multiple simultaneous jobs | Queue 3 jobs → all process |

---

## PART 5 — MCP SERVER SPECIFICATION & VALIDATION

### 5.1 Transport & Startup

As documented in `docs/`:
- Transport: stdio (for Claude Desktop integration) OR HTTP+SSE (for HTTP clients) — match docs exactly
- Startup: `node apps/mcp-server/dist/index.js` (or as documented)
- Must log ready state on stderr (not stdout — stdout is the MCP wire protocol for stdio transport)
- All tools must register without error on startup
- Tool manifest queryable immediately after start

### 5.2 Error Contract

Every tool error must return exactly:
```json
{
  "error": {
    "code": "SNAKE_CASE_ERROR_CODE",
    "message": "Human-readable description",
    "details": {}
  }
}
```
Never return: unstructured strings, stack traces, undefined, or crashes.
Test every error case. Fix any tool that returns a non-conforming error.

### 5.3 MCP Tool-by-Tool Test Matrix

For every tool listed in Part 2.6:

| Test case | Input | Expected output | Pass/Fail |
|---|---|---|---|
| Valid input | Correct params | Documented success shape | |
| Missing required field | Omit required param | VALIDATION_ERROR with field name | |
| Wrong type | String where number expected | VALIDATION_ERROR | |
| Non-existent ID | Random UUID | ENTITY_NOT_FOUND error | |
| Edge case (empty array, max length, etc.) | Boundary values | Handled gracefully | |

Run all tests. Fix all failures. Re-test.

### 5.4 MCP End-to-End Workflow

Run this full 12-step chain through MCP tools only. All steps must pass.

```
Step  1: list_aspect_ratios         → pick 'instagram-reel' (9:16)
Step  2: list_templates             → pick 'history-storyline', note its fields
Step  3: list_assets                → verify 3+ images and 1 audio asset exist
          (if not, upload them via upload_asset first — count those as steps)
Step  4: create_project             → name: "MCP Test Project",
                                      templateId: 'history-storyline',
                                      aspectRatioId: 'instagram-reel',
                                      inputProps: { events: [...3 events with imageAssetIds...],
                                                    audioAssetId: ..., colorAccent: '#FF5733' }
Step  5: get_project(projectId)     → verify all inputProps persisted exactly
Step  6: update_project             → change colorAccent to '#3498DB'
Step  7: get_project(projectId)     → verify colorAccent updated, other fields unchanged
Step  8: preview_url(projectId)     → HTTP GET the returned URL → 200 OK
Step  9: render_project             → format: 'mp4-h264', quality: 'standard', resolutionScale: 1
Step 10: get_render_status (poll)   → poll every 3s until status = 'complete' or 'failed'
          - If 'failed': log error, diagnose, fix, restart from Step 9
          - If 'complete': proceed
Step 11: verify output              → ffprobe outputPath:
          - Container: mp4
          - Video codec: h264
          - Duration: within ±0.5s of expected (events × eventDurationSeconds)
          - Dimensions: 1080×1920 (9:16)
          - Has audio stream: yes (audioAssetId was provided)
Step 12: delete_project(projectId)  → verify deleted, get_project returns PROJECT_NOT_FOUND
```

Document every response at each step. Any step failure = stop, fix, restart the chain.

---

## PART 6 — FEATURE COMPLETENESS MATRIX

Before starting Docker work, every row in this matrix must be GREEN (✅).
Any row that is not green must be fixed and re-tested.

| Feature | UI Exists | UI Tested | MCP Exists | MCP Tested | ✅/❌ |
|---|---|---|---|---|---|
| Asset Upload (image) | | | | | |
| Asset Upload (audio) | | | | | |
| Asset Upload (video) | | | | | |
| Asset Browse & Filter | | | | | |
| Asset Rename | | | | | |
| Asset Delete (single) | | | | | |
| Asset Delete (bulk) | | | | | |
| Asset Delete (in-use guard) | | | | | |
| Template Browse | | | | | |
| Template Create (typed fields) | | | | | |
| Template Edit | | | | | |
| Template Delete | | | | | |
| Project Create (from template) | | | | | |
| Project Edit / Re-compose | | | | | |
| Project Duplicate | | | | | |
| Project Delete | | | | | |
| Project List & Search | | | | | |
| Live Preview (Player) | | | | | |
| Aspect Ratio: all 12 presets | | | | | |
| Export: MP4 H.264 | | | | | |
| Export: MP4 H.265 | | | | | |
| Export: WebM VP9 | | | | | |
| Export: GIF | | | | | |
| Export: ProRes | | | | | |
| Export: PNG Sequence | | | | | |
| Export: JPEG Sequence | | | | | |
| Quality Presets (4 levels) | | | | | |
| Resolution Scale (0.5×/1×/2×) | | | | | |
| Frame Range Export | | | | | |
| Render Queue View | | | | | |
| Render Progress (real-time) | | | | | |
| Render Cancel | | | | | |
| Download Completed Export | | | | | |
| Template: History Storyline | | | | | |
| Template: Beat-Sync Visualizer | | | | | |
| Template: Quote Cards | | | | | |
| Template: Social Reel | | | | | |
| Template: Product Showcase | | | | | |
| Template: Custom (user-created) | | | | | |
| Re-use template w/ different data | | | | | |
| MCP end-to-end chain | N/A | N/A | | | |

---

## PART 7 — TEST & EVAL SPECIFICATIONS

### 7.1 Unit Tests

**Template Schema Validation**
For each of the 5 built-in templates:
```
valid_full_props    → z.parse() succeeds
missing_required    → z.parse() throws ZodError with correct field path
wrong_type          → z.parse() throws ZodError
out_of_range        → z.parse() throws ZodError (min/max violations)
empty_array         → z.parse() throws ZodError (min: 1)
max_array           → z.parse() succeeds at max, throws at max+1
```

**Aspect Ratio Registry**
```
all 12 preset IDs exist
width × height ratio matches stated ratio (within 0.01)
no duplicate IDs
all widths and heights are even numbers (required by video codecs)
```

**Render Job Queue**
```
enqueue() returns job with status='queued'
concurrent enqueue of 3 jobs → all queued, processed sequentially
job transitions: queued → rendering → complete
job transitions: queued → rendering → failed (on injected error)
cancelJob() on queued job → status='cancelled', not processed
cancelJob() on complete job → throws JOB_NOT_CANCELLABLE
getJob() with unknown ID → returns null
```

**Asset Registry**
```
register image → metadata contains {width, height}
register audio → metadata contains {durationSeconds}
register video → metadata contains {durationSeconds, width, height, fps}
register duplicate path → handled (no duplicate IDs in registry)
delete registered asset → removed from registry and disk
getAsset() with unknown ID → returns null
```

**MCP Tool Input Validation**
```
For each tool: valid input → handler called
For each tool: missing required param → VALIDATION_ERROR returned (not thrown)
For each tool: wrong type → VALIDATION_ERROR returned
```

### 7.2 Integration Tests

**Full Render Pipeline — per template:**
```
1. Create project with valid inputProps
2. Enqueue render: format=mp4-h264, quality=standard, scale=1
3. Poll until complete (timeout: 5min)
4. Assert: outputPath file exists
5. Assert (ffprobe): container=mp4, codec=h264, duration within ±0.5s of expected
6. Assert (ffprobe): width and height match aspectRatioPreset exactly
7. Assert (ffprobe): fps matches project fps setting
8. If template has audio: assert audio stream present
```

Run for all 5 templates × 3 aspect ratios (1:1, 9:16, 16:9) = 15 render integration tests.
All 15 must pass.

**Asset → Template → Render Flow:**
```
1. Upload image via API (POST /assets)
2. Upload audio via API
3. Create project using those assetIds
4. Render project
5. Assert rendered file exists and has audio
6. Delete project
7. Delete assets
8. Assert assets gone from registry and disk
```

**MCP Tool Chain:** (same as Part 5.4, but automated as a test)

### 7.3 Visual Regression Tests (Frame Evals)

For each template, render frame N (use `thumbnailFrame` from manifest) with fixed
inputProps (seeded, deterministic) and compare against a stored golden PNG.

```bash
# Generate golden frames (run once, commit to repo)
npm run test:golden

# Run regression (run on every change)
npm run test:visual
```

Comparison: pixel diff using `pixelmatch`. Threshold: <0.1% pixel difference.
If template animation logic changes intentionally → regenerate goldens explicitly.

**Beat-sync specific eval:**
- Load known audio file (include a test fixture: 60-second sine wave with known beat at frame 30, 60, 90)
- Render frame 30 (beat frame) and frame 15 (non-beat frame)
- Assert: visual response metric at frame 30 > visual response metric at frame 15
- Metric: average pixel brightness in a central region of the frame

### 7.4 Performance Evals

**Render time benchmarks** (run on CI / local machine, document baseline):
| Template | Duration | Format | Expected max render time |
|---|---|---|---|
| History Storyline | 30s | mp4-h264 | 4 min |
| Beat-Sync Visualizer | 60s | mp4-h264 | 8 min |
| Quote Cards | 30s | mp4-h264 | 3 min |
| Social Reel | 30s | mp4-h264 | 3 min |
| Product Showcase | 30s | mp4-h264 | 3 min |

If any template exceeds its benchmark by >50%, flag it and profile (likely a
non-memoized expensive calculation in the render loop — fix with `useMemo`).

**Preview frame rate:**
- Open each template in Player
- Play from frame 0 for 5 seconds
- Assert: Player maintains ≥24fps (measure via Remotion Player `onError` / frame events)
- If below threshold: diagnose (likely expensive per-frame computation) and optimize

**Memory:**
- Run render of Beat-Sync Visualizer (most memory-intensive: audio data + canvas)
- Monitor Node.js RSS during render
- Assert: peak RSS < 3GB
- Flag if approaching limit

### 7.5 MCP Server Evals

```
All tools registered at startup:             list tools → count matches expected
All tools return within 200ms (non-render):  measure response time for each
Invalid input returns structured error:       inject bad input for every tool
Concurrent requests don't corrupt state:     send 10 simultaneous list_projects calls
Render queue correctly serializes:           enqueue 5 renders → verify sequential processing
stdio transport: tool call / response cycle: verify framing is correct JSON-RPC
```

---

## PART 8 — DOCKERIZATION SPECIFICATION

### 8.1 Pre-flight Questions (Answer from codebase before writing Dockerfile)

- What Node.js version? (check `.nvmrc`, `engines` field in root `package.json`)
- Does Remotion need Chromium? (Yes — plan for it. Do NOT use Alpine Linux.)
- Does the app bundle its own FFmpeg or use system FFmpeg? (check `@remotion/renderer` docs)
- Which ports are used? (UI, asset server, MCP HTTP if applicable)
- Which directories must be writable at runtime? (`data/assets`, `data/projects`, `data/exports`)
- Are there native Node addons that need build tools? (check deps for `node-gyp`)
- Any macOS-specific code paths? (must be replaced with Linux equivalents or guarded)

### 8.2 Dockerfile (Multi-stage)

```dockerfile
# ── Stage 1: base ──────────────────────────────────────────────────────────────
FROM node:20-bookworm-slim AS base

# Install system dependencies required by Remotion + FFmpeg
RUN apt-get update && apt-get install -y --no-install-recommends \
    chromium \
    ffmpeg \
    fonts-liberation \
    fonts-noto-color-emoji \
    ca-certificates \
    libnss3 \
    libatk1.0-0 \
    libatk-bridge2.0-0 \
    libcups2 \
    libdrm2 \
    libxkbcommon0 \
    libxcomposite1 \
    libxdamage1 \
    libxfixes3 \
    libxrandr2 \
    libgbm1 \
    libasound2 \
    libpangocairo-1.0-0 \
    && rm -rf /var/lib/apt/lists/*

# Tell Remotion/Puppeteer to use system Chromium
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium
ENV REMOTION_CHROME_EXECUTABLE=/usr/bin/chromium

WORKDIR /app

# ── Stage 2: deps ──────────────────────────────────────────────────────────────
FROM base AS deps

# Copy only manifests first (layer cache for node_modules)
COPY package.json package-lock.json* pnpm-lock.yaml* ./
COPY apps/studio/package.json ./apps/studio/
COPY apps/mcp-server/package.json ./apps/mcp-server/
COPY packages/remotion-compositions/package.json ./packages/remotion-compositions/
COPY packages/template-registry/package.json ./packages/template-registry/
COPY packages/renderer/package.json ./packages/renderer/
COPY packages/shared-types/package.json ./packages/shared-types/

RUN npm ci --frozen-lockfile

# ── Stage 3: builder ───────────────────────────────────────────────────────────
FROM deps AS builder

COPY . .

# Build all packages in dependency order
RUN npm run build

# ── Stage 4: runner (final production image) ──────────────────────────────────
FROM base AS runner

# Create non-root user
RUN groupadd --gid 1001 studio && \
    useradd --uid 1001 --gid studio --shell /bin/bash --create-home studio

# Copy built artifacts
COPY --from=builder --chown=studio:studio /app/apps/studio/.next ./apps/studio/.next
COPY --from=builder --chown=studio:studio /app/apps/mcp-server/dist ./apps/mcp-server/dist
COPY --from=builder --chown=studio:studio /app/packages ./packages
COPY --from=builder --chown=studio:studio /app/node_modules ./node_modules
COPY --from=builder --chown=studio:studio /app/package.json ./

# Create persistent data directories
RUN mkdir -p /data/assets/images /data/assets/audio /data/assets/video /data/assets/fonts \
             /data/projects /data/exports /data/thumbnails && \
    chown -R studio:studio /data

# Copy startup script
COPY --chown=studio:studio scripts/docker-start.sh /docker-start.sh
RUN chmod +x /docker-start.sh

USER studio

EXPOSE 3000 3001 3002

ENTRYPOINT ["/docker-start.sh"]
```

### 8.3 docker-start.sh

```bash
#!/bin/bash
set -e

echo "Starting Media Studio..."

# Start asset file server
node apps/asset-server/dist/index.js &
ASSET_PID=$!

# Start MCP server (if HTTP mode)
node apps/mcp-server/dist/index.js &
MCP_PID=$!

# Start UI (Next.js production)
cd apps/studio && node server.js &
UI_PID=$!

echo "UI:           http://localhost:3000"
echo "Asset server: http://localhost:3001"
echo "MCP server:   http://localhost:3002"

# Wait for any process to exit — if one dies, restart or exit with error
wait -n
echo "A process exited unexpectedly. Shutting down."
kill $ASSET_PID $MCP_PID $UI_PID 2>/dev/null
exit 1
```

### 8.4 docker-compose.yml

```yaml
version: '3.9'

services:
  studio:
    build:
      context: .
      dockerfile: Dockerfile
      target: runner
    image: media-studio:latest
    container_name: media-studio
    ports:
      - "3000:3000"    # UI
      - "3001:3001"    # Asset file server
      - "3002:3002"    # MCP HTTP server (if applicable)
    volumes:
      - ./data/assets:/data/assets        # Persist uploaded assets
      - ./data/projects:/data/projects    # Persist projects
      - ./data/exports:/data/exports      # Persist rendered exports
    environment:
      NODE_ENV: production
      ASSET_DIR: /data/assets
      PROJECTS_DIR: /data/projects
      EXPORTS_DIR: /data/exports
      THUMBNAILS_DIR: /data/thumbnails
      ASSET_SERVER_URL: http://localhost:3001
      STUDIO_URL: http://localhost:3000
      # Add any additional env vars from .env.example
    shm_size: '2gb'           # Chromium rendering requires large /dev/shm
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3000/api/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 30s
```

### 8.5 .dockerignore

```
node_modules
**/node_modules
.next
**/dist
**/.turbo
data/
.env
.env.local
.env.*
!.env.example
*.log
.git
.gitignore
__tests__
**/*.test.ts
**/*.spec.ts
coverage/
.nyc_output/
README.md
docs/
*.md
```

### 8.6 scripts/docker-build.sh

```bash
#!/bin/bash
set -e

VERSION=$(node -p "require('./package.json').version")
BUILD_DATE=$(date -u +"%Y-%m-%dT%H:%M:%SZ")

echo "Building media-studio:$VERSION..."

docker build \
  --tag media-studio:latest \
  --tag media-studio:$VERSION \
  --build-arg BUILD_DATE="$BUILD_DATE" \
  --build-arg VERSION="$VERSION" \
  --progress=plain \
  .

echo ""
echo "Built:"
echo "  media-studio:latest"
echo "  media-studio:$VERSION"
echo ""
echo "Run with:  docker-compose up"
echo "UI at:     http://localhost:3000"
```

### 8.7 Docker Validation Tests

After `docker-compose up`, run all of the following.
A Docker build is only complete when all pass.

```
[ ] docker build . exits 0
[ ] docker-compose up starts all 3 services cleanly
[ ] http://localhost:3000 returns 200
[ ] http://localhost:3001 (asset server) returns 200
[ ] http://localhost:3000/api/health returns { status: 'ok' }
[ ] Upload asset via UI → file appears in ./data/assets/ on host
[ ] Create project via UI → file appears in ./data/projects/ on host
[ ] Trigger render → completes, file in ./data/exports/ on host
[ ] docker-compose restart → projects, assets, exports all survive
[ ] docker exec media-studio whoami → returns 'studio' (not root)
[ ] Container runs Beat-Sync Visualizer render without OOM kill
[ ] Image size documented (flag if >4GB, investigate layers)
```

Run all UI Playwright tests against http://localhost:3000 (Docker).
Run all MCP tool tests against the Dockerized MCP server.
Run the full MCP end-to-end workflow chain (Part 5.4) against Docker.

---

## PART 9 — FINAL DELIVERABLES

After all phases are complete, produce this exact report structure:

### 9.1 Executive Summary

**What was found broken and fixed:**
For each defect: root cause | impact | fix applied | test that now passes

**What was missing and was built:**
For each feature gap: what was missing | what was implemented | how it was validated

**Test run summary:**
- Unit tests: X/Y passed
- Integration tests: X/Y passed
- Visual regression: X/Y passed
- MCP tool tests: X/Y passed
- MCP E2E chain: PASS / FAIL
- Docker validation: X/Y passed
- Total: X/Y

### 9.2 Feature Completeness Matrix (Final)

Copy the matrix from Part 6, filled in with ✅ or ❌ and a one-line note per row.
Every row must be ✅.

### 9.3 Docker Artifact Summary

- Final image size: X GB
- Exposed ports and their purpose
- Volume mounts and what persists in each
- One-command startup: `docker-compose up`
- Time to first render (cold start, Beat-Sync 30s, mp4-h264): X minutes

### 9.4 Test Evidence

For each template:
- Playwright screenshot of the editor with that template loaded
- ffprobe output of one rendered export
- Frame-diff result from visual regression test

For MCP:
- Full JSON transcript of the 12-step end-to-end workflow

### 9.5 Known Limitations & Follow-up Items

Anything that works but has documented caveats, or intentionally deferred items.
Format: Item | Why deferred | Suggested approach | Priority (High/Med/Low)

---

## APPENDIX A — Remotion Documentation Checklist

Read these URLs before planning any composition fix. If the behavior you need is not
documented, do not assume it works — test it first.

```
https://www.remotion.dev/docs
https://www.remotion.dev/docs/the-fundamentals
https://www.remotion.dev/docs/remotion-player
https://www.remotion.dev/docs/renderer
https://www.remotion.dev/docs/parametrized-rendering
https://www.remotion.dev/docs/animating-properties
https://www.remotion.dev/docs/spring
https://www.remotion.dev/docs/interpolate
https://www.remotion.dev/docs/sequence
https://www.remotion.dev/docs/series
https://www.remotion.dev/docs/audio
https://www.remotion.dev/docs/use-audio-data
https://www.remotion.dev/docs/noise
https://www.remotion.dev/docs/staticfile
https://www.remotion.dev/docs/output-formats
https://www.remotion.dev/docs/config
https://www.remotion.dev/docs/env-variables
https://www.remotion.dev/docs/troubleshooting/timeout
```

**Critical Remotion constraints to validate against:**
- `Math.random()` is forbidden in compositions — use `random(seed)` from `remotion`
- `Date.now()`, `new Date()`, `performance.now()` are forbidden — use `useCurrentFrame()`
- All asset URLs must be resolvable during render (staticFile or absolute localhost URL)
- `useAudioData` returns `null` on first render — all audio code must handle null
- `visualizeAudio` requires `audioData` to be non-null — guard with null check
- `@remotion/player` runs in browser, `@remotion/renderer` runs in Node — never mix APIs
- Compositions must be deterministic: same frame number = same output, always

---

## APPENDIX B — ffprobe Validation Commands

Use these to validate exported files. These are the ground truth for export correctness.

```bash
# Check file exists and get full stream info
ffprobe -v quiet -print_format json -show_streams -show_format OUTPUT_FILE

# Assert video codec
ffprobe -v error -select_streams v:0 -show_entries stream=codec_name \
  -of default=noprint_wrappers=1:nokey=1 OUTPUT_FILE
# Expected for mp4-h264: h264
# Expected for mp4-h265: hevc
# Expected for webm-vp9: vp9

# Assert dimensions
ffprobe -v error -select_streams v:0 \
  -show_entries stream=width,height \
  -of default=noprint_wrappers=1 OUTPUT_FILE

# Assert duration (seconds)
ffprobe -v error -show_entries format=duration \
  -of default=noprint_wrappers=1:nokey=1 OUTPUT_FILE

# Assert audio stream present
ffprobe -v error -select_streams a:0 -show_entries stream=codec_name \
  -of default=noprint_wrappers=1:nokey=1 OUTPUT_FILE

# Assert frame rate
ffprobe -v error -select_streams v:0 -show_entries stream=r_frame_rate \
  -of default=noprint_wrappers=1:nokey=1 OUTPUT_FILE
```

---

## APPENDIX C — Environment Variables Reference

Validate that all of these are documented in `.env.example` and handled at startup.
Any missing env var must fail fast with a clear error message — never silently use undefined.

```bash
# Directories
ASSET_DIR=./data/assets
PROJECTS_DIR=./data/projects
EXPORTS_DIR=./data/exports
THUMBNAILS_DIR=./data/thumbnails

# Server ports
STUDIO_PORT=3000
ASSET_SERVER_PORT=3001
MCP_SERVER_PORT=3002            # only if MCP uses HTTP transport

# URLs (for cross-service communication)
ASSET_SERVER_URL=http://localhost:3001
STUDIO_URL=http://localhost:3000

# Remotion
REMOTION_CHROME_EXECUTABLE=     # leave blank to use Remotion's bundled Chrome locally
                                 # set to /usr/bin/chromium in Docker

# Render
MAX_CONCURRENT_RENDERS=2        # how many render jobs run in parallel
RENDER_TIMEOUT_MS=600000        # 10 minutes max per render

# Node environment
NODE_ENV=development            # or 'production'
```

---

*End of Master Plan. Version 1.0. Align all implementation decisions with `docs/` first,
then with the specifications in this document. Where they conflict, flag the conflict
explicitly and resolve it before writing code.*
