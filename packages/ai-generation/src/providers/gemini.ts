/**
 * Gemini API provider adapter — text / script generation via Google AI Studio.
 *
 * This uses the public Gemini API endpoint (separate from Vertex AI).
 * Env: GEMINI_API_KEY
 *
 * Reference: https://ai.google.dev/api/generate-content
 */

import type {
  ScriptGenerationRequest,
  ScriptGenerationResult,
  GeneratedSceneData,
  TextProviderAdapter,
} from "./types.js";

const BASE = "https://generativelanguage.googleapis.com/v1beta";

function getKey(): string {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error("GEMINI_API_KEY is not set");
  return key;
}

export class GeminiTextProvider implements TextProviderAdapter {
  readonly provider = "gemini";

  constructor(private readonly model = "gemini-1.5-flash") {}

  async generateScript(req: ScriptGenerationRequest): Promise<ScriptGenerationResult> {
    const systemInstruction = `You are a professional video scriptwriter. Return ONLY valid JSON matching this schema:
{"title":"string","description":"string","narrationScript":"string","backgroundMusicStyle":"string","scenes":[{"title":"string","body":"string","imagePrompt":"string","voiceoverText":"string","durationFrames":number,"enterTransition":"fade"|"blur"|"swipe"|"zoom"|"none","exitTransition":"fade"|"blur"|"swipe"|"zoom"|"none"}]}`;

    const userText = `Create a ${req.sceneCount}-scene video about: "${req.prompt}"${req.style ? `. Style: ${req.style}` : ""}${req.genre ? `. Genre: ${req.genre}` : ""}. Return JSON only.`;

    const url = `${BASE}/models/${this.model}:generateContent?key=${getKey()}`;

    type GeminiResponse = {
      candidates: { content: { parts: { text: string }[] } }[];
    };

    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: systemInstruction }] },
        contents: [{ role: "user", parts: [{ text: userText }] }],
        generationConfig: { responseMimeType: "application/json" },
      }),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => res.statusText);
      throw new Error(`Gemini API error ${res.status}: ${text}`);
    }

    const data = (await res.json()) as GeminiResponse;
    const raw = data.candidates?.[0]?.content?.parts?.[0]?.text ?? "{}";
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
