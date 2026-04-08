export const RULE_INDEX = `# Remotion MCP — Project-Based Video Creation

Create videos using multi-file React/Remotion projects.

## Available Rules

Call these tools to learn specific Remotion topics:

- **rule_react_code** — Project file structure, imports, composition exports, props
- **rule_remotion_animations** — useCurrentFrame, frame-driven animations
- **rule_remotion_timing** — interpolate, spring, Easing, spring configs
- **rule_remotion_sequencing** — Sequence, durationInFrames, scene management
- **rule_remotion_transitions** — TransitionSeries, fade, slide, wipe, flip
- **rule_remotion_text_animations** — Typewriter effect, word highlighting
- **rule_remotion_trimming** — Trim start/end of animations with Sequence

## Quick Start

1. Call **rule_react_code** for the project format reference and exact tool call shape
2. Build your project as a **files** map: { "/src/Video.tsx": "source code..." }
3. Call **create_video** with files (and optionally entryFile, title, fps, etc.)
4. For edits, call **create_video** again with only the changed files — previous files are preserved automatically

## Important Rules

1. Use standard module imports (remotion and installed @remotion/* packages are supported)
2. Entry module must export a default React component
3. You may export calculateMetadata() to derive duration/fps/dimensions from props
4. Keep video-level fallback metadata in tool params (width, height, fps, durationInFrames)
5. Every Sequence must include durationInFrames to avoid scene stacking
6. Do not use CSS animations/transitions for timing; use frame-driven Remotion APIs
7. Default quality bar unless the user explicitly asks otherwise: multi-scene structure, animated transitions, clear typography hierarchy, and purposeful motion (not static slides)
8. For edit requests, only send changed files — unchanged files are kept from the previous call
9. For edit requests, patch the existing project and keep unrelated scenes/styles unless the user asks for a full redesign
`;

export const RULE_REACT_CODE = `# Project Code Reference

## create_video — Start a new project

Only one field is required: **files**.

\`\`\`json
{
  "files": {
    "/src/Video.tsx": "import {AbsoluteFill, useCurrentFrame, interpolate} from \\\"remotion\\\";\\n\\nexport default function Video() {\\n  const frame = useCurrentFrame();\\n  const opacity = interpolate(frame, [0, 30], [0, 1], { extrapolateRight: \\\"clamp\\\" });\\n  return (\\n    <AbsoluteFill style={{backgroundColor: \\\"#0a0a0a\\\", justifyContent: \\\"center\\\", alignItems: \\\"center\\\"}}>\\n      <div style={{color: \\\"white\\\", fontSize: 72, opacity}}>Hello World</div>\\n    </AbsoluteFill>\\n  );\\n}"
  },
  "durationInFrames": 150,
  "fps": 30
}
\`\`\`

Optional fields: entryFile (default: "/src/Video.tsx"), title, durationInFrames, fps, width, height, compositionId, defaultProps, inputProps.

For follow-up edits, call **create_video** again with only the changed files — previous files are preserved automatically.

Strict contract:
- Do not send wrapper keys like \`input\`, \`project\`, \`arguments\`, \`params\`, \`payload\`
- Do not send legacy aliases like \`code\`, \`jsx\`, \`tsx\`, \`source\`, \`fileMap\`, \`projectFiles\`
- The \`files\` field must be a JSON string when talking to clients that cannot send native objects

## Supported Imports

Use normal imports inside files:
- remotion
- any @remotion/* package installed in this MCP app
- any other npm package installed in this MCP app

You can also import other files from your own files map using relative imports.

## Entry File Contract

The entry file must export a default React component:

\`\`\`tsx
// /src/Video.tsx
import {AbsoluteFill, useCurrentFrame, interpolate} from "remotion";

export default function Video() {
  const frame = useCurrentFrame();
  const opacity = interpolate(frame, [0, 20], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill style={{backgroundColor: "#0a0a0a", justifyContent: "center", alignItems: "center"}}>
      <div style={{color: "white", fontSize: 72, opacity}}>Hello World</div>
    </AbsoluteFill>
  );
}
\`\`\`

## Optional calculateMetadata

You may export calculateMetadata() from the entry file to derive width/height/fps/duration from props.

\`\`\`tsx
export const calculateMetadata = ({props}) => {
  const sceneCount = Array.isArray(props.scenes) ? props.scenes.length : 1;
  return {
    durationInFrames: Math.max(60, sceneCount * 90),
    fps: 30,
  };
};
\`\`\`

## Multi-file Example

\`\`\`tsx
// /src/Video.tsx
import {AbsoluteFill} from "remotion";
import {Title} from "./components/Title";

export default function Video(props) {
  return (
    <AbsoluteFill style={{backgroundColor: "black", justifyContent: "center", alignItems: "center"}}>
      <Title text={props.title} />
    </AbsoluteFill>
  );
}

// /src/components/Title.tsx
export function Title({text}) {
  return <div style={{color: "white", fontSize: 72}}>{text}</div>;
}
\`\`\`

## Scene Management (Critical)

Every Sequence must have durationInFrames to avoid scene overlap:

\`\`\`tsx
<Sequence from={0} durationInFrames={60}><Scene1 /></Sequence>
<Sequence from={60} durationInFrames={60}><Scene2 /></Sequence>
\`\`\`

## Common Pitfalls

1. Missing default export in entry file
2. Importing unsupported npm packages
3. Forgetting durationInFrames on Sequence
4. Using CSS transitions instead of frame-driven Remotion logic
5. Returning invalid metadata values (non-positive width/height/fps/duration)

## Default Quality Bar

Unless the user explicitly asks for minimal output:
1. Use at least 3 scenes with intentional progression
2. Add at least one transition between scenes
3. Animate 2+ visual properties per scene (for example: opacity + translateY)
4. Include text hierarchy (headline, supporting line, optional accent)
5. Avoid flat placeholder slides and static centered text-only layouts
6. Vary visual direction (palette, layout rhythm, typography scale) across unrelated requests instead of reusing one template
7. For modification requests, preserve the existing structure and only change what the user asked for
`;

