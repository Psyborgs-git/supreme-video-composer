# Template Library Reference

All 5 templates are pre-built and ready to use. Each template is fully parametrized through its `inputProps` schema. Customize every aspect from text styling to animation timing.

## 1. History Storyline

**Category**: Educational, Narrative

**Best For**: Timelines, historical narratives, event sequences, photo galleries with Ken Burns effect

### Schema

```typescript
{
  events: Array<{
    imageUrl: string;        // Required: URL to image
    title: string;           // Required: Event title
    date: string;            // Required: Date/time label
    description?: string;    // Optional: Event details
  }>  // Min 1 event
  
  voiceoverUrl?: string;     // Optional: Narration audio
  musicUrl?: string;         // Optional: Background music
  musicVolume: number;       // 0-1, default: 0.3
  
  durationPerEvent: number;  // Seconds per event, default: 5
  transitionDuration: number; // Frames for cross-dissolve, default: 30
  
  titleFont: string;         // Font family, default: "Inter"
  titleColor: string;        // Hex color, default: "#FFFFFF"
  backgroundColor: string;   // Hex color, default: "#000000"
}
```

### Animation Behavior

- **Ken Burns Effect**: Images slowly zoom in and pan (simulates depth)
- **Text Entry**: Titles slide in from bottom with spring animation
- **Description**: Typewriter effect reveals text character-by-character
- **Transitions**: Cross-dissolve between events (30 frames default)
- **Audio**: Voiceover at full volume, music at 0.3 volume (adjustable)

### Performance

| Metric | Value |
|--------|-------|
| Render time (30s, 5 events) | ~3 min |
| Preview FPS | 24-30 |
| Image recommendation | Max 4K (4096×2304) |
| Preload strategy | Next image during current |

### Example

```json
{
  "events": [
    {
      "imageUrl": "/assets/images/ancient-egypt.jpg",
      "title": "Ancient Egypt",
      "date": "3100 BC",
      "description": "Rise of the pharaohs"
    },
    {
      "imageUrl": "/assets/images/roman-empire.jpg",
      "title": "Roman Empire",
      "date": "27 BC",
      "description": "Height of imperial power"
    }
  ],
  "durationPerEvent": 4,
  "backgroundColor": "#1a1a2e"
}
```

---

## 2. Beat-Synced Visualizer

**Category**: Visual Effects, Music

**Best For**: Music videos, audio visualizations, procedural art, real-time beat response

### Schema

```typescript
{
  audioUrl: string;              // Required: Audio file URL
  
  colorPalette: string[];        // Hex colors, default: psychedelic
  backgroundStyle: "noise" | "gradient" | "solid";  // default: "noise"
  visualizerStyle: "bars" | "circles" | "waveform"; // default: "bars"
  
  intensity: number;             // 0-2x, multiplier for response, default: 1
  numberOfBars: number;          // 16|32|64 (power of 2), default: 32
  
  noiseSpeed: number;            // Evolution speed, default: 0.01
  particleCount: number;         // Particle effects, default: 50
}
```

### Animation Behavior

- **Audio Analysis**: Every frame analyzes frequency response (16-64 bands)
- **Bar Heights**: Proportional to amplitude, colors cycle through palette
- **Beat Detection**: Low-frequency spike → visual burst/swell
- **Background**: Animated Perlin noise or gradient, evolves with audio
- **Particles**: CSS-transformed elements respond to amplitude + noise

### Performance

| Metric | Value |
|--------|-------|
| Render time (30s music) | ~5 min |
| Preview FPS | 20-24 (audio processing) |
| Audio source | OK to be remote (CORS required) |
| Sample analysis | ~30ms per frame |

### Audio Requirements

- **Format**: MP3, WAV, AAC (any browser-compatible)
- **CORS**: Must support cross-origin requests
- **Max duration**: No limit (unlimited frames supported)
- **Remote audio**: OK (will be cached)

### Example

```json
{
  "audioUrl": "/assets/audio/electronic-music.mp3",
  "colorPalette": ["#FF00FF", "#00FFFF", "#FFFF00"],
  "visualizerStyle": "circles",
  "numberOfBars": 32,
  "intensity": 1.2,
  "backgroundStyle": "gradient"
}
```

### Customization Tips

- **More responsive**: Increase `intensity` (up to 2.0)
- **Smoother background**: Decrease `noiseSpeed` (0.001-0.01)
- **Different feel**: Change `colorPalette` (2-8 colors recommended)
- **Bars vs circles**: Try both — bars are more familiar, circles more artistic

---

## 3. Quote Card Sequence

**Category**: Social Media, Inspirational

**Best For**: Quote compilations, testimonials, motivational content, social media clips

### Schema

