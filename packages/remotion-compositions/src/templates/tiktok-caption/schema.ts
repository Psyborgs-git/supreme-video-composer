import { z } from "zod";

// ─── Caption entry schema ────────────────────────────────────────

const CaptionEntrySchema = z.object({
  text: z.string(),
  startFrame: z.number().min(0),
  endFrame: z.number().min(0),
  speaker: z.string().optional(),
});

// ─── Caption style schema ────────────────────────────────────────

const CaptionStyleSchema = z.object({
  fontFamily: z.string().default("sans-serif"),
  fontSize: z.number().min(10).max(300).default(120),
  color: z.string().default("#ffffff"),
  highlightColor: z.string().default("#39E508"),
  strokeColor: z.string().default("#000000"),
  strokeWidth: z.number().min(0).max(50).default(20),
  position: z.enum(["top", "center", "bottom"]).default("bottom"),
  backgroundPill: z.boolean().default(false),
  pillColor: z.string().default("rgba(0,0,0,0.6)"),
  textTransform: z.enum(["none", "uppercase", "lowercase"]).default("uppercase"),
});

// ─── Main TikTok Caption schema ──────────────────────────────────

export const TikTokCaptionSchema = z.object({
  /** URL or staticFile path to the backing audio/video track */
  src: z.string().default(""),
  /** Whether the source is a video (true) or audio-only (false) */
  srcIsVideo: z.boolean().default(true),
  /** Timed caption entries */
  captions: z.array(CaptionEntrySchema).default([
    { text: "HELLO THERE", startFrame: 0, endFrame: 30 },
    { text: "WELCOME TO", startFrame: 30, endFrame: 60 },
    { text: "THIS VIDEO", startFrame: 60, endFrame: 90 },
  ]),
  /** How many milliseconds each caption page is shown before switching */
  captionSwitchMs: z.number().min(100).default(1200),
  /** Caption visual style */
  captionStyle: CaptionStyleSchema.default({}),
  /** Optional video or image background (used when src is audio-only) */
  backgroundUrl: z.string().optional(),
  /** Background color (fallback) */
  backgroundColor: z.string().default("#000000"),
  /** Accent / brand color for highlights */
  brandColor: z.string().default("#39E508"),
  /** Show a progress bar at the bottom */
  showProgressBar: z.boolean().default(false),
  /** Progress bar color */
  progressBarColor: z.string().default("#39E508"),
  /** Progress bar height as fraction of video height */
  progressBarHeight: z.number().min(0).max(0.05).default(0.005),
});

export type TikTokCaptionProps = z.infer<typeof TikTokCaptionSchema>;
export type CaptionEntry = z.infer<typeof CaptionEntrySchema>;
export type CaptionStyle = z.infer<typeof CaptionStyleSchema>;
