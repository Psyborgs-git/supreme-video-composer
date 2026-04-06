import {
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  spring,
  AbsoluteFill,
  Series,
  Sequence,
  Audio,
  Img,
} from "remotion";
import type { PromptToVideoProps, Scene, Card } from "./schema";

// ─── Transition helpers ──────────────────────────────────────────

function useTransition(
  type: string,
  frame: number,
  fps: number,
  durationFrames: number,
): { opacity: number; transform: string; filter: string } {
  const fadeInDuration = Math.min(15, durationFrames / 4);
  const fadeOutStart = durationFrames - fadeInDuration;

  let opacity = 1;
  let transform = "";
  let filter = "";

  switch (type) {
    case "fade":
      opacity = interpolate(frame, [0, fadeInDuration], [0, 1], {
        extrapolateRight: "clamp",
      });
      if (frame > fadeOutStart) {
        opacity = interpolate(
          frame,
          [fadeOutStart, durationFrames],
          [1, 0],
          { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
        );
      }
      break;
    case "blur": {
      const blurIn = interpolate(frame, [0, fadeInDuration], [25, 0], {
        extrapolateRight: "clamp",
      });
      filter = `blur(${blurIn}px)`;
      break;
    }
    case "zoom": {
      const scaleVal = interpolate(frame, [0, fadeInDuration], [1.3, 1], {
        extrapolateRight: "clamp",
      });
      transform = `scale(${scaleVal})`;
      break;
    }
    case "swipe": {
      const slideX = interpolate(frame, [0, fadeInDuration], [100, 0], {
        extrapolateRight: "clamp",
      });
      transform = `translateX(${slideX}%)`;
      break;
    }
    default:
      break;
  }

  return { opacity, transform, filter };
}

// ─── Title Card Component ────────────────────────────────────────

const TitleCardComponent: React.FC<{
  card: Card;
  width: number;
  height: number;
}> = ({ card, width, height }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const enterProgress = spring({
    frame,
    fps,
    config: { damping: 15, stiffness: 80 },
  });
  const scale = interpolate(enterProgress, [0, 1], [0.8, 1]);
  const yOffset = interpolate(enterProgress, [0, 1], [40, 0]);

  return (
    <AbsoluteFill
      style={{
        backgroundColor: card.backgroundColor,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flexDirection: "column",
      }}
    >
      <div
        style={{
          transform: `scale(${scale}) translateY(${yOffset}px)`,
          textAlign: "center",
          padding: width * 0.05,
        }}
      >
        <div
          style={{
            fontSize: width * 0.07,
            fontWeight: 800,
            color: card.textColor,
            fontFamily: "sans-serif",
            marginBottom: height * 0.02,
          }}
        >
          {card.text}
        </div>
        {card.subtitle && (
          <div
            style={{
              fontSize: width * 0.035,
              fontWeight: 400,
              color: card.textColor,
              opacity: 0.8,
              fontFamily: "sans-serif",
            }}
          >
            {card.subtitle}
          </div>
        )}
      </div>
    </AbsoluteFill>
  );
};

// ─── Scene Component ─────────────────────────────────────────────

const SceneComponent: React.FC<{
  scene: Scene;
  sceneIndex: number;
  totalScenes: number;
  brandColor: string;
  textColor: string;
  fontFamily: string;
  textPosition: string;
  showSceneNumbers: boolean;
  width: number;
  height: number;
}> = ({
  scene,
  sceneIndex,
  totalScenes,
  brandColor,
  textColor,
  fontFamily,
  textPosition,
  showSceneNumbers,
  width,
  height,
}) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  const transition = useTransition(
    scene.enterTransition || "fade",
    frame,
    fps,
    durationInFrames,
  );

  // Ken Burns zoom effect on background
  const zoomProgress = interpolate(frame, [0, durationInFrames], [1, 1.15], {
    extrapolateRight: "clamp",
  });

  // Text entry animation
  const textSpring = spring({
    frame: Math.max(0, frame - 10),
    fps,
    config: { damping: 15, stiffness: 60 },
  });
  const textY = interpolate(textSpring, [0, 1], [30, 0]);

  // Text position
  const textTop = textPosition === "top" ? height * 0.08 : undefined;
  const textBottom =
    textPosition === "bottom"
      ? height * 0.08
      : textPosition === "center"
        ? undefined
        : undefined;
  const textCenter = textPosition === "center";

  return (
    <AbsoluteFill
      style={{
        opacity: transition.opacity,
        transform: transition.transform,
        filter: transition.filter,
        overflow: "hidden",
        backgroundColor: "#000",
      }}
    >
      {/* Background image with Ken Burns */}
      {scene.imageUrl ? (
        <div
          style={{
            position: "absolute",
            inset: 0,
            transform: `scale(${zoomProgress})`,
            overflow: "hidden",
          }}
        >
          <Img
            src={scene.imageUrl}
            style={{
              width: "100%",
              height: "100%",
              objectFit: "cover",
            }}
          />
        </div>
      ) : (
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: `linear-gradient(135deg, ${brandColor}22, #000)`,
          }}
        />
      )}

      {/* Darkening overlay for text readability */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background:
            "linear-gradient(to top, rgba(0,0,0,0.7) 0%, rgba(0,0,0,0) 50%, rgba(0,0,0,0.3) 100%)",
        }}
      />

      {/* Text overlay */}
      <div
        style={{
          position: "absolute",
          left: width * 0.05,
          right: width * 0.05,
          top: textCenter ? 0 : textTop,
          bottom: textCenter ? 0 : textBottom,
          display: "flex",
          flexDirection: "column",
          justifyContent: textCenter ? "center" : "flex-end",
          alignItems: "center",
          transform: `translateY(${textY}px)`,
          opacity: textSpring,
        }}
      >
        {/* Scene number */}
        {showSceneNumbers && (
          <div
            style={{
              fontSize: width * 0.025,
              color: brandColor,
              fontWeight: 700,
              fontFamily,
              marginBottom: 8,
              textTransform: "uppercase",
              letterSpacing: 2,
            }}
          >
            Scene {sceneIndex + 1} / {totalScenes}
          </div>
        )}

        {/* Title */}
        {scene.title && (
          <div
            style={{
              fontSize: width * 0.06,
              fontWeight: 800,
              color: textColor,
              fontFamily,
              textAlign: "center",
              marginBottom: height * 0.01,
              textShadow: "0 2px 8px rgba(0,0,0,0.8)",
            }}
          >
            {scene.title}
          </div>
        )}

        {/* Body */}
        {scene.body && (
          <div
            style={{
              fontSize: width * 0.035,
              fontWeight: 400,
              color: textColor,
              fontFamily,
              textAlign: "center",
              opacity: 0.9,
              maxWidth: width * 0.85,
              lineHeight: 1.4,
              textShadow: "0 1px 4px rgba(0,0,0,0.8)",
            }}
          >
            {scene.body}
          </div>
        )}
      </div>
    </AbsoluteFill>
  );
};

