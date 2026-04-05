# Export Formats & Rendering

Complete guide to rendering and exporting videos with different codecs, quality levels, and output formats.

## Rendering Pipeline

```
UI/MCP Tool
    ↓
render_project() → Creates RenderJob
    ↓
RenderQueue.enqueue() → Status: "queued"
    ↓
$bundling(~30-60s)
├─ Step 1: bundle(entryPoint)
│  └─ Webpack bundles Remotion composition + dependencies
├─ Step 2: selectComposition({ serveUrl, id, inputProps })
│  └─ Identify composition and validate config
└─ Step 3: Configure render parameters
    ├─ Dimensions (width × height from preset)
    ├─ Codec (h264, h265, etc.)
    ├─ Quality (CRF or bitrate)
    ├─ Frame range (optional)
    └─ Scale factor (1.0 = full, 0.5 = preview)
    ↓
$rendering(varies by template)
└─ FFmpeg renders frames to disk:
   ├─ Each frame generated from React component
   ├─ Progress: 0–100% of totalFrames
   ├─ Status updates every frame
   └─ Can be cancelled
    ↓
$encoding(varies by codec)
└─ FFmpeg re-encodes to target codec:
   ├─ Audio mixed in (if any)
   ├─ Container written (.mp4, .webm, .mov)
   ├─ Progress: 0–100% of totalFrames
   └─ Output file created
    ↓
complete / error
└─ RenderJob status updated
└─ outputPath populated
```

## Video Codecs

Each codec balances quality, file size, compatibility, and speed.

### H.264 (MP4) — **RECOMMENDED**

**Container**: `.mp4`

**Characteristics**:
- Wide compatibility (all browsers, devices, platforms)
- Industry standard for web, social media
- Mature, stable encoding
- Royalty considerations (but free for most use)

**Quality (CRF)**:
```
CRF 51 (worst)  ←→  CRF 18 (default)  ←→  CRF 0 (lossless)
Smallest file             Balanced              Largest file
```

| Preset | CRF | Use Case |
|--------|-----|----------|
| Draft | 28 | Fast preview, poor quality |
| Standard | 18 | Default, production-ready |
| High | 12 | High-quality web |
| Max | 1 | Highest quality (rare, huge files) |

**Speed**: ~3 min for 30s video + 6-8 Mbps bitrate

**Example**:
```json
{
  "codec": "h264",
  "quality": "standard",
  "scale": 1.0
}
```

---

### H.265 (HEVC/MP4)

**Container**: `.mp4`

**Characteristics**:
- 40-50% smaller files than H.264 (same quality)
- Newer codec, not all browsers support
- Better for archival, editing
- Slower encoding than H.264

**Quality**: Same CRF scale as H.264

| Preset | CRF | File Size vs H.264 |
|--------|-----|------------------|
| Draft | 28 | -40% |
| Standard | 23 | -50% |
| High | 18 | -45% |
| Max | 1 | -35% |

**Speed**: ~4 min for 30s video (20% slower than H.264)

**Compatibility**:
- ✅ Safari 11+, Chrome 107+, Firefox (via extension)
- ❌ Internet Explorer, older mobile browsers
- ⚠️ Not recommended for web if broad compatibility needed

**Example**:
```json
{
  "codec": "h265",
  "quality": "high"
}
```

---

### VP8 (WebM)

**Container**: `.webm`

**Characteristics**:
- Free, open-source alternative to H.264
- Good browser support for video format
- Patent-free
- Slower than H.264, larger files

**Quality (VBR)**:
```
CRF 63 (worst)  ←→  CRF 9 (good)  ←→  CRF 4 (best)
```

**Speed**: ~4 min for 30s video

**Compatibility**: Most modern browsers (Firefox, Chrome, Edge)

**Use Case**: Open-source projects, web distribution

---

### VP9 (WebM Modern)

**Container**: `.webm`

**Characteristics**:
- Modern WebM codec
- Similar compression to H.265
- Slower encoding than VP8
- Good for future-proofing

**Quality (VBR)**:
```
CRF 63 (worst)  ←→  CRF 28 (standard)  ←→  CRF 0 (best)
```

**Speed**: ~6 min for 30s video (slowest!)

**Compatibility**: Chrome, Firefox, Opera (not Safari)

**Use Case**: Future-proof web distribution, Android

---

### AV1 (WebM Modern)

**Container**: `.webm`

**Characteristics**:
- Newest royalty-free codec
- Best compression ratio (~30% smaller than VP9)
- Very slow encoding (2-3x H.264)
- Limited browser support

**Quality**: Same scale as VP9

**Speed**: ~15+ min for 30s video (extremely slow)

**Compatibility**: Chrome 70+, Firefox 67+, Edge (not Safari)

**Use Case**: Long-term archival, YouTube uploads, future-proof storage

**Not recommended** for immediate use (encoding too slow).

---

