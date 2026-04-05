import { z } from "zod";
import {
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  spring,
  AbsoluteFill,
  Series,
  Audio,
} from "remotion";

// ─── Schema ──────────────────────────────────────────────────────

const QuoteSchema = z.object({
  text: z.string(),
  author: z.string().optional(),
});

export const QuoteCardSequenceSchema = z.object({
  quotes: z.array(QuoteSchema).min(1).default([
    { text: "The only way to do great work is to love what you do.", author: "Steve Jobs" },
    { text: "Innovation distinguishes between a leader and a follower.", author: "Steve Jobs" },
    { text: "Stay hungry, stay foolish.", author: "Steve Jobs" },
  ]),
  durationPerQuoteInFrames: z.number().min(30).default(120),
  backgroundColors: z.array(z.string()).default(["#1e293b", "#0f172a", "#1a1a2e"]),
  textColor: z.string().default("#f1f5f9"),
  accentColor: z.string().default("#f59e0b"),
  fontSizeRatio: z.number().min(0.02).max(0.1).default(0.05),
  musicUrl: z.string().optional(),
  musicVolume: z.number().min(0).max(1).default(0.2),
});

export type QuoteCardSequenceProps = z.infer<typeof QuoteCardSequenceSchema>;

// ─── Single Quote Card ───────────────────────────────────────────

const QuoteCard: React.FC<{
  quote: z.infer<typeof QuoteSchema>;
  bgColor: string;
  textColor: string;
  accentColor: string;
  fontSizeRatio: number;
}> = ({ quote, bgColor, textColor, accentColor, fontSizeRatio }) => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();

  const fadeIn = interpolate(frame, [0, 15], [0, 1], { extrapolateRight: "clamp" });
  const fadeOut = interpolate(
    frame,
    [0, 1],
    [1, 1], // placeholder — will use durationInFrames from parent
    { extrapolateRight: "clamp" },
  );

  const textSpring = spring({
    frame,
    fps,
    config: { damping: 15, stiffness: 60 },
  });

  const authorSpring = spring({
    frame: frame - 15,
    fps,
    config: { damping: 15, stiffness: 60 },
  });

  const quoteMarkScale = spring({
    frame,
    fps,
    config: { damping: 10, stiffness: 100 },
  });

  const textY = interpolate(textSpring, [0, 1], [40, 0]);
  const authorY = interpolate(authorSpring, [0, 1], [20, 0]);

  return (
    <AbsoluteFill
      style={{
        backgroundColor: bgColor,
        justifyContent: "center",
        alignItems: "center",
        opacity: fadeIn,
      }}
    >
      <div
        style={{
          maxWidth: width * 0.75,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: height * 0.03,
        }}
      >
        {/* Quotation mark */}
        <div
          style={{
            fontSize: height * 0.15,
            color: accentColor,
            opacity: 0.3,
            lineHeight: 0.8,
            transform: `scale(${quoteMarkScale})`,
            fontFamily: "Georgia, serif",
          }}
        >
          &ldquo;
        </div>

        {/* Quote text */}
        <div
          style={{
            fontSize: height * fontSizeRatio,
            color: textColor,
            textAlign: "center",
            lineHeight: 1.6,
            fontWeight: 500,
            transform: `translateY(${textY}px)`,
            fontFamily: "Georgia, serif",
          }}
        >
          {quote.text}
        </div>

        {/* Author */}
        {quote.author && (
          <div
            style={{
              fontSize: height * fontSizeRatio * 0.6,
              color: accentColor,
              fontWeight: 600,
              opacity: Math.max(0, authorSpring),
              transform: `translateY(${authorY}px)`,
              fontFamily: "sans-serif",
            }}
          >
            — {quote.author}
          </div>
        )}
      </div>
    </AbsoluteFill>
  );
};

// ─── Main Composition ────────────────────────────────────────────

export const QuoteCardSequence: React.FC<QuoteCardSequenceProps> = (props) => {
  const {
    quotes = [
      { text: "The only way to do great work is to love what you do.", author: "Steve Jobs" },
      { text: "Innovation distinguishes between a leader and a follower.", author: "Steve Jobs" },
      { text: "Stay hungry, stay foolish.", author: "Steve Jobs" },
    ],
    durationPerQuoteInFrames = 120,
    backgroundColors = ["#1e293b", "#0f172a", "#1a1a2e"],
    textColor = "#f1f5f9",
    accentColor = "#f59e0b",
    fontSizeRatio = 0.05,
    musicUrl,
    musicVolume = 0.2,
  } = props || {};

  return (
    <AbsoluteFill>
      {musicUrl && <Audio src={musicUrl} volume={musicVolume} />}

      <Series>
        {quotes.map((quote, i) => (
          <Series.Sequence key={i} durationInFrames={durationPerQuoteInFrames}>
            <QuoteCard
              quote={quote}
              bgColor={backgroundColors[i % backgroundColors.length]}
              textColor={textColor}
              accentColor={accentColor}
              fontSizeRatio={fontSizeRatio}
            />
          </Series.Sequence>
        ))}
      </Series>
    </AbsoluteFill>
  );
};
