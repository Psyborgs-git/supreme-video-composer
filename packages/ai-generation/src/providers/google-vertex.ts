/**
 * Google Vertex AI provider adapter — text (Gemini Pro/Flash) + image (Imagen).
 *
 * Env:
 *   GOOGLE_VERTEX_PROJECT   — GCP project id
 *   GOOGLE_VERTEX_LOCATION  — e.g. "us-central1"
 *   GOOGLE_VERTEX_API_KEY   — service-account or API-key auth token
 *
 * Reference:
 *   https://cloud.google.com/vertex-ai/generative-ai/docs
 */

import type {
  ScriptGenerationRequest,
  ScriptGenerationResult,
  GeneratedSceneData,
  TextProviderAdapter,
  ImageGenerationRequest,
  ImageGenerationResult,
  ImageProviderAdapter,
} from "./types.js";

function getConfig() {
  const project = process.env.GOOGLE_VERTEX_PROJECT;
  const location = process.env.GOOGLE_VERTEX_LOCATION ?? "us-central1";
  const apiKey = process.env.GOOGLE_VERTEX_API_KEY;
  if (!project) throw new Error("GOOGLE_VERTEX_PROJECT is not set");
  if (!apiKey) throw new Error("GOOGLE_VERTEX_API_KEY is not set");
  return { project, location, apiKey };
}

async function vertexPost<T>(
  url: string,
  apiKey: string,
  body: unknown,
): Promise<T> {
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText);
    throw new Error(`Vertex AI error ${res.status}: ${text}`);
  }
  return res.json() as Promise<T>;
}

// ─── Text / Script provider ────────────────────────────────────────────────────

export class GoogleVertexTextProvider implements TextProviderAdapter {
  readonly provider = "google-vertex";

  constructor(private readonly model = "gemini-1.5-pro") {}

  async generateScript(req: ScriptGenerationRequest): Promise<ScriptGenerationResult> {
    const { project, location, apiKey } = getConfig();
    const url = `https://${location}-aiplatform.googleapis.com/v1/projects/${project}/locations/${location}/publishers/google/models/${this.model}:generateContent`;

    const systemInstruction = `You are a professional video scriptwriter. Return ONLY valid JSON matching this schema:
{"title":"string","description":"string","narrationScript":"string","backgroundMusicStyle":"string","scenes":[{"title":"string","body":"string","imagePrompt":"string","voiceoverText":"string","durationFrames":number,"enterTransition":"fade"|"blur"|"swipe"|"zoom"|"none","exitTransition":"fade"|"blur"|"swipe"|"zoom"|"none"}]}`;

    const userText = `Create a ${req.sceneCount}-scene video about: "${req.prompt}"${req.style ? `. Style: ${req.style}` : ""}${req.genre ? `. Genre: ${req.genre}` : ""}. Return JSON only.`;

    type VertexResponse = {
      candidates: { content: { parts: { text: string }[] } }[];
    };
    const resp = await vertexPost<VertexResponse>(url, apiKey, {
      systemInstruction: { parts: [{ text: systemInstruction }] },
      contents: [{ role: "user", parts: [{ text: userText }] }],
      generationConfig: { responseMimeType: "application/json" },
    });

    const raw = resp.candidates[0]?.content?.parts?.[0]?.text ?? "{}";
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const rawScenes = Array.isArray(parsed.scenes)
      ? (parsed.scenes as Record<string, unknown>[])
      : [];
    const transitions = ["fade", "blur", "swipe", "zoom", "none"] as const;
    const scenes: GeneratedSceneData[] = rawScenes.map((s, i) => ({
      title: typeof s.title === "string" ? s.title : `Scene ${i + 1}`,
      body: typeof s.body === "string" ? s.body : "",
      imagePrompt:
        typeof s.imagePrompt === "string"
          ? s.imagePrompt
          : typeof s.body === "string"
            ? s.body
            : "",
      voiceoverText:
        typeof s.voiceoverText === "string"
          ? s.voiceoverText
          : typeof s.body === "string"
            ? s.body
            : "",
      durationFrames: typeof s.durationFrames === "number" ? s.durationFrames : 150,
      enterTransition: transitions.includes(s.enterTransition as never)
        ? (s.enterTransition as GeneratedSceneData["enterTransition"])
        : "fade",
      exitTransition: transitions.includes(s.exitTransition as never)
        ? (s.exitTransition as GeneratedSceneData["exitTransition"])
        : "fade",
    }));
    return {
      title:
        typeof parsed.title === "string" ? parsed.title : `Video: ${req.prompt.slice(0, 50)}`,
      description: typeof parsed.description === "string" ? parsed.description : req.prompt,
      narrationScript:
        typeof parsed.narrationScript === "string"
          ? parsed.narrationScript
          : scenes.map((s) => s.voiceoverText).join(" "),
      backgroundMusicStyle:
        typeof parsed.backgroundMusicStyle === "string"
          ? parsed.backgroundMusicStyle
          : "ambient",
      scenes,
    };
  }
}

// ─── Image provider (Imagen) ───────────────────────────────────────────────────

export class GoogleVertexImageProvider implements ImageProviderAdapter {
  readonly provider = "google-vertex";

  constructor(private readonly model = "imagegeneration@006") {}

  async generateImage(req: ImageGenerationRequest): Promise<ImageGenerationResult> {
    const { project, location, apiKey } = getConfig();
    const url = `https://${location}-aiplatform.googleapis.com/v1/projects/${project}/locations/${location}/publishers/google/models/${this.model}:predict`;

    type ImagenResponse = {
      predictions: { bytesBase64Encoded: string; mimeType: string }[];
    };
    const count = Math.min(req.count ?? 1, 4);
    const resp = await vertexPost<ImagenResponse>(url, apiKey, {
      instances: [{ prompt: req.prompt }],
      parameters: {
        sampleCount: count,
        aspectRatio: resolveAspectRatio(req.width, req.height),
      },
    });

    const urls = (resp.predictions ?? []).map((p) => {
      const mime = p.mimeType ?? "image/png";
      return `data:${mime};base64,${p.bytesBase64Encoded}`;
    });
    return { urls };
  }
}

function resolveAspectRatio(w?: number, h?: number): string {
  if (!w || !h) return "1:1";
  const ratio = w / h;
  if (ratio > 1.6) return "16:9";
  if (ratio < 0.65) return "9:16";
  if (Math.abs(ratio - 1) < 0.05) return "1:1";
  return "4:3";
}