### ProRes (MOV)

**Container**: `.mov`

**Characteristics**:
- Professional video codec (Apple)
- Lossless or near-lossless
- Large file sizes (10-20x H.264)
- Designed for video editing, not web
- macOS-native hardware support

**Profiles**:
```
proxy          — Low complexity, fast editing
light          — Standard editing
standard       — Default professional
hq             — High quality with alpha
4444           — 4:4:4 chroma, with alpha channel
4444-xq        — Extra quality with alpha
```

**Speed**: ~2 min for 30s video (fast, hardware-accelerated on Mac)

**Use Cases**:
- ✅ Professional video editing (Final Cut, Avid)
- ✅ Color grading workflows
- ✅ Archival (lossless)
- ❌ Web distribution
- ❌ Social media

**Platform**: macOS only (via Apple hardware)

**Example**:
```json
{
  "codec": "prores",
  "proResProfile": "hq"
}
```

---

### GIF (Animated)

**Container**: `.gif`

**Characteristics**:
- Animated loop format
- Limited color palette (256 colors)
- Large files (less efficient than video)
- Wide compatibility (email, chat, web)
- No audio

**Configuration**:
```
everyNthFrame: 2    // Render every 2nd frame (halves FPS)
numberOfGifLoops: 0 // 0 = infinite loop
```

**Speed**: ~30s for 3s video (very fast)

**Use Case**: Social media reactions, memes, email, Slack

**File Size**:
- 3s at 15 fps: ~2-5 MB
- 30s at 10 fps: ~15-30 MB

**Example**:
```json
{
  "codec": "gif",
  "everyNthFrame": 2,
  "numberOfGifLoops": 0
}
```

---

## Quality Comparison

### File Size (30s video, 1920×1080, 30 fps)

| Codec | Standard | High | Max |
|-------|----------|------|-----|
| H.264 | 15 MB | 25 MB | 100+ MB |
| H.265 | 8 MB | 13 MB | 50+ MB |
| VP8 | 18 MB | 30 MB | — |
| VP9 | 10 MB | 16 MB | 60+ MB |
| AV1 | 6 MB | 10 MB | 40+ MB |
| ProRes | 2 GB | 2+ GB | — |

### Rendering Speed (30s video)

| Codec | Speed | Relative |
|-------|-------|----------|
| H.264 | 3 min | 1x |
| H.265 | 4 min | 1.3x |
| VP8 | 4 min | 1.3x |
| VP9 | 6 min | 2x |
| AV1 | 15+ min | 5x+ |
| ProRes | 2 min | 0.7x |
| GIF | 30s | 0.2x |

---

## Quality Presets

### Draft

**Best for**: Quick previews, testing, before final render

**Characteristics**:
- 50% resolution (scale: 0.5)
- CRF 28 (H.264) / 37 (H.265)
- Encoder preset: superfast
- ~1-2 min for 30s video

**Use Cases**:
- Preview effect before full render
- Check color/composition quickly
- Share rough cuts

---

### Standard

**Best for**: Most use cases, production default

**Characteristics**:
- Full resolution (scale: 1.0)
- CRF 18 (H.264) / 23 (H.265)
- Encoder preset: medium
- ~3-4 min for 30s video
- ~15 MB per 30s (H.264)

**Use Cases**:
- Social media upload
- Web distribution
- Most platforms accept this quality

---

### High

**Best for**: High-quality output, YouTube, professional review

**Characteristics**:
- Full resolution
- CRF 12 (H.264) / 18 (H.265)
- Encoder preset: slow
- ~4-5 min for 30s video
- ~25 MB per 30s (H.264)

**Use Cases**:
- YouTube uploads
- Client reviews
- High-quality archival

---

### Max

**Best for**: Archival, mastering, editing

**Characteristics**:
- Full resolution (can scale to 2x)
- CRF 1 (near lossless)
- Encoder preset: veryslow
- ~10+ min for 30s video
- 100+ MB per 30s

**Use Cases**:
- Archival/preservation
- Editing/color grading input
- Client master files

---

## Export Settings

### Aspect Ratio Presets

| Preset | Ratio | Width | Height | Platform |
|--------|-------|-------|--------|----------|
| Instagram Post | 1:1 | 1080 | 1080 | Instagram, LinkedIn, Facebook |
| Instagram Reel | 9:16 | 1080 | 1920 | Instagram, TikTok, YouTube Shorts |
| YouTube | 16:9 | 1920 | 1080 | YouTube, Twitter, Facebook |
| Twitter/X | 16:9 | 1280 | 720 | Twitter/X (any 16:9) |
| Pinterest | 2:3 | 1000 | 1500 | Pinterest Pins |
| Facebook | 4:5 | 1080 | 1350 | Facebook feed |
| LinkedIn | 1:1 | 1080 | 1080 | LinkedIn posts |
| Custom | — | user | user | Your dimensions |

### Frame Range