```typescript
{
  quotes: Array<{
    text: string;                    // Required: Quote text
    attribution: string;             // Required: Author/source
    backgroundImageUrl?: string;    // Optional: Background image
  }>  // Min 1 quote
  
  brandColor: string;                // Primary color, default: "#6366F1"
  accentColor: string;               // Secondary, default: "#EC4899"
  backgroundColor: string;           // Fallback, default: "#0F172A"
  
  fontFamily: string;                // Font name, default: "Inter"
  durationPerQuote: number;          // Seconds, default: 4
  transitionStyle: "fade" | "slide" | "scale"; // default: "fade"
  
  musicUrl?: string;                 // Background music
  musicVolume: number;               // 0-1, default: 0.2
}
```

### Animation Behavior

- **Entry**: Quote scales 0.8→1 with spring, text fades in
- **Hold**: Static display for configured duration
- **Exit**: Reverse animation (last 15 frames)
- **Attribution**: Slides in from bottom after 0.5s delay
- **Background**: Optional image with gradient overlay + brand color tint

### Aspect Ratios

Optimized for:
- **1:1**: Square (Instagram, LinkedIn)
- **9:16**: Vertical (Reels, Stories, TikTok)
- **16:9**: Landscape (YouTube)

Automatically repositioned for each preset.

### Performance

| Metric | Value |
|--------|-------|
| Render time (30s, 8 quotes) | ~2 min |
| Preview FPS | 30+ |
| Complexity | Low (text + transforms only) |

### Example

```json
{
  "quotes": [
    {
      "text": "The only way to do great work is to love what you do.",
      "attribution": "Steve Jobs",
      "backgroundImageUrl": "/assets/images/apple-park.jpg"
    },
    {
      "text": "Innovation distinguishes between a leader and a follower.",
      "attribution": "Steve Jobs"
    }
  ],
  "brandColor": "#1e40af",
  "durationPerQuote": 5,
  "transitionStyle": "scale"
}
```

### Font Recommendations

- **Serif**: Georgia, "Times New Roman" (classic)
- **Sans-serif**: Inter, Helvetica, "Open Sans" (modern)
- **Display**: Playfair Display, Syne (bold statements)

---

## 4. Social Media Reel

**Category**: Social Media, Fast-Paced

**Best For**: Product highlights, lifestyle content, short-form video, 15-30s clips

### Schema

```typescript
{
  slides: Array<{
    mediaUrl: string;                    // Image or video file
    mediaType: "image" | "video";       // Type
    text?: string;                       // Overlay text
    textPosition: "top" | "center" | "bottom";
  }>  // Min 1 slide
  
  musicUrl: string;                     // Required: Background music
  musicVolume: number;                  // 0-1, default: 0.7
  
  durationPerSlide: number;              // Seconds, default: 2
  transitionStyle: "cut" | "swipe-up" | "zoom" | "slide-left";
  
  brandName?: string;                    // Watermark text
  brandLogoUrl?: string;                 // Logo image URL
  textColor: string;                     // Hex, default: "#FFFFFF"
  textShadow: boolean;                   // Drop shadow, default: true
}
```

### Animation Behavior

- **Transitions**: Quick cuts, swipes, or zooms between slides
- **Text**: Spring-animated entry with optional shadow
- **Logo**: Fixed in corner with subtle entrance
- **Music**: Consistent throughout, loops if shorter than duration
- **Aspect**: Designed for 9:16 but adapts to 16:9 and 1:1

### Media Handling

- **Images**: Fill frame with `object-fit: cover`
- **Videos**: Via `<OffthreadVideo>` (Rust-based, faster than HTML5)
- **Audio**: Video audio muted (music takes priority)

### Performance

| Metric | Value |
|--------|-------|
| Render time (30s, 15 slides) | ~4 min |
| Preview FPS | 24+ |
| Video source | Slower if many (bundle time) |
| Transition speed | < 1s per slide |

### Example

```json
{
  "slides": [
    {
      "mediaUrl": "/assets/images/product-1.jpg",
      "mediaType": "image",
      "text": "New Collection",
      "textPosition": "bottom"
    },
    {
      "mediaUrl": "/assets/video/product-demo.mp4",
      "mediaType": "video",
      "text": "In Action",
      "textPosition": "top"
    }
  ],
  "musicUrl": "/assets/audio/upbeat-track.mp3",
  "durationPerSlide": 2.5,
  "transitionStyle": "swipe-up",
  "brandName": "My Brand",
  "textColor": "#FFFFFF"
}
```

### Tips for Best Results

- **Keep videos short**: 2-5s per slide for fast pacing
- **Use consistent style**: Same framing/lighting for cohesion
- **Music sync**: Choose upbeat tracks with clear beats
- **Watermark placement**: Corner, semi-transparent (non-intrusive)

---

## 5. Product Showcase

**Category**: E-Commerce, Promotional

**Best For**: Product launches, catalog videos, features highlights, retail/SaaS

### Schema

