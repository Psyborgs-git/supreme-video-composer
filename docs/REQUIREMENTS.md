# System Requirements & Dependencies

Complete list of requirements for running Remotion Studio.

## Hardware Requirements

### Development

**Minimum**:
- CPU: 4 cores (Intel i5 / M1 equivalent)
- RAM: 8 GB
- Disk: 10 GB SSD
- Network: Broadband (10 Mbps+)

**Recommended**:
- CPU: 8+ cores (i7 / M3 Pro)
- RAM: 16 GB+
- Disk: 50 GB SSD
- GPU: Optional (NVIDIA CUDA for faster rendering)

### Production (Per Instance)

**For 2-3 concurrent renders**:
- CPU: 4 cores
- RAM: 8 GB
- Disk: 50 GB SSD
- Network: Load balancer + 100 Mbps

**For Edge Case (100+ concurrent)**:
- CPU: 16+ cores
- RAM: 32+ GB
- Disk: 200+ GB NVMe
- Network: 1 Gbps+

---

## Operating Systems

### Supported

- **macOS** 12+
- **Ubuntu** 20.04+ / Debian 11+
- **Windows** 10+ (WSL2 recommended)
- **Alpine Linux** 3.16+ (Docker)

### Not Supported

- Windows 7, 8, 8.1
- macOS < 10.15
- CentOS 6, RHEL 6

---

## Software Dependencies

### Core Runtime

| Component | Version | Purpose |
|-----------|---------|---------|
| **Node.js** | 18+ | Runtime (not required with Bun) |
| **Bun** | 1.0+ | JavaScript runtime (required) |
| **FFmpeg** | 5.0+ | Video encoding |
| **libvipsImageMagick** | 7+ | Image processing |
| **Python** | 3.8+ | Optional (for scripts) |

### Package Manager

- **Bun** 1.0+ (recommended)
  - Fast, zero-config, built-in runtime
  - No npm/yarn needed
  - All scripts use `bun run`

### Database (Optional)

- **PostgreSQL** 14+
  - For project metadata storage
  - Optional (not required for basic use)
  - Already included in Docker setup

---

## Installation

### macOS

#### Option 1: Homebrew (Recommended)

```bash
# Install Bun
brew install oven-sh/bun/bun

# Install FFmpeg
brew install ffmpeg

# Install image processing (optional)
brew install vips imagemagick

# Verify installations
bun --version
ffmpeg -version
vips --version
```

#### Option 2: Manual

1. **Bun**: https://bun.sh → Download macOS binary
2. **FFmpeg**: https://ffmpeg.org/download.html
3. **Vips**: https://libvips.github.io/libvips/install.html

### Ubuntu / Debian

```bash
# Install Bun
curl -fsSL https://bun.sh/install | bash

# Install FFmpeg
sudo apt-get update
sudo apt-get install -y ffmpeg

# Install image processing
sudo apt-get install -y libvips-tools imagemagick

# Verify
bun --version
ffmpeg -version
```

### Windows (WSL2)

```bash
# In WSL2 terminal (Ubuntu)
# Follow Ubuntu instructions above

# Add to PATH if needed
export PATH="$PATH:$HOME/.bun/bin"
```

### Docker (Simplest)

```bash
# Pre-configured with all dependencies
docker run -it my-registry/remotion-studio:latest

# All tools pre-installed
# No manual setup needed
```

---

## NPM Packages

### Manage Dependencies

Install all project dependencies:

```bash
bun install
```

This installs:
- **Core**: React, TypeScript, Remotion
- **UI**: TailwindCSS
- **State**: Zustand
- **Validation**: Zod
- **Testing**: Vitest
- **Build**: Vite, Esbuild
- See `bun.lock` for full dependency tree

### Single Package

```bash
bun add some-package
bun add -D @types/node
bun remove old-package
```

---

## Development Tools

### Recommended IDE Extensions

**VS Code** (recommended):
- Copilot (AI auto-complete)
- ESLint (linting)
- Prettier (formatting)
- Tailwind CSS IntelliSense
- Thunder Client (REST API testing)

