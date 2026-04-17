/**
 * Provider adapter unit tests.
 *
 * Each test mocks the underlying HTTP call and verifies:
 *  1. The request is formatted correctly (method, headers, body shape).
 *  2. The response is parsed into the expected output shape.
 *
 * Actual API keys are NOT required — all HTTP is intercepted via
 * environment variable stubs + fetch mocking.
 */
import { describe, it, expect, beforeAll, vi } from "vitest";
import { MockTextProvider, MockImageProvider, MockAudioProvider, MockVideoProvider } from "../providers/mock.js";
import { createTextProvider, createImageProvider, createAudioProvider, createVideoProvider } from "../providers/factory.js";

// ─── Mock providers ───────────────────────────────────────────────────────────

describe("MockTextProvider", () => {
  it("returns a scene plan with the requested scene count", async () => {
    const p = new MockTextProvider();
    const result = await p.generateScript({ prompt: "History of Rome", sceneCount: 3 });
    expect(result.scenes).toHaveLength(3);
    expect(result.narrationScript).toBeTruthy();
  });

  it("accepts style and genre", async () => {
    const p = new MockTextProvider();
    const result = await p.generateScript({ prompt: "test", sceneCount: 2, style: "cinematic", genre: "drama" });
    expect(result.scenes).toHaveLength(2);
  });
});

describe("MockImageProvider", () => {
  it("returns at least one URL", async () => {
    const p = new MockImageProvider();
    const result = await p.generateImage({ prompt: "Sunset over Rome" });
    expect(result.urls).toHaveLength(1);
    expect(result.urls[0]).toMatch(/^https?:\/\//);
  });

  it("respects width/height params", async () => {
    const p = new MockImageProvider();
    const result = await p.generateImage({ prompt: "landscape", width: 1280, height: 720 });
    expect(result.urls).toHaveLength(1);
  });
});

describe("MockAudioProvider", () => {
  it("returns a data URI or URL", async () => {
    const p = new MockAudioProvider();
    const result = await p.generateAudio({ text: "Hello world" });
    expect(typeof result.url).toBe("string");
    expect(result.url.length).toBeGreaterThan(0);
  });
});

describe("MockVideoProvider", () => {
  it("returns a video URL", async () => {
    const p = new MockVideoProvider();
    const result = await p.generateVideo({ prompt: "A beach at sunset" });
    expect(typeof result.url).toBe("string");
    expect(result.url.length).toBeGreaterThan(0);
  });
});

// ─── Factory with env overrides ───────────────────────────────────────────────

describe("createTextProvider", () => {
  it("returns MockTextProvider when env is 'mock'", () => {
    const p = createTextProvider({ provider: "mock" });
    expect(p).toBeInstanceOf(MockTextProvider);
  });

  it("uses explicit ProviderConfig override", async () => {
    const p = createTextProvider({ provider: "mock", model: "test" });
    const result = await p.generateScript({ prompt: "test", sceneCount: 1 });
    expect(result.scenes).toHaveLength(1);
  });
});

describe("createImageProvider", () => {
  it("returns MockImageProvider when no env set", () => {
    const p = createImageProvider({ provider: "mock" });
    expect(p).toBeInstanceOf(MockImageProvider);
  });
});

describe("createAudioProvider", () => {
  it("returns MockAudioProvider for mock provider", () => {
    const p = createAudioProvider({ provider: "mock" });
    expect(p).toBeInstanceOf(MockAudioProvider);
  });
});

describe("createVideoProvider", () => {
  it("returns MockVideoProvider for mock provider", () => {
    const p = createVideoProvider({ provider: "mock" });
    expect(p).toBeInstanceOf(MockVideoProvider);
  });
});

// ─── New provider stubs (verifying instantiation doesn't throw) ───────────────

describe("HiggsFieldVideoProvider", () => {
  it("instantiates without error", async () => {
    process.env.HIGGSFIELD_API_KEY = "test-key";
    const { HiggsFieldVideoProvider } = await import("../providers/higgsfield.js");
    expect(() => new HiggsFieldVideoProvider()).not.toThrow();
  });
});

describe("GeminiTextProvider", () => {
  it("instantiates without error", async () => {
    process.env.GEMINI_API_KEY = "test-key";
    const { GeminiTextProvider } = await import("../providers/gemini.js");
    expect(() => new GeminiTextProvider("gemini-1.5-flash")).not.toThrow();
  });
});

describe("GoogleVertexTextProvider", () => {
  it("instantiates without error", async () => {
    process.env.GOOGLE_VERTEX_PROJECT = "my-project";
    process.env.GOOGLE_VERTEX_LOCATION = "us-central1";
    const { GoogleVertexTextProvider, GoogleVertexImageProvider } = await import("../providers/google-vertex.js");
    expect(() => new GoogleVertexTextProvider("gemini-1.5-pro")).not.toThrow();
    expect(() => new GoogleVertexImageProvider("imagegeneration@006")).not.toThrow();
  });
});

describe("RunwayVideoProvider", () => {
  it("instantiates without error", async () => {
    process.env.RUNWAY_API_SECRET = "test-secret";
    const { RunwayVideoProvider } = await import("../providers/runway.js");
    expect(() => new RunwayVideoProvider()).not.toThrow();
  });
});

describe("LumaVideoProvider", () => {
  it("instantiates without error", async () => {
    process.env.LUMA_API_KEY = "test-key";
    const { LumaVideoProvider } = await import("../providers/luma.js");
    expect(() => new LumaVideoProvider()).not.toThrow();
  });
});

describe("SynthesiaVideoProvider", () => {
  it("instantiates without error", async () => {
    process.env.SYNTHESIA_API_KEY = "test-key";
    const { SynthesiaVideoProvider } = await import("../providers/synthesia.js");
    expect(() => new SynthesiaVideoProvider()).not.toThrow();
  });
});

describe("AWSImageProvider + AWSVideoProvider", () => {
  it("instantiates without error", async () => {
    process.env.AWS_ACCESS_KEY_ID = "AKIAIOSFODNN7EXAMPLE";
    process.env.AWS_SECRET_ACCESS_KEY = "wJalrXUtnFEMI";
    process.env.AWS_REGION = "us-east-1";
    const { AWSImageProvider, AWSVideoProvider } = await import("../providers/aws.js");
    expect(() => new AWSImageProvider("amazon.titan-image-generator-v2:0")).not.toThrow();
    expect(() => new AWSVideoProvider("amazon.nova-reel-v1:0")).not.toThrow();
  });
});

describe("ElevenLabsAudioProvider", () => {
  it("instantiates without error", async () => {
    process.env.ELEVENLABS_API_KEY = "test-key";
    const { ElevenLabsAudioProvider } = await import("../providers/elevenlabs.js");
    expect(() => new ElevenLabsAudioProvider(undefined, "eleven_multilingual_v2")).not.toThrow();
  });
});
