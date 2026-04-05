# Remotion Studio

A professional, open-source media creation platform built on [Remotion](https://www.remotion.dev/). Design, preview, and render high-quality videos programmatically with an intuitive UI and powerful API.

## ✨ Features

- **5 Professional Templates**: History Storyline, Beat-Synced Visualizer, Quote Cards, Social Reels, Product Showcase
- **Multi-Format Export**: MP4, WebM, ProRes, GIF, PNG/JPEG sequences with quality presets
- **Aspect Ratio Presets**: Automatic layouts for Instagram, TikTok, YouTube, Twitter, Pinterest, LinkedIn
- **MCP Server**: AI-native tool integration with Claude, GPT, and other LLM clients
- **Real-time Preview**: Live player with frame-accurate scrubbing and property editing
- **Asset Management**: Upload and reference images, audio, and video files
- **Project Persistence**: Save, load, and fork video projects
- **Render Queue**: Sequential video rendering with progress tracking
- **TypeScript-First**: Full type safety across all components

## 🚀 Quick Start

### Prerequisites

- **Node.js** 20+ (LTS recommended)
- **Bun** 1.3.11+ (package manager and runtime)
- **FFmpeg** (auto-installed by Remotion)

### Installation

```bash
# Clone the repository
git clone <this-repo>
cd remotion-studio

# Install dependencies
bun install

# Start development server
bun run dev
```

The studio opens at **http://localhost:5173** with hot module reloading.

### First Video

1. Open the **Dashboard** tab
2. Click **"Create Project"** and select **"History Storyline"**
3. Upload some images or use placeholders
4. Click **"Preview"** to see live rendering
5. Click **"Export"** to render to MP4

## 📁 Project Structure

```
remotion-studio/
├── README.md                      # This file
├── docs/                          # Comprehensive documentation
│   ├── ARCHITECTURE.md            # System design & component overview
│   ├── GETTING_STARTED.md         # Installation & setup guide
│   ├── TEMPLATES.md               # Template specifications & customization
│   ├── MCP_API.md                 # MCP server tools reference
│   ├── EXPORT_FORMATS.md          # Render pipeline & export options
│   ├── DEVELOPMENT.md             # Workflow & code conventions
│   ├── DEPLOYMENT.md              # Production build & deployment
│   ├── REQUIREMENTS.md            # Tech stack & dependencies
│   └── TESTING.md                 # Testing strategy & how to run tests
├── package.json                   # Root workspace config (Bun)
├── tsconfig.base.json             # Base TypeScript config
├── bun.lock                       # Dependency lock file
│
├── apps/
│   ├── studio/                    # Vite + React UI application
│   │   ├── src/
│   │   │   ├── main.tsx           # Application entry
│   │   │   ├── App.tsx            # Root component
│   │   │   ├── pages/             # Page components (Dashboard, Editor)
│   │   │   ├── components/        # Reusable UI components
│   │   │   ├── stores/            # Zustand state management
│   │   │   └── styles/            # Tailwind CSS config
│   │   └── package.json
│   │
│   └── mcp-server/                # Model Context Protocol server
│       ├── src/
│       │   ├── index.ts           # MCP server entry point
│       │   ├── handlers.ts        # Tool handlers (testable)
│       │   └── __tests__/         # Tool unit tests
│       └── package.json
│
└── packages/
    ├── shared-types/              # TypeScript interfaces & Zod schemas
    │   ├── src/
    │   │   ├── index.ts           # Exported types & schemas
    │   │   └── __tests__/         # Schema tests
    │   └── package.json
    │
    ├── remotion-compositions/     # Remotion templates & rendering
    │   ├── src/
    │   │   ├── Root.tsx           # Composition registry
    │   │   ├── templates/         # 5 template components
    │   │   └── animations/        # Reusable animation utilities
    │   ├── public/                # Static assets for rendering
    │   ├── remotion.config.ts     # Remotion configuration
    │   └── package.json
    │
    ├── template-registry/         # Template manifest registry
    │   ├── src/
    │   │   ├── registry.ts        # Template registration logic
    │   │   ├── templates.ts       # Template metadata
    │   │   ├── index.ts           # Public API
    │   │   └── __tests__/         # Registry tests
    │   └── package.json
    │
    └── renderer/                  # @remotion/renderer wrapper
        ├── src/
        │   ├── queue.ts           # RenderQueue event emitter
        │   ├── render.ts          # executeRender() pipeline
        │   ├── index.ts           # Public exports
        │   └── __tests__/         # Queue tests
        └── package.json
```

## 🎯 Key Concepts

### Templates
Each template is a Remotion composition with:
- **Zod schema** for type-safe property validation
- **React component** rendering the video frames
- **Manifest metadata** (duration, FPS, aspect ratios)
- **calculateMetadata** hook for dynamic properties (e.g., duration based on audio)

### Render Pipeline
1. **Bundle**: Webpack compilation of Remotion composition
2. **Select**: Choose composition and pass inputProps
3. **Render**: Frame-by-frame video generation
4. **Encode**: MP4/WebM/ProRes encoding
5. **Output**: Save to exports directory

### Aspect Ratios
Presets automatically configure dimensions for platforms:
- **1:1**: Instagram Post, Square
- **9:16**: Instagram Reel, TikTok, YouTube Shorts
- **16:9**: YouTube, Twitter/X, Landscape
- **4:5**: Facebook, Instagram Story
- **2:3**: Pinterest Pin

### Export Formats
- **Video**: h264, h265, vp8, vp9, av1, prores
- **Animated**: GIF with frame control
- **Sequences**: PNG/JPEG frame images
- **Quality**: Draft (fast), Standard (default), High, Max (lossless)

## 🛠️ Available Commands

```bash
# Development
bun run dev                       # Start dev server with hot reload

# Build & Type Check
bun run build                     # Compile all packages
bun run type-check                # TypeScript type validation

# Testing
bun run test                      # Run all test suites
bun run --filter '@studio/shared-types' test    # Single package tests

# Rendering
bun run --filter '@studio/mcp-server' start     # Start MCP server (stdio)
```

## 📚 Documentation

Each documentation file covers a specific aspect:

| Document | Purpose |
|----------|---------|
| [ARCHITECTURE.md](docs/ARCHITECTURE.md) | System design, component roles, data flow |
| [GETTING_STARTED.md](docs/GETTING_STARTED.md) | Installation, configuration, first steps |
| [TEMPLATES.md](docs/TEMPLATES.md) | Details on all 5 templates, customization |
| [MCP_API.md](docs/MCP_API.md) | AI server tools, integration examples |
| [EXPORT_FORMATS.md](docs/EXPORT_FORMATS.md) | Codec options, quality settings, rendering |
| [DEVELOPMENT.md](docs/DEVELOPMENT.md) | Code style, adding templates, extending |
| [DEPLOYMENT.md](docs/DEPLOYMENT.md) | Production builds, Docker, server setup |
| [REQUIREMENTS.md](docs/REQUIREMENTS.md) | Tech stack details, version constraints |
| [TESTING.md](docs/TESTING.md) | Unit/integration tests, how to run |

## 🎨 Templates Included

1. **History Storyline** — Image sequences with Ken Burns zoom, text overlays, audio sync
2. **Beat-Synced Visualizer** — Real-time audio visualization with bars/circles
3. **Quote Card Sequence** — Animated quote cards with transitions and background images
4. **Social Media Reel** — Fast-paced slides with music, designed for vertical video
5. **Product Showcase** — E-commerce product highlights with animations and CTAs

Each template is fully customizable with inputProps. See [TEMPLATES.md](docs/TEMPLATES.md) for details.

## 🤖 MCP Integration

Run the MCP server to integrate with AI assistants:

```bash
bun run --filter '@studio/mcp-server' start
```

Tools available:
- `list_templates` — Get all template info
- `create_project` — Create new project from template
- `render_project` — Queue render job
- `get_render_status` — Check render progress
- `export_formats` — See available codec options

See [MCP_API.md](docs/MCP_API.md) for full API reference.

## 🧪 Testing

All packages include unit tests:

```bash
# Run all tests
bun run test

# Watch mode
bun run --filter '@studio/shared-types' test -- --watch
```

Test suites:
- **shared-types**: Schema validation (19 tests)
- **template-registry**: Template registration (28 tests)
- **renderer**: RenderQueue pipeline (14 tests)
- **mcp-server**: Tool handlers (36 tests)

Total: **97 tests** across 4 packages. See [TESTING.md](docs/TESTING.md).

## 📦 Dependencies

**Runtime:**
- Remotion 4.x — Video rendering engine
- React 19.x — UI framework
- Zod 3.x — Schema validation
- FFmpeg — Media encoding (bundled)

**Development:**
- Bun 1.3.11+ — Package manager & runtime
- TypeScript 5.5+ — Language
- Vite 5.x — Dev server
- Vitest 2.x — Testing framework

See [REQUIREMENTS.md](docs/REQUIREMENTS.md) for complete tech stack.

## 🚨 Troubleshooting

### "FFmpeg not found"
Remotion will auto-download FFmpeg. If it fails, install manually:
```bash
# macOS
brew install ffmpeg

# Ubuntu
sudo apt-get install ffmpeg

# Windows
choco install ffmpeg
```

### "Module not found" errors
Clear Bun cache and reinstall:
```bash
rm -rf node_modules bun.lock
bun install
bun run type-check
```

### Render hangs or crashes
Check the render logs directory at `packages/remotion-compositions/`. Reduce output dimensions or duration in export settings.

## 📄 License

Remotion components require a license for commercial use. This studio is free for personal and open-source projects. See [Remotion License](https://www.remotion.dev/license).

## 🤝 Contributing

Contributions welcome! See [DEVELOPMENT.md](docs/DEVELOPMENT.md) for code conventions and how to add new templates.

## 📞 Support

- **Remotion Docs**: https://www.remotion.dev/docs
- **Project Issues**: Create an issue on this repository
- **Discord**: Join Remotion community for peer support

---

**Built with ❤️ using Remotion, Bun, and TypeScript.**