Render only part of the video:

```
Total frames: 1800 (30s @ 30fps)

Render frames 300-900:
Start: Frame 10 (10s)
End: Frame 30 (30s)
Duration: 20 seconds
```

Use case: Export different cuts without re-rendering full video.

### Scale Factor

Temporarily reduce dimensions for faster preview:

```
Original: 1920×1080
Scale 1.0: 1920×1080 (full quality)
Scale 0.5: 960×540 (half resolution, 4x faster)
Scale 2.0: 3840×2160 (4K, 4x slower)
```

**Typical workflow**:
1. Export at 0.5 scale for preview
2. Export at 1.0 for production

---

## Platform-Specific Recommendations

### YouTube

**Recommended**:
- Codec: H.264
- Resolution: 1920×1080 (1080p) or 1280×720 (720p)
- Frame rate: 30 fps
- Bitrate: 5-10 Mbps
- Quality: Standard or High
- Format: MP4

**Upload specs**: https://support.google.com/youtube/answer/1722171

### Instagram

**Recommended**:
- Codec: H.264
- Resolution: 1080×1080 (posts) or 1080×1920 (stories/reels)
- Frame rate: 30 fps
- Bitrate: 4-6 Mbps
- Quality: Standard
- Format: MP4

**Max file size**: 4 GB

### TikTok

**Recommended**:
- Codec: H.264
- Resolution: 1080×1920 (full screen)
- Frame rate: 30 fps
- Bitrate: 5-8 Mbps
- Quality: Standard
- Format: MP4

**Max duration**: 10 minutes

### Facebook

**Recommended**:
- Codec: H.264
- Resolution: 1200×628 (landscape) or 1080×1350 (portrait)
- Frame rate: 30 fps
- Bitrate: 4-6 Mbps
- Quality: Standard
- Format: MP4

### Twitter/X

**Recommended**:
- Codec: H.264
- Resolution: 1280×720 or 1024×576
- Frame rate: 30 fps
- Bitrate: 2.5-5 Mbps
- Quality: Standard or Draft
- Format: MP4

**Max file size**: 512 MB

### LinkedIn

**Recommended**:
- Codec: H.264
- Resolution: 1080×1080 (square) or 1920×1080 (landscape)
- Frame rate: 30 fps
- Bitrate: 5-8 Mbps
- Quality: Standard or High
- Format: MP4

---

## Batch Export

Export same project with multiple codecs/qualities:

```
Project: "Product Showcase"

Exports:
1. H.264 Standard (Web) → product-showcase-web.mp4
2. H.265 High (Archive) → product-showcase-archive.mp4
3. ProRes HQ (Editing) → product-showcase-master.mov
4. VP9 Standard (Alt) → product-showcase-vp9.webm
```

Each render queues sequentially. Use MCP API:

```
Tool: render_project { projectId, codec: "h264", quality: "standard" }
Tool: render_project { projectId, codec: "h265", quality: "high" }
Tool: render_project { projectId, codec: "prores", quality: "hq" }

Monitor each job with get_render_status(jobId)
```

---

## Performance Tuning

### Speed Up Rendering

1. **Reduce dimensions**:
   - Draft quality (0.5 scale): -75% time
   - 720p instead of 1080p: -60% time

2. **Reduce duration**: Only render needed frames via frame range

3. **Simplify template**:
   - Fewer animations = faster bundling
   - Fewer assets = smaller bundle

4. **Fastest path**: GIF or ProRes (no need for complex encoding)

### Quality Optimization

1. **For web**: H.264 Standard (industry standard)
2. **For archival**: H.265 High or ProRes HQ
3. **For distribution**: VP9 Standard (for future)
4. **For editing**: ProRes HQ (with alpha if needed)

### File Size Optimization

1. **Codec**: AV1 < H.265 < VP9 < H.264
2. **Quality**: Reduce CRF (higher number = smaller)
3. **Resolution**: 720p vs 1080p = 60% smaller
4. **Format**: WebM < MP4 < MOV

---

## Troubleshooting

### Render Hangs

- Check CPU/memory availability
- Reduce output dimensions
- Cancel and retry with Draft quality

### File Size Unexpectedly Large

- Use High or Max quality? (reduce to Standard)
- Use ProRes? (intended behavior—use H.264 instead)
- High bitrate? (reduce via quality setting)

### Quality Poor

- Using Draft quality? (upgrade to Standard/High)
- Low CRF value? (Standard or High preset)
- Output too small? (check width/height)

### Codec Not Supported

- ProRes on Windows? (not supported, use H.264)
- AV1 on browser? (choose H.264 for compatibility)

---

## See Also

- [TEMPLATES.md](TEMPLATES.md) — Template-specific rendering tips
- [ARCHITECTURE.md](ARCHITECTURE.md) — Render pipeline details
- [MCP_API.md](MCP_API.md) — render_project() tool reference
