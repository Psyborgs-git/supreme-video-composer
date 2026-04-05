import { z } from "zod";
import {
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  AbsoluteFill,
  Audio,
} from "remotion";
import { useAudioData, visualizeAudio } from "@remotion/media-utils";
import { noise2D } from "@remotion/noise";

// ─── Schema ──────────────────────────────────────────────────────

const VisualizerModeSchema = z.enum(["bars", "circle", "waveform"]);

export const BeatSyncedVisualizerSchema = z.object({
  audioUrl: z.string().default("/audio-proxy/examples/mp3/SoundHelix-Song-1.mp3"),
  mode: VisualizerModeSchema.default("bars"),
  numberOfSamples: z
    .number()
    .refine((n) => (n & (n - 1)) === 0 && n > 0, "Must be power of 2")
    .default(64),
  backgroundColor: z.string().default("#0f0f23"),
  primaryColor: z.string().default("#8b5cf6"),
  secondaryColor: z.string().default("#06b6d4"),
  beatThreshold: z.number().min(0).max(1).default(0.6),
  title: z.string().default("Now Playing"),
  artist: z.string().default("Artist Name"),
  showTitle: z.boolean().default(true),
  noiseIntensity: z.number().min(0).max(1).default(0.3),
});

export type BeatSyncedVisualizerProps = z.infer<typeof BeatSyncedVisualizerSchema>;

// ─── Bar Visualizer ──────────────────────────────────────────────

const BarVisualizer: React.FC<{
  amplitudes: number[];
  primaryColor: string;
  secondaryColor: string;
  frame: number;
}> = ({ amplitudes, primaryColor, secondaryColor, frame }) => {
  const { width, height } = useVideoConfig();
  const barWidth = (width * 0.8) / amplitudes.length;
  const maxBarHeight = height * 0.5;

  return (
    <div
      style={{
        display: "flex",
        alignItems: "flex-end",
        justifyContent: "center",
        height: maxBarHeight,
        gap: 2,
        position: "absolute",
        bottom: height * 0.15,
        left: width * 0.1,
        right: width * 0.1,
      }}
    >
      {amplitudes.map((amp, i) => {
        const noiseVal = noise2D("bar", i * 0.1, frame * 0.01) * 0.1;
        const barHeight = Math.max(4, (amp + noiseVal) * maxBarHeight);
        const t = i / amplitudes.length;

        return (
          <div
            key={i}
            style={{
              width: barWidth - 2,
              height: barHeight,
              borderRadius: (barWidth - 2) / 2,
              background: `linear-gradient(to top, ${primaryColor}, ${secondaryColor})`,
              opacity: 0.6 + amp * 0.4,
              transform: `scaleY(${interpolate(t, [0, 1], [0.8, 1.2])})`,
            }}
          />
        );
      })}
    </div>
  );
};

// ─── Circle Visualizer ───────────────────────────────────────────

const CircleVisualizer: React.FC<{
  amplitudes: number[];
  primaryColor: string;
  secondaryColor: string;
  frame: number;
}> = ({ amplitudes, primaryColor, secondaryColor, frame }) => {
  const { width, height } = useVideoConfig();
  const cx = width / 2;
  const cy = height / 2;
  const baseRadius = Math.min(width, height) * 0.15;
  const avgAmp = amplitudes.reduce((s, a) => s + a, 0) / amplitudes.length;

  return (
    <svg width={width} height={height} style={{ position: "absolute" }}>
      {/* Pulsing center circle */}
      <circle
        cx={cx}
        cy={cy}
        r={baseRadius * (1 + avgAmp * 0.3)}
        fill="none"
        stroke={primaryColor}
        strokeWidth={3}
        opacity={0.4 + avgAmp * 0.6}
      />
      {/* Frequency bars radiating outward */}
      {amplitudes.map((amp, i) => {
        const angle = (i / amplitudes.length) * Math.PI * 2 - Math.PI / 2;
        const noiseVal = noise2D("circle", i * 0.1, frame * 0.01) * 0.05;
        const len = baseRadius * 0.5 + (amp + noiseVal) * baseRadius * 1.5;
        const x1 = cx + Math.cos(angle) * (baseRadius + 5);
        const y1 = cy + Math.sin(angle) * (baseRadius + 5);
        const x2 = cx + Math.cos(angle) * (baseRadius + 5 + len);
        const y2 = cy + Math.sin(angle) * (baseRadius + 5 + len);

        return (
          <line
            key={i}
            x1={x1}
            y1={y1}
            x2={x2}
            y2={y2}
            stroke={i % 2 === 0 ? primaryColor : secondaryColor}
            strokeWidth={3}
            strokeLinecap="round"
            opacity={0.5 + amp * 0.5}
          />
        );
      })}
    </svg>
  );
};