export const RULE_REMOTION_ANIMATIONS = `# Remotion Animations

All animations MUST be driven by useCurrentFrame().
CSS transitions and CSS animations are FORBIDDEN — they will not render correctly.

## Basic fade in
\`\`\`jsx
const frame = useCurrentFrame();
const { fps } = useVideoConfig();
const opacity = interpolate(frame, [0, 2 * fps], [0, 1], { extrapolateRight: "clamp" });

return (
  <AbsoluteFill style={{ justifyContent: "center", alignItems: "center" }}>
    <div style={{ opacity, color: "#fff", fontSize: 64 }}>Hello World!</div>
  </AbsoluteFill>
);
\`\`\`

## Key principles
- useCurrentFrame() returns the current frame number (integer, starts at 0)
- useVideoConfig() returns { width, height, fps, durationInFrames }
- Write timing in seconds: multiply by fps (e.g. 2 * fps = 2 seconds)
- Always clamp with { extrapolateRight: "clamp", extrapolateLeft: "clamp" }
- Never use CSS transition, animation, or @keyframes
`;

export const RULE_REMOTION_TIMING = `# Remotion Timing — interpolate, spring, Easing

## interpolate
Maps a value from one range to another.
\`\`\`jsx
const opacity = interpolate(frame, [0, 100], [0, 1]);
\`\`\`

Clamping (recommended):
\`\`\`jsx
const opacity = interpolate(frame, [0, 100], [0, 1], {
  extrapolateRight: "clamp", extrapolateLeft: "clamp",
});
\`\`\`

## spring
Physics-based animation. Goes from 0 to 1 with natural motion.
\`\`\`jsx
const frame = useCurrentFrame();
const { fps } = useVideoConfig();
const scale = spring({ frame, fps });
\`\`\`

### Spring configs
- Default: { mass: 1, damping: 10, stiffness: 100 } (slight bounce)
- Smooth: { damping: 200 }
- Snappy: { damping: 20, stiffness: 200 }
- Bouncy: { damping: 8 }
- Heavy: { damping: 15, stiffness: 80, mass: 2 }

### Delay
\`\`\`jsx
const entrance = spring({ frame, fps, delay: 20 });
\`\`\`

### Fixed duration
\`\`\`jsx
const s = spring({ frame, fps, durationInFrames: 40 });
\`\`\`

### Combining spring with interpolate
\`\`\`jsx
const progress = spring({ frame, fps });
const rotation = interpolate(progress, [0, 1], [0, 360]);
\`\`\`

### Enter + exit
\`\`\`jsx
const frame = useCurrentFrame();
const { fps, durationInFrames } = useVideoConfig();
const enter = spring({ frame, fps });
const exit = spring({ frame, fps, delay: durationInFrames - fps, durationInFrames: fps });
const scale = enter - exit;
\`\`\`

## Easing
\`\`\`jsx
const value = interpolate(frame, [0, 100], [0, 1], {
  easing: Easing.inOut(Easing.quad),
  extrapolateLeft: "clamp", extrapolateRight: "clamp",
});
\`\`\`

Convexities: Easing.in, Easing.out, Easing.inOut
Curves: Easing.quad, Easing.sin, Easing.exp, Easing.circle
Bezier: Easing.bezier(0.8, 0.22, 0.96, 0.65)
`;