**Cursor** (alternative):
- Same ecosystem
- Built-in Copilot integration

### CLI Tools

```bash
# API testing
bun add -D @httpie/cli

# Environment management
bun add -g dotenv-cli

# Git hooks
bun add -D husky

# Commit linting
bun add -D commitlint
```

---

## Browser Compatibility

### Web UI (Dashboard)

| Browser | Version | Status |
|---------|---------|--------|
| Chrome | 90+ | ✅ Full support |
| Firefox | 88+ | ✅ Full support |
| Safari | 14+ | ✅ Full support |
| Edge | 90+ | ✅ Full support |
| Opera | 76+ | ✅ Full support |
| IE 11 | — | ❌ Not supported |

### Rendered Video Playback

Depends on codec (see [EXPORT_FORMATS.md](EXPORT_FORMATS.md)):

- **H.264 (MP4)**: All browsers, devices
- **H.265 (HEVC)**: Safari 11+, modern Chrome
- **VP9 (WebM)**: Chrome, Firefox (not Safari)
- **AV1 (WebM)**: Chrome 70+, Firefox 67+

---

## Network Requirements

### Ports

| Service | Port | Purpose |
|---------|------|---------|
| Web UI | 5173 | Vite dev server |
| MCP Server | 9090 | Tool endpoint |
| PostgreSQL | 5432 | Database |
| Redis | 6379 | Queue (optional) |

### Firewall (Production)

Open to internet:
- Port 443 (HTTPS for web UI)
- Port 80 (HTTP redirect)

Restricted (VPC only):
- Port 9090 (MCP server)
- Port 5432 (DB)
- Port 6379 (Redis)

### Internet

- **Download**: 1 Mbps+ (npm packages, assets)
- **Upload**: 10 Mbps+ (video export)
- **Latency**: < 100ms (interactive UI)

---

## File System

### Disk Space

**Development**:
- node_modules: ~2 GB
- Build outputs: ~500 MB
- Temp renders: ~5 GB (per project)
- **Total**: ~8-10 GB

**Production** (per instance):
- App code: ~500 MB
- Render cache: ~50 GB
- Logs: ~10 GB
- **Total**: ~60 GB dedicated

### Temp Directory

Renders write to `TEMP_DIR`:

```bash
# On Unix/Linux
/tmp/remotion-renders

# On macOS
/var/folders/.../T/remotion-renders

# On Windows
C:\Users\USERNAME\AppData\Local\Temp\remotion-renders
```

Configure:
```bash
export TEMP_DIR=/mnt/fast-storage/renders
```

---

## Environment Variables

### Required

```bash
# Production database (optional, defaults to in-memory)
DATABASE_URL=postgresql://user:pass@localhost:5432/studio

# API endpoint
VITE_API_URL=http://localhost:9090

# Environment
NODE_ENV=development
```

### Recommended

```bash
# Logging
LOG_LEVEL=info
LOG_FORMAT=json

# Rendering
MAX_RENDER_DURATION=3600
RENDER_QUEUE_MAX_CONCURRENT=3
FFMPEG_PATH=/usr/bin/ffmpeg
TEMP_DIR=/tmp/renders

# Optional Cloud Storage
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=xxx
AWS_SECRET_ACCESS_KEY=xxx
AWS_S3_BUCKET=renders
```

### Optional

```bash
# Error tracking
SENTRY_DSN=https://...

# Monitoring
PROMETHEUS_PORT=9091

# Authentication
AUTH_PROVIDER=okta
AUTH_DOMAIN=company.okta.com
AUTH_CLIENT_ID=xxx

# Redis Queue
REDIS_URL=redis://localhost:6379
```

---

## Platform-Specific Notes

### Apple Silicon (M1/M2/M3)

**Fully supported**:
- All tools compiled for ARM64
- Native Apple Silicon performance
- ProRes HQ at full speed (hardware acceleration)

Verify:
```bash
uname -m  # Returns: arm64
bun --version  # Should show ARM64 support
arch -arm64 ffmpeg -version
```