// ─── Waveform Visualizer ─────────────────────────────────────────

const WaveformVisualizer: React.FC<{
  amplitudes: number[];
  primaryColor: string;
  frame: number;
}> = ({ amplitudes, primaryColor, frame }) => {
  const { width, height } = useVideoConfig();
  const centerY = height / 2;
  const maxAmp = height * 0.3;

  const points = amplitudes.map((amp, i) => {
    const x = (i / (amplitudes.length - 1)) * width;
    const noiseVal = noise2D("wave", i * 0.05, frame * 0.02) * 0.1;
    const y = centerY + (amp + noiseVal) * maxAmp * (i % 2 === 0 ? -1 : 1);
    return `${x},${y}`;
  });

  return (
    <svg width={width} height={height} style={{ position: "absolute" }}>
      <polyline
        points={points.join(" ")}
        fill="none"
        stroke={primaryColor}
        strokeWidth={3}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  );
};

// ─── Noise fallback amplitudes (used when audioData is unavailable due to CORS) ─

function makeFakeAmplitudes(frame: number, count: number, intensity: number): number[] {
  return Array.from({ length: count }, (_, i) => {
    const base = noise2D("fake", i * 0.15, frame * 0.025);
    const pulse = noise2D("pulse", frame * 0.04, i * 0.05);
    return Math.max(0, (base * 0.5 + 0.5) * intensity + pulse * 0.15);
  });
}

// ─── Main Composition ────────────────────────────────────────────

export const BeatSyncedVisualizer: React.FC<BeatSyncedVisualizerProps> = (props) => {
  const {
    audioUrl = "/audio-proxy/examples/mp3/SoundHelix-Song-1.mp3",
    mode = "bars",
    numberOfSamples = 64,
    backgroundColor = "#0f0f23",
    primaryColor = "#8b5cf6",
    secondaryColor = "#06b6d4",
    beatThreshold = 0.6,
    title = "Now Playing",
    artist = "Artist Name",
    showTitle = true,
    noiseIntensity = 0.3,
  } = props || {};

  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();

  // useAudioData may return null if the URL is CORS-blocked.
  // Fall back to noise-driven animation so the component always renders.
  const audioData = useAudioData(audioUrl);
  const amplitudes = audioData
    ? visualizeAudio({ audioData, frame, fps, numberOfSamples })
    : makeFakeAmplitudes(frame, numberOfSamples, noiseIntensity);

  const avgAmp = amplitudes.reduce((s, a) => s + a, 0) / amplitudes.length;
  const isBeat = avgAmp > beatThreshold;
  const beatScale = isBeat ? 1.05 : 1;

  return (
    <AbsoluteFill style={{ backgroundColor }}>
      {/* <Audio> uses an HTML <audio> element — not affected by CORS */}
      <Audio src={audioUrl} />

      <div style={{ transform: `scale(${beatScale})`, width: "100%", height: "100%" }}>
        {mode === "bars" && (
          <BarVisualizer
            amplitudes={amplitudes}
            primaryColor={primaryColor}
            secondaryColor={secondaryColor}
            frame={frame}
          />
        )}
        {mode === "circle" && (
          <CircleVisualizer
            amplitudes={amplitudes}
            primaryColor={primaryColor}
            secondaryColor={secondaryColor}
            frame={frame}
          />
        )}
        {mode === "waveform" && (
          <WaveformVisualizer
            amplitudes={amplitudes}
            primaryColor={primaryColor}
            frame={frame}
          />
        )}
      </div>

      {showTitle && (
        <div
          style={{
            position: "absolute",
            bottom: height * 0.05,
            left: 0,
            right: 0,
            textAlign: "center",
            fontFamily: "sans-serif",
          }}
        >
          <div
            style={{
              fontSize: height * 0.04,
              fontWeight: 700,
              color: "#ffffff",
              marginBottom: 8,
              transform: `scale(${beatScale})`,
            }}
          >
            {title}
          </div>
          <div
            style={{
              fontSize: height * 0.025,
              color: "rgba(255,255,255,0.6)",
            }}
          >
            {artist}
          </div>
        </div>
      )}

      {/* Subtle badge when audio analysis is unavailable (noise fallback active) */}
      {!audioData && (
        <div
          style={{
            position: "absolute",
            top: height * 0.03,
            right: width * 0.03,
            fontSize: height * 0.018,
            color: "rgba(255,255,255,0.3)",
            fontFamily: "sans-serif",
          }}
        >
          ⚠ audio analysis unavailable
        </div>
      )}
    </AbsoluteFill>
  );
};