export const RULE_REMOTION_SEQUENCING = `# Remotion Sequencing — Sequence, durationInFrames

## CRITICAL: Always set durationInFrames on Sequence

Sequence uses absolute positioning (AbsoluteFill) by default.
Without durationInFrames, scenes STACK ON TOP OF EACH OTHER and never unmount.

### WRONG — all scenes visible at once, overlapping:
\`\`\`jsx
<Sequence from={0}><Scene1 /></Sequence>
<Sequence from={60}><Scene2 /></Sequence>
\`\`\`

### CORRECT — each scene appears then disappears:
\`\`\`jsx
<Sequence from={0} durationInFrames={60}><Scene1 /></Sequence>
<Sequence from={60} durationInFrames={60}><Scene2 /></Sequence>
\`\`\`

## Full example
\`\`\`jsx
const { fps } = useVideoConfig();

return (
  <AbsoluteFill style={{ backgroundColor: "#0a0a0a" }}>
    <Sequence from={0} durationInFrames={2 * fps}>
      <AbsoluteFill style={{ justifyContent: "center", alignItems: "center" }}>
        <div style={{ color: "#fff", fontSize: 48 }}>First Scene</div>
      </AbsoluteFill>
    </Sequence>
    <Sequence from={2 * fps} durationInFrames={2 * fps}>
      <AbsoluteFill style={{ justifyContent: "center", alignItems: "center" }}>
        <div style={{ color: "#fff", fontSize: 48 }}>Second Scene</div>
      </AbsoluteFill>
    </Sequence>
  </AbsoluteFill>
);
\`\`\`

## layout="none" — for overlays within one scene
Use layout="none" ONLY when you want elements to layer on purpose
(e.g. a subtitle on top of a background). It removes the AbsoluteFill wrapper.
\`\`\`jsx
<Sequence from={0} durationInFrames={120}>
  <AbsoluteFill style={{ backgroundColor: "#000" }}>
    <div style={{ color: "#fff", fontSize: 72 }}>Main Title</div>
  </AbsoluteFill>
</Sequence>
<Sequence from={30} durationInFrames={90} layout="none">
  <div style={{ position: "absolute", bottom: 40, width: "100%", textAlign: "center", color: "#aaa" }}>
    Subtitle overlay
  </div>
</Sequence>
\`\`\`

## Frame references inside Sequence
useCurrentFrame() returns the LOCAL frame (starts at 0 inside each Sequence, not the global position).

## Nested Sequences
\`\`\`jsx
return (
  <Sequence from={0} durationInFrames={120}>
    <AbsoluteFill style={{ backgroundColor: "#000" }} />
    <Sequence from={15} durationInFrames={90} layout="none">
      <div style={{ color: "#fff", position: "absolute", top: "30%", width: "100%", textAlign: "center", fontSize: 64 }}>Title</div>
    </Sequence>
    <Sequence from={45} durationInFrames={60} layout="none">
      <div style={{ color: "#aaa", position: "absolute", top: "55%", width: "100%", textAlign: "center", fontSize: 32 }}>Subtitle</div>
    </Sequence>
  </Sequence>
);
\`\`\`
`;

export const RULE_REMOTION_TRANSITIONS = `# Remotion Transitions — TransitionSeries

TransitionSeries is the BEST way to build multi-scene videos.
It handles scene switching automatically — no overlapping, no manual durationInFrames math.

## Correct imports (important)
\`\`\`tsx
import {TransitionSeries, linearTiming, springTiming} from "@remotion/transitions";
import {fade} from "@remotion/transitions/fade";
import {slide} from "@remotion/transitions/slide";
import {wipe} from "@remotion/transitions/wipe";
import {flip} from "@remotion/transitions/flip";
\`\`\`

Do NOT import \`TransitionSeries\` from \`remotion\`.

## Basic usage
\`\`\`jsx
return (
  <TransitionSeries>
    <TransitionSeries.Sequence durationInFrames={60}>
      <AbsoluteFill style={{ backgroundColor: "#667eea", justifyContent: "center", alignItems: "center" }}>
        <div style={{ color: "#fff", fontSize: 48 }}>Scene A</div>
      </AbsoluteFill>
    </TransitionSeries.Sequence>
    <TransitionSeries.Transition
      presentation={fade()}
      timing={linearTiming({ durationInFrames: 15 })}
    />
    <TransitionSeries.Sequence durationInFrames={60}>
      <AbsoluteFill style={{ backgroundColor: "#764ba2", justifyContent: "center", alignItems: "center" }}>
        <div style={{ color: "#fff", fontSize: 48 }}>Scene B</div>
      </AbsoluteFill>
    </TransitionSeries.Sequence>
  </TransitionSeries>
);
\`\`\`

## Available transitions
- fade()
- slide({ direction: "from-left" })
- wipe({ direction: "from-right" })
- flip({ direction: "from-top" })

Directions: "from-left", "from-right", "from-top", "from-bottom"

## Timing
- linearTiming({ durationInFrames: 20 })
- springTiming({ config: { damping: 200 }, durationInFrames: 25 })

## Duration calculation
Transitions OVERLAP adjacent scenes. Total = sum of sequences - sum of transitions.
Example: two 60-frame scenes + one 15-frame transition = 105 frames total.

## Many scenes with transitions
\`\`\`jsx
const scenes = [
  { bg: "#667eea", text: "Introduction" },
  { bg: "#764ba2", text: "Features" },
  { bg: "#f093fb", text: "Conclusion" },
];

return (
  <TransitionSeries>
    {scenes.flatMap((scene, i) => {
      const seq = (
        <TransitionSeries.Sequence key={"s" + i} durationInFrames={90}>
          <AbsoluteFill style={{ backgroundColor: scene.bg, justifyContent: "center", alignItems: "center" }}>
            <div style={{ color: "#fff", fontSize: 64, fontWeight: 700 }}>{scene.text}</div>
          </AbsoluteFill>
        </TransitionSeries.Sequence>
      );
      if (i === scenes.length - 1) return [seq];
      return [
        seq,
        <TransitionSeries.Transition
          key={"t" + i}
          presentation={fade()}
          timing={linearTiming({ durationInFrames: 20 })}
        />,
      ];
    })}
  </TransitionSeries>
);
\`\`\`
`;