// ─── Main Composition ────────────────────────────────────────────

export const PromptToVideo: React.FC<PromptToVideoProps> = (props) => {
  const {
    scenes = [],
    narrationUrl = "",
    backgroundMusicUrl = "",
    musicVolume = 0.3,
    titleCard,
    closingCard,
    brandColor = "#3B82F6",
    backgroundColor = "#000000",
    textColor = "#ffffff",
    fontFamily = "sans-serif",
    textPosition = "bottom",
    showSceneNumbers = false,
  } = props || {};

  const { width, height } = useVideoConfig();

  return (
    <AbsoluteFill style={{ backgroundColor }}>
      {/* Background music */}
      {backgroundMusicUrl && (
        <Audio src={backgroundMusicUrl} volume={musicVolume} />
      )}

      {/* Narration */}
      {narrationUrl && <Audio src={narrationUrl} volume={1} />}

      <Series>
        {/* Title card */}
        {titleCard && titleCard.text && (
          <Series.Sequence durationInFrames={titleCard.durationFrames}>
            <TitleCardComponent
              card={titleCard}
              width={width}
              height={height}
            />
          </Series.Sequence>
        )}

        {/* Scene sequences */}
        {(scenes as Scene[]).map((scene, i) => (
          <Series.Sequence
            key={i}
            durationInFrames={scene.durationFrames}
          >
            <SceneComponent
              scene={scene}
              sceneIndex={i}
              totalScenes={scenes.length}
              brandColor={brandColor}
              textColor={textColor}
              fontFamily={fontFamily}
              textPosition={textPosition}
              showSceneNumbers={showSceneNumbers}
              width={width}
              height={height}
            />
          </Series.Sequence>
        ))}

        {/* Closing card */}
        {closingCard && closingCard.text && (
          <Series.Sequence durationInFrames={closingCard.durationFrames}>
            <TitleCardComponent
              card={closingCard}
              width={width}
              height={height}
            />
          </Series.Sequence>
        )}
      </Series>
    </AbsoluteFill>
  );
};
