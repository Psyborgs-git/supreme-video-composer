import { z } from "zod";

// ─── Scene schema ────────────────────────────────────────────────

const SceneTransitionSchema = z.enum(["fade", "blur", "swipe", "zoom", "none"]).default("fade");

const SceneSchema = z.object({
  /** Scene title (shown as heading overlay) */
  title: z.string().default(""),
  /** Scene body text / narration transcript */
  body: z.string().default(""),
  /** Image URL or asset ID for the scene background */
  imageUrl: z.string().default(""),
  /** Duration of this scene in frames */
  durationFrames: z.number().min(15).default(150),
  /** Transition when entering this scene */
  enterTransition: SceneTransitionSchema,
  /** Transition when exiting this scene */
  exitTransition: SceneTransitionSchema,
  /** Voiceover text for TTS (informational / AI use) */
  voiceoverText: z.string().default(""),
});

// ─── Title / closing card schema ─────────────────────────────────

const CardSchema = z.object({
  text: z.string().default(""),
  subtitle: z.string().default(""),
  durationFrames: z.number().min(15).default(90),
  backgroundColor: z.string().default("#000000"),
  textColor: z.string().default("#ffffff"),
});

// ─── Main Prompt-to-Video schema ─────────────────────────────────

export const PromptToVideoSchema = z.object({
  /** Array of scene objects that make up the video */
  scenes: z.array(SceneSchema).min(1).default([
    {
      title: "Scene 1",
      body: "This is the first scene of your video.",
      imageUrl: "",
      durationFrames: 150,
      enterTransition: "fade",
      exitTransition: "fade",
      voiceoverText: "",
    },
    {
      title: "Scene 2",
      body: "Add more scenes to tell your story.",
      imageUrl: "",
      durationFrames: 150,
      enterTransition: "fade",
      exitTransition: "fade",
      voiceoverText: "",
    },
  ]),
  /** Optional audio URL for full-video narration */
  narrationUrl: z.string().default(""),
  /** Optional background music URL */
  backgroundMusicUrl: z.string().default(""),
  /** Music volume 0-1 */
  musicVolume: z.number().min(0).max(1).default(0.3),
  /** Optional opening title card */
  titleCard: CardSchema.optional(),
  /** Optional closing card */
  closingCard: CardSchema.optional(),
  /** Brand / accent color */
  brandColor: z.string().default("#3B82F6"),
  /** Secondary accent color */
  accentColor: z.string().default("#F59E0B"),
  /** Background color */
  backgroundColor: z.string().default("#000000"),
  /** Font style for text overlays */
  fontFamily: z.string().default("sans-serif"),
  /** Text color */
  textColor: z.string().default("#ffffff"),
  /** Default transition between scenes */
  transitionStyle: SceneTransitionSchema,
  /** Text overlay position */
  textPosition: z.enum(["top", "center", "bottom"]).default("bottom"),
  /** Show scene number indicator */
  showSceneNumbers: z.boolean().default(false),
});

export type PromptToVideoProps = z.infer<typeof PromptToVideoSchema>;
export type Scene = z.infer<typeof SceneSchema>;
export type Card = z.infer<typeof CardSchema>;
