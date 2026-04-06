import { describe, it, expect } from "vitest";
import { z } from "zod";
import {
  AspectRatioPresetSchema,
  AspectRatioConfig,
  ASPECT_RATIO_PRESETS,
  ASPECT_RATIO_DIMENSIONS,
  VideoCodecSchema,
  QualityPresetSchema,
  QUALITY_CRF,
  RenderStatusSchema,
  AssetTypeSchema,
} from "../index";

// ─── AspectRatio ─────────────────────────────────────────────────

describe("AspectRatioPresetSchema", () => {
  it("accepts all valid presets", () => {
    const validPresets = [
      "instagram-post",
      "instagram-reel",
      "youtube",
      "youtube-shorts",
      "twitter-post",
      "tiktok",
      "linkedin-post",
      "linkedin-landscape",
      "facebook-post",
      "pinterest",
      "square-hd",
      "landscape-hd",
      "16:9",
      "9:16",
      "1:1",
      "4:5",
      "4:3",
      "2:3",
      "21:9",
      "custom",
    ] as const;
    for (const preset of validPresets) {
      expect(() => AspectRatioPresetSchema.parse(preset)).not.toThrow();
    }
  });

  it("rejects an invalid preset", () => {
    expect(() => AspectRatioPresetSchema.parse("3:4")).toThrow();
    expect(() => AspectRatioPresetSchema.parse("")).toThrow();
    expect(() => AspectRatioPresetSchema.parse(null)).toThrow();
  });
});

describe("ASPECT_RATIO_DIMENSIONS", () => {
  it("youtube is 1920x1080", () => {
    expect(ASPECT_RATIO_DIMENSIONS.youtube).toEqual({ width: 1920, height: 1080 });
  });

  it("instagram-reel is 1080x1920", () => {
    expect(ASPECT_RATIO_DIMENSIONS["instagram-reel"]).toEqual({ width: 1080, height: 1920 });
  });

  it("instagram-post is 1080x1080", () => {
    expect(ASPECT_RATIO_DIMENSIONS["instagram-post"]).toEqual({ width: 1080, height: 1080 });
  });

  it("pinterest is 1000x1500", () => {
    expect(ASPECT_RATIO_DIMENSIONS.pinterest).toEqual({ width: 1000, height: 1500 });
  });

  it("landscape-hd is 2560x1440", () => {
    expect(ASPECT_RATIO_DIMENSIONS["landscape-hd"]).toEqual({ width: 2560, height: 1440 });
  });

  it("all standard presets have positive integer dimensions", () => {
    for (const [preset, dims] of Object.entries(ASPECT_RATIO_DIMENSIONS)) {
      expect(dims.width).toBeGreaterThan(0);
      expect(dims.height).toBeGreaterThan(0);
      expect(Number.isInteger(dims.width)).toBe(true);
      expect(Number.isInteger(dims.height)).toBe(true);
    }
  });

  it("canonical preset metadata includes labels, platform, and ratio", () => {
    expect(ASPECT_RATIO_PRESETS.youtube.label).toBe("YouTube");
    expect(ASPECT_RATIO_PRESETS.youtube.platform).toBe("YouTube");
    expect(ASPECT_RATIO_PRESETS.youtube.ratio).toBe("16:9");
  });

  it("dimensions match actual aspect ratio within 2%", () => {
    const ratioMap: Record<string, number> = {
      "instagram-post": 1,
      "instagram-reel": 9 / 16,
      youtube: 16 / 9,
      "youtube-shorts": 9 / 16,
      "twitter-post": 16 / 9,
      tiktok: 9 / 16,
      "linkedin-post": 1,
      "linkedin-landscape": 1200 / 628,
      "facebook-post": 1200 / 630,
      pinterest: 2 / 3,
      "square-hd": 1,
      "landscape-hd": 16 / 9,
      "16:9": 16 / 9,
      "9:16": 9 / 16,
      "1:1": 1,
      "4:5": 4 / 5,
      "4:3": 4 / 3,
      "2:3": 2 / 3,
      "21:9": 21 / 9,
    };
    for (const [preset, expectedRatio] of Object.entries(ratioMap)) {
      const dims = ASPECT_RATIO_DIMENSIONS[preset as keyof typeof ASPECT_RATIO_DIMENSIONS];
      const actualRatio = dims.width / dims.height;
      expect(Math.abs(actualRatio - expectedRatio) / expectedRatio).toBeLessThan(0.02);
    }
  });
});

// ─── VideoCodec ──────────────────────────────────────────────────

describe("VideoCodecSchema", () => {
  it("accepts all codecs", () => {
    const codecs = ["h264", "h265", "vp8", "vp9", "av1", "prores", "gif"] as const;
    for (const codec of codecs) {
      expect(() => VideoCodecSchema.parse(codec)).not.toThrow();
    }
  });

  it("rejects invalid codec", () => {
    expect(() => VideoCodecSchema.parse("mp4")).toThrow();
    expect(() => VideoCodecSchema.parse("xvid")).toThrow();
  });
});

// ─── QualityPreset / CRF ─────────────────────────────────────────

describe("QualityPresetSchema", () => {
  it("accepts valid presets", () => {
    const presets = ["draft", "standard", "high", "max"] as const;
    for (const preset of presets) {
      expect(() => QualityPresetSchema.parse(preset)).not.toThrow();
    }
  });
});

describe("QUALITY_CRF", () => {
  it("draft has higher CRF (lower quality) than max", () => {
    expect(QUALITY_CRF.draft).toBeGreaterThan(QUALITY_CRF.max);
  });

  it("quality ordering: draft > standard > high > max", () => {
    expect(QUALITY_CRF.draft).toBeGreaterThan(QUALITY_CRF.standard);
    expect(QUALITY_CRF.standard).toBeGreaterThan(QUALITY_CRF.high);
    expect(QUALITY_CRF.high).toBeGreaterThan(QUALITY_CRF.max);
  });

  it("all CRF values are positive integers", () => {
    for (const crf of Object.values(QUALITY_CRF)) {
      expect(crf).toBeGreaterThanOrEqual(0);
      expect(Number.isInteger(crf)).toBe(true);
    }
  });
});

// ─── RenderStatus ────────────────────────────────────────────────

describe("RenderStatusSchema", () => {
  it("accepts all valid statuses", () => {
    const statuses = ["queued", "bundling", "rendering", "encoding", "complete", "error", "cancelled"] as const;
    for (const status of statuses) {
      expect(() => RenderStatusSchema.parse(status)).not.toThrow();
    }
  });

  it("rejects invalid status", () => {
    expect(() => RenderStatusSchema.parse("pending")).toThrow();
    expect(() => RenderStatusSchema.parse("done")).toThrow();
  });
});

// ─── AssetType ───────────────────────────────────────────────────

describe("AssetTypeSchema", () => {
  it("accepts all valid types", () => {
    const types = ["image", "video", "audio", "font"] as const;
    for (const t of types) {
      expect(() => AssetTypeSchema.parse(t)).not.toThrow();
    }
  });

  it("rejects invalid type", () => {
    expect(() => AssetTypeSchema.parse("text")).toThrow();
    expect(() => AssetTypeSchema.parse("")).toThrow();
  });
});