### GPU Acceleration

**NVIDIA CUDA** (optional):
- Install CUDA Toolkit 11+
- FFmpeg built with CUDA support
- GPU: 4 GB VRAM minimum

Check CUDA support:
```bash
ffmpeg -codecs | grep nvidia
# Should show: h264_nvenc, hevc_nvenc, etc.
```

**Not recommended** for:
- Development (CPU fast enough)
- Occasional use (<10 renders/day)
- VMs without passthrough

### VirtualBox / VMware

- ✅ Supported (allocate 4+ cores)
- ⚠️ Slower than native (2-3x overhead)
- ✅ GPU passthrough available on some hypervisors

---

## Verification Checklist

### After Installation

```bash
# ✅ Bun
bun --version
# Expected: v1.0.0+

# ✅ FFmpeg
ffmpeg -version
# Expected: ffmpeg version N-xxxxx

# ✅ Node modules
ls node_modules | head -5
# Expected: Access to thousands of packages

# ✅ Project structure
ls src/
# Expected: components, pages, utils, etc.

# ✅ Type checking
bun run type-check
# Expected: No errors

# ✅ Start dev server
bun run dev
# Expected: Server running on http://localhost:5173
```

### Development Server Test

```bash
# Terminal 1
bun run dev
# Should show: VITE v... ready in ... ms

# Terminal 2
curl http://localhost:5173
# Expected: HTML response

# Browser
open http://localhost:5173
# Expected: Dashboard loads without errors
```

---

## Troubleshooting

### FFmpeg Not Found

```bash
# Check installation
which ffmpeg

# If missing:
brew install ffmpeg  # macOS
sudo apt-get install ffmpeg  # Ubuntu

# If in non-standard location:
export FFMPEG_PATH=/custom/path/ffmpeg
bun run dev
```

### Out of Memory

```bash
# Increase Node heap
export NODE_OPTIONS=--max-old-space-size=4096
bun run dev

# Or for specific command
bun --max-old-space-size=4096 ./node_modules/.bin/vite
```

### Bun Not Found

```bash
# Install Bun
curl -fsSL https://bun.sh/install | bash

# Add to PATH
export PATH="$PATH:$HOME/.bun/bin"

# Verify
bun --version
```

### Module Not Found

```bash
# Reinstall dependencies
rm -rf node_modules bun.lock
bun install

# Clear cache
bun cache rm
bun install
```

### Port Already in Use

```bash
# Find process on port 5173
lsof -i :5173

# Kill it
kill -9 <PID>

# Or use different port
VITE_PORT=5174 bun run dev
```

### Network Timeout

```bash
# Increase timeout
bun config set timeout 60000

# Or download behind proxy
bun install --network-timeout 60000
```

---

## Performance Baseline

### Typical Render Times

| Video Length | Resolution | Codec | Time |
|--------------|-----------|-------|------|
| 5s | 1920×1080 | H.264 | 1-2 min |
| 10s | 1920×1080 | H.264 | 2-4 min |
| 30s | 1920×1080 | H.264 | 4-8 min |
| 60s | 1920×1080 | H.265 | 6-12 min |
| 5s | 1080×1080 | H.264 | 1 min |

### Resource Usage Per Render

- **CPU**: 80-100% of 1 core
- **RAM**: 500-800 MB
- **Disk I/O**: 2-5 GB (temp)
- **Network**: 0 (self-contained)

---

## Upgrading Dependencies

```bash
# Check for outdated packages
bun outdated

# Upgrade minor versions (safe)
bun upgrade

# Upgrade specific package
bun add some-package@latest

# Check compatibility
bun run type-check
bun run test --run
```

---

## See Also

- [DEVELOPMENT.md](DEVELOPMENT.md) — Development setup
- [DEPLOYMENT.md](DEPLOYMENT.md) — Production deployment
- [README.md](../README.md) — Quick start
- [Bun Documentation](https://bun.sh/docs)
- [FFmpeg Documentation](https://ffmpeg.org/documentation.html)
