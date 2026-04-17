/**
 * Runway ML provider adapter — video generation (Gen-3 text2video + img2video).
 *
 * Env: RUNWAY_API_SECRET
 *
 * Reference: https://docs.runwayml.com/reference/post_v1-image-to-video
 * Async: POST → { id }  →  GET /v1/tasks/{id} → { status, output }
 */

import type {
  VideoGenerationRequest,
  VideoGenerationResult,
  VideoProviderAdapter,
} from "./types.js";

const BASE = "https://api.runwayml.com/v1";
const POLL_INTERVAL_MS = 5_000;
const MAX_POLLS = 120; // ~10 min

function getKey(): string {
  const key = process.env.RUNWAY_API_SECRET;
  if (!key) throw new Error("RUNWAY_API_SECRET is not set");
  return key;
}

async function rwFetch<T>(method: "GET" | "POST", path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${getKey()}`,
      "Content-Type": "application/json",
      "X-Runway-Version": "2024-11-06",
    },
    ...(body !== undefined && { body: JSON.stringify(body) }),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText);
    throw new Error(`Runway ${method} ${path} error ${res.status}: ${text}`);
  }
  return res.json() as Promise<T>;
}

function sleep(ms: number) {
  return new Promise<void>((r) => setTimeout(r, ms));
}

export class RunwayVideoProvider implements VideoProviderAdapter {
  readonly provider = "runway";

  async generateVideo(req: VideoGenerationRequest): Promise<VideoGenerationResult> {
    type StartResponse = { id: string };
    type PollResponse = {
      status: "PENDING" | "RUNNING" | "SUCCEEDED" | "FAILED" | "CANCELLED";
      output?: string[];
      failure?: string;
    };

    let endpoint = "/image_to_video";
    const payload: Record<string, unknown> = {
      model: "gen3a_turbo",
      duration: Math.min(req.durationSeconds ?? 5, 10),
      ratio: resolveRatio(req.width, req.height),
    };

    if (req.imageUrl) {
      payload.promptImage = req.imageUrl;
      payload.promptText = req.prompt;
    } else {
      endpoint = "/text_to_video";
      payload.promptText = req.prompt;
    }

    const { id } = await rwFetch<StartResponse>("POST", endpoint, payload);

    for (let i = 0; i < MAX_POLLS; i++) {
      await sleep(POLL_INTERVAL_MS);
      const poll = await rwFetch<PollResponse>("GET", `/tasks/${id}`);
      if (poll.status === "SUCCEEDED" && poll.output?.[0]) {
        return { url: poll.output[0], mimeType: "video/mp4" };
      }
      if (poll.status === "FAILED" || poll.status === "CANCELLED") {
        throw new Error(`Runway generation ${poll.status}: ${poll.failure ?? "unknown"}`);
      }
    }
    throw new Error("Runway generation timed out");
  }
}

function resolveRatio(w?: number, h?: number): string {
  if (!w || !h) return "1280:720";
  return `${w}:${h}`;
}
