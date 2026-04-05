import { describe, it, expect, beforeAll } from "vitest";
import {
  getAllTemplates,
  getTemplate,
  getTemplateManifests,
  validateInputProps,
} from "../index";

// The registry is populated as a side-effect of importing from "@studio/template-registry"
// (the templates.ts file registers all 5 templates)

describe("Template Registry — template count", () => {
  it("has exactly 5 registered templates", () => {
    const templates = getAllTemplates();
    expect(templates).toHaveLength(5);
  });

  it("contains all expected template IDs", () => {
    const ids = getAllTemplates().map((t) => t.manifest.id);
    expect(ids).toContain("history-storyline");
    expect(ids).toContain("beat-synced-visualizer");
    expect(ids).toContain("quote-card-sequence");
    expect(ids).toContain("social-media-reel");
    expect(ids).toContain("product-showcase");
  });
});

describe("Template Registry — getTemplate()", () => {
  it("returns the template by id", () => {
    const template = getTemplate("history-storyline");
    expect(template).toBeDefined();
    expect(template!.manifest.name).toBe("History Storyline");
  });

  it("returns undefined for unknown id", () => {
    expect(getTemplate("does-not-exist")).toBeUndefined();
  });
});

describe("Template Registry — getTemplateManifests()", () => {
  it("returns manifests with required fields", () => {
    const manifests = getTemplateManifests();
    for (const m of manifests) {
      expect(m.id).toBeTruthy();
      expect(m.name).toBeTruthy();
      expect(m.compositionId).toBeTruthy();
      expect(m.defaultDurationInFrames).toBeGreaterThan(0);
      expect(m.defaultFps).toBeGreaterThan(0);
      expect(m.supportedAspectRatios.length).toBeGreaterThan(0);
    }
  });

  it("each template has a valid propsSchema", () => {
    const manifests = getTemplateManifests();
    for (const m of manifests) {
      expect(m.propsSchema).toBeDefined();
      // The schema should be parseable
      const result = m.propsSchema.safeParse(m.defaultProps);
      expect(result.success).toBe(true);
    }
  });

  it("defaultProps satisfy the propsSchema for every template", () => {
    const templates = getAllTemplates();
    for (const t of templates) {
      const result = t.manifest.propsSchema.safeParse(t.manifest.defaultProps);
      expect(result.success, `${t.manifest.id} defaultProps invalid: ${JSON.stringify((result as any).error?.issues)}`).toBe(true);
    }
  });
});

// ─── validateInputProps ──────────────────────────────────────────

describe("validateInputProps()", () => {
  it("returns success for valid props on history-storyline", () => {
    const result = validateInputProps("history-storyline", {
      title: "Test Timeline",
      events: [{ year: "2024", title: "Event", description: "Desc" }],
      durationPerEventInFrames: 120,
      transitionDurationInFrames: 30,
      backgroundColor: "#000000",
      accentColor: "#ffffff",
      textColor: "#cccccc",
      musicVolume: 0.5,
    });
    expect(result.success).toBe(true);
  });

  it("returns error for unknown template", () => {
    const result = validateInputProps("non-existent", {});
    expect(result.success).toBe(false);
    expect((result as any).error).toContain("not found");
  });

  it("fills in defaults for missing optional props", () => {
    const result = validateInputProps("quote-card-sequence", {
      quotes: [{ text: "Hello world", author: "Me" }],
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect((result.data as any).durationPerQuoteInFrames).toBeDefined();
      expect((result.data as any).backgroundColors).toBeDefined();
    }
  });

  it("rejects empty events array on history-storyline", () => {
    const result = validateInputProps("history-storyline", {
      events: [], // min(1) fails
    });
    expect(result.success).toBe(false);
  });

  it("rejects numberOfSamples that is not a power of 2", () => {
    const result = validateInputProps("beat-synced-visualizer", {
      audioUrl: "https://example.com/audio.mp3",
      numberOfSamples: 100, // not power of 2
    });
    expect(result.success).toBe(false);
  });

  it("accepts valid numberOfSamples (power of 2) for beat-synced-visualizer", () => {
    const result = validateInputProps("beat-synced-visualizer", {
      audioUrl: "https://example.com/audio.mp3",
      numberOfSamples: 64,
    });
    expect(result.success).toBe(true);
  });
});

// ─── Component presence ──────────────────────────────────────────

describe("Registered template components", () => {
  it("every template has a component (React function)", () => {
    const templates = getAllTemplates();
    for (const t of templates) {
      expect(typeof t.component).toBe("function");
    }
  });

  it("calculateMetadata is a function when defined", () => {
    const templates = getAllTemplates();
    for (const t of templates) {
      if (t.calculateMetadata !== undefined) {
        expect(typeof t.calculateMetadata).toBe("function");
      }
    }
  });
});

// ─── Manifest field checks ───────────────────────────────────────

describe("HistoryStoryline manifest", () => {
  const get = () => getTemplate("history-storyline")!.manifest;
  it("compositionId is HistoryStoryline", () => expect(get().compositionId).toBe("HistoryStoryline"));
  it("supports 16:9", () => expect(get().supportedAspectRatios).toContain("16:9"));
  it("category is educational", () => expect(get().category).toBe("educational"));
  it("thumbnailFrame > 0", () => expect(get().thumbnailFrame).toBeGreaterThan(0));
});

describe("BeatSyncedVisualizer manifest", () => {
  const get = () => getTemplate("beat-synced-visualizer")!.manifest;
  it("compositionId is BeatSyncedVisualizer", () => expect(get().compositionId).toBe("BeatSyncedVisualizer"));
  it("supports 1:1", () => expect(get().supportedAspectRatios).toContain("1:1"));
  it("category is music", () => expect(get().category).toBe("music"));
});

describe("SocialMediaReel manifest", () => {
  const get = () => getTemplate("social-media-reel")!.manifest;
  it("compositionId is SocialMediaReel", () => expect(get().compositionId).toBe("SocialMediaReel"));
  it("supports 9:16", () => expect(get().supportedAspectRatios).toContain("9:16"));
  it("category is social", () => expect(get().category).toBe("social"));
});

describe("ProductShowcase manifest", () => {
  const get = () => getTemplate("product-showcase")!.manifest;
  it("compositionId is ProductShowcase", () => expect(get().compositionId).toBe("ProductShowcase"));
  it("supports 4:5", () => expect(get().supportedAspectRatios).toContain("4:5"));
  it("category is marketing", () => expect(get().category).toBe("marketing"));
});
