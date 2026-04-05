import { describe, it, expect } from "vitest";
import { z } from "zod";
import {
  AspectRatioPresetSchema,
  AspectRatioConfig,
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
    const validPresets = ["16:9", "9:16", "1:1", "4:5", "4:3", "2:3", "21:9", "custom"] as const;
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
  it("16:9 is 1920x1080", () => {
    expect(ASPECT_RATIO_DIMENSIONS["16:9"]).toEqual({ width: 1920, height: 1080 });
  });

  it("9:16 is 1080x1920", () => {
    expect(ASPECT_RATIO_DIMENSIONS["9:16"]).toEqual({ width: 1080, height: 1920 });
  });

  it("1:1 is 1080x1080", () => {
    expect(ASPECT_RATIO_DIMENSIONS["1:1"]).toEqual({ width: 1080, height: 1080 });
  });

  it("4:5 is 1080x1350", () => {
    expect(ASPECT_RATIO_DIMENSIONS["4:5"]).toEqual({ width: 1080, height: 1350 });
  });

  it("21:9 is 2560x1080", () => {
    expect(ASPECT_RATIO_DIMENSIONS["21:9"]).toEqual({ width: 2560, height: 1080 });
  });

  it("all standard presets have positive integer dimensions", () => {
    for (const [preset, dims] of Object.entries(ASPECT_RATIO_DIMENSIONS)) {
      expect(dims.width).toBeGreaterThan(0);
      expect(dims.height).toBeGreaterThan(0);
      expect(Number.isInteger(dims.width)).toBe(true);
      expect(Number.isInteger(dims.height)).toBe(true);
    }
  });

  it("dimensions match actual aspect ratio within 2%", () => {
    const ratioMap: Record<string, number> = {
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
