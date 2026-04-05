import { z } from "zod";
import {
  AbsoluteFill,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
  Sequence,
} from "remotion";

// ── Brand Palette ────────────────────────────────────────────────────
const TERRA = "#E85D38";
const TERRA_LT = "#F47B5A";
const CREAM = "#FDF8F2";
const SAGE = "#4D9468";
const VIOLET = "#7C5CBF";
const ESPRESSO = "#3D2F24";
const MUTED = "#9C8878";
const BLUSH = "#FFF1ED";
const STONE = "#E8DDD0";

// ── Tender Lens SVG Mark ─────────────────────────────────────────────
function TenderLens({
  size = 120,
  primaryColor = TERRA,
  bgColor = BLUSH,
}: {
  size?: number;
  primaryColor?: string;
  bgColor?: string;
}) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64">
      <path
        d="M4,32 C10,15 20,7 32,7 C44,7 54,15 60,32 C54,49 44,57 32,57 C20,57 10,49 4,32 Z"
        fill={bgColor}
        stroke={primaryColor}
        strokeWidth="1.8"
      />
      <circle cx="32" cy="32" r="14" fill="none" stroke={primaryColor} strokeWidth="1.4" />
      <g stroke={primaryColor} strokeWidth="0.7" opacity="0.38">
        <line x1="32" y1="32" x2="32" y2="18" />
        <line x1="32" y1="32" x2="44.1" y2="25" />
        <line x1="32" y1="32" x2="44.1" y2="39" />
        <line x1="32" y1="32" x2="32" y2="46" />
        <line x1="32" y1="32" x2="19.9" y2="39" />
        <line x1="32" y1="32" x2="19.9" y2="25" />
      </g>
      <path
        d="M32,37 C29.8,34.8 24.5,31.6 24.5,28 C24.5,24 28.3,23 32,27 C35.7,23 39.5,24 39.5,28 C39.5,31.6 34.2,34.8 32,37 Z"
        fill={primaryColor}
      />
      <circle cx="26.2" cy="20" r="2" fill="white" opacity="0.9" />
    </svg>
  );
}

// ── SCENE 1: POV Hook (0–90f / 0–3s) ────────────────────────────────
function HookScene() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const badgeScale = spring({ frame, fps, config: { damping: 9, stiffness: 120 } });

  const fullText = "you forgot when baby last ate… again 🍼";
  const charsToShow = Math.floor(
    interpolate(frame, [12, 60], [0, fullText.length], {
      extrapolateRight: "clamp",
      extrapolateLeft: "clamp",
    })
  );
  const displayedText = fullText.slice(0, charsToShow);
  const cursorBlink = frame % 18 < 9 && frame < 65;

  const fadeOut = interpolate(frame, [78, 90], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill
      style={{
        backgroundColor: CREAM,
        alignItems: "center",
        justifyContent: "center",
        flexDirection: "column",
        gap: 40,
        padding: "0 80px",
        opacity: fadeOut,
      }}
    >
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: `radial-gradient(ellipse at 50% 35%, #fff6f2 0%, ${CREAM} 70%)`,
        }}
      />

      {/* POV badge – trending format */}
      <div
        style={{
          transform: `scale(${badgeScale})`,
          backgroundColor: TERRA,
          color: "white",
          padding: "18px 52px",
          borderRadius: 100,
          fontSize: 44,
          fontWeight: 800,
          letterSpacing: 8,
          fontFamily: "Arial Black, sans-serif",
          boxShadow: `0 8px 32px ${TERRA}55`,
          position: "relative",
          zIndex: 1,
        }}
      >
        POV
      </div>

      {/* Typewriter text */}
      <div
        style={{
          fontSize: 52,
          fontFamily: "Georgia, serif",
          fontStyle: "italic",
          color: ESPRESSO,
          textAlign: "center",
          lineHeight: 1.35,
          minHeight: 200,
          position: "relative",
          zIndex: 1,
        }}
      >
        {displayedText}
        {cursorBlink && <span style={{ borderRight: `4px solid ${TERRA}`, marginLeft: 3 }} />}
      </div>

      {/* Subtle dot pattern */}
      <div
        style={{
          position: "absolute",
          bottom: 160,
          right: 80,
          width: 120,
          height: 120,
          opacity: 0.06,
          backgroundImage: `radial-gradient(circle, ${TERRA} 2px, transparent 2px)`,
          backgroundSize: "18px 18px",
          borderRadius: 16,
        }}
      />
    </AbsoluteFill>
  );
}

