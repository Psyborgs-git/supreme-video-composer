import { z } from "zod";
import {
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  spring,
  AbsoluteFill,
  Series,
  Audio,
  Img,
  OffthreadVideo,
} from "remotion";

// ─── Schema ──────────────────────────────────────────────────────

const SlideSchema = z.object({
  type: z.enum(["image", "video"]),
  url: z.string(),
  caption: z.string().optional(),
});

export const SocialMediaReelSchema = z.object({
  slides: z.array(SlideSchema).min(1).default([
    { type: "image", url: "https://picsum.photos/1080/1920", caption: "Slide 1" },
    { type: "image", url: "https://picsum.photos/1080/1920?random=2", caption: "Slide 2" },
    { type: "image", url: "https://picsum.photos/1080/1920?random=3", caption: "Slide 3" },
  ]),
  durationPerSlideInFrames: z.number().min(15).default(90),
  transitionType: z.enum(["swipe", "zoom", "fade"]).default("swipe"),
  musicUrl: z.string().optional(),
  musicVolume: z.number().min(0).max(1).default(0.5),
  brandName: z.string().default("@yourbrand"),
  brandColor: z.string().default("#ffffff"),
  showBrand: z.boolean().default(true),
  backgroundColor: z.string().default("#000000"),
});

export type SocialMediaReelProps = z.infer<typeof SocialMediaReelSchema>;

// ─── Single Slide ────────────────────────────────────────────────

const Slide: React.FC<{
  slide: z.infer<typeof SlideSchema>;
  transitionType: string;
  brandName: string;
  brandColor: string;
  showBrand: boolean;
  backgroundColor: string;
}> = ({ slide, transitionType, brandName, brandColor, showBrand, backgroundColor }) => {
  const frame = useCurrentFrame();
  const { fps, width, height, durationInFrames } = useVideoConfig();

  // Entry animation
  let entryTransform = "";
  const entryProgress = spring({ frame, fps, config: { damping: 15, stiffness: 80 } });

  if (transitionType === "swipe") {
    const x = interpolate(entryProgress, [0, 1], [width, 0]);
    entryTransform = `translateX(${x}px)`;
  } else if (transitionType === "zoom") {
    const scale = interpolate(entryProgress, [0, 1], [1.3, 1]);
    const opacity = interpolate(frame, [0, 10], [0, 1], { extrapolateRight: "clamp" });
    entryTransform = `scale(${scale})`;
  } else {
    entryTransform = "";
  }

  const fadeIn = transitionType === "fade"
    ? interpolate(frame, [0, 15], [0, 1], { extrapolateRight: "clamp" })
    : 1;

  // Caption animation
  const captionSpring = spring({ frame: frame - 10, fps, config: { damping: 15, stiffness: 60 } });
  const captionY = interpolate(captionSpring, [0, 1], [30, 0]);

  return (
    <AbsoluteFill style={{ backgroundColor, overflow: "hidden" }}>
      <div
        style={{
          width: "100%",
          height: "100%",
          transform: entryTransform,
          opacity: fadeIn,
        }}
      >
        {slide.type === "image" ? (
          <Img
            src={slide.url}
            style={{ width: "100%", height: "100%", objectFit: "cover" }}
          />
        ) : (
          <OffthreadVideo
            src={slide.url}
            style={{ width: "100%", height: "100%", objectFit: "cover" }}
          />
        )}
      </div>

      {/* Caption overlay */}
      {slide.caption && (
        <div
          style={{
            position: "absolute",
            bottom: height * 0.12,
            left: 0,
            right: 0,
            textAlign: "center",
            transform: `translateY(${captionY}px)`,
            opacity: Math.max(0, captionSpring),
          }}
        >
          <div
            style={{
              display: "inline-block",
              padding: "12px 24px",
              backgroundColor: "rgba(0,0,0,0.6)",
              borderRadius: 8,
              fontSize: height * 0.03,
              color: "#ffffff",
              fontWeight: 600,
              fontFamily: "sans-serif",
            }}
          >
            {slide.caption}
          </div>
        </div>
      )}

      {/* Brand watermark */}
      {showBrand && (
        <div
          style={{
            position: "absolute",
            top: height * 0.04,
            right: width * 0.04,
            fontSize: height * 0.02,
            color: brandColor,
            fontWeight: 700,
            opacity: 0.8,
            fontFamily: "sans-serif",
          }}
        >
          {brandName}
        </div>
      )}
    </AbsoluteFill>
  );
};

// ─── Main Composition ────────────────────────────────────────────

export const SocialMediaReel: React.FC<SocialMediaReelProps> = (props) => {
  const {
    slides = [
      { type: "image", url: "https://picsum.photos/1080/1920", caption: "Slide 1" },
      { type: "image", url: "https://picsum.photos/1080/1920?random=2", caption: "Slide 2" },
      { type: "image", url: "https://picsum.photos/1080/1920?random=3", caption: "Slide 3" },
    ] as unknown as Array<{ type: "image" | "video"; url: string; caption?: string }>,
    durationPerSlideInFrames = 90,
    transitionType = "swipe",
    musicUrl,
    musicVolume = 0.5,
    brandName = "@yourbrand",
    brandColor = "#ffffff",
    showBrand = true,
    backgroundColor = "#000000",
  } = props || {};

  return (
    <AbsoluteFill style={{ backgroundColor }}>
      {musicUrl && <Audio src={musicUrl} volume={musicVolume} />}

      <Series>
        {slides.map((slide, i) => (
          <Series.Sequence key={i} durationInFrames={durationPerSlideInFrames}>
            <Slide
              slide={slide}
              transitionType={transitionType}
              brandName={brandName}
              brandColor={brandColor}
              showBrand={showBrand}
              backgroundColor={backgroundColor}
            />
          </Series.Sequence>
        ))}
      </Series>
    </AbsoluteFill>
  );
};
