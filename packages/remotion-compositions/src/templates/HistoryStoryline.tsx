import { z } from "zod";
import {
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  spring,
  Img,
  Sequence,
  Series,
  Audio,
  AbsoluteFill,
} from "remotion";

// ─── Schema ──────────────────────────────────────────────────────

const EventSchema = z.object({
  year: z.string(),
  title: z.string(),
  description: z.string(),
  imageUrl: z.string().optional(),
});

export const HistoryStorylineSchema = z.object({
  title: z.string().default("History Timeline"),
  events: z.array(EventSchema).min(1).default([
    {
      year: "1969",
      title: "Moon Landing",
      description: "Apollo 11 lands on the Moon",
    },
    {
      year: "1989",
      title: "Fall of Berlin Wall",
      description: "The Berlin Wall comes down",
    },
    {
      year: "2007",
      title: "First iPhone",
      description: "Apple introduces the iPhone",
    },
  ]),
  durationPerEventInFrames: z.number().min(30).default(150),
  transitionDurationInFrames: z.number().min(10).default(30),
  backgroundColor: z.string().default("#0f172a"),
  accentColor: z.string().default("#3b82f6"),
  textColor: z.string().default("#f8fafc"),
  musicUrl: z.string().optional(),
  musicVolume: z.number().min(0).max(1).default(0.3),
});

export type HistoryStorylineProps = z.infer<typeof HistoryStorylineSchema>;

// ─── Event Card ──────────────────────────────────────────────────

const EventCard: React.FC<{
  event: z.infer<typeof EventSchema>;
  accentColor: string;
  textColor: string;
}> = ({ event, accentColor, textColor }) => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();

  const slideIn = spring({ frame, fps, config: { damping: 15, stiffness: 80 } });
  const fadeIn = interpolate(frame, [0, 20], [0, 1], { extrapolateRight: "clamp" });

  const yearScale = spring({
    frame,
    fps,
    config: { damping: 12, stiffness: 100 },
    delay: 5,
  });

  const titleOpacity = interpolate(frame, [10, 30], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const descOpacity = interpolate(frame, [20, 40], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const titleY = interpolate(frame, [10, 30], [30, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const descY = interpolate(frame, [20, 40], [20, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill
      style={{
        justifyContent: "center",
        alignItems: "center",
        opacity: fadeIn,
      }}
    >
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: height * 0.03,
          transform: `translateX(${interpolate(slideIn, [0, 1], [width * 0.3, 0])}px)`,
        }}
      >
        {/* Year badge */}
        <div
          style={{
            fontSize: height * 0.12,
            fontWeight: 900,
            color: accentColor,
            transform: `scale(${yearScale})`,
            fontFamily: "sans-serif",
          }}
        >
          {event.year}
        </div>

        {/* Title */}
        <div
          style={{
            fontSize: height * 0.06,
            fontWeight: 700,
            color: textColor,
            opacity: titleOpacity,
            transform: `translateY(${titleY}px)`,
            textAlign: "center",
            maxWidth: width * 0.8,
            fontFamily: "sans-serif",
          }}
        >
          {event.title}
        </div>

        {/* Description */}
        <div
          style={{
            fontSize: height * 0.03,
            color: textColor,
            opacity: descOpacity,
            transform: `translateY(${descY}px)`,
            textAlign: "center",
            maxWidth: width * 0.6,
            lineHeight: 1.5,
            fontFamily: "sans-serif",
          }}
        >
          {event.description}
        </div>

        {/* Image */}
        {event.imageUrl && (
          <Img
            src={event.imageUrl}
            style={{
              width: width * 0.4,
              height: height * 0.3,
              objectFit: "cover",
              borderRadius: 12,
              opacity: descOpacity,
            }}
          />
        )}
      </div>
    </AbsoluteFill>
  );
};

// ─── Title Card ──────────────────────────────────────────────────

const TitleCard: React.FC<{
  title: string;
  accentColor: string;
  textColor: string;
}> = ({ title, accentColor, textColor }) => {
  const frame = useCurrentFrame();
  const { fps, height } = useVideoConfig();

  const scale = spring({ frame, fps, config: { damping: 12, stiffness: 80 } });
  const lineWidth = interpolate(frame, [15, 45], [0, 100], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill
      style={{
        justifyContent: "center",
        alignItems: "center",
      }}
    >
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: height * 0.02,
          transform: `scale(${scale})`,
        }}
      >
        <div
          style={{
            fontSize: height * 0.08,
            fontWeight: 900,
            color: textColor,
            textAlign: "center",
            fontFamily: "sans-serif",
          }}
        >
          {title}
        </div>
        <div
          style={{
            width: `${lineWidth}%`,
            maxWidth: 300,
            height: 4,
            backgroundColor: accentColor,
            borderRadius: 2,
          }}
        />
      </div>
    </AbsoluteFill>
  );
};

// ─── Main Composition ────────────────────────────────────────────

export const HistoryStoryline: React.FC<HistoryStorylineProps> = (props) => {
  const {
    title = "History Timeline",
    events = [],
    durationPerEventInFrames = 150,
    backgroundColor = "#0f172a",
    accentColor = "#3b82f6",
    textColor = "#f8fafc",
    musicUrl,
    musicVolume = 0.3,
  } = props || {};

  const titleDuration = 60;

  return (
    <AbsoluteFill style={{ backgroundColor }}>
      {musicUrl && (
        <Audio src={musicUrl} volume={musicVolume} />
      )}

      <Sequence durationInFrames={titleDuration}>
        <TitleCard
          title={title}
          accentColor={accentColor}
          textColor={textColor}
        />
      </Sequence>

      <Sequence from={titleDuration}>
        <Series>
          {events.map((event, i) => (
            <Series.Sequence
              key={i}
              durationInFrames={durationPerEventInFrames}
            >
              <EventCard
                event={event}
                accentColor={accentColor}
                textColor={textColor}
              />
            </Series.Sequence>
          ))}
        </Series>
      </Sequence>
    </AbsoluteFill>
  );
};