// ── SCENE 2: Chaos Problem (90–210f / 3–7s) ──────────────────────────
function ProblemScene() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const bubbles = [
    { text: "2 hours ago? 🤔", left: 80, top: 280, delay: 0, rot: -6 },
    { text: "3 hours??", left: 520, top: 460, delay: 7, rot: 4 },
    {
      text: "did grandma feed her?",
      left: 50,
      top: 640,
      delay: 14,
      rot: -3,
    },
    { text: "formula or breast?", left: 460, top: 820, delay: 21, rot: 6 },
    {
      text: "was it a good nap? 😩",
      left: 60,
      top: 1000,
      delay: 28,
      rot: -5,
    },
    { text: "growth spurt??", left: 420, top: 1180, delay: 35, rot: 5 },
    { text: "SEND HELP 😭", left: 240, top: 1360, delay: 42, rot: -4 },
  ];

  const titleOpacity = spring({ frame, fps, config: { damping: 10, stiffness: 80 } });
  const fadeOut = interpolate(frame, [105, 120], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill style={{ background: "#fff5f3", opacity: fadeOut }}>
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: "radial-gradient(ellipse at center, #fff3f0 0%, #ffe5dc 100%)",
        }}
      />

      {/* Header */}
      <div
        style={{
          position: "absolute",
          top: 140,
          left: 0,
          right: 0,
          textAlign: "center",
          fontSize: 48,
          fontWeight: 900,
          fontFamily: "Arial Black, sans-serif",
          color: TERRA,
          opacity: titleOpacity,
          letterSpacing: -1,
        }}
      >
        The mental load is REAL
      </div>

      {/* Chaos bubbles */}
      {bubbles.map((b, i) => {
        const appear = spring({
          frame: Math.max(0, frame - b.delay),
          fps,
          config: { damping: 6, stiffness: 130 },
        });
        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: b.left,
              top: b.top,
              transform: `scale(${appear}) rotate(${b.rot}deg)`,
              backgroundColor: "white",
              padding: "18px 28px",
              borderRadius: 20,
              boxShadow: "0 6px 24px rgba(61,47,36,0.13)",
              fontSize: 32,
              fontFamily: "Arial, sans-serif",
              fontWeight: 700,
              color: ESPRESSO,
              border: `2px solid ${STONE}`,
              whiteSpace: "nowrap",
            }}
          >
            {b.text}
          </div>
        );
      })}
    </AbsoluteFill>
  );
}

