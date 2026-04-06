import { registerTemplate } from "./registry";
import type { CalculateMetadataFunction } from "remotion";
import {
  HistoryStoryline,
  HistoryStorylineSchema,
  BeatSyncedVisualizer,
  BeatSyncedVisualizerSchema,
  QuoteCardSequence,
  QuoteCardSequenceSchema,
  SocialMediaReel,
  SocialMediaReelSchema,
  ProductShowcase,
  ProductShowcaseSchema,
  BabyLens,
  BabyLensSchema,
} from "@studio/remotion-compositions/templates";
import type {
  HistoryStorylineProps,
  BeatSyncedVisualizerProps,
  QuoteCardSequenceProps,
  SocialMediaReelProps,
  ProductShowcaseProps,
  BabyLensProps,
} from "@studio/remotion-compositions/templates";
import { getAudioDurationInSeconds } from "@remotion/media-utils";

// ─── History Storyline ───────────────────────────────────────────

const historyDefaults = HistoryStorylineSchema.parse({});

const historyCalculateMetadata: CalculateMetadataFunction<HistoryStorylineProps> = async ({
  props,
}) => {
  const titleDuration = 60;
  const totalDuration =
    titleDuration + props.events.length * props.durationPerEventInFrames;
  return { durationInFrames: totalDuration, props };
};

registerTemplate({
  manifest: {
    id: "history-storyline",
    name: "History Storyline",
    description: "Animated timeline of historical events with year badges and descriptions",
    category: "educational",
    tags: ["history", "timeline", "educational", "events"],
    defaultDurationInFrames: 510,
    defaultFps: 30,
    supportedAspectRatios: ["youtube", "instagram-reel", "instagram-post"],
    propsSchema: HistoryStorylineSchema,
    defaultProps: historyDefaults as unknown as Record<string, unknown>,
    thumbnailFrame: 70,
    compositionId: "HistoryStoryline",
  },
  component: HistoryStoryline,
  calculateMetadata: historyCalculateMetadata,
});

// ─── Beat-Synced Visualizer ──────────────────────────────────────

const visualizerDefaults = BeatSyncedVisualizerSchema.parse({});

const visualizerCalculateMetadata: CalculateMetadataFunction<BeatSyncedVisualizerProps> = async ({
  props,
}) => {
  try {
    const duration = await getAudioDurationInSeconds(props.audioUrl);
    return { durationInFrames: Math.ceil(duration * 30), props };
  } catch {
    return { durationInFrames: 900, props }; // fallback 30s
  }
};

registerTemplate({
  manifest: {
    id: "beat-synced-visualizer",
    name: "Beat-Synced Visualizer",
    description: "Audio-reactive visualization with bars, circles, or waveform modes",
    category: "music",
    tags: ["audio", "music", "visualizer", "reactive"],
    defaultDurationInFrames: 900,
    defaultFps: 30,
    supportedAspectRatios: ["instagram-post", "youtube", "instagram-reel"],
    propsSchema: BeatSyncedVisualizerSchema,
    defaultProps: visualizerDefaults as unknown as Record<string, unknown>,
    thumbnailFrame: 60,
    compositionId: "BeatSyncedVisualizer",
  },
  component: BeatSyncedVisualizer,
  calculateMetadata: visualizerCalculateMetadata,
});

// ─── Quote Card Sequence ─────────────────────────────────────────

const quoteDefaults = QuoteCardSequenceSchema.parse({});

const quoteCalculateMetadata: CalculateMetadataFunction<QuoteCardSequenceProps> = async ({
  props,
}) => {
  const totalDuration = props.quotes.length * props.durationPerQuoteInFrames;
  return { durationInFrames: totalDuration, props };
};

registerTemplate({
  manifest: {
    id: "quote-card-sequence",
    name: "Quote Card Sequence",
    description: "Sequential animated quote cards with gradient backgrounds",
    category: "social",
    tags: ["quotes", "inspirational", "text", "social"],
    defaultDurationInFrames: 360,
    defaultFps: 30,
    supportedAspectRatios: ["instagram-post", "instagram-reel", "youtube", "pinterest"],
    propsSchema: QuoteCardSequenceSchema,
    defaultProps: quoteDefaults as unknown as Record<string, unknown>,
    thumbnailFrame: 30,
    compositionId: "QuoteCardSequence",
  },
  component: QuoteCardSequence,
  calculateMetadata: quoteCalculateMetadata,
});

// ─── Social Media Reel ───────────────────────────────────────────

const reelDefaults = SocialMediaReelSchema.parse({});

const reelCalculateMetadata: CalculateMetadataFunction<SocialMediaReelProps> = async ({
  props,
}) => {
  const totalDuration = props.slides.length * props.durationPerSlideInFrames;
  return { durationInFrames: totalDuration, props };
};

registerTemplate({
  manifest: {
    id: "social-media-reel",
    name: "Social Media Reel",
    description: "Fast-paced reel with images/videos, transitions, and brand watermark",
    category: "social",
    tags: ["reel", "social", "instagram", "tiktok", "video"],
    defaultDurationInFrames: 270,
    defaultFps: 30,
    supportedAspectRatios: ["instagram-reel", "instagram-post", "tiktok"],
    propsSchema: SocialMediaReelSchema,
    defaultProps: reelDefaults as unknown as Record<string, unknown>,
    thumbnailFrame: 15,
    compositionId: "SocialMediaReel",
  },
  component: SocialMediaReel,
  calculateMetadata: reelCalculateMetadata,
});

// ─── Product Showcase ────────────────────────────────────────────

const productDefaults = ProductShowcaseSchema.parse({});

const productCalculateMetadata: CalculateMetadataFunction<ProductShowcaseProps> = async ({
  props,
}) => {
  const totalDuration = props.products.length * props.durationPerProductInFrames;
  return { durationInFrames: totalDuration, props };
};

registerTemplate({
  manifest: {
    id: "product-showcase",
    name: "Product Showcase",
    description: "Product presentation with spring animations and price badges",
    category: "marketing",
    tags: ["product", "ecommerce", "marketing", "showcase"],
    defaultDurationInFrames: 240,
    defaultFps: 30,
    supportedAspectRatios: ["instagram-post", "pinterest", "youtube", "linkedin-landscape"],
    propsSchema: ProductShowcaseSchema,
    defaultProps: productDefaults as unknown as Record<string, unknown>,
    thumbnailFrame: 30,
    compositionId: "ProductShowcase",
  },
  component: ProductShowcase,
  calculateMetadata: productCalculateMetadata,
});

// ─── BabyLens ────────────────────────────────────────────────────

const babylensDefaults = BabyLensSchema.parse({});

registerTemplate({
  manifest: {
    id: "babylens",
    name: "BabyLens",
    description: "Social reel for parenting apps with POV, product reveal, features, and CTA",
    category: "social",
    tags: ["social", "reel", "parenting", "app", "vertical"],
    defaultDurationInFrames: 900,
    defaultFps: 30,
    supportedAspectRatios: ["instagram-reel", "youtube-shorts", "tiktok"],
    propsSchema: BabyLensSchema,
    defaultProps: babylensDefaults as unknown as Record<string, unknown>,
    thumbnailFrame: 210,
    compositionId: "BabyLens",
  },
  component: BabyLens,
});