```typescript
{
  products: Array<{
    imageUrl: string;          // Product image
    name: string;              // Product name
    price: string;             // Price (formatted, e.g., "$29.99")
    description?: string;      // 1-2 line description
    ctaText?: string;          // Call-to-action, default: "Learn More"
  }>  // Min 1 product
  
  brandColor: string;          // Primary, default: "#2563EB"
  backgroundColor: string;     // Background, default: "#FFFFFF"
  fontFamily: string;          // Font, default: "Inter"
  
  durationPerProduct: number;  // Seconds, default: 4
  loop: boolean;               // Repeat? default: false
  
  musicUrl?: string;           // Background music
  musicVolume: number;         // 0-1, default: 0.15 (subtle)
  showPriceBadge: boolean;     // Display price? default: true
}
```

### Animation Behavior

- **Image Enter**: Spring scale 0→1 (or slide from right)
- **Name**: Fades in simultaneously
- **Price Badge**: Colored pill with bounce spring effect
- **Description**: Staggered fade-in after name (0.5s delay)
- **CTA**: Fades in last with slight pulse
- **Exit**: Collective fade out or slide left
- **Loop**: After last product, return to first (if enabled)

### Aspect Ratios

Works well at all presets:
- **1:1**: Square (Instagram, LinkedIn)
- **9:16**: Vertical (Stories, TikTok)
- **16:9**: Widescreen (YouTube)

Image centered with padding; text overlays responsive.

### Performance

| Metric | Value |
|--------|-------|
| Render time (30s, 8 products) | ~2 min |
| Preview FPS | 30+ |
| Image format | JPEG recommended (fast) |

### Example

```json
{
  "products": [
    {
      "imageUrl": "/assets/images/water-bottle.jpg",
      "name": "Hydro Bottle Pro",
      "price": "$34.99",
      "description": "Keeps drinks cold for 24 hours",
      "ctaText": "Shop Now"
    },
    {
      "imageUrl": "/assets/images/backpack.jpg",
      "name": "TradeWalk Backpack",
      "price": "$89.99",
      "description": "Weather-resistant, 30L capacity",
      "ctaText": "Explore"
    }
  ],
  "brandColor": "#FF6600",
  "durationPerProduct": 4,
  "showPriceBadge": true,
  "loop": false
}
```

### E-Commerce Integration

- **Price format**: Any string — "$9.99", "€9,99", "¥990", etc.
- **Images**: URLs from product catalogs (Shopify, Wix, custom)
- **Batch export**: Create one project per category/collection
- **Loop setting**: Enable for carousel, disable for single sequence

---

## Common Customization

### Changing Fonts

All templates use `fontFamily` property:

```typescript
// Choose from any web-safe font:
"Arial" | "Georgia" | "Times New Roman" |
"Courier New" | "Trebuchet MS" | "Verdana" |
"Comic Sans MS" | "Impact" | "Palatino" |

// Or Google Fonts (@remotion/google-fonts):
"Playfair Display" | "Syne" | "Inter" | "Roboto"
```

### Color Formats

All color properties accept:
- **Hex**: `"#FF0000"`, `"#F00"` (RGB or RGBA)
- **RGB**: `"rgb(255, 0, 0)"`
- **HSL**: `"hsl(0, 100%, 50%)"`

### Duration Control

Templates support `durationPerFrame` (seconds) or `durationInFrames` (frames):

```
durationInSeconds * fps = durationInFrames
4 seconds * 30 fps = 120 frames
```

### Audio Sync

All templates support:
- **Local files**: `/assets/audio/file.mp3`
- **Remote URLs**: `https://cdn.example.com/music.mp3` (CORS required)
- **Muting**: Set volume to `0`

---

## Creating Variations

### Via UI

1. Create project from template
2. Modify all properties in form
3. Click "Export" with different settings
4. Duplicate project → rename → modify → export again

### Via MCP/API

```
Tool: create_project
Input: {
  "templateId": "quote-card-sequence",
  "name": "Marketing Variation A",
  "inputProps": { /* custom props */ },
  "aspectRatio": "9:16"
}
```

Then call `render_project` multiple times with different codecs/qualities.

---

## Performance Benchmarks

| Template | 30s Video | Preview FPS | Memory Peak |
|----------|-----------|------------|------------|
| History Storyline | 3 min | 24-30 | 1.2 GB |
| Beat-Synced Visualizer | 5 min | 20-24 | 1.5 GB |
| Quote Cards | 2 min | 30 | 800 MB |
| Social Reel | 4 min | 24-30 | 1.1 GB |
| Product Showcase | 2 min | 30 | 900 MB |

---

## Next Steps

- **Export your video**: See [EXPORT_FORMATS.md](EXPORT_FORMATS.md)
- **Extend a template**: See [DEVELOPMENT.md](DEVELOPMENT.md)
- **Build custom template**: See [DEVELOPMENT.md#creating-custom-template](DEVELOPMENT.md)
