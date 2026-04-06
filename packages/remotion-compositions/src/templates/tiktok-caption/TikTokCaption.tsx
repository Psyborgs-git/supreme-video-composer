import {
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  spring,
  AbsoluteFill,
  Sequence,
  OffthreadVideo,
  Audio,
  Img,
} from "remotion";
import type { TikTokCaptionProps, CaptionEntry, CaptionStyle } from "./schema";

// ─── Caption Word ────────────────────────────────────────────────

const CaptionWord: React.FC<{
  word: string;
  active: boolean;
  style: CaptionStyle;
  width: number;
}> = ({ word, active, style }) => {
  const color = active ? style.highlightColor : style.color;

  return (
    <span
      style={{
        color,
        transition: "color 0.05s",
        marginRight: "0.3em",
      }}
    >
      {word}
    </span>
  );
};

// ─── Single Caption Page ─────────────────────────────────────────

const CaptionPage: React.FC<{
  caption: CaptionEntry;
  style: CaptionStyle;
  width: number;
  height: number;
}> = ({ caption, style, width, height }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Spring entry animation
  const enterProgress = spring({
    frame,
    fps,
    config: { damping: 200 },
    durationInFrames: 5,
  });

  const scaleValue = interpolate(enterProgress, [0, 1], [0.8, 1]);
  const yOffset = interpolate(enterProgress, [0, 1], [50, 0]);

  // Determine which word is "active" based on frame position within the caption
  const captionDuration = caption.endFrame - caption.startFrame;
  const words = caption.text.split(/\s+/);
  const framesPerWord = captionDuration > 0 ? captionDuration / words.length : 1;
  const activeWordIndex = Math.floor(frame / framesPerWord);

  // Position
  const bottomOffset =
    style.position === "top"
      ? undefined
      : style.position === "center"
        ? height * 0.4
        : height * 0.18;
  const topOffset = style.position === "top" ? height * 0.1 : undefined;

  // Font size scaled to video width
  const fontSize = Math.min(style.fontSize, width * 0.11);

  const textStyle: React.CSSProperties = {
    fontFamily: style.fontFamily,
    fontSize,
    fontWeight: 800,
    textTransform: style.textTransform,
    textAlign: "center",
    lineHeight: 1.2,
    WebkitTextStroke: `${style.strokeWidth}px ${style.strokeColor}`,
    paintOrder: "stroke",
    whiteSpace: "pre-wrap",
    wordBreak: "break-word",
    maxWidth: width * 0.9,
  };

  return (
    <AbsoluteFill>
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          bottom: bottomOffset,
          top: topOffset,
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          transform: `scale(${scaleValue}) translateY(${yOffset}px)`,
        }}
      >
        {style.backgroundPill ? (
          <div
            style={{
              ...textStyle,
              padding: "12px 24px",
              backgroundColor: style.pillColor,
              borderRadius: 12,
            }}
          >
            {words.map((w, i) => (
              <CaptionWord
                key={i}
                word={w}
                active={i === activeWordIndex}
                style={style}
                width={width}
              />
            ))}
          </div>
        ) : (
          <div style={textStyle}>
            {words.map((w, i) => (
              <CaptionWord
                key={i}
                word={w}
                active={i === activeWordIndex}
                style={style}
                width={width}
              />
            ))}
          </div>
        )}
      </div>
    </AbsoluteFill>
  );
};

// ─── Progress Bar ────────────────────────────────────────────────

const ProgressBar: React.FC<{
  color: string;
  heightFraction: number;
  width: number;
  height: number;
}> = ({ color, heightFraction, width, height }) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const progress = frame / durationInFrames;

  return (
    <div
      style={{
        position: "absolute",
        bottom: 0,
        left: 0,
        width: width * progress,
        height: height * heightFraction,
        backgroundColor: color,
      }}
    />
  );
};

// ─── Main Composition ────────────────────────────────────────────

export const TikTokCaption: React.FC<TikTokCaptionProps> = (props) => {
  const {
    src = "",
    srcIsVideo = true,
    captions = [],
    captionStyle: styleInput,
    backgroundColor = "#000000",
    showProgressBar = false,
    progressBarColor = "#39E508",
    progressBarHeight = 0.005,
    backgroundUrl,
  } = props || {};

  const { width, height } = useVideoConfig();

  // Caption style comes from props with Zod defaults
  const style: CaptionStyle = {
    ...({
      fontFamily: "sans-serif",
      fontSize: 120,
      color: "#ffffff",
      highlightColor: "#39E508",
      strokeColor: "#000000",
      strokeWidth: 20,
      position: "bottom" as const,
      backgroundPill: false,
      pillColor: "rgba(0,0,0,0.6)",
      textTransform: "uppercase" as const,
    }),
    ...(styleInput ?? {}),
  };

  return (
    <AbsoluteFill style={{ backgroundColor }}>
      {/* Background media */}
      {src && srcIsVideo && (
        <OffthreadVideo
          src={src}
          style={{ width: "100%", height: "100%", objectFit: "cover" }}
        />
      )}
      {src && !srcIsVideo && <Audio src={src} />}
      {backgroundUrl && !srcIsVideo && (
        <Img
          src={backgroundUrl}
          style={{ width: "100%", height: "100%", objectFit: "cover" }}
        />
      )}

      {/* Caption sequences */}
      {(captions as CaptionEntry[]).map((caption, i) => {
        const durationFrames = caption.endFrame - caption.startFrame;
        if (durationFrames <= 0) return null;
        return (
          <Sequence
            key={i}
            from={caption.startFrame}
            durationInFrames={durationFrames}
          >
            <CaptionPage
              caption={caption}
              style={style}
              width={width}
              height={height}
            />
          </Sequence>
        );
      })}

      {/* Progress bar */}
      {showProgressBar && (
        <ProgressBar
          color={progressBarColor}
          heightFraction={progressBarHeight}
          width={width}
          height={height}
        />
      )}
    </AbsoluteFill>
  );
};
