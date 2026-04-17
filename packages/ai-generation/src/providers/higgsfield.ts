/**
 * Higgsfield AI provider adapter — video generation (text2video + img2video).
 *
 * API reference: https://docs.higgsfield.ai
 * Env: HIGGSFIELD_API_KEY
 *
 * Higgsfield uses an async pattern:
 *   POST /generation  → { generation_id }
 *   GET  /generation/{id} → { status, video_url }
 */

import type {
  VideoGenerationRequest,
  VideoGenerationResult,
  VideoProviderAdapter,
} from "./types.js";

const BASE = "https://api.higgsfield.ai/v1";
const POLL_INTERVAL_MS = 4_000;
const MAX_POLLS = 150; // ~10 min

function getKey(): string {
  const key = process.env.HIGGSFIELD_API_KEY;
  if (!key) throw new Error("HIGGSFIELD_API_KEY is not set");
  return key;
}

async function hfFetch<T>(
  method: "GET" | "POST",
  path: string,
  body?: unknown,
): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${getKey()}`,
      "Content-Type": "application/json",
    },
    ...(body !== undefined && { body: JSON.stringify(body) }),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText);
    throw new Error(`Higgsfield ${method} ${path} error ${res.status}: ${text}`);
  }
  return res.json() as Promise<T>;
}

function sleep(ms: number) {
  return new Promise<void>((r) => setTimeout(r, ms));
}

export class HiggsFieldVideoProvider implements VideoProviderAdapter {
  readonly provider = "higgsfield";

  async generateVideo(req: VideoGenerationRequest): Promise<VideoGenerationResult> {
    type StartResponse = { generation_id: string };
    const payload: Record<string, unknown> = {
      prompt: req.prompt,
      duration: req.durationSeconds ?? 4,
      width: req.width ?? 1280,
      height: req.height ?? 720,
    };
    if (req.imageUrl) payload.image_url = req.imageUrl;

    const { generation_id } = await hfFetch<StartResponse>("POST", "/generation", payload);

    type PollResponse = {
      status: "pending" | "processing" | "completed" | "failed";
      video_url?: string;
      error?: string;
    };

    for (let i = 0; i < MAX_POLLS; i++) {
      await sleep(POLL_INTERVAL_MS);
      const poll = await hfFetch<PollResponse>("GET", `/generation/${generation_id}`);
      if (poll.status === "completed" && poll.video_url) {
        return { url: poll.video_url, mimeType: "video/mp4" };
      }
      if (poll.status === "failed") {
        throw new Error(`Higgsfield generation failed: ${poll.error ?? "unknown"}`);
      }
    }
    throw new Error("Higgsfield generation timed out");
  }
}