export const RULE_REMOTION_TEXT_ANIMATIONS = `# Remotion Text Animations

## Typewriter effect
Use string slicing driven by useCurrentFrame(). Never use per-character opacity.

\`\`\`jsx
const frame = useCurrentFrame();
const FULL_TEXT = "From prompt to motion graphics. This is Remotion.";
const CHAR_FRAMES = 2;

const typedChars = Math.min(FULL_TEXT.length, Math.floor(frame / CHAR_FRAMES));
const typedText = FULL_TEXT.slice(0, typedChars);

// Blinking cursor
const cursorOpacity = interpolate(frame % 16, [0, 8, 16], [1, 0, 1], {
  extrapolateLeft: "clamp", extrapolateRight: "clamp",
});

return (
  <AbsoluteFill style={{ backgroundColor: "#fff", alignItems: "center", justifyContent: "center" }}>
    <div style={{ color: "#000", fontSize: 72, fontWeight: 700, fontFamily: "sans-serif" }}>
      <span>{typedText}</span>
      <span style={{ opacity: cursorOpacity }}>{"▌"}</span>
    </div>
  </AbsoluteFill>
);
\`\`\`

## Word highlighting
Animate a highlight wipe behind a word using spring:

\`\`\`jsx
const frame = useCurrentFrame();
const { fps } = useVideoConfig();
const scaleX = Math.min(1, spring({ fps, frame, config: { damping: 200 }, delay: 30, durationInFrames: 18 }));

return (
  <AbsoluteFill style={{ backgroundColor: "#fff", alignItems: "center", justifyContent: "center" }}>
    <div style={{ color: "#000", fontSize: 72, fontWeight: 700 }}>
      <span>This is </span>
      <span style={{ position: "relative", display: "inline-block" }}>
        <span style={{
          position: "absolute", left: 0, right: 0, top: "50%",
          height: "1.05em", transform: \`translateY(-50%) scaleX(\${scaleX})\`,
          transformOrigin: "left center", backgroundColor: "#A7C7E7",
          borderRadius: "0.18em", zIndex: 0,
        }} />
        <span style={{ position: "relative", zIndex: 1 }}>Remotion</span>
      </span>
      <span>.</span>
    </div>
  </AbsoluteFill>
);
\`\`\`
`;

export const RULE_REMOTION_TRIMMING = `# Remotion Trimming — cut start or end

## Trim the beginning
Negative "from" on Sequence skips the first N frames:
\`\`\`jsx
const { fps } = useVideoConfig();
return (
  <Sequence from={-0.5 * fps} durationInFrames={2 * fps}>
    <MyContent />
  </Sequence>
);
\`\`\`

## Trim the end
durationInFrames unmounts after N frames:
\`\`\`jsx
return (
  <Sequence durationInFrames={1.5 * fps}>
    <MyContent />
  </Sequence>
);
\`\`\`

## Trim and delay
Nest sequences: outer delays, inner trims:
\`\`\`jsx
return (
  <Sequence from={30} durationInFrames={60}>
    <Sequence from={-15}>
      <MyContent />
    </Sequence>
  </Sequence>
);
\`\`\`
`;
