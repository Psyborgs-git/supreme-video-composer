/**
 * OpenAI provider adapters for text (GPT), image (DALL-E), and audio (TTS).
 *
 * These use the native OpenAI REST API directly (no extra SDK dependency
 * so we don't pull in the full openai package at build time).
 * The `OPENAI_API_KEY` env var must be set for these to work.
 */

import type {
  AudioGenerationRequest,
  AudioGenerationResult,
  AudioProviderAdapter,
  GeneratedSceneData,
  ImageGenerationRequest,
  ImageGenerationResult,
  ImageProviderAdapter,
  ScriptGenerationRequest,
  ScriptGenerationResult,
  TextProviderAdapter,
} from "./types.js";

const OPENAI_BASE = "https://api.openai.com/v1";

function getKey(): string {
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new Error("OPENAI_API_KEY is not set");
  return key;
}

async function openaiPost<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${OPENAI_BASE}${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${getKey()}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText);
    throw new Error(`OpenAI ${path} error ${res.status}: ${text}`);
  }
  return res.json() as Promise<T>;
}

// ─── OpenAI Text / Script ────────────────────────────────────────

export class OpenAITextProvider implements TextProviderAdapter {
  readonly provider = "openai";

  constructor(private readonly model = "gpt-4o-mini") {}

  async generateScript(req: ScriptGenerationRequest): Promise<ScriptGenerationResult> {
    const systemPrompt = `You are a professional video scriptwriter. Generate a structured video script as JSON.
Return ONLY valid JSON matching this shape:
{
  "title": "string",
  "description": "string",
  "narrationScript": "string",
  "backgroundMusicStyle": "string",
  "scenes": [{
    "title": "string",
    "body": "string",
    "imagePrompt": "string describing the visual",
    "voiceoverText": "string",
    "durationFrames": number,
    "enterTransition": "fade"|"blur"|"swipe"|"zoom"|"none",
    "exitTransition": "fade"|"blur"|"swipe"|"zoom"|"none"
  }]
}`;

    const userPrompt = `Create a ${req.sceneCount}-scene video about: "${req.prompt}"${req.style ? `. Style: ${req.style}` : ""}${req.genre ? `. Genre: ${req.genre}` : ""}.`;

    type ChatResponse = { choices: { message: { content: string } }[] };
    const resp = await openaiPost<ChatResponse>("/chat/completions", {
      model: this.model,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      response_format: { type: "json_object" },
      temperature: 0.7,
    });

    const raw = resp.choices[0]?.message?.content ?? "{}";
    const parsed = JSON.parse(raw) as Partial<ScriptGenerationResult>;

    // Normalise and fill defaults
    const scenes: GeneratedSceneData[] = (parsed.scenes ?? []).map((s, i) => ({
      title: (s as GeneratedSceneData).title ?? `Scene ${i + 1}`,
      body: (s as GeneratedSceneData).body ?? "",
      imagePrompt: (s as GeneratedSceneData).imagePrompt ?? (s as GeneratedSceneData).body ?? "",
      voiceoverText: (s as GeneratedSceneData).voiceoverText ?? (s as GeneratedSceneData).body ?? "",
      durationFrames: (s as GeneratedSceneData).durationFrames ?? 150,
      enterTransition: (s as GeneratedSceneData).enterTransition ?? "fade",
      exitTransition: (s as GeneratedSceneData).exitTransition ?? "fade",
    }));

    return {
      title: parsed.title ?? `Video: ${req.prompt.slice(0, 50)}`,
      description: parsed.description ?? req.prompt,
      narrationScript: parsed.narrationScript ?? scenes.map((s) => s.voiceoverText).join(" "),
      backgroundMusicStyle: parsed.backgroundMusicStyle ?? "ambient",
      scenes,
    };
  }
}

// ─── OpenAI Image (DALL-E) ────────────────────────────────────────

export class OpenAIImageProvider implements ImageProviderAdapter {
  readonly provider = "openai";

  constructor(private readonly model = "dall-e-3") {}

  async generateImage(req: ImageGenerationRequest): Promise<ImageGenerationResult> {
    // DALL-E 3 supports "1024x1024", "1792x1024", "1024x1792"
    const sizeMap: Record<string, string> = {
      "1920x1080": "1792x1024",
      "1080x1920": "1024x1792",
      "1080x1080": "1024x1024",
    };
    const w = req.width ?? 1024;
    const h = req.height ?? 1024;
    const size = sizeMap[`${w}x${h}`] ?? "1024x1024";

    type ImgResponse = { data: { url: string }[] };
    const resp = await openaiPost<ImgResponse>("/images/generations", {
      model: this.model,
      prompt: req.prompt,
      n: 1, // DALL-E 3 only supports n=1
      size,
      quality: "standard",
      response_format: "url",
    });

    const urls = (resp.data ?? []).map((d) => d.url).filter(Boolean);
    return { urls };
  }
}

// ─── OpenAI TTS ───────────────────────────────────────────────────

export class OpenAIAudioProvider implements AudioProviderAdapter {
  readonly provider = "openai";

  constructor(
    private readonly model = "tts-1",
    private readonly voice: string = "alloy",
  ) {}

  async generateAudio(req: AudioGenerationRequest): Promise<AudioGenerationResult> {
    const res = await fetch(`${OPENAI_BASE}/audio/speech`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${getKey()}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: this.model,
        input: req.text,
        voice: req.voiceId ?? this.voice,
        speed: req.speed ?? 1.0,
        response_format: req.format ?? "mp3",
      }),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => res.statusText);
      throw new Error(`OpenAI TTS error ${res.status}: ${text}`);
    }

    const buffer = await res.arrayBuffer();
    const base64 = Buffer.from(buffer).toString("base64");
    const mimeType = req.format === "wav" ? "audio/wav" : "audio/mpeg";
    return {
      url: `data:${mimeType};base64,${base64}`,
      mimeType,
    };
  }
}
