/**
 * Luma AI provider adapter — video generation via Dream Machine.
 *
 * Env: LUMA_API_KEY
 *
 * Reference: https://docs.lumalabs.ai/docs/video-generation
 * Async: POST /generations → { id }  →  GET /generations/{id} → { state, assets }
 */

import type {
  VideoGenerationRequest,
  VideoGenerationResult,
  VideoProviderAdapter,
} from "./types.js";

const BASE = "https://api.lumalabs.ai/dream-machine/v1";
const POLL_INTERVAL_MS = 5_000;
const MAX_POLLS = 120;

function getKey(): string {
  const key = process.env.LUMA_API_KEY;
  if (!key) throw new Error("LUMA_API_KEY is not set");
  return key;
}

async function lumaFetch<T>(method: "GET" | "POST", path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${getKey()}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    ...(body !== undefined && { body: JSON.stringify(body) }),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText);
    throw new Error(`Luma ${method} ${path} error ${res.status}: ${text}`);
  }
  return res.json() as Promise<T>;
}

function sleep(ms: number) {
  return new Promise<void>((r) => setTimeout(r, ms));
}

export class LumaVideoProvider implements VideoProviderAdapter {
  readonly provider = "luma";

  async generateVideo(req: VideoGenerationRequest): Promise<VideoGenerationResult> {
    type StartResponse = { id: string };
    type PollResponse = {
      state: "pending" | "dreaming" | "completed" | "failed";
      assets?: { video?: string };
      failure_reason?: string;
    };

    const payload: Record<string, unknown> = { prompt: req.prompt };
    if (req.imageUrl) {
      payload.keyframes = {
        frame0: { type: "image", url: req.imageUrl },
      };
    }

    const { id } = await lumaFetch<StartResponse>("POST", "/generations", payload);

    for (let i = 0; i < MAX_POLLS; i++) {
      await sleep(POLL_INTERVAL_MS);
      const poll = await lumaFetch<PollResponse>("GET", `/generations/${id}`);
      if (poll.state === "completed" && poll.assets?.video) {
        return { url: poll.assets.video, mimeType: "video/mp4" };
      }
      if (poll.state === "failed") {
        throw new Error(`Luma generation failed: ${poll.failure_reason ?? "unknown"}`);
      }
    }
    throw new Error("Luma generation timed out");
  }
}