// ── SCENE 3: BabyLens Reveal (210–360f / 7–12s) ──────────────────────
function RevealScene() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Beat-drop style: logo slams in
  const logoSpring = spring({
    frame,
    fps,
    config: { damping: 6, stiffness: 90, mass: 0.8 },
  });
  const logoY = interpolate(logoSpring, [0, 1], [80, 0]);

  const wordmarkOpacity = interpolate(frame, [18, 40], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const wordmarkY = interpolate(frame, [18, 40], [24, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const tagOpacity = interpolate(frame, [42, 65], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const tagY = interpolate(frame, [42, 65], [20, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const pillOpacity = interpolate(frame, [72, 95], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Ripple ring
  const ringScale = interpolate(frame, [0, 80], [1, 2.2], {
    extrapolateRight: "clamp",
  });
  const ringOpacity = interpolate(frame, [0, 80], [0.5, 0], {
    extrapolateRight: "clamp",
  });

  const fadeOut = interpolate(frame, [138, 150], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill
      style={{
        backgroundColor: CREAM,
        alignItems: "center",
        justifyContent: "center",
        flexDirection: "column",
        gap: 28,
        opacity: fadeOut,
      }}
    >
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: `radial-gradient(ellipse at 50% 42%, ${BLUSH} 0%, ${CREAM} 68%)`,
        }}
      />

      {/* Logo + ripple */}
      <div
        style={{
          position: "relative",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          transform: `translateY(${logoY}px) scale(${logoSpring})`,
        }}
      >
        <div
          style={{
            position: "absolute",
            width: 220,
            height: 220,
            borderRadius: "50%",
            border: `3px solid ${TERRA}`,
            transform: `scale(${ringScale})`,
            opacity: ringOpacity,
          }}
        />
        <TenderLens size={180} />
      </div>

      {/* Wordmark */}
      <div style={{ opacity: wordmarkOpacity, transform: `translateY(${wordmarkY}px)`, display: "flex", alignItems: "baseline", gap: 10 }}>
        <span
          style={{
            fontFamily: "Georgia, serif",
            fontStyle: "italic",
            fontSize: 88,
            color: ESPRESSO,
            lineHeight: 1,
          }}
        >
          Baby
        </span>
        <span
          style={{
            fontFamily: "Arial, sans-serif",
            fontSize: 36,
            fontWeight: 700,
            letterSpacing: 10,
            color: ESPRESSO,
          }}
        >
          LENS
        </span>
      </div>

      {/* Tagline */}
      <div
        style={{
          opacity: tagOpacity,
          transform: `translateY(${tagY}px)`,
          fontSize: 34,
          fontFamily: "Georgia, serif",
          fontStyle: "italic",
          color: MUTED,
          textAlign: "center",
          lineHeight: 1.5,
          maxWidth: 760,
        }}
      >
        Every moment, captured with love.
      </div>

      {/* Pill badge */}
      <div
        style={{
          opacity: pillOpacity,
          backgroundColor: TERRA + "18",
          border: `2px solid ${TERRA}33`,
          padding: "20px 48px",
          borderRadius: 100,
          fontSize: 30,
          fontFamily: "Arial, sans-serif",
          fontWeight: 700,
          color: TERRA,
          textAlign: "center",
          marginTop: 16,
        }}
      >
        ✨ The app that finally has your back
      </div>
    </AbsoluteFill>
  );
}

// ── Feature Card ─────────────────────────────────────────────────────
function FeatureCard({
  icon,
  title,
  body,
  accent,
  frame,
  fps,
}: {
  icon: string;
  title: string;
  body: string;
  accent: string;
  frame: number;
  fps: number;
}) {
  const slideIn = spring({
    frame,
    fps,
    config: { damping: 14, stiffness: 110 },
  });
  const tx = interpolate(slideIn, [0, 1], [340, 0]);
  const opacity = interpolate(slideIn, [0, 0.25], [0, 1]);

  // Stat badge animates in slightly later
  const statScale = spring({
    frame: Math.max(0, frame - 25),
    fps,
    config: { damping: 8, stiffness: 120 },
  });

  return (
    <div
      style={{
        transform: `translateX(${tx}px)`,
        opacity,
        backgroundColor: "white",
        borderRadius: 32,
        padding: "52px 56px",
        width: 920,
        boxShadow: "0 12px 48px rgba(61,47,36,0.10)",
        border: `2px solid ${STONE}`,
        display: "flex",
        flexDirection: "column",
        gap: 28,
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* Accent blob */}
      <div
        style={{
          position: "absolute",
          top: -60,
          right: -60,
          width: 200,
          height: 200,
          borderRadius: "50%",
          backgroundColor: accent + "20",
        }}
      />

      <div style={{ fontSize: 80, lineHeight: 1 }}>{icon}</div>

      <div
        style={{
          fontSize: 50,
          fontWeight: 800,
          fontFamily: "Arial Black, sans-serif",
          color: ESPRESSO,
          lineHeight: 1.15,
          letterSpacing: -1,
        }}
      >
        {title}
      </div>

      <div
        style={{
          fontSize: 32,
          fontFamily: "Arial, sans-serif",
          color: MUTED,
          lineHeight: 1.65,
        }}
      >
        {body}
      </div>

      <div
        style={{
          transform: `scale(${statScale})`,
          alignSelf: "flex-start",
          backgroundColor: accent + "18",
          padding: "14px 32px",
          borderRadius: 100,
          color: accent,
          fontWeight: 800,
          fontSize: 26,
          fontFamily: "Arial, sans-serif",
          border: `1.5px solid ${accent}33`,
        }}
      >
        Free forever ✓
      </div>
    </div>
  );
}

// ── SCENE 4: Features Carousel (360–660f / 12–22s) ───────────────────
function FeaturesScene() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const features = [
    {
      icon: "🍼",
      title: "Feed Tracker",
      body: "Log every feed in one tap. Auto-calculates next feed time based on your baby's real pattern.",
      accent: TERRA,
    },
    {
      icon: "🌙",
      title: "Sleep Tracker",
      body: "Track naps & night sleep. Get smart alerts before the overtired meltdown hits.",
      accent: VIOLET,
    },
    {
      icon: "🤖",
      title: "AI Copilot",
      body: "Ask anything. Get warm, expert-backed answers based on your baby's actual data.",
      accent: SAGE,
    },
  ];

  const CARD_DURATION = 100;
  const currentIdx = Math.min(Math.floor(frame / CARD_DURATION), features.length - 1);
  const localFrame = frame - currentIdx * CARD_DURATION;

  const headerOpacity = spring({ frame, fps, config: { damping: 12, stiffness: 80 } });

  return (
    <AbsoluteFill
      style={{
        backgroundColor: CREAM,
        alignItems: "center",
        justifyContent: "center",
        flexDirection: "column",
        gap: 48,
        padding: "0 80px",
      }}
    >
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: `radial-gradient(ellipse at 50% 18%, ${BLUSH} 0%, ${CREAM} 60%)`,
        }}
      />

      {/* Section label */}
      <div
        style={{
          opacity: headerOpacity,
          alignSelf: "flex-start",
          fontSize: 28,
          fontWeight: 700,
          fontFamily: "Arial, sans-serif",
          color: MUTED,
          letterSpacing: 4,
          textTransform: "uppercase",
          display: "flex",
          alignItems: "center",
          gap: 12,
          position: "relative",
          zIndex: 1,
        }}
      >
        <div style={{ width: 32, height: 3, borderRadius: 2, backgroundColor: TERRA }} />
        What you get
      </div>

      {/* Feature card */}
      <div
        style={{
          position: "relative",
          zIndex: 1,
          width: "100%",
          display: "flex",
          justifyContent: "center",
        }}
      >
        {features.map((f, i) =>
          i === currentIdx ? (
            <FeatureCard
              key={i}
              icon={f.icon}
              title={f.title}
              body={f.body}
              accent={f.accent}
              frame={localFrame}
              fps={fps}
            />
          ) : null
        )}
      </div>

      {/* Progress dots */}
      <div style={{ display: "flex", gap: 16, position: "relative", zIndex: 1 }}>
        {features.map((_, i) => {
          const isActive = i === currentIdx;
          const dotW = isActive ? 52 : 16;
          return (
            <div
              key={i}
              style={{
                width: dotW,
                height: 16,
                borderRadius: 100,
                backgroundColor: isActive ? TERRA : STONE,
                transition: "width 0.3s",
              }}
            />
          );
        })}
      </div>

      {/* Swipe hint on first card */}
      {currentIdx === 0 && (
        <div
          style={{
            opacity: interpolate(localFrame, [60, 80], [1, 0], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
            }),
            position: "absolute",
            bottom: 120,
            fontSize: 26,
            fontFamily: "Arial, sans-serif",
            color: MUTED,
            display: "flex",
            alignItems: "center",
            gap: 10,
          }}
        >
          swipe to explore →
        </div>
      )}
    </AbsoluteFill>
  );
}

// ── Floating Heart ────────────────────────────────────────────────────
function FloatingHeart({
  delay,
  leftPx,
  sizePx,
}: {
  delay: number;
  leftPx: number;
  sizePx: number;
}) {
  const frame = useCurrentFrame();
  const localF = Math.max(0, frame - delay);
  const progress = interpolate(localF, [0, 130], [0, 1], {
    extrapolateRight: "clamp",
  });
  const ty = interpolate(progress, [0, 1], [0, -700]);
  const opacity = interpolate(progress, [0, 0.08, 0.75, 1], [0, 1, 1, 0]);
  const scale = interpolate(progress, [0, 0.08, 0.5, 1], [0, 1.4, 1, 0.6]);
  const wobble = Math.sin(localF * 0.12) * 18;

  return (
    <div
      style={{
        position: "absolute",
        bottom: 220,
        left: leftPx,
        transform: `translateY(${ty}px) translateX(${wobble}px) scale(${scale})`,
        opacity,
        fontSize: sizePx,
        pointerEvents: "none",
        userSelect: "none",
      }}
    >
      ❤️
    </div>
  );
}

// ── SCENE 5: CTA (660–900f / 22–30s) ─────────────────────────────────
function CTAScene() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const headerSpring = spring({ frame, fps, config: { damping: 8, stiffness: 70 } });
  const headerY = interpolate(headerSpring, [0, 1], [60, 0]);

  const btnSpring = spring({
    frame: Math.max(0, frame - 28),
    fps,
    config: { damping: 8, stiffness: 100 },
  });
  // Gentle pulse after button appears
  const btnPulse = frame > 60 ? 1 + Math.sin(frame * 0.15) * 0.022 : 1;

  const subOpacity = interpolate(frame, [55, 80], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const tagOpacity = interpolate(frame, [110, 140], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const footerOpacity = interpolate(frame, [150, 180], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const hearts = [
    { delay: 70, leftPx: 130, sizePx: 44 },
    { delay: 85, leftPx: 460, sizePx: 60 },
    { delay: 100, leftPx: 820, sizePx: 38 },
    { delay: 120, leftPx: 300, sizePx: 50 },
    { delay: 140, leftPx: 660, sizePx: 46 },
    { delay: 160, leftPx: 900, sizePx: 36 },
  ];

  return (
    <AbsoluteFill
      style={{
        backgroundColor: TERRA,
        alignItems: "center",
        justifyContent: "center",
        flexDirection: "column",
        gap: 44,
        padding: "0 80px",
      }}
    >
      {/* Background glow */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: `radial-gradient(ellipse at 50% 38%, ${TERRA_LT} 0%, ${TERRA} 72%)`,
        }}
      />

      {/* Floating hearts */}
      {hearts.map((h, i) => (
        <FloatingHeart key={i} {...h} />
      ))}

      {/* Mini logo on CTA */}
      <div
        style={{
          opacity: interpolate(frame, [0, 20], [0, 1], { extrapolateRight: "clamp" }),
          position: "relative",
          zIndex: 1,
        }}
      >
        <TenderLens
          size={100}
          primaryColor="white"
          bgColor="rgba(255,255,255,0.18)"
        />
      </div>

      {/* Main headline */}
      <div
        style={{
          transform: `translateY(${headerY}px) scale(${headerSpring})`,
          textAlign: "center",
          color: "white",
          fontSize: 74,
          fontFamily: "Georgia, serif",
          fontStyle: "italic",
          lineHeight: 1.2,
          position: "relative",
          zIndex: 1,
        }}
      >
        Ready to feel like a <br />
        rockstar parent?
      </div>

      {/* CTA Button */}
      <div
        style={{
          transform: `scale(${btnSpring * btnPulse})`,
          backgroundColor: "white",
          color: TERRA,
          padding: "36px 80px",
          borderRadius: 100,
          fontSize: 42,
          fontWeight: 900,
          fontFamily: "Arial Black, sans-serif",
          boxShadow: "0 12px 48px rgba(0,0,0,0.22)",
          position: "relative",
          zIndex: 1,
          letterSpacing: -0.5,
        }}
      >
        Download Free 🍼
      </div>

      {/* Sub-copy */}
      <div
        style={{
          opacity: subOpacity,
          color: "rgba(255,255,255,0.88)",
          fontSize: 30,
          fontFamily: "Arial, sans-serif",
          textAlign: "center",
          position: "relative",
          zIndex: 1,
          lineHeight: 1.6,
        }}
      >
        iOS & Android · No credit card ever
      </div>

      {/* Social proof */}
      <div
        style={{
          opacity: tagOpacity,
          backgroundColor: "rgba(255,255,255,0.18)",
          padding: "18px 44px",
          borderRadius: 20,
          color: "white",
          fontSize: 28,
          fontFamily: "Arial, sans-serif",
          fontWeight: 600,
          position: "relative",
          zIndex: 1,
          textAlign: "center",
        }}
      >
        ⭐ Loved by 10,000+ parents worldwide
      </div>

      {/* Hashtag footer */}
      <div
        style={{
          opacity: footerOpacity,
          position: "absolute",
          bottom: 90,
          left: 0,
          right: 0,
          textAlign: "center",
          color: "rgba(255,255,255,0.55)",
          fontSize: 24,
          fontFamily: "Arial, sans-serif",
          letterSpacing: 2,
        }}
      >
        @babylens.app · #BabyLens #MomLife #NewParent #ParentingApp
      </div>
    </AbsoluteFill>
  );
}

// ── ROOT COMPOSITION ─────────────────────────────────────────────────
export function BabyLens() {
  return (
    <AbsoluteFill style={{ backgroundColor: CREAM }}>
      {/* Scene 1: POV Hook — 0-3s */}
      <Sequence from={0} durationInFrames={90}>
        <HookScene />
      </Sequence>

      {/* Scene 2: Chaos Problem — 3-7s */}
      <Sequence from={90} durationInFrames={120}>
        <ProblemScene />
      </Sequence>

      {/* Scene 3: BabyLens Reveal — 7-12s */}
      <Sequence from={210} durationInFrames={150}>
        <RevealScene />
      </Sequence>

      {/* Scene 4: Feature Carousel — 12-22s */}
      <Sequence from={360} durationInFrames={300}>
        <FeaturesScene />
      </Sequence>

      {/* Scene 5: CTA — 22-30s */}
      <Sequence from={660} durationInFrames={240}>
        <CTAScene />
      </Sequence>
    </AbsoluteFill>
  );
}

// ── Schema (no props needed for this static composition) ────────────────
export const BabyLensSchema = z.object({});

export type BabyLensProps = z.infer<typeof BabyLensSchema>;
