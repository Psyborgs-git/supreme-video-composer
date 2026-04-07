# Getting Started

## Installation

### Prerequisites

Before you begin, ensure you have:

- **Node.js** 20 LTS or higher ([download](https://nodejs.org/))
- **Bun** 1.3.11+ ([install](https://bun.sh/))
- **Git** for cloning the repository
- **FFmpeg** (will be auto-installed, or manually: `brew install ffmpeg`)

Check your versions:

```bash
node --version      # Should be v20.x or higher
bun --version       # Should be 1.3.11+
ffmpeg -version     # Optional (Remotion will install if missing)
```

### Clone & Install

```bash
# Clone the repository
git clone https://github.com/your-org/remotion-studio
cd remotion-studio

# Install all dependencies
bun install

# Verify installation
bun run type-check    # TypeScript compilation check
bun run test          # Run all test suites (should pass)
```

This installs 718 packages across the monorepo workspace.

## Running Locally

### Development Server

Start the dev server with hot module reloading:

```bash
bun run dev
```

This launches:
- **Studio UI**: http://localhost:5173 (Vite dev server)
- **Hot reload**: Changes to React/TypeScript automatically refresh
- **Remotion bundler**: Available for live previews

### First Time Setup

1. **Open the dashboard** at http://localhost:5173
2. **Choose a template** from the grid (or click "Create Project")
3. **Edit the form** on the left panel — properties update live in Player
4. **Preview in Player** — the center panel shows your composition in real-time
5. **Upload assets** (optional) — drag images/audio into the Asset Manager
6. **Export** — click "Export" and choose format/quality

### Troubleshooting Startup Issues

**Port 5173 already in use:**
```bash
bun run dev --port 5174    # Use alternate port
```

**Module not found errors:**
```bash
rm -rf node_modules bun.lock
bun install
```

**FFmpeg download fails:**
Remotion will attempt to download FFmpeg on first render. If it fails, install manually:
```bash
# macOS
brew install ffmpeg

# Ubuntu/Debian
sudo apt-get install ffmpeg

# Windows (with Chocolatey)
choco install ffmpeg
```

## Directory Structure

```
remotion-studio/
├── apps/
│   ├── studio/           # React UI application
│   │   ├── src/
│   │   │   ├── main.tsx           # React entry
│   │   │   ├── App.tsx            # Root component
│   │   │   ├── pages/
│   │   │   │   ├── Dashboard.tsx  # Template grid, projects
│   │   │   │   └── Editor.tsx     # Player + form
│   │   │   ├── components/        # Form, Player wrapper, etc.
│   │   │   ├── stores/            # Zustand state
│   │   │   └── styles/
│   │   ├── public/                # Static assets
│   │   ├── index.html
│   │   ├── vite.config.ts
│   │   └── package.json
│   │
│   └── mcp-server/       # AI server (optional)
│       ├── src/
│       │   ├── index.ts           # MCP entry
│       │   └── handlers.ts        # Tool handlers
│       └── package.json
│
├── packages/             # Shared libraries
│   ├── shared-types/     # TypeScript types & schemas
│   ├── remotion-compositions/
│   │   ├── src/
│   │   │   ├── Root.tsx          # Template registry
│   │   │   └── templates/
│   │   ├── public/               # Assets for rendering
│   │   └── remotion.config.ts
│   ├── template-registry/        # Template manifest API
│   └── renderer/                 # Render queue & pipeline
│
├── projects/             # Saved project files (auto-created)
├── exports/              # Rendered video outputs (auto-created)
├── assets/               # User-uploaded media (auto-created)
└── docs/                 # Documentation
```

## Creating Your First Project

### Via UI

1. Go to **Dashboard** tab
2. Click **"Create Project"** or choose a template from the grid
3. Enter project name: "My First Video"
4. Select template: "Quote Card Sequence"
5. Click **"Create"**

### Via MCP Server

If you're using the MCP integration:

```bash
# Start HTTP MCP server in background
npm run mcp:http &

# Call via Claude, Cursor, or MCP client:
# Tool: create_project
# Input: {
#   "templateId": "quote-card-sequence",
#   "name": "My First Video",
#   "inputProps": {
#     "quotes": [
#       { "text": "Life is what happens while you're busy making plans", "attribution": "John Lennon" }
#     ]
#   }
# }
```

## Editing Projects

### Form Fields

Properties update in real-time as you type:

- **Text inputs**: String fields (names, text content)
- **Number sliders**: Duration, opacity, scale, etc.
- **Color pickers**: Brand colors, backgrounds
- **File uploads**: Images, audio, video files
- **Array editors**: Add/remove items (events, products, quotes)

### Player Controls

- **Play/Pause**: Space or play button
- **Scrub**: Drag timeline or click to jump
- **Speed**: 0.5x, 1x, 2x playback
- **Volume**: Mute/unmute audio
- **Fullscreen**: Expand to fill screen

### Aspect Ratio Selector

Choose preset or custom dimensions:

| Preset | Ratio | Use Case |
|--------|-------|----------|
| Instagram Post | 1:1 | Square posts |
| Instagram Reel | 9:16 | Reels & Stories |
| YouTube | 16:9 | Landscape videos |
| TikTok | 9:16 | Short-form vertical |
| Pinterest | 2:3 | Pins |
| Facebook | 4:5 | Feed posts |

Changing aspect ratio updates Player dimensions and applies template scaling.

## Exporting Videos

### Export Panel

1. **Choose Format**:
   - **MP4 (H.264)** — widest compatibility, good quality
   - **WebM (VP9)** — smaller files, browser-compatible
   - **ProRes (MOV)** — pro editing, macOS only
   - **GIF** — animated loop
   - **PNG/JPEG** — frame sequence

2. **Choose Quality**:
   - **Draft** — fast preview, lower quality
   - **Standard** — default quality, balanced
   - **High** — higher quality, slower render
   - **Max** — lossless, large files

3. **Frame Range** (optional):
   - Leave blank for full video
   - Or specify start/end frames

4. **Click "Export"**

### Rendering

- Videos render sequentially (one at a time)
- Progress bar shows real-time updates
- Estimated time based on template complexity
- Cancel button stops current render

### Output

Files saved to `/exports/`:
```
exports/
├── quote-card_{projectId}_{timestamp}.mp4
├── history-storyline_{projectId}_{timestamp}.mp4
└── ...
```

## Managing Assets

### Asset Manager

Panel on right side of Editor page shows available assets:

- **Images**: .jpg, .png, .webp, .gif
- **Audio**: .mp3, .wav, .aac
- **Video**: .mp4, .webm

### Uploading

1. Click **"Upload"** button
2. Drag files into upload area or click to browse
3. Files automatically scanned for metadata
4. Available in templates immediately

### Referencing in Templates

Use uploaded asset URLs in form fields:

```
Input field: "Background Image"
Value: /assets/images/my-photo.jpg
```

Or via MCP:

```json
{
  "imageUrl": "/assets/images/product.jpg",
  "audioUrl": "/assets/audio/background-music.mp3"
}
```

## Project Files

### Auto-Save

Projects auto-save to `/projects/` directory every 2 seconds:

```
projects/
├── {uuid}.json
└── .index.json (recent projects list)
```

### Project JSON Format

```json
{
  "version": 1,
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "name": "My Quote Video",
  "templateId": "quote-card-sequence",
  "inputProps": {
    "quotes": [
      { "text": "...", "attribution": "..." }
    ],
    "musicUrl": "/assets/audio/theme.mp3"
  },
  "aspectRatio": {
    "preset": "1:1",
    "width": 1080,
    "height": 1080
  },
  "fps": 30,
  "duration": null,
  "createdAt": "2026-04-05T10:30:00Z",
  "updatedAt": "2026-04-05T11:45:00Z"
}
```

### Loading Projects

**UI**: Dashboard shows recent projects. Click to open.

**MCP**: 
```
Tool: get_project
Input: { "projectId": "{uuid}" }
Output: Project JSON
```

### Duplicating Projects

**UI**: Right-click project → "Duplicate" (creates copy with new UUID)

**MCP**: No direct tool, but you can:
1. `get_project(id)` — fetch project
2. Modify name/props as needed
3. `create_project()` with modified data

## Commands Reference

```bash
# Development
bun run dev                    # Start dev server (http://localhost:5173)

# Build & Validate
bun run build                  # Compile all packages (TypeScript)
bun run type-check             # Check TS types without emitting

# Testing
bun run test                   # Run all tests in watch mode
bun run test --run             # Run tests once and exit

# MCP Server (optional)
bun run --filter '@studio/mcp-server' start       # Start MCP server
bun run --filter '@studio/mcp-server' dev         # Dev mode with auto-reload

# Individual package commands
bun run --filter '@studio/shared-types' test
bun run --filter '@studio/template-registry' test
bun run --filter '@studio/renderer' test
bun run --filter '@studio/mcp-server' test
```

## Environment Variables

No environment variables required for basic usage.

Optional (for future features):
- `REMOTION_CONCURRENCY` — Max parallel renders (default: 1)
- `FFM_PATH` — Custom FFmpeg path (if installed elsewhere)

## Common Tasks

### Creating Custom Template

See [DEVELOPMENT.md](DEVELOPMENT.md) for step-by-step guide.

### Integrating with AI Assistant

See [MCP_API.md](MCP_API.md) for MCP server setup.

### Rendering via Command Line

```bash
# Using the long-running HTTP MCP server
npm run mcp:http

# Then call tools programmatically
```

### Performance Tuning

- **Faster preview**: Use "Draft" quality preset
- **Faster render**: Reduce output dimensions (scale: 0.5)
- **Better quality**: Use "High" or "Max" preset, increase duration
- **Reduce memory**: Close other apps during rendering

## Next Steps

1. ✅ Installed and running
2. 📺 Create and export your first video
3. 🎨 Explore templates and customize
4. 🤖 (Optional) Set up MCP server for AI integration
5. 📖 Read template docs for advanced customization

See [TEMPLATES.md](TEMPLATES.md) for detailed template specifications and examples.
